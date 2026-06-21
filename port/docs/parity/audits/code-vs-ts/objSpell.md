# objSpell.txt → SpellActor TypeScript Audit

## Executive Summary
Comprehensive handler-by-handler comparison of **objSpell.txt** (K2 spell actor lifecycle) against **port/src/components/spellActor.ts** and related systems (control.ts, summon.ts, splash.ts, spells.ts). 

**CRITICAL GAP FOUND**: Spells do not pass through terrain per the original design. Missing `passThrough: true` in spell spawn.

---

## Handler Map: objSpell → TypeScript

### 1. **new/init** (lines 17–50)
**Lingo:**
- `new me`: Ancestor = objGameObject; add modules modAnimSet, modAttack, modFader, modFireBullets, modSpellMultiStage
- `init`: pCurrentCharge = 1; pMode = #charge; pReleaseSpeed = 1; pReleaseTargetLoc = point(0,0)

**TypeScript Equivalent:**
- **SpellActor** (spellActor.ts:34–66) + **SpellArchetype** (entities/spell.ts:9–12)
  - Reset() lines 50–54: charge=0, mode='charge', aimDir=1, offsetSide='#top'
  - configure() lines 62–66: sets attack, ownerId, team, hits, allegiance
- **spawnSpell()** (systems/spells.ts:18–28): acquires pooled spell, calls build() with friction=1, accel=0, walkSpeed=999, box=6

**Parity:** ✓ FAITHFUL — charge/mode initialization matches; modules collapsed into single SpellActor component + summon.ts/splash.ts for specialized functions.

---

### 2. **charge()** (lines 114–121)
**Lingo:**
```
on charge me, chargeAmount, chargeLoc
  pCurrentCharge = chargeAmount
  me.align(chargeLoc)
  me.internalEvent(#charge)
```

**TypeScript Equivalent:**
- **SpellActor.setCharge()** (spellActor.ts:70–77):
  - `charge = amount`
  - Aligns orb over caster via #top (point(0, −size/2)) or #side (±size/2 by aimDir)
  - Sets m.vx = m.vy = 0 (no initial velocity)

**Parity:** ✓ FAITHFUL — charge amount and position alignment identical. #internalEvent dispatched later via control.ts trigger (spells.ts pool + control.ts ensureSpell).

---

### 3. **calcSize()** (lines 110–112)
**Lingo:**
```
on calcSize me
  return pCurrentCharge * me.getAttack().chargeSize
```

**TypeScript Equivalent:**
- **SpellActor.size()** (spellActor.ts:79):
  ```typescript
  return this.charge * this.attack.chargeSize;
  ```

**Parity:** ✓ IDENTICAL — formula unchanged.

---

### 4. **calcChargeOffset()** (lines 90–108)
**Lingo:**
```
on calcChargeOffset me
  offsetFromSize = me.calcSize() / 2
  case pChargeOffsetSide of
    #top: point(0, -offsetFromSize)
    #side: point(offsetFromSize * dir, 0)  [dir = owner.getFlipAsDir]
```

**TypeScript Equivalent:**
- **SpellActor.setCharge()** (spellActor.ts:70–77):
  ```typescript
  const half = this.size() / 2;
  if (this.offsetSide === "#side") { m.x = casterX + half * this.aimDir; m.y = casterY; }
  else { m.x = casterX; m.y = casterY - half; }
  ```

**Parity:** ✓ FAITHFUL — offset calculation identical (size/2), directional logic preserved via aimDir (−1/+1).

---

### 5. **release() / releaseNormal()** (lines 228–248)
**Lingo:**
```
on release me, targetLoc, speed
  pReleaseTargetLoc = targetLoc
  pReleaseSpeed = speed
  me.big.internalEvent(#spellReleased)  [triggers releaseNormal via internalEvent dispatch]

on releaseNormal me, targetLoc, speed
  params = me.getMoveXYParams(#moveToTarget)
  me.moveToTarget(params)
  me.playReleaseSound()
```

**TypeScript Equivalent:**
- **SpellActor.release()** (spellActor.ts:88–97):
  - Stores targetX, targetY, speed
  - Switches mode to 'fly'
  - Computes flyDirX, flyDirY, flyTtl (time-to-live budget)
  - Plays releaseSound (fetched from attack data or default "spell_release")
  - Sets vx=0, vy=0 to avoid passive drift

**Parity:** ✓ FAITHFUL — release triggering and sound logic match; moveToTarget replaced by manual step loop (spellActor.update fly branch, lines 100–110).

---

