// Simple keyboard menu (objMenu): a vertical list navigated with up/down and chosen with
// space/enter. Used for the pause menu; the title/game-over screens could adopt it too.

import type { Input } from "../systems/input";
import type { Renderer } from "../render/renderer";

export interface MenuItem { label: string; action: () => void; }

export class Menu {
  index = 0;
  constructor(public title: string, public items: MenuItem[]) {}

  tick(input: Input): void {
    if (input.pressed("arrowup") || input.pressed("w")) this.index = (this.index + this.items.length - 1) % this.items.length;
    if (input.pressed("arrowdown") || input.pressed("s")) this.index = (this.index + 1) % this.items.length;
    if (input.pressed(" ") || input.pressed("enter")) this.items[this.index]!.action();
  }

  render(renderer: Renderer, w: number, h: number, opaque = true): void {
    const ctx = renderer.ctx;
    if (opaque) { ctx.fillStyle = "rgba(0,0,0,0.72)"; ctx.fillRect(0, 0, w, h); }
    ctx.textAlign = "center";
    if (this.title) { ctx.fillStyle = "#fc4"; ctx.font = "bold 16px serif"; ctx.fillText(this.title, w / 2, h / 2 - 36); }
    ctx.font = "11px monospace";
    this.items.forEach((it, i) => {
      const sel = i === this.index;
      ctx.fillStyle = sel ? "#fff" : "#9ab";
      ctx.fillText((sel ? "▶ " : "  ") + it.label, w / 2, h / 2 - 8 + i * 16);
    });
    ctx.fillStyle = "#566"; ctx.font = "8px monospace";
    ctx.fillText("↑/↓ select   space confirm", w / 2, h - 14);
    ctx.textAlign = "left";
  }
}
