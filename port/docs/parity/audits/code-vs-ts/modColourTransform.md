# Audit: modColourTransform.txt vs colourTransform.ts

**Date:** 2026-06-21  
**Scope:** Runtime activation of colour transform glows/effects

## Summary

The TypeScript port defines all palette methods from the original Lingo module (`modColourTransform.txt`), but **invincibility pulsing is NOT wired up at runtime**. The code exists but is never triggered.

---

## Glow Activation Matrix

### ✓ CLEAN: Properly Triggered

#### glowGold (level-up / heal)
- **Lingo caller:** `modEnergy.takeHeal` (line 264)
- **TS caller:** `Energy.takeHeal()` (combat.ts:71)
- **Handler:** `ColourTransform.glowGold()` (colourTransform.ts:142)
- **Chaining:** chains to `fadeGoldBlack` → fade to black (speed 10)
- **Status:** ✓ ACTIVATED

#### stopGlowRed (healed above threshold)
- **Lingo caller:** `modEnergy.increaseEnergy` (line 73) — stops red when health ≥ 50%
- **TS caller:** `Energy.takeHeal()` (combat.ts:73)
- **Handler:** `ColourTransform.stopGlowRed()` (colourTransform.ts:152)
- **Status:** ✓ ACTIVATED

#### glowRed (low health < 50%)
- **Lingo caller:** `modEnergy.glowRedOnLowHealth()` (line 129)
- **TS caller:** 
  - `Energy.glowRedOnLowHealth()` (combat.ts:58) on `takeHit`
  - `Energy.colourTransformFin()` (combat.ts:61) re-arms on tween finish
- **Handler:** `ColourTransform.glowRed()` (colourTransform.ts:133)
- **Spec:** target rgb(255,0,0), speed 10, pingpong=true
- **Interaction:** if glowTeal active, upgrades to glowRedAndTeal
- **Status:** ✓ ACTIVATED

#### glowTeal (frozen)
- **Lingo caller:** `modFreeze.takeFreeze` (lines 77-78) — conditional on `glowTeal` flag
- **TS caller:** `Freeze.takeFreeze()` (freeze.ts:35)
- **Handler:** `ColourTransform.glowTeal()` (colourTransform.ts:137)
- **Spec:** target rgb(0,255,255), speed 100, pingpong=false
- **Interaction:** if glowRed active, upgrades to glowRedAndTeal
- **Status:** ✓ ACTIVATED

#### glowRedAndTeal (low health + frozen)
- **Lingo caller:** `modColourTransform.glowRed()` (line 152) / `glowTeal()` (line 168) — conditional upgrade
- **TS caller:** Invoked by `ColourTransform.glowRed()` or `glowTeal()` (lines 134, 138)
- **Handler:** `ColourTransform.glowRedAndTeal()` (colourTransform.ts:141)
- **Spec:** start rgb(0,255,255), target rgb(255,0,0), speed 10, pingpong=true
- **Status:** ✓ ACTIVATED

#### stopGlowTeal (defrost)
- **Lingo caller:** `modFreeze.defrost()` — clears teal, resumes red if still low
- **TS caller:** `Freeze.update()` (freeze.ts:51)
- **Handler:** `ColourTransform.stopGlowTeal()` (colourTransform.ts:156)
- **Status:** ✓ ACTIVATED

#### glowPink (possession)
- **Lingo caller:** (implied in possession flow)
- **TS caller:** `CpuAI.ghostAttemptPossess()` (control.ts:768) — ghost merges XP + glowPink
- **Handler:** `ColourTransform.glowPink()` (colourTransform.ts:144)
- **Spec:** target rgb(255,200,200), speed 10
- **Chaining:** chains to `fadeBlack` → fade to black
- **Status:** ✓ ACTIVATED

#### fadeGoldBlack (tail of glowGold)
- **Lingo caller:** Chained auto-invoke from `glowGold()` (line 147)
- **TS caller:** Auto-invoked via `next` chain (colourTransform.ts:142)
- **Handler:** `ColourTransform.fadeGoldBlack()` (colourTransform.ts:143)
- **Spec:** start rgb(255,201,57), target black, speed 10
- **Status:** ✓ ACTIVATED

#### fadeBlack (tail of glowPink)
- **Lingo caller:** Chained auto-invoke from `glowPink()` (line 135)
- **TS caller:** Auto-invoked via `next` chain (colourTransform.ts:144)
- **Handler:** `ColourTransform.fadeBlack()` (colourTransform.ts:146)
- **Spec:** start pLastFinishingColour, target black, speed 10
- **Status:** ✓ ACTIVATED

#### flickWhite (hit feedback, speed 33)
- **Lingo caller:** `modEnergy.loseEnergy` (line 203) — non-lethal hit
- **TS caller:** `Hurt.takeHit()` (hurt.ts:46)
- **Handler:** `ColourTransform.flickWhite()` (colourTransform.ts:148)
- **Spec:** start white, target black, speed 33 (faster than flashWhite)
- **Status:** ✓ ACTIVATED

