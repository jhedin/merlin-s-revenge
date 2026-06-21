// Hurt feedback (modFlasher + modReel + modInvince): on takeHit, flash white, show the "reel"
// strip, and grant a brief invincibility window (the player only, so overlapping enemies can't
// chain-kill). Ordered AFTER Energy in the chain so the landing hit applies before i-frames arm.

import { Component, type NextFn } from "../engine/dispatch";
import { ColourTransform } from "./colourTransform";

export class Hurt extends Component {
  static handles = ["update", "takeHit", "isInvince", "isHurt", "isReelProof", "animAction", "grantInvince"];
  invinceFrames = 0; // >0 for the player; enemies flash but take continuous damage
  reelProof = false; // #reelProof: knockback/reel-immune (skelitonHead) — still takes damage, no reel
  private flashT = 0;
  private invinceT = 0;
  private pulsing = false; // modInvince.invinceOn->pulseWhite: the temp-invince white pulse is active

  override init(cfg: Record<string, any>): void {
    this.invinceFrames = typeof cfg["invince"] === "number" ? cfg["invince"] : 0;
    this.reelProof = cfg["reelProof"] === true;
    this.flashT = 0; this.invinceT = 0; this.pulsing = false;
  }
  override reset(): void { this.flashT = 0; this.invinceT = 0; this.pulsing = false; }

  update(next: NextFn): void {
    if (this.flashT > 0) {
      this.flashT--;
      // reel cleared this tick: tell the brain to leave #dazed (characterModeChanged otherwise)
      if (this.flashT === 0 && !this.entity.send("isDead")) this.entity.send("characterModeChanged", "#walk");
    }
    if (this.invinceT > 0) this.invinceT--;
    // invinceOff (modInvince): when the temp-invince window ends, stop the white pulse.
    if (this.pulsing && this.invinceT === 0) { this.entity.tryGet(ColourTransform)?.stopPulseWhite(); this.pulsing = false; }
    next();
  }

  // runs after Energy: damage already applied (Energy honored a prior i-frame), now arm feedback.
  // modReel/objCharacter: every goMode(#reel/#die) notifies pAI via characterModeChanged so the CPU
  // brain enters #dazed (zero intent) while reeling/dying and returns to #findTarget when it clears.
  takeHit(next: NextFn, vx = 0, vy = 0, attackerId = -1, mult = 1): any {
    const r = next(vx, vy, attackerId, mult);
    if ((Math.abs(vx) + Math.abs(vy)) * mult > 0 && !this.entity.send("isInvince")) {
      const dead = this.entity.send("isDead");
      // #reelProof (skelitonHead): immune to the reel/recoil feedback (still takes damage; a lethal hit
      // still notifies #die so the brain stops). A reel-proof unit shows no white flash / reel strip.
      if (!this.reelProof || dead) {
        this.flashT = 6;
        if (this.invinceFrames > 0) this.invinceT = this.invinceFrames;
        // modEnergy.loseEnergy 203: a non-lethal hit plays the real flickWhite (white->black, speed 33)
        // instead of the binary flash. ColourTransform plays it; isHurt still gates the reel anim.
        if (!dead) this.entity.tryGet(ColourTransform)?.flickWhite();
        this.entity.send("characterModeChanged", dead ? "#die" : "#reel");
      }
    }
    return r;
  }

  // startTempInvince (modInvince): a pickup collect grants pTempInvinceTime=200 frames of invincibility
  // (the post-hit i-frame window is separate/shorter). Latches the longer of the two, and arms the white
  // pulse (invinceOn -> pulseWhite) so the player VISIBLY flashes while invincible.
  grantInvince(next: NextFn, frames = 200): void {
    this.invinceT = Math.max(this.invinceT, frames);
    this.pulsing = true;
    this.entity.tryGet(ColourTransform)?.pulseWhite();
    next();
  }

  isInvince(): boolean { return this.invinceT > 0; }
  isHurt(): boolean { return this.flashT > 0; }
  isReelProof(): boolean { return this.reelProof; } // Movement reads this to skip the knockback impulse

  // brief "reel" override (modReel) — falls back to stand for chars with no reel strip
  animAction(next: NextFn): any { return this.flashT > 0 ? "reel" : next(); }
}
