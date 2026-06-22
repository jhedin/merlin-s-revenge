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

// A few actors carry no bundled art of their own (e.g. goblinHero inherits #CPUCharacter with no
// #character); map them to the closest kin sprite instead of the generic blackOrc stand-in.
const CHAR_ALIAS: Record<string, string> = { goblinHero: "goblinWarrior" };

/** The sprite character for an actor, or a stand-in ("blackOrc") when its anims aren't bundled. */
export function spriteCharOr(name: string, fallback = "blackOrc"): string {
  if (game.assets.index.anims[`${name}_stand`]) return name;
  const alias = CHAR_ALIAS[name];
  if (alias && game.assets.index.anims[`${alias}_stand`]) return alias;
  return fallback;
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
  private extraDelay = 0;   // modWeaponTechnique.frameExtendDelay: extra frames added to the current frame's delay
  // modStretchDeath (act_player #stretchDeath): a magical death — the body stretches vertically + fades to
  // transparent over STRETCH_DURATION frames instead of switching to a grave, then resolves (gameOver).
  private stretchDeath = false;
  private deathT = 0;
  private static readonly STRETCH_DURATION = 33; // blendSpeed 3: ~100/3 frames to fade out
  private static readonly STRETCH_AMOUNT = 0.7;  // scaleY 1 -> 1.7 (stretchHeight 50, anchored at the feet)

  override init(cfg: Record<string, any>): void {
    this.char = cfg["animChar"] ?? "mer"; this.extraDelay = 0;
    this.stretchDeath = cfg["stretchDeath"] === true; this.deathT = 0;
  }
  override reset(): void { this.deathT = 0; }

  /** modStretchDeath #stretchDeathFin: true once the stretch+fade transform has fully played out — the
   *  death-resolution signal (the original fires gameOver/respawn HERE, not on a separate hand-tuned timer).
   *  False for a non-stretch-death actor, so the caller falls back to its own delay. */
  stretchDeathDone(): boolean {
    return this.stretchDeath && this.entity.send("isDead") === true && this.deathT >= Anim.STRETCH_DURATION;
  }
  hasStretchDeath(): boolean { return this.stretchDeath; }

  // frameAdvance (modWeaponTechnique.skipFramesForWeaponTechnique → me.big.frameAdvance): step the strip
  // one frame early (faster attack cadence). Wraps for looped strips, clamps for one-shots; resets the
  // per-frame timer so the early advance counts as a fresh frame.
  frameAdvance(): void {
    const anim = this.animFor(this.action);
    if (!anim || anim.frames.length <= 1) return;
    if (this.isLooped(this.action, anim)) this.frame = (this.frame + 1) % anim.frames.length;
    else this.frame = Math.min(this.frame + 1, anim.frames.length - 1);
    this.timer = 0;
  }
  // frameExtendDelay (modWeaponTechnique.addFramesForWeaponTechnique → me.big.frameExtendDelay): hold the
  // current frame for `n` extra delay-ticks (slower attack cadence for negative-technique units).
  frameExtendDelay(n: number): void { this.extraDelay += Math.max(0, n); }

  private pickAction(): string {
    // modStretchDeath: a stretch-death unit keeps its BODY frame while it stretches+fades (no grave swap).
    if (this.entity.send("isDead") && this.stretchDeath) return this.action === "grave" ? "stand" : this.action;
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
    // modStretchDeath transform progress: advance while the stretch-death unit is dead; reset on revive
    // (extra-life respawn in place) so the next death stretches from scratch.
    if (this.stretchDeath) {
      if (this.entity.send("isDead")) { if (this.deathT <= Anim.STRETCH_DURATION) this.deathT++; }
      else if (this.deathT > 0) this.deathT = 0;
    }
    const action = this.pickAction();
    if (action !== this.action) { this.action = action; this.frame = 0; this.timer = 0; this.extraDelay = 0; }
    const anim = this.animFor(action);
    // A grave holds a SINGLE static frame (modGrave.drawGrave captures getAnimMemberFromStrip(#grave) — the
    // current member — once at death; the corpse is then background, not an animating sprite). Don't advance.
    const isGrave = this.entity.send("isDead") === true && this.entity.send("getGraveOn") === true;
    if (!isGrave && anim && anim.frames.length > 1) {
      // per-frame delay (objAnimStrip.moveNextFrame: pDelay.tim[2] = pDelayList.nextValue()): the current
      // frame's own `dela` gates the advance; the counter steps by gGameSpeed (pDelay.inc = 1*gGameSpeed).
      const cur = anim.frames[this.frame % anim.frames.length]!;
      // modWeaponTechnique.frameExtendDelay adds `extraDelay` to this frame's own `dela` (slower cadence).
      const frameDelay = Math.max(1, (cur.dela ?? anim.delay) + this.extraDelay);
      this.timer += game.gameSpeed;
      if (this.timer >= frameDelay) {
        this.timer = 0; this.extraDelay = 0; // the held-extra is spent once this frame finally advances
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
    // modGrave: a DEAD actor is its own grave. A ghost (pGraveOn=false) leaves NO grave — it vanishes when
    // finished; every other dead actor holds the #grave frame BEHIND the living (the original draws it into
    // the room background — modelled here as a low render-z) and faces RIGHT (drawGrave: setFlipFromDir(1)).
    // getGraveOn is undefined for the player (no grave system — its in-game death plays on the normal path).
    const dead = this.entity.send("isDead") === true;
    const graveOn = this.entity.send("getGraveOn"); // true=leaves grave, false=ghost, undefined=player
    const stretching = dead && this.stretchDeath;   // modStretchDeath: stretch+fade instead of grave/vanish
    if (dead && graveOn === false && !stretching) return null; // ghost: no grave, vanishes
    const isGrave = dead && graveOn === true;
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
    // modStretchDeath transforms: startTransBlend(out) fades opacity 1->0; startStretchHeight stretches the
    // body taller (anchored at the feet via the reg point) — both over STRETCH_DURATION.
    const prog = stretching ? Math.min(1, this.deathT / Anim.STRETCH_DURATION) : 0;
    return {
      img: game.assets.img(f.file),
      x: m.x, y: m.y, regX: f.reg[0], regY: f.reg[1],
      // painter's depth by world-y; a grave sits BEHIND every live actor (room-background blit) while still
      // ordering grave-vs-grave by y — a large negative bias keeps it under the living band.
      z: isGrave ? m.y - 100000 : m.y,
      flip: isGrave ? false : m.facingLeft, // graves face right (setFlipFromDir(1)); else mirror to aim dir
      tint: tint ?? undefined,
      scaleY: stretching ? 1 + prog * Anim.STRETCH_AMOUNT : undefined,
      alpha: stretching ? 1 - prog : (typeof alpha === "number" ? alpha : undefined),
    };
  }
}

