# Behavioral Parity Audit: cBlast

## Overview
cBlast is a player spell scroll (#objScroll) with a charged-blast attack (#animType #magic). The spell grows while charging, flies to the aim point on release, and explodes radially at the landing location. This audit verifies the grow→fly→explode lifecycle and charge scaling against the original Lingo implementation.

## Data Comparison

| Field | Original (casts/data/act_cBlast.txt) | Port (port/src/generated/data.json) | Default (STRUCT_ATTACK) | Status |
|-------|--------------------------------------|-------------------------------------|------------------------|--------|
| #objType | #objScroll | #objScroll | — | ✓ |
| #animType | #magic | #magic | #none | ✓ |
| #chargeSpeed | 0.1 | 0.1 | 1 | ✓ |
| #chargeStart | 0 | 0 | 1 | ✓ |
| #chargeMax | 999 | 999 | 5 | ✓ |
| #chargeMaxBasic | 999 | 999 | 0 | ✓ |
| #chargeMaxModifier | 0 | 0 | 1 | ✓ |
| #power | 0.5 | 0.5 | point(5,-1) | ✓ |
| #chargeColour | rgb(255,200,0) | {r:255,g:200,b:0} | white | ✓ |
| #chargeSize | (not defined) | (not defined) | 1 | ✓ Applied via default |
| #chargeExplodeFactor | (not defined) | (not defined) | 4 | ✓ Applied via default |
| #releaseFunction | (not defined) | (not defined) | #release | ✓ Applied via default |
| #explodeFunction | (not defined) | (not defined) | #none | ✓ Applied via default |
| #payloadFunction | (not defined) | (not defined) | [#takeHit] | ✓ Applied via default |
| #explodeSound | "spell_explode" | "spell_explode" | #none | ✓ |
| #releaseSound | "spell_release" | "spell_release" | #none | ✓ |
| #spellSpeed | 20 | 20 | 2 | ✓ |
| #cooldown | 30 | 30 | 0 | ✓ |
| #randomSummon | false | false | false | ✓ |
| #limitMagic | false | false | false | ✓ |

## Charge Lifecycle Verification

### 1. Charge Phase (port/src/components/control.ts, port/src/components/spellActor.ts)
- **Original**: objSpell.charge(amount, chargeLoc) sets pCurrentCharge and calls align() to position over caster's head
- **Port**: SpellActor.setCharge(amount, casterX, casterY) sets this.charge and positions via #top offset (point(0, -size/2))
- **chargeSize Calculation**: size() = charge × chargeSize (default 1)
- **Status**: ✓ CLEAN — Both grow over the caster's head with size = charge·chargeSize

### 2. Release Phase (casts/script_objects/objSpell.txt:235-248, port/src/components/spellActor.ts:88-97)
- **Original**: releaseNormal(targetLoc, speed) calls moveToTarget() to fly toward the aim point
- **Port**: release(targetX, targetY, speed) sets mode="fly" and computes direction vector
- **Default releaseFunction**: #release (the spell flies on release; not #fireBullets streaming)
- **Status**: ✓ CLEAN — Both fly to the target location at the specified speed

### 3. Explode Phase (casts/script_objects/objSpell.txt:145-161, port/src/components/spellActor.ts:117-147)
- **Original**: goMode(#explode) applies `pCurrentCharge ·= chargeExplodeFactor` (line 152)
- **Port**: explode() applies `grown = this.charge * this.attack.chargeExplodeFactor` (line 121)
- **Radial Hit Resolution**:
  - **Original**: teamMaster.impactAttack(me) with calcAttackHitMagic disc test: dist < (myRadius+targetRadius)²
  - **Port**: resolveSplash() with explode=true, radius = explodeCharge/2, disc test: dist² < (radius+TARGET_RADIUS)²
  - Both use (hitRange−dist)·power for the collision vector magnitude (calcCollisionVectSpell/radial falloff)
- **Payload**: Both run payloadFunction (#takeHit by default, scaling via SPELL_RADIAL_SCALE in port)
- **Status**: ✓ CLEAN — Both grow charge by chargeExplodeFactor and resolve radial damage

## Charge Scaling Parameters (charge.ts)

| Parameter | Formula (Original: calcAttackChargeMax) | Formula (Port: chargeMaxOf) | Match |
|-----------|----------------------------------------|-------------------------------|-------|
| chargeMax | min(attack.chargeMax, capacity·chargeMaxModifier + chargeMaxBasic) | min(attack.chargeMax, mana.capacity·chargeMaxModifier + chargeMaxBasic) | ✓ |
| chargeStart | min(chargeStart + burst, chargeMax) | min(chargeStart, cap) (K11: burst discarded) | ✓ |
| chargeSpeed | chargeSpeed·flow (capped by chargeSpeedMax) | chargeSpeed·flow (capped by chargeSpeedMax) | ✓ |

For energyBlast (cBlast):
- **Original**: chargeMax = min(999, 10·0 + 999) = 999 (no mana modifier, flat max)
- **Port**: chargeMax = min(999, capacity·0 + 999) = 999 (same)
- **Original**: chargeStart = min(0 + burst, 999) → overwrites to min(0, #none) = 0
- **Port**: chargeStart = min(0, ∞) = 0 (K11 faithful: burst is discarded)
- **Status**: ✓ CLEAN — Both compute identical charge ceilings and starting charges

## Implementation Verification

### Port: Charge Defaults via STRUCT_ATTACK (port/src/data/registry.ts:19-34)
```typescript
chargeExplodeFactor: 4,     // line 21
chargeSize: 1,              // line 22
releaseFunction: "#release" // line 30
payloadFunction: ["#takeHit"] // line 28
explodeFunction: "#none"    // line 26
```

### Port: resolveAttack() Application (port/src/components/weapon.ts:188-189, 207, 210)
- chargeSize: `numOr(r["chargeSize"], d["chargeSize"] as number)` → defaults to 1
- chargeExplodeFactor: `numOr(r["chargeExplodeFactor"], d["chargeExplodeFactor"] as number)` → defaults to 4
- payloadFunction: `normPayload(r["payloadFunction"] ?? d["payloadFunction"])` → defaults to ["takeHit"]
- explodeFunction: `strOr(r["explodeFunction"], d["explodeFunction"] as string)` → defaults to "#none"

All are correctly applied via fallback to STRUCT_ATTACK when not present in the actor's data.

### Port: SpellActor Usage (port/src/components/spellActor.ts)
- **Line 79**: `size(): number { return this.charge * this.attack.chargeSize; }`
- **Line 121**: `const grown = this.charge * this.attack.chargeExplodeFactor;`
- **Line 126-130**: Explode function dispatch (cBlast uses #none, so no summon)
- **Line 144**: `resolveSplash(this.entity, explodeAttack, m.x, m.y, this.ownerId, this.hits, this.allegiance);`

All critical fields are used correctly.

### Original: Lingo Usage
- **objSpell.txt:111**: `return pCurrentCharge * me.getAttack().chargeSize`
- **objSpell.txt:152**: `pCurrentCharge = pCurrentCharge * attack.chargeExplodeFactor`
- **objSpell.txt:148-158**: explodeFunction dispatch and radial hit (impactAttack)

## Conclusion

cBlast exhibits **full behavioral parity**. The charge→grow→fly→explode lifecycle is faithfully implemented in both codebases:

1. **Charge parameters** (chargeMax, chargeStart, chargeSpeed) compute identically
2. **Grow physics** use chargeSize (default 1) to scale the orb size during charging
3. **Flight path** is deterministic (fly to aim point at spellSpeed/3)
4. **Explode scaling** multiplies charge by chargeExplodeFactor (default 4) before radial damage resolution
5. **Radial hit detection** uses the grown charge as the radius source
6. **Payload** defaults to takeHit damage, applied via radial falloff formula

Default values (chargeSize, chargeExplodeFactor, releaseFunction, payloadFunction, explodeFunction) are absent from the generated data.json because they match the STRUCT_ATTACK schema defaults. The port's registry.ts and weapon.ts correctly apply these defaults via resolveAttack() at runtime. No missing or incorrect behavior detected.

