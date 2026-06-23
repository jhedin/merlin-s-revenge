// Cutscene host: a thin wrapper that owns a Thespian engine (the faithful cutSceneMaster + modThespian
// runner over REAL spawned actors) and renders its stage — background colour, lights, title, the live
// cutscene actors (drawn from their own Anim sprites), and the auto-advancing speech caption.
//
// The Thespian drives real entities through Movement/Anim; this host only paints them. Dialogue
// auto-advances on the frame-timed line model (no space press); ESC/space cancels the whole scene.

import type { Cutscene } from "../data/cutscene";
import { Thespian, type ThespianHost } from "./thespian";
import { Anim } from "../components/anim";
import { Movement } from "../components/movement";
import type { Assets } from "../render/assets";
import type { Renderer } from "../render/renderer";
import type { Input } from "../systems/input";
import type { Entity } from "../engine/dispatch";
import { drawText, measureText } from "../render/text";

export class CutscenePlayer {
  private thespian: Thespian;
  private readonly ingame: boolean;
  // modThespian pSkipCounter: an #ingame dialogue can only be walked/clicked away AFTER skipDuration
  // frames (i[#skipDuration]=30) — so brushing a movement key as the scene opens doesn't instantly skip it.
  private skipGrace = 30;

  constructor(cut: Cutscene, private assets: Assets, private viewW: number, private viewH: number,
    host: Partial<ThespianHost> = {}) {
    const full: ThespianHost = { viewW, viewH, ...host };
    this.ingame = host.ingame === true;
    this.thespian = new Thespian(cut, full);
  }

  /** advance one tick; returns true when the cutscene is finished (or skipped). */
  tick(input: Input): boolean {
    if (this.skipGrace > 0) this.skipGrace--;
    // ESC / space / enter always cancel the whole scene.
    let skip = input.pressed("escape") || input.pressed(" ") || input.pressed("enter");
    // objAiPlayer.interpretMoveKeys/interpretMouse -> modThespian.AIisTryingToMove: in an #ingame dialogue,
    // once the skip grace has elapsed, TRYING TO MOVE or CLICK cancels the script (scriptCancelled).
    if (this.ingame && this.skipGrace === 0) {
      const mv = input.moveVector();
      if (mv.x !== 0 || mv.y !== 0 || input.mousePressed()) skip = true;
    }
    if (skip) this.thespian.cancel();
    return this.thespian.tick();
  }

  /** K12: render an #ingame cutscene OVER the live game view (no full-stage background). Draws the
   *  Thespian-spawned actors (e.g. ulin) in world space + the speech bubble above the speaker's head.
   *  The live Merlin (bound) is already drawn by the game loop, so it is excluded (spawnedVisibleActors). */
  renderInGame(renderer: Renderer): void {
    const ctx = renderer.ctx;
    const t = this.thespian;
    // spawned actors (ulin) in world space, from each entity's OWN Anim sprite (no 2x scale: world units).
    for (const p of t.spawnedVisibleActors()) {
      const sp = p.entity.tryGet(Anim)?.sprite();
      const m = p.entity.get(Movement);
      if (!sp) continue;
      const img = sp.img as CanvasImageSource;
      const w = (img as HTMLImageElement).width, h = (img as HTMLImageElement).height;
      const dx = Math.round(m.x - w / 2), dy = Math.round(m.y - h);
      ctx.save();
      ctx.globalAlpha = t.actorAlpha(p); // K17 per-actor fade
      if (m.facingLeft) { ctx.translate(dx + w, dy); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0, w, h); }
      else ctx.drawImage(img, dx, dy, w, h);
      ctx.restore();
    }
    // speech bubble above the speaker's head (modThespian.displaySpeechInGame), world-anchored.
    const speech = t.getSpeech();
    if (speech) {
      const pos = t.speakerPos(speech.alias) ?? { x: this.viewW / 2, y: 40 };
      drawBubble(ctx, this.assets, speech.text, pos.x, pos.y - 28, this.viewW);
    }
    ctx.fillStyle = "#445"; drawText(ctx, this.assets, "small", "move/click/esc: skip", 12, 14, { fallbackFont: "8px monospace" });
  }

  render(renderer: Renderer): void {
    const ctx = renderer.ctx;
    const { viewW, viewH } = this;
    const t = this.thespian;
    ctx.fillStyle = `rgb(${Math.round(t.bg.r)},${Math.round(t.bg.g)},${Math.round(t.bg.b)})`;
    ctx.fillRect(0, 0, viewW, viewH);

    // actors (scaled 2x, anchored at the ground line) — drawn from each entity's OWN Anim sprite.
    const scale = 2;
    for (const p of t.visibleActors()) {
      const sp = p.entity.tryGet(Anim)?.sprite();
      const m = p.entity.get(Movement);
      if (!sp) continue;
      const img = sp.img as CanvasImageSource;
      const w = (img as HTMLImageElement).width * scale, h = (img as HTMLImageElement).height * scale;
      let dx = Math.round(m.x - w / 2), dy = Math.round(m.y - h);
      if (p.wasted) { dy = Math.round(m.y - h * 0.6); } // modWastedMode squash (h=60%)
      ctx.save();
      // K17 per-actor fade alpha (lightsUp/Down fade each actor under its own fader) × the wasted blend.
      // modWastedMode.wastedModeOn: setBlend(30) -> 0.30 opacity (the squashed ghost is mostly translucent).
      ctx.globalAlpha = t.actorAlpha(p) * (p.wasted ? 0.3 : 1);
      if (m.facingLeft) { ctx.translate(dx + w, dy); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0, w, p.wasted ? h * 0.6 : h); }
      else ctx.drawImage(img, dx, dy, w, p.wasted ? h * 0.6 : h);
      ctx.restore();
    }

    // lights (fade to black)
    const dark = t.darkness();
    if (dark > 0) { ctx.fillStyle = `rgba(0,0,0,${(0.55 * dark).toFixed(3)})`; ctx.fillRect(0, 0, viewW, viewH); }

    if (t.title && t.titleAlpha > 0) {
      // objCutSceneTitle: gold rgb(204,204,0), cross-faded in/held/out (titleAlpha). #menu face, ×2, centred.
      ctx.save(); ctx.globalAlpha = t.titleAlpha;
      ctx.textAlign = "center"; ctx.fillStyle = "#cccc00";
      drawText(ctx, this.assets, "menu", t.title, viewW / 2, viewH / 2, { align: "center", scale: 2, colour: "#cccc00", fallbackFont: "bold 20px serif" });
      ctx.textAlign = "left"; ctx.restore();
    }

    // modThespian.displaySpeechCutScene: BARE text floating just above the SPEAKER's head — no caption bar,
    // no "speaker:" prefix (that bottom VN bar was a port invention). Centre-wrapped over the speaker.
    const speech = t.getSpeech();
    if (speech) {
      const pos = t.speakerPos(speech.alias);
      const cx = pos ? Math.round(pos.x) : viewW / 2;
      // anchor above the 2×-scaled actor's head (feet at pos.y; ~55px sprite ×2 ≈ 110px tall).
      const topY = Math.max(12, (pos ? Math.round(pos.y) - 124 : 24));
      ctx.fillStyle = "#fff"; ctx.textAlign = "center";
      wrapCentered(ctx, this.assets, speech.text, cx, topY, Math.min(viewW - 16, 260), 11);
      ctx.textAlign = "left";
    }
    ctx.fillStyle = "#445"; drawText(ctx, this.assets, "small", "esc/space: skip", 12, 14, { fallbackFont: "8px monospace" });
  }

  /** debug: visible cutscene actors' x positions (used by the H verification tool). */
  visibleActorXs(): number[] {
    return this.thespian.visibleActors().map((p) => Math.round(p.entity.get(Movement).x));
  }
  /** debug: the active speech text (or null). */
  speechText(): string | null { return this.thespian.getSpeech()?.text ?? null; }
  /** K12: is this an in-game cutscene (rendered over the live game via renderInGame)? */
  isInGame(): boolean { return this.thespian.ingame; }

  /** bind an existing entity (the real Merlin) into the cast under an alias before play (wasted scene). */
  static withBound(cut: Cutscene, assets: Assets, viewW: number, viewH: number,
    host: Partial<ThespianHost>, bound: Record<string, Entity>): CutscenePlayer {
    return new CutscenePlayer(cut, assets, viewW, viewH, { ...host, bound });
  }
}

