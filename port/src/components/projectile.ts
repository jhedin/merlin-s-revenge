// Projectile (objBullet): flies in a straight line (Movement, ordered before this), dies on
// wall contact, lifetime expiry, or on hitting a non-friendly target — to which it applies the
// attack payload (takeHit). Pooled (reset()) since bullets churn heavily.

import { Component, type NextFn } from "../engine/dispatch";
import { Movement } from "./movement";
import { game } from "../game/context";

export class Projectile extends Component {
  static handles = ["update", "isFinished"];
  life = 0; maxLife = 100; power = 10; team = ""; ownerId = -1; done = false;

  configure(power: number, team: string, ownerId: number, maxLife = 100): void {
    this.life = 0; this.power = power; this.team = team; this.ownerId = ownerId; this.maxLife = maxLife; this.done = false;
  }
  override reset(): void { this.done = false; this.life = 0; this.ownerId = -1; }
  isFinished(): boolean { return this.done; }

  update(next: NextFn): void {
    const m = this.entity.get(Movement);
    if (m.hitX || m.hitY) { this.done = true; return next(); }       // wall
    if (++this.life > this.maxLife) { this.done = true; return next(); }
    for (const e of game.entities) {
      if (e.id === this.ownerId || (e.type !== "player" && e.type !== "enemy")) continue;
      if (e.send("isDead") || e.send("getTeam") === this.team) continue;
      const p = e.send("getPos") as { x: number; y: number };
      if (Math.abs(p.x - m.x) < 12 && Math.abs(p.y - m.y) < 12) {
        e.send("takeHit", this.power, this.ownerId);
        this.done = true;
        break;
      }
    }
    next();
  }
}
