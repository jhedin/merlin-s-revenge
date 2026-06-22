# Audit: goblinWarrior

**Method**: derived correct behavior from `casts/data/act_goblinWarrior.txt` + full `#inherit` chain
(`#CPUCharacter → #character → #actor`) + weapon (`act_goblinSword.txt`) + AI scripts
(`objCPUCharacter.txt`, `objAiCPU.txt`, `objAiAttack.txt`, `modAttack.txt`), then reproduced in the
port by spawning the actor and running 200+ tick observations.

---

## 1. Derived Correct Behavior (Original)

### Identity
- Name: `goblinWarrior`; team: `#goblins` (category `#enemies`); friends: `#orcs`; hates: `[#aldevar, #monsterSummon, #karate, #magicalAlliance, #ninja, #undead, #scarlet, #village]`
- `#objType: #objCPUCharacter`, `#AiType: #objAiCPU`

### Animations (all strips must exist as `goblinWarrior_<action>`)
| Action | Key | Notes |
|---|---|---|
| stand | `goblinWarrior_stand` | 1 frame, loop, delay 2 |
| walk | `goblinWarrior_walk` | 6 frames, loop, delay 3 |
| attack (melee) | `goblinWarrior_weaponMelee` | 11 frames, one-shot, delays 1/1/1/1/1/3/1/3/1/1/1 = 15 ticks total |
| grave | `goblinWarrior_grave` | 2 frames, one-shot, delay 1 |
| reel | `goblinWarrior_reel` | 4 frames, one-shot, delay 2 |

All five strips are present in `assets.json`. There is no `goblinWarrior_death` strip (not needed — death uses the reel/grave path, not a separate death animation).

### Movement
- `#walkSpeed: 4` (engine units) → `2.4 px/tick` after ×0.6 conversion
- `#inertia: 30` (resists knockback: `(100-30)/100 = 70%` of hit vector passes through)
- `#damageSpeed: 3` (wall-slam bonus damage threshold; see DIVERGENCES)
- Inherited `#frictionReel: point(10,10)` from CPUCharacter (enhanced friction during reel; see DIVERGENCES)
- Inherited `#pathfinding: true` → scenic pathfinding active
- Inherited `#walkType: #anyDirSpeed` (8-directional movement)

### AI (objAiCPU)
- FSM: `findTarget → moveToAttack → [attack] → attackFin → moveToAttack` loop
- 30-frame retarget throttle (committed-target, no per-tick twitch-retarget)
- Dazed (zero intent) on `#reel/#die/#finish`; resumes `findTarget` when cleared
- `#runReload: false` → does NOT kite after attacking (stays in `moveToAttack`)
- Melee approach: paths to `targetLoc + idealAttackLoc×(−dirToTarget)` = ~15px offset from target center
- `targetInReachMelee`: `strikePoint(loc + point(±15,0))` inside `target.collisionRect`; effective range ~15 + targetBox ≈ 27px (with a 12px-box target)

### Attack — goblinSword (#weaponMelee)
| Property | Value | Source |
|---|---|---|
| animType | `#weaponMelee` | `act_goblinSword.txt:8` |
| type | melee | derived from animType |
| animframe | 7 (1-based) | `act_goblinSword.txt:7` (1 hit per attack) |
| collisionLoc | `point(15,0)` | `act_goblinSword.txt:9` |
| idealAttackLoc | `point(15,0)` | `act_goblinSword.txt:15` |
| reach | 25 (structAttack default) | no explicit `#reach` in goblinSword |
| power | `point(0.7, 0)` → scalar 0.7 | `act_goblinSword.txt:15` |
| damageMultiplier | 2 | `act_goblinSword.txt:11` |
| hits | `[#teamMembers, #teamBuildings]` | `act_goblinSword.txt:12` |
| cooldown | 0 (no explicit cooldown → `#cooldown: 0`) | `act_goblinSword.txt:10` |
| sound | `"skeleton_fire"` | `act_goblinSword.txt:16` |
| bullet | none (melee only) | — |

**Attack strip duration**: 15 ticks total (sum of `dela` values). Each attack cycle takes at least 15 ticks.

**Damage formula**: `power(0.7) × strength(4) × ENEMY_DAMAGE_SCALE(0.18) × damageMultiplier(2) = 1.008` per hit.

### Energy
- No explicit `#energy` in data. Original default (`objCharacter.txt:34`): `i[#energy] = 100`
- Port default (`archetypes.ts:295`): `energy: 40` (see DIVERGENCES)

