// Control components set Movement intent each tick (run before Movement in the chain).
// PlayerControl reads input and fires projectiles; EnemyAI (objAiCPU) beelines and attacks,
// in melee or ranged mode.

import { Component, type NextFn } from "../engine/dispatch";
import { Movement } from "./movement";
import { Mana } from "./mana";
import { game } from "../game/context";
import { fireBullet } from "../systems/bullets";
import { aimedVect } from "../engine/math";
import type { Entity } from "../engine/dispatch";

function nearestOfTypes(x: number, y: number, types: readonly string[], ignore?: Entity): Entity | null {
  let best: Entity | null = null, bestD = Infinity;
  for (const e of game.entities) {
    if (e === ignore || !types.includes(e.type) || e.send("isDead")) continue;
    const p = e.send("getPos") as { x: number; y: number };
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}
const nearestEnemy = (x: number, y: number) => nearestOfTypes(x, y, ["enemy"]);

// energyBlast (act_energyBlast): hold to charge, release at the cursor. There is NO mana pool
// (modAttack): the charge grows from chargeStart (+mana.burst) by chargeSpeed (*mana.flow) up to
// chargeMax = mana.capacity*chargeMaxModifier + chargeMaxBasic; recast is gated by cooldown
// (/mana.regeneration), not by a resource. As capacity/flow/burst grow (potions, levels) blasts get
// bigger/faster. chargeMaxModifier(0.75)/chargeMaxBasic(5)/chargeStart(0)/chargeSpeed(1)/cooldown(30)
// are act_energyBlast's. Damage/bolt-speed are tuned per charge-unit to the px slice (PLAN_REVIEW:
// damage == knockback; full base charge ~12.5 fells a rank-and-file 300-energy enemy).
const SPELL = {
  chargeMaxModifier: 0.75, chargeMaxBasic: 5, chargeStart: 0, chargeSpeed: 1, cooldown: 30,
  dmgPerUnit: 26, speedBase: 4.5, speedPerUnit: 0.28, speedCap: 9, releaseFrames: 6, life: 110,
};
// #punch (#naturalMelee): close-range fallback. cooldown 20, reach ~ hypot(7,10).
const PUNCH = { reach: 18, cooldown: 20, frames: 6 };

export class PlayerControl extends Component {
  static handles = ["update", "levelUp", "animAction", "chargeFrac", "getHasSpell", "addSaveData", "restoreFromSave"];
  power = 0;       // strength -> punch damage (set from cfg)
  meleeReach = PUNCH.reach;
  hasSword = false; // merlinSword equipped -> #weaponMelee strip + longer/stronger swing
  hasSpell = false; // energyBlast acquired -> charged magic enabled (starts punch-only)
  private strength = 8;
  private strengthInc = 0.1;
  private basePower = 0;
  private summonCd = 0;
  private fireCd = 0;
  private meleeCd = 0;
  private charge = 0;
  private charging = false;
  private releaseT = 0;
  private meleeT = 0;
  private aimLeft = false;

  override init(cfg: Record<string, any>): void {
    this.strength = typeof cfg["strength"] === "number" ? cfg["strength"] : 8;
    this.strengthInc = typeof cfg["strengthIncLevel"] === "number" ? cfg["strengthIncLevel"] : 0.1;
    this.basePower = this.power = Math.round(this.strength * 4) + 8; // punch damage from strength (scaled to enemy energy)
    this.meleeReach = PUNCH.reach; this.hasSword = false; this.hasSpell = false;
    this.summonCd = this.fireCd = this.meleeCd = 0;
    this.charge = 0; this.charging = false; this.releaseT = this.meleeT = 0;
  }

  /** merlinSword scroll: a real melee weapon (damageMultiplier 16) — stronger, longer reach. */
  equipSword(): void { this.hasSword = true; this.power = this.basePower + 160; this.meleeReach = 24; }

  /** energyBlast scroll (room 6): grants Merlin his charged magic (modWeaponManager.addWeapon). */
  grantSpell(): void { this.hasSpell = true; }
  getHasSpell(): boolean { return this.hasSpell; } // HUD gates the mana/charge bar on this

  // persist acquired weapons across save/load so a mid-game load keeps sword + magic
  addSaveData(next: NextFn, sd: Record<string, any>): Record<string, any> {
    sd["weapons"] = { hasSword: this.hasSword, hasSpell: this.hasSpell };
    return next(sd);
  }
  restoreFromSave(next: NextFn, sd: Record<string, any>): Record<string, any> {
    const w = sd["weapons"];
    if (w) { if (w.hasSword) this.equipSword(); this.hasSpell = !!w.hasSpell; }
    return next(sd);
  }

  // incStrength on level-up (modCharacterAttackProperties); rescale punch, keep sword bonus
  levelUp(next: NextFn): void {
    this.strength += this.strengthInc;
    this.basePower = Math.round(this.strength * 4) + 8;
    this.power = this.basePower + (this.hasSword ? 160 : 0);
    next();
  }

  update(next: NextFn): void {
    if (this.fireCd > 0) this.fireCd--;
    if (this.meleeCd > 0) this.meleeCd--;
    if (this.summonCd > 0) this.summonCd--;
    if (this.releaseT > 0) this.releaseT--;
    if (this.meleeT > 0) this.meleeT--;
    if (this.entity.send("isDead")) { const m = this.entity.get(Movement); m.intentX = m.intentY = 0; return next(); }

    const input = game.input;
    const m = this.entity.get(Movement);
    const mv = input.moveVector();
    m.intentX = mv.x; m.intentY = mv.y;

    // aim point: the cursor in world space, else the nearest enemy, else current facing
    const cur = input.cursor();
    const target = nearestEnemy(m.x, m.y);
    const aim = cur ?? (target ? target.send("getPos") as { x: number; y: number }
      : { x: m.x + (m.facingLeft ? -100 : 100), y: m.y });
    this.aimLeft = aim.x < m.x;

    if (input.pressed("e") && this.summonCd === 0 && game.spawnAlly) { // summon an army ally (E)
      const a = game.rng.next() * Math.PI * 2;
      game.entities.push(game.spawnAlly("warrior", m.x + Math.cos(a) * 24, m.y + Math.sin(a) * 24));
      this.summonCd = 90;
    }

    // hold-to-charge magic — only once Merlin has collected a spell (energyBlast scroll, room 6).
    // act_player's only weapon is #punch; modWeaponManager adds spells from #objScroll pickups.
    const mana = this.entity.get(Mana);
    const primary = input.mouseDown() || input.held(" ");
    if (this.hasSpell && primary && this.fireCd === 0) {       // no pool gate — always castable when cooled
      if (!this.charging) { this.charge = SPELL.chargeStart + mana.burst; game.audio?.play("spell_charge"); }
      this.charging = true;
      m.facingLeft = this.aimLeft;
      this.charge = Math.min(this.chargeMaxOf(mana), this.charge + SPELL.chargeSpeed * mana.flow);
    } else if (this.charging) {
      this.castMagic(m, aim, mana); // released or cooled down -> fire at whatever charge was held
      this.charging = false; this.charge = 0;
    } else if (this.meleeCd === 0) {
      this.tryPunch(m, target); // no magic (or none acquired yet) -> punch anything in reach
    }
    next();
  }

  private chargeMaxOf(mana: Mana): number { return mana.capacity * SPELL.chargeMaxModifier + SPELL.chargeMaxBasic; }

  private castMagic(m: Movement, aim: { x: number; y: number }, mana: Mana): void {
    const c = this.charge; // already >= chargeStart+burst
    const dmg = Math.round(SPELL.dmgPerUnit * c);
    const speed = Math.min(SPELL.speedCap, SPELL.speedBase + c * SPELL.speedPerUnit);
    fireBullet(this.entity.id, m.x, m.y - 6, aim.x - m.x, (aim.y - 6) - m.y, speed, dmg, this.entity.send("getTeam"), SPELL.life);
    m.facingLeft = this.aimLeft;
    // recast cooldown shortened by mana.regeneration (modCharacterAttackProperties: regen -> cooldown)
    this.fireCd = Math.max(4, Math.round(SPELL.cooldown / mana.regeneration));
    this.releaseT = SPELL.releaseFrames;
    game.audio?.play("spell_release"); // act_energyBlast releaseSound
  }

  private tryPunch(m: Movement, target: Entity | null): void {
    if (!target) return;
    const p = target.send("getPos") as { x: number; y: number };
    if (Math.hypot(p.x - m.x, p.y - m.y) > this.meleeReach) return;
    const v = aimedVect(p.x - m.x, p.y - m.y, this.power); // melee collisionVect aimed at the target
    target.send("takeHit", v.x, v.y, this.entity.id);
    m.facingLeft = p.x < m.x;
    this.meleeCd = PUNCH.cooldown; this.meleeT = PUNCH.frames;
    game.audio?.play(this.hasSword ? "skeleton_fire" : "wizard_punch"); // act_player #punch / merlinSword
  }

  // action override for modAnimSet: melee / release / charge strips take priority over walk/stand
  animAction(): string | null {
    if (this.entity.send("isDead")) return null;
    const moving = this.entity.get(Movement).moving();
    if (this.meleeT > 0) return this.hasSword ? "weaponMelee" : "naturalMelee";
    if (this.releaseT > 0) return moving ? "releasewalk" : "release";
    if (this.charging) return moving ? "chargewalk" : "charge";
    return null;
  }

  chargeFrac(): number { return this.charging ? Math.min(1, this.charge / this.chargeMaxOf(this.entity.get(Mana))) : 0; }
}

export class EnemyAI extends Component {
  static handles = ["update"];
  reach = 22;
  reachRanged = 150;
  power = 8;
  ranged = false;
  cooldown = 0;
  cooldownMax = 18;
  kind: "beeline" | "wander" | "kite" | "bomber" = "beeline"; // from #AiType
  targetTypes: readonly string[] = ["player", "ally"]; // enemies hunt the player + allies
  atkSound = ""; // #attack.sound (played on attack if the file exists)
  private wanderAng = 0; private wanderTimer = 0;
  private detourT = 0; private detourX = 0; private detourY = 0; // wall-detour (pathfinding fallback)

  override init(cfg: Record<string, any>): void {
    // power blends real #attack power (knockback magnitude) with strength
    const strPow = typeof cfg["strength"] === "number" ? cfg["strength"] / 3 : 2;
    const atkPow = typeof cfg["atkPower"] === "number" ? cfg["atkPower"] : 0;
    this.power = Math.max(4, Math.round(strPow + atkPow));
    this.ranged = cfg["ranged"] === true;
    if (typeof cfg["aiKind"] === "string") this.kind = cfg["aiKind"] as EnemyAI["kind"];
    // real #attack cooldown/reach where present, else sensible defaults
    if (typeof cfg["atkCooldown"] === "number") this.cooldownMax = cfg["atkCooldown"] + (this.ranged ? 18 : 6);
    else this.cooldownMax = this.ranged ? 40 : 18;
    if (typeof cfg["atkReach"] === "number") {
      if (this.ranged) this.reachRanged = Math.min(220, Math.max(60, cfg["atkReach"])); // cap magic's 9999
      else this.reach = Math.max(16, Math.min(40, cfg["atkReach"]));
    }
    if (Array.isArray(cfg["targetTypes"])) this.targetTypes = cfg["targetTypes"];
    this.atkSound = typeof cfg["atkSound"] === "string" ? cfg["atkSound"] : "";
    this.cooldown = 0;
  }

  update(next: NextFn): void {
    const m = this.entity.get(Movement);
    if (this.entity.send("isDead")) { m.intentX = 0; m.intentY = 0; return next(); }
    if (this.cooldown > 0) this.cooldown--;
    const target = nearestOfTypes(m.x, m.y, this.targetTypes, this.entity);
    if (!target || target.send("isDead")) { this.idle(m); return next(); }
    const tp = target.send("getPos") as { x: number; y: number };
    const dx = tp.x - m.x, dy = tp.y - m.y;
    const d = Math.hypot(dx, dy) || 1;
    switch (this.kind) {
      case "wander": this.wander(m, dx, dy, d, target); break;
      case "kite": this.kite(m, dx, dy, d, target); break;
      case "bomber": this.bomber(m, dx, dy, d, target); break;
      default: this.beeline(m, dx, dy, d, target);
    }
    next();
  }

  private idle(m: Movement): void { m.intentX = 0; m.intentY = 0; }

  private attack(m: Movement, dx: number, dy: number, target: Entity): void {
    if (this.cooldown !== 0) return;
    if (this.ranged) fireBullet(this.entity.id, m.x, m.y - 6, dx, dy, 4.5, this.power * 2, this.entity.send("getTeam"));
    else { const v = aimedVect(dx, dy, this.power); target.send("takeHit", v.x, v.y, this.entity.id); }
    if (this.atkSound) game.audio?.play(this.atkSound, 0.5); // #attack.sound (quieter than player)
    this.cooldown = this.cooldownMax;
  }

  // Head toward (dx,dy) but, when wedged on a wall (modPathFinding: beeline -> scenic), commit to
  // a perpendicular detour for a short window so the unit slides around obstacles instead of stalling.
  private seek(m: Movement, dx: number, dy: number, d: number): void {
    if (this.detourT > 0) { this.detourT--; m.intentX = this.detourX; m.intentY = this.detourY; return; }
    if (m.hitX || m.hitY) { // blocked last tick -> sidestep perpendicular to the desired heading
      const sign = game.rng.next() < 0.5 ? 1 : -1;
      this.detourX = (-dy / d) * sign; this.detourY = (dx / d) * sign;
      this.detourT = 18;
      m.intentX = this.detourX; m.intentY = this.detourY;
    } else { m.intentX = dx / d; m.intentY = dy / d; }
  }

  // objAiCPU: approach to range, then attack
  private beeline(m: Movement, dx: number, dy: number, d: number, target: Entity): void {
    const range = this.ranged ? this.reachRanged : this.reach;
    if (d > range) this.seek(m, dx, dy, d);
    else { this.idle(m); this.attack(m, dx, dy, target); }
  }

  // objAiCPUSpellCaster: hold at range, back away if crowded, fire
  private kite(m: Movement, dx: number, dy: number, d: number, target: Entity): void {
    const want = this.reachRanged * 0.7;
    if (d < want * 0.6) { m.intentX = -dx / d; m.intentY = -dy / d; }      // too close -> retreat
    else if (d > this.reachRanged) this.seek(m, dx, dy, d);                // too far -> approach
    else this.idle(m);
    if (d <= this.reachRanged) this.attack(m, dx, dy, target);
  }

  // objAiCPUGhost: drift on a slowly-changing heading, attack if a target wanders close
  private wander(m: Movement, dx: number, dy: number, d: number, target: Entity): void {
    if (--this.wanderTimer <= 0) { this.wanderAng = game.rng.next() * Math.PI * 2; this.wanderTimer = 40 + Math.floor(game.rng.next() * 40); }
    // bias the heading toward the target a little
    const bx = Math.cos(this.wanderAng) * 0.7 + (dx / d) * 0.3, by = Math.sin(this.wanderAng) * 0.7 + (dy / d) * 0.3;
    m.intentX = bx; m.intentY = by;
    if (d < this.reach + 6) this.attack(m, dx, dy, target);
  }

  // objAiFlyingBomber: rush the target and self-destruct on contact
  private bomber(m: Movement, dx: number, dy: number, d: number, target: Entity): void {
    this.seek(m, dx, dy, d);
    if (d < 16) {
      const v = aimedVect(dx, dy, this.power * 4); // contact blast aimed at the victim
      target.send("takeHit", v.x, v.y, this.entity.id);
      this.entity.send("takeHit", 999999, 0, this.entity.id); // self-destruct (lethal L1 magnitude)
    }
  }
}
