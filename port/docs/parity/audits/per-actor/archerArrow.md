# Actor Audit: archerArrow

## Data Parity

| Property | Original (casts/) | Port (port/src/) | Status |
|----------|-------------------|------------------|--------|
| **Inherit** | #bullet | #bullet | ✓ Faithful |
| **#attack.type** | #bullet | #bullet | ✓ Faithful |
| **#attack.power** | 0.6 | 0.6 | ✓ Faithful |
| **#attack.damageMultiplier** | 4 | 4 | ✓ Faithful |
| **#friction** | point(5,5) | {x:5, y:5} | ✓ Faithful |
| **#weight** | 0.4 | 0.4 | ✓ Faithful |
| **#recordInRoomState** | false (override) | false | ✓ Faithful |
| **#rotational** | #once (from objBullet) | Not rendered | ✓ Catalogued omission |
| **#reincarnateAs** | (none) | [] | ✓ Faithful |
| **#payloadFunction** | #takeHit (default) | "takeHit" (default) | ✓ Faithful |
| **#attack.hits** | [#teamMembers] (inherited) | ["#teamMembers"] | ✓ Faithful |

## Behavioral Parity: Single-Target Hit Damage

### Original (casts/script_objects/)
1. **Fire path** (modAttack.performRangedAttack, line 783-811):
   - Creates bullet actor with `params.typ = me.getAttack().bullet` (resolves to #archerArrow)
   - Bullet spawned with its own attack data from act_archerArrow

2. **Damage calculation** (objBullet.updateFly, line 317):
   - `collisionVect = me.calcCollisionVect(myTarget)` → calcCollisionVectBullet
   - modAttack.calcCollisionVectBullet (line 437-459): `collisionVect = me.calcAttackPower()` 
   - modAttack.calcAttackPowerBullet (line 347-355): `attackPower = me.getVect() * me.getAttack().power`
   - Returns: **velocity × 0.6**

3. **Hit resolution** (objBullet.updateFly, line 318):
   - `myTarget.takeHit(collisionVect, me.big, me.getOwner())`
   - me.big is the **BULLET object** (archerArrow), not the archer

4. **Damage applied** (modEnergy.takeHit, line 276-277):
   - `multiplier = attackingObj.getAttack().damageMultiplier` (looks up **bullet's** attack)
   - `damage = (|vx| + |vy|) * multiplier` = **L1(collisionVect) × 4**
   - archerArrow damageMultiplier: **4** ✓

### Port (port/src/)
1. **Fire path** (control.ts, ~line 390):
   - Resolves bulletAttack from the bullet actor: `registry.resolveActor(atk["bullet"])`
   - Gets the bullet's **own** attack data (archerArrow.attack)

2. **Damage calculation** (control.ts, ~line 392-395):
   - `ba.powerScalar` = 0.6 (from archerArrow.attack.power)
   - `l1 = ba.powerScalar * dmgRef * BULLET_DAMAGE_SCALE`
   - `l1 = 0.6 × 4.5 × 0.40 = 1.08`
   - `bmult = ba.damageMultiplier = 4` (from archerArrow)

3. **Bullet spawn** (systems/bullets.ts, fireBullet):
   - Passes `power=1.08` and `mult=4` to Projectile.configure

4. **Hit resolution** (projectile.ts, line 117):
   - `const v = aimedVect(m.vx, m.vy, this.power)` where this.power = 1.08
   - This scales the velocity vector's L1 to 1.08

5. **Damage applied** (components/combat.ts, Energy.takeHit, line 137):
   - `const dmg = (Math.abs(vx) + Math.abs(vy)) * mult`
   - `dmg = L1(v) × 4` = **1.08 × 4 = 4.32 damage per hit**

## Analysis

### Faithful Elements
- **Data**: All stored properties (power, damageMultiplier, friction, weight) match exactly
- **Attack lookup**: Both versions correctly use the **BULLET's own attack data**, not the archer's
- **Multiplier mechanism**: Both apply damageMultiplier at the takeHit layer, scaling the L1 magnitude
- **Hit targeting**: Both fire toward the target location with the same #attack.hits scope

### Calibration Note
The port's BULLET_DAMAGE_SCALE (0.40) is a **documented calibration divergence** (plan K1, not a bug):
- Original fires at raw bullet speed × 0.6 power
- Port scales to 1.08 L1 magnitude via `0.6 × 4.5 × 0.40`
- This keeps enemy bullet damage near today's per-hit values (K1 plan § b)
- **Not a behavioral parity issue**: it is an intentional, documented tuning layer

## Conclusion

**archerArrow is behaviorally faithful.** The bullet carries its own attack data (power 0.6, damageMultiplier 4), applies the multiplier on hit, and resolves single-target takeHit correctly in both versions. The port's BULLET_DAMAGE_SCALE is a calibration constant, not a divergence in the actor's own properties or behavior.
