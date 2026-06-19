// Mana pool (act_player mana_*): the resource Merlin's charged magic draws from. Charge grows
// at chargeSpeed * flow while a spell is held; releasing spends the accumulated charge. Mana
// regenerates one point every `regenTicks`. capacity rises with level (mana_capacityIncLevel).

import { Component, type NextFn } from "../engine/dispatch";
import { game } from "../game/context";

export class Mana extends Component {
  static handles = ["update", "levelUp", "manaFrac", "addSaveData", "restoreFromSave"];
  capacity = 10;   // mana_capacity
  flow = 1;        // mana_flow (charge-rate multiplier)
  burst = 1;       // mana_burst (minimum spend per cast)
  regenTicks = 30; // mana_regeneration (ticks per +1)
  current = 10;
  // per-level increments (modCharacterAttackProperties): one is rolled each level-up
  private capInc = 0.5; private flowInc = 0.1; private burstInc = 0.1; private regenInc = 0.1;
  private regen = 0;

  override init(cfg: Record<string, any>): void {
    if (typeof cfg["mana_capacity"] === "number") this.capacity = cfg["mana_capacity"];
    if (typeof cfg["mana_flow"] === "number") this.flow = cfg["mana_flow"];
    if (typeof cfg["mana_burst"] === "number") this.burst = cfg["mana_burst"];
    if (typeof cfg["mana_regeneration"] === "number") this.regenTicks = cfg["mana_regeneration"];
    if (typeof cfg["mana_capacityIncLevel"] === "number") this.capInc = cfg["mana_capacityIncLevel"];
    if (typeof cfg["mana_flowIncLevel"] === "number") this.flowInc = cfg["mana_flowIncLevel"];
    if (typeof cfg["mana_burstIncLevel"] === "number") this.burstInc = cfg["mana_burstIncLevel"];
    if (typeof cfg["mana_regenerationIncLevel"] === "number") this.regenInc = cfg["mana_regenerationIncLevel"];
    this.current = this.capacity; this.regen = 0;
  }
  override reset(): void { this.current = this.capacity; this.regen = 0; }

  update(next: NextFn): void {
    if (this.current < this.capacity && ++this.regen >= this.regenTicks) { this.regen = 0; this.current++; }
    next();
  }

  // levelUpCharacterAttackProperties: bump one random mana stat each level
  levelUp(next: NextFn): void {
    switch (1 + Math.floor(game.rng.next() * 4)) {
      case 1: this.burst += this.burstInc; break;
      case 2: this.capacity += this.capInc; break;
      case 3: this.flow += this.flowInc; break;
      default: this.regenTicks = Math.max(5, this.regenTicks - this.regenInc); // faster regen
    }
    next();
  }

  // potion increments (modCharacterAttackProperties: capacity/burst +0.75, flow +0.5)
  incCapacity(): void { this.capacity += 0.75; this.current = this.capacity; }
  incFlow(): void { this.flow += 0.5; }
  incBurst(): void { this.burst += 0.75; }

  has(n: number): boolean { return this.current >= Math.max(this.burst, n); }
  spend(n: number): void { this.current = Math.max(0, this.current - Math.max(this.burst, n)); }
  manaFrac(): number { return this.capacity > 0 ? this.current / this.capacity : 0; }

  addSaveData(next: NextFn, sd: Record<string, any>): Record<string, any> {
    sd["mana"] = { current: this.current, capacity: this.capacity };
    return next(sd);
  }
  restoreFromSave(next: NextFn, sd: Record<string, any>): Record<string, any> {
    const s = sd["mana"];
    if (s) { this.current = s.current; this.capacity = s.capacity; }
    return next(sd);
  }
}
