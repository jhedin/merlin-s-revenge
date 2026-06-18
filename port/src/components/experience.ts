// Experience (modExperience): records the attacker on takeHit (BEFORE energy applies damage —
// the ordering contract from PLAN_REVIEW §1), accumulates XP via gainXp, and levels up on a
// rising threshold, boosting max energy.

import { Component, type NextFn } from "../engine/dispatch";
import { Energy } from "./combat";

export class Experience extends Component {
  static handles = ["takeHit", "gainXp", "getLevel"];
  xp = 0; level = 1; lastAttacker = -1;

  override init(): void { this.xp = 0; this.level = 1; this.lastAttacker = -1; }

  // ordered before Energy in the chain: record who hit us, then forward
  takeHit(next: NextFn, dmg: number, attackerId = -1): void {
    if (attackerId >= 0) this.lastAttacker = attackerId;
    next(dmg, attackerId);
  }

  gainXp(_next: NextFn, amount: number): void {
    this.xp += amount;
    while (this.xp >= this.needed()) { this.xp -= this.needed(); this.levelUp(); }
  }

  getLevel(): number { return this.level; }
  needed(): number { return 40 * this.level * this.level; }
  frac(): number { return this.xp / this.needed(); }

  private levelUp(): void {
    this.level++;
    const en = this.entity.tryGet(Energy);
    if (en) { en.max = Math.round(en.max * 1.15); en.energy = en.max; } // level-up heal + bigger pool
  }
}