### 6. **moveXYfin() — Arrival Trigger** (lines 214–217)
**Lingo:**
```
on moveXYfin me
  ancestor.moveXYfin()
  me.goMode(#explode)
```

**TypeScript Equivalent:**
- **SpellActor.update()** (spellActor.ts:99–112):
  ```typescript
  if (Math.hypot(this.targetX - m.x, this.targetY - m.y) <= this.speed + 1 || --this.flyTtl <= 0) {
    m.x = this.targetX; m.y = this.targetY;
    this.explode();  // goMode(#explode)
  }
  ```

**Parity:** ✓ FAITHFUL — arrival condition mimics K1's moveToTarget completion (distance < speed+1 or budget exhausted); triggers explode() directly.

---

### 7. **goMode(#explode)** — Explosion Logic (lines 145–161)
**Lingo:**
```
on goMode me, newMode
  case newMode of
    #explode:
      attack = me.getAttack()
      explodeVolume = VarMapRange(pCurrentCharge, attack.chargeVolumeMap.charge, attack.chargeVolumeMap.vol)
      pCurrentCharge = pCurrentCharge * attack.chargeExplodeFactor  [GROW charge]
      me.startQuickFade()
      g.teamMaster.impactAttack(me.ID.bigMe)  [RADIAL area hit]
      me.playSound(attack.explodeSound, explodeVolume)
      me.big.internalEvent(#explode)  [doExplodeFunction: summon/depositMines]
```

