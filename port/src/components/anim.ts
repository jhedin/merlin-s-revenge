// Animation component (modAnimSet + objAnimStrip): picks an action strip from the entity's mode
// (dead->grave, moving->walk, else stand) and advances frames on a PER-FRAME delay (objAnimStrip's
// pDelayList: each frame carries its own `dela`), scaled by gGameSpeed (pDelay.inc = 1*gGameSpeed).
// Loop vs one-shot is DATA-DRIVEN (anim.loop from assets.json, derived from the action classification
// in the builder — see plan §C.3.2): cyclic strips wrap, one-shot strips advance-and-hold. Sprites
// are mirrored by facing direction. Provides the render Sprite (tint/alpha from ColourTransform).

import { Component, type NextFn } from "../engine/dispatch";
import { Movement } from "./movement";
import { ColourTransform } from "./colourTransform";
import { game } from "../game/context";
import type { Sprite } from "../render/renderer";

/** The sprite character for an actor, or a stand-in ("blackOrc") when its anims aren't bundled. */
export function spriteCharOr(name: string, fallback = "blackOrc"): string {
  return game.assets.index.anims[`${name}_stand`] ? name : fallback;
}

// Fallback one-shot classification when an anim's `loop` flag is absent (old assets.json). Mirrors the
// builder's ONE_SHOT_ACTIONS so behaviour is identical pre/post-rebuild. The data flag (anim.loop) wins.
const ONE_SHOT_FALLBACK = new Set([
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

  // looped (objAnimStrip.getLooped via modAnimSet): true if the strip cycles. Data-driven from
  // anim.loop; falls back to the action-name classification if the flag is missing.
  private isLooped(action: string, anim: { loop?: boolean }): boolean {
    return anim.loop ?? !ONE_SHOT_FALLBACK.has(action);
  }

  update(next: NextFn): void {
    const action = this.pickAction();
    if (action !== this.action) { this.action = action; this.frame = 0; this.timer = 0; }
    const anim = this.animFor(action);
    if (anim && anim.frames.length > 1) {
      // per-frame delay (objAnimStrip.moveNextFrame: pDelay.tim[2] = pDelayList.nextValue()): the current
      // frame's own `dela` gates the advance; the counter steps by gGameSpeed (pDelay.inc = 1*gGameSpeed).
      const cur = anim.frames[this.frame % anim.frames.length]!;
      const frameDelay = Math.max(1, cur.dela ?? anim.delay);
      this.timer += game.gameSpeed;
      if (this.timer >= frameDelay) {
        this.timer = 0;
        // cyclic strips wrap; one-shot strips advance to the last frame and hold (data-driven loop flag)
        if (this.isLooped(action, anim)) this.frame = (this.frame + 1) % anim.frames.length;
        else this.frame = Math.min(this.frame + 1, anim.frames.length - 1);
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
    // frames load lazily per map; a char spawned mid-run (e.g. a summon) may not be loaded yet —
    // kick off its load and skip this frame rather than throwing (it'll draw next tick once ready).
    if (!game.assets.images.has(f.file)) { void game.assets.ensureChar(this.char); return null; }
    // tint: the real modColourTransform palette (white flick on hit, glowRed/Teal/Gold). Falls back to
    // the binary white flash (isHurt) only when no ColourTransform component is present on this archetype.
    const ct = this.entity.tryGet(ColourTransform);
    const tint = ct ? ct.getColourTransform() : (this.entity.send("isHurt") === true ? { rgb: [255, 255, 255] as [number, number, number], strength: 0.85, additive: false } : null);
    const alpha = this.entity.send("getAlpha"); // per-sprite alpha (globalAlpha), default opaque
    return {
      img: game.assets.img(f.file),
      x: m.x, y: m.y, regX: f.reg[0], regY: f.reg[1],
      z: m.y, // simple painter's depth by world-y
      flip: m.facingLeft, // mirror to face the movement/aim direction (SpriteGetFlipHAsDir)
      tint: tint ?? undefined,
      alpha: typeof alpha === "number" ? alpha : undefined,
    };
  }
}