// a speech bubble above a speaker's head (modThespian.displaySpeechInGame): a blended rect + wrapped text.
// SS-1: layout + draw measured by the #small bitmap face (measureText falls back to ctx when absent).
function drawBubble(ctx: CanvasRenderingContext2D, assets: Assets, text: string, cx: number, baseY: number, viewW: number): void {
  ctx.font = "9px monospace";
  const M = (s: string) => measureText(ctx, assets, "small", s);
  // wrap to a max bubble width, measure the laid-out lines, then draw the rect + text.
  const maxW = Math.min(180, viewW - 16);
  const words = text.split(" "); const lines: string[] = []; let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (M(test) > maxW - 8 && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  const lh = 11, padX = 5, padY = 4;
  const boxW = Math.min(maxW, Math.max(...lines.map((l) => M(l))) + padX * 2);
  const boxH = lines.length * lh + padY * 2;
  let x = Math.round(cx - boxW / 2); let y = Math.round(baseY - boxH);
  x = Math.max(4, Math.min(x, viewW - boxW - 4)); y = Math.max(4, y);
  ctx.fillStyle = "rgba(0,0,0,0.78)"; ctx.fillRect(x, y, boxW, boxH);
  ctx.strokeStyle = "#577"; ctx.strokeRect(x, y, boxW, boxH);
  ctx.fillStyle = "#fff";
  lines.forEach((l, i) => drawText(ctx, assets, "small", l, x + padX, y + padY + (i + 1) * lh - 3, { fallbackFont: "9px monospace" }));
}

function wrap(ctx: CanvasRenderingContext2D, assets: Assets, text: string, x: number, y: number, maxW: number, lh: number): void {
  const M = (s: string) => measureText(ctx, assets, "small", s);
  const words = text.split(" ");
  let line = ""; let yy = y;
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (M(test) > maxW && line) { drawText(ctx, assets, "small", line, x, yy, { fallbackFont: "10px monospace" }); line = w; yy += lh; }
    else line = test;
  }
  if (line) drawText(ctx, assets, "small", line, x, yy, { fallbackFont: "10px monospace" });
}

// like wrap() but each line is CENTRED on cx (cutscene speech floats centred above the speaker's head).
function wrapCentered(ctx: CanvasRenderingContext2D, assets: Assets, text: string, cx: number, y: number, maxW: number, lh: number): void {
  const M = (s: string) => measureText(ctx, assets, "small", s);
  const words = text.split(" ");
  const lines: string[] = []; let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (M(test) > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  let yy = y;
  for (const ln of lines) { drawText(ctx, assets, "small", ln, cx, yy, { align: "center", colour: "#fff", fallbackFont: "10px monospace" }); yy += lh; }
}
