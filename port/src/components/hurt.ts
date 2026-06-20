// Hurt feedback (modFlasher + modReel + modInvince): on takeHit, flash white, show the "reel"
// strip, and grant a brief invincibility window (the player only, so overlapping enemies can't
// chain-kill). Ordered AFTER Energy in the chain so the landing hit applies before i-frames arm.

import { Component, type NextFn } from "../engine/dispatch";

export class Hurt extends Component {
  static handles = ["update", "takeHit", "isInvince", "isHurt", "animAction"];
  invinceFrames = 0; // >0 for the player; enemies flash but take continuous damage
  private flashT = 0;
  private invinceT = 0;

  override init(cfg: Record<string, any>): void {
    this.invinceFrames = typeof cfg["invince"] === "number" ? cfg["invince"] : 0;
    this.flashT = 0; this.invinceT = 0;
  }
  override reset(): void { this.flashT = 0; this.invinceT = 0; }

  update(next: NextFn): void {
    if (this.flashT > 0) this.flashT--;
    if (this.invinceT > 0) this.invinceT--;
    next();
  }

  // runs after Energy: damage already applied (Energy honored a prior i-frame), now arm feedback
  takeHit(next: NextFn, vx = 0, vy = 0, attackerId = -1, mult = 1): any {
    const r = next(vx, vy, attackerId, mult);
    this.flashT = 6;
    if (this.invinceFrames > 0) this.invinceT = this.invinceFrames;
    return r;
  }

  isInvince(): boolean { return this.invinceT > 0; }
  isHurt(): boolean { return this.flashT > 0; }

  // brief "reel" override (modReel) — falls back to stand for chars with no reel strip
  animAction(next: NextFn): any { return this.flashT > 0 ? "reel" : next(); }
}
