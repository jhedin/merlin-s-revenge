// ColourTransform (modColourTransform): the real tint/glow palette — NOT a binary white flash. Each
// transform tweens the sprite's colour from a start to a target at a `speed`, optionally ping-ponging,
// optionally chaining to a next transform when it finishes (transColorFin). A new transform cancels the
// current one (cancelTransColor). The component exposes a resolved tint {rgb, strength} to the renderer,
// which applies it via an offscreen source-atop pass (cached by quantized frame/colour/strength — NO
// per-frame getImageData).
//
// The tween is the faithful objTransColor/objTransformer model (NOT a hand-tuned linear-t heuristic):
//   objTransColor.init (22-46):  pCurr starts at 0, setTarget(100) — pCurr is a PERCENT in [0,100].
//   objTransformer.update (117-128):  pCurr = VarToward(pCurr, pTarget=100, pSpeed) each tick, then
//                                     updateAttribute(). The FIRST frame after init does NOT step.
//   objTransformer.setSpeed (113-115): pSpeed = speed * gGameSpeed.
//   VarToward (var,targit,amount):  move var toward targit by amount, clamped (so pCurr += pSpeed, cap 100).
//   objTransColor.updateAttribute (86-97):  newColor = VarColRange(pCurr, pStartColor, pTargetColor).
//   VarColRange (percent,col1,col2):  per-channel  col1 + (col2-col1)*(percent/100)  (Director rgb 0..255).
//   objTransformer.finishConditionMet (60-69):  non-pingpong finishes when pCurr == 100; pingpong instead
//                                     SWAPS pTarget<->pInitialValue at each end (so pCurr bounces 0->100->0).
//   objTransColor.initCurrentColor (48-57):  a #current start = the sprite's CURRENT resolved colour at the
//                                     moment the transform is armed (member.color) — the live tint, NOT black.
//
// Palette (modColourTransform.txt, the A.2 table):
//   glowRed       current->rgb(255,0,0)   speed 10  pingpong  (low health, held)
//   glowTeal      current->rgb(0,255,255) speed 100           (freeze, held)
//   glowRedAndTeal rgb(0,255,255)->rgb(255,0,0) speed 10 pingpong (low-health while frozen)
//   glowGold      current->rgb(255,201,57) speed 10 -> fadeGoldBlack (heal)
//   fadeGoldBlack rgb(255,201,57)->black  speed 10            (tail of glowGold)
//   glowPink      current->rgb(255,200,200) speed 10 -> fadeBlack
//   fadeBlack     last->black             speed 10
//   flashWhite    white->black            speed 10 (default)
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

// #current sentinel for arm()'s start: capture the live resolved colour at arm time (initCurrentColor).
const CURRENT = "#current" as const;

export interface Tint { rgb: RGB; strength: number; additive: boolean; }

// VarColRange (percent,col1,col2): per-channel lerp col1 + (col2-col1)*(percent/100), percent in [0,100].
function varColRange(percent: number, c1: RGB, c2: RGB): RGB {
  const p = Math.max(0, Math.min(100, percent)) / 100;
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * p),
    Math.round(c1[1] + (c2[1] - c1[1]) * p),
    Math.round(c1[2] + (c2[2] - c1[2]) * p),
  ];
}

// VarToward (var,targit,amount): move var toward targit by amount, clamping so it never overshoots.
function varToward(v: number, targit: number, amount: number): number {
  if (v > targit) { v -= amount; if (v < targit) v = targit; }
  else if (v < targit) { v += amount; if (v > targit) v = targit; }
  return v;
}

export class ColourTransform extends Component {
  // Only `update` (and the renderer's getColourTransform query) are dispatched messages; the palette
  // methods (glowRed/flickWhite/...) are invoked DIRECTLY via entity.tryGet(ColourTransform) by the
  // trigger components (Energy/Freeze/Hurt) — direct calls avoid chain ambiguity/recursion.
  static handles = ["update", "getColourTransform"];

  // pCurrentTransform: the single active transform name (#none when idle).
  private current = "";
  // pNextTransform: a follow-up transform run when the current finishes (chain).
  private next = "";
  // pStartColor / pTargetColor: the fixed tween endpoints (Director rgb 0..255).
  private start: RGB = BLACK;
  private target: RGB = BLACK;
  // pSpeed (pre-gGameSpeed): per-tick increment of pCurr toward its end.
  private speed = 10;
  // pPingPong: bounce at the ends instead of finishing (held oscillating glows).
  private pingpong = false;
  // pCurr: the tween PERCENT in [0,100]. colour = VarColRange(pCurr, start, target).
  private curr = 0;
  // pInitialValue / pTarget for the pingpong end-swap (objTransformer.finishConditionMet 60-69).
  private from = 0;     // pInitialValue: the end pCurr is leaving
  private toward = 100; // pTarget:       the end pCurr is heading to
  // pFirstFrame: the first update() after init does not step (so the start colour shows for a tick).
  private firstFrame = true;
  // pLastFinishingColour: the live resolved colour we were before reset to black (cancelTransColor 56-67).
  private lastColour: RGB = BLACK;
  private active = false;

  override init(): void { this.cancel(); }
  override reset(): void { this.cancel(); }

