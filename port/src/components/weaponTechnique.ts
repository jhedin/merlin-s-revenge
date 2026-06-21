// WeaponTechnique (modWeaponTechnique): the attack-anim speedup accumulator. While the unit is in its
// #attack mode, each gated cycle adds the character's `technique` to a running `cache`; every full
// ±frameValue (100) of cache is SPENT — positive → frameAdvance (skip an attack-anim frame → the strip
// plays faster), negative → frameExtendDelay (hold a frame → slower). The remainder persists across
// cycles (only init zeroes it), so a high-technique unit's attack anim keeps speeding up the longer it
// attacks. On #levelUp, technique += inc (2). Data: ninja/shrouder = 20 (fast), kongFuChicken = 200
// (very fast), bowOrc/archer = negative (slow); default 0 → the loop never triggers (no anim change).
//
// PORT WIRING: the original gates accumulation on a per-frame counter (pAdditionalFramesCounter, tim[2]
// rising by 1 each spent frame) and acts only when that counter fins. We mirror that: `gate` counts the
// extra frames spent so the accumulation tick rate stays self-throttling, and the spend hooks call into
// Anim (frameAdvance / frameExtendDelay) which the original routes through me.big. The component runs
// AFTER the controller in the chain (it reads attackActive()), and the Anim component reads the pending
// skip/extend on its own update — so a frame skipped here advances the rendered attack strip a frame
// early (faster punches), exactly as modWeaponTechnique.skipFramesForWeaponTechnique does.

import { Component, type NextFn } from "../engine/dispatch";
import { Anim } from "./anim";

export class WeaponTechnique extends Component {
  static handles = ["update", "levelUp"];
  technique = 0;
  private cache = 0;
  private static readonly FRAME_VALUE = 100;
  private static readonly INC = 2;             // pWeaponTechniqueInc
  // pAdditionalFramesCounter: tim[2] grows by 1 per extended frame; we accumulate only when it fins.
  private gateMax = 1;
  private gateCtr = 0;

  override init(cfg: Record<string, any>): void {
    this.technique = typeof cfg["weaponTechnique"] === "number" ? cfg["weaponTechnique"] : 0;
    this.cache = 0; this.gateMax = 1; this.gateCtr = 0;
  }
  override reset(): void { this.cache = 0; this.gateMax = 1; this.gateCtr = 0; }

  // increaseWeaponTechnique on #levelUp (modWeaponTechnique.internalEvent #levelUp).
  levelUp(next: NextFn): void { this.technique += WeaponTechnique.INC; next(); }

  // updateWeaponTechnique: only while the AI is in #attack mode (getAI().getMode() == #attack). The port's
  // controllers expose attackActive() (true during the attack-anim window). Gated by pAdditionalFramesCounter.
  update(next: NextFn): void {
    if (this.technique === 0) return next();           // default 0 → no effect (most actors, the player)
    const active = this.entity.send("attackActive") === true;
    if (!active) { next(); return; }
    if (this.gateCtr >= this.gateMax) {                 // pAdditionalFramesCounter.fin
      this.gateMax = 1; this.gateCtr = 0;               // CounterReset + tim[2] = 1
      this.cache += this.technique;                     // increaseWeaponTechniqueCache
      this.exchange();                                  // exchangeWeaponTechniqueForFrames
    } else {
      this.gateCtr++;                                   // CounterOnce
    }
    next();
  }

  private exchange(): void {
    const anim = this.entity.tryGet(Anim);
    // skipFramesForWeaponTechnique: each full +frameValue → advance the attack strip a frame (faster).
    while (this.cache > WeaponTechnique.FRAME_VALUE) {
      anim?.frameAdvance();
      this.cache -= WeaponTechnique.FRAME_VALUE;
    }
    // addFramesForWeaponTechnique: each full −frameValue → extend the current frame's delay (slower) and
    // bump the gate so the next accumulation waits one extra frame (pAdditionalFramesCounter.tim[2]++).
    while (this.cache < -WeaponTechnique.FRAME_VALUE) {
      anim?.frameExtendDelay(1);
      this.gateMax += 1;
      this.cache += WeaponTechnique.FRAME_VALUE;
    }
  }

  // test/debug accessors
  getCache(): number { return this.cache; }
}
