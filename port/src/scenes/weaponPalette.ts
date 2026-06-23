// modWeaponSelector — the weapon-selector palette.
//
// The #weaponSelector key opens a palette of the player's owned weapons grouped by type (structMaster
// #weaponSelectorPaletteTypes = [#magic, #nonMagic]; offsets #magic -20 / #nonMagic +10 relative to the
// player). Each icon sits on a green box (greenBox_ws) — available — and the CURRENT weapon on a yellow box
// (yellowBox_ws). Clicking an icon issues commandIssued -> setCurrentWeapon and closes; otherwise it
// auto-closes after the idle timer (pTimer.tim[2] = 60 — "display for 2 secs"). The game keeps running
// (no pause); the 1-9 hotkeys remain an equivalent way to switch.

import type { Entity } from "../engine/dispatch";
import type { Input } from "../systems/input";
import type { Renderer } from "../render/renderer";
import type { Assets } from "../render/assets";
import { drawText } from "../render/text";
import { WeaponManager } from "../components/weapon";
import { Movement } from "../components/movement";

const ICON_W = 18, ICON_H = 16, GAP = 2; // pPaletteDefinitionStart tileSize point(18,16)
const DISPLAY_FRAMES = 60;               // pTimer.tim[2] = 60 (2 secs @ 30Hz)
// structWeaponSelectorPaletteOffsets: #magic above the player, #nonMagic below.
const ROWS: { type: "magic" | "nonMagic"; offsetY: number }[] = [
  { type: "magic", offsetY: -20 },
  { type: "nonMagic", offsetY: 10 },
];

export class WeaponPalette {
  displaying = false;
  private idle = 0;
  private syms: { type: "magic" | "nonMagic"; list: string[] }[] = [];
  private rects: { sym: string; x: number; y: number }[] = [];

  /** displayWeaponSelector: snapshot the owned weapons by type and show the palette. */
  open(player: Entity): void {
    const wm = player.get(WeaponManager);
    this.syms = ROWS.map((r) => ({ type: r.type, list: wm.weaponsOfType(r.type) }));
    if (this.syms.every((r) => r.list.length === 0)) return; // nothing to choose
    this.displaying = true;
    this.idle = DISPLAY_FRAMES;
  }

  close(): void { this.displaying = false; }

  /** advance one tick: a click selects the icon under the cursor (commandIssued); else idle-timeout. */
  tick(input: Input, player: Entity): void {
    if (!this.displaying) return;
    this.layout(player);
    const c = input.cursor();
    const overIcon = c ? this.rects.find((r) => c.x >= r.x && c.x <= r.x + ICON_W && c.y >= r.y && c.y <= r.y + ICON_H) : undefined;
    if (overIcon) this.idle = DISPLAY_FRAMES; // hovering keeps it open (pTimer reset on activity)
    if (input.mousePressed()) {
      if (overIcon) player.get(WeaponManager).setCurrentWeapon(overIcon.sym); // commandIssued -> setCurrentWeapon
      this.displaying = false; // offScreen: a click closes the palette either way
      return;
    }
    if (--this.idle <= 0) this.displaying = false;
  }

  private layout(player: Entity): void {
    const m = player.get(Movement);
    this.rects = [];
    for (const row of this.syms) {
      if (row.list.length === 0) continue;
      const off = ROWS.find((r) => r.type === row.type)!.offsetY;
      const total = row.list.length * (ICON_W + GAP) - GAP;
      let x = Math.round(m.x - total / 2);
      const y = Math.round(m.y + off - ICON_H);
      for (const sym of row.list) { this.rects.push({ sym, x, y }); x += ICON_W + GAP; }
    }
  }

  render(renderer: Renderer, player: Entity, assets: Assets): void {
    if (!this.displaying) return;
    this.layout(player);
    const cur = player.get(WeaponManager).current;
    const ctx = renderer.ctx;
    for (const r of this.rects) {
      const box = assets.weaponIcon(r.sym === cur ? "yellowBox" : "greenBox");
      if (box) ctx.drawImage(box, r.x, r.y);
      const icon = assets.weaponIcon(r.sym);
      if (icon) ctx.drawImage(icon, r.x, r.y);
      else { // no bundled icon: a labelled placeholder so the slot is still selectable
        ctx.fillStyle = r.sym === cur ? "#fc4" : "#3c9";
        ctx.fillRect(r.x, r.y, ICON_W, ICON_H);
        ctx.fillStyle = "#012"; ctx.textAlign = "center";
        // SS-1: 3-char weapon abbreviation via the #small bitmap face (centred), system-font fallback.
        drawText(ctx, assets, "small", r.sym.replace(/^#/, "").slice(0, 3), r.x + ICON_W / 2, r.y + ICON_H / 2 + 3, { align: "center", fallbackFont: "7px monospace" });
        ctx.textAlign = "left";
      }
    }
  }

  /** test seam: the laid-out icon hit rects for the current player. */
  hitRects(player: Entity): { sym: string; x: number; y: number; w: number; h: number }[] {
    this.layout(player);
    return this.rects.map((r) => ({ sym: r.sym, x: r.x, y: r.y, w: ICON_W, h: ICON_H }));
  }
}
