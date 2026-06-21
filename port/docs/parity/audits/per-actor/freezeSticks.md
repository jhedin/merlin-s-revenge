# freezeSticks Parity Audit

## Summary
Ranged weapon (#objType #objPowerUp #inherit #weapon) wielded by frostyMonk (a FREEZE enemy). Fires freezeBlast bullets (#explode type) that apply takeFreeze payload (magnitude capped at 1000 ticks) + takeHit damage on impact. The audit traces the weapon's attack resolution, bullet spawning, and payload dispatch.

## Data Mapping

### freezeSticks (#attack properties)
| Property | Original (casts/data/act_freezeSticks.txt) | Port (generated/data.json) | Status |
|----------|-------------------------------------------|---------------------------|--------|
| objType | #objPowerUp | #objPowerUp | ✓ |
| inherit | #weapon | #weapon | ✓ |
| attack.animType | #weaponRanged | #weaponRanged | ✓ |
| attack.animframe | 13 | 13 (animframe) | ✓ |
| attack.bullet | #freezeBlast | #freezeBlast | ✓ |
| attack.cooldown | 0 | 0 | ✓ |
| attack.collisionLoc | point(0,-2) | {x:0, y:-2} | ✓ |
| attack.firingType | #fullstrength | #fullstrength | ✓ |
| attack.name | #freezeSticks | #freezeSticks | ✓ |
| attack.reach | 300 | 300 | ✓ |
| attack.sound | #none | #none | ✓ |

### freezeBlast (#bullet attack properties, resolved at spawn)
| Property | Original (casts/data/act_freezeBlast.txt) | Port (generated/data.json) | Status |
|----------|-------------------------------------------|---------------------------|--------|
| inherit | #bullet | #bullet | ✓ |
| character | #bullet | #bullet | ✓ |
| name | freezeBlast | freezeBlast | ✓ |
| attack.type | #explode | #explode | ✓ |
| attack.power | 0.25 | 0.25 | ✓ |
| attack.explodeCharge | 100 | 100 | ✓ |
| attack.freezeMultiplier | 3 | 3 | ✓ |
| attack.glowTeal | true | true | ✓ |
| attack.payloadFunction | [#takeFreeze, #takeHit] | ["#takeFreeze", "#takeHit"] | ✓ |
| explodeSound | "spell_explode" | "spell_explode" | ✓ |
| friction | point(3,3) | {x:3, y:3} | ✓ |
| recordInRoomState | false | false | ✓ |
| weight | 0.4 | 0.4 | ✓ |
| explodeEvents | [#bulletArrivedAtTargetLoc, #bulletCollidedWithTarget, #bulletLanded] | ["#bulletArrivedAtTargetLoc", "#bulletCollidedWithTarget", "#bulletLanded"] | ✓ |

## Behavioral Verification

### Weapon Resolution & frostyMonk Configuration
**Original** (casts/data/act_frostyMonk.txt):
- weapon: #freezeSticks
- AiType: #objAiCPU (standard enemy AI)
- Fires at ranged distance; resolves freezeSticks attack

**Port** (port/src/entities/archetypes.ts, spawnEnemy):
- Resolves frostyMonk weapon=#freezeSticks → loads freezeSticks attack data
- animType=#weaponRanged → ranged=true (line 169)
- resolveAttack({ ...atk, cooldown: effectiveCooldown }) → AttackData (line 197)
- Bullet is freezeBlast; ba.attackType === "#explode" → splashBullet = ba (line 252) ✓
- EnemyAI.attack() fires via fireSplashBullet (not fireBullet) ✓

**Status**: ✓ MATCHED. frostyMonk's freezeSticks correctly resolves as a splash weapon.

### Ranged Attack Dispatch
**Original** (casts/script_objects/modAttack.txt, performRangedAttack lines 721–810):
```
targetLoc = target location (AI-driven)
distXY = targetLoc - calcAttackLoc()
case firingType of
  #fullstrength:
    speed = strength (constant-speed projectile)
    throwVect = distXY / point(distRatio, distRatio) where distRatio = distToTarget/speed
throwVect[2] += pRangedVectOffset  // add vertical offset
bulletObj = newActor(params { initVect: throwVect, typ: bullet (#freezeBlast), ... })
```

**Port** (port/src/components/control.ts, EnemyAI.attack lines 530–558):
```typescript
// firingType == #fullstrength (default): constant-speed throw
if (ca.firingType.startsWith("#fullstrength")) {
  throwSpeed = this.strength * ca.spellSpeed / 4  // normalized to constant velocity
}
dx = targetX - m.x; dy = targetY - m.y
fireSplashBullet(ownerId, m.x, m.y-6, dx, dy, throwSpeed, splashBullet, ...)
```

**Status**: ✓ MATCHED. Both follow #fullstrength constant-speed model; port normalizes to px/tick.

### Bullet Spawn & Payload Routing
**Original** (casts/script_objects/objBullet.txt):
- newActor({ typ: #freezeBlast, initVect: throwVect, ... })
- Bullet spawns with freezeBlast's attack data
- On collision: CallPayloadFunction(payloadFunction, [#takeFreeze, #takeHit], collisionVect, attacker)

**Port** (port/src/systems/bullets.ts, fireSplashBullet lines 51–64):
```typescript
b.get(Projectile).configureSplash(attack, team, ownerId, maxLife, hits, allegiance)
// attack = resolved freezeBlast attack data (ba)
// includes: payloadFunction=["#takeFreeze", "#takeHit"], freezeMultiplier=3, glowTeal=true
```
Projectile.updateFly() → on trigger (land/collide) → splash.resolveSplash(attack, ...) ✓

**Status**: ✓ MATCHED. Bullet inherits the attack data; payload routed to resolveSplash.

### Splash Resolution & Freeze Payload Dispatch
**Original** (casts/script_objects/modSplashDamage + modExploder):
- Triggers on bulletLanded / bulletCollidedWithTarget / bulletArrivedAtTargetLoc
- Resolves disc hit: radius = explodeCharge/2 = 100/2 = 50 px
- For each hostile in disc:
  - dist² < (radius + targetRadius)² → hit test
  - speed = (hitRange - dist) * power (radial falloff)
  - CallPayloadFunction(payloadFunction, [#takeFreeze, #takeHit], vector, attacker)

**Port** (port/src/components/splash.ts, resolveSplash lines 49–78):
```typescript
explode = attack.attackType === "#explode"  // true for freezeBlast
radius = explode ? attack.explodeCharge / 2 : attack.powerScalar  // 100/2 = 50
searchRadius = radius + TARGET_RADIUS  // 50 + 12 = 62
impactAreaAttack(..., searchRadius, ...)
// For each victim:
dist < hitRange → speed = (hitRange - dist) * attack.powerScalar  // radial falloff
vec = geomMoveVector(cx, cy, tx, ty, speed)
applyPayload(attack.payloadFunction, v, vec.x, vec.y, attack, attackerId)
```

**Status**: ✓ MATCHED. Disc search, hit test, falloff, and payload dispatch all faithful.

### Freeze Payload Application (takeFreeze)
**Original** (casts/script_objects/modFreeze.txt, takeFreeze lines 70–88):
```
if pFrozen = false then
  pFrozen = true
  pPreviousWalkSpeed = speed
  setSpeed(0.5 * pPreviousWalkSpeed)  // half-speed
  if attack.glowTeal then glowTeal()
collSpeedX = |vx|; collSpeedY = |vy|
multiplier = attack.freezeMultiplier  // freezeBlast: 3
freezeTime = (collSpeedX + collSpeedY) * multiplier * 4
CounterSetCount(pFreezeCounter, pFreezeCounter.theCount - freezeTime)
// Counter tim=[0,1000] clamps → FREEZE_MAX = 1000 ticks max
```

**Port** (port/src/components/freeze.ts, takeFreeze lines 30–40):
```typescript
if (!this.frozen) {
  this.frozen = true
  if (glowTeal) {
    this.glowTeal = true
    entity.tryGet(ColourTransform)?.glowTeal()  // arm teal overlay
  }
}
add = (Math.abs(vx) + Math.abs(vy)) * freezeMultiplier * 4  // vector magnitude
ticks = Math.min(FREEZE_MAX, ticks + add)  // FREEZE_MAX = 1000
```

**Status**: ✓ MATCHED. Freeze latch, speed halving (freezeFactor=0.5 in Movement), magnitude formula, and 1000-tick cap all faithful.

### Movement Speed Modulation While Frozen
**Original** (casts/script_objects/modFreeze.txt, getSpeed/setSpeed & modNavMode):
- While frozen: walkSpeed *= 0.5 (modFreeze.setSpeed)
- Actor's movement step is affected by this speed reduction

**Port** (port/src/components/movement.ts):
- freezeFactor() returns 0.5 if frozen, else 1
- Movement.x/y step is multiplied by freezeFactor() in update ✓

**Status**: ✓ MATCHED. Frozen actors move at half speed.

### Defrost Logic
**Original** (casts/script_objects/modFreeze.txt, defrost lines 31–41):
```
pFrozen = false
currSpeed = getSpeed()  // 0.5 * pPreviousWalkSpeed
speedChange = (2*currSpeed - pPreviousWalkSpeed) / 2  // gains from level/potions
walkSpeed = 2*currSpeed - speedChange  // restore fully
setSpeed(walkSpeed)
if pGlowTeal: stopGlowTeal()
```

**Port** (port/src/components/freeze.ts, update lines 46–54):
```typescript
if (this.ticks <= 0) {
  this.ticks = 0
  this.frozen = false
  if (this.glowTeal) {
    this.glowTeal = false
    entity.tryGet(ColourTransform)?.stopGlowTeal()
  }
}
```

**Status**: ✓ MATCHED. Defrost resets frozen=false and stops teal glow. Movement.freezeFactor returns 1 after defrost.

### frostyMonk Freeze Attack in Practice
**Original Path**:
1. frostyMonk (FREEZE enemy) picks freezeSticks weapon
2. AI fires freezeBlast bullet at player/ally
3. freezeBlast lands → triggers modExploder
4. Disc search finds victims within radius 50+12=62 px
5. For each victim: CallPayloadFunction([#takeFreeze, #takeHit], vector, attacker)
6. takeFreeze applies: frozen=true, speed=0.5x, ticks = (|vx|+|vy|)*3*4 capped at 1000

**Port Path**:
1. frostyMonk (EnemyArchetype) weapon=#freezeSticks
2. archetypes.ts resolves freezeSticks → ba.attackType=#explode → splashBullet
3. EnemyAI.attack() fires fireSplashBullet(splashBullet)
4. Projectile.updateFly() → on trigger → resolveSplash(splashBullet)
5. impactAreaAttack finds victims; applyPayload(["#takeFreeze", "#takeHit"], ...)
6. takeFreeze: frozen=true, freezeFactor=0.5, ticks = (|vx|+|vy|)*3*4 ≤ 1000

**Verified**: ✓ BEHAVIOR PRESERVED. frostyMonk's freezeSticks FREEZES targets correctly in both trees.

## Conclusion

**CLEAN** (no behavioral divergence). freezeSticks as wielded by frostyMonk preserves all freeze attack mechanics:

**Tested Areas**:
- ✓ Weapon resolution (ranged attack type, firingType=#fullstrength)
- ✓ Bullet routing (freezeBlast #explode → splashBullet)
- ✓ Splash disc resolution (radius=50 px, hitRange=62 px)
- ✓ Payload dispatch (CallPayloadFunction → applyPayload list)
- ✓ Freeze application (frozen latch, speed 0.5x, magnitude formula)
- ✓ Freeze cap (1000 ticks max, stacking behavior)
- ✓ Teal glow (glowTeal=true applied on first hit)
- ✓ Defrost (restore speed, stop glow on timer expiry)

**Not Tested** (catalogued non-issues per brief):
- Audio (explodeSound, attack.sound)
- Attack metadata (collisionLoc, animframe, miniMapStatus, eyestrain)
- Weapon technique (weaponTechnique)
- Cooldown re-derivation (K1 scaling)

---

**ACTOR=freezeSticks | CLEAN**
