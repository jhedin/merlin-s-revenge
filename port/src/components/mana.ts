// Mana (modCharacterAttackProperties) — NOT a depleting pool. These four stats tune Merlin's
// charged magic: capacity sets the max charge a spell reaches (chargeMax = capacity*chargeMaxModifier
// + chargeMaxBasic), flow multiplies the charge rate, burst is added to the starting charge, and
// regeneration divides the recast cooldown. They grow via potions (one stat each) and on level-up
// (one random stat). PlayerControl reads them when casting; there is no resource to run out of.

import { Component, type NextFn } from "../engine/dispatch";
import { game } from "../game/context";

export class Mana extends Component {
  static handles = ["levelUp", "addSaveData", "restoreFromSave"];
  capacity = 10;       // mana_capacity   -> charge ceiling
  flow = 1;            // mana_flow       -> charge-rate multiplier
  burst = 1;           // mana_burst      -> starting-charge bonus
  regeneration = 1;    // mana_regeneration -> cooldown divisor (higher = faster recast)
  // per-level increments (modCharacterAttackProperties): one is rolled each level-up
  // modCharacterAttackProperties defaults: capacity +1/level, the rest +0.1 (the player overrides capacity
  // to 0.5 via act_player; an enemy CPU caster without its own value uses this 1.0 fallback).
  private capInc = 1; private flowInc = 0.1; private burstInc = 0.1; private regenInc = 0.1;

  override init(cfg: Record<string, any>): void {
    if (typeof cfg["mana_capacity"] === "number") this.capacity = cfg["mana_capacity"];
    if (typeof cfg["mana_flow"] === "number") this.flow = cfg["mana_flow"];
    if (typeof cfg["mana_burst"] === "number") this.burst = cfg["mana_burst"];
    if (typeof cfg["mana_regeneration"] === "number") this.regeneration = cfg["mana_regeneration"];
    if (typeof cfg["mana_capacityIncLevel"] === "number") this.capInc = cfg["mana_capacityIncLevel"];
    if (typeof cfg["mana_flowIncLevel"] === "number") this.flowInc = cfg["mana_flowIncLevel"];
    if (typeof cfg["mana_burstIncLevel"] === "number") this.burstInc = cfg["mana_burstIncLevel"];
    if (typeof cfg["mana_regenerationIncLevel"] === "number") this.regenInc = cfg["mana_regenerationIncLevel"];
  }

  // levelUpCharacterAttackProperties: bump one random mana stat each level
  levelUp(next: NextFn): void {
    switch (1 + Math.floor(game.rng.next() * 4)) {
      case 1: this.burst += this.burstInc; break;
      case 2: this.capacity += this.capInc; break;
      case 3: this.flow += this.flowInc; break;
      default: this.regeneration += this.regenInc; // faster recast
    }
    next();
  }

  // potion increments (modCharacterAttackProperties: capacity/burst +0.75, flow +0.5)
  incCapacity(): void { this.capacity += 0.75; }
  incFlow(): void { this.flow += 0.5; }
  incBurst(): void { this.burst += 0.75; }

  addSaveData(next: NextFn, sd: Record<string, any>): Record<string, any> {
    sd["mana"] = { capacity: this.capacity, flow: this.flow, burst: this.burst, regeneration: this.regeneration };
    return next(sd);
  }
  restoreFromSave(next: NextFn, sd: Record<string, any>): Record<string, any> {
    const s = sd["mana"];
    if (s) { this.capacity = s.capacity; this.flow = s.flow; this.burst = s.burst; this.regeneration = s.regeneration ?? 1; }
    return next(sd);
  }
}