### Death & Grave
- `objCPUCharacter.flasherFinished()`: flashes white, `pDead = true`, `goMode(#finish)`, `drawGrave()`
- Grave strip (`goblinWarrior_grave`, 2 frames) left at death location, facing right (`setFlipFromDir(1)`)
- No reincarnation; no `#stretchDeath`

### Misc
- `#experienceImWorth: 2` (XP awarded to killer)
- `#eyestrain: 30` (melee only — irrelevant, eyestrain only affects ranged fire)
- `#dexterity: 3` (irrelevant for melee — cooldown counter uses `agility`)

---

## 2. Observed (Port) — Reproduction Results

Setup: `CollisionGrid(40,40,32)`, real `assets.json` bundle, player at `(300,200)`, goblinWarrior at `(360,200)`, 200 ticks.

| Observable | Expected | Observed | Match? |
|---|---|---|---|
| `spriteCharOr("goblinWarrior")` | `goblinWarrior` | `goblinWarrior` | ✓ |
| `goblinWarrior_stand` strip | present | present (1 frame, loop) | ✓ |
| `goblinWarrior_walk` strip | present | present (6 frames, loop) | ✓ |
| `goblinWarrior_weaponMelee` strip | present | present (11 frames, one-shot) | ✓ |
| `goblinWarrior_grave` strip | present | present (2 frames, one-shot) | ✓ |
| `goblinWarrior_reel` strip | present | present (4 frames, one-shot) | ✓ |
| `goblinWarrior_death` strip | absent | absent (uses reel/grave path) | ✓ |
| First attack tick | < 200 | tick 25 (approaches + attacks) | ✓ |
| Hits per attack cycle | 1 (animframe 7) | 1 (confirmed) | ✓ |
| Total hits in 200 ticks | > 0 | 12 | ✓ |
| Damage per hit | ~1.008 | ~1.008 | ✓ |
| Attack anim action | `"weaponMelee"` | `"weaponMelee"` | ✓ |
| AI mode after attack | `moveToAttack` | `moveToAttack` | ✓ |
| Warrior moves toward player | true | true | ✓ |
| Facing changes toward player | true | true | ✓ |
| `EnemyAI.ranged` | false | false | ✓ |
| `EnemyAI.runReload` | false | false | ✓ |
| `EnemyAI.reach` | ~25 (structAttack) | 25 | ✓ |
| `graveOn` before/after death | true/true | true/true | ✓ |
| `experienceImWorth` | 2 | 2 | ✓ |
| `walkSpeed` (maxSpeed) | 2.4 px/tick | 2.4 px/tick | ✓ |
| `inertia` | 30 | 30 | ✓ |
| `agility` | 1 (default) | 1 | ✓ |
| `dexterity` | 3 | 3 | ✓ |
| Effective cooldown (attack.cooldown) | ~7 ticks | 7 | ✓ |
| Minimum gap between hits | ≥ 15 ticks (strip duration) | 15 ticks | ✓ |
| `attack.hits` | `[#teamMembers, #teamBuildings]` | `[#teamMembers, #teamBuildings]` | ✓ |
| `attack.animFrame` | `[7]` | `[7]` | ✓ |
| `energy` | 100 (objCharacter default) | 40 (port default) | **DIVERGENCE** |
| `damageSpeed` | 3 | 5 (port default) | **DIVERGENCE** |

---

## 3. DIVERGENCES

### DIV-1: Default energy 100 → 40

**Original** (`casts/script_objects/objCharacter.txt:34`): `i[#energy] = 100` — all CPUCharacters without explicit `#energy` start with 100 HP.

`act_goblinWarrior.txt` has no explicit `#energy` field; its full `#inherit` chain (`#CPUCharacter → #character → #actor`) also carries none. So the original goblinWarrior has **100 energy**.

**Port** (`port/src/entities/archetypes.ts:295`): `energy: num("energy", 40)` — the default for enemies without explicit energy is 40.

**Observed**: `warrior.get(Energy).max === 40`, not 100.

**Impact**: The warrior dies in ≈40 damage instead of 100, making it significantly easier to kill. This affects room difficulty calibration.

**Fix sketch**: In `spawnEnemy` change the fallback from `40` to `100` — matching `objCharacter.txt:34`. Alternatively, add an `energy` field to `act_goblinWarrior`'s data (but the faithful fix is correcting the fallback since many no-energy actors share this path).

**Files**: `port/src/entities/archetypes.ts:295`, `casts/script_objects/objCharacter.txt:34`

