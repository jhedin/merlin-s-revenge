# arcticBlast Parity Audit

## Summary
Spell scroll (#objScroll / #objAiPowerUp) with arcane magic casting: player holds to charge, releases to fly to aim point and explode radially, applying takeFreeze (freeze cap 1000 ticks) + takeHit damage. Inherits from #actor; grows as charged sprite over Merlin's head; magic-limited.

## Data Mapping

| Property | Original (casts/) | Port (port/src/generated/) | Status |
|----------|-------------------|---------------------------|--------|
| objType | #objScroll | #objScroll | ✓ |
| AiType | #objAiPowerUp | #objAiPowerUp | ✓ |
| #attack.animType | #magic | #magic | ✓ |
| #attack.bullet | #energyBlastBullet | #energyBlastBullet | ✓ |
| #attack.chargeColour | rgb(0,255,255) | (cyan RGB dict) | ✓ |
| #attack.chargeSpeed | 0.25 | 0.25 | ✓ |
| #attack.chargeStart | 0 | 0 | ✓ |
| #attack.chargeMax | 999 | 999 | ✓ |
| #attack.chargeMaxBasic | 5 | 5 | ✓ |
| #attack.chargeMaxModifier | 0.75 | 0.75 | ✓ |
| #attack.gmgChargeMax | 18 | 18 | ✓ |
| #attack.gmgChargeSpeed | 1 | 1 | ✓ |
| #attack.gmgChargeStart | 6 | 6 | ✓ |
| #attack.gmgAutoFire | true | true | ✓ |
| #attack.chargeVolumeMap | [#vol: [10,255], #charge: [1,100]] | {vol: [10,255], charge: [1,100]} | ✓ |
| #attack.collisionLoc | point(0,-8) | {x:0, y:-8} | ✓ |
| #attack.cooldown | 30 | 30 | ✓ |
| #attack.explodeSound | "spell_explode" | "spell_explode" | ✓ |
| #attack.hits | [#teamMembers, #teamBuildings] | ["#teamMembers", "#teamBuildings"] | ✓ |
| #attack.glowTeal | true | true | ✓ |
| #attack.limitMagic | true | true | ✓ |
| #attack.randomSummon | false | false | ✓ |
| #attack.name | #arcticBlast | #arcticBlast | ✓ |
| #attack.power | 0.75 | 0.75 | ✓ |
| #attack.payloadFunction | [#takeFreeze, #takeHit] | ["#takeFreeze", "#takeHit"] | ✓ |
| #attack.reach | 9999 | 9999 | ✓ |
| #attack.releaseSound | "spell_release" | "spell_release" | ✓ |
| #attack.spellSpeed | 20 | 20 | ✓ |
| #attack.targetRoles | [[#teamMembers, #teamBuildings]] | [["#teamMembers", "#teamBuildings"]] | ✓ |
| #attack.freezeMultiplier | 1 (inherited from #actor → #bullet → #spell) | **MISSING** (undefined) | ⚠ Data gap |

## Behavioral Verification

### Charge & Release Logic
**Original** (casts/script_objects/modAttack.txt, objAiPlayer.txt):
- calcAttackChargeMax: `min(chargeMax, mana.capacity * chargeMaxModifier + chargeMaxBasic) * (limitMagic ? magicLimit/100 : 1)`
- calcAttackChargeStart: `min(chargeStart + mana.burst, chargeMax, chargeStartMax)` (K11 bug preserved: burst discarded)
- calcAttackChargeSpeed: `chargeSpeed * mana.flow` capped at chargeSpeedMax
- On cast release: objSpell.release(targetLoc, speed) → releaseNormal → moveToTarget

**Port** (port/src/components/charge.ts, control.ts):
- chargeMaxOf: `min(chargeMax, mana.capacity * chargeMaxModifier + chargeMaxBasic) * (limitMagic ? magicLimit/100 : 1)` ✓
- chargeStartOf: `min(chargeStart, cap)` (caps via chargeStartMax; burst discarded faithfully) ✓
- chargeSpeedOf: `chargeSpeed * mana.flow` capped at chargeSpeedMax ✓
- On release: SpellActor.release(targetX, targetY, speed) → moves toward target → explodes on arrival ✓

### Spell Actor Grow-Fly-Explode
**Original** (casts/script_objects/objSpell.txt):
- charge(amount, chargeLoc): pCurrentCharge = amount; align (over head via point(0,-size/2))
- release(targetLoc, speed): moveToTarget(targetLoc, speed) [objSpell.releaseNormal]
- moveXYfin (arrival): goMode(#explode)
- goMode(#explode): pCurrentCharge *= chargeExplodeFactor; startQuickFade; teamMaster.impactAttack (radial)

**Port** (port/src/components/spellActor.ts):
- setCharge(amount, casterX, casterY): charge = amount; position over head ✓
- release(targetX, targetY, speed): set fly direction; mark mode="fly" ✓
- update (fly mode): step toward target; on arrival → explode() ✓
- explode(): grown = charge * chargeExplodeFactor; resolveSplash (radial) ✓

### Freeze Payload (takeFreeze)
**Original** (casts/script_objects/modFreeze.txt lines 70–88):
```
multiplier = attackingObj.getAttack().freezeMultiplier           // read at runtime
freezeTime = (collSpeedX + collSpeedY) * multiplier*4            // magnitude formula
CounterSetCount(pFreezeCounter, pFreezeCounter.theCount - freezeTime)
// Counter tim=[0,1000] clamps to FREEZE_MAX
```
- First hit: pFrozen=true, speed *= 0.5, glowTeal if attack.glowTeal
- Freeze cap: pFreezeCounter.tim = [0, 1000] → FREEZE_MAX = 1000 ticks

**Port** (port/src/components/freeze.ts lines 30–39):
```typescript
freezeMultiplier = 1  // default parameter if undefined
add = (|vx| + |vy|) * freezeMultiplier * 4
ticks = Math.min(FREEZE_MAX, ticks + add)  // FREEZE_MAX = 1000
```
- First hit: frozen=true, freezeFactor=0.5, glowTeal if attack.glowTeal ✓
- Freeze cap: FREEZE_MAX = 1000 ✓

**Data Gap Impact**: arcticBlast's attack.freezeMultiplier is undefined in generated JSON. However, port's takeFreeze defaults to freezeMultiplier=1 (line 30), which matches arcticBlast's inherited value (act_spell.txt line 8). Behavior is CORRECT despite missing data.

### Radial Damage on Explode
**Original** (casts/script_objects/modSplashDamage + objSpell.txt line 161):
- Spell explodes at landing; teamMaster.impactAttack (disc hit) applies payloadFunction to all hostiles
- Vector: geomMoveVector (radial falloff by distance)
- Payload: CallPayloadFunction runs [#takeFreeze, #takeHit] in sequence on each target

**Port** (port/src/components/splash.ts + spellActor.ts):
- explode() calls resolveSplash with explodeAttack (radius = grown/2) ✓
- impactAreaAttack finds all hostiles in disc ✓
- applyPayload(payloadFunction, victim, vx, vy, attack, attackerId) runs ["#takeFreeze", "#takeHit"] ✓
  - takeFreeze: `victim.send("takeFreeze", vx, vy, attackerId, attack.freezeMultiplier, attack.glowTeal)` ✓
  - takeHit: `victim.send("takeHit", vx, vy, attackerId, attack.damageMultiplier)` ✓

## Conclusion
**CLEAN** (no behavioral divergence). The missing freezeMultiplier in generated data is a data-generation artifact that does NOT affect runtime behavior: the port's Freeze component defaults to multiplier=1, matching arcticBlast's inherited value from act_spell. All charge/release/freeze logic paths verified equivalent between original and port.

**Tested Areas**:
- ✓ Charge scaling (chargeMaxOf, chargeStartOf, chargeSpeedOf)
- ✓ Spell-actor grow-fly-explode lifecycle
- ✓ Freeze cap (1000 ticks max)
- ✓ Teal glow (glowTeal: true)
- ✓ Payload dispatch (takeFreeze + takeHit in sequence)
- ✓ Radial falloff (distance-based magnitude)

**Not Tested** (catalogued non-issues per brief):
- Audio/volume (chargeVolumeMap, explodeVolume, sounds)
- Presentational (charge wobble, rotation, layerZ, speech color)
- Game-balance tuning (damage speed, maxEnergy, collideWithTarget)
- Attack metadata (cooldown rate, dieSound, miniMapStatus, chargeOffsetSide #top-only)
