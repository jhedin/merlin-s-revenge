# Visual FX Parity Re-sweep

Files audited: `casts/script_objects/modColourTransform.txt`, `modFlasher.txt`, `modProp.txt`, `modGrave.txt`, `modFreeze.txt`  
Port counterparts: `port/src/components/colourTransform.ts`, `hurt.ts`, `grave.ts`, `freeze.ts`, `anim.ts`, `render/healthBar.ts`, `render/renderer.ts`, `scenes/thespian.ts`  
Engine authority: `extracted/engine/scripts/ParentScript 185 - objTransformer.ls`, `ParentScript 184 - objTransColor.ls`, `MovieScript 97 - VarColRange.ls`, `MovieScript 113 - varValRange.ls`, `ParentScript 145 - objMulticolourEnergyBar.ls`

---

## GAP 1 (REAL BUG) — Freeze teal glow is one-shot, not held

**Lens 2 (Activation/Reachability) + Lens 4 (Player-POV)**

**Lingo** (`modFreeze.txt:52-60`): `internalEvent` catches `#colourTransformFin` and, if `pGlowTeal` is true, calls `me.big.glowTeal()` to re-arm the transform. `glowTeal` sets `speed=100, pingpong=false` — so each arm snaps to teal in one step, fires `colourTransformFin`, which re-arms again. The net effect is a solid, held teal glow for the entire freeze duration.

**Port** (`freeze.ts`): `Freeze` does not register `colourTransformFin`. When the single-shot teal glow finishes, `ColourTransform.finish()` sends `colourTransformFin` to the entity (`colourTransform.ts:165`). `Energy.colourTransformFin` (`combat.ts:61`) handles it only to re-arm `glowRed` on low health — it does not re-arm the teal. The frozen entity's teal overlay disappears after 2 game-ticks and never returns until defrost.

**Player-visible effect**: a frozen enemy shows a ~2-frame teal flash then looks normal (no tint) for the rest of the freeze, instead of holding a solid teal glow throughout.

**Fix**: Add to `Freeze` component in `port/src/components/freeze.ts`:
```ts
static handles = ["update", "takeFreeze", "isFrozen", "freezeFactor", "colourTransformFin"];
colourTransformFin(next: NextFn): void {
  if (this.glowTeal && this.ticks > 0) {
    this.entity.tryGet(ColourTransform)?.glowTeal();
  }
  next();
}
```

**Missing test (Lens 6)**: `port/test/freeze.test.ts` asserts `glowTeal` flag is set but never tests that the ColourTransform teal glow persists across a `colourTransformFin` event. No test covers this re-arm cycle.

---

## CLEAN — modColourTransform palette constants

**Lens 1 + 3**

All six RGB constants verified at source (`colourTransform.ts:37-42`):

| Transform | Lingo (modColourTransform.txt) | Port |
|---|---|---|
| `glowRed` target | `rgb(255,0,0)` | `RED = [255,0,0]` ✓ |
| `glowTeal` target | `rgb(0,255,255)` speed 100 | `TEAL = [0,255,255]` speed 100 ✓ |
| `glowRedAndTeal` start→target | `rgb(0,255,255)→rgb(255,0,0)` speed 10 pingpong | `TEAL→RED` speed 10 pingpong ✓ |
| `glowGold` target | `rgb(255,201,57)` speed 10 | `GOLD = [255,201,57]` speed 10 ✓ |
| `fadeGoldBlack` start | `rgb(255,201,57)→black` speed 10 | `GOLD→BLACK` speed 10 ✓ |
| `glowPink` target | `rgb(255,200,200)` speed 10 | `PINK = [255,200,200]` speed 10 ✓ |
| `flashWhite` | `white→black` speed default(10) | `WHITE→BLACK` speed 10 ✓ |
| `flickWhite` | `white→black` speed 33 | `WHITE→BLACK` speed 33 ✓ |
| `pulseWhite` | `white↔black` speed default(10) pingpong | `WHITE↔BLACK` speed 10 pingpong ✓ |

`glowTeal` is confirmed `pingpong=false` in Lingo (`modColourTransform.txt:173`); port does not set pingpong (defaults false via `opts.pingpong ?? false` at `colourTransform.ts:116`). ✓

---

## CLEAN — objTransformer tween math (VarToward / VarColRange / VarValRange)

**Lens 1 + 3**

