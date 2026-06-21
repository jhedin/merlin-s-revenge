# Parity Audit: modFlasher.txt vs hurt.ts + colourTransform.ts

**Date:** 2026-06-21  
**Scope:** Flash feedback on takeHit — runtime activation, duration, render  
**Status:** GAPS FOUND (see §4, §5)

---

## Executive Summary

The TS port IMPLEMENTS a functional white-flash visual on non-lethal hits via `flickWhite()` (speed 33, 6-frame duration). The original Lingo defines the flash infrastructure (modFlasher, objFlasher) but **does NOT wire it into takeHit in the visible code**. The TS port is more complete: the flash is activated, rendered, and properly timed. However, there is a **duration mismatch**: Lingo's default is 30 frames; TS hardcodes 6.

---

## Handler Map: Lingo → TypeScript

| Lingo Handler / Object | TypeScript Equivalent | File:Line | Notes |
|------------------------|----------------------|-----------|-------|
| `modFlasher.new` | (Hurt component init) | hurt.ts:8-20 | TS merges flash into Hurt component; no separate flasher object |
| `modFlasher.init` | `Hurt.init()` | hurt.ts:15-19 | Initialize flashT=0 (duration counter). No configurable pFlasherTime parameter read. |
| `modFlasher.addModParams` | (hardcoded) | hurt.ts | Default flasherTime=30 in Lingo (modFlasher.txt:23); TS hardcodes flashT=6 on hit |
| `modFlasher.startFlasher` | (NOT CALLED in Lingo; implemented as flickWhite in TS) | hurt.ts:46 / colourTransform.ts:148 | Called via takeHit, line 46 |
| `objFlasher.init` | `ColourTransform.arm("flickWhite", ...)` | colourTransform.ts:102-121 | Sets up white->black tween at speed 33 |
| `objFlasher.update` | `ColourTransform.update()` | colourTransform.ts:172-190 | Tween advance: pCurr += speed each tick until target reached |
| (flash visual) | (renderer tint pass) | renderer.ts:101-135 | Applies white overlay via source-atop |

---

## Behavioral Analysis

### 1. Flash Activation on takeHit

**Lingo (modReel.txt:108-114, modEnergy.txt, modFlasher.txt:84-94)**  
The original modFlasher defines `startFlasher()` which acquires an objFlasher and initializes it:
```lingo
on startFlasher me
  me.acquireFlasher()
  
  params = pFlasher.getParams(#init)
  params.callingPrg = me.ID.bigMe
  params.spr = me.getSprite()
  params.time = pFlasherTime
  pFlasher.init(params)
  pFlasher.calcStart()
end
```

**Lingo takeHit call site:** Despite modFlasher being a module, **`startFlasher` is NEVER invoked in any visible takeHit chain**. The handler exists but is unused.

**TypeScript (hurt.ts:35-51)**  
```typescript
takeHit(next: NextFn, vx = 0, vy = 0, attackerId = -1, mult = 1): any {
  const r = next(vx, vy, attackerId, mult);
  if ((Math.abs(vx) + Math.abs(vy)) * mult > 0 && !this.entity.send("isInvince")) {
    const dead = this.entity.send("isDead");
    if (!this.reelProof || dead) {
      this.flashT = 6;  // Line 42: SET FLASH DURATION
      if (this.invinceFrames > 0) this.invinceT = this.invinceFrames;
      if (!dead) this.entity.tryGet(ColourTransform)?.flickWhite();  // Line 46: TRIGGER FLASH
      this.entity.send("characterModeChanged", dead ? "#die" : "#reel");
    }
  }
  return r;
}
```

**Comparison:**
- Lingo: Method defined but NOT called; flash never activates at runtime
- TS: Flash **IS activated on line 46** via `flickWhite()` every non-lethal hit
- **GAP: Lingo's flash is dead code; TS actually implements it**

**Verification:** Grep confirms startFlasher has zero callers:
```
$ grep -r "startFlasher" /home/user/merlin-s-revenge/casts/script_objects/
/home/user/merlin-s-revenge/casts/script_objects/modFlasher.txt:on startFlasher me
```
Only the definition, no calls.

---

### 2. Flash Duration

**Lingo (modFlasher.txt:20-26)**  
Default duration: `pFlasherTime = 30` frames (addModParams line 23).

**TypeScript (hurt.ts:42)**  
Duration hardcoded: `this.flashT = 6;`

