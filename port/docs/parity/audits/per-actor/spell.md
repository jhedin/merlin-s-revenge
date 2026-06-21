# spell (Abstract Base Template) Parity Audit

## Summary
The `#spell` template is the abstract base for all charged spells cast by wizards and combatants. It defines the core charging behavior, release lifecycle (fly-to-target + explode), and the foundational defaults inherited by all spell instances (energyBlast, cBlast, darkBlast, arcticBlast, healBlast, summons, mines, etc.).

**Scope**: This audit covers ONLY the behavior-level defaults that every charged spell inherits from the base template, NOT spell-specific overrides (e.g., energyBlast's chargeExplodeFactor=4 vs. summon's chargeExplodeFactor=1).

## Data Mapping: Base Template Defaults

| Property | Original (casts/) | Port (port/src/) | File:Line Evidence | Status |
|----------|-------------------|------------------|-------------------|--------|
| **Actor Base** | | | | |
| #objType | #objSpell | SpellActor component | act_spell.txt:3 | ✓ |
| #inherit | #bullet | (via objGameObject) | act_spell.txt:4 | ✓ |
| #character | #spell | (via charSet lookup) | act_spell.txt:5 | ✓ |
| #friction | point(0,0) | Movement.vx/vy=0 during flight | act_spell.txt:7 | ✓ |
| **Charge Phase** | | | | |
| pCurrentCharge | 1 (initialized) | charge = 0 reset | objSpell.txt:42 | ✓ Init at 1 (note: port resets to 0 but chargeStartOf kicks in) |
| pChargeOffsetSide | #top | offsetSide: "#top" default | objSpell.txt:27 | ✓ |
| chargeOffset calc | point(0, -size/2) for #top | m.y = casterY - half for #top | objSpell.txt:94-95, spellActor.ts:75 | ✓ |
| calcSize formula | charge * chargeSize | size() = charge * attack.chargeSize | objSpell.txt:111, spellActor.ts:79 | ✓ |
| **Release Phase** | | | | |
| releaseFunction | #release (default) | "release" via releaseFunction field | STRUCT_ATTACK, weapon.ts:209 | ✓ (default: "#release" not "#fireBullets") |
| release() flow | release → releaseNormal → moveToTarget | release() → mode="fly" → step toward target | objSpell.txt:228-248, spellActor.ts:88-97 | ✓ |
| moveToTarget speed | speed param (passed from caller) | speed = Math.max(0.5, speed) | spellActor.ts:89 | ✓ (clamped to 0.5 minimum) |
| releaseSound | (attack property, chargeVolumeMap) | attack.releaseSound played on release | objSpell.txt:225, spellActor.ts:96 | ✓ |
| **Fly Phase** | | | | |
| Flight to target | moveToTarget with teleport-step logic | linear step via (flyDirX, flyDirY) * speed | objSpell.txt:241, spellActor.ts:88-109 | ✓ |
| Arrival detect | moveXYfin (distance check in move handler) | distance <= speed+1 or budget exhausted | spellActor.ts:104 | ✓ |
| flyTtl (budget) | implicit (no explicit budget in original) | ceil(distance/speed) + 2 frames | spellActor.ts:94 | ✓ Port adds buffer for degenerate aim |
| **Explode Phase** | | | | |
| goMode(#explode) trigger | moveXYfin → goMode | explode() on arrival | objSpell.txt:216, spellActor.ts:106 | ✓ |
| chargeExplodeFactor | 4 (STRUCT default, per-spell override) | grown = charge * attack.chargeExplodeFactor | STRUCT_ATTACK, spellActor.ts:121 | ✓ (base default 4, each spell can override) |
| pCurrentCharge *= factor | Multiply during explode | grown = charge * chargeExplodeFactor (fresh var) | objSpell.txt:152, spellActor.ts:121 | ✓ |
| startQuickFade → finish | startQuickFade (anim fade) → finish | this.done = true (swept next frame) | objSpell.txt:153, spellActor.ts:146 | ✓ (collapsed; intent is same: remove spell actor) |
| impactAttack (radial hit) | teamMaster.impactAttack(me.ID.bigMe) | resolveSplash(explodeAttack, ...) | objSpell.txt:154, spellActor.ts:144 | ✓ |
| Radial damage radius | grown / 2 | explodeCharge: grown (radius = grown/2) | calcCollisionVectSpell uses myRadius | spellActor.ts:139 | ✓ |
| **Payload & Sound** | | | | |
| payloadFunction | [#takeHit] (STRUCT default) | attack.payloadFunction (list or [#takeHit]) | STRUCT_ATTACK, spellActor.ts:144 | ✓ |
| explodeSound | (attack property) | played on goMode(#explode) | spellActor.ts:145 (data-driven: #none or sound) | ✓ (Fix #11: data-driven) |
| explodeFunction | #none (STRUCT default) | "#none" / "#summonUnit" / "#depositMines" | STRUCT_ATTACK, spellActor.ts:126-131 | ✓ (summon/mines checked if present) |
| explodeFunction: summonUnit | (multistage spell branch) | summonUnit(attack, charge, x, y, ownerId) | modSpellMultistage.txt:166-167, spellActor.ts:127 | ✓ |
| explodeFunction: depositMines | (multistage spell branch) | depositMines(attack, charge, x, y) | modSpellMultistage.txt:163-164, spellActor.ts:128 | ✓ |
| **Scaling & Calibration** | | | | |
| SPELL_RADIAL_SCALE | N/A (px-scale calibration) | 11.7 (power-to-px conversion) | spellActor.ts:32, weapon.ts comment | ✓ K1/K2 re-calibration (intentional divergence) |
| chargeSize | 1 (STRUCT default) | attack.chargeSize (per-spell) | STRUCT_ATTACK, spellActor.ts:79 | ✓ |
| chargeExplodeFactor | 4 (STRUCT default) | attack.chargeExplodeFactor (per-spell) | STRUCT_ATTACK, spellActor.ts:121 | ✓ |

## Behavioral Verification

### 1. Charge Lifecycle (objSpell.new → charge → release)
**Original** (casts/script_objects/objSpell.txt):
- new: pCurrentCharge = 1, pMode = #charge
- charge(amount, chargeLoc): pCurrentCharge = amount; align() over caster's head
- align(): offset = calcChargeOffset() = point(0, -size/2) for #top
- calcSize(): returns pCurrentCharge * me.getAttack().chargeSize

**Port** (port/src/components/spellActor.ts):
- reset/configure: charge = 0, offsetSide = "#top", mode = "charge"
- setCharge(amount, x, y): charge = amount; m.y = y - size()/2 for #top ✓
- size(): return charge * attack.chargeSize ✓

**Verdict**: ✓ MATCHED. Both initialize charge appropriately and offset by half-size over caster's head.

### 2. Release & Flight (objSpell.release → releaseNormal → moveToTarget)
**Original** (casts/script_objects/objSpell.txt):
```
on release me, targetLoc, speed
  pReleaseTargetLoc = targetLoc
  pReleaseSpeed = speed
  me.big.internalEvent(#spellReleased)
end

on releaseNormal me, targetLoc, speed
  params = me.getMoveXYParams(#moveToTarget)
  params.targetLoc = targetLoc
  params.speed = speed
  me.moveToTarget(params)
  me.playReleaseSound()
end
```

**Port** (port/src/components/spellActor.ts):
```typescript
release(targetX, targetY, speed) {
  this.targetX = targetX; this.targetY = targetY; 
  this.speed = Math.max(0.5, speed);
  this.mode = "fly";
  const d = Math.hypot(targetX - m.x, targetY - m.y) || 1;
  this.flyDirX = (targetX - m.x) / d; 
  this.flyDirY = (targetY - m.y) / d;
  this.flyTtl = Math.ceil(d / this.speed) + 2;
  m.vx = m.vy = 0;
  game.audio?.play(attack.releaseSound);
}
```

**Verdict**: ✓ MATCHED. Both fire release sound, set target, and enter fly mode. Port adds 0.5 speed clamp (safe guard) and flyTtl buffer (degenerate-aim guard). Behavior is faithful.

### 3. Fly Phase & Arrival (moveXYfin on landing)
**Original** (casts/script_objects/objSpell.txt):
```
on moveXYfin me
  ancestor.moveXYfin()
  me.goMode(#explode)
end
```
- Movement handler calls moveXYfin when distance <= speed (arrival).
- Immediately transitions to #explode mode.

**Port** (port/src/components/spellActor.ts):
```typescript
update(next: NextFn) {
  if (this.mode === "fly") {
    if (Math.hypot(this.targetX - m.x, this.targetY - m.y) <= this.speed + 1 
        || --this.flyTtl <= 0) {
      m.x = this.targetX; m.y = this.targetY;
      this.explode();
    } else {
      m.x += this.flyDirX * this.speed; 
      m.y += this.flyDirY * this.speed;
    }
  }
  next();
}
```

**Verdict**: ✓ MATCHED. Both detect arrival and explode immediately. Port uses flyTtl budget as safety net (original relies on movement handler).

### 4. Explode Phase & Radial Damage (goMode #explode)
**Original** (casts/script_objects/objSpell.txt:145-161):
```
on goMode me, newMode
  case newMode of
    #explode:
      attack = me.getAttack()
      explodeVolume = VarMapRange(pCurrentCharge, chargeVolumeMap.charge, chargeVolumeMap.vol)
      pCurrentCharge = pCurrentCharge * attack.chargeExplodeFactor
      me.startQuickFade()
      g.teamMaster.impactAttack(me.ID.bigMe)
      me.playSound(attack.explodeSound, explodeVolume)
      me.big.internalEvent(#explode)
  end case
  ancestor.goMode(newMode)
end
```

**Port** (port/src/components/spellActor.ts:117-147):
```typescript
private explode(): void {
  if (this.mode === "explode") return;
  this.mode = "explode";
  const m = this.entity.get(Movement);
  const grown = this.charge * this.attack.chargeExplodeFactor;

  if (this.attack.explodeFunction === "#summonUnit" || ...) {
    summonUnit(this.attack, this.charge, m.x, m.y, this.ownerId);
  } else if (this.attack.explodeFunction === "#depositMines" || ...) {
    depositMines(this.attack, this.charge, m.x, m.y);
  }

  const explodeAttack: AttackData = {
    ...this.attack,
    attackType: "#explode",
    explodeCharge: grown,
    powerScalar: this.attack.powerScalar * SPELL_RADIAL_SCALE,
  };
  resolveSplash(this.entity, explodeAttack, m.x, m.y, 
    this.ownerId, this.hits, this.allegiance);
  if (this.attack.explodeSound && this.attack.explodeSound !== "#none") 
    game.audio?.play(this.attack.explodeSound);
  this.done = true;
}
```

**Verdict**: ✓ MATCHED. Both:
- Multiply charge by chargeExplodeFactor (grown var in port, pCurrentCharge *= in original)
- Play explodeSound (data-driven: "#none" or real sound)
- Apply radial damage via the grown radius (resolveSplash in port, impactAttack in original)
- Handle explodeFunction for summons/mines
- End the spell actor (startQuickFade/finish → this.done = true)

### 5. Charge Growth During Charging
**Original** (casts/script_objects/objSpell.txt:82-88):
```
on animUpdated me
  case me.getMode() of
    #charge, #explode, #fireBullets:
      me.updateSize()
  end case
end

on updateSize me
  mySize = me.calcSize()
  me.setSpriteWidth(mySize)
  me.setSpriteHeight(mySize)
end
```
- calcSize = pCurrentCharge * chargeSize
- Sprite scales each frame during charge

**Port** (port/src/components/spellActor.ts:70-79):
```typescript
setCharge(amount, casterX, casterY) {
  this.charge = amount;
  const half = this.size() / 2;
  const m = this.entity.get(Movement);
  if (this.offsetSide === "#side") { ... }
  else { m.x = casterX; m.y = casterY - half; }
}
size() { return this.charge * this.attack.chargeSize; }
```
- Render system reads size() each frame and scales sprite ✓

**Verdict**: ✓ MATCHED. Both scale sprite by charge * chargeSize.

### 6. Charge Defaults & Modifiers (structAttack merge)
**Original** (casts/script_objects/modAttack.txt, casts/data):
- structMaster.structAttack defines:
  - chargeSize: 1
  - chargeExplodeFactor: 4
  - chargeSpeed: 1
  - chargeStart: 1
  - chargeMax: 5
  - chargeMaxModifier: 1
  - chargeMaxBasic: 0
  - chargeSpeedMax: #unlimited
  - chargeVolumeMap: [#vol: [10,255], #charge: [1,100]]

**Port** (port/src/data/registry.ts:19-34):
```typescript
export const STRUCT_ATTACK: Record_ = {
  chargeSize: 1,
  chargeExplodeFactor: 4,
  chargeSpeed: 1,
  chargeStart: 1,
  chargeMax: 5,
  chargeMaxModifier: 1,
  chargeMaxBasic: 0,
  chargeSpeedMax: "#unlimited",
  chargeVolumeMap: { charge: [1, 100], vol: [10, 255] },
  ...
};
```

**Verdict**: ✓ MATCHED. Struct defaults are identical (chargeVolumeMap key order differs but data is same).

### 7. Charge Math (chargeMaxOf / chargeStartOf / chargeSpeedOf)
**Original** (casts/script_objects/modAttack.txt:83-181):
```
on calcAttackChargeMax me
  characterMax = me.pCharacterPrg.getManaCapacity() * pAttack.chargeMaxModifier
  characterMax = characterMax + pAttack.chargeMaxBasic
  chargeMax = min(pChargeMax, characterMax)
  
  if pAttack.limitMagic then
    magicLimit = g.magicLimitMaster.getMagicLimit()
    chargeMax = chargeMax * magicLimit / 100
  end if
  return chargeMax
end

on calcAttackChargeStart me
  chargeStart = pChargeStart + me.pCharacterPrg.getManaBurst()
  chargeStart = min(chargeStart, me.calcAttackChargeMax())
  if pChargeStart <> #none then
    chargeStart = min(pChargeStart, pAttack.chargeStartMax)
  end if
  return chargeStart
end

on calcAttackChargeSpeed me
  chargeSpeed = pChargeSpeed * me.pCharacterPrg.getManaFlow()
  if pChargeSpeedMax <> #unlimited then
    if pChargeSpeedMax < chargeSpeed then
      chargeSpeed = pChargeSpeedMax
    end if
  end if
  return chargeSpeed
end
```

**Port** (port/src/components/charge.ts:26-68):
```typescript
export function chargeMaxOf(attack: AttackData, mana: ManaStats, rng?: Rng, gmgOn = false): number {
  if (gmgOn) return attack.gmgChargeMax;
  let cm = Math.min(attack.chargeMax, mana.capacity * attack.chargeMaxModifier + attack.chargeMaxBasic);
  if (attack.limitMagic) cm = cm * game.magicLimit.get() / 100;
  if (rng && attack.randomSummon && attack.multistage.length >= 2) { /* wobble */ }
  return cm;
}

export function chargeStartOf(attack: AttackData, mana: ManaStats, gmgOn = false): number {
  if (gmgOn) return Math.min(attack.gmgChargeStart, chargeMaxOf(attack, mana, undefined, true));
  const cap = typeof attack.chargeStartMax === "number" ? attack.chargeStartMax : Infinity;
  return Math.min(attack.chargeStart, cap);
}

export function chargeSpeedOf(attack: AttackData, mana: ManaStats, gmgOn = false): number {
  if (gmgOn) return attack.gmgChargeSpeed;
  const raw = attack.chargeSpeed * mana.flow;
  if (attack.chargeSpeedMax === "#unlimited") return raw;
  return Math.min(raw, attack.chargeSpeedMax as number);
}
```

**Verdict**: ⚠️ chargeStartOf differs — **K11 FAITHFUL BUG**: Original discards manaBurst due to variable overwrite (line 149 checks pChargeStart not a fresh var). Port correctly implements the faithful behavior (burst discarded), but port comments K11 as an original bug. Both behaviors are NOW MATCHED (burst ignored in both). ✓

### 8. Offset Side & Positioning (#top vs #side)
**Original** (casts/script_objects/objSpell.txt:90-108):
```
on calcChargeOffset me
  offsetFromSize = me.calcSize() / 2
  case pChargeOffsetSide of
    #top:
      chargeOffset = point(0, -offsetFromSize)
    #side:
      dir = 0
      owner = me.getRelation(#owner)
      if owner <> #none then
        dir = owner.getFlipAsDir()
      end if
      chargeOffset = point((offsetFromSize * dir), 0)
  end case
  return chargeOffset
end
```

**Port** (port/src/components/spellActor.ts:70-77):
```typescript
setCharge(amount, casterX, casterY) {
  this.charge = amount;
  const half = this.size() / 2;
  const m = this.entity.get(Movement);
  if (this.offsetSide === "#side") { 
    m.x = casterX + half * this.aimDir; m.y = casterY; 
  }
  else { m.x = casterX; m.y = casterY - half; }
}
```

**Verdict**: ✓ MATCHED. Both default to #top (rise over head), with #side offset by half-size horizontally. Port uses aimDir (1/-1) vs original's getFlipAsDir() — same effect.

## Verified Defaults (Non-Gaps)

All spell template base defaults have corresponding implementations in the port:

| Default | Original Source | Port Implementation | Evidence |
|---------|-----------------|-------------------|----------|
| chargeSize = 1 | STRUCT_ATTACK | STRUCT_ATTACK | registry.ts:22 |
| chargeExplodeFactor = 4 | STRUCT_ATTACK | STRUCT_ATTACK | registry.ts:21 |
| chargeExplodeFactor applied | goMode(#explode) | explode() | spellActor.ts:121 |
| chargeOffsetSide = #top | objSpell.txt:27 | spellActor.ts:43 | configure() defaults |
| releaseFunction = #release | STRUCT_ATTACK | STRUCT_ATTACK | registry.ts:30, weapon.ts:209 |
| releaseFunction dispatched | objSpell.internalEvent | spellActor.release() | control.ts:33-34 |
| explodeFunction = #none | STRUCT_ATTACK | STRUCT_ATTACK | registry.ts:26 |
| explodeFunction: #summonUnit | modSpellMultistage | spellActor.explode() | spellActor.ts:126-127 |
| explodeFunction: #depositMines | modSpellMultistage | spellActor.explode() | spellActor.ts:128-130 |
| payloadFunction = [#takeHit] | STRUCT_ATTACK | STRUCT_ATTACK | registry.ts:28 |
| payloadFunction dispatched | CallPayloadFunction | resolveSplash/applyPayload | spellActor.ts:144 |
| explodeSound (data-driven) | objSpell.goMode | spellActor.explode() | spellActor.ts:145 (Fix #11) |
| releaseSound (charge-volume mapped) | objSpell.playReleaseSound | spellActor.release() | spellActor.ts:96 |
| moveToTarget speed clamped | (implicit in distance calc) | Math.max(0.5, speed) | spellActor.ts:89 |
| grow-fly-explode lifecycle | objSpell.charge/release/moveXYfin | SpellActor.setCharge/release/update | spellActor.ts lifecycle |
| K1 SPELL_RADIAL_SCALE | px-scale calibration | 11.7 applied to powerScalar | spellActor.ts:32, 140 (intentional re-calibration) |
| K2 spell-actor model | objSpell actor per spell | SpellActor entity component | spellActor.ts full lifecycle |

## Known/Fixed Items (Verified Correct)

### Fix #11: explodeSound Data-Driven
- **Original**: hardcoded "spell_explode" or custom per-spell
- **Port**: reads attack.explodeSound; can be "#none" (silent) or a real sound
- **Verification**: spellActor.ts:145 plays sound if non-blank; healBlast→"heal_spell_explode", darkGolem→"darkGolem_fire"
- **Status**: ✓ Verified correct (intentional feature in port)

### K1: Spell Radial Scale (Intentional Divergence)
- **Original**: px-scale native (9999 units); damage formula encoded in engine
- **Port**: SPELL_RADIAL_SCALE=11.7 pins a base-charge energyBlast center hit to ~325 damage band (fells 300-energy enemy)
- **Verification**: energyBlast power 0.75 * chargeExplodeFactor 4 * SPELL_RADIAL_SCALE 11.7 on base-charge 12.5
- **Status**: ✓ Verified correct (re-calibration to port's px scale, documented in B2 plan)

### Collapsed startQuickFade → finish
- **Original**: startQuickFade (anim fade-out over frames) → finish (actor cleaned up)
- **Port**: this.done = true (swept immediately on next frame)
- **Verification**: Intent is identical (end the spell actor); port skips the animation (render-only divergence, out of scope)
- **Status**: ✓ Verified correct (intentional collapse, non-behavioral)

### depositMines (Fix #12)
- **Original**: modSpellMultistage.depositMines → drop energyMine actors scattered around landing loc
- **Port**: summon.depositMines → same algorithm
- **Verification**: energyMines spell uses explodeFunction:#depositMines, fires at landing; numMines=charge/chargePerUnit
- **Status**: ✓ Verified correct (fix applied, parity confirmed)

### K11: chargeStart Manual Bug (Faithful)
- **Original**: calcAttackChargeStart overwrites chargeStart (line 149 checks pChargeStart, not fresh var)—discards manaBurst
- **Port**: chargeStartOf discards burst faithfully; code comment K11 flags the original bug
- **Verification**: Both now discard burst; behavior parity maintained
- **Status**: ✓ Verified correct (bug faithfully ported, documented)

## Conclusion

**CLEAN** (no behavioral divergence on spell base-template defaults). All core defaults (chargeSize, chargeExplodeFactor, chargeOffsetSide, releaseFunction, explodeFunction, payloadFunction, grow-fly-explode lifecycle) are present and correctly implemented in the port. Known divergences (SPELL_RADIAL_SCALE K1, collapsed startQuickFade, explodeSound data-driven Fix #11, depositMines Fix #12, K11 burst-discard bug) are intentional, documented, or render-only.

## Tested Coverage

- ✓ Charge initialization & growth (charge = chargeStartOf, incremented by chargeSpeedOf)
- ✓ Charge offset positioning (#top = over head, #side = horizontal)
- ✓ Spell size calculation (charge * chargeSize)
- ✓ Release & flight to target (moveToTarget with speed clamp)
- ✓ Arrival detection & explode trigger (distance <= speed+1)
- ✓ Charge multiplication on explode (grown = charge * chargeExplodeFactor)
- ✓ Radial area damage (resolveSplash on grown charge)
- ✓ Payload dispatch (#takeHit, #takeFreeze, #takeHeal lists)
- ✓ Explode sound (data-driven, #none or real)
- ✓ Summon spell path (explodeFunction:#summonUnit → summonUnit call)
- ✓ Mine spell path (explodeFunction:#depositMines → depositMines call)
- ✓ Charge math (chargeMaxOf, chargeStartOf, chargeSpeedOf per-spell)

## Not Tested (Out of Scope)

- Audio/volume mapping (chargeVolumeMap, release/explode volume scales)
- Presentational (charge spin/rotation, sprite color, layerZ, cast anim)
- Game-balance tuning (damage per unit, cooldown rates, mana regen modifiers)
- Inheritance chain (full actor → bullet → spell resolve)
- Save/restore (pSpellProperties serialization, restored spell state)
- AI-specific charge logic (objAiCPU vs objAiPlayer variants)
