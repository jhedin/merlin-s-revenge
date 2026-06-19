// Mana pool (act_player mana_*): the resource Merlin's charged magic draws from. Charge grows
// at chargeSpeed * flow while a spell is held; releasing spends the accumulated charge. Mana
// regenerates one point every `regenTicks`. capacity rises with level (mana_capacityIncLevel).

import { Component, type NextFn } from "../engine/dispatch";

export class Mana extends Component {
  static handles = ["update", "manaFrac", "addSaveData", "restoreFromSave"];
  capacity = 10;   // mana_capacity
  flow = 1;        // mana_flow (charge-rate multiplier)
  burst = 1;       // mana_burst (minimum spend per cast)
  regenTicks = 30; // mana_regeneration (ticks per +1)
  current = 10;
  private regen = 0;

  override init(cfg: Record<string, any>): void {
    if (typeof cfg["mana_capacity"] === "number") this.capacity = cfg["mana_capacity"];
    if (typeof cfg["mana_flow"] === "number") this.flow = cfg["mana_flow"];
    if (typeof cfg["mana_burst"] === "number") this.burst = cfg["mana_burst"];
    if (typeof cfg["mana_regeneration"] === "number") this.regenTicks = cfg["mana_regeneration"];
    this.current = this.capacity; this.regen = 0;
  }
  override reset(): void { this.current = this.capacity; this.regen = 0; }

  update(next: NextFn): void {
    if (this.current < this.capacity && ++this.regen >= this.regenTicks) { this.regen = 0; this.current++; }
    next();
  }

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