**Gap:**
- Lingo would run for 30 frames (if activated)
- TS runs for 6 frames
- Mismatch factor: 5x shorter in TS

**Root cause:** TS's `flashT` is NOT the objFlasher frame count; it's a separate latch used for the reel animation ("characterModeChanged" gate on line 26). The white flash is driven by ColourTransform's `flickWhite()` tween, which decays at speed 33 (see §3).

---

### 3. Flash Visual & Tween

**Lingo (objFlasher.txt:64-74)**  
Binary alternation: sprite.blend toggles 0 ↔ 100 each frame:
```lingo
on update me
  if pSpr.blend = 0 then
    pSpr.blend = 100
  else
    pSpr.blend = 0
  end if
  
  Counter(pTimeCounter)
  me.ancestor.calcFin()
end
```
This is a **binary white flash** (full white overlay, on/off each frame) for N frames (default 30).

**TypeScript (colourTransform.ts:147-149)**  
```typescript
flickWhite(): void { this.arm("flickWhite", BLACK, { start: WHITE, speed: 33 }); }
```

The white flash is a **smooth tween** (not binary):
- Start: WHITE [255, 255, 255]
- Target: BLACK [0, 0, 0]
- Speed: 33 units/tick (pCurr advances toward 100 by 33 per tick)
- Duration: ~3 ticks to fade from white to black (100/33 ≈ 3.03)

**Lingo duration:** 30 frames at binary on/off = 30 flashes  
**TS duration:** ~3 frames of smooth fade (speed 33)  
**TS actual appearance:** Much briefer, smooth fade instead of strobing

**Renderer verification (renderer.ts:101-135):**  
The tint is applied via source-atop (line 121-124):
```typescript
c.globalCompositeOperation = "source-atop";
c.globalAlpha = Math.min(1, tint.additive ? tint.strength * 0.9 : tint.strength);
c.fillStyle = `rgb(${tint.rgb[0]},${tint.rgb[1]},${tint.rgb[2]})`;
c.fillRect(0, 0, w, h);
```

✓ White overlay IS applied to the sprite.

---

### 4. Flash RGB Color

**Lingo (objFlasher.txt:65-69)**  
Blend mode 0-100 creates a white overlay. No explicit RGB; Director's blend mode #blend(100) = white tint.

**TypeScript (colourTransform.ts:42 + 147-148)**  
```typescript
const WHITE: RGB = [255, 255, 255];
flashWhite(): void { this.arm("flashWhite", BLACK, { start: WHITE, speed: 10 }); }
flickWhite(): void { this.arm("flickWhite", BLACK, { start: WHITE, speed: 33 }); }
```

RGB = [255, 255, 255] ✓ Matches white.

**Also note:** There are TWO white flash methods:
- `flashWhite()`: speed 10 (slower, more perceptible)
- `flickWhite()`: speed 33 (faster, used on hits)

Only flickWhite is called on takeHit (line 46).

---

### 5. Flash Duration Breakdown

**Lingo objFlasher behavior (if activated):**
- Runs for `pTimeCounter` ticks, initialized to pFlasherTime=30
- Alternates blend 100 ↔ 0 each frame
- Finishes when counter expires (30 ticks later)
- Result: 30 frames of strobing

**TS ColourTransform.flickWhite() behavior:**
- Tween: pCurr=0 → pCurr=100 at speed 33/tick
- First frame after init: does NOT step (pFirstFrame=true, line 174-175)
- Subsequent frames: `pCurr += 33` each tick
  - Tick 0: pCurr=0 (first, holds white)
  - Tick 1: pCurr=33 (white fading)
  - Tick 2: pCurr=66 (darker)
  - Tick 3: pCurr=99 → finish (black)
  - Tick 4: idle (no tint)
- Total visible duration: ~3-4 ticks of gradual fade

**Impact on gameplay:**
- Lingo: 30 frames of flash feedback (very visible, player feels the hit)
- TS: 3-4 frames of flash (subtle, brief)
- **TS flash is 7-10x shorter than intended**

**Caller context (hurt.ts:42, 26):**  
The `flashT` counter (set to 6) controls the reel animation anim selector, NOT the white flash duration. The white flash is independent:
```typescript
// Line 26: clear dazed when flashT expires
if (this.flashT === 0 && !this.entity.send("isDead")) this.entity.send("characterModeChanged", "#walk");
// Line 62: return "reel" animation while flashT > 0
animAction(next: NextFn): any { return this.flashT > 0 ? "reel" : next(); }
```

