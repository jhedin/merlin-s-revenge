// Animation component (modAnimSet): picks an action strip from the entity's mode (dead->grave,
// moving->walk, else stand) and advances frames on a tick delay. Provides the render Sprite.

import { Component, type NextFn } from "../engine/dispatch";
import { Movement } from "./movement";
import { game } from "../game/context";
import type { Sprite } from "../render/renderer";

/** The sprite character for an actor, or a stand-in ("blackOrc") when its anims aren't bundled. */
export function spriteCharOr(name: string, fallback = "blackOrc"): string {
  return game.assets.index.anims[`${name}_stand`] ? name : fallback;
}

export class Anim extends Component {
  static handles = ["update"];
  char = "mer";
  private action = "stand";
  private frame = 0;
  private timer = 0;

  override init(cfg: Record<string, any>): void { this.char = cfg["animChar"] ?? "mer"; }

  private pickAction(): string {
    if (this.entity.send("isDead")) return "grave";
    const override = this.entity.send("animAction"); // control may force charge/release/punch
    if (typeof override === "string") return override;
    return this.entity.get(Movement).moving() ? "walk" : "stand";
  }

  update(next: NextFn): void {
    const action = this.pickAction();
    if (action !== this.action) { this.action = action; this.frame = 0; this.timer = 0; }
    const anim = this.animFor(action);
    if (anim && anim.frames.length > 1 && action !== "grave") {
      if (++this.timer >= Math.max(1, anim.delay)) { this.timer = 0; this.frame = (this.frame + 1) % anim.frames.length; }
    }
    next();
  }

  private animFor(action: string) {
    const idx = game.assets.index.anims;
    return idx[`${this.char}_${action}`] ?? idx[`${this.char}_stand`];
  }

  sprite(): Sprite | null {
    const m = this.entity.get(Movement);
    const anim = this.animFor(this.action);
    if (!anim || anim.frames.length === 0) return null;
    const f = anim.frames[this.frame % anim.frames.length]!;
    return {
      img: game.assets.img(f.file),
      x: m.x, y: m.y, regX: f.reg[0], regY: f.reg[1],
      z: m.y, // simple painter's depth by world-y
    };
  }
}
