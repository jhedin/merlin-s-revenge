// Freeze (modFreeze): a timed status that slows the entity to 0.5x speed and (optionally) glows teal.
// takeFreeze is a VECTOR payload (CallPayloadFunction): freeze magnitude = (|vx|+|vy|)·freezeMultiplier·4
// (modFreeze.takeFreeze 70-88), ACCUMULATED across hits (the original subtracts from a count-up-to-1000
// counter, so repeated hits extend the thaw — not a max). First hit only latches `frozen`, halves speed,
// and arms the teal glow; defrost restores 2·curr−speedChange (undoing the halving, accounting for any
// level/potion speed gained while frozen) and stops the glow. Movement queries isFrozen()/freezeFactor().

import { Component, type NextFn } from "../engine/dispatch";
import { ColourTransform } from "./colourTransform";

export class Freeze extends Component {
  static handles = ["update", "takeFreeze", "isFrozen", "freezeFactor"];
  ticks = 0;            // remaining freeze ticks (the "count below 999" the original tracks down)
  frozen = false;       // pFrozen: first-hit latch (slow + teal applied once)
  glowTeal = false;     // pGlowTeal: teal overlay active

  override init(): void { this.ticks = 0; this.frozen = false; this.glowTeal = false; }
  override reset(): void { this.init(); }

  // takeFreeze(vx, vy, attackerId, freezeMultiplier, glowTeal): the vector payload. freezeMultiplier and
  // glowTeal come from the attacking weapon's #attack (passed by the payload dispatch). The first hit
  // latches frozen; every hit ACCUMULATES (|vx|+|vy|)·mult·4 onto the timer.
  takeFreeze(_next: NextFn, vx = 0, vy = 0, _attackerId = -1, freezeMultiplier = 1, glowTeal = false): void {
    if (!this.frozen) {
      this.frozen = true;
      if (glowTeal) {
        this.glowTeal = true;                                  // teal overlay (rendered as the freeze tint)
        this.entity.tryGet(ColourTransform)?.glowTeal();       // modFreeze 57/77-78: glowTeal on freeze
      }
    }
    const add = (Math.abs(vx) + Math.abs(vy)) * freezeMultiplier * 4;
    this.ticks += add;                    // accumulate, not max (faithful multi-hit thaw extension)
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
