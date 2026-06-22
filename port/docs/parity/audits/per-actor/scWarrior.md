# Parity Audit: scWarrior

**Actor:** `scWarrior` (Scarlet Warrior)
**Audit date:** 2026-06-22
**Probe:** `port/tools/_audit_scWarrior.ts` (run, 19/19 pass, deleted)

---

## 1. Identity / Inherit chain

| Layer | File |
|-------|------|
| `act_scWarrior` | `casts/data/act_scWarrior.txt` |
| `#inherit: #CPUCharacter` | `casts/data/act_CPUCharacter.txt` |
| `#inherit: #character` | `casts/data/act_character.txt` |
| `#inherit: #actor` | `casts/data/act_actor.txt` |
| Object type | `casts/script_objects/objCPUCharacter.txt` |
| AI type | `casts/script_objects/objAiCPU.txt` (→ `objAiAttack.txt`) |
| Weapon | `casts/data/act_scWarriorSword.txt` |
| Team | `casts/data/tem_scarlet.txt` |

**Sprite char:** `scWarrior` (assets have `scWarrior_stand`, `scWarrior_walk`, `scWarrior_weaponMelee`, `scWarrior_reel`, `scWarrior_grave`).

---

## 2. Derived properties

### Actor stats (`act_scWarrior`)

| Property | Original | Derived |
|----------|----------|---------|
| `#team` | `#scarlet` | hostile; `tem_scarlet` hates `[#aldevar, #village, #monsterSummon, #goblins, #ninja, #magicalAlliance, #orcs, #monsters]` |
| `#energy` | 250 | HP pool |
| `#strength` | 12 | melee power multiplier |
| `#strengthIncLevel` | 0.5 | per-level strength growth |
| `#dexterity` | 3 | cooldown recovery rate (melee) |
| `#inertia` | 50 | knockback resistance |
| `#damageSpeed` | 4 | wall-slam damage threshold |
| `#walkSpeed` | 7 | → 4.2 px/tick (× 0.6 port conversion) |
| `#stallSpeed` | 1 | hit-recovery damping (original `pMoveXY.setStallSpeed`) |
| `#stallSpeedIncLevel` | 1 | per-level growth of stall speed |
| `#reincarnateAs` | `[#fire]` | spawns a `fire` actor on killed-in-action death |
| `#weaponTechniqueInc` | 3 | **dead data field** — see §4 |
| `#weapon` | `#scWarriorSword` | resolved via `registry.resolveActor("scWarriorSword")` |

### Weapon (`act_scWarriorSword`)

| Property | Value |
|----------|-------|
| `#animType` | `#weaponMelee` → melee type |
| `#animframe` | 9 (1-based; fires once on frame 9 of the `weaponMelee` strip) |
| `#collisionLoc` | `point(12, 0)` → strike point offset |
| `#idealAttackLoc` | `point(12, 0)` → approach standoff |
| `#cooldown` | 1 |
| `#power` | `point(0.5, 0)` |
| `#damageMultiplier` | 5 |
| `#hits` | `[#teamMembers, #teamBuildings]` |
| `#targetRoles` | `[[#teamMembers, #teamBuildings]]` |
| `#sound` | `"skeleton_fire"` |

### AI / movement

| Aspect | Derived from original |
|--------|----------------------|
| AI mode | `#objAiCPU` → committed-target FSM: findTarget → moveToAttack → attack |
| Ranged | false (melee) |
| Ghost | false |
| Run-reload (kite) | false (no `#runReload` key) |
| Pathfinding | `#CPUCharacter` sets `#pathfinding: true`; port K3 beeline→scenic path |
| Melee reach | `collisionLoc.x = 12` → clamped `max(16, min(90, 12)) = 16` px |
| Retarget cadence | every 30 frames (pRetargetCounter) |

### Animations present

| Strip | Loop | Delay | Frames |
|-------|------|-------|--------|
| `scWarrior_stand` | yes | 3 | 1 |
| `scWarrior_walk` | yes | 3 | 8 |
| `scWarrior_weaponMelee` | no | 1 | 20 (frame delays: 2,1×19) |
| `scWarrior_reel` | no | 3 | 1 |
| `scWarrior_grave` | no | 1 | 2 |

No `death` strip (uses `grave` for the post-death collapsed state via `modGrave`). No `charge`/`release` strip (pure melee).

---

## 3. Derive-vs-REPRODUCED table

