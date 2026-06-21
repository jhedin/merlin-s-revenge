# Parity Audit: warriorSword

**Weapon Actor:** `#warriorSword` (#objPowerUp, inherits #weapon)  
**Wielder:** `warrior` (baseline ally, melee combatant)  
**Baseline Damage Reference:** K1 (enemy melee scaling)

## Executive Summary

The `warriorSword` actor's #attack block and inheritance chain faithfully resolve in the TypeScript port. All critical attack properties (melee classification, reach 25, power, damageMultiplier) match the original Lingo. The K1 damage ordering (warrior ≈ swordOrc < blackOrc) is correctly preserved via the ENEMY_DAMAGE_SCALE constant and resolveAttack() pathway.

## Attack Property Audit

| Property | Original Lingo (casts/data/act_warriorSword.txt) | TS Port Resolution | Port Source | Verdict |
|----------|---------------------------------------------------|-------------------|-------------|---------|
| **#objType** | #objPowerUp (line 3) | "#objPowerUp" | data.json | ✅ Faithful |
| **#inherit** | #weapon (line 4) | "#weapon" | data.json | ✅ Faithful |
| **#animType** | #weaponMelee (line 8) | "#weaponMelee" | data.json | ✅ Faithful (melee type) |
| **#animframe** | 9 (line 7) | 9 | data.json | ✅ Faithful (not flagged per spec) |
| **#cooldown** | 0 (line 10) | 0 | data.json | ✅ Faithful |
| **#damageMultiplier** | 3 (line 11) | 3 | data.json | ✅ Faithful |
| **#name** | #warriorSword (line 14) | "#warriorSword" | data.json | ✅ Faithful |
| **#power** | point(0.5, 0) (line 15) | {x: 0.5, y: 0} | data.json | ✅ Faithful |
| **powerScalar** | (derived L1) | 0.5 | weapon.ts:165 | ✅ Faithfully derived as abs(x)+abs(y) |
| **#reach** | (inherited default 25) | 25 (default) | registry.ts:29, weapon.ts:172 | ✅ Faithfully applied from STRUCT_ATTACK |
| **#hits** | [#teamMembers, #teamBuildings] (line 12) | ["#teamMembers", "#teamBuildings"] | data.json | ✅ Faithful |
| **#sound** | "skeleton_fire" (line 16) | "skeleton_fire" | data.json | ✅ Faithful |
| **#collisionLoc** | point(12,0) (line 9) | {x: 12, y: 0} | data.json | ⊘ Omitted (not flagged per spec) |
| **#idealAttackLoc** | point(12,0) (line 13) | {x: 12, y: 0} | data.json | ⊘ Omitted (not flagged per spec) |
| **#targetRoles** | [[#teamMembers, #teamBuildings]] (line 17) | [["#teamMembers", "#teamBuildings"]] | data.json | ✅ Faithful |

## Melee Classification Verification

- **Lingo:** `#animType: #weaponMelee` (line 8 of act_warriorSword.txt)
- **Port:** `typeFromAnimType("#weaponMelee")` → returns `"melee"` (weapon.ts:101)
- **Dispatch:** EnemyAI.performMeleeAttack() reads `enemyMeleeBasePower(attack, strength)` (control.ts:629)
- **Verdict:** ✅ Correctly classified as melee attack

## Reach Validation

- **Lingo Explicit:** None in act_warriorSword.txt (inherits #weapon, no #reach override)
- **Lingo Implicit:** structMaster.txt line 29: `a[#reach] = 25` (default for all #attack)
- **Port:** Registry STRUCT_ATTACK default (registry.ts:29): `reach: 25`
- **Resolution:** resolveAttack() line 172: `reach = numOr(rch, numOr(d["reach"], 25))`
- **Test Verification:** attack.test.ts line 79: `expect(ai.reach).toBe(25); // warriorSword reach` ✅ PASS
- **Verdict:** ✅ Reach 25 correctly applied

## Damage Ordering (K1) Verification

The K1 baseline ensures warrior < swordOrc < blackOrc. Attack resolution feeds `enemyMeleeBasePower`:

```typescript
enemyMeleeBasePower(attack: AttackData, strength: number): number
  = attack.powerScalar * strength * ENEMY_DAMAGE_SCALE
```

- **warrior:** power_L1=0.5, strength=12, mult=3
  - Base = 0.5 * 12 * 0.18 = 1.08; with mult = 1.08 * 3 = 3.24
  - Test (weapon.test.ts): `expect(hit("warrior")).toBeCloseTo(3.24, 2)` ✅ PASS

- **swordOrc:** power_L1=1.0, strength=12, mult=4
  - Base = 1.0 * 12 * 0.18 = 2.16; with mult = 2.16 * 4 = 4.32
  - Test (weapon.test.ts): `expect(hit("swordOrc")).toBeCloseTo(4.32, 2)` ✅ PASS

- **blackOrc:** power_L1=1.5, strength=30, mult=4
  - Base = 1.5 * 30 * 0.18 = 8.1; with mult = 8.1 * 4 = 16.2
  - Test (weapon.test.ts): `expect(hit("blackOrc")).toBeCloseTo(16.2, 2)` ✅ PASS

## Critical Code Paths

1. **Data Loading & Resolution** (registry.ts:92-113)
   - Resolves #inherit chain: act_warriorSword → #weapon → #actor
   - Deep-merges #attack onto STRUCT_ATTACK defaults
   - Memoizes resolved record in inheritCache

2. **Attack Instantiation** (weapon.ts:157-223)
   - resolveAttack() reads all #attack properties from data.json
   - Applies STRUCT_ATTACK defaults for omitted keys
   - Computes reach from point or scalar (line 169-172)
   - Computes powerScalar as L1 norm (line 165)

3. **Enemy Attack Dispatch** (control.ts:628-631)
   - EnemyAI reads getCurrentAttack() from WeaponManager
   - Applies enemyMeleeBasePower(ca, this.strength) for melee
   - Uses damageMultiplier as data-driven multiplicand
   - Invokes meleeHitFn() for impact resolution

## Top-Level Actor Properties

Examined at warrior spawn (archetypes.ts spawnEnemy):
- **weapon:** "#warriorSword" → initiates weapon chain resolution ✅
- **strength:** 12 (used in power·strength formula) ✅
- **inertia:** 60 (damage damping at victim, separate system) ✅
- **damageSpeed:** 4 (attack animation timing, not melee damage) ✅

## Conclusion

All critical attack properties for `warriorSword` are **faithfully resolved** in the TypeScript port. The melee classification, reach 25, power 0.5, and damageMultiplier 3 flow through resolveAttack() and enemyMeleeBasePower() with perfect fidelity to the original Lingo. The K1 damage ordering test confirms warrior < swordOrc < blackOrc baseline is correctly preserved.

---

**ACTOR=warriorSword | CLEAN**

*Verified:* registry.ts, weapon.ts resolveAttack(), control.ts enemyMeleeBasePower(), attack.test.ts (reach 25 assertion), weapon.test.ts (K1 damage ordering assertions all passing).
