# Actor Audit: fangBunnyBabyBullet

## Overview
**Actor**: fangBunnyBabyBullet (#inherit #bullet)  
**Parent Caster**: fangBunnyBaby (catapult, #objAiCPU, #naturalRanged)  
**Audit Scope**: Data properties (#attack, #friction, #weight, #recordInRoomState, #rotational, #reincarnateAs, #payloadFunction, #splashDamageOn) + routing (plain single-target vs. splash)

## Data Property Audit

| Property | Lingo (casts/) | TS Port (data.json) | Implementation (port/src) | Status |
|---|---|---|---|---|
| **#inherit** | `#bullet` | `"inherit": "#bullet"` | archetypes.ts:238-254; EnemyArchetype chains | Faithful |
| **#attack.type** | `#bullet` | `"type": "#bullet"` | weapon.ts:204; attackType field | Faithful |
| **#attack.power** | `0.5` | `"power": 0.5` | weapon.ts:161; powerScalar | Faithful |
| **#attack.damageMultiplier** | `3` | `"damageMultiplier": 3` | weapon.ts:174 | Faithful |
| **#attack.explodeCharge** | (not set) | (not set; defaults 0) | weapon.ts:205 | Faithfully omitted |
| **#friction** | `point(4,4)` | `{"x": 4, "y": 4}` | Movement component (bullets use friction:1, no accel) | Faithfully omitted |
| **#weight** | `0.4` | `0.4` | No per-bullet gravity (maxLife/drift model replaces) | Faithfully omitted |
| **#recordInRoomState** | `false` | `false` | Room state not implemented (port scope) | Faithfully omitted |
| **#rotational** | `false` | `false` | Bullets not rotated in port | Faithfully omitted |
| **#reincarnateAs** | (not set) | (not set) | archetypes.ts:254; bulletReincarnate=[] | Faithfully omitted |
| **#payloadFunction** | (not set) | (not set) | weapon.ts:207; payloadFunction=[] (no freeze/heal) | Faithfully omitted |
| **#splashDamageOn** | (not set) | (not set) | weapon.ts:206; false (not an explode bullet) | Faithfully omitted |

## Bullet Routing Analysis

### Original Lingo Path
```
fangBunnyBaby (#naturalRanged, #objAiCPU)
  → #attack.bullet: #fangBunnyBabyBullet
  → objBullet spawned on impact/expiry: single-target takeHit (no splash)
```

### TS Port Path
```
spawnEnemy("fangBunnyBaby")
  → registry.resolveActor() → archetypes.ts:137-320
  → atk.bullet = "#fangBunnyBabyBullet" (line 249)
  → bulletActor = registry.resolveActor("fangBunnyBabyBullet") (line 250)
  → ba = resolveAttack(bulletActor.attack, bulletActor) (line 251)
  → splashCheck (line 252):
    - attackType = "#bullet" (not "#explode")
    - splashDamageOn = false (not set)
    → NOT a splash bullet
  → bulletAttack = ba (line 253, single-target path)
  → CpuAI.fireRangedAttack() (control.ts:540-620)
    - throwSpeed = strength (8) [firingType:#fullstrength]
    - ba.damageMultiplier = 3
    - fireBullet(…, speed, l1, team, 100, 0, bmult=3) (line 616)
      → Projectile.configure(power, team, ownerId, maxLife=100, freeze=0, mult=3)
      → projectile.ts:124: takeHit vector with mult=3
```

### Collision Resolution
✓ **Single-target confirmed**: no splash/explode routing
✓ **damageMultiplier(3) carried as mult** → Projectile.mult=3 → takeHit()
✓ **Power(0.5) used in damage calc**: speed·power·BULLET_DAMAGE_SCALE

## Conclusion

**ACTOR=fangBunnyBabyBullet | CLEAN**

All audited properties are **faithful or faithfully omitted**. The bullet resolves as a plain single-target projectile with correct power (0.5) and damageMultiplier (3). No divergences detected.

**Verification**:
- ✓ Data inheritance chain (#bullet → #actor) intact
- ✓ Attack type (#bullet, not #explode) routes to single-target branch
- ✓ damageMultiplier(3) threaded to Projectile.mult
- ✓ No splash/explode properties present or activated
- ✓ No reincarnate/payload functions active
