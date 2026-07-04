// Data-driven keyboard menu (objMenu): a vertical list navigated with up/down and chosen with
// space/enter. Items can be SHADOWED (greyed + unselectable, e.g. Save while a cutscene plays —
// gameMaster.isMenuItemShadowed) and act on a dispatched symbol. The content loads from a menu
// definition table (the parity bit is data-drive + shadowing, not bitmap art).

import type { Input } from "../systems/input";
import type { Renderer } from "../render/renderer";
import { game } from "../game/context";
import { drawText, measureText } from "../render/text";
import { drawScrollBox } from "../render/menuBackground";

export interface MenuItem {
  label: string | (() => string);
  action: () => void;
  /** isMenuItemShadowed: greyed + unselectable while this predicate holds. */
  shadowed?: () => boolean;
}

export class Menu {
  index = 0;
  constructor(public title: string, public items: MenuItem[]) { this.index = this.firstSelectable(0, 1); }

  private isShadowed(i: number): boolean { return this.items[i]?.shadowed?.() ?? false; }
  private isSelectable(i: number): boolean {
    const it = this.items[i];
    if (!it) return false;
    const label = typeof it.label === "function" ? it.label() : it.label;
    return label !== "-" && !this.isShadowed(i);
  }
  // find the next selectable (non-shadowed, non-divider) item from `start` moving by `dir` (wraps).
  private firstSelectable(start: number, dir: number): number {
    const n = this.items.length;
    for (let k = 0; k < n; k++) {
      const i = ((start + dir * k) % n + n) % n;
      if (this.isSelectable(i)) return i;
    }
    return start;
  }

  tick(input: Input): void {
    if (input.pressed("arrowup") || input.pressed("w")) this.index = this.firstSelectable(this.index - 1, -1);
    if (input.pressed("arrowdown") || input.pressed("s")) this.index = this.firstSelectable(this.index + 1, 1);
    if (input.pressed(" ") || input.pressed("enter")) {
      if (this.isSelectable(this.index)) this.items[this.index]!.action();
    }
  }

  render(renderer: Renderer, w: number, h: number, opaque = true): void {
    const ctx = renderer.ctx;
    const a = game.assets;
    if (opaque) { ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(0, 0, w, h); }
    ctx.textAlign = "center";

    const getLabel = (it: MenuItem) => typeof it.label === "function" ? it.label() : it.label;

    let maxW = this.title ? measureText(ctx, a, "menu", this.title) : 0;
    for (const it of this.items) {
      const label = getLabel(it);
      if (label === "-") continue;
      const iw = measureText(ctx, a, "menu", label); // no cursor glyph now — measure the bare label
      if (iw > maxW) maxW = iw;
    }
    // tight box matching the original: 32px (2 tiles) left inset + label + 32px (2 tiles) right pad; minimal top/bottom pad.
    const boxW = Math.max(140, Math.ceil((maxW + 64) / 16) * 16);
    const boxH = Math.ceil(((this.title ? 48 : 18) + this.items.length * 16 + 8) / 16) * 16;
    
    const startRow = this.title ? 3 : 1;
    const dividers = this.items
      .map((it, i) => getLabel(it) === "-" ? startRow + i : -1)
      .filter(r => r !== -1);

    const box = drawScrollBox(renderer, a, w / 2, h / 2 - 8, boxW, boxH, !!this.title, dividers);

    if (this.title) {
      ctx.fillStyle = "#000";
      drawText(ctx, a, "menu", this.title, w / 2, box.y + 16, { top: true, align: "center", fallbackFont: "bold 16px serif" });
    }

    // objMenu draws items FLUSH-LEFT inside the box (not centered), selection shown by colour only
    // (the original's rollover is yellow — no cursor glyph). Labels left-align at a 32px (2 tiles) inset so
    // every row starts at the same x, matching the original's main menu.
    const padX = 32;
    const labelX = box.x + padX;
    this.items.forEach((it, i) => {
      const label = getLabel(it);
      if (label === "-") return;
      const sel = i === this.index;
      const shadow = this.isShadowed(i);
      ctx.fillStyle = shadow ? "#777" : sel ? "#dd0" : "#000"; // Selected = yellow (rollover), Normal = black, Shadowed = grey
      drawText(ctx, a, "menu", label, labelX, box.y + (startRow + i) * 16, { top: true, align: "left", fallbackFont: "11px monospace" });
    });

    // (the original objMenu shows no nav-hint footer — removed to match.)
    ctx.textAlign = "left";
  }
}
