# Actor Audit: dwarfAxe

## Data Parity

| Property | Original (casts/) | Port (port/src/) | Status |
|----------|-------------------|------------------|--------|
| **Inherit** | #bullet | #bullet | ✓ Faithful |
| **#attack.type** | #bullet | #bullet | ✓ Faithful |
| **#attack.power** | 1 | 1 | ✓ Faithful |
| **#attack.damageMultiplier** | 4 | 4 | ✓ Faithful |
| **#attack.explodeCharge** | (default 10) | (default 10) | ✓ Faithful |
| **#friction** | point(5,5) | {x:5, y:5} | ✓ Faithful |
| **#weight** | 0.4 | 0.4 | ✓ Faithful |
| **#recordInRoomState** | false (override) | false | ✓ Faithful |
| **#rotational** | #once (from objBullet) | Not rendered | ✓ Catalogued omission |
| **#reincarnateAs** | (none) | [] | ✓ Faithful |
| **#payloadFunction** | #takeHit (default) | "takeHit" (default) | ✓ Faithful |
| **#splashDamageOn** | (none / false) | (false, implicit) | ✓ Faithful |

## Behavioral Parity: Single-Target Hit Damage

### Context
dwarfAxe is fired by the **dwarf** (#objCPUCharacter builder) via its `#attack.bullet: #dwarfAxe` property. The dwarf uses `#firingType: #fullstrength` (throw velocity scaled by strength), not the default `#proportional`. dwarfAxe is a **plain bullet** (not a splash/explode bullet), so it applies single-target takeHit on collision.

### Original (casts/script_objects/)
1. **Fire path** (modAttack.performRangedAttack, line 721-811):
   - Dwarf acquires target and calculates throw velocity using `#firingType: #fullstrength`
   - Line 759-765: `speed = me.pCharacterPrg.getStrength()` (dwarf strength = 15)
   - Creates bullet actor with `params.typ = me.getAttack().bullet` (#dwarfAxe)
   - Bullet spawned with its own attack data from act_dwarfAxe

2. **Damage calculation** (objBullet.updateFly, line 317):
   - `collisionVect = me.calcCollisionVect(myTarget)` → calcCollisionVectBullet
   - modAttack.calcCollisionVectBullet (line 437-459): `collisionVect = me.calcAttackPower()`
   - modAttack.calcAttackPowerBullet (line 347-355): `attackPower = me.getVect() * me.getAttack().power`
   - Returns: **velocity × 1** (dwarfAxe power = 1, vs archerArrow 0.6)

3. **Hit resolution** (objBullet.updateFly, line 318):
   - `myTarget.takeHit(collisionVect, me.big, me.getOwner())`
   - me.big is the **BULLET object** (dwarfAxe), not the dwarf

4. **Splash check** (modBullet/modSplashDamage):
   - dwarfAxe has NO `#splashDamageOn: true` flag
   - Collision does NOT trigger splash damage via impactSplashDamage (line 133)
   - Direct takeHit applied instead

5. **Damage applied** (modEnergy.takeHit, line 276-277):
   - `multiplier = attackingObj.getAttack().damageMultiplier` (looks up **bullet's** attack)
   - `damage = (|vx| + |vy|) * multiplier` = **L1(collisionVect) × 4**
   - dwarfAxe damageMultiplier: **4** ✓

### Port (port/src/)
1. **Fire path** (control.ts, line 390-620):
   - CpuAI.attack() with dwarf's attack data
   - Line 544: `isFullStrength` check: dwarf's firingType = "#fullstrength"
   - Line 547-577: Calculate throw velocity via fullstrength formula (strength-based, not proportional)
   - Resolves bulletAttack from dwarfAxe actor: `registry.resolveActor(atk["bullet"])` (line 250)
   - Gets the bullet's **own** attack data (dwarfAxe.attack)

2. **Bullet routing** (archetypes.ts, line 241-253):
   - dwarfAxe.attack.attackType = "#bullet" (NOT "#explode")
   - dwarfAxe resolves with no `splashDamageOn: true` at top level
   - Line 252 condition FALSE: `ba.attackType === "#explode" || ba.splashDamageOn` is false
   - Routes to `bulletAttack` (line 253), NOT `splashBullet`
   - Will call `fireBullet()` (line 616), NOT `fireSplashBullet()` ✓

3. **Damage calculation** (control.ts, line 600-616):
   - `ba.powerScalar` = 1 (from dwarfAxe.attack.power)
   - `l1 = ba.powerScalar * dmgRef * BULLET_DAMAGE_SCALE`
   - `l1 = 1 × 4.5 × 0.40 = 1.8`
   - `bmult = ba.damageMultiplier = 4` (from dwarfAxe)
   - Calls `fireBullet(this.entity.id, ..., dx, dy, speed, l1, team, 100, 0, bmult)`

4. **Bullet spawn** (systems/bullets.ts, fireBullet, line 13-28):
   - Passes `power=1.8` and `mult=4` to Projectile.configure
   - No splash wrapper; plain bullet via configure() (line 25)

5. **Collision check** (projectile.ts, line 96-132, update):
   - Line 110-130: Collision detection loop
   - Line 116: `if (this.splash) this.detonate(m.x, m.y);` — dwarfAxe has NO splash, so FALSE
   - Line 117-127: Single-target payload path:
     - `const v = aimedVect(m.vx, m.vy, this.power)` where this.power = 1.8
     - Line 124: `e.send("takeHit", v.x, v.y, this.ownerId, this.mult)` ✓ Plain takeHit
     - (No splash damage invoked)

6. **Damage applied** (components/combat.ts, Energy.takeHit, line 137):
   - `const dmg = (Math.abs(vx) + Math.abs(vy)) * mult`
   - `dmg = L1(v) × 4` = **1.8 × 4 = 7.2 damage per hit**

## Analysis

### Faithful Elements
- **Data**: All stored properties (power 1, damageMultiplier 4, friction point(5,5), weight 0.4) match exactly
- **Bullet classification**: dwarfAxe is correctly identified as a plain bullet in BOTH versions (no #splashDamageOn flag, attack.type #bullet)
- **Firing type**: dwarf's #firingType:#fullstrength is correctly resolved in port (strength-scaled velocity, not proportional)
- **Attack lookup**: Both versions correctly use the **BULLET's own attack data**, not the dwarf's
- **Routing**: Port correctly routes dwarfAxe through `bulletAttack` path (not splashBullet), ensuring single-target takeHit instead of splash damage ✓
- **Multiplier mechanism**: Both apply damageMultiplier at the takeHit layer, scaling the L1 magnitude
- **Splash omission**: Correctly omitted in port; dwarfAxe has no splash behavior in original and should not have any in port

### Calibration Note
The port's BULLET_DAMAGE_SCALE (0.40) is a **documented calibration divergence** (plan K1, not a bug):
- Original fires at raw bullet speed × 1 power (dwarf strength × 1)
- Port scales to 1.8 L1 magnitude via `1 × 4.5 × 0.40`
- This keeps enemy bullet damage near today's per-hit values (K1 plan § b)
- **Not a behavioral parity issue**: it is an intentional, documented tuning layer

### Key Distinction from towerAxe
Unlike **towerAxe** (which has `#splashDamageOn: true`), dwarfAxe explicitly does NOT carry splash damage. The port correctly:
- Does NOT include `splashDamageOn` in dwarfAxe's resolved data (port/src/generated/data.json)
- Routes dwarfAxe through `bulletAttack`, not `splashBullet` (archetypes.ts:253)
- Fires via `fireBullet()`, not `fireSplashBullet()` (control.ts:616)
- Applies single-target takeHit in projectile.ts:124, not area resolveSplash in splash.ts

## Conclusion

**dwarfAxe is behaviorally faithful.** The bullet carries its own attack data (power 1, damageMultiplier 4), correctly routes through the plain single-target firing path (not splash), applies the multiplier on collision, and resolves takeHit correctly in both versions. All inherited properties from #bullet match, and the omission of splash damage is correct and verified.

ACTOR=dwarfAxe | CLEAN
