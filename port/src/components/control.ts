// Control components set Movement intent each tick (run before Movement in the chain).
// PlayerControl reads input and fires projectiles; EnemyAI (objAiCPU) beelines and attacks,
// in melee or ranged mode.

import { Component, type NextFn } from "../engine/dispatch";
import { Movement } from "./movement";
import { game } from "../game/context";
import { fireBullet } from "../systems/bullets";
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

export class PlayerControl extends Component {
  static handles = ["update"];
  cooldown = 0;
  summonCd = 0;
  update(next: NextFn): void {
    if (this.cooldown > 0) this.cooldown--;
    if (this.summonCd > 0) this.summonCd--;
    if (!this.entity.send("isDead")) {
      const mv = game.input.moveVector();
      const m = this.entity.get(Movement);
      m.intentX = mv.x; m.intentY = mv.y;
      if (game.input.pressed("q") && this.summonCd === 0 && game.spawnAlly) { // summon a warrior ally
        const a = game.rng.next() * Math.PI * 2;
        game.entities.push(game.spawnAlly("warrior", m.x + Math.cos(a) * 24, m.y + Math.sin(a) * 24));
        this.summonCd = 90;
      }
      if (game.input.pressed(" ") && this.cooldown === 0) {
        const target = nearestEnemy(m.x, m.y);
        const dir = target ? target.send("getPos") as { x: number; y: number }
          : { x: m.x + (m.facingLeft ? -1 : 1) * 100, y: m.y };
        // player's bolt also briefly freezes on hit (#takeFreeze payload, arcticBlast-style)
        fireBullet(this.entity.id, m.x, m.y - 6, dir.x - m.x, dir.y - m.y, 6.5, 80, this.entity.send("getTeam"), 100, 36);
        this.cooldown = 5;
      }
    }
    next();
  }
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
  private wanderAng = 0; private wanderTimer = 0;

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
    else target.send("takeHit", this.power, this.entity.id);
    this.cooldown = this.cooldownMax;
  }

  // objAiCPU: approach to range, then attack
  private beeline(m: Movement, dx: number, dy: number, d: number, target: Entity): void {
    const range = this.ranged ? this.reachRanged : this.reach;
    if (d > range) { m.intentX = dx / d; m.intentY = dy / d; }
    else { this.idle(m); this.attack(m, dx, dy, target); }
  }

  // objAiCPUSpellCaster: hold at range, back away if crowded, fire
  private kite(m: Movement, dx: number, dy: number, d: number, target: Entity): void {
    const want = this.reachRanged * 0.7;
    if (d < want * 0.6) { m.intentX = -dx / d; m.intentY = -dy / d; }      // too close -> retreat
    else if (d > this.reachRanged) { m.intentX = dx / d; m.intentY = dy / d; } // too far -> approach
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
    m.intentX = dx / d; m.intentY = dy / d;
    if (d < 16) {
      target.send("takeHit", this.power * 4, this.entity.id);
      this.entity.send("takeHit", 999999, this.entity.id); // explode
    }
  }
}
