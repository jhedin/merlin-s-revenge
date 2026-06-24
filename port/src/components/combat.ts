// Energy (modEnergy: health, damage, death) and Team (modRelationships allegiance) components.
// takeHit is an ordered chain message (PLAN_REVIEW §1): damage applies here; other listeners
// (e.g. experience) would be ordered before energy so they see the attacker first.

import { Component, type NextFn } from "../engine/dispatch";
import { game } from "../game/context";
import { ColourTransform } from "./colourTransform";

export class Energy extends Component {
  static handles = ["takeHit", "takeHeal", "increaseEnergy", "loseEnergy", "update", "levelUp", "isDead", "getKilledInAction", "energyFrac", "glowGold", "restoreEnergy", "reviveFull", "colourTransformFin", "addSaveData", "restoreFromSave"];
  private ct(): ColourTransform | undefined { return this.entity.tryGet(ColourTransform); }
  energy = 100; max = 100; dead = false; dieSound = "";
  goldGlow = 0;               // glowGold() frames (cosmetic, rendered as a gold tint)
  killedInAction = false;     // modEnergy.pKilledInAction: set ONLY by lethal damage (never by cull/retire)
  private baseEnergy = 100;   // original energy, for the per-level increment
  private minEnergy = 0;      // #minEnergy: the energy at/below which the unit dies (multistage enemies)
  private incPct = 0;         // energyIncPercentage (max grows by this % of baseEnergy per level)
  private recoverDelay = 0;   // energyRecoverDelay (0 = no passive regen)
  private recoverCtr = 0;
  private static readonly GLOW_RED_PCT = 50; // modEnergy.pGlowRedPercentage: glow red below 50% health

  override init(cfg: Record<string, any>): void {
    this.baseEnergy = this.energy = typeof cfg["energy"] === "number" ? cfg["energy"] : 100;
    // modEnergy #maxEnergy: #auto (default) -> max = starting energy; an explicit value sets a HIGHER ceiling
    // (hydra bosses: maxEnergy 1500 with energy 500/1000), so the health bar reads energy/maxEnergy and the
    // unit can heal/regen above its start. Was hardcoded max = energy, so hydras read 100% at a 33%/67% start.
    this.max = typeof cfg["maxEnergy"] === "number" ? cfg["maxEnergy"] : this.baseEnergy;
    this.minEnergy = typeof cfg["minEnergy"] === "number" ? cfg["minEnergy"] : 0;
    this.incPct = typeof cfg["energyIncPercentage"] === "number" ? cfg["energyIncPercentage"] : 0;
    this.recoverDelay = typeof cfg["energyRecoverDelay"] === "number" ? cfg["energyRecoverDelay"] : 0;
    this.dieSound = typeof cfg["dieSound"] === "string" ? cfg["dieSound"] : "";
    this.recoverCtr = 0; this.dead = false; this.killedInAction = false;
  }

  // modEnergy.takeHit: damage is the L1 magnitude of the (inertia-damped, by Movement upstream) collision
  // vector times the attack's damageMultiplier. Knockback was already applied by Movement earlier in chain.
  takeHit(next: NextFn, vx = 0, vy = 0, attackerId = -1, mult = 1): void {
    if (this.dead || this.entity.send("isInvince")) return; // i-frames (set by Hurt on a prior hit)
    const dmg = (Math.abs(vx) + Math.abs(vy)) * mult;
    if (dmg > 0) {
      this.energy -= dmg;
      // #minEnergy: multistage enemies (hydra) die at minEnergy, not 0 — at which point they reincarnate
      // down a tier. Default 0 (die at <=0). modEnergy.loseEnergy: checkDead = pEnergy <= pMinEnergy.
      if (this.energy <= this.minEnergy) {
        this.energy = this.minEnergy; this.dead = true;
        this.killedInAction = true;             // modEnergy.pKilledInAction — set ONLY here (lethal damage)
        if (this.dieSound) game.audio?.play(this.dieSound, 0.6); // actor #dieSound
        if (attackerId >= 0) {                       // award XP to the killer (imWorth + half my gained)
          const killer = game.entities.find((e) => e.id === attackerId && !e.send("isDead"));
          killer?.send("gainXp", this.entity.send("getReward") ?? this.imWorthFallback());
        }
      }
      // glowRedOnLowHealth (modEnergy 125-129): below the threshold % -> arm the red low-health glow.
      if (!this.dead) this.glowRedOnLowHealth();
    }
    next(vx, vy, attackerId, mult);
  }

