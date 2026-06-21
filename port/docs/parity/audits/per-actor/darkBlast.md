# darkBlast Behavioral Parity Audit

## Summary

darkBlast is a **player spell scroll** (objType #objScroll, AiType #objAiPowerUp) that implements the **grow-fly-explode** lifecycle:
1. **Charge phase**: spell actor grows over caster's head (charge·chargeSize = charge·1px)
2. **Release phase**: spell flies to target at spellSpeed (20px/frame → 6.67px/frame in port)
3. **Explode phase**: radial damage resolves at landing location (radius = charge·chargeExplodeFactor/2 = charge·2px)

| Aspect | Lingo (casts/) | Port (port/src) | Status |
|--------|---|---|---|
| **Spell Actor Lifecycle** | objSpell.txt charge→release→explode | SpellActor.ts setCharge→release→explode | ✓ IMPLEMENTED |
| **Charge Growth** | size = charge·chargeSize | SpellActor.size() = charge·chargeSize | ✓ CORRECT |
| **Charge Scaling Params** | chargeSpeed=1, chargeStart=5, chargeMax=999, chargeMaxBasic=10, chargeMaxModifier=0.5 | charge.ts chargeMaxOf/chargeStartOf/chargeSpeedOf | ✓ CORRECT |
| **Explode Radius** | grown = charge·chargeExplodeFactor (4) | SpellActor.explode() grown=charge·chargeExplodeFactor | ✓ CORRECT |
| **Radial Damage** | resolveSplash #explode via radius+targetRadius hit-box | splash.ts resolveSplash() explode path | ✓ IMPLEMENTED |
| **Charge Colour** | rgb(0,0,0) — black | chargeColour {r:0, g:0, b:0} | ✓ CORRECT |
| **Power** | power: 3 (used for damage scale) | powerScalar: 3 | ✓ CORRECT |
| **Release Sound** | "spell_release" | attack.releaseSound | ✓ CORRECT |
| **Explode Sound** | "spell_explode" | attack.explodeSound | ✓ CORRECT |
| **Payload** | [#takeHit] (default struct) | payloadFunction defaults to ["#takeHit"] | ✓ CORRECT |
| **Release Function** | #release (default struct) | releaseFunction defaults to "#release" | ✓ CORRECT |
| **Explode Function** | #none (default struct) | explodeFunction defaults to "#none" | ✓ CORRECT |

## Detailed Verification

### Data Layer (Lingo → Port)

**casts/data/act_darkBlast.txt** defines the scroll's attack:
```
#chargeSpeed: 1,
#chargeStart: 5,
#chargeMax: 999,
#chargeMaxBasic: 10,
#chargeMaxModifier: 0.5,
#power: 3,
#releaseSound: "spell_release",
#explodeSound: "spell_explode",
```

**port/src/generated/data.json** (act_darkBlast.data.attack):
- All explicit params match (chargeSpeed=1, power=3, etc.)
- Missing params (chargeSize, chargeExplodeFactor, payloadFunction, releaseFunction, explodeFunction) correctly inherit from **STRUCT_ATTACK** defaults (registry.ts:18–34):
  - chargeSize: 1 ✓
  - chargeExplodeFactor: 4 ✓
  - payloadFunction: ["#takeHit"] ✓
  - releaseFunction: "#release" ✓
  - explodeFunction: "#none" ✓

### Charge Calculation (port/src/components/charge.ts)

**casts/script_objects/modAttack.txt:83–119** (calcAttackChargeMax/Start/Speed)

**port/src/components/charge.ts** implements:
- `chargeMaxOf()`: min(attack.chargeMax, capacity·chargeMaxModifier+chargeMaxBasic) = min(999, 10·0.5+10) = 15 ✓
- `chargeStartOf()`: min(attack.chargeStart, chargeStartMax) = min(5, ∞) = 5 ✓
- `chargeSpeedOf()`: chargeSpeed·flow = 1·1 = 1 px/frame ✓

### Spell Actor Lifecycle (port/src/components/spellActor.ts)

**casts/script_objects/objSpell.txt:114–121** (charge)  
→ **SpellActor.setCharge()** (70–77): positions orb at (casterX, casterY − size/2) ✓

**casts/script_objects/objSpell.txt:228–248** (release → releaseNormal)  
→ **SpellActor.release()** (88–97): computes fly direction, sets TTL budget ✓

**casts/script_objects/objSpell.txt:214–217** (moveXYfin)  
→ **SpellActor.update()** (99–112): flies toward target, triggers explode on arrival ✓

**casts/script_objects/objSpell.txt:145–161** (goMode #explode)  
→ **SpellActor.explode()** (117–147):
- Grows charge: `grown = charge·chargeExplodeFactor` (4) ✓
- Resolves radial hit via `resolveSplash()` ✓
- Plays explodeSound ✓
- Marks done (swept on next cycle) ✓

### Radial Damage Resolution (port/src/components/splash.ts)

**casts/script_objects/modSplashDamage.txt** + radial branch  
→ **splash.ts:resolveSplash()** (49–78):
- Attack type = "#explode" (from spellActor.explode line 138)
- Radius = explodeCharge/2 = grown/2 = (charge·4)/2 = charge·2 ✓
- Hit disc via `impactAreaAttack()` (centre falloff: (hitRange−dist)·power)
- Applies payload via `applyPayload()` (takeHit → victim.takeHit) ✓

### Integration Tests (PlayerControl → SpellActor → resolveSplash)

**casts/script_objects/objAiAttack.txt** (castMagic/releaseMagic)  
→ **control.ts:castMagic()** (224–250):
1. Ensures spell actor exists (ensureSpell)
2. Sets final charge (setCharge)
3. Releases at aim point (release) — flies at spellSpeed/3 ≈ 6.67 px/frame ✓
4. Spell arrives → explode() → resolveSplash() with grown radius ✓

## Conclusion

**darkBlast exhibits CLEAN behavioral parity.** All charge parameters, grow-fly-explode lifecycle steps, radial damage, and payload resolution match the original Lingo implementation. Missing explicit fields correctly inherit struct defaults. No behavioral divergences detected.
