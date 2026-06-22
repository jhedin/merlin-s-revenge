# Behavioral Parity Audit — `dwarfTower`

Method: derived intended behavior from the original cast/data, then REPRODUCED it in the port
(`tools/_audit_dwarfTower.ts`, now deleted) loading the real `src/generated/assets.json` bundle, wiring
`game.spawnEnemy/Unit/Ally`, a `CollisionGrid(80,80,32)`, `teamMaster.unitMap.configure(32,0,0)`, and
calling `rebuildCombatSubstrate()` each tick. Spawned the tower + targets, ran ~200 frames, observed.

## SECTION 1 — Derived-correct behavior (from the original)

`casts/data/act_dwarfTower.txt`:
- **objType** `#objCPUCharacter`, **AiType** `#objAiCPU`, inherits `#CPUCharacter`.
- **Team** `#aldevar` (ally), **teamRole** `#teamBuildings`. (`tem_aldevar` hates #goblins/#monsters/#orcs… in tier 0.)
- **energy** 100, **strength** 15, **dexterity** 10, **inertia** 95, **eyestrain** 40, **damageSpeed** 3,
  **reelProof** true, **miniMapStatus** `#clr`, **walkSpeed** 0 / **walkSpeedIncLevel** 0 → STATIONARY turret.
- **#attack `#fireAxe`**: `#animType #naturalRanged` (→ ranged), `#bullet #towerAxe`, `#animFrame 31`,
  `#cooldown 10`, `#firingType #proportional` (throwVect = distXY/10), `#reach 600`,
  `#collisionLoc point(0,-88)` (muzzle 88px above), `#sound #none`,
  `#targetRoles [[#teamBuildings],[#teamMembers]]` — **two priority tiers**.
- **Bullet `#towerAxe`** (`act_towerAxe.txt`): `#inherit #bullet`, splash — `splashDamageOn`/`splashGraveOn`,
  power 50, damageMultiplier 10, `hits [#teamMembers,#teamBuildings]`, `collideWithTarget false`,
  friction point(9,9), weight 0.4, rotational false, recordInRoomState false.

Tiered targeting (`casts/master_objects/teamMaster.txt:744-808` `findTargetInTeam`): iterate
`targetRoles` tier by tier — search tier 0 `[#teamBuildings]`; **only if that finds NO target**
(`if closestTarget.obj <> #none then exit repeat`) fall through to tier 1 `[#teamMembers]`. So the tower
prefers enemy **buildings** and engages enemy **members** (orcs etc.) when no enemy building is in play.

Net: an immobile #aldevar turret that throws a splashing axe up to **600px**, preferring enemy buildings
but otherwise mowing down enemy troops; lobs the axe so it always crosses the gap in ~10 frames; never
moves; immune to knockback/reel; leaves a grave (+ splashGrave) on death.

## SECTION 2 — Observed port behavior (reproduced)

Spawned via `spawnAlly("dwarfTower")` (→ `spawnEnemy`, the in-game build path also routes
`#objCPUCharacter` through `spawnUnit`→`spawnEnemy`).

- Data carried faithfully into `data.json` (energy 100, firingType #proportional, reach 600, targetRoles
  two-tier, towerAxe splash). `getTargeting()` returns `targetRoles=[["#teamBuildings"],["#teamMembers"]]`. ✓
- Art all present in the bundle: `dwarfTower_stand`, `dwarfTower_naturalRanged` (39 frames; animFrame 31
  valid), `dwarfTower_grave`, `dwarfTower_beBuilt`; bullet `towerAxe_fly/land/grave`. **No fallback strips.** ✓
- `reelProof=true`, `splashBullet` resolved (towerAxe), `bulletChar=towerAxe`, `ranged=true`. ✓
- **Stationary:** with a real target it actually drifted **-4.3px** (entered `moveToAttack`, pathed toward a
  >reach target it could never reach) — but `walkSpeed*0.6=0` caps velocity, so practically immobile. ✓
- **Firing chain works when a tier-0 target exists:** forcing a target's role to `#teamBuildings` →
  `acquired=true`, `moveToAttack`, splash bullets spawned (projSeen≥2). ✓
- **BUT** with the canonical setup (ally tower vs. hostile #monsters/#goblins **members/buildings**) the
  tower **never acquired and never fired** across 200 frames (`aiMode=findTarget`, `aiTarget=null`,
  projSeen=0) at every distance 200–590px.

## SECTION 3 — Divergences

### DIV-1 (PORT BUG) — `teamRole #teamBuildings` dropped; tower spawns as `#teamMembers`
`spawnEnemy` hardcodes the role and ignores the actor's `#teamRole`.
- Original: `act_dwarfTower.txt:29` `#teamRole: #teamBuildings`.
- Port: `port/src/entities/archetypes.ts:320` `team: str("team","#monsters"), teamRole: "#teamMembers",`
  — literal, never reads `d["teamRole"]`. (Only `spawnDwelling`, archetypes.ts:100, sets `#teamBuildings`,
  and dwarfTower is `#objCPUCharacter`, so it routes through `spawnUnit`→`spawnEnemy` — never that path.)
- Observed: `tower role=#teamMembers` (data says `#teamBuildings`). Same defect hits `garTower` (also a
  `#objCPUCharacter` `#teamBuildings`): probe showed `garTower role(port)=#teamMembers`.
- Effect: the tower is no longer in any team's `buildings` roster, so hunters that target `#teamBuildings`
  can't find it, AND its own tier-0 `[#teamBuildings]` search matches nothing in a port world where nothing
  carries that role. (The prior `garTower.md` audit asserted "TeamRole #teamBuildings ✓ at archetypes.ts:266";
  line 266 is a comment — the assertion is incorrect.)

### DIV-2 (PORT BUG) — tiered `targetRoles` fall-through missing (only tier 0 honored)
- Original: `casts/master_objects/teamMaster.txt:760-804` iterates every tier in `targetRoles`; advances to
  tier 1 only when tier 0 yields no target.
- Port: `port/src/systems/teams.ts:152-156` reads `tg.targetRoles[0]` **only** — no loop over tiers, no
  fall-through. `const roles = tg.targetRoles[0] ?? []; const onlyRole = roles.length===1 ? roles[0] : null;`
- Observed: dwarfTower's tier 0 is `[#teamBuildings]`; with only enemy MEMBERS present it returns null and
  the tower idles forever. Isolation probe — forcing the tower's `targetRoles` to single-tier
  `[[#teamMembers]]` → `acquired=true`, `moveToAttack`, projSeen=3. So the firing chain is fine; the sole
  blocker for member targets is the absent tier fall-through. Compounded by DIV-1 (nothing has the
  `#teamBuildings` role either), the shipped dwarfTower **never fires** in normal play.

### DIV-3 (PORT BUG) — `reach 600` clamped to 220
- Original: `act_dwarfTower.txt:15` `#reach: 600` (a deliberately long-range turret; cf. `modAttack`
  `targetInReach`).
- Port: `port/src/components/control.ts:502` (and `:667`)
  `this.reachRanged = Math.min(220, Math.max(60, cfg["atkReach"]))` — caps at **220**. The comment ("cap
  magic's 9999") shows the cap targets spellcasters, but it also crushes the tower's legitimate 600.
- Observed: `reachRanged=220` at spawn. Reach-clamp probe (target role forced to #teamBuildings so tier-0
  matches): fires at 200px and once the mobile orc closes within 220 at 300px, but at 500/590px (well within
  600) `projSeen=0` — the tower will not fire until the target walks inside 220px. `findTarget` itself is
  unbounded, so the tower commits to a 590px target and (walkSpeed 0) sits in `moveToAttack` unable to fire.

### FAITHFUL / not divergences
- `#firingType #proportional` → `throwSpeed = dist/10` is implemented (control.ts:771-772) and verified in the
  working probes; the earlier systemic fix holds. ✓
- `reelProof`, energy 100, strength/dexterity/inertia, animFrame-31 firing (39-frame strip), splash bullet
  (`fireSplashBullet`), grave, stationary `walkSpeed 0` — all faithful. ✓
- The splash bullet's hardcoded `friction:1` in `fireSplashBullet` (vs towerAxe's `friction point(9,9)`) is a
  shared splash-bullet travel abstraction, not dwarfTower-specific — out of scope here.

## Conclusion
The art and the per-shot firing mechanics are faithful, but **the shipped port dwarfTower never engages
anything in normal play** because of three interacting issues: its data `#teamBuildings` role is dropped
(DIV-1), the tiered `targetRoles` fall-through is missing so its tier-0 building search finds nothing and
never advances to members (DIV-2), and even when it does acquire, its 600 reach is clamped to 220 (DIV-3).
DIV-1 and DIV-2 are systemic (DIV-1 also breaks garTower; DIV-2 affects every multi-tier `targetRoles`
actor). All three are PORT bugs, not faithful original-game quirks.