#### flashWhite (instant white flash, speed 10 default)
- **Lingo caller:** Default init in `addModParams` (line 21)
- **TS caller:** Defined but not invoked at runtime
- **Handler:** `ColourTransform.flashWhite()` (colourTransform.ts:147)
- **Spec:** start white, target black, speed 10
- **Status:** ⚠ DEFINED but NOT TRIGGERED (no gameplay caller found)
- **Note:** May be intentional if the design moved all non-lethal hit feedback to `flickWhite` (speed 33).

---

### ✗ GAPS: Not Triggered at Runtime

#### pulseWhite (invincibility pulse)
- **Lingo caller:** `modInvince.invinceOn()` (line 52)
- **TS handler:** `ColourTransform.pulseWhite()` (colourTransform.ts:149)
- **TS runtime caller:** **NONE FOUND** ✗
- **Spec:** start white, target black, speed 10, pingpong=true (oscillates white<->black during invince)
- **Expected trigger:** `Hurt.grantInvince()` should arm invincibility visual
- **Current TS flow:**
  - `grantInvince()` (hurt.ts:55) sets `invinceT > 0`
  - `isInvince()` (hurt.ts:57) gates i-frame damage
  - No call to `ColourTransform.pulseWhite()` exists
- **Status:** ✗ GAP — invincibility is functional (damage is gated) but silent (no visual pulse)
- **Impact:** Players collecting pickup shields / granting invincibility frames see NO visual feedback

#### stopPulseWhite (stop invincibility pulse)
- **Lingo caller:** `modInvince.invinceOff()` (line 58)
- **TS handler:** `ColourTransform.stopPulseWhite()` (colourTransform.ts:160)
- **TS runtime caller:** **NONE FOUND** ✗
- **Status:** ✗ GAP (companion to pulseWhite, never reached because pulseWhite never starts)

---

## RGB Colour Verification

All palette RGB values match the Lingo spec exactly:

| Transform | Lingo RGB | TS RGB | Status |
|-----------|-----------|--------|--------|
| glowRed | rgb(255,0,0) | [255, 0, 0] | ✓ |
| glowTeal | rgb(0,255,255) | [0, 255, 255] | ✓ |
| glowGold | rgb(255,201,57) | [255, 201, 57] | ✓ |
| glowPink | rgb(255,200,200) | [255, 200, 200] | ✓ |
| WHITE | rgb(255,255,255) | [255, 255, 255] | ✓ |
| BLACK | rgb(0,0,0) | [0, 0, 0] | ✓ |

---

## Speed / Timing Verification

| Transform | Lingo Speed | TS Speed | Pingpong (Lingo) | Pingpong (TS) | Status |
|-----------|------------|----------|-----------------|---------------|--------|
| glowRed | 10 | 10 | true | true | ✓ |
| glowTeal | 100 | 100 | false | false | ✓ |
| glowRedAndTeal | 10 | 10 | true | true | ✓ |
| glowGold | 10 | 10 | N/A | N/A | ✓ |
| fadeGoldBlack | 10 | 10 | N/A | N/A | ✓ |
| glowPink | 10 | 10 | N/A | N/A | ✓ |
| fadeBlack | 10 | 10 | N/A | N/A | ✓ |
| flashWhite | 10 (default) | 10 | N/A | N/A | ✓ |
| flickWhite | 33 | 33 | N/A | N/A | ✓ |
| pulseWhite | 10 | 10 | true | true | ✓ |

---

## File Mapping

| Lingo File | TS File | Handlers |
|-----------|---------|----------|
| modColourTransform.txt | colourTransform.ts:33-218 | `arm()`, `cancel()`, palette methods, `update()`, `getColourTransform()` |
| modEnergy.txt (caller) | combat.ts:9-122 | `takeHit()`, `takeHeal()`, `glowGold()`, `colourTransformFin()` |
| modFreeze.txt (caller) | freeze.ts:18-56 | `takeFreeze()`, `stopGlowTeal()` |
| modInvince.txt (caller) | hurt.ts:8-63 | `grantInvince()` — **missing ColourTransform calls** |
| Ghost possession (caller) | control.ts:757-775 | `ghostAttemptPossess()` → `glowPink()` |

---

## Conclusion

**Status:** GAPS=2

Two critical invincibility-related colour transforms are defined but **never triggered**:

1. **`pulseWhite()`** — Invincibility visual should pulse white↔black (oscillate during i-frames), but Hurt.grantInvince() does not call it.
2. **`stopPulseWhite()`** — Companion stop method, unreached because pulseWhite never starts.

All other transforms (heal glow, low-health glow, freeze glow, hit flash, possession glow) are properly wired and activate at runtime.

**Recommendation:** Wire Hurt component to call `ColourTransform.pulseWhite()` on `grantInvince()` and `stopPulseWhite()` when i-frames expire.
