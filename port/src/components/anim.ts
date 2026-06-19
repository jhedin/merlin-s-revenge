// Animation component (modAnimSet): picks an action strip from the entity's mode (dead->grave,
// moving->walk, else stand) and advances frames on a tick delay. One-shot actions (a swing, a
// cast, a death) play once and hold the last frame; cyclic ones (walk/charge) loop. Sprites are
// mirrored by facing direction. Provides the render Sprite.

import { Component, type NextFn } from "../engine/dispatch";
import { Movement } from "./movement";
import { game } from "../game/context";
import type { Sprite } from "../render/renderer";

/** The sprite character for an actor, or a stand-in ("blackOrc") when its anims aren't bundled. */
export function spriteCharOr(name: string, fallback = "blackOrc"): string {
  return game.assets.index.anims[`${name}_stand`] ? name : fallback;
}

// Actions that play through once and hold their final frame (vs walk/charge which cycle).
const ONE_SHOT = new Set([
  "grave", "die", "reel",
  "naturalMelee", "weaponMelee", "magicMelee", "weaponMagic",
  "release", "weaponRanged", "naturalRanged",
]);

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
    if (anim && anim.frames.length > 1) {
      if (++this.timer >= Math.max(1, anim.delay)) {
        this.timer = 0;
        // one-shot strips advance to the last frame and hold; cyclic strips wrap
        if (ONE_SHOT.has(action)) this.frame = Math.min(this.frame + 1, anim.frames.length - 1);
        else this.frame = (this.frame + 1) % anim.frames.length;
      }
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
      flip: m.facingLeft, // mirror to face the movement/aim direction (SpriteGetFlipHAsDir)
      flash: this.entity.send("isHurt") === true, // white hit-flash (modFlasher)
    };
  }
}