`VarToward` (`extracted/engine/scripts/MovieScript 112.ls`): moves `var` toward `targit` by `amount`, clamped. Port (`colourTransform.ts:63-67`) implements this identically.

`VarColRange` (`extracted/engine/scripts/MovieScript 97.ls`) calls `VarValRange` per channel. Engine `VarValRange` (`MovieScript 113.ls`): at `perc<=0` returns `lRange[1]`; at `perc>=100` returns `lRange[2]`; else `lRange[1] + (lRange[2]-lRange[1]) * perc/100`. Port `varColRange` (`colourTransform.ts:53-60`) does the same linear lerp with `Math.max(0,Math.min(100,percent))/100`. Identical result. ✓

First-frame hold: `objTransformer.update` calls `updateAttribute()` on frame 0 (sets the start colour) then returns. Port holds without stepping on the first update call (`firstFrame=true`; `colourTransform.ts:174-176`); `colourAt()` at `curr=0` returns the start colour. Observably identical. ✓

`#current` start: `objTransColor.initCurrentColor` reads `pSpr.color` — the live resolved colour at arm time. Port captures `lastColour = colourAt()` inside `cancel()` before resetting the tween (`colourTransform.ts:106,126`). Identical semantics. ✓

pingpong end-swap: `objTransformer.finishConditionMet` swaps `pTarget ↔ pInitialValue` when `pCurr = pTarget`, without returning true. Port swaps `toward ↔ from` (`colourTransform.ts:181-183`). ✓

---

## CLEAN — modFlasher is dead code in BOTH trees

**Lens 2 (Activation/Reachability)**

`modFlasher.startFlasher()` is the only entry point into `objFlasher` (which toggles sprite blend 0/100 for `pFlasherTime=30` frames). Exhaustive `grep` across all `casts/` and `extracted/` scripts finds zero callers of `startFlasher`. The method is defined (`modFlasher.txt:84`, `extracted/engine/scripts/ParentScript 20.ls:72`) but never invoked.

`objCPUCharacter.flasherFinished` and `objDwelling.flasherFinished` exist but are unreachable (they can only fire if `startFlasher` were called, which it never is). The death sequence goes `outOfEnergy → #die → #dead → updateDead() (grave anim plays) → #finish` — no flasher involvement.

The port correctly omits `modFlasher` from all archetypes. No gap.

---

## CLEAN — modGrave draw-order and ghost suppression

**Lens 4 + 5 (Player-POV + Draw-Order)**

**Original**: `modGrave.drawGrave` (`modGrave.txt:31-39`) calls `currentRoom.drawAndRecordGrave(bigMe)`, which bakes the `#grave` member into the room's background bitmap at ink 36 (matte copy). A ghost (`params[#ghost]=true`) sets `pGraveOn=false` and skips drawing.

**Port**: dead entity persists as its own grave. `anim.ts:145`: `z: isGrave ? m.y - 100000 : m.y` — bias of −100000 puts it behind all live actors (which have z ≈ world-y in 0..viewH). `flip: isGrave ? false` matches `setFlipFromDir(1)`. Ghost check (`anim.ts:124`): `if (dead && graveOn === false && !stretching) return null` suppresses the sprite.

Grave-vs-grave order: both trees order by world-y (baked-in-order vs z-bias + y). ✓  
Ghost suppression: correct on both sides. ✓

**Lens 6**: `render_f3.test.ts:171-205` has three tests covering grave z-bias, flip, ghost suppression, and multi-grave y-ordering. ✓

---

## CLEAN — modGrave `graveOn` init from `params[#ghost]`

**Lens 3 (Global + Initial State)**

Lingo (`modGrave.txt:26-28`): `if params[#ghost] = true then pGraveOn = false`.  
Port (`grave.ts:19`): `override init(cfg): void { this.graveOn = cfg["ghost"] !== true; }`.  
Match. ✓

---

## CLEAN — modProp (cutscene prop rendering)

**Lens 4 + 5**

`modProp` is a pure cutscene module (no combat/HUD role). The port maps `beProducedAsProp`, `carryProp`, `bePutAwayAsProp`, `propExitStage*`, and `propStatus` into `Thespian`'s per-player state (`thespian.ts:62-73`, `333-363`). The carry-offset (`{ x: ±14, y: -10 }`) mirrors the original's `pPropCarryLoc = (spriteWidth/2) * dir` approximation.

