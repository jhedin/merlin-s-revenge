// Medikit (casts/script_objects/modMedikit.txt) — a STOCKPILED, GRADUAL heal, not an instant top-up.
// Collecting a medikit BANKS a kit (numOfMedikits += 1). While the player is below max energy, the active
// kit heals +1 every healDelay (5) frames until exhausted, then the next banked kit refills the active kit
// to getMaxEnergy(). The HUD count (getNumOfMedikits) = banked + (1 if a partial kit is mid-heal). The
// whole state persists in the player's save chain (the `medikit` slice). maxikit banks a bigger stockpile.

import { Component, type NextFn } from "../engine/dispatch";
import { Counter } from "../engine/counter";
import { Energy } from "./combat";

const HEAL_DELAY = 5;   // tim[2] — heal every 5 frames
const HEAL_AMOUNT = 1;  // pHealAmount

export class Medikit extends Component {
  static handles = ["update", "medikitCollected", "getNumOfMedikits", "addSaveData", "restoreFromSave"];
  numOfMedikits = 0;          // pNumOfMedikits — banked kits
  remainingHitpoints = 0;     // pRemainingHitpoints — hp left in the ACTIVE kit
  active = false;             // pMedikitActive
  private healDelay = new Counter(HEAL_DELAY, 1); // tim[2]=5, fires on fin

  override init(): void {
    this.numOfMedikits = 0; this.remainingHitpoints = 0; this.active = false;
    this.healDelay = new Counter(HEAL_DELAY, 1);
  }
  override reset(): void { this.init(); }

  // medikitCollected (101-105): bank `kits` more kits (1 for a medikit, more for a maxikit per the data).
  medikitCollected(_next: NextFn, kits = 1): void { this.numOfMedikits += kits; }

  // getNumOfMedikits (82-90): banked + (1 if a partial kit is mid-heal). The HUD count.
  getNumOfMedikits(): number { return this.numOfMedikits + (this.remainingHitpoints > 0 ? 1 : 0); }

  // update (119-128): while energy < max, attemptHeal; else deactivate.
  update(next: NextFn): void {
    const en = this.entity.tryGet(Energy);
    if (en && !en.dead && en.energy < en.max) {
      this.attemptHeal(en); // checkEnergyIsAtMax() = false -> attemptHeal (ticks the delay, heals/loads)
    } else {
      this.active = false;
    }
    next();
  }

  // attemptHeal (50-68): Counter(pHealDelayCounter); on fin, heal 1 from the active kit, else load next.
  private attemptHeal(en: Energy): void {
    this.healDelay.tick();
    if (!this.healDelay.fin) return;
    if (this.remainingHitpoints > 0) {
      this.remainingHitpoints -= HEAL_AMOUNT;
      en.energy = Math.min(en.max, en.energy + HEAL_AMOUNT);
      this.active = true;
    } else {
      this.active = false;
      this.nextMedikit(en);
    }
  }

  // nextMedikit (92-99): consume a banked kit and refill the active kit to max energy.
  private nextMedikit(en: Energy): void {
    if (this.numOfMedikits > 0) {
      this.numOfMedikits -= 1;
      this.remainingHitpoints = en.max;
      this.active = true;
    } else {
      this.active = false;
    }
  }

  // addSaveData/restoreFromSave (40-117): persist the stockpile + active kit + delay counter.
  addSaveData(next: NextFn, sd: Record<string, any>): Record<string, any> {
    sd["medikit"] = {
      numOfMedikits: this.numOfMedikits,
      remainingHitpoints: this.remainingHitpoints,
      active: this.active,
      healDelay: this.healDelay.save(),
    };
    return next(sd);
  }
  restoreFromSave(next: NextFn, sd: Record<string, any>): Record<string, any> {
    const s = sd["medikit"];
    if (s) {
      this.numOfMedikits = s.numOfMedikits ?? 0;
      this.remainingHitpoints = s.remainingHitpoints ?? 0;
      this.active = !!s.active;
      if (s.healDelay) this.healDelay = Counter.restore(s.healDelay);
    }
    return next(sd);
  }
}
