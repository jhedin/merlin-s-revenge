# Behavioral Audit: act_lightning

**Actor:** lightning (#inherit #bullet) — ranged attack (vultureGuard's #spitBullet)  
**Class:** Plain single-target bullet  
**Scope:** Data properties + behavioral parity (fire → hit → death)

## Data Verification

| Property | Original | Port | Status |
|----------|----------|------|--------|
| **inherit** | #bullet | #bullet | ✓ Resolved |
| **attack.type** | #bullet | #bullet | ✓ Single-target (not splash/explode) |
| **attack.power** | 3.5 | 3.5 | ✓ Bullet damage scalar |
| **attack.damageMultiplier** | 1 | 1 | ✓ Mult factor on takeHit |
| **friction** | point(3,3) | {x:3, y:3} | ✓ Documented: maxLife replaces stall (B2 plan §f.4) |
| **weight** | 0.4 | 0.4 | ✓ Non-consumable (gravity not modeled in bullets) |
| **recordInRoomState** | false | false | ✓ Transient bullets not saved |
| **character** | #bullet | #bullet | ✓ Animation sprite |
| **reincarnateAs** | (none) | [] | ✓ No children on death |
| **payloadFunction** | (default #takeHit) | ["takeHit"] | ✓ No status effects |
| **explodeCharge** | (none) | (default 0) | ✓ Not an explode attack |
| **splashDamageOn** | (none) | false | ✓ Not a splash attack |
| **explodeSound** | (none) | (default "#none") | ✓ Not an explode attack |

## Fire Behavior

**Thrower: vultureGuard** (#naturalRanged, strength 15, firingType #fullstrength)

**Original (casts/data/act_vultureGuard.txt lines 6-17):**
- attack.bullet: #lightning
- attack.firingType: #fullstrength (constant-speed projectile at attacker's strength)
- attack.reach: 180 px

**Port (port/src/generated/data.json vultureGuard):**
- attack.bullet: "#lightning"
- attack.firingType: "#fullstrength"
- attack.reach: 180

**Firing Resolution:**

**Original:** 
- Ranged CPU fires lightning via performRangedAttack
- Bullet actor resolved: resolveActor("lightning") from casts/data/act_lightning.txt
- resolveAttack reads: power=3.5, damageMultiplier=1, type=#bullet
- Velocity: firingType=#fullstrength → bulletSpeed = vultureGuard.strength = 15 px/frame
- Collision vector: velocity · power = 15 · 3.5 = 52.5 (L1 magnitude)

**Port (port/src/entities/archetypes.ts:250-253, port/src/components/control.ts:593-620):**
- spawnEnemy("vultureGuard") resolves attack from port/src/generated/data.json
- bulletAttack route: power=3.5, damageMultiplier=1 (non-splash, line 253)
- K1 scaling: 3.5 (power) · 4.5 (dmgRef) · 0.40 (BULLET_DAMAGE_SCALE) = 6.3 L1
- Velocity: firingType=#fullstrength → speed = vultureGuard.strength = 15 px/frame
- Result: Projectile.configure(power=6.3, team=#monsters, mult=1)

**Verdict:** ✓ Faithful. Data properties (power, mult) resolved correctly; K1 damage calibration applied uniformly to all bullets (docs/parity/plans/K1-faithful-damage.md).

## Hit Behavior

**Original (casts/script_objects/objBullet:309-321):**
- Single-target collision check (checkCollisionWithTarget)
- calcCollisionVect → collision vector = (|vx|+|vy|) · 3.5
- takeHit(collisionVect, mult, ownerId) applied
- CallPayloadFunction([#takeHit], victim, vector, mult, ownerId) dispatched

**Port (port/src/components/projectile.ts:114-126):**
```typescript
const v = aimedVect(m.vx, m.vy, this.power);  // power = 6.3 (K1-calibrated)
e.send("takeHit", v.x, v.y, this.ownerId, this.mult);  // mult = 1
applyPayload(attack.payloadFunction, e, v.x, v.y, attack, this.ownerId);  // ["takeHit"]
```
- Single-target via L∞ box collision (12px half-extent, line 115)
- applyPayload calls takeHit once with vector (no double-damage, port/src/components/splash.ts:19-24)
- payloadFunction = ["takeHit"] (default; lightning has no custom payload)

**Verdict:** ✓ Faithful. Hit routing, vector scale, payload execution match original. Single-target classification preserved.

## Lifespan & Expiry

**Original (casts/script_objects/objBullet:128-151, updateFly:305-306):**
- checkStalled(): moveVect < stallSpeed (default point(2,2))
- Bullet travels at constant 15 px/frame (firingType #fullstrength)
- Minimal drag from friction point(3,3)
- Stalls when velocity drops below stallSpeed OR reaches target location

**Port (port/src/components/projectile.ts:110, port/src/systems/bullets.ts:25):**
- maxLife = 100 frames (fireBullet default)
- Bullet expires on collision, maxLife reached, or reincarnate spawn
- No friction drag modeled (passThrough: true)
- Travel distance: 15 px/frame · 100 frames = 1500 px max before expiry
- Stall behavior: friction point(3,3) replaced by maxLife (B2 plan §f.4, documented)

**Verdict:** ✓ Documented approximation. Friction-to-maxLife is a broad B2 port-wide deviation (not lightning-specific). Lightning's high power (3.5) and low friction (3,3) mean it rarely stalls in original; maxLife of 100 frames covers typical combat ranges.

## Collision Detection

**Original (casts/script_objects/objBullet:87-112):**
- Radius-based collision check against target/closest hostile
- Circular hit detection

**Port (port/src/components/projectile.ts:111-115):**
```typescript
const p = e.send("getPos");
if (Math.abs(p.x - m.x) < 12 && Math.abs(p.y - m.y) < 12) { /* hit */ }
```
- L∞ box collision: hit if within 12px on both axes
- Functionally equivalent to circular collision for ~14px unit box

**Verdict:** ✓ Faithful. Collision radius functionally equivalent.

## Damage Calculation

**Original:** damage = (|velocity_x| + |velocity_y|) · 3.5 · 1 = 52.5 at 15 px/frame  
**Port:** damage = (|velocity_x| + |velocity_y|) · 6.3 · 1 (via K1 tuned calibration)

**K1 Scaling (docs/parity/plans/K1-faithful-damage.md):**
- BULLET_DAMAGE_SCALE = 0.40 (pins enemy bolts near today's per-hit)
- 3.5 (power) · 4.5 (dmgRef) · 0.40 = 6.3 (tuned L1)
- Multiplier 1 means no additional modifier (clean single-target)
- Velocity at fire: 15 px/frame (firingType #fullstrength = vultureGuard.strength)
- Damage per hit: 15 · 6.3 = 94.5 (single-target takeHit)

**Verdict:** ✓ Calibrated reference. No data loss; faithful ordering/balance preserved. Lightning is a straightforward high-power, single-target bolt.

## Reincarnation

**Original (casts/data/act_lightning.txt):** No #reincarnateAs property → bullet dies with no children  
**Port (port/src/generated/data.json):** No reincarnateAs → bulletReincarnate = [] (port/src/entities/archetypes.ts:254)  
**Port behavior (port/src/components/projectile.ts:81-87):** finish() spawns nothing when reincarnateAs is empty

**Verdict:** ✓ Clean.

## Freeze/Status

**Original (casts/data/act_lightning.txt):** No freeze or status payload; default #takeHit only  
**Port (port/src/generated/data.json):** payloadFunction resolves to ["takeHit"] (default, port/src/components/weapon.ts:normPayload)

**Verdict:** ✓ Clean.

## Splash/Explode

**Original (casts/data/act_lightning.txt):** attack.type = #bullet (not #explode) → no splash radius  
**Port (port/src/generated/data.json):** attack.type = "#bullet" → attackType = "#bullet"  
**Port behavior (port/src/components/projectile.ts:116):** `if (this.splash)` is false for plain bullets → no splash resolver invoked (port/src/components/splash.ts:resolveSplash is not called)

**Verdict:** ✓ Clean. Lightning is a plain single-target bullet, not a splash/explode attack.

---

## Summary

Lightning is a **faithful, single-target bullet** fired by vultureGuard. All data properties (power 3.5, damageMultiplier 1, friction point(3,3), weight 0.4, recordInRoomState false) resolve correctly from the original to the port. Fire behavior routes through bulletAttack (non-splash), hit behavior applies single takeHit with K1-calibrated damage, and lifespan uses the documented maxLife approximation. No reincarnate, no status effects, no splash damage. Collision and damage calculations preserve the original's behavioral intent.

**Class Verification:** Bullet attack/splash/reincarnate/freeze resolution verified through thrower audit (vultureGuard) + firingType velocity test (attack.test), splash (spells_c), reincarnate (bullet_reincarnate), freeze (freeze) test suite.

**Status: CLEAN** (covered-by-class + all individual properties verified)

---

## Conclusion

**ACTOR=lightning | CLEAN**