  // newTransColor (modColourTransform.newTransColor 195-207): cancel the current, clear the chain, arm a
  // tween. `start` may be a literal RGB or CURRENT — CURRENT resolves to the live colour captured by cancel().
  private arm(name: string, target: RGB, opts: { start?: RGB | typeof CURRENT; speed?: number; pingpong?: boolean; next?: string } = {}): void {
    // newTransColor first calls cancelTransColor (modColourTransform 196), which stashes the LIVE resolved
    // colour into pLastFinishingColour. Capture it BEFORE overwriting the endpoints so a #current start (and
    // fadeBlack) resolves to the colour we are actually showing this instant, not a stale value.
    if (this.active) this.lastColour = this.colourAt();
    const startSpec = opts.start ?? CURRENT;
    // initCurrentColor (48-57): a #current start = the sprite's CURRENT resolved colour at arm time, so a glow
    // that interrupts another glow starts from the right hue rather than snapping to black. When idle the live
    // colour is black (no overlay) — correct for the common idle->glow case.
    this.start = startSpec === CURRENT ? this.lastColour : (startSpec as RGB);
    this.current = name;
    this.next = opts.next ?? "";
    this.target = target;
    this.speed = opts.speed ?? 10;
    this.pingpong = opts.pingpong ?? false;
    // objTransColor.init: pCurr=0, setTarget(100). (If start==target the original collapses the range via
    // setTarget(1); here pCurr simply sweeps a zero-length colour range — the colour stays constant — and
    // then finishes, which is the same observable result.)
    this.curr = 0; this.from = 0; this.toward = 100; this.firstFrame = true; this.active = true;
  }

  // cancelTransColor (56-67): stop the tween, remember the live colour (pLastFinishingColour) so a chained
  // #current start (or fadeBlack) resumes from it, then go idle (the sprite is reset to black = no tint).
  private cancel(): void {
    if (this.active) this.lastColour = this.colourAt();
    this.current = ""; this.next = ""; this.active = false;
    this.curr = 0; this.from = 0; this.toward = 100; this.firstFrame = true;
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
  // fadeBlack (79-89): start = pLastFinishingColour (the colour at the end of the prior transform).
  fadeBlack(): void { this.arm("fadeBlack", BLACK, { start: this.lastColour, speed: 10 }); }
  flashWhite(): void { this.arm("flashWhite", BLACK, { start: WHITE, speed: 10 }); }
  flickWhite(): void { this.arm("flickWhite", BLACK, { start: WHITE, speed: 33 }); }
  pulseWhite(): void { this.arm("pulseWhite", BLACK, { start: WHITE, speed: 10, pingpong: true }); }

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

  // objTransformer.update (117-128): the first frame after init holds (just shows the start colour); every
  // later tick steps pCurr toward `toward` by speed*gGameSpeed (VarToward, clamped). finishConditionMet
  // (60-69): pingpong swaps the ends (initialValue<->target) so pCurr bounces 0<->100; non-pingpong
  // finishes when pCurr reaches 100.
  update(next: NextFn): void {
    if (this.active) {
      if (this.firstFrame) {
        this.firstFrame = false; // pFirstFrame: skip the first step so the start colour renders for a tick
      } else {
        const step = this.speed * game.gameSpeed; // pSpeed = speed * gGameSpeed
        this.curr = varToward(this.curr, this.toward, step);
        if (this.curr === this.toward) {
          if (this.pingpong) {
            // swap the ends so the next sweep heads back the other way (held glow oscillates 0<->100).
            const t = this.toward; this.toward = this.from; this.from = t;
          } else {
            this.finish();
          }
        }
      }
    }
    next();
  }

  // the live resolved colour: VarColRange(pCurr, start, target). pCurr/from/toward describe the sweep; the
  // colour endpoints (start/target) are fixed, so the colour reads `start` at pCurr=0 and `target` at
  // pCurr=100 regardless of which way a pingpong is currently heading.
  private colourAt(): RGB { return varColRange(this.curr, this.start, this.target); }

  // getColourTransform: the renderer reads this for the offscreen tint pass. The tint colour is the LIVE
  // lerped colour (VarColRange) — exactly the sprite member.color the original would have set, so the glow's
  // HUE progresses faithfully start->target. Strength is the overlay's coverage:
  //   - toward a BRIGHT target (glowRed/Teal/Gold/Pink, white pulse peak): the original is BRIGHTENING the
  //     sprite, so the overlay is "on" the instant it is armed. We floor strength to track the tween percent
  //     (pCurr/100) rather than the lerped-from-black brightness, so an idle->glow shows immediately instead
  //     of spending its first frames invisibly at black. The hue still comes from the exact VarColRange lerp.
  //   - toward a BLACK target (flickWhite/flashWhite, fadeBlack/fadeGoldBlack tails, pulseWhite trough): the
  //     original is DARKENING toward black, so strength faithfully follows the lerped brightness DOWN to 0.
  getColourTransform(): Tint | null {
    if (!this.active) return null;
    const rgb = this.colourAt();
    const lit = Math.max(rgb[0], rgb[1], rgb[2]) / 255;            // brightness of the live lerped colour
    const targetBright = Math.max(this.target[0], this.target[1], this.target[2]) > 0;
    // pCurr in [0,100] -> the tween fraction; for a bright target the overlay ramps in with it from a small
    // floor (the glow is "armed/on" the instant it starts, even while the lerped colour is still near black).
    const k = Math.max(0, Math.min(1, this.curr / 100));
    const strength = targetBright ? Math.max(lit, 0.15 + k * 0.85) : lit;
    if (strength <= 0.01) return null;
    return { rgb, strength, additive: ADDITIVE.has(this.current) };
  }
}
