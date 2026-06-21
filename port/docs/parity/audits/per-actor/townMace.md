# Actor Audit: townMace

**Weapon Definition**: townMace (#objType #objPowerUp #inherit #weapon) — wielded by townWatch (village).

## Attack Property Parity Table

| Property | Lingo (Original) | TS Port | Status | Evidence |
|----------|------------------|---------|--------|----------|
| **#animType** | #weaponMelee | #weaponMelee | ✓ Faithful | casts/data/act_townMace.txt:8 → port/src/generated/data.json attack.animType |
| **#power** | point(2, 0) | {x:2, y:0} | ✓ Faithful | casts/data/act_townMace.txt:15 → port/src/generated/data.json attack.power |
| **#powerScalar** (derived) | 2 | 2 | ✓ Faithful | Calculated L1: abs(2) + abs(0) = 2 in resolveAttack port/src/components/weapon.ts:165 |
| **#cooldown** | 0 | 0 | ✓ Faithful | casts/data/act_townMace.txt:10 → port/src/generated/data.json attack.cooldown |
| **#damageMultiplier** | 5 | 5 | ✓ Faithful | casts/data/act_townMace.txt:11 → port/src/generated/data.json attack.damageMultiplier |
| **#reach** (implicit) | 25 (structAttack default) | 25 (STRUCT_ATTACK default) | ✓ Faithful | No explicit reach in Lingo; defaults resolved at port/src/components/weapon.ts:172 using STRUCT_ATTACK.reach |
| **#hits** | [#teamMembers, #teamBuildings] | ["#teamMembers", "#teamBuildings"] | ✓ Faithful | casts/data/act_townMace.txt:12 → port/src/generated/data.json attack.hits |
| **#name** | #townMace | #townMace | ✓ Faithful | casts/data/act_townMace.txt:14 → port/src/generated/data.json attack.name |
| **#sound** | "skeleton_fire" | "skeleton_fire" | ✓ Faithful | casts/data/act_townMace.txt:16 → port/src/generated/data.json attack.sound |
| **melee classification** | weaponMelee → melee | weaponMelee → melee | ✓ Faithful | typeFromAnimType("#weaponMelee") returns "melee" at port/src/components/weapon.ts:101 |

## Resolution Flow Verification

1. **Weapon Instantiation**: When townWatch (act_townWatch.txt:17 `#weapon: #townMace`) is spawned via `spawnEnemy()`, the port resolves the weapon attack at archetypes.ts:156.
2. **Attack Merge**: The raw townMace #attack (from data.json) is merged with STRUCT_ATTACK defaults via `resolveAttack()` at weapon.ts:157.
3. **Reach Handling**: townMace has no explicit #reach, so the port applies STRUCT_ATTACK.reach = 25 at weapon.ts:172.
4. **Melee Type**: typeFromAnimType("#weaponMelee") → "melee" at weapon.ts:101, preserving faithful melee classification.
5. **Damage Calculation**: enemyMeleeBasePower(attack, strength) uses powerScalar(2) · strength · ENEMY_DAMAGE_SCALE, with damageMultiplier(5) applied as a multiplicative factor — faithful to the original formula.

## Omitted/Out-of-Scope Properties

- **#animframe** (9): Not audited per spec (attack.animFrame excluded).
- **#collisionLoc** point(12,3): Not audited (audio/collision excluded).
- **#idealAttackLoc** point(12,0): Not audited (attack.animFrame scope).
- **#targetRoles** [[#teamMembers, #teamBuildings]]: Carried faithfully; data-driven targeting, same as #hits.

## Conclusion

**ACTOR=townMace | CLEAN**

All audited #attack properties (animType, power, powerScalar, cooldown, damageMultiplier, reach, hits, name, sound, and melee classification) match faithfully between the original Lingo and TS port. The weapon resolves correctly for townWatch's wielder, inherits appropriate defaults, and preserves damage/reach/cooldown semantics under the port's scaling framework.
