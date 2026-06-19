// Freeze (modFreeze): a timed status that slows the entity. takeFreeze(ticks) applies it;
// Movement queries isFrozen() to scale its speed; a teal overlay marks frozen entities.

import { Component, type NextFn } from "../engine/dispatch";

export class Freeze extends Component {
  static handles = ["update", "takeFreeze", "isFrozen"];
  ticks = 0;

  override init(): void { this.ticks = 0; }
  override reset(): void { this.ticks = 0; }

  takeFreeze(_next: NextFn, ticks: number): void { this.ticks = Math.max(this.ticks, ticks); }
  isFrozen(): boolean { return this.ticks > 0; }

  update(next: NextFn): void {
    if (this.ticks > 0) this.ticks--;
    next();
  }
}