  // glowRedOnLowHealth: glow red while health < pGlowRedPercentage (50%). Re-armed on #colourTransformFin
  // so it keeps pinging while still hurt (internalEvent 158-160). flickWhite from a hit cancels it briefly.
  private glowRedOnLowHealth(): void {
    if (this.max > 0 && (this.energy / this.max) * 100 < Energy.GLOW_RED_PCT) this.ct()?.glowRed();
  }
  // re-arm the low-health glow when any transform finishes (the white hit-flick clears -> red resumes).
  colourTransformFin(next: NextFn): void { if (!this.dead) this.glowRedOnLowHealth(); return next(); }

  // modEnergy.takeHeal: healAmount = (|vx|+|vy|)·2 (same L1-of-vector shape as damage, ×2), clamp to
  // max, gold glow. Friendly — no i-frames. The vector is the SAME radial collision vector the splash
  // resolver builds, so a friendly nearer the heal-blast centre heals more (cite modEnergy.txt 256-265).
  takeHeal(next: NextFn, vx = 0, vy = 0, _healerId = -1): void {
    if (this.dead) return;
    const healAmount = (Math.abs(vx) + Math.abs(vy)) * 2;
    if (healAmount > 0) {
      this.energy = Math.min(this.max, this.energy + healAmount);
      this.ct()?.glowGold();                                          // modEnergy 264: heal -> gold glow
      // increaseEnergy 142-144: stop the low-health red glow once back above the threshold.
      if (this.max > 0 && (this.energy / this.max) * 100 >= Energy.GLOW_RED_PCT) this.ct()?.stopGlowRed();
      this.goldGlow = 12;
    }
    next(vx, vy, _healerId);
  }
  // glowGold (modEnergy.glowGold): plays the gold->fadeGoldBlack heal tint via ColourTransform.
  glowGold(next: NextFn): void { this.goldGlow = 12; this.ct()?.glowGold(); return next(); }

  // modEnergy.loseEnergy (200-220): subtract `amount` and run the SAME death block as takeHit (dead +
  // killedInAction + dieSound + XP to the attacker; the combat tick then fires #leaveGame and reincarnate.ts
  // spawns children — all driven off isDead). Unlike takeHit this carries NO collision vector: no knockback,
  // no reel. Used for ENVIRONMENTAL damage (a reeling unit slammed into a wall — objCPUCharacter.collisionWall).
  loseEnergy(next: NextFn, amount = 0, attackerId = -1): any {
    if (this.dead || amount <= 0) return next(amount);
    this.energy -= amount;
    if (this.energy <= this.minEnergy) {
      this.energy = this.minEnergy; this.dead = true; this.killedInAction = true;
      if (this.dieSound) game.audio?.play(this.dieSound, 0.6);
      if (attackerId >= 0) {
        const killer = game.entities.find((e) => e.id === attackerId && !e.send("isDead"));
        killer?.send("gainXp", this.entity.send("getReward") ?? this.imWorthFallback());
      }
    } else {
      this.ct()?.flickWhite();      // modEnergy.loseEnergy 203: a non-lethal hit flicks white
      this.glowRedOnLowHealth();
    }
    return next(amount);
  }
  // modEnergy.increaseEnergy (133-147): add `amount` to energy (capped at max), and stop the low-health red
  // glow once back above the threshold. Crucially NO gold glow — that belongs to takeHeal (heal-SPELL
  // impacts) only. The pickup +25 bonus and the maxikit full-heal go through HERE, not takeHeal.
  increaseEnergy(next: NextFn, amount = 0): any {
    this.energy = Math.min(this.max, this.energy + amount);
    if (this.max > 0 && (this.energy / this.max) * 100 >= Energy.GLOW_RED_PCT) this.ct()?.stopGlowRed();
    return next(amount);
  }
  // modEnergy.restoreEnergy: refill to max (used by modExtraLives.respawn after death).
  restoreEnergy(next: NextFn): void { this.energy = this.max; next(); }
  // reviveFull: clear the dead latch + refill (an in-place respawn brings the actor back to life).
  reviveFull(next: NextFn): void { this.dead = false; this.killedInAction = false; this.energy = this.max; next(); }

