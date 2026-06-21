// Freeze (modFreeze): a timed status that slows the entity to 0.5x speed and (optionally) glows teal.
// takeFreeze is a VECTOR payload (CallPayloadFunction): freeze magnitude = (|vx|+|vy|)·freezeMultiplier·4
// (modFreeze.takeFreeze 70-88), accumulated across hits so repeated hits extend the thaw — but BOUNDED by
// the original's `pFreezeCounter.tim = [0, 1000]`: the count is set to 999 then subtracted toward 0 and
// counts up to 1000, so the remaining freeze can never exceed ~1000 ticks no matter how many hits land
// (CounterSetCount clamps to tim). The port mirrors that cap (FREEZE_MAX). First hit only latches `frozen`,
// halves speed, and arms the teal glow; defrost restores 2·curr−speedChange (undoing the halving,
// accounting for any level/potion speed gained while frozen) and stops the glow.

import { Component, type NextFn } from "../engine/dispatch";
import { ColourTransform } from "./colourTransform";

// modFreeze.init: pFreezeCounter.tim = [0, 1000] — the freeze counter's hard ceiling. The remaining freeze
// (the port's `ticks`) maxes out at this bound regardless of how many freeze hits stack (the count clamps
// to 0, giving at most 1000 ticks of thaw). Without it, freeze-spam could lock an actor permanently.
const FREEZE_MAX = 1000;

export class Freeze extends Component {
  static handles = ["update", "takeFreeze", "isFrozen", "freezeFactor", "colourTransformFin"];
  ticks = 0;            // remaining freeze ticks (the "count below 1000" the original tracks down)
  frozen = false;       // pFrozen: first-hit latch (slow + teal applied once)
  glowTeal = false;     // pGlowTeal: teal overlay active

  override init(): void { this.ticks = 0; this.frozen = false; this.glowTeal = false; }
  override reset(): void { this.init(); }

  // takeFreeze(vx, vy, attackerId, freezeMultiplier, glowTeal): the vector payload. freezeMultiplier and
  // glowTeal come from the attacking weapon's #attack (passed by the payload dispatch). The first hit
  // latches frozen; every hit accumulates (|vx|+|vy|)·mult·4 onto the timer, CLAMPED to FREEZE_MAX.
  takeFreeze(_next: NextFn, vx = 0, vy = 0, _attackerId = -1, freezeMultiplier = 1, glowTeal = false): void {
    if (!this.frozen) {
      this.frozen = true;
      if (glowTeal) {
        this.glowTeal = true;                                  // teal overlay (rendered as the freeze tint)
        this.entity.tryGet(ColourTransform)?.glowTeal();       // modFreeze 57/77-78: glowTeal on freeze
      }
    }
    const add = (Math.abs(vx) + Math.abs(vy)) * freezeMultiplier * 4;
    this.ticks = Math.min(FREEZE_MAX, this.ticks + add);  // bounded by the original's tim[2]=1000 ceiling
  }

  // modFreeze.internalEvent #colourTransformFin (55-58): glowTeal is non-pingpong, so it FINISHES in ~1 tick
  // (speed 100). Re-arm it each time it finishes to HOLD the teal glow for the whole freeze duration —
  // without this the frozen unit only flashes teal for ~2 frames instead of staying tinted while frozen.
  colourTransformFin(next: NextFn): any {
    if (this.glowTeal && this.ticks > 0) this.entity.tryGet(ColourTransform)?.glowTeal();
    return next();
  }

  isFrozen(): boolean { return this.ticks > 0; }
  // Movement speed scale while frozen (modFreeze setSpeed(0.5x); defrost restores). 0.5 frozen, 1 thawed.
  freezeFactor(): number { return this.ticks > 0 ? 0.5 : 1; }

  update(next: NextFn): void {
    if (this.ticks > 0) {
      this.ticks--;
      if (this.ticks <= 0) {
        this.ticks = 0; this.frozen = false;
        if (this.glowTeal) { this.glowTeal = false; this.entity.tryGet(ColourTransform)?.stopGlowTeal(); } // defrost -> stop teal
      }
    }
    next();
  }
}
