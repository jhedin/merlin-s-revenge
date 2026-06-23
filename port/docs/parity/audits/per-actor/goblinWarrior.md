# Actor Audit: goblinWarrior

**Method**: Derived correct behavior from `casts/data/act_goblinWarrior.txt` + full `#inherit` chain
(`#CPUCharacter → #character → #actor`; CPUCharacter base in `casts/data/act_CPUCharacter.txt`,
script `casts/script_objects/objCPUCharacter.txt`, energy default `casts/script_objects/objCharacter.txt`)
+ weapon `casts/data/act_goblinSword.txt` + AI scripts (`objAiCPU`, `objAiAttack`, `modAttack`). Then
**REPRODUCED** in the port via a throwaway harness (`tools/_audit_goblinWarrior.ts`, since deleted) that
loaded the real `src/generated/assets.json`, spawned the actor against a player target, and ran 200 ticks +
a lethal-hit death probe.

Classification: **CLEAN** ✓ — 0 divergences. (All four divergences listed in the *prior* version of this
audit — energy default, `#damageSpeed` forwarding, `#frictionReel`, and minimap `#inf` — have since been
FIXED in the port and are confirmed resolved by reproduction below.)

---

## 1. Derived Correct Behavior (Original)

### Identity / allegiance
- `#name: "goblinWarrior"` (the **data #name sprite char** — sprite strips are keyed `goblinWarrior_*`, NOT a kin alias, NOT blackOrc)
- `#team: #goblins` (category `#enemies`); `#objType: #objCPUCharacter`; `#AiType: #objAiCPU`; `#inherit: #CPUCharacter`
- Context kin: `act_friendlyGoblinWarrior` is the same unit on `#team: #village` (+ `#minimapStatus: #clr`); `act_goblinHero` (`#name: "gar"`, energy 50, a RANGED `#goblinBow` caster) is unrelated to the melee warrior.

### Stats (from data; energy inherited)
| Property | Value | Source |
|---|---|---|
| `#strength` | 4 | `act_goblinWarrior.txt` |
| `#walkSpeed` | 4 (→ 2.4 px/tick ×0.6) | `act_goblinWarrior.txt` |
| `#inertia` | 30 | `act_goblinWarrior.txt` |
| `#damageSpeed` | 3 (wall-slam bonus threshold) | `act_goblinWarrior.txt` |
| `#dexterity` | 3 (melee uses agility, so cosmetic here) | `act_goblinWarrior.txt` |
| `#eyestrain` | 30 (ranged-only — inert for melee) | `act_goblinWarrior.txt` |
| `#experienceImWorth` | 2 | `act_goblinWarrior.txt` |
| `#energy` | **100** (no explicit field → `objCharacter.txt:34` default) | inherited |
| `#frictionReel` | `point(10,10)` | `act_CPUCharacter.txt:4` (inherited) |
| `#miniMapStatus` | `#inf` (room shows infested while alive) | `act_CPUCharacter.txt:5` (inherited) |
| `#pathfinding` / `#walkType` | `true` / `#anyDirSpeed` | inherited |
| `#weaponTechnique` | none (default 0) | — |

### Animations (strips `goblinWarrior_<action>`)
| Action | Frames | Loop |
|---|---|---|
| stand | 1 | loop |
| walk | 6 | loop |
| weaponMelee (attack) | 11 | one-shot |
| grave | 2 | one-shot |
| reel | 4 | one-shot |

No `goblinWarrior_death` strip (death uses the reel→grave path).

### Weapon — `#goblinSword` (`act_goblinSword.txt`)
| Property | Value |
|---|---|
| `#animType` | `#weaponMelee` (melee contact) |
| `#animframe` | **7** (1-based) → 1 hit per swing |
| `#collisionLoc` / `#idealAttackLoc` | `point(15,0)` |
| `#power` | `point(0.7, 0)` → scalar 0.7 |
| `#damageMultiplier` | 2 |
| `#cooldown` | 0 |
| `#hits` | `[#teamMembers, #teamBuildings]` |
| `#reach` | 25 (structAttack default; melee approach actually uses collisionLoc strike point) |
| `#sound` | `"skeleton_fire"` |
| `#bullet` | `#none` (melee only) |

**Damage/hit** = power(0.7) × strength(4) × ENEMY_DAMAGE_SCALE(0.18) × mult(2) ≈ **1.008**.
**Cadence**: swing strip = 15 ticks (sum of `dela`); cooldown 0 → cadence floored at the 15-tick strip.

### AI (objAiCPU) — melee FSM
`findTarget → moveToAttack → attack → attackFin → moveToAttack`. Committed target (30-frame retarget
throttle), dazed on reel/die, `#runReload:false` (no kiting). Approaches to the collisionLoc strike point
(~15px standoff). Death (`flasherFinished`): flash white → `pDead` → `goMode(#finish)` → `drawGrave()`
(2-frame grave left at death loc). No reincarnation, no `#stretchDeath`, `#graveOn` true.

---

## 2. Observed (Port) — Reproduction Results

Harness: `CollisionGrid(80,80,32)`, real `assets.json`, inert player target at (300,200), goblinWarrior at
(360,200), 200 ticks, then a lethal `takeHit` death probe.

| Observable | Expected (derived) | Observed (port) | Match |
|---|---|---|---|
| data #name | `goblinWarrior` | `goblinWarrior` | ✓ |
| **`spriteCharOr` → anim char** | `goblinWarrior` (real strip, not blackOrc) | `goblinWarrior` (real) | ✓ |
| all 5 strips bundled | stand/walk/weaponMelee/grave/reel present | all present (1/6/11/2/4 frames, correct loop flags) | ✓ |
| `goblinWarrior_death` strip | absent | absent | ✓ |
| team | `#goblins` | `#goblins` | ✓ |
| **Energy.max** | **100** | **100** | ✓ |
| maxSpeed | 2.4 px/tick | 2.4 | ✓ |
| inertia | 30 | 30 | ✓ |
| **damageSpeed** | **3** | **3** | ✓ |
| frictionReel | 10 | 10 (→ knockFriction tuned) | ✓ |
| weapon attack animType | melee (`#weaponMelee`) | melee | ✓ |
| attack reach | 25 (struct) / ~15 melee standoff | standoff ~12px (collisionLoc-driven) | ✓ |
| **hits per swing (`#animframe` 7)** | **1** | **1** (every swing) | ✓ |
| total hits / 200 ticks | >0 | **12** | ✓ |
| gap between hits | ≥15 (strip duration) | **15** every time | ✓ |
| first hit tick | <200 (after approach) | 28 | ✓ |
| damage per hit | ~1.008 | **1.008** | ✓ |
| attack.hits filter | `[#teamMembers,#teamBuildings]` | `[#teamMembers,#teamBuildings]` | ✓ |
| experienceImWorth (getReward) | 2 | 2 | ✓ |
| approaches + faces target | yes | yes (360→311.9) | ✓ |
| death: isDead/graveOn/action | true/true/`grave` | true/true/`grave` | ✓ |
| miniMapStatus | `#inf` | resolves `#inf` (drives room infestation) | ✓ |

**Probe-API note (NOT a port divergence):** the harness sampled `attackFrame()` AFTER the post-update
energy check, so it read frame `8` at the moment of each hit; the hit actually fires on the FRESH crossing
of frame `7` (1-based) in `driveSwing`/`updateAttack` (`control.ts:378/769`). The 1-hit-per-swing + 15-tick
cadence confirm the gate is on frame 7 as derived. An initial death probe also FAILED only because the
first call used the wrong `takeHit` positional signature; the correct `(vx, vy, attackerId, mult)` call
produced a clean lethal death + grave.

---

## 3. DIVERGENCES

**None.** All previously-recorded divergences are RESOLVED in the current port:

- **DIV-1 (energy 100→40) — FIXED.** `archetypes.ts:370` now defaults `energy: num("energy", 100)`
  (comment: "objCharacter.new seeds #energy=100 (was 40)"). Reproduced: `Energy.max === 100`.
- **DIV-2 (`#damageSpeed` not forwarded, 3→5) — FIXED.** `archetypes.ts:384` now passes
  `damageSpeed: num("damageSpeed", 5)`; data's 3 flows through. Reproduced: `Movement.damageSpeed === 3`.
- **DIV-3 (`#frictionReel` ignored) — FIXED.** `movement.ts:74-76` reads `cfg["frictionReel"]` and derives
  `knockFriction = KNOCK_FRICTION × 10 / frictionReel`, consumed in the knockback decay. Forwarded at
  `archetypes.ts:386`. Reproduced: `frictionReel === 10` (CPUCharacter value).
- **DIV-4 (minimap `#inf` not per-entity) — FIXED at room scope.** `rooms.ts:147` marks the current room
  infested while `enemiesAlive()`, and `rooms.ts:170` scans unvisited rooms for actors whose data
  `#miniMapStatus === "#inf"`. goblinWarrior resolves `#inf` and spawns as `type:"enemy"`, so it drives
  infestation correctly. Reproduced: `resolveActor("goblinWarrior").miniMapStatus === "#inf"`.

---

## Summary

goblinWarrior is a faithful melee `#goblins` CPUCharacter: real `goblinWarrior_*` sprite (no blackOrc
fallback), 100 energy, walkSpeed 2.4 px/tick, inertia 30, damageSpeed 3, frictionReel 10, the `#goblinSword`
melee weapon (1 hit per swing on `#animframe` 7, ~1.008 dmg, 15-tick cadence, `[#teamMembers,#teamBuildings]`
hit filter), worth 2 XP, leaving a 2-frame grave on death. Art, AI FSM, weapon resolution, attack gating,
allegiance, movement, death/grave, and minimap status all match the original. **CLEAN.**
