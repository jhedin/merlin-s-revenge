// Bullet system: pooled spawn + per-tick sweep of finished bullets back into the pool.

import { Pool } from "../engine/pool";
import { BulletArchetype } from "../entities/bullet";
import { Movement } from "../components/movement";
import { Projectile } from "../components/projectile";
import { game } from "../game/context";
import type { Entity } from "../engine/dispatch";

const pool = new Pool(BulletArchetype);

export function fireBullet(
  ownerId: number, x: number, y: number, dirX: number, dirY: number,
  speed: number, power: number, team: string, maxLife = 100, freeze = 0,
): Entity {
  const b = pool.acquire();
  b.type = "bullet";
  b.build({ x, y, friction: 1, accel: 0, walkSpeed: 999, box: 6 }); // no friction/accel => constant velocity
  const d = Math.hypot(dirX, dirY) || 1;
  const m = b.get(Movement);
  m.vx = (dirX / d) * speed; m.vy = (dirY / d) * speed;
  b.get(Projectile).configure(power, team, ownerId, maxLife, freeze);
  game.entities.push(b);
  return b;
}

export function sweepBullets(): void {
  const ents = game.entities;
  for (let i = ents.length - 1; i >= 0; i--) {
    const e = ents[i]!;
    if (e.type === "bullet" && e.send("isFinished")) {
      ents.splice(i, 1);
      pool.release(e);
    }
  }
}

export const bulletPoolStats = () => pool.stats;
