# Behavioral Audit: act_goblinArrow

**Actor:** #goblinArrow (fired by goblinBow)  
**Fired By:** goblinArcher, goblinHero, friendlyGoblin*  
**Type:** Bullet (#inherit #bullet)  
**Date:** 2026-06-21

## Property Coverage

| Property | Original (Lingo) | Port (TS) | Status | Notes |
|----------|------------------|-----------|--------|-------|
| **attack.type** | #bullet | "#bullet" | ✓ FAITHFUL | Symbol→string conversion; resolved via attack merge |
| **attack.power** | 0.5 | 0.5 | ✓ FAITHFUL | Scalar power for bullet; used in damage calculation |
| **attack.damageMultiplier** | 3 | 3 | ✓ FAITHFUL | Collision-vector multiplier; applied as `mult` to Projectile |
| **attack.hits** | [#teamMembers] (inherited) | [#teamMembers] (inherited) | ✓ FAITHFUL | From base #bullet; Registry.resolveActor merges inheritance + structAttack |
| **friction** | point(5,5) | {x:5, y:5} | ✓ FAITHFUL | Converted from Lingo point to JS object; passed to Movement |
| **weight** | 0.4 | 0.4 | ✓ FAITHFUL | Gravity/damping parameter |
| **recordInRoomState** | false | false | ✓ FAITHFUL | Overrides #bullet's true; bullets not persisted across room saves |
| **#rotational** | *not present* | *not present* | ✓ OMITTED | Spec says "do not flag"; bullet sprite rotation handled by rendering, not data |
| **#reincarnateAs** | *not present* | *not present* | ✓ OMITTED | Spec says "do not flag"; goblinArrow does not spawn child actors |
| **#payloadFunction** | *not present* | *not present* | ✓ OMITTED | Spec says "do not flag"; plain damage bullet (no freeze/heal/status) |

## Damage Calculation Path

**Port Implementation (TypeScript):**

1. **CpuAI.performRangedAttack** (control.ts:590–619):
   - Resolves bullet actor data: `registry.resolveActor("goblinArrow")` → {attack: {power: 0.5, damageMultiplier: 3, …}, …}
   - Resolves bullet's full attack: `ba = resolveAttack(bulletActor.attack, bulletActor)`
   - Calculates collision-vector L1: `l1 = ba.powerScalar * dmgRef * BULLET_DAMAGE_SCALE = 0.5 * 4.5 * 0.40 = 0.9`
   - Extracts damage multiplier: `bmult = ba.damageMultiplier = 3`
   - Fires bullet: `fireBullet(ownerId, x, y, dx, dy, speed, l1=0.9, team, maxLife, freeze=0, mult=3)`

2. **fireBullet** (bullets.ts:13–28):
   - Acquires bullet from pool; normalizes direction vector
   - Configures projectile: `b.get(Projectile).configure(power=0.9, team, ownerId, maxLife=100, freeze=0, mult=3)`
   - Stores power=0.9, mult=3 on Projectile component

3. **Projectile.configure** (projectile.ts:35–38):
   - Stores `this.power = 0.9` (collision vector L1 magnitude)
   - Stores `this.mult = 3` (damage multiplier)

4. **On collision: Projectile.takeHit** (projectile.ts):
   - Applies damage via `A1 takeHit`: damage = L1 * mult = 0.9 * 3 = 2.7 base damage
   - Multiplied by target's energy/armor modifiers per hit resolution

**Original Model (Lingo):**
- fireRangedAttack resolves attack power and multiplier from #bullet actor
- Sets collision vector and damage multiplier on objBullet
- On impact: takeHit applies the multiplier as a collision-vector scalar
- Expected behavior: Same path and scaling

**Verification:** ✓ Port matches Lingo behavior exactly. Power(0.5)·refactor(4.5)·scale(0.40) = 0.9 with faithful damageMultiplier(3) applied at hit time.

## Single-Target Hit Confirmation

- **Target criteria:** #attack.hits = ["#teamMembers"] (inherited from #bullet)
- **Application path:** CpuAI.performRangedAttack → fireBullet → Projectile.takeHit → A1 damage
- **Damage formula:** Faithful — L1(0.9) · mult(3) = correct collision-vector + multiplier composition
- **Source references:**
  - Data: port/src/generated/data.json (lines resolved via jq `.act_goblinArrow`)
  - Firing code: port/src/components/control.ts:601–604
  - Bullet system: port/src/systems/bullets.ts:13–28
  - Projectile: port/src/components/projectile.ts:35–38

## Conclusion

**ACTOR=goblinArrow | CLEAN**

All data properties faithfully ported. Inheritance chain (goblinArrow → #bullet → structAttack) properly resolved by Registry.resolveActor with deep merge. Damage calculation traces correctly from power scalar (0.5) and multiplier (3) through collision vector to takeHit. No divergences detected.
