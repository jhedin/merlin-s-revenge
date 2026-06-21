# goblinSword Actor Parity Audit

## Overview
This audit verifies behavioral parity of the **goblinSword** weapon actor between the original Lingo implementation (casts/) and the TypeScript port (port/src/). The goblinSword is wielded by `goblinWarrior` and `friendlyGoblinWarrior` as their #attack delivery mechanism.

**Audit Date:** 2026-06-21  
**Actor:** goblinSword (#objType #objPowerUp, #inherit #weapon)  
**Wielded By:** goblinWarrior (strength 4), friendlyGoblinWarrior

---

## Source Files

| Source | File | Lines |
|--------|------|-------|
| **Original (Lingo)** | casts/data/act_goblinSword.txt | 1-18 |
| **Parent (Lingo)** | casts/data/act_weapon.txt | 1-7 |
| **Port (Data)** | port/src/generated/data.json | `"act_goblinSword": {...}` |
| **Port (Resolution)** | port/src/components/weapon.ts | 141-150 (enemyMeleeBasePower) |
| **Port (Enemy AI)** | port/src/entities/archetypes.ts | 137-237 (spawnEnemy) |
| **Port (Execution)** | port/src/components/control.ts | 620-636 (performMeleeAttack) |

---

## Attack Property Audit Table

| Property | Original (Lingo) | TS Port (data.json) | Resolution | Status |
|----------|------------------|-------------------|-----------|---------|
| **#animType** | `#weaponMelee` | `"#weaponMelee"` | Melee classification via `typeFromAnimType()` → `"melee"` | ✓ FAITHFUL |
| **#cooldown** | `0` | `0` | Raw cooldown; effectiveCooldown re-derived in `spawnEnemy()` line 188 for cooldown counter | ✓ FAITHFUL (re-derived) |
| **#power** | `point(0.7, 0)` | `{"x": 0.7, "y": 0}` | powerScalar = \|0.7\| + \|0\| = 0.7 (weapon.ts line 165) | ✓ FAITHFUL |
| **#damageMultiplier** | `2` | `2` | Carried as `mult` in `enemyMeleeBasePower()` path (control.ts line 630) | ✓ FAITHFUL |
| **#reach** | *ABSENT* (uses default) | *ABSENT* (uses default) | structAttack default = 25 (registry.ts STRUCT_ATTACK) | ✓ FAITHFUL (omitted) |
| **#name** | `#goblinSword` | `"#goblinSword"` | Weapon symbol key; used in attack naming | ✓ FAITHFUL |
| **#sound** | `"skeleton_fire"` | `"skeleton_fire"` | Played on swing at 0.5 volume (control.ts line 635) | ✓ FAITHFUL |
| **#hits** | `[#teamMembers, #teamBuildings]` | `["#teamMembers", "#teamBuildings"]` | Target role filter for melee area-impact resolution | ✓ FAITHFUL |

---

## Melee Attack Execution Verification

### Path: goblinWarrior spawns → wields goblinSword → swings → deals damage

#### 1. Enemy Spawn (archetypes.ts::spawnEnemy, line 137)
- **Actor Resolution:** `goblinWarrior` resolved from registry with `weapon: "#goblinSword"`
- **Weapon Attack Resolution (lines 155–162):**
  - `goblinWarrior.attack` = resolved from `goblinSword.attack`
  - animType = `#weaponMelee` → ranged = false (melee FSM)
  - Effective cooldown derived at line 188:
    ```
    rawCooldown = 0 (from data)
    framesWanted = max(1, 0 + 6) = 6 frames
    agility = 1 (goblinWarrior default)
    effectiveCooldown = round(6 * 1 + 1) = 7 frames
    ```
  - **Result:** enemyAttack = resolveAttack({...goblinSword.attack, cooldown: 7})

#### 2. Attack Data Resolved (weapon.ts::resolveAttack, line 157)
Input: raw goblinSword.attack properties
```javascript
{
  animframe: 7,
  animType: "#weaponMelee",
  collisionLoc: {x: 15, y: 0},
  cooldown: 0,
  damageMultiplier: 2,
  hits: ["#teamMembers", "#teamBuildings"],
  idealAttackLoc: {x: 15, y: 0},
  name: "#goblinSword",
  power: {x: 0.7, y: 0},
  sound: "skeleton_fire"
}
```

**resolveAttack Output (AttackData):**
- `type`: "melee" (via typeFromAnimType("#weaponMelee"))
- `powerScalar`: 0.7 (L1 norm: |0.7| + |0|)
- `damageMultiplier`: 2
- `reach`: 25 (structAttack default, no override)
- `cooldown`: 7 (effective, re-derived)
- `sound`: "skeleton_fire"
- `hits`: ["#teamMembers", "#teamBuildings"]

#### 3. Melee Attack Execution (control.ts::attack, line 629–631)
When an enemy melee swing lands:
```typescript
const ca = this.entity.get(WeaponManager).getCurrentAttack();  // goblinSword's AttackData
const base = ca ? enemyMeleeBasePower(ca, this.strength) : this.power;
const mult = ca ? ca.damageMultiplier : 1;
// enemyMeleeBasePower(attack, strength) = attack.powerScalar * strength * ENEMY_DAMAGE_SCALE
// = 0.7 * 4 * 0.18 = 0.504 (L1 collision vector magnitude)
// damageMultiplier applied as mult: 0.504 * 2 = 1.008 per hit
game.teamMaster.impactMeleeAttack(this.entity, meleeHitFn(this.entity, this.entity.id, base, mult));
```

**Damage Calculation (K1 faithful melee model, weapon.ts lines 141–150):**
| Term | Value | Formula |
|------|-------|---------|
| powerScalar | 0.7 | \|power.x\| + \|power.y\| |
| strength (goblinWarrior) | 4 | From act_goblinWarrior data |
| ENEMY_DAMAGE_SCALE | 0.18 | Port K1 calibration (weapon.ts line 137) |
| Base (L1) | **0.504** | 0.7 × 4 × 0.18 |
| damageMultiplier | 2 | From act_goblinSword.attack |
| **Final (per hit)** | **1.008** | 0.504 × 2 |

---

## Excluded Properties (Per Brief Specification)

The following properties are **NOT flagged** as divergences per the audit scope:

| Property | Reason |
|----------|--------|
| `#animframe` | Animation frame detail; not part of behavioral parity |
| `#collisionLoc` | Collision geometry; not part of behavioral parity |
| `#idealAttackLoc` | Attack location offset; not part of behavioral parity |
| `miniMapStatus` | Rendering/UI; not part of behavioral parity |
| `eyestrain` | Flavor/balance stat on wielder; not on weapon |
| `weaponTechnique` | Animation speedup (K7); not an attack property |
| `#explodeSound` | goblinSword has no splash/explode; not applicable |
| Cooldown re-derivation | K1 documented calibration; expected divergence |

---

## Faithfulness Summary

**All required #attack properties are FAITHFUL:**

| Category | Count | Status |
|----------|-------|--------|
| Core Attack Properties | 8 | ✓ All faithful |
| Melee Classification | 1 | ✓ Correct (#weaponMelee → type "melee") |
| Damage Model | 1 | ✓ Correct (power·strength·mult·ENEMY_DAMAGE_SCALE) |
| **Total** | **10** | **✓ CLEAN** |

**No mishandled properties detected.**

---

## Conclusion

The goblinSword weapon actor is **behaviorally identical** between original Lingo and TS port:
- Attack properties resolved faithfully: animType, power, damageMultiplier, reach, cooldown, hits, sound, name
- Melee classification correct: #weaponMelee → "melee" type
- Damage calculation correct: power·strength·mult with ENEMY_DAMAGE_SCALE on enemy side (K1)
- Wielder (goblinWarrior, strength 4) applies damage faithfully: 0.7 × 4 × 0.18 × 2 = 1.008 per swing

No gaps. No regressions.

---

**ACTOR=goblinSword | CLEAN**
