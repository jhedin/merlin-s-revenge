// ColourTransform (modColourTransform): the real tint/glow palette — NOT a binary white flash. Each
// transform tweens the sprite's colour from a start to a target at a `speed`, optionally ping-ponging,
// optionally chaining to a next transform when it finishes (transColorFin). A new transform cancels the
// current one (cancelTransColor). The component exposes a resolved tint {rgb, strength} to the renderer,
// which applies it via an offscreen source-atop pass (cached by quantized frame/colour/strength — NO
// per-frame getImageData).
//
// Palette (modColourTransform.txt, the A.2 table):
//   glowRed       current->rgb(255,0,0)   speed 10  pingpong  (low health, held)
//   glowTeal      current->rgb(0,255,255) speed 100           (freeze, held)
//   glowRedAndTeal rgb(0,255,255)->rgb(255,0,0) speed 10 pingpong (low-health while frozen)
//   glowGold      current->rgb(255,201,57) speed 10 -> fadeGoldBlack (heal)
//   fadeGoldBlack rgb(255,201,57)->black  speed 10            (tail of glowGold)
//   glowPink      current->rgb(255,200,200) speed 10 -> fadeBlack
//   fadeBlack     last->black             speed 10
//   flashWhite    white->black            (default speed)
//   flickWhite    white->black            speed 33             (every non-lethal hit)
//   pulseWhite    white<->black           pingpong             (invince)

import { Component, type NextFn } from "../engine/dispatch";
import { game } from "../game/context";

type RGB = [number, number, number];
const BLACK: RGB = [0, 0, 0];
const RED: RGB = [255, 0, 0];
const TEAL: RGB = [0, 255, 255];
const GOLD: RGB = [255, 201, 57];
const PINK: RGB = [255, 200, 200];
const WHITE: RGB = [255, 255, 255];

// transforms whose glow is ADDITIVE (brighten the sprite via "lighter") vs REPLACE (white flick/flash).
const ADDITIVE = new Set(["glowRed", "glowTeal", "glowRedAndTeal", "glowGold", "fadeGoldBlack", "glowPink", "fadeBlack"]);

export interface Tint { rgb: RGB; strength: number; additive: boolean; }

export class ColourTransform extends Component {
  // Only `update` (and the renderer's getColourTransform query) are dispatched messages; the palette
  // methods (glowRed/flickWhite/...) are invoked DIRECTLY via entity.tryGet(ColourTransform) by the
  // trigger components (Energy/Freeze/Hurt) — direct calls avoid chain ambiguity/recursion.
  static handles = ["update", "getColourTransform"];

  // pCurrentTransform: the single active transform name (#none when idle).
  private current = "";
  // pNextTransform: a follow-up transform run when the current finishes (chain).
  private next = "";
  private start: RGB = BLACK;
  private target: RGB = BLACK;
  private speed = 10;
  private pingpong = false;
  // the tween parameter t in [0,255] (Director colours are 0..255); colour = lerp(start,target, t/255).
  private t = 0;
  private dir = 1;          // tween direction (+1 toward target, -1 back for ping-pong)
  private lastColour: RGB = BLACK; // pLastFinishingColour: the colour we were before reset to black
  private active = false;

  override init(): void { this.cancel(); }
  override reset(): void { this.cancel(); }

  // newTransColor (modColourTransform.newTransColor): cancel the current, clear the chain, arm a tween.
  private arm(name: string, target: RGB, opts: { start?: RGB; speed?: number; pingpong?: boolean; next?: string } = {}): void {
    this.current = name;
    this.next = opts.next ?? "";
    // a #current start means "from whatever colour we are now" — approximated as black (no tint) start,
    // which is correct for the common idle->glow case (the sprite has no active overlay before the glow).
    this.start = opts.start ?? BLACK;
    this.target = target;
    this.speed = opts.speed ?? 10;
    this.pingpong = opts.pingpong ?? false;
    this.t = 0; this.dir = 1; this.active = true;
  }

  private cancel(): void {
    if (this.active) this.lastColour = this.colourAt();
    this.current = ""; this.next = ""; this.active = false; this.t = 0; this.dir = 1;
    this.start = BLACK; this.target = BLACK;
  }

