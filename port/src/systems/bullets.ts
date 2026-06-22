// Bullet system: pooled spawn + per-tick sweep of finished bullets back into the pool.

import { Pool } from "../engine/pool";
import { BulletArchetype } from "../entities/bullet";
import { Movement } from "../components/movement";
import { Projectile } from "../components/projectile";
import { game } from "../game/context";
import type { Entity } from "../engine/dispatch";
import type { AttackData } from "../components/weapon";

const pool = new Pool(BulletArchetype);

export function fireBullet(
  ownerId: number, x: number, y: number, dirX: number, dirY: number,
  speed: number, power: number, team: string, maxLife = 100, freeze = 0, mult = 1, char = "",
): Entity {
  const b = pool.acquire();
  b.type = "bullet";
  b.build({ x, y, friction: 1, accel: 0, walkSpeed: 999, box: 6, passThrough: true }); // no friction/accel => constant velocity
  const d = Math.hypot(dirX, dirY) || 1;
  const m = b.get(Movement);
  m.vx = (dirX / d) * speed; m.vy = (dirY / d) * speed;
  // K1: mult (the bullet's damageMultiplier) flows into the bullet's takeHit; damage = (|vx|+|vy|)·mult,
  // where the bullet's collision-vector L1 == `power`. Player bolts pass mult=1 (unchanged).
  const proj = b.get(Projectile); proj.configure(power, team, ownerId, maxLife, freeze, mult); proj.char = char;
  game.entities.push(b);
  return b;
}

// fireBulletPayload: a single-target bolt (player arctic/heal spell) whose hit runs the spell's
// payloadFunction list (takeFreeze/takeHeal/takeHit) off its collision vector. `power` is the tuned
// L1 damage magnitude. allegiance "#friendly" makes it a heal bolt (targets same-team friendlies).
export function fireBulletPayload(
  ownerId: number, x: number, y: number, dirX: number, dirY: number, speed: number,
  power: number, team: string, attack: AttackData, hits: string[], allegiance: string, maxLife = 100,
): Entity {
  const b = pool.acquire();
  b.type = "bullet";
  b.build({ x, y, friction: 1, accel: 0, walkSpeed: 999, box: 6, passThrough: true });
  const d = Math.hypot(dirX, dirY) || 1;
  const m = b.get(Movement);
  m.vx = (dirX / d) * speed; m.vy = (dirY / d) * speed;
  b.get(Projectile).configurePayload(power, team, ownerId, attack, hits, allegiance, maxLife);
  game.entities.push(b);
  return b;
}

// fireSplashBullet: a bullet that carries a splash/explode AttackData (towerAxe/energyPulse/thunder/
// freeze). It flies straight like any bullet but, on trigger (collide/land/expire), resolves an area
// hit through SplashDamage instead of a single-target takeHit. `hits`/`allegiance` scope the disc.
export function fireSplashBullet(
  ownerId: number, x: number, y: number, dirX: number, dirY: number, speed: number,
  attack: AttackData, team: string, hits: string[], allegiance: string, maxLife = 100, char = "",
): Entity {
  const b = pool.acquire();
  b.type = "bullet";
  b.build({ x, y, friction: 1, accel: 0, walkSpeed: 999, box: 6, passThrough: true });
  const d = Math.hypot(dirX, dirY) || 1;
  const m = b.get(Movement);
  m.vx = (dirX / d) * speed; m.vy = (dirY / d) * speed;
  const proj = b.get(Projectile); proj.configureSplash(attack, team, ownerId, maxLife, hits, allegiance); proj.char = char || attack.name.replace(/^#/, "");
  game.entities.push(b);
  return b;
}

// performBeamAttack (modAttack.performBeamAttack): the energyBeam bullet spawns AT the target loc (with a
// ±10px jitter), NOT travelling, with its sprite stretched to the caster->target distance and rotated to
// the angle (objBullet.setBeam: width=dist, rotation=GeomAngle). It detonates its explode #attack at the
// target on the first frame. (cx,cy)=caster loc; (tx,ty)=raw target loc (cursor/auto-target).
export function performBeamAttack(
  ownerId: number, cx: number, cy: number, tx: number, ty: number,
  attack: AttackData, team: string, hits: string[], allegiance: string,
): Entity {
  // random(20)-10 jitter (objBullet visual variation), but clamped to ±6 so a beam aimed at a target
  // reliably lands inside its small explode disc — the original guarantees the hit by binding the beam
  // bullet to its #target (setTarget); the port's area model has no target-binding, so we keep the jitter
  // within the hit range instead. (A minor, documented deviation, plan §g.2.)
  const jx = Math.floor(game.rng.next() * 13) - 6, jy = Math.floor(game.rng.next() * 13) - 6;
  const targetX = tx + jx, targetY = ty + jy;
  const distX = targetX - cx, distY = targetY - cy;
  const dist = Math.hypot(distX, distY);          // distToTargetScale (setSpriteWidth = dist+1)
  const angle = Math.atan2(distY, distX);         // GeomAngle(distXY) for setSpriteRotation
  const b = pool.acquire();
  b.type = "bullet";
  b.build({ x: targetX, y: targetY, friction: 1, accel: 0, walkSpeed: 999, box: 6, passThrough: true });
  const m = b.get(Movement);
  m.vx = 0; m.vy = 0; // spawned AT the target, not travelling
  b.get(Projectile).configureBeam(attack, team, ownerId, hits, allegiance, dist, angle, cx, cy);
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
