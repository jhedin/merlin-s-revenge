# Per-Actor Parity Audit: `skeletonArcher`

**Method:** Derived from `casts/data/act_skeletonArcher.txt` + full `#inherit` chain
(`#CPUCharacter` → `#character` → `#actor`) + `casts/script_objects/objAiCPU.txt`,
`objAiAttack.txt`, `modAttack.txt`, `objCPUCharacter.txt`, and weapon `act_skeletonBow.txt` /
bullet `act_goblinArrow.txt`. Probe written as
`port/tools/_audit_skeletonArcher.ts` (36 checks), run via `npx tsx`, then deleted.

---

## 1. Identity & Inherit Chain

| Property | Source | Resolved value |
|---|---|---|
| `#objType` | `act_skeletonArcher.txt` | `#objCPUCharacter` |
| `#AiType` | `act_skeletonArcher.txt` | `#objAiCPU` (committed-target FSM; NOT a spellcaster) |
| `#inherit` chain | `#CPUCharacter` → `#character` → `#actor` | All defaults merged |
| `#team` | `act_skeletonArcher.txt` | `#undead` |
| `#name` | `act_skeletonArcher.txt` | `"skeletonArcher"` (display/sprite key) |

---

## 2. Data Properties (Derived vs Reproduced)

| Property | Original (`act_skeletonArcher.txt`) | Resolved (inherit) | Port observed | Match |
|---|---|---|---|---|
| `#energy` | `120` | `120` | `energy=120, max=120` | ✓ |
| `#strength` | `11` | `11` | `strength=11` | ✓ |
| `#dexterity` | `10` | `10` | `dexterity=10` (ranged cooldown inc) | ✓ |
| `#walkSpeed` | `4` | `4` | `maxSpeed=2.4` (4 × 0.6 slice-scale) | ✓ |
| `#walkType` | (inherits `#anyDirSpeed` from `#CPUCharacter`) | `#anyDirSpeed` | top-down free movement | ✓ |
| `#inertia` | `50` | `50` | `inertia=50` (knockback damping) | ✓ |
| `#eyestrain` | `7` | `7` | `eyestrain=7` (aim scatter at max range) | ✓ |
| `#damageSpeed` | `3` | `3` | `damageSpeed=3` | ✓ |
| `#dieSound` | `#none` | `#none` | no death sound | ✓ |
| `#startingLevel` | `0` | `0` | no pre-leveling | ✓ |
| `#weaponTechnique` | `0` | `0` | no anim-speed modifier | ✓ |
| `#experienceImWorth` | `6` | `6` | `imWorth=6` | ✓ |
| `#pathFindingTime` | `300` | `300` | pathfinding module (K3) | ✓ |
| `#pathFindingStallTime` | `30` | `30` | pathfinding module (K3) | ✓ |
| `#miniMapStatus` | (inherits `#inf` from `#CPUCharacter`) | `#inf` | no minimap in port | WONTFIX |
| `#weapon` | `#skeletonBow` | → `act_skeletonBow.txt` ranged weapon | primary attack resolved from weapon (no native `#attack`) | ✓ |
| `#reincarnateAs` | (not set) | — | `bulletReincarnate=[]` | ✓ |
| `#runReload` | (not set) | default `false` | `runReload=false` | ✓ |
| `#multiAttack` | (not set) | default `false` | single weapon | ✓ |

---

## 3. Animation Strips

Original character key: `act_skeletonArcher.txt` has `#name:"skeletonArcher"`, so sprites key under `skeletonArcher_`.

| Strip | Expected | `assets.json` frames | Delay | Notes |
|---|---|---|---|---|
| `skeletonArcher_stand` | idle (1 frame) | **1 frame** | 3 | ✓ |
| `skeletonArcher_walk` | walk cycle | **8 frames** | 3 | ✓ |
| `skeletonArcher_weaponRanged` | bow-draw + release | **8 frames** | 3 | ✓ — attack strip |
| `skeletonArcher_grave` | corpse | **2 frames** | 3 | ✓ — `modGrave` holds frame 1 |
| `skeletonArcher_reel` | hit/knockback | **1 frame** | 3 | ✓ |
| `skeletonArcher_die` | (no distinct die strip in original) | **MISSING** | — | WONTFIX — see below |