`propExit` → `exitStage()` calls `gotoWings()` after the scroll walk (thespian.ts:356-362). `bePutAwayAsProp` → `putAwayProp(away=true)` snaps to wings (thespian.ts:349). No visual constants are involved (prop rendering uses the entity's normal Anim sprite with Movement position updated each tick). No RGB/blend/speed values to verify.

Prop draw-order is via the thespian's entity list (cutscene actors render in thespian order, not the combat z-sort). Original used `setLocZ` to order; the port doesn't replicate per-prop z-stacking within a cutscene — but this is effectively unobservable for this game's two-character scenes and is out of scope per the prior audit.

---

## CLEAN — modFreeze `defrost` speed restoration

**Lens 1**

Lingo (`modFreeze.txt:33-41`):
```lingo
speedChange = (2*currSpeed - pPreviousWalkSpeed)/2
walkSpeed = 2*currSpeed - speedChange
me.setSpeed(walkSpeed)
```
Simplified: restores `pPreviousWalkSpeed` accounting for speed gains while frozen.

Port (`freeze.ts:46-54`): `freezeFactor()` returns 0.5 while frozen, 1 thawed. Movement multiplies by `freezeFactor` each tick. When `ticks` reaches 0 the factor reverts to 1 — equivalent result (speed is not explicitly halved/restored; it's a live multiplier). Observable motion is identical. ✓

---

## CLEAN — glowRed low-health trigger and re-arm

**Lens 2 (Activation/Reachability)**

Lingo (`modEnergy.txt:193-203`): a non-lethal `loseEnergy` calls `me.ID.bigMe.flickWhite()`. Port (`hurt.ts:49`): `this.entity.tryGet(ColourTransform)?.flickWhite()`. ✓  
Low-health glow: `energy/max < 50% → glowRed()` on hit (`combat.ts:58`). Re-armed via `colourTransformFin` (`combat.ts:61`). ✓  
`glowRed + glowTeal → glowRedAndTeal` promotion: `colourTransform.ts:133-135` matches `modColourTransform.txt:150-164`. ✓

---

## CLEAN — objMulticolourEnergyBar formula

**Lens 3 (Global + Initial State)**

Authoritative source: `extracted/engine/scripts/ParentScript 145 - objMulticolourEnergyBar.ls`.

Colour stops: `[rgb(255,0,0), rgb(255,255,0), rgb(0,200,0)]` — the green stop is `(0,200,0)`, not `(0,255,0)`.  
Port (`healthBar.ts:8`): `HEALTH_STOPS = [[255,0,0],[255,255,0],[0,200,0]]`. ✓ (the `0,200,0` was a previously-caught bug; it is already correct here).

Formula: `colPercent = floor(energypercent) mod 50 * 2`. Port (`healthBar.ts:16`): `t = (Math.floor(pct) % RANGE * 2) / 100` where `RANGE=50`. Identical. ✓

Special case at 100%: original returns `pColourRange[3]` directly (skips lerp). Port returns the last stop immediately at `pct >= 100`. ✓

**Lens 6**: `port/test/health_bar.test.ts` anchors all three stops and the interpolation within each band. ✓

---

## CLEAN — pulseWhite invincibility visual

**Lens 2 (Activation/Reachability)**

`grantInvince` (`hurt.ts:59-64`): arms `pulseWhite` and sets `pulsing=true`. When `invinceT` reaches 0, `stopPulseWhite()` is called and the pulse ends (`hurt.ts:31`). The white-to-black pingpong produces the visible invincibility flash. ✓

---

## Summary

**1 real bug found**:

**GAP 1**: `Freeze.colourTransformFin` handler missing — teal freeze glow fires once (≈2 frames) and disappears instead of staying on for the full freeze duration. Fix: add `colourTransformFin` to `Freeze.handles` and re-arm `glowTeal()` if `this.glowTeal && this.ticks > 0`. Missing observable test.

All other areas checked are correct:
- All nine colour transform RGB/speed/pingpong constants match the originals exactly.
- VarToward / VarColRange / VarValRange math is faithful.
- First-frame hold, `#current` start capture, pingpong end-swap all mirror the engine.
- Health bar `(0,200,0)` green stop and three-stop formula correct.
- Grave draw-order (z-bias −100000), face-right flip, ghost suppression correct with tests.
- modFlasher is dead code in both trees (startFlasher is never called).
- modProp is a cutscene-only concern; no visual constants at stake.
- glowRed low-health re-arm and glowRed+glowTeal promotion correct.
- pulseWhite invincibility arm/stop correctly wired.
