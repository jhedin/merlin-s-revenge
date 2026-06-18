// Control components set Movement intent each tick (run before Movement in the chain).
// PlayerControl reads input and fires projectiles; EnemyAI (objAiCPU) beelines and attacks,
// in melee or ranged mode.

import { Component, type NextFn } from "../engine/dispatch";
import { Movement } from "./movement";
import { game } from "../game/context";
import { fireBullet } from "../systems/bullets";
import type { Entity } from "../engine/dispatch";

function nearestEnemy(x: number, y: number): Entity | null {
  let best: Entity | null = null, bestD = Infinity;
  for (const e of game.entities) {
    if (e.type !== "enemy" || e.send("isDead")) continue;
    const p = e.send("getPos") as { x: number; y: number };
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

export class PlayerControl extends Component {
  static handles = ["update"];
  cooldown = 0;
  update(next: NextFn): void {
    if (this.cooldown > 0) this.cooldown--;
    if (!this.entity.send("isDead")) {
      const mv = game.input.moveVector();
      const m = this.entity.get(Movement);
      m.intentX = mv.x; m.intentY = mv.y;
      if (game.input.pressed(" ") && this.cooldown === 0) {
        const target = nearestEnemy(m.x, m.y);
        const dir = target ? target.send("getPos") as { x: number; y: number }
          : { x: m.x + (m.facingLeft ? -1 : 1) * 100, y: m.y };
        fireBullet(this.entity.id, m.x, m.y - 6, dir.x - m.x, dir.y - m.y, 6, 25, this.entity.send("getTeam"));
        this.cooldown = 8;
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

  override init(cfg: Record<string, any>): void {
    if (typeof cfg["strength"] === "number") this.power = Math.max(4, Math.round(cfg["strength"] / 3));
    this.ranged = cfg["ranged"] === true;
    if (this.ranged) this.cooldownMax = 40;
    this.cooldown = 0;
  }

  update(next: NextFn): void {
    const m = this.entity.get(Movement);
    if (this.entity.send("isDead")) { m.intentX = 0; m.intentY = 0; return next(); }
    if (this.cooldown > 0) this.cooldown--;
    const target = game.player;
    if (!target || target.send("isDead")) { m.intentX = 0; m.intentY = 0; return next(); }
    const tp = target.send("getPos") as { x: number; y: number };
    const dx = tp.x - m.x, dy = tp.y - m.y;
    const d = Math.hypot(dx, dy) || 1;
    const range = this.ranged ? this.reachRanged : this.reach;
    if (d > range) {
      m.intentX = dx / d; m.intentY = dy / d;     // beeline
    } else {
      m.intentX = 0; m.intentY = 0;
      if (this.cooldown === 0) {
        if (this.ranged) {
          fireBullet(this.entity.id, m.x, m.y - 6, dx, dy, 4.5, this.power * 2, this.entity.send("getTeam"));
        } else {
          target.send("takeHit", this.power);
        }
        this.cooldown = this.cooldownMax;
      }
    }
    next();
  }
}