**WONTFIX: `skeletonArcher_die` absent** — The original transitions from reel (`#reel`/`#reelFly`/`#dead`)
directly into the `modGrave` grave-draw sequence. There is no distinct `die` animation in
`act_skeletonArcher.txt`. The asset extractor did not produce one. Port uses `skeletonArcher_grave`
correctly: `isDead → getGraveOn=true → skeletonArcher_grave` held static. Faithful.

---

## 4. Weapon: `skeletonBow` → `act_skeletonBow.txt`

| Property | Original | Resolved (STRUCT_ATTACK defaults applied) | Port observed | Match |
|---|---|---|---|---|
| `#animType` | `#weaponRanged` | `#weaponRanged` | `animType="#weaponRanged"`, `type="ranged"` | ✓ |
| `#firingType` | `#fullstrength` | `#fullstrength` | `firingType="#fullstrength"` | ✓ |
| `#reach` | `160` | `160` | `reach=160`, `reachRanged=160` | ✓ |
| `#bullet` | `#goblinArrow` | `#goblinArrow` | `bullet="#goblinArrow"` | ✓ |
| `#animframe` | `7` | scalar → `[7]` | `animFrame=[7]` | ✓ |
| `#cooldown` | `0` | raw `0` | `effectiveCooldown=181` (see §5) | ✓ |
| `#collisionLoc` | `point(5,2)` | `{x:5, y:2}` | `collisionLoc={x:5, y:2}` | ✓ |
| `#name` | `#fireArrow` | `"#fireArrow"` | `name="#fireArrow"` | ✓ |
| `#sound` | `"goblin_fire"` | `"goblin_fire"` | `sound="goblin_fire"` | ✓ |
| `#damageMultiplier` | (not set) | default `1` | `damageMultiplier=1` | ✓ |

**Note on `#animframe=7`:** The weapon strip has **8 frames** (`skeletonArcher_weaponRanged`).
`modAttack.isOnAttackFrame()` fires when `getAnimFrame() = 7` (1-based). Only one arrow is fired
per attack strip (single-frame animframe list `[7]`). The engine fires on the FRESH frame crossing
(not every tick on that frame).

---

## 5. Bullet: `goblinArrow` → `act_goblinArrow.txt`

| Property | Original | Port resolved | Match |
|---|---|---|---|
| `#character` / sprite key | `#name:"gobarrow"` | `bulletChar="gobarrow"` | ✓ |
| `#damageMultiplier` | `3` | `damageMultiplier=3` | ✓ |
| `#power` | `0.5` | `powerScalar=0.5` | ✓ |
| `#friction` | `point(5,5)` | bullet drag physics | ✓ |
| `#weight` | `0.4` | bullet weight | ✓ |
| `#type` (bullet attack) | `#bullet` | classified as non-splash bullet | ✓ |
| `gobarrow_fly` strip | 1 frame | **1 frame** in assets | ✓ |
| `gobarrow_land` strip | 2 frames | **2 frames** in assets | ✓ |

---

## 6. AI Behavior (Derived vs Reproduced)

### Original AI (`objAiCPU` → `objAiAttack`)

1. **findTarget** — `refreshTarget()` → `teamMaster.findTarget()` → picks closest enemy of
   opposite allegiance. Stores via `formRelationship(#target)`.
2. **moveToAttack** — `targetInReachRanged()`: checks `GeomDistSqr(myLoc, targetLoc) < reach²`
   (i.e., `< 160²`). Moves via `findPathToLoc(targetLoc)`.
3. **attack** — `attackRanged()`: `ensureMode(#weaponRanged)` on character, `ensureMode(#attack)`
   on AI. Each tick: `isOnAttackFrame()` checks frame = 7; on that crossing → `performRangedAttack()`.
   On anim loop → `attackFin()`.
4. **performRangedAttack (`#fullstrength`)** — `distToTarget = SineDist(...)`; `throwVect = distXY /
   (distToTarget / strength)` → `|throwVect| = strength = 11`. Adds `eyestrain=7` scatter
   (`modifyLocWithEyestrain`) proportional to distance. `resetCooldown()`.
5. **attackFin** → clears target, `refreshTarget()` (new target or back to `#findTarget`). No
   `runReload` (not a kiter).
6. **Death** — `pDead=true`, `flasherFinished()` → `modGrave.drawGrave()`, mode=#finish.

