# Parity Audit: energyPulseSpell

## Spec
**Spell Type**: Player magic weapon (scroll pickup, #objScroll)
**Attack Properties**: #magic animType, #fireBullets releaseFunction (streaming pulse, NOT beam)
**Charge Behavior**: Charge on hold, stream energyPulse splash bullets on release (one every fireDelay frames, drain chargePerUnit per bullet)
**Bullet Resolution**: energyPulse is a splash/explode bullet (fireSplashBullet, resolves area hit on land/collide)

## Audit Results

### Data Parity ✓

| Property | Original | Port | Status |
|----------|----------|------|--------|
| name | act_energyPulseSpell | act_energyPulseSpell | ✓ |
| objType | #objScroll | #objScroll | ✓ |
| AiType | #objAiPowerUp | #objAiPowerUp | ✓ |
| attack.animType | #magic | #magic | ✓ |
| attack.bullet | #energyPulse | #energyPulse | ✓ |
| attack.releaseFunction | #fireBullets | #fireBullets | ✓ |
| attack.fireDelay | 5 | 5 | ✓ |
| attack.chargePerUnit | 2 | 2 | ✓ |
| attack.chargeSpeed | 1 | 1 | ✓ |
| attack.chargeStart | 0 | 0 | ✓ |
| attack.chargeMax | 999 | 999 | ✓ |
| attack.cooldown | 0 | 0 | ✓ |

### Bullet Resolution ✓

| Property | Original | Port | Status |
|----------|----------|------|--------|
| act_energyPulse.attack.type | #explode | #explode | ✓ |
| act_energyPulse.attack.power | 1 | 1 | ✓ |
| act_energyPulse.attack.damageMultiplier | 5 | 5 | ✓ |
| act_energyPulse.attack.explodeCharge | 10 | 10 | ✓ |
| act_energyPulse.explodeEvents | [#bulletArrivedAtTargetLoc, #bulletCollidedWithTarget, #bulletLanded] | [#bulletArrivedAtTargetLoc, #bulletCollidedWithTarget, #bulletLanded] | ✓ |

### Streaming Release Logic ✓

**Original Flow** (modFireBullets.txt:62-107):
1. On #spellReleased event, check releaseFunction == #fireBullets
2. Enter #fireBullets mode, initialize fireDelay counter
3. Each tick: when counter expires, call fireBullet() → reduces charge by chargePerUnit, checks if charge < 0 (BEFORE firing), calls performRangedAttack() if charge >= 0
4. Finish when charge < 0

**Port Flow** (control.ts:178-211):
1. On magic release, check isStreaming(attack) → releaseFunction == "#fireBullets"
2. Create stream object with held charge, fireDelay, counter=0, aim point
3. Each tick tickStream(): while counter <= 0, reduce charge by chargePerUnit, check if charge < 0 (BEFORE emitting), emit bullet if >= 0
4. Finish when charge < 0

**Parity**: ✓ BEHAVIORAL MATCH
- Both drain chargePerUnit BEFORE the < 0 check
- Both fire when charge remains >= 0 after drain
- Both stream one bullet per fireDelay frames
- Both finish immediately when charge < 0

### Bullet Firing ✓

**Original**:
- modFireBullets.fireBullet() calls me.big.performRangedAttack() if NOT beam (line 48)
- modAttack.performRangedAttack() spawns a single bullet with params.typ = attack.bullet (#energyPulse)
- Bullet is created with the attack data from registry lookup

**Port**:
- control.ts emitStreamBullet() resolves the bullet's attack via registry (lines 200-201)
- Calls fireSplashBullet() with the resolved attack (lines 207-209)
- Bullet carries the explode #attack, resolves area hit on trigger

**Parity**: ✓ BEHAVIORAL MATCH
- Both resolve energyPulse from registry and spawn with its attack data
- Both use splash/explode resolution on the projectile
- Stream continues independent of caster state (dies mid-stream = stream ends)

### Charge Drain & Finish ✓

| Scenario | Original | Port | Status |
|----------|----------|------|--------|
| Charge 10, chargePerUnit 2 | Fires 5 bullets (10→8→6→4→2→0, stop at 0) | Fires 5 bullets (10→8→6→4→2→0, stop at 0) | ✓ |
| GMG active (fireDelay 0) | Drains entire stream in 1 tick | Drains entire stream in 1 tick | ✓ |
| Caster dies mid-stream | Stream ends, bullets already fired continue | Stream ends, bullets already fired continue | ✓ |
| Cooldown reset | resetCooldownFor(attack.name) on release | resetCooldownFor(attack.name) on release | ✓ |

## Conclusion

**CLEAN**

All behavioral requirements for energyPulseSpell streaming release are faithfully implemented:
- Data matches exactly (charge properties, fireDelay, chargePerUnit, releaseFunction)
- Streaming logic drains charge BEFORE firing, fires while charge >= 0, finishes at charge < 0
- Bullets resolve via energyPulse's splash/explode attack (resolveSplash at land/collide)
- Stream lifecycle independent of caster (survives caster death, runs to completion)
- Case-insensitive registry lookup for "#energyPulse" / "energyPulse" works

No gaps in behavioral parity detected.
