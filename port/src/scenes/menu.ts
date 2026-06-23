// Data-driven keyboard menu (objMenu): a vertical list navigated with up/down and chosen with
// space/enter. Items can be SHADOWED (greyed + unselectable, e.g. Save while a cutscene plays —
// gameMaster.isMenuItemShadowed) and act on a dispatched symbol. The content loads from a menu
// definition table (the parity bit is data-drive + shadowing, not bitmap art).

import type { Input } from "../systems/input";
import type { Renderer } from "../render/renderer";
import { game } from "../game/context";
import { drawText } from "../render/text";

export interface MenuItem {
  label: string;
  action: () => void;
  /** isMenuItemShadowed: greyed + unselectable while this predicate holds. */
  shadowed?: () => boolean;
}

export class Menu {
  index = 0;
  constructor(public title: string, public items: MenuItem[]) { this.index = this.firstSelectable(0, 1); }

  private isShadowed(i: number): boolean { return this.items[i]?.shadowed?.() ?? false; }
  // find the next selectable (non-shadowed) item from `start` moving by `dir` (wraps).
  private firstSelectable(start: number, dir: number): number {
    const n = this.items.length;
    for (let k = 0; k < n; k++) {
      const i = ((start + dir * k) % n + n) % n;
      if (!this.isShadowed(i)) return i;
    }
    return start;
  }

  tick(input: Input): void {
    if (input.pressed("arrowup") || input.pressed("w")) this.index = this.firstSelectable(this.index - 1, -1);
    if (input.pressed("arrowdown") || input.pressed("s")) this.index = this.firstSelectable(this.index + 1, 1);
    if (input.pressed(" ") || input.pressed("enter")) {
      if (!this.isShadowed(this.index)) this.items[this.index]!.action();
    }
  }

  render(renderer: Renderer, w: number, h: number, opaque = true): void {
    const ctx = renderer.ctx;
    const a = game.assets;
    if (opaque) { ctx.fillStyle = "rgba(0,0,0,0.72)"; ctx.fillRect(0, 0, w, h); }
    ctx.textAlign = "center";
    // SS-1: title + items via the #menu face (objMenuController #fontObj=#menu); the ↑/↓ hint via #small.
    // The ▶ selection arrow isn't in the menu key → substitute "> " (in-face) for the bitmap path; the
    // fillText fallback keeps the original ▶ when the font art is absent.
    if (this.title) { ctx.fillStyle = "#fc4"; drawText(ctx, a, "menu", this.title, w / 2, h / 2 - 36, { align: "center", fallbackFont: "bold 16px serif" }); }
    const usingBitmap = !!a?.font?.("menu");
    this.items.forEach((it, i) => {
      const sel = i === this.index;
      const shadow = this.isShadowed(i);
      ctx.fillStyle = shadow ? "#556" : sel ? "#fff" : "#9ab"; // shadowed items greyed
      const marker = sel && !shadow ? (usingBitmap ? "> " : "▶ ") : "  ";
      drawText(ctx, a, "menu", marker + it.label, w / 2, h / 2 - 8 + i * 16, { align: "center", fallbackFont: "11px monospace" });
    });
    ctx.fillStyle = "#566";
    drawText(ctx, a, "small", usingBitmap ? "up/down select   space confirm" : "↑/↓ select   space confirm", w / 2, h - 14, { align: "center", fallbackFont: "8px monospace" });
    ctx.textAlign = "left";
  }
}
