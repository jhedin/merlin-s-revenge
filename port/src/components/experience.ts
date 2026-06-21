// Experience (modExperience): records the attacker on takeHit (BEFORE energy applies damage — the
// ordering contract from PLAN_REVIEW §1), accumulates cumulative XP, and levels up on a rising
// absolute threshold. Faithful to modExperience.attemptToLevelUp:
//   nextThreshold = (L^3 + L^2 + prevThreshold/(L+1)) + 5 + initThreshold
// A kill awards the victim's #experienceImWorth plus half the victim's own gained XP, and a unit
// can gain several levels from one kill. Levels start at 0. Level-up fans out via #levelUp.

import { Component, type NextFn } from "../engine/dispatch";
import { game } from "../game/context";

export class Experience extends Component {
  static handles = ["takeHit", "gainXp", "getLevel", "getReward", "forceLevelUp", "addSaveData", "restoreFromSave"];
  xp = 0;                 // cumulative experience gained
  level = 0;
  imWorth = 3;            // experience this unit is worth to its killer
  lastAttacker = -1;
  private threshold = 10; // absolute XP needed to reach the next level
  private initThreshold = 10;
  private lastThreshold = 0;

  override init(cfg: Record<string, any>): void {
    this.xp = 0; this.level = 0; this.lastAttacker = -1;
    this.initThreshold = typeof cfg["experienceAmountForNextLevel"] === "number" ? cfg["experienceAmountForNextLevel"] : 10;
    this.threshold = this.initThreshold; this.lastThreshold = 0;
    this.imWorth = typeof cfg["experienceImWorth"] === "number" ? cfg["experienceImWorth"] : 3;
  }

  // ordered before Energy: record who hit us, then forward the (vx,vy,attacker,mult) collision payload
  takeHit(next: NextFn, vx = 0, vy = 0, attackerId = -1, mult = 1): void {
    if (attackerId >= 0) this.lastAttacker = attackerId;
    next(vx, vy, attackerId, mult);
  }

  gainXp(_next: NextFn, amount: number): void {
    this.xp += amount;
    while (this.attemptLevelUp()) { /* a single kill can grant several levels */ }
  }

  // the killer earns imWorth + half the victim's own gained XP (modExperience.attributeExperience)
  getReward(): number { return this.imWorth + Math.floor(this.xp / 2); }

  getLevel(): number { return this.level; }
  frac(): number { const span = this.threshold - this.lastThreshold; return span > 0 ? (this.xp - this.lastThreshold) / span : 0; }

  // forceLevelUp (armyMaster.restoreArmyDetails route i, plan §C.4): advance the unit ONE level and fan
  // out #levelUp (Energy/Mana/control grow), WITHOUT requiring accumulated XP — used to re-field a banked
  // reserve unit at its saved level (levelUpToStartingLevel semantics). Threshold advances like a real
  // level so future XP gates stay consistent.
  forceLevelUp(next: NextFn): void {
    const L = this.level;
    this.lastThreshold = this.threshold;
    this.threshold = (L * L * L + L * L + this.threshold / (L + 1)) + 5 + this.initThreshold;
    this.level++;
    this.entity.send("levelUp");
    next();
  }

  private attemptLevelUp(): boolean {
    if (this.xp < this.threshold) return false;
    const L = this.level;
    this.lastThreshold = this.threshold;
    this.threshold = (L * L * L + L * L + this.threshold / (L + 1)) + 5 + this.initThreshold;
    this.level++;
    this.entity.send("levelUp"); // Energy/Mana/control respond (modEnergy/modCharacterAttackProperties)
    if (this.entity.type === "player") game.audio?.play("level_up");
    // modExperience.levelUp (pReleaseStarOnLevel, default true): release a star to signify the level-up.
    // starMaster.experienceStar spawns it at the unit, rising — for EVERY unit, not just the player.
    const pos = this.entity.send("getPos") as { x: number; y: number } | undefined;
    if (pos) game.effects?.spawnLevelUpStar(pos.x, pos.y);
    return true;
  }

  addSaveData(next: NextFn, sd: Record<string, any>): Record<string, any> {
    sd["xp"] = { xp: this.xp, level: this.level, threshold: this.threshold, lastThreshold: this.lastThreshold };
    return next(sd);
  }
  restoreFromSave(next: NextFn, sd: Record<string, any>): Record<string, any> {
    const s = sd["xp"];
    if (s) { this.xp = s.xp; this.level = s.level; this.threshold = s.threshold; this.lastThreshold = s.lastThreshold; }
    return next(sd);
  }
}
