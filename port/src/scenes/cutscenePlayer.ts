// Cutscene player (cutSceneMaster + modThespian): drives stage actors and dialogue from a parsed
// cutscene. Presentational verbs (at/enterStage/turnToFace/backgroundColourTo/lights/showTitle/
// wait) are implemented; dialogue advances on space. A subset of modThespian's verb set.

import type { Cutscene } from "../data/cutscene";
import type { Assets } from "../render/assets";
import type { Renderer } from "../render/renderer";
import type { Input } from "../systems/input";

const SYM_CHAR: Record<string, string> = { merlin: "mer", ulin: "uli", berlin: "ber", tv: "tv" };

interface StageActor { sym: string; char: string; x: number; facingLeft: boolean; visible: boolean; }

export class CutscenePlayer {
  private i = 0;
  private waitTicks = 0;
  private current?: { name: string; text: string };
  private bg = "#0a1018";
  private lights = true;
  private title = "";
  private actors: Record<string, StageActor> = {};
  private readonly groundY: number;

  constructor(private cut: Cutscene, private assets: Assets, private viewW: number, private viewH: number) {
    this.groundY = Math.round(viewH * 0.6);
    for (const [alias, sym] of Object.entries(cut.chars)) {
      const name = sym.replace("#", "");
      this.actors[alias] = { sym, char: SYM_CHAR[name] ?? name.slice(0, 3), x: viewW / 2, facingLeft: false, visible: false };
    }
  }

  /** advance one tick; returns true when the cutscene is finished (or skipped). */
  tick(input: Input): boolean {
    if (input.pressed("escape")) return true;
    if (this.current) {
      if (input.pressed(" ") || input.pressed("enter")) { this.current = undefined; this.i++; }
      return false;
    }
    if (this.waitTicks > 0) { this.waitTicks--; return false; }
    while (this.i < this.cut.steps.length) {
      const s = this.cut.steps[this.i]!;
      if (s.kind === "say") {
        const sym = this.cut.chars[s.alias] ?? s.alias;
        this.current = { name: sym.replace("#", ""), text: s.text };
        const a = this.actors[s.alias]; if (a) a.visible = true;
        return false;
      }
      this.applyCmd(s.actor, s.verb, s.args);
      if (s.verb === "wait") { this.waitTicks = Number(s.args[0]) || 30; this.i++; return false; }
      this.i++;
    }
    return true;
  }

  private applyCmd(actor: string | undefined, verb: string, args: string[]): void {
    const a = actor ? this.actors[actor] : undefined;
    const n = (s?: string) => { const m = /-?\d+/.exec(s ?? ""); return m ? Number(m[0]) : 0; };
    switch (verb) {
      case "at": if (a) { a.x = n(args[0]); a.visible = true; } break;
      case "enterStageRight": if (a) { a.x = n(args[0]) || this.viewW - 60; a.visible = true; a.facingLeft = true; } break;
      case "enterStageLeft": if (a) { a.x = n(args[0]) || 60; a.visible = true; a.facingLeft = false; } break;
      case "exitStageRight": case "teleportOut": if (a) a.visible = false; break;
      case "teleportInAt": if (a) { a.x = n(args[0]); a.visible = true; } break;
      case "turnToFace": {
        const t = args[0] ? this.actors[args[0]] : undefined;
        if (a && t) a.facingLeft = t.x < a.x;
        break;
      }
      case "backgroundColourTo": {
        const m = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(args.join(""));
        if (m) this.bg = `rgb(${m[1]},${m[2]},${m[3]})`;
        break;
      }
      case "lightsUp": this.lights = true; break;
      case "lightsDown": this.lights = false; break;
      case "showTitle": this.title = args.join(" "); break;
      case "setStage": for (const k of Object.keys(this.actors)) this.actors[k]!.visible = false; break;
    }
  }

  render(renderer: Renderer): void {
    const ctx = renderer.ctx;
    const { viewW, viewH } = this;
    ctx.fillStyle = this.bg; ctx.fillRect(0, 0, viewW, viewH);
    // actors (scaled 2x, anchored at the ground line)
    const scale = 2;
    for (const a of Object.values(this.actors)) {
      if (!a.visible) continue;
      const anim = this.assets.index.anims[`${a.char}_stand`] ?? this.assets.index.anims[`${a.char}_walk`];
      const f = anim?.frames[0];
      if (!f) continue;
      const img = this.assets.img(f.file);
      const w = f.w * scale, h = f.h * scale;
      const dx = Math.round(a.x - w / 2), dy = Math.round(this.groundY - h);
      ctx.save();
      if (a.facingLeft) { ctx.translate(dx + w, dy); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0, w, h); }
      else ctx.drawImage(img, dx, dy, w, h);
      ctx.restore();
    }
    if (!this.lights) { ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, 0, viewW, viewH); }
    if (this.title) {
      ctx.textAlign = "center"; ctx.fillStyle = "#fc4"; ctx.font = "bold 20px serif";
      ctx.fillText(this.title, viewW / 2, viewH / 2); ctx.textAlign = "left";
    }
    // dialogue box
    if (this.current) {
      const boxH = 56, y = viewH - boxH - 6;
      ctx.fillStyle = "rgba(0,0,0,0.78)"; ctx.fillRect(8, y, viewW - 16, boxH);
      ctx.strokeStyle = "#577"; ctx.strokeRect(8, y, viewW - 16, boxH);
      ctx.fillStyle = "#fc4"; ctx.font = "bold 10px monospace";
      ctx.fillText(this.current.name + ":", 16, y + 14);
      ctx.fillStyle = "#fff"; ctx.font = "10px monospace";
      wrap(ctx, this.current.text, 16, y + 28, viewW - 32, 12);
      ctx.fillStyle = "#7a8"; ctx.font = "8px monospace";
      ctx.fillText("space ▶", viewW - 56, y + boxH - 6);
    }
    ctx.fillStyle = "#445"; ctx.font = "8px monospace"; ctx.fillText("esc: skip", 12, 14);
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