**TypeScript Equivalent:**
- **SpellActor.explode()** (spellActor.ts:117–147):

  *Charge growth:*
  ```typescript
  const grown = this.charge * this.attack.chargeExplodeFactor;  // line 121
  ```

  *Explode function (summon/depositMines):*
  ```typescript
  if (this.attack.explodeFunction === "#summonUnit" || this.attack.explodeFunction === "summonUnit") {
    summonUnit(this.attack, this.charge, m.x, m.y, this.ownerId);  // line 127
  } else if (this.attack.explodeFunction === "#depositMines" || this.attack.explodeFunction === "depositMines") {
    depositMines(this.attack, this.charge, m.x, m.y);  // line 130
  }
  ```

  *Radial area hit (resolveSplash #explode):*
  ```typescript
  const explodeAttack: AttackData = {
    ...this.attack,
    attackType: "#explode",
    explodeCharge: grown,                                    // radius = grown/2
    powerScalar: this.attack.powerScalar * SPELL_RADIAL_SCALE,
  };
  resolveSplash(this.entity, explodeAttack, m.x, m.y, this.ownerId, this.hits, this.allegiance);
  // lines 136–144
  ```

  *Sound and finish:*
  ```typescript
  if (this.attack.explodeSound && this.attack.explodeSound !== "#none") 
    game.audio?.play(this.attack.explodeSound);  // line 145
  this.done = true;  // startQuickFade -> finish (collapsed)
  ```

**Parity:** ✓ FAITHFUL — charge growth, summon/depositMines dispatch, radial resolution all match original. startQuickFade→finish collapsed to immediate done-flag (render-only optimization).

**Calibration Note:**
- SPELL_RADIAL_SCALE (spellActor.ts:32): px-scale multiplier pinning spell lethality so base-charge (12.5) energyBlast still fells rank-and-file (300-energy) enemy
- Formula: (radius + TARGET_RADIUS) · power · SPELL_RADIAL_SCALE = faithful damage band (~325 at full charge)
- **NOT a parity gap** — this is calibration, not behavioral difference.

---

### 8. **checkCollisions()** — Terrain Penetration (lines 123–126)
**Lingo:**
```
on checkCollisions me, newVal
  -- doesn't need to check collisions
  return newVal
```
Comment (line 3): "doesn't collide with scenery or characters"

**TypeScript Equivalent:**
- **Movement.update()** (movement.ts:96–149):
  - Lines 108–125: `if (this.passThrough)` → integrates position with NO terrain collision
  - Default behavior (no passThrough): lines 127–149 → call game.grid.moveBox() for collision

**CRITICAL GAP:** 
- **spells.ts line 23** does NOT set `passThrough: true` in spawnSpell():
  ```typescript
  s.build({ x, y, friction: 1, accel: 0, walkSpeed: 999, box: 6 });  // ← missing passThrough: true
  ```
- **Comparison:** bullets.ts line 19 CORRECTLY sets it:
  ```typescript
  b.build({ x, y, friction: 1, accel: 0, walkSpeed: 999, box: 6, passThrough: true });
  ```

**STATUS:** ✗ **BEHAVIORAL DIFFERENCE** — Spells currently collide with terrain; they should phase through per original design. Comment at spellActor.ts:86–87 claims "ignores terrain" but implementation contradicts this.

---

### 9. **updateSize()** (lines 303–308)
**Lingo:**
```
on updateSize me
  mySize = me.calcSize()
  me.setSpriteWidth(mySize)
  me.setSpriteHeight(mySize)
```

**TypeScript Equivalent:**
- **Render layer** (not in SpellActor component itself):
  - SpellActor.charge updated each tick via setCharge()
  - Render system reads size() during render (collapsing updateSize into render-time fetch)

**Parity:** ✓ FAITHFUL — size scaling logic preserved; render just-in-time replaces pre-frame updateSize call.

---

### 10. **internalEvent(#spellReleased)** (lines 203–212)
**Lingo:**
```
on internalEvent me, theEvent
  ancestor.internalEvent(theEvent)
  case theEvent of
    #spellReleased:
      if me.getAttack().releaseFunction = #release then
        me.releaseNormal(pReleaseTargetLoc, pReleaseSpeed)
      end if
  end case
```

**TypeScript Equivalent:**
- **Dispatch via control.ts** (control.ts:240–250):
  - Calls spell.release(aim.x, aim.y, speed) directly
  - Bypasses intermediate #spellReleased event (collapsed into imperative control flow)

**Parity:** ✓ FUNCTIONAL EQUIVALENT — event dispatch logic replaced with direct method calls (no loss of behavior, cleaner dataflow).

---

### 11. **start() / finish()** (lines 294–301, 52–62)
**Lingo:**
```
on start me
  ancestor.start()
  me.setCheckStalled(false)

on finish me
  player = g.actorMaster.getPlayer()
  if player.getChargingSpell() = me.ID.bigMe then
    playerAI.chargingSpellFinished()
  end if
  ancestor.finish()
```

**TypeScript Equivalent:**
- **start():** Embedded in spawnSpell() → entity added to game.entities immediately
- **finish():** Handled by sweepSpells() (systems/spells.ts:31–37):
  ```typescript
  if (e.type === "spell" && e.send("isFinished")) { ents.splice(i, 1); pool.release(e); }
  ```
- **Charging spell notification:** Centralized in control.ts via spell latch; no explicit callback needed

**Parity:** ✓ FAITHFUL — pool/sweep model replaces manual lifecycle; charging-spell tracking unified in PlayerControl.

---

### 12. **getAnimSym()** (lines 167–176)
**Lingo:**
```
on getAnimSym me, sym
  sym = me.getMode()
  case sym of
    #fly, #explode: sym = #charge
  end case
  return sym
```
(Animation reuse: fly/explode use #charge sprite)

**TypeScript Equivalent:**
- **Render layer** (not in SpellActor):
  - getMode() → this.mode ('charge'/'fly'/'explode')
  - Animation sprite selected in render backend (collapsed to render dispatch)

**Parity:** ✓ FAITHFUL — mode-to-anim mapping preserved; render handles sprite selection.

---

### 13. **Getter/Setter Properties** (lines 178–192)
**Lingo:**
- getCharge() / getCurrentCharge() → pCurrentCharge
- getChargeOffsetSide() → pChargeOffsetSide
- getSpellProperties() → pSpellProperties

**TypeScript Equivalent:**
- SpellActor.charge (public field, line 38)
- SpellActor.offsetSide (line 43)
- (spellProperties not ported; lived on the actor for save/restore — now handled in game state)

**Parity:** ✓ FAITHFUL — public fields accessible; save/restore deferred to entity serialization layer.

---

## Detailed Findings

### Non-Gaps (Verified as Intentional Collapses)
1. **startQuickFade() → this.done = true** (spellActor.ts:146):
   - Original: tween sprite alpha to 0 over ~0.2s; finish() swept it next tick.
   - Port: Immediate done-flag; render layer skips rendering finished entities.
   - **Justification:** Render-layer optimization; no gameplay difference (explosion/summon already resolved).

2. **SPELL_RADIAL_SCALE calibration** (spellActor.ts:32):
   - Px-scale pin on spell lethality (base 12.5 energyBlast ≈ 325 damage → kills 300-energy enemy).
   - Not a parity gap; documented calibration constant.

3. **explodeSound data-driven** (weapon.ts:42–45, spellActor.ts:145):
   - healBlast → heal_spell_explode, etc. per attack record.
   - Fixes old hardcoded "spell_explode" (issue #11).
   - **Verified:** Control flow faithfully routes sound from attack data.

4. **depositMines() at landing loc** (summon.ts:28–38, spellActor.ts:130):
   - Scatter numMines = charge/chargePerUnit around (x, y).
   - **Verified:** Faithful to K2 spec (fixed issue C3).

---

## CRITICAL GAPS

### Gap #1: **Spells Do Not Penetrate Terrain** ✗
**Severity:** HIGH (gameplay-affecting)

**Evidence:**
- **objSpell.txt line 3:** "doesn't collide with scenery or characters"
- **objSpell.txt line 123–126:** checkCollisions() → "doesn't need to check collisions" (no-op)
- **spellActor.ts lines 86–87:** Comment claims "ignores terrain (objSpell.checkCollisions 123-126)"

**Implementation Mismatch:**
- **systems/spells.ts line 23:** Spawns spells WITHOUT `passThrough: true`
  ```typescript
  s.build({ x, y, friction: 1, accel: 0, walkSpeed: 999, box: 6 });  // ← MISSING passThrough
  ```
- **movement.ts lines 111–125:** Only skip collision IF passThrough=true
- **Result:** Spells stop dead at walls, contradicting original design

**Comparison (Correct Counterpart):**
- **systems/bullets.ts line 19:** Bullets CORRECTLY set `passThrough: true`
  ```typescript
  b.build({ x, y, friction: 1, accel: 0, walkSpeed: 999, box: 6, passThrough: true });
  ```

**Fix Required:**
```typescript
// systems/spells.ts line 23
s.build({ x, y, friction: 1, accel: 0, walkSpeed: 999, box: 6, passThrough: true });
```

**Impact:** Players firing spells at angled walls or through tight spaces will see them bounce/stop instead of flying through cleanly. Affects all spell casts (energyBlast, summons, etc.).

---

## Summary Table

| Handler | Lingo Lines | TS Location | Status | Notes |
|---------|-------------|------------|--------|-------|
| new/init | 17–50 | spellActor.ts:50–66 + spells.ts:18–28 | ✓ | Pool/archetype collapse faithful |
| charge | 114–121 | spellActor.ts:70–77 | ✓ | Position alignment identical |
| calcSize | 110–112 | spellActor.ts:79 | ✓ | Formula unchanged |
| calcChargeOffset | 90–108 | spellActor.ts:70–77 | ✓ | #top/#side logic preserved |
| release/releaseNormal | 228–248 | spellActor.ts:88–97 | ✓ | Fly trajectory computed faithfully |
| moveXYfin | 214–217 | spellActor.ts:104–106 | ✓ | Arrival detection equivalent |
| goMode(#explode) | 145–161 | spellActor.ts:117–147 | ✓ PARTIAL | Charge growth ✓, radial hit ✓, summon/mines ✓, sound ✓, finish ✓ |
| checkCollisions | 123–126 | movement.ts:111–125 | ✗ | **MISSING passThrough flag** |
| updateSize | 303–308 | (render layer) | ✓ | Just-in-time render |
| internalEvent | 203–212 | control.ts:240–250 | ✓ | Dispatch flattened to control flow |
| start/finish | 52–62, 294–297 | spells.ts:31–37 | ✓ | Pool/sweep model |
| getAnimSym | 167–176 | (render layer) | ✓ | Mode-to-anim preserved |
| Getters/Setters | 178–192 | spellActor.ts fields | ✓ | Public fields accessible |

---

## Conclusion

**1 High-Severity Gap Identified:**
- **Spells collide with terrain** — violates original checkCollisions design (should pass through)
- Quick fix: Add `passThrough: true` to spawnSpell() build call

**All other handlers map faithfully.** Module functions (summon.ts, splash.ts, weapon.ts) correctly delegate specialized logic; startQuickFade/explodeSound/depositMines are verified as intentional optimizations with no behavioral loss.

---

## Reviewer resolution (sweep lead): the "no passThrough" flag is a NON-GAP

objSpell.txt:3 "doesn't collide with scenery" IS honored, just not via the passThrough flag. The SpellActor
advances the orb by setting Movement.x/y DIRECTLY each tick (spellActor.ts flight: `m.x += flyDirX*speed`)
while holding vx=vy=0. Movement runs first in the chain, and moveBox only resolves collisions when dx!==0
(collision.ts: `if (dx !== 0)` / `if (dy !== 0)`) — at zero walk-velocity it is a no-op and never ejects the
orb. So the orb phases through walls by construction. Adding passThrough would be redundant (and would change
the knockback-decay branch the orb doesn't use). Verified: moveBox zero-velocity no-op + direct position
advance. **Non-gap.**