  // ── the palette (each cancels the current via arm()) ────────────────────────────────────────────
  glowRed(): void {
    if (this.current === "glowTeal" || this.current === "glowRedAndTeal") { this.glowRedAndTeal(); return; }
    this.arm("glowRed", RED, { speed: 10, pingpong: true });
  }
  glowTeal(): void {
    if (this.current === "glowRed" || this.current === "glowRedAndTeal") { this.glowRedAndTeal(); return; }
    this.arm("glowTeal", TEAL, { speed: 100 });
  }
  glowRedAndTeal(): void { this.arm("glowRedAndTeal", RED, { start: TEAL, speed: 10, pingpong: true }); }
  glowGold(): void { this.arm("glowGold", GOLD, { speed: 10, next: "fadeGoldBlack" }); }
  fadeGoldBlack(): void { this.arm("fadeGoldBlack", BLACK, { start: GOLD, speed: 10 }); }
  glowPink(): void { this.arm("glowPink", PINK, { speed: 10, next: "fadeBlack" }); }
  fadeBlack(): void { this.arm("fadeBlack", BLACK, { start: this.lastColour, speed: 10 }); }
  flashWhite(): void { this.arm("flashWhite", BLACK, { start: WHITE, speed: 10 }); }
  flickWhite(): void { this.arm("flickWhite", BLACK, { start: WHITE, speed: 33 }); }
  pulseWhite(): void { this.arm("pulseWhite", BLACK, { start: WHITE, pingpong: true }); }

  // stopGlowRed/stopGlowTeal (253-271): cancel, demoting glowRedAndTeal back to the other single glow.
  stopGlowRed(): void {
    if (this.current === "glowRed") this.cancel();
    else if (this.current === "glowRedAndTeal") { this.cancel(); this.glowTeal(); }
  }
  stopGlowTeal(): void {
    if (this.current === "glowTeal") this.cancel();
    else if (this.current === "glowRedAndTeal") { this.cancel(); this.glowRed(); }
  }
  stopPulseWhite(): void { if (this.current === "pulseWhite") this.cancel(); }

  // transColorFin (281-293): the tween reached its end — run the chained next, or clear and notify.
  private finish(): void {
    if (this.next) { const n = this.next; this.next = ""; (this as any)[n]?.(); }
    else { this.lastColour = this.colourAt(); this.current = ""; this.active = false; this.entity.send("colourTransformFin"); }
  }

  // objTransColor.step: linear tween of t toward the target by `speed`/tick (gGameSpeed-scaled). For a
  // ping-pong, reverse direction at the ends and hold (held glows never finish; non-ping-pong finish at 1).
  update(next: NextFn): void {
    if (this.active) {
      const step = this.speed * game.gameSpeed;
      this.t += this.dir * step;
      if (this.pingpong) {
        if (this.t >= 255) { this.t = 255; this.dir = -1; }
        else if (this.t <= 0) { this.t = 0; this.dir = 1; } // bounce back up (held glow oscillates)
      } else if (this.t >= 255) {
        this.t = 255; this.finish();
      }
    }
    next();
  }

  private colourAt(): RGB {
    const k = Math.max(0, Math.min(1, this.t / 255));
    return [
      Math.round(this.start[0] + (this.target[0] - this.start[0]) * k),
      Math.round(this.start[1] + (this.target[1] - this.start[1]) * k),
      Math.round(this.start[2] + (this.target[2] - this.start[2]) * k),
    ];
  }

  // getColourTransform: the renderer reads this for the offscreen tint pass. While active, the tint is
  // the TARGET colour (so the glow's hue is stable) at a strength that ramps with the tween progress.
  // A pure-black target (a fade-to-black tail) ramps DOWN as t->255. null when idle.
  getColourTransform(): Tint | null {
    if (!this.active) return null;
    const k = Math.max(0, Math.min(1, this.t / 255));
    // brightness of the current lerped colour drives strength; for a bright target it ramps up, for a
    // fade-to-black it ramps down. Floor a freshly-armed bright transform so the glow shows immediately.
    const rgb = this.colourAt();
    const targetBright = Math.max(this.target[0], this.target[1], this.target[2]) > 0;
    let strength = Math.max(rgb[0], rgb[1], rgb[2]) / 255;
    if (targetBright) strength = Math.max(strength, 0.15 + k * 0.85); // ramp 0.15 -> 1.0 toward a bright target
    if (strength <= 0.01) return null;
    // the tint hue: the target colour for a bright target (stable glow hue), else the current lerp.
    const tintRgb: RGB = targetBright ? this.target : rgb;
    return { rgb: tintRgb, strength, additive: ADDITIVE.has(this.current) };
  }
}
