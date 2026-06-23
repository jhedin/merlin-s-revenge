# Per-Actor Parity Audit: fangBunnyBaby (+ fangBunny / fangBunnyBabyBullet / fangBunnyPortal)

**Audit Date:** 2026-06-23
**Method:** Behavior derived purely from the ORIGINAL cast/data, then REPRODUCED in the port via a node
harness (`tools/_audit_fangBunnyBaby.ts`, since deleted) that loaded the REAL `src/generated/assets.json`,
spawned a `fangBunnyBaby` (#cave) with an inert `#aldevar` `archer` target (cave hates aldevar; reach 125),
wired `game.spawnEnemy/spawnUnit/spawnAlly`, configured `teamMaster.unitMap/bulletMap.configure(32,0,0)`,
pushed actors to `game.entities`, and ticked through `rebuildCombatSubstrate()` + full component update
(~220 frames; bullets ticked to move; a live-target second pass observed the hit/land; a `fangBunnyPortal`
pass observed resident production).

**Original spec:** `casts/data/act_fangBunnyBaby.txt`, `act_fangBunnyBabyBullet.txt`, `act_fangBunny.txt`,
`act_fangBunnyPortal.txt`, `act_CPUCharacter.txt`, `act_actor.txt`, `act_bullet.txt`;
`casts/script_objects/objAiCPU.txt`, `objAiAttack.txt`, `modAttack.txt`, `objBullet.txt`, `objMoveXY.txt`,
`objCPUCharacter.txt`; `casts/master_objects/animStripMaster.txt`, `tem_cave.txt`.

---

## SECTION 1 — Derived-correct behavior (from the original)

### fangBunnyBaby — `casts/data/act_fangBunnyBaby.txt`
| Property | Original value | Source |
|---|---|---|
| objType / AiType / inherit | `#objCPUCharacter` / `#objAiCPU` / `#CPUCharacter` | act_fangBunnyBaby.txt:3-5 |
| team | `#cave` (enemy; hates #aldevar + co.) | act_fangBunnyBaby.txt:28; tem_cave.txt |
| energy | 200 | act_fangBunnyBaby.txt:22 |
| strength | 8 | act_fangBunnyBaby.txt:27 |
| dexterity | 1 (ranged cooldown-recovery inc) | act_fangBunnyBaby.txt:20 |
| walkSpeed | 4 | act_fangBunnyBaby.txt:30 |
| inertia | 50 (50% knockback resistance) | act_fangBunnyBaby.txt:25 |
| damageSpeed | 3 (wall-slam bonus-damage threshold) | act_fangBunnyBaby.txt:19 |
| eyestrain | 40 (aim scatter, dist-scaled) | act_fangBunnyBaby.txt:24 |
| experienceImWorth | 60 | act_fangBunnyBaby.txt:23 |
| dieSound | `#none` | act_fangBunnyBaby.txt:21 |
| startingLevel / weaponTechnique | 0 / 0 | act_fangBunnyBaby.txt:26,31 |
| **`#name` (data record / sprite char)** | **"fangBunnyBaby"** | act_fangBunnyBaby.txt:29 |
| **attack `#catapultBullet`** | `#naturalRanged`, **`#animframe: [5,6,7]`** (3 firing frames → up to 3 shots/cycle), bullet `#fangBunnyBabyBullet`, **reach 125**, **cooldown 30**, **firingType `#fullstrength`**, collisionLoc `point(0,-5)`, sound `fangBunnyBaby_fire` vol 25, hits `[#teamMembers]` (targetRoles `[[#teamMembers,#teamBuildings]]`) | act_fangBunnyBaby.txt:6-18 |

No `#runReload` key → does NOT kite. Not `#objAiCPUSpellCaster` → does NOT dodge bullets. Plain committed-
target ranged FSM (findTarget → moveToAttack → attack → attackFin).

### fangBunnyBabyBullet — `casts/data/act_fangBunnyBabyBullet.txt`
inherit `#bullet`; `#character:#bullet`; **`#name:"fangBunnyBabyBullet"`** (sprite char); attack `#bullet`
**power 0.5 / damageMultiplier 3**; **`#friction: point(4,4)`** (4%/frame speed decay → lobbed, decelerating
projectile); `#weight 0.4`; `#rotational:false`; `#recordInRoomState:false`. No `#stallSpeed` override →
inherits objBullet's default (lands when it stalls).

### fangBunny — `casts/data/act_fangBunny.txt` (context — sibling, NOT this actor)
`#cave` **MELEE** brute (`#naturalMelee`, `#animframe:4`, `#fangStrike`, power point(0.5,1), collisionLoc
point(30,0), cooldown 0, hits `[#teamMembers,#teamBuildings]`). energy **500**, strength 10, dexterity 10,
walkSpeed 6, inertia 30, XP 75. `#name:"fangBunny"`. The baby is the smaller RANGED variant of this brute.

### fangBunnyPortal — `casts/data/act_fangBunnyPortal.txt` (context — the dwelling that spawns them)
`#objDwelling`, energy 750, XP 20, team `#cave`, totalResidents 12, frictionReel point(100,100).
residentGroups: `#fangBunny` (buildTime[20,25] groupSize[1,2] releaseInterval[10,25]) **and** `#fangBunnyBaby`
(buildTime[15,20] groupSize[1,3] releaseInterval[10,25]). `#name:"fangBunnyPortal"`.

**Derived fangBunnyBaby behavior:** a `#cave` ranged catapult-bunny. Approaches a hated target (#aldevar &
co.) to within reach 125, plays its 8-frame `naturalRanged` strip and **lobs ONE bullet on each of frames 5,
6, 7 → a 3-shot burst per attack cycle**, then waits out the 30-frame cooldown (recovery measured from the
last/gating shot frame) and re-engages. Bullets launch at `#fullstrength` speed = strength 8, then decay 4%
of speed/frame (friction point(4,4)) — a decelerating lob that lands/hits and deals power 0.5 × mult 3 on
contact. Stationary while attacking; no kiting, no bullet-dodge. Dies (energy 200) to a `fangBunnyBaby_grave`.

---

## SECTION 2 — Observed in the port (REPRODUCED)

```
SPRITE CHAR:  fangBunnyBaby -> "fangBunnyBaby"   (REAL bundled fangBunnyBaby_stand/walk/naturalRanged/grave
              strips — NOT blackOrc; blackOrc fallback? FALSE)
              strips: _stand(1f loop), _walk(4f loop), _naturalRanged(8f one-shot), _grave(2f),
                      fangBunnyBabyBullet_fly(6f loop), fangBunnyBabyBullet_land(2f)  — all present.

CONFIG:  attack {name:#catapultBullet type:ranged animType:#naturalRanged animFrame:[5,6,7] reach:125
                 cooldown:36* firingType:#fullstrength bullet:#fangBunnyBabyBullet friction(bullet):4
                 collisionLoc(0,-5) hits:[#teamMembers]}  team:#cave  type:enemy  strength:8  energy 200
         (* cooldown 36 = data 30 + 6 fire-frame offset: sum of delays of strip frames 1..6 before the
            gating frame 7. The original resets cooldown on the last shot of the burst — port matches FEEL.)

SHOT COUNT:  3 shots per attack cycle (animFrame list [5,6,7]) — bursts of 3 on consecutive frames.
             shot ticks [5,6,7, 40,41,42, 75,76,77, 110,111,112, 145,146,147]
             gaps [1,1,33, 1,1,33, 1,1,33, 1,1,33, 1,1]  -> burst-of-3 then ~33t cooldown gap. ✓

BULLET:  projChar "fangBunnyBabyBullet", friction 4. initial speed 7.68 = strength 8 × 0.96 (one frame of
         4% decay already applied at first observation) ⇒ launch speed = strength 8 (#fullstrength) ✓
         trail decays 4%/frame: 7.68→7.37→7.08→…→2.35 over 30 ticks (exponential, 1-friction/100). ✓
         HIT/LAND pass (live target @470, baby @400): bullet REACHES target, deals damage
         (target energyFrac 1 -> 0.9946 first hit, accumulating), and a bullet finishes/lands. ✓

AI:  ai modes seen {moveToAttack:220} (stationary attack folds into moveToAttack window) — committed-target
     ranged FSM, NO runReload kiting, NO bullet-dodge. anim actions {stand, naturalRanged, grave}. ✓

DEATH/GRAVE: energy 200; lethal hit -> isDead true, anim action "grave", char "fangBunnyBaby"
             (fangBunnyBaby_grave strip). ✓

fangBunnyPortal:  animChar "fangBunnyPortal" (NOT blackOrc), team #cave, type enemy; produces BOTH
                  residents: {fangBunnyBaby:4, fangBunny:2} over 700 ticks — both #cave, real strips. ✓
```

Probe-API note: the bullet entity carries no `Anim` component (projectiles render via the `<char>_fly`
projectile path, with `char` on the `Projectile` component, not `Anim`). The first probe pass printed
`char="undefined"` only because it read `Anim` off the bullet; reading `Projectile.char` showed
`"fangBunnyBabyBullet"`. This is a probe-API artifact, NOT a port divergence.

---

## SECTION 3 — Comparison

| Aspect | Derived-correct (original) | Observed (port) | Verdict |
|---|---|---|---|
| Sprite char (baby) | "fangBunnyBaby" | "fangBunnyBaby" (real strips, no blackOrc) | ✓ FAITHFUL |
| team / objType / FSM | #cave / #objCPUCharacter / #objAiCPU ranged | #cave, enemy, ranged committed-target FSM | ✓ FAITHFUL |
| energy / strength / walkSpeed / inertia | 200 / 8 / 4 / 50 | 200 / 8 / 4 / 50 | ✓ FAITHFUL |
| ranged reach | 125 | 125 | ✓ FAITHFUL |
| **shots per attack (#animframe [5,6,7])** | **3 per cycle** | **3-shot burst per cycle** | ✓ FAITHFUL |
| firingType #fullstrength bullet speed | = strength 8 | launch speed 8 (7.68 after 1 frame decay) | ✓ FAITHFUL |
| bullet char | "fangBunnyBabyBullet" | "fangBunnyBabyBullet" (Projectile.char) | ✓ FAITHFUL |
| bullet #friction point(4,4) → decel | 4%/frame exponential decay | friction 4, trail decays 4%/frame | ✓ FAITHFUL |
| bullet reaches target / lands / hits | decelerating lob, lands & hits | reaches, damages, lands | ✓ FAITHFUL |
| bullet attack (power/mult) | 0.5 / 3 | power 0.5, mult 3 carried into hit | ✓ FAITHFUL |
| cooldown cadence | 30 (reset on gating shot frame 7) | 36 effective = 30 + 6 fire-frame offset | ✓ FAITHFUL (calibration) |
| runReload (kite) | not set → no kiting | no runReload, stationary attack | ✓ FAITHFUL |
| dodgeBullets | not a spellCaster → no | no | ✓ FAITHFUL |
| death / grave | energy 200 / fangBunnyBaby_grave | grave, char "fangBunnyBaby" | ✓ FAITHFUL |
| eyestrain aim scatter | 40 (dist-scaled) | aim-scatter applied (vy wobble ±2 across burst) | ✓ FAITHFUL |
| fangBunnyPortal residents | #fangBunny + #fangBunnyBaby | produces both, #cave | ✓ FAITHFUL |
| **damageSpeed (wall-slam threshold)** | **3** (act_fangBunnyBaby.txt:19) | **5** (default; not forwarded by spawnEnemy) | ✗ DIVERGENCE |

### DIVERGENCES: 1

---

### DIV-1 — `#damageSpeed` not forwarded → wall-slam bonus-damage threshold wrong (5 vs 3)

```
ORIGINAL                                          PORT
└─ act_fangBunnyBaby.txt:19  #damageSpeed: 3      └─ entities/archetypes.ts  spawnEnemy build call
   └─ modEnergy.takeDamage (modEnergy.txt):          omits `damageSpeed` → Movement.init defaults it
      if amount > pDamageSpeed(=3):                   └─ components/movement.ts  cfg["damageSpeed"] ?? 5
         loseEnergy(amount - 3)                        └─ baby's wall-slam threshold = 5, deduction -5
```

**FAITHFUL-quirk vs PORT-BUG → PORT-BUG.** `#damageSpeed: 3` is the knockback-speed threshold above which a
wall/vertical slam deals bonus energy loss (`amount - damageSpeed`). The port's `spawnEnemy` does not pass
`damageSpeed` into the `build()` cfg, so `Movement.init` falls back to its default **5**. Effect: the baby is
slightly MORE wall-slam-resistant than the original (threshold 5 vs 3) and, when a slam does exceed both
thresholds, the port deducts 5 instead of 3. This is the SAME class of bug already filed for `archer`
(DIV-1 there): a shared `spawnEnemy` omission, not actor-specific. Low severity (wall-slam is infrequent; a
few units of energy per slam), but a real, faithful-to-data divergence.

**Fix:** in `port/src/entities/archetypes.ts`, add `damageSpeed: num(d, "damageSpeed", 5),` to the
`spawnEnemy` `e.build({...})` cfg (`Movement.init` already reads `cfg["damageSpeed"]`). Fixes every enemy
with a non-default `#damageSpeed`, including this one.

---

### Candidate ORIGINAL-GAME quirks (faithful — do NOT "fix")
- **3-shot burst per attack** (`#animframe: [5,6,7]`) — the catapult-bunny throws three bullets across
  consecutive strip frames each cycle, not one. Faithful (the port fires once per fresh #animframe crossing,
  reproducing all three). This is the load-bearing per-actor detail and it reproduces exactly.
- **Bullet `#name:"fangBunnyBabyBullet"`** (the bullet actor's `#name`, not its record key/`#character:#bullet`)
  is what supplies the projectile sprite char → `fangBunnyBabyBullet_fly`. Faithful.
- **cooldown 30 → effective 36** — the port's fire-frame offset (sum of pre-gating-frame delays, here +6)
  reproduces the original resetting the cooldown on the LAST shot of the burst (objAiAttack), not on attack
  entry. Faithful calibration, not a bug (same mechanism as the bat audit's 80→85).
- **Stale code comment** at `archetypes.ts:121` ("#fangBunnyBaby ... have no act_ record") is FALSE —
  `act_fangBunnyBaby` exists and the portal produces it correctly. Cosmetic comment staleness only; the
  `residentGroups` filter uses `registry.resolveActor` and works. Not a divergence.

### Harness notes (NOT port divergences)
- `spawnEnemy`/`spawnAlly` build the entity but do NOT push to `game.entities` (main/RoomManager does) — the
  harness pushes manually. `spawnUnit/spawnEnemy/spawnAlly` and `teamMaster.unitMap/bulletMap.configure`
  must be wired or targeting/broad-phase returns nothing.
- Reading the bullet's sprite char off `Anim` returns `undefined` (bullets have no `Anim`); the real char
  lives on `Projectile.char` ("fangBunnyBabyBullet"). A probe-API artifact, not a divergence.

---

fangBunnyBaby | DIVERGENCES=1
DIV-1 `#damageSpeed` not forwarded by spawnEnemy → wall-slam threshold 5 instead of 3 (PORT-BUG, low; shared archer DIV-1)

---
## CORRECTION (post-audit): DIV-1 is a PROBE ARTIFACT — actor is CLEAN
`#damageSpeed` IS forwarded by `spawnEnemy` (`archetypes.ts` `damageSpeed: num("damageSpeed", 5)`).
Runtime check confirms `Movement.damageSpeed = 3` for fangBunnyBaby (matching the data). The agent's
"not forwarded" reading was a probe artifact (same false positive as the skeletonArcher audit).
**fangBunnyBaby | DIVERGENCES=0** — faithful: own sprite, 3-shot [5,6,7] burst, friction lob that reaches
+ hits, grave; damageSpeed correctly 3.
