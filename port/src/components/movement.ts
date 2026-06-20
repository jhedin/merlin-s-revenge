// Movement component (objMoveXY): owns world position + velocity, integrates intent with
// friction and tile collision. Intent is set by a control/AI component earlier in the chain.
// Hot path is allocation-free (PORTING_PLAN §2.5).

import { Component, type NextFn } from "../engine/dispatch";
import { game } from "../game/context";

export interface Pos { x: number; y: number; }

// Knockback (objGameObject.takeHit): a hit's collision vector is added to velocity, damped by inertia.
// At the original's engine scale knockback == the damage magnitude; at this slice's px scale that would
// launch units across the room, so — like the port's px-tuned spell damage — knockback keeps the same
// vector/direction/proportionality but is scaled down and clamped. Damage itself stays faithful (Energy).
const KNOCK_SCALE = 0.06;   // px-scale factor on the (damped) collision vector
const KNOCK_MAX = 5;        // clamp a single hit's shove so big spells don't fling units
const KNOCK_FRICTION = 0.78; // per-tick decay of the knockback impulse

export class Movement extends Component {
  static handles = ["update", "takeHit", "getPos", "addSaveData", "restoreFromSave"];
  x = 0; y = 0;
  vx = 0; vy = 0;           // walk velocity (intent-driven, speed-capped)
  kvx = 0; kvy = 0;         // knockback impulse (uncapped, friction-decayed)
  intentX = 0; intentY = 0;
  accel = 1.4; friction = 0.6; maxSpeed = 4; box = 12; inertia = 0;
  facingLeft = false;
  hitX = false; hitY = false;  // wall contact this tick (projectiles read these)

  override init(cfg: Record<string, any>): void {
    this.x = cfg["x"] ?? 0; this.y = cfg["y"] ?? 0;
    this.vx = 0; this.vy = 0; this.kvx = 0; this.kvy = 0; this.intentX = 0; this.intentY = 0;
    this.accel = 1.4; this.friction = 0.6; this.maxSpeed = 4; this.inertia = 0;
    if (typeof cfg["walkSpeed"] === "number") this.maxSpeed = cfg["walkSpeed"];
    if (typeof cfg["accel"] === "number") this.accel = cfg["accel"];
    if (typeof cfg["friction"] === "number") this.friction = cfg["friction"];
    if (typeof cfg["box"] === "number") this.box = cfg["box"];
    if (typeof cfg["inertia"] === "number") this.inertia = Math.max(0, Math.min(100, cfg["inertia"]));
  }
  override reset(): void {
    this.vx = this.vy = this.kvx = this.kvy = this.intentX = this.intentY = 0; this.hitX = this.hitY = false;
  }

  // objGameObject.takeHit: add the collision vector to velocity as a knockback impulse, damped by inertia.
  // Ordered first in the chain (Movement precedes Energy/Hurt/Experience in every archetype).
  // NB: the original damps inertia into the vector modEnergy then reads, so it cuts damage too — but those
  // attack powers are calibrated for that coupling. A1 preserves the port's current (uncoupled) damage
  // numbers, so we damp KNOCKBACK only and pass the vector through undamped. Faithful damage-damping pairs
  // with adopting the real data attack powers (backlog B2); see docs/parity/plans/A1-damage-knockback.md.
  takeHit(next: NextFn, vx = 0, vy = 0, attackerId = -1, mult = 1): any {
    if (this.entity.send("isReelProof")) return next(vx, vy, attackerId, mult); // #reelProof: no knockback
    const d = (100 - this.inertia) / 100;
    let kx = vx * d * KNOCK_SCALE, ky = vy * d * KNOCK_SCALE;
    const km = Math.hypot(kx, ky);
    if (km > KNOCK_MAX) { kx = (kx / km) * KNOCK_MAX; ky = (ky / km) * KNOCK_MAX; }
    this.kvx += kx; this.kvy += ky;
    return next(vx, vy, attackerId, mult);
  }

  moving(): boolean { return this.vx !== 0 || this.vy !== 0; }
  getPos(): Pos { return { x: this.x, y: this.y }; } // query

  // save/restore are ordered fold messages: each component writes a namespaced sub-dict.
  addSaveData(next: NextFn, sd: Record<string, any>): Record<string, any> {
    sd["move"] = { x: this.x, y: this.y, vx: this.vx, vy: this.vy };
    return next(sd);
  }
  restoreFromSave(next: NextFn, sd: Record<string, any>): Record<string, any> {
    const s = sd["move"];
    if (s) { this.x = s.x; this.y = s.y; this.vx = s.vx; this.vy = s.vy; }
    return next(sd);
  }

  update(next: NextFn): void {
    this.vx += this.intentX * this.accel;
    this.vy += this.intentY * this.accel;
    if (this.intentX === 0) this.vx *= this.friction;
    if (this.intentY === 0) this.vy *= this.friction;
    const cap = this.maxSpeed * (this.entity.send("freezeFactor") as number ?? 1); // modFreeze (0.5x frozen)
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > cap) { this.vx = (this.vx / sp) * cap; this.vy = (this.vy / sp) * cap; }
    if (Math.abs(this.vx) < 0.05) this.vx = 0;
    if (Math.abs(this.vy) < 0.05) this.vy = 0;
    if (this.vx < 0) this.facingLeft = true; else if (this.vx > 0) this.facingLeft = false;

    // integrate walk velocity (capped, above) + knockback impulse (uncapped) together, then decay knockback
    const b = this.box;
    const oldTop = this.y - b / 2;
    const r = game.grid.moveBox(this.x - b / 2, this.y - b / 2, b, b, this.vx + this.kvx, this.vy + this.kvy, oldTop);
    this.hitX = r.hitX; this.hitY = r.hitY;
    if (r.hitX) { this.vx = 0; this.kvx = 0; }
    if (r.hitY) { this.vy = 0; this.kvy = 0; }
    this.x = r.x + b / 2; this.y = r.y + b / 2;
    // directional collision events (checkCollisions 266-295): dispatch as chain messages so gameplay
    // components (reelFly-landing, AI scenic repathing) can react. Solid grids only ever fire wall*/
    // ceiling; #platform/#none* events come from the typed path. Sent via the entity so any listener
    // on the chain receives them (no-op when nothing handles them).
    const ev = r.events;
    if (ev.wallLeft) this.entity.send("collisionWallLeft");
    if (ev.wallRight) this.entity.send("collisionWallRight");
    if (ev.ceiling) this.entity.send("collisionCeiling");
    if (ev.platform) this.entity.send("collisionPlatform");
    if (ev.noPlatform) this.entity.send("collisionNoPlatform");
    this.kvx *= KNOCK_FRICTION; this.kvy *= KNOCK_FRICTION;
    if (Math.abs(this.kvx) < 0.05) this.kvx = 0;
    if (Math.abs(this.kvy) < 0.05) this.kvy = 0;
    next();
  }
}