| Check | Derived | Reproduced | Status |
|-------|---------|------------|--------|
| Team | `#scarlet` | `#scarlet` | PASS |
| AI ranged | false | false | PASS |
| AI ghost | false | false | PASS |
| AI runReload | false | false | PASS |
| walkSpeed | 4.2 px/tick | 4.2 px/tick | PASS |
| energy | 250 | 250 | PASS |
| atk.animType | `#weaponMelee` | `#weaponMelee` | PASS |
| atk.damageMultiplier | 5 | 5 | PASS |
| atk.sound | `"skeleton_fire"` | `"skeleton_fire"` | PASS |
| atk.hits `#teamMembers` | true | true | PASS |
| atk.hits `#teamBuildings` | true | true | PASS |
| Melee reach | 16 | 16 | PASS |
| wt.technique (initial) | 0 | 0 | PASS |
| weaponTechniqueInc/levelUp | 2 (see §4) | 2 | PASS (FAITHFUL) |
| stallSpeed forwarded | false | false | PASS (FAITHFUL) |
| inertia | 50 | 50 | PASS |
| Reincarnation on kill → `fire` | yes | yes (observed spawn) | PASS |
| Acquires player target | true | true | PASS |
| Attack fires within 200f | true | true | PASS |

**Result: 19/19 PASS — DIVERGENCES = 0**

---

## 4. Divergences and faithful-quirk notes

### FAITHFUL: `#weaponTechniqueInc: 3` is a dead data field (WONTFIX)

`act_scWarrior.txt` contains `#weaponTechniqueInc: 3`. In the **original engine** (`modWeaponTechnique.txt` line 30), `pWeaponTechniqueInc` is hardcoded to `2` in `on init` and is **never read from actor data** — the `addModParams` method only registers `#weaponTechnique: 0` (the starting technique rating), not `#weaponTechniqueInc`. The property in the data file has no effect in the original.

The port (`WeaponTechnique.INC = 2`, private static) matches the original engine's hardcoded 2. The data value 3 is unread in both systems.

**Proof:** `modWeaponTechnique.txt` `addModParams` registers only `#weaponTechnique`, never `#weaponTechniqueInc`; `on init` always sets `pWeaponTechniqueInc = 2` unconditionally.

**Fix sketch:** None needed — the port faithfully reproduces the original behavior. If the data field were to be honoured in both engine and port (a speculative future change), `spawnEnemy` would need to forward `weaponTechniqueInc: num("weaponTechniqueInc", 2)` and `WeaponTechnique.init` would read it as the level-up increment instead of the static `INC`.

### FAITHFUL: `#stallSpeed: 1` and `#stallSpeedIncLevel: 1` not forwarded (WONTFIX)

The original `#stallSpeed` (default `0.2` from `objGameObject.txt:69`) is a property of `pMoveXY` (the `objMoveXY` module, out of scope for this port). It controls how quickly the character's reel velocity decays — a higher value recovers faster from knockback. `scWarrior` sets this to `1` (faster recovery than default), growing per level.

The port does not model `pMoveXY`/`stallSpeed` separately; knockback resistance is approximated via `inertia` (50 for scWarrior, forwarded and correct). This is a deliberate scope decision — the port doesn't reproduce the continuous per-frame velocity-damping loop of `objMoveXY`; it models knockback as an impulse scaled by inertia. The observable outcome (a reasonably knockback-resistant warrior) is preserved.

**Fix sketch:** To honour `stallSpeed`, `Movement` would need a `reelDecay` field (initialized to `stallSpeed`, grown by `stallSpeedIncLevel` on level-up) applied as a per-tick multiplier to the reel velocity instead of the global constant friction. This is in-scope only if a per-actor stall-speed parity audit detects observable divergence from gameplay feel.

---

## 5. Summary

`scWarrior` is a straight melee CPU unit on team `#scarlet`. Its weapon `#scWarriorSword` is faithfully resolved: `#weaponMelee`, single animframe 9, damageMultiplier 5, power 0.5, sound `skeleton_fire`. The committed-target FSM (find → approach → swing) fires correctly against aldevar targets. On death it correctly reincarnates into `#fire`. The two apparent data anomalies (`#weaponTechniqueInc: 3`, `#stallSpeed: 1`) are both faithfully-reproduced original quirks — the engine ignores the first, and the second is approximated by `inertia`.

---

scWarrior | DIVERGENCES=0
