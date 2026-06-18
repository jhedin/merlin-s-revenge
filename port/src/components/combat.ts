// Energy (modEnergy: health, damage, death) and Team (modRelationships allegiance) components.
// takeHit is an ordered chain message (PLAN_REVIEW §1): damage applies here; other listeners
// (e.g. experience) would be ordered before energy so they see the attacker first.

import { Component, type NextFn } from "../engine/dispatch";

export class Energy extends Component {
  static handles = ["takeHit", "isDead", "energyFrac"];
  energy = 100; max = 100; dead = false;

  override init(cfg: Record<string, any>): void {
    this.max = this.energy = typeof cfg["energy"] === "number" ? cfg["energy"] : 100;
    this.dead = false;
  }

  takeHit(next: NextFn, dmg: number): void {
    if (this.dead) return;
    this.energy -= dmg;
    if (this.energy <= 0) { this.energy = 0; this.dead = true; }
    next(dmg);
  }
  isDead(): boolean { return this.dead; }       // query
  energyFrac(): number { return this.max > 0 ? this.energy / this.max : 0; }
}

export class Team extends Component {
  static handles = ["getTeam"];
  team = "";
  override init(cfg: Record<string, any>): void { this.team = typeof cfg["team"] === "string" ? cfg["team"] : ""; }
  getTeam(): string { return this.team; }       // query
}