  // recoverEnergy: trickle +1 every energyRecoverDelay ticks while below max (modEnergy)
  update(next: NextFn): void {
    if (this.goldGlow > 0) this.goldGlow--;
    if (!this.dead && this.recoverDelay > 0 && this.energy < this.max) {
      if (++this.recoverCtr >= this.recoverDelay) { this.recoverCtr = 0; this.energy++; }
    }
    next();
  }

  // levelUpEnergy (modEnergy): max += baseEnergy * energyIncPercentage/100, heal by the same increment.
  // The increment can be NEGATIVE: dwellings carry energyIncPercentage -1, so each level (= each resident
  // released) shrinks their max. Apply inc != 0 (was inc > 0, which silently dropped the dwelling decay);
  // floor max at 1 so a long-lived dwelling can't collapse to a non-positive cap.
  levelUp(next: NextFn): void {
    // modEnergy keeps pEnergyIncAmount FRACTIONAL (params.energy·incPct/100, no rounding), so a small-HP
    // unit grows by sub-integer steps (a 50-HP bat at 1% = +0.5/level). Rounding doubled that growth.
    const inc = this.baseEnergy * this.incPct / 100;
    if (inc !== 0) { this.max = Math.max(1, this.max + inc); this.energy = Math.min(this.max, this.energy + inc); }
    next();
  }

  private imWorthFallback(): number { return Math.max(3, Math.ceil(this.baseEnergy / 12)); }
  isDead(): boolean { return this.dead; }       // query
  // getKilledInAction (modEnergy.pKilledInAction): true only when this unit went down from lethal damage.
  // A room-exit / #leaveWhenFinished retire / screen-clear removes the entity WITHOUT a lethal takeHit, so
  // killedInAction stays false — the gate Reincarnate uses so a retiring ally (monk) doesn't split.
  getKilledInAction(): boolean { return this.killedInAction; }
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
  static handles = ["getTeam", "getTeamRole"];
  team = "";
  role = "#teamMembers"; // joinTeam role: #teamMembers (units) or #teamBuildings (dwellings)
  registered = false;    // true while joined to teamMaster's roster (reconciled by the combat tick)
  override init(cfg: Record<string, any>): void {
    this.team = typeof cfg["team"] === "string" ? cfg["team"] : "";
    this.role = typeof cfg["teamRole"] === "string" ? cfg["teamRole"] : "#teamMembers";
    this.registered = false;
  }
  override reset(): void { this.registered = false; }
  getTeam(): string { return this.team; }       // query
  getTeamRole(): string { return this.role; }   // query (obj.getTeamRole())
}

// Targeting (the attacker-side #attack.target* config, read generically by TeamMaster.findTarget /
// impactMeleeAttack). Resolved from #attack at spawn; defaults match structAttack.
export class Targeting extends Component {
  static handles = ["getTargeting"];
  allegiance = "#enemy";
  criteria = "#closestDistance";
  targetRoles: string[][] = [["#teamMembers", "#teamBuildings"]];
  hits: string[] = ["#teamMembers"];
  reach = 18;

  override init(cfg: Record<string, any>): void {
    if (typeof cfg["targetAllegiance"] === "string") this.allegiance = cfg["targetAllegiance"];
    if (typeof cfg["targetCriteria"] === "string") this.criteria = cfg["targetCriteria"];
    if (Array.isArray(cfg["targetRoles"])) this.targetRoles = cfg["targetRoles"];
    if (Array.isArray(cfg["hits"])) this.hits = cfg["hits"];
    if (typeof cfg["targetReach"] === "number") this.reach = cfg["targetReach"];
  }
  getTargeting(): { allegiance: string; criteria: string; targetRoles: string[][]; hits: string[]; reach: number } {
    return { allegiance: this.allegiance, criteria: this.criteria, targetRoles: this.targetRoles, hits: this.hits, reach: this.reach };
  }
}
