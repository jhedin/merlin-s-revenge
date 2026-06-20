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

export class CutscenePlayer {
  private thespian: Thespian;

  constructor(cut: Cutscene, private assets: Assets, private viewW: number, private viewH: number,
    host: Partial<ThespianHost> = {}) {
    const full: ThespianHost = { viewW, viewH, ...host };
    this.thespian = new Thespian(cut, full);
  }

  /** advance one tick; returns true when the cutscene is finished (or skipped). */
  tick(input: Input): boolean {
    if (input.pressed("escape") || input.pressed(" ") || input.pressed("enter")) this.thespian.cancel();
    return this.thespian.tick();
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
      if (p.wasted) ctx.globalAlpha = 0.4; // modWastedMode blend (~30%)
      if (m.facingLeft) { ctx.translate(dx + w, dy); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0, w, p.wasted ? h * 0.6 : h); }
      else ctx.drawImage(img, dx, dy, w, p.wasted ? h * 0.6 : h);
      ctx.restore();
    }

    // lights (fade to black)
    const dark = t.darkness();
    if (dark > 0) { ctx.fillStyle = `rgba(0,0,0,${(0.55 * dark).toFixed(3)})`; ctx.fillRect(0, 0, viewW, viewH); }

    if (t.title) {
      ctx.textAlign = "center"; ctx.fillStyle = "#fc4"; ctx.font = "bold 20px serif";
      ctx.fillText(t.title, viewW / 2, viewH / 2); ctx.textAlign = "left";
    }

    // speech caption (auto-advancing; no prompt)
    const speech = t.getSpeech();
    if (speech) {
      const boxH = 56, y = viewH - boxH - 6;
      ctx.fillStyle = "rgba(0,0,0,0.78)"; ctx.fillRect(8, y, viewW - 16, boxH);
      ctx.strokeStyle = "#577"; ctx.strokeRect(8, y, viewW - 16, boxH);
      ctx.fillStyle = "#fc4"; ctx.font = "bold 10px monospace";
      ctx.fillText(speech.speaker + ":", 16, y + 14);
      ctx.fillStyle = "#fff"; ctx.font = "10px monospace";
      wrap(ctx, speech.text, 16, y + 28, viewW - 32, 12);
    }
    ctx.fillStyle = "#445"; ctx.font = "8px monospace"; ctx.fillText("esc/space: skip", 12, 14);
  }

  /** debug: visible cutscene actors' x positions (used by the H verification tool). */
  visibleActorXs(): number[] {
    return this.thespian.visibleActors().map((p) => Math.round(p.entity.get(Movement).x));
  }
  /** debug: the active speech text (or null). */
  speechText(): string | null { return this.thespian.getSpeech()?.text ?? null; }

  /** bind an existing entity (the real Merlin) into the cast under an alias before play (wasted scene). */
  static withBound(cut: Cutscene, assets: Assets, viewW: number, viewH: number,
    host: Partial<ThespianHost>, bound: Record<string, Entity>): CutscenePlayer {
    return new CutscenePlayer(cut, assets, viewW, viewH, { ...host, bound });
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number): void {
  const words = text.split(" ");
  let line = ""; let yy = y;
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += lh; }
    else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
}
