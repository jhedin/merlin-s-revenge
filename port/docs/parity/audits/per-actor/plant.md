# Behavioral Parity Audit — `plant`

Method: derived intended behavior from the original cast/data, then REPRODUCED it in the port
(`tools/_audit_plant.ts`, now deleted) loading the real `src/generated/assets.json` bundle, wiring
`game.spawnEnemy/Unit/Ally`, a `CollisionGrid(80,80,32)`, `teamMaster.unitMap.configure(32,0,0)`, and
calling `rebuildCombatSubstrate()` each tick. Spawned the plant + a hated `#village` target (farmer) at
100px, ran 250 frames, observed firing/cadence/movement/death; a second pass read the projectile char.

## SECTION 1 — Derived-correct behavior (from the original)

`casts/data/act_plant.txt`:
- **objType** `#objCPUCharacter`, **AiType** `#objAiCPU`, inherits `#CPUCharacter` (`act_CPUCharacter.txt`).
- **Team** `#swamp` (enemy category; `tem_swamp.txt:7` hates `[#aldevar, #monsterSummon, #magicalAlliance,
  #ninja, #undead, #scarlet, #village]`), **teamRole** `#teamBuildings` (joins the team BUILDINGS pool —
  it's a turret-plant, hunters with a building-priority tier target it).
- **energy** 80, **strength** 15, **dexterity** 3, **inertia** 40, **eyestrain** 40, **damageSpeed** 3,
  **experienceImWorth** 60, **reelProof** true, **frictionReel** point(0,10), **dieSound** `#none`,
  **walkSpeed** 0 / **walkSpeedIncLevel** 0 → **STATIONARY** (a rooted plant).
- **#attack `#needleShot`**: `#animType #naturalRanged` (→ ranged), `#bullet #needle`,
  **`#animframe [15,17,19,21,23,25,27,29]`** (EIGHT firing frames → eight needles per attack strip),
  `#cooldown 100`, `#dexterity 1`, **`#firingType #fullstrength`** (constant-speed throw = the attacker's
  strength, not a distance-proportional lob), **`#reach 180`**, `#collisionLoc point(0,-2)` (muzzle 2px up),
  `#sound #none`.
- **Bullet `#needle`** (`act_needle.txt`): `#inherit #bullet`, `#character #bullet`, `#name "needle"`,
  attack `#type #bullet`, power 0.2, `#damageMultiplier 6`, friction point(8,8), weight 0.6,
  `#recordInRoomState false`. So the needle is a plain (non-splash) single-target bolt.
- **data #name sprite char** = `"plant"` → sprite strips key off the #name: `plant_stand` / `plant_naturalRanged`
  / `plant_grave`. The fired bullet's #name `"needle"` → `needle_fly` / `needle_land`.

Net: an immobile `#swamp` plant-turret that, when a hated unit (village/aldevar/ninja/undead/etc.) comes
within 180px, plays its naturalRanged strip and spits **8 needles per cycle** (one per #animframe), at a
constant `#fullstrength` velocity; never moves; immune to knockback (reelProof); leaves a grave on death.

## SECTION 2 — Observed port behavior (reproduced)

Spawned via `spawnEnemy("plant")` (the in-game build path routes `#objCPUCharacter` through
`spawnUnit`→`spawnEnemy`). Probe output:

- **animChar resolves to `plant`** (NOT blackOrc). `plant_stand`, `plant_naturalRanged` (40 frames; the
  animFrame list 15-29 is well within range), and `plant_grave` are all bundled. **No fallback strips.** ✓
- Data carried faithfully into `data.json` (energy 80, dexterity 3, eyestrain 40, inertia 40, reelProof,
  teamRole #teamBuildings, team #swamp, reach 180, firingType #fullstrength, animframe 8-list,
  collisionLoc (0,-2), bullet #needle). ✓
- `getTeam()=#swamp`, `getTeamRole()=#teamBuildings` (the historical hardcoded-`#teamMembers` drop seen in
  the old dwarfTower audit is **fixed** — `port/src/entities/archetypes.ts:350` now reads
  `str("teamRole","#teamMembers")`). ✓
- Targeting: allegiance `#enemy`, roles `[["#teamMembers","#teamBuildings"]]`; `getCurrentAttack()` →
  `{name:#needleShot, animType:#naturalRanged, reach:180, firingType:#fullstrength,
  animFrame:[15,17,19,21,23,25,27,29]}`. ✓
- **Acquires the village target, enters `moveToAttack`, FIRES.** First shot tick 30; the burst fired **8
  shots** at ticks 30,34,38,42,46,50,54,58 (gap 4 = the strip's 2-tick frame delay × the +2 frame stride),
  then a long cooldown gap to the next burst at tick 119 — i.e. **8 needles per attack cycle**, exactly the
  8 `#animframe` entries. ✓
- **Bullet char = `needle`** (`needle_fly` bundled) — not a flat dot / blackOrc fallback. ✓
- **Stationary:** moved **0.41px** over 250 ticks (it enters `moveToAttack` like any CPU, but `walkSpeed*0.6=0`
  caps velocity, so practically rooted). ✓
- **Damage lands:** the target's energyFrac fell 1.000 → 0.531 over 24 needles. ✓
- **Death/grave:** `loseEnergy` → `isDead=true`, anim action switches to `grave` (`plant_grave` bundled). ✓

## SECTION 3 — Divergences

**DIVERGENCES = 0.** The plant reproduces faithfully: real bundled sprite (no blackOrc fallback), correct
team/role, stationary, ranged `#fullstrength` needle attack firing 8 shots per `#animframe` strip at reach
180, single-target needle bullet, damage application, and grave-on-death.

### FAITHFUL / not divergences (documented, NOT bugs)
- **effectiveCooldown stretch (100 → 268):** `port/src/entities/archetypes.ts:216-234` back-solves an
  EFFECTIVE cooldown from the original `#cooldown 100` + the attack's counter-inc (`dexterity 1`) + the
  fire-frame offset (the animFrame fires as late as frame 29, so the strip-replay offset is large). This is
  the **systemic** enemy cadence-calibration applied to every CPU (same mechanism the dwarfTower audit
  accepted), not a plant divergence. The observed burst→long-gap→burst cadence is the intended behavior.
- **0.41px drift:** a stationary CPU still enters `moveToAttack` and paths toward its target
  (`port/src/components/control.ts:653` `updateMoveToAttack`), but `walkSpeed 0`
  (`port/src/entities/archetypes.ts:335`, `walkSpeed*0.6`) caps the velocity, so the drift is
  rounding-level. Faithful (identical to the dwarfTower finding).
- **top-level `#dexterity 3` vs attack-local `#dexterity 1`:** the build uses the actor-level dexterity (3)
  for the WeaponManager counter inc and the attack-local 1 only as the attack's own field — consistent with
  the structMaster merge order; not plant-specific.

## Conclusion
`plant` is a clean, faithful port: correct art (real `plant`/`needle` strips, no fallback), correct
allegiance (`#swamp`/`#teamBuildings`), genuinely stationary, and its eight-`#animframe` naturalRanged
needle volley + grave all reproduce. No PORT bugs found. The systemic prerequisites that broke the older
dwarfTower audit (dropped `#teamRole`, missing `targetRoles` tier fall-through, over-aggressive reach clamp)
are all resolved in the current tree and do not affect plant (its reach 180 < the 644 cap, single-tier roles).