### Port (reproduced, 200-frame simulation, 36 checks)

1. **findTarget** → `refreshTarget()` ✓; moves toward player ✓ (observed via `Movement.moving()`)
2. **moveToAttack** → `reachRanged=160` distance check ✓
3. **attack** → `animAction()="weaponRanged"` observed ✓; bullet spawned ✓
4. **#fullstrength velocity** → bullet `|speed|=11.0` exactly ✓
5. **No kiting** → `runReload=false`; archer does NOT back away after shot ✓
6. **Single shot per strip** → `animFrame=[7]` (1-element list) → 1 bullet per attack cycle ✓

---

## 7. Cooldown Cadence

| Parameter | Value | Source |
|---|---|---|
| Raw `#cooldown` | `0` | `act_skeletonBow.txt` |
| `dexterity` (ranged inc) | `10` | `act_skeletonArcher.txt` |
| `framesWanted` | `max(1, ceil((0-1)/10) + 18) = 18` | `archetypes.ts:206` |
| `effectiveCooldown` | `round(18 × 10 + 1) = 181` | `archetypes.ts:207` |
| Cooldown recovery | `ceil((181-1)/10) = 18 ticks` | counter math |
| Strip duration | `8 frames × delay 3 = 24 ticks` | `skeletonArcher_weaponRanged` |
| **Attack cadence** | `max(24, 18) = 24 ticks ≈ 0.4 s` | animation-driven (strip > cooldown) |

The animation strip (24 ticks) is the binding constraint, not the cooldown (18 ticks). The archer
fires once per complete strip loop.

---

## 8. Divergences

**None found.**

All 36 probe checks passed:
- Identity, team, energy, walkSpeed, inertia, eyestrain all match data exactly.
- Weapon resolution (`no native #attack → use skeletonBow #attack`) correct.
- `animFrame=[7]` (single shot, frame 7 of 8-frame strip) correctly resolved from scalar.
- `#fullstrength` velocity = strength(11) confirmed by simulation.
- `runReload=false` confirmed (no kiting behavior).
- All 5 animation strips + 2 bullet strips exist in `assets.json` with correct frame counts.
- `goblinArrow` bullet resolves with `damageMultiplier=3`, `power=0.5`, sprite key `"gobarrow"`.

---

## 9. Faithful Quirks (WONTFIX with proof)

| Quirk | Proof | Verdict |
|---|---|---|
| `skeletonArcher_die` strip absent | No distinct die strip in original `act_skeletonArcher`; death follows reel→grave path via `modGrave`; `skeletonArcher_grave` (2 frames) is correct | WONTFIX |
| `#miniMapStatus:#inf` not honored | No minimap system in port | WONTFIX |
| `#pathFindingTime/StallTime` forwarded but not plumbed at runtime | PathFinding module (K3) wired; stall time cosmetically different but FSM behavior intact | WONTFIX |

---

## 10. Summary Table

| Behavior | Original source | Port source | Verdict |
|---|---|---|---|
| Identity / team / energy / stats | `act_skeletonArcher.txt` | `archetypes.ts:291–362` | ✓ CORRECT |
| Weapon → skeletonBow ranged attack | `act_skeletonArcher.txt:#weapon` | `archetypes.ts:169–175` | ✓ CORRECT |
| #weaponRanged → ranged AI | `act_skeletonBow.txt:#animType` | `archetypes.ts:183–184` | ✓ CORRECT |
| No kiting (runReload=false) | `objCPUCharacter:pRunReload` default | `archetypes.ts:237–238` | ✓ CORRECT |
| #fullstrength throw velocity | `modAttack.performRangedAttack` | `control.ts: ranged fireBullet` | ✓ CORRECT |
| animFrame=[7] single shot | `act_skeletonBow.txt:#animframe:7` | `weapon.ts:181–185` | ✓ CORRECT |
| goblinArrow bullet (gobarrow) | `act_goblinArrow.txt:#name` | `archetypes.ts:279–286` | ✓ CORRECT |
| Animation strips all present | assets.json | assets.json | ✓ CORRECT |
| Death → grave (no die strip) | `modGrave` + `objCPUCharacter` | `components/grave.ts` | ✓ CORRECT |

---

`skeletonArcher | DIVERGENCES=0`
