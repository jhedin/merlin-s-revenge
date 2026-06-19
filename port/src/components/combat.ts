// Energy (modEnergy: health, damage, death) and Team (modRelationships allegiance) components.
// takeHit is an ordered chain message (PLAN_REVIEW §1): damage applies here; other listeners
// (e.g. experience) would be ordered before energy so they see the attacker first.

import { Component, type NextFn } from "../engine/dispatch";
import { game } from "../game/context";

export class Energy extends Component {
  static handles = ["takeHit", "isDead", "energyFrac", "addSaveData", "restoreFromSave"];
  energy = 100; max = 100; dead = false; xpReward = 10; dieSound = "";

  override init(cfg: Record<string, any>): void {
    this.max = this.energy = typeof cfg["energy"] === "number" ? cfg["energy"] : 100;
    this.xpReward = typeof cfg["xpReward"] === "number" ? cfg["xpReward"] : Math.max(5, Math.ceil(this.max / 12));
    this.dieSound = typeof cfg["dieSound"] === "string" ? cfg["dieSound"] : "";
    this.dead = false;
  }

  takeHit(next: NextFn, dmg: number, attackerId = -1): void {
    if (this.dead) return;
    this.energy -= dmg;
    if (this.energy <= 0) {
      this.energy = 0; this.dead = true;
      if (this.dieSound) game.audio?.play(this.dieSound, 0.6); // actor #dieSound
      if (attackerId >= 0) {                       // award XP to the killer
        const killer = game.entities.find((e) => e.id === attackerId && !e.send("isDead"));
        killer?.send("gainXp", this.xpReward);
      }
    }
    next(dmg, attackerId);
  }
  isDead(): boolean { return this.dead; }       // query
  energyFrac(): number { return this.max > 0 ? this.energy / this.max : 0; }

  addSaveData(next: NextFn, sd: Record<string, any>): Record<string, any> {
    sd["energy"] = { energy: this.energy, max: this.max, dead: this.dead };
    return next(sd);
  }
  restoreFromSave(next: NextFn, sd: Record<string, any>): Record<string, any> {
    const s = sd["energy"];
    if (s) { this.energy = s.energy; this.max = s.max; this.dead = s.dead; }
    return next(sd);
  }
}

export class Team extends Component {
  static handles = ["getTeam"];
  team = "";
  override init(cfg: Record<string, any>): void { this.team = typeof cfg["team"] === "string" ? cfg["team"] : ""; }
  getTeam(): string { return this.team; }       // query
}