---

## Activation Runtime Trace

**Question: Is the flash actually triggered on takeHit at runtime in TS?**

**Answer: YES, confirmed:**

1. Entity takes damage → `takeHit()` dispatched (engine dispatch system)
2. **Hurt.takeHit()** handler runs (hurt.ts:35)
3. Damage check: `if ((|vx|+|vy|)*mult > 0 && !isInvince)` (line 37)
4. Reelproof check: `if (!reelProof || dead)` (line 41)
5. **Activation branch enters (line 42-47):**
   - `this.flashT = 6` — duration latch for reel anim
   - `this.entity.tryGet(ColourTransform)?.flickWhite()` — **CALL FLASH** (line 46)
6. ColourTransform.flickWhite() called (colourTransform.ts:148)
7. `this.arm("flickWhite", BLACK, { start: WHITE, speed: 33 })` initializes tween
8. ColourTransform.update() advances tween each frame (colourTransform.ts:172-190)
9. `getColourTransform()` returns the live tint (colourTransform.ts:206-217)
10. Renderer queries and applies the tint (renderer.ts:66-98)

✓ **Flash is activated, tween advances, renderer applies it.**

---

## Rendering Verification

**Question: Does the white overlay actually render?**

**Answer: YES, confirmed:**

1. Renderer.drawSprites() calls (renderer.ts:66-98)
2. For each sprite with `s.tint` (line 72):
   ```typescript
   const img = s.tint ? this.tinted(s.img, s.tint) : s.img;
   ```
3. `tinted()` method (renderer.ts:103-135) produces the tinted canvas
4. Composite operation: source-atop (line 121)
5. Fill color: white [255, 255, 255] (line 123)
6. Alpha blended: `Math.min(1, tint.strength)` (line 122)
7. Cached and drawn to screen

✓ **White overlay is rendered.**

---

## Summary of Gaps

| Issue | Severity | Details |
|-------|----------|---------|
| **Flash never triggered in Lingo** | CRITICAL | `startFlasher()` is defined but never called in the Lingo takeHit chain; flash code is dead. |
| **TS flash duration mismatch** | MEDIUM | Lingo: 30 frames; TS: ~3-4 frames (7-10x shorter). The white flash in TS fades too quickly. |
| **No flasherTime parameter in TS** | MEDIUM | Lingo reads `pFlasherTime = 30` from params; TS hardcodes the tween speed (33). The configurable duration is lost. |
| **Binary vs smooth flash** | LOW | Lingo alternates on/off (strobing); TS is a smooth fade. Visual feel is different but both communicate "you got hit". |

---

## Evidence: File Locations & Line Numbers

| Artifact | Location | Lines | Content |
|----------|----------|-------|---------|
| Lingo flash infrastructure | casts/script_objects/modFlasher.txt | 84-94 | startFlasher() definition |
| Lingo objFlasher blink logic | casts/script_objects/objFlasher.txt | 64-74 | Binary blend toggle |
| Lingo default duration | casts/script_objects/modFlasher.txt | 23 | pFlasherTime = 30 |
| **TS takeHit activation** | **port/src/components/hurt.ts** | **35-51** | **Flash triggered on line 46** |
| **TS flickWhite tween** | **port/src/components/colourTransform.ts** | **148** | **Speed 33 definition** |
| **TS tween execution** | **port/src/components/colourTransform.ts** | **172-190** | **Tween advance logic** |
| **TS renderer tint** | **port/src/render/renderer.ts** | **101-135** | **White overlay application** |

---

## Conclusion

**PARITY STATUS: GAPS FOUND**

**Gap 1 (CRITICAL):** Lingo flash is never activated (startFlasher unreachable).  
**Gap 2 (MEDIUM):** TS flash duration is ~7-10x shorter (3-4 frames vs 30 frames).  
**Gap 3 (MEDIUM):** No configurable flasherTime in TS (hardcoded to speed 33).  
**Gap 4 (LOW):** Visual style differs (binary vs smooth fade).

**TS advantage:** Flash is actually implemented and renders.  
**TS disadvantage:** Duration is far too brief; feedback may not be perceptible.

**Recommendation:** Adjust `flickWhite()` speed from 33 to ~11 to approximate 30-frame duration (100/11 ≈ 9 ticks, closer to Lingo intent).
