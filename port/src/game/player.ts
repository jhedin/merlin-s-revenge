// Minimal player for the vertical slice: objMoveXY-style velocity + friction integration with
// tile collision, plus tick-based sprite animation keyed off movement (walk vs stand). This is
// a stand-in for the full objCharacter/objMoveXY + modAnimSet stack, kept allocation-free in the
// hot path (PORTING_PLAN §2.5).

import type { CollisionGrid } from "../world/collision";
import type { Assets } from "../render/assets";
import type { Sprite } from "../render/renderer";

const ACCEL = 1.4;
const FRICTION = 0.6;
const MAX_SPEED = 4;
const BOX = 12; // collision footprint (px)

export class Player {
  x: number; y: number;       // world position (registration point / center)
  vx = 0; vy = 0;
  facingLeft = false;
  private animKey = "mer_stand";
  private frame = 0;
  private frameTimer = 0;

  constructor(x: number, y: number, private assets: Assets) { this.x = x; this.y = y; }

  update(move: { x: number; y: number }, grid: CollisionGrid): void {
    // accelerate toward input, apply friction
    this.vx += move.x * ACCEL;
    this.vy += move.y * ACCEL;
    if (move.x === 0) this.vx *= FRICTION;
    if (move.y === 0) this.vy *= FRICTION;
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > MAX_SPEED) { this.vx = (this.vx / sp) * MAX_SPEED; this.vy = (this.vy / sp) * MAX_SPEED; }
    if (Math.abs(this.vx) < 0.05) this.vx = 0;
    if (Math.abs(this.vy) < 0.05) this.vy = 0;
    if (this.vx < 0) this.facingLeft = true; else if (this.vx > 0) this.facingLeft = false;

    // collide+move the footprint box (centered on position)
    const bx = this.x - BOX / 2, by = this.y - BOX / 2;
    const r = grid.moveBox(bx, by, BOX, BOX, this.vx, this.vy);
    if (r.hitX) this.vx = 0;
    if (r.hitY) this.vy = 0;
    this.x = r.x + BOX / 2; this.y = r.y + BOX / 2;

    // animation
    const moving = this.vx !== 0 || this.vy !== 0;
    const key = moving ? "mer_walk" : "mer_stand";
    if (key !== this.animKey) { this.animKey = key; this.frame = 0; this.frameTimer = 0; }
    const anim = this.assets.index.anims[this.animKey];
    if (anim && anim.frames.length > 1) {
      if (++this.frameTimer >= anim.delay) { this.frameTimer = 0; this.frame = (this.frame + 1) % anim.frames.length; }
    }
  }

  sprite(z: number): Sprite {
    const anim = this.assets.index.anims[this.animKey] ?? this.assets.index.anims["mer_stand"]!;
    const f = anim.frames[this.frame % anim.frames.length]!;
    return { img: this.assets.img(f.file), x: this.x, y: this.y, regX: f.reg[0], regY: f.reg[1], z };
  }
}
