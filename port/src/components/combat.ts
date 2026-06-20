// Energy (modEnergy: health, damage, death) and Team (modRelationships allegiance) components.
// takeHit is an ordered chain message (PLAN_REVIEW §1): damage applies here; other listeners
// (e.g. experience) would be ordered before energy so they see the attacker first.

import { Component, type NextFn } from "../engine/dispatch";
import { game } from "../game/context";

export class Energy extends Component {
  static handles = ["takeHit", "update", "levelUp", "isDead", "energyFrac", "addSaveData", "restoreFromSave"];
  energy = 100; max = 100; dead = false; dieSound = "";
  private baseEnergy = 100;   // original energy, for the per-level increment
  private incPct = 0;         // energyIncPercentage (max grows by this % of baseEnergy per level)
  private recoverDelay = 0;   // energyRecoverDelay (0 = no passive regen)
  private recoverCtr = 0;

  override init(cfg: Record<string, any>): void {
    this.baseEnergy = this.max = this.energy = typeof cfg["energy"] === "number" ? cfg["energy"] : 100;
    this.incPct = typeof cfg["energyIncPercentage"] === "number" ? cfg["energyIncPercentage"] : 0;
    this.recoverDelay = typeof cfg["energyRecoverDelay"] === "number" ? cfg["energyRecoverDelay"] : 0;
    this.dieSound = typeof cfg["dieSound"] === "string" ? cfg["dieSound"] : "";
    this.recoverCtr = 0; this.dead = false;
  }

  // modEnergy.takeHit: damage is the L1 magnitude of the (inertia-damped, by Movement upstream) collision
  // vector times the attack's damageMultiplier. Knockback was already applied by Movement earlier in chain.
  takeHit(next: NextFn, vx = 0, vy = 0, attackerId = -1, mult = 1): void {
    if (this.dead || this.entity.send("isInvince")) return; // i-frames (set by Hurt on a prior hit)
    const dmg = (Math.abs(vx) + Math.abs(vy)) * mult;
    if (dmg > 0) {
      this.energy -= dmg;
      if (this.energy <= 0) {
        this.energy = 0; this.dead = true;
        if (this.dieSound) game.audio?.play(this.dieSound, 0.6); // actor #dieSound
        if (attackerId >= 0) {                       // award XP to the killer (imWorth + half my gained)
          const killer = game.entities.find((e) => e.id === attackerId && !e.send("isDead"));
          killer?.send("gainXp", this.entity.send("getReward") ?? this.imWorthFallback());
        }
      }
    }
    next(vx, vy, attackerId, mult);
  }

  // recoverEnergy: trickle +1 every energyRecoverDelay ticks while below max (modEnergy)
  update(next: NextFn): void {
    if (!this.dead && this.recoverDelay > 0 && this.energy < this.max) {
      if (++this.recoverCtr >= this.recoverDelay) { this.recoverCtr = 0; this.energy++; }
    }
    next();
  }

  // levelUpEnergy: max += baseEnergy * energyIncPercentage/100, heal by the same increment
  levelUp(next: NextFn): void {
    const inc = Math.round(this.baseEnergy * this.incPct / 100);
    if (inc > 0) { this.max += inc; this.energy = Math.min(this.max, this.energy + inc); }
    next();
  }

  private imWorthFallback(): number { return Math.max(3, Math.ceil(this.baseEnergy / 12)); }
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
