// Movement component (objMoveXY): owns world position + velocity, integrates intent with
// friction and tile collision. Intent is set by a control/AI component earlier in the chain.
// Hot path is allocation-free (PORTING_PLAN §2.5).

import { Component, type NextFn } from "../engine/dispatch";
import { game } from "../game/context";

export interface Pos { x: number; y: number; }

export class Movement extends Component {
  static handles = ["update", "getPos", "addSaveData", "restoreFromSave"];
  x = 0; y = 0;
  vx = 0; vy = 0;
  intentX = 0; intentY = 0;
  accel = 1.4; friction = 0.6; maxSpeed = 4; box = 12;
  facingLeft = false;
  hitX = false; hitY = false;  // wall contact this tick (projectiles read these)

  override init(cfg: Record<string, any>): void {
    this.x = cfg["x"] ?? 0; this.y = cfg["y"] ?? 0;
    this.vx = 0; this.vy = 0; this.intentX = 0; this.intentY = 0;
    this.accel = 1.4; this.friction = 0.6; this.maxSpeed = 4;
    if (typeof cfg["walkSpeed"] === "number") this.maxSpeed = cfg["walkSpeed"];
    if (typeof cfg["accel"] === "number") this.accel = cfg["accel"];
    if (typeof cfg["friction"] === "number") this.friction = cfg["friction"];
    if (typeof cfg["box"] === "number") this.box = cfg["box"];
  }
  override reset(): void { this.vx = this.vy = this.intentX = this.intentY = 0; this.hitX = this.hitY = false; }

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
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > this.maxSpeed) { this.vx = (this.vx / sp) * this.maxSpeed; this.vy = (this.vy / sp) * this.maxSpeed; }
    if (Math.abs(this.vx) < 0.05) this.vx = 0;
    if (Math.abs(this.vy) < 0.05) this.vy = 0;
    if (this.vx < 0) this.facingLeft = true; else if (this.vx > 0) this.facingLeft = false;

    const b = this.box;
    const r = game.grid.moveBox(this.x - b / 2, this.y - b / 2, b, b, this.vx, this.vy);
    this.hitX = r.hitX; this.hitY = r.hitY;
    if (r.hitX) this.vx = 0;
    if (r.hitY) this.vy = 0;
    this.x = r.x + b / 2; this.y = r.y + b / 2;
    next();
  }
}
