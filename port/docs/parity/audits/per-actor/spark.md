# Audit: spark (bullet actor)

**Actor**: act_spark  
**Type**: Bullet (#inherit #bullet)  
**Fired by**: evilTv (through #sparky attack name)  
**Audit Date**: 2026-06-21

## Overview

SPARK is a single-target projectile bullet fired by evilTv at range. It carries:
- **attack.power**: 0.4 (scalar, bullet speed/damage base)
- **attack.damageMultiplier**: 8 (high damage per hit)
- **attack.type**: #bullet (standard single-target routing, NOT #explode or splash)
- **friction**: point(3,3) (air resistance)
- **weight**: 0.4 (light projectile)
- **recordInRoomState**: false (ephemeral bullet, not persistent)

## Data Parity Analysis

| Property | Lingo Source | Generated (data.json) | TS Implementation | Status |
|----------|--------------|----------------------|-------------------|--------|
| **attack.type** | #bullet | #bullet | typeFromAnimType() defaults to melee (no animType on spark); bulletAttack resolved via resolveAttack(spark.attack) at archetypes.ts:251 | ✅ CLEAN |
| **attack.power** | 0.4 | 0.4 | resolveAttack: powerScalar=0.4 (weapon.ts:166); fired through Projectile.configure(power) with BULLET_DAMAGE_SCALE (weapon.ts:138, control.ts firing) | ✅ CLEAN |
| **attack.damageMultiplier** | 8 | 8 | resolveAttack: damageMultiplier=8 (weapon.ts:178); passed to Projectile.mult, multiplies collision vector at takeHit (projectile.ts:124) | ✅ CLEAN |
| **friction** | point(3,3) | {x:3, y:3} | Movement component (friction.ts) applies frictionReel during motion; spark inherits from #bullet with override | ✅ CLEAN |
| **weight** | 0.4 | 0.4 | Movement: gravity applied per weight; spark 0.4 = light projectile, faithful physics | ✅ CLEAN |
| **recordInRoomState** | false | false | Spark overrides #bullet's true; bullets are ephemeral (no Entity save/load via recordInRoomState) | ✅ CLEAN |
| **attack.explodeCharge** | (missing) | (missing) | STRUCT_ATTACK default explodeCharge=10 (registry.ts:20); spark has no #explode type, so charge NOT TRIGGERED (attack.attackType="#bullet" not "#explode", splash.ts:53 branches on attackType) | ✅ CLEAN |
| **attack.splashDamageOn** | (missing) | (missing) | Spark has no splashDamageOn; resolveAttack checks o["splashDamageOn"] (weapon.ts:213) → false; routes single-target (projectile.ts:118–124) | ✅ CLEAN |
| **attack.payloadFunction** | (missing) | (missing) | STRUCT_ATTACK default ["#takeHit"] (registry.ts:22); spark carries this; single-target hit calls e.send("takeHit", vx, vy, mult) (projectile.ts:124) | ✅ CLEAN |
| **reincarnateAs** | (missing) | (missing) | Projectile.reincarnateAs=[] (projectile.ts:33); spark has no hatch; no children spawned on death (projectile.ts:81–86) | ✅ CLEAN |
| **rotational** | (missing) | (missing) | NOT TRACKED in port (sprite rotation out of scope per audit guidelines) | ✅ OMITTED |
| **explodeSound** | (missing) | (missing) | resolveAttack picks real sound from actor/attack (weapon.ts:188); spark has no explodeSound → default "#none"; Projectile.detonate() (projectile.ts:72) is never called for spark | ✅ CLEAN |

## Bullet Routing Verification

**Spark is single-target, NOT splash/explode:**

1. **Fire path** (archetypes.ts:249–255):
   - ranged enemy with bullet:"#spark" → resolveAttack(spark.attack)
   - spark.attack has no animType → bulletAttack (not splashBullet)
   - splashBullet only set if attack.attackType=="#explode" OR attack.splashDamageOn=true (archetypes.ts:252)

2. **Collision handling** (projectile.ts:96–132):
   - this.splash is null (spark never calls configureSplash)
   - Hit branch (L115): NOT detonate, calls e.send("takeHit", v.x, v.y, this.mult)
   - finish() reaps bullet; no area hit or explosion

3. **Comparison with splash bullet** (e.g., towerAxe bullet):
   - Splash: attack.attackType="#explode" → splashBullet set → configureSplash() → this.splash=attack
   - Spark: attack.type="#bullet" (no animType to trigger) → bulletAttack → configure() → this.splash=null
   - Routing divergence: **None**. Each actor's data correctly drives its path.

## Conclusion

All properties faithfully ported. Single-target routing confirmed. No values mismatched, no missing properties that affect behavior. Spark fires, hits a single target, applies damage with mult·power·BULLET_DAMAGE_SCALE, and despawns.

ACTOR=spark | CLEAN