---

### DIV-2: `#damageSpeed` not forwarded — wall-slam threshold wrong (3 → 5)

**Original** (`casts/data/act_goblinWarrior.txt:6`, `casts/script_objects/objCPUCharacter.txt` wall handlers): `#damageSpeed: 3`. `collisionWall`/`collisionVertical` apply bonus damage of `(|impact| − damageSpeed)` when the unit is reeling into a wall. goblinWarrior's threshold is 3, so any wall-slam with impact > 3 inflicts bonus damage.

**Port** (`port/src/components/movement.ts:47, 67`): `damageSpeed = 5` (hardcoded default). `spawnEnemy` never passes `damageSpeed` in the `e.build({...})` call (`port/src/entities/archetypes.ts:284-347`), so `cfg["damageSpeed"]` is `undefined` and the default 5 is used.

**Observed**: `warrior.get(Movement).damageSpeed === 5`. The warrior needs a harder wall-slam to take bonus damage than it should (threshold 5 > 3).

**Impact**: The goblinWarrior takes less damage from wall-slams than intended. It is also more survivable when reeling near walls.

**Fix sketch**: In `spawnEnemy`, add `damageSpeed: num("damageSpeed", 5)` to the `e.build({...})` call. (The `num()` helper reads from the resolved actor data; `act_goblinWarrior.txt:6` sets it to 3, so the correct value 3 would flow through. The default 5 remains for actors without an explicit `#damageSpeed`.)

**Files**: `port/src/entities/archetypes.ts` (add to build call), `port/src/components/movement.ts:67` (already wired to read from cfg), `casts/data/act_goblinWarrior.txt:6`

---

### DIV-3 (Minor): `#frictionReel` not implemented — reel deceleration too slow

**Original** (`casts/data/act_CPUCharacter.txt:4`): `#frictionReel: point(10,10)`. In `objCPUCharacter.goMode(#reel)`, `frictionXOn(10)` and `frictionYOn(10)` are called — these swap in a stronger friction factor (10× vs the normal factor) while the unit reels, so it decelerates faster during knockback.

**Port**: There is no `frictionReel` concept. The `Movement` component uses a fixed `friction = 0.6` per-tick regardless of whether the unit is reeling. The generated `data.json` records `frictionReel: {x:10, y:10}` but no code consumes it.

**Observed**: During reel, the warrior's knockback decays at the standard friction rate, not the enhanced rate.

**Impact**: A knocked-back goblinWarrior slides slightly farther than intended before stopping. This is a secondary physics effect.

**Fix sketch**: Add a `reelFriction` field to `Movement.init`, read from `cfg["frictionReel"]`; when `isHurt` (reel state), apply `reelFriction` instead of the normal friction multiplier in the velocity decay step. Pass it through `spawnEnemy` for all CPUCharacters.

**Files**: `port/src/components/movement.ts`, `port/src/entities/archetypes.ts`

---

### DIV-4 (Cosmetic): `#miniMapStatus: #inf` not forwarded per-entity

**Original**: `act_CPUCharacter` inherits `#miniMapStatus: #inf`. When any goblinWarrior is alive in a room, the room's minimap status is `#inf` (infested). This is updated per-entity in the original's `modMiniMap`.

**Port**: The minimap system exists (`port/src/render/minimap.ts`) but the per-entity `miniMapStatus` flag is not read from actor data or forwarded through `spawnEnemy`. The room-infested status is not driven per-goblinWarrior presence.

**Impact**: Cosmetic only (minimap room status). Core combat behavior is unaffected.

---

## Summary Table

| # | Property | Original | Port | Severity |
|---|---|---|---|---|
| DIV-1 | Default energy | 100 (`objCharacter.txt:34`) | 40 (`archetypes.ts:295`) | **High** — warrior dies at 40% of intended HP |
| DIV-2 | `#damageSpeed` | 3 (`act_goblinWarrior.txt:6`) | 5 (hardcoded default) | Medium — wall-slam damage under-fires |
| DIV-3 | `#frictionReel` | enhanced during reel | ignored (fixed friction) | Low — minor slide distance |
| DIV-4 | `#miniMapStatus:#inf` | per-entity room status | not forwarded | Cosmetic |

All art strips, AI FSM, weapon resolution, attack animframe (7 → 1 hit per attack), team/allegiance, hits filter (`[#teamMembers, #teamBuildings]`), walkSpeed, inertia, pathfinding, death/grave, and experience are correct.
