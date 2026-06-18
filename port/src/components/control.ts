// Control components set the Movement intent each tick. PlayerControl reads input; EnemyAI
// (objAiCPU beeline) steers toward the player and melee-attacks in range. Both run before
// Movement in the chain so intent is set before integration.

import { Component, type NextFn } from "../engine/dispatch";
import { Movement } from "./movement";
import { game } from "../game/context";

export class PlayerControl extends Component {
  static handles = ["update"];
  reach = 40;
  power = 20;
  update(next: NextFn): void {
    if (!this.entity.send("isDead")) {
      const mv = game.input.moveVector();
      const m = this.entity.get(Movement);
      m.intentX = mv.x; m.intentY = mv.y;
      if (game.input.pressed(" ")) {           // space: melee nearby enemies
        for (const e of game.entities) {
          if (e.type !== "enemy" || e.send("isDead")) continue;
          const ep = e.send("getPos") as { x: number; y: number };
          if (Math.hypot(ep.x - m.x, ep.y - m.y) < this.reach) e.send("takeHit", this.power);
        }
      }
    }
    next();
  }
}

export class EnemyAI extends Component {
  static handles = ["update"];
  reach = 22;
  power = 8;
  cooldown = 0;
  cooldownMax = 18;

  update(next: NextFn): void {
    const m = this.entity.get(Movement);
    if (this.entity.send("isDead")) { m.intentX = 0; m.intentY = 0; next(); return; }
    if (this.cooldown > 0) this.cooldown--;
    const target = game.player;
    if (target && !target.send("isDead")) {
      const tp = target.send("getPos") as { x: number; y: number };
      const dx = tp.x - m.x, dy = tp.y - m.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > this.reach) {
        m.intentX = dx / d; m.intentY = dy / d;     // beeline
      } else {
        m.intentX = 0; m.intentY = 0;
        if (this.cooldown === 0) { target.send("takeHit", this.power); this.cooldown = this.cooldownMax; }
      }
    } else { m.intentX = 0; m.intentY = 0; }
    next();
  }
}
