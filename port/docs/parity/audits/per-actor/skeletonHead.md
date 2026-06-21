# Parity Audit: skeletonHead (#bullet)

## Summary

Actor **skeletonHead** is a thrown projectile spawned by **skeletonThrower** (using #naturalRanged attack with #fullstrength firing). It inherits from **#bullet** and adds a #damageMultiplier override and movement properties.

| Property | Lingo (Original) | TS Port | Status | Evidence |
|----------|------------------|---------|--------|----------|
| **#attack** | | | | |
| &nbsp;&nbsp;#type | #bullet | #bullet | ✓ FAITHFUL | casts/data/act_skeletonHead.txt:8 → port/src/generated/data.json:attack.type |
| &nbsp;&nbsp;#power | 1 | 1 | ✓ FAITHFUL | casts/data/act_skeletonHead.txt:7 → port/src/generated/data.json:attack.power |
| &nbsp;&nbsp;#damageMultiplier | 3.5 | 3.5 | ✓ FAITHFUL | casts/data/act_skeletonHead.txt:6 → port/src/generated/data.json:attack.damageMultiplier |
| &nbsp;&nbsp;#explodeCharge | (none) | (none) | ✓ OMITTED | Not present in either. Fires as plain bullet. |
| &nbsp;&nbsp;#payloadFunction | (none) | [] | ✓ FAITHFUL | No payload list; resolveAttack defaults to []. weapon.ts:214 normPayload default. |
| **#friction** | point(3,3) | {x:3, y:3} | ✓ FAITHFUL | casts/data/act_skeletonHead.txt:12 → port/src/generated/data.json:friction |
| **#weight** | 0.4 | 0.4 | ✓ FAITHFUL | casts/data/act_skeletonHead.txt:15 → port/src/generated/data.json:weight |
| **#recordInRoomState** | false | false | ✓ FAITHFUL | casts/data/act_skeletonHead.txt:13 → port/src/generated/data.json:recordInRoomState |
| **#rotational** | false | false | ✓ FAITHFUL | casts/data/act_skeletonHead.txt:14 → port/src/generated/data.json:rotational |
| **#reincarnateAs** | (none) | [] | ✓ OMITTED | Not present in original; projectile.ts:33 reincarnateAs defaults to []. |
| **#splashDamageOn** | (none) | false | ✓ OMITTED | Not present. archetypes.ts:252 routes via bulletAttack (not splashBullet). |

## Routing & Behavior

### Firing Chain
1. **spawnEnemy(skeletonThrower)** → archetypes.ts:249–255
   - Resolves skeletonThrower's attack (animType=#naturalRanged, ranged=true)
   - Resolves skeletonHead's #attack via `registry.resolveActor("skeletonHead")`
   - Since attackType="#bullet" and splashDamageOn≠true, routes as **bulletAttack** (not splashBullet)

2. **CpuAI.attack()** → control.ts:534–620
   - Checks firingType → "#fullstrength" (skeletonThrower.strength=8)
   - Calls **fireBullet()** with:
     - power = skeletonHead.power (1) × dmgRef (4.5) × BULLET_DAMAGE_SCALE (0.40) ≈ 1.8
     - mult = skeletonHead.damageMultiplier (3.5)
     - maxLife = 100 frames (default)

3. **fireBullet()** → bullets.ts:13–28
   - Creates bullet entity, sets velocity from firingType
   - Calls `Projectile.configure(power, team, ownerId, maxLife, freeze=0, mult=3.5)`

4. **Projectile.update()** → projectile.ts:96–132
   - Plain bullet (no splash): `this.splash = null; this.payload = null`
   - On collision: single-target takeHit with collisionVect L1=power, mult=3.5
   - On expiry: `finish()` spawns any reincarnateAs (none for skeletonHead)

### Data-Driven Routing
- **attackType** ("#bullet") + **splashDamageOn** (false/absent) → plain bullet path
- No explodeCharge, payloadFunction, or reincarnateAs
- Damage formula: (|vx| + |vy|) × mult = collision L1 magnitude × 3.5

## Conclusion

**ACTOR=skeletonHead | CLEAN**

All explicit properties (attack type/power/damageMultiplier, friction, weight, recordInRoomState, rotational) are faithful. Omitted properties (explodeCharge, payloadFunction, reincarnateAs, splashDamageOn) are correctly absent in both trees and routed as a plain bullet. The bullet fires with the correct damageMultiplier (3.5) applied to its damage vector at collision.
