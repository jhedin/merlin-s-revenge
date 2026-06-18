// Movement component (objMoveXY): owns world position + velocity, integrates intent with
// friction and tile collision. Intent is set by a control/AI component earlier in the chain.
// Hot path is allocation-free (PORTING_PLAN §2.5).

import { Component, type NextFn } from "../engine/dispatch";
import { game } from "../game/context";

export interface Pos { x: number; y: number; }

export class Movement extends Component {
  static handles = ["update", "getPos"];
  x = 0; y = 0;
  vx = 0; vy = 0;
  intentX = 0; intentY = 0;
  accel = 1.4; friction = 0.6; maxSpeed = 4; box = 12;
  facingLeft = false;

  override init(cfg: Record<string, any>): void {
    this.x = cfg["x"] ?? 0; this.y = cfg["y"] ?? 0;
    if (typeof cfg["walkSpeed"] === "number") this.maxSpeed = cfg["walkSpeed"];
    if (typeof cfg["box"] === "number") this.box = cfg["box"];
  }

  moving(): boolean { return this.vx !== 0 || this.vy !== 0; }
  getPos(): Pos { return { x: this.x, y: this.y }; } // query

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
    if (r.hitX) this.vx = 0;
    if (r.hitY) this.vy = 0;
    this.x = r.x + b / 2; this.y = r.y + b / 2;
    next();
  }
}
