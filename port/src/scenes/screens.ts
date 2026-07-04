// Screen content (K18): the already-wired overlay/screen syms get real renderers + input. Each mirrors a
// master_object:
//   credits      (creditsMaster):   a scroll-to-end credits text block; re-routes complete -> credits -> title.
//   showArmy     (showArmyMaster):  the G2 army reserve paginated into a unit-stand-frame grid; nextPage/
//                                   prevPage with the isMenuItemShadowed page guards; back -> ingame menu.
//   instructions:                   a static how-to-play overlay; back -> menu.
//   keyConfig    (keyChooseMaster): choose among the shipped input schemes via the control->key table
//                                   (keyForControl); the active scheme is persisted (Input.setScheme).
//
// profileMaster is a DEV profiler (not a player screen) — out of scope (plan §g)

import type { Renderer } from "../render/renderer";
import type { Input } from "../systems/input";
import type { Assets } from "../render/assets";
import type { SchemeName } from "../systems/input";
import { game } from "../game/context";
import { drawText, measureText } from "../render/text";
import { drawScrollBox } from "../render/menuBackground";
import { starRow } from "../render/rollover";
import { layoutArmy, type ArmyUnit, type PlacedUnit } from "./armyLayout";

// The control rows shown in key-config (keyChooseMaster.pKeyDescriptions): control name -> description.
const KEY_DESCRIPTIONS: { control: string; desc: string }[] = [
  { control: "up", desc: "Move Up" },
  { control: "down", desc: "Move Down" },
  { control: "left", desc: "Move Left" },
  { control: "right", desc: "Move Right" },
  { control: "wizard", desc: "Summon a Wizard" },
  { control: "wizardSelector", desc: "Select Wizard" },
  { control: "weaponSelector", desc: "Select Weapon" },
  { control: "gmg", desc: "Golden Machine Gun On/Off" },
  { control: "army", desc: "Summon a Battalion" },
  { control: "fire", desc: "Attack / Cast" },
];
const SCHEMES: SchemeName[] = ["both", "arrows", "wasd", "zqsd"];
const SCHEME_LABEL: Record<SchemeName, string> = {
  both: "WASD + Arrows", arrows: "Arrow Keys", wasd: "WASD", zqsd: "ZQSD",
};

const INSTRUCTIONS = [
  "MERLIN'S REVENGE",
  "",
  "Move with WASD or the arrow keys.",
  "Hold the mouse / space to charge magic; release to cast.",
  "Punching is automatic when an enemy is in reach.",
  "1-6 pick a spell; Q selects your weapon.",
  "F summons a found wizard (R or Tab cycles); C summons a battalion.",
  "E toggles the Golden Machine Gun.",
  "Clear every room (or reach the end room) to win.",
  "Walk onto a glowing stone to hear its tale.",
  "",
  "F5 / F9 save & load   Esc pause   M mute",
];

// The original credits text — verbatim from the txt_credits cast member in merlin_engine_76_speed.dir
// (creditsMaster), with a "Porting Support" line added for the web port. Drawn as a vertically-scrolling
// block (objTransTextScroll). "always pick the original": this replaced the port's own blurb.
const CREDITS = [
  "Merlin's Revenge 4",
  "",
  "Credits",
  "",
  "Programming, GFX, SFX, Design",
  "Steve Riddett",
  "",
  "Porting Support",
  "Claude & Gemini",
  "",
  "Graphics",
  "Sketch",
  "",
  "Music",
  "Micheal Sartin-Tarm (evilishies)",
  "Noam Bergman",
  "",
  "Bug Manager",
  "Carefree_Butterfly",
  "",
  "Suggestion Geniuses",
  "Eric9000",
  "midget mage",
  "",
  "Bugtester Heroes",
  "...to come...",
  "",
  "Who Suggested What",
  "",
  "credit improvement",
  "Suggested by midget mage",
  "",
  "Skeleton Archer",
  "Suggested by Eric9000",
  "",
  "Thanks Everybody!",
  "",
  "And Thanks to all The Metal Box's dedicated fans",
  "and to everybody who made suggestions!",
  "",
  "It wouldn't have been possible without you.",
];

export class Screens {
  // showArmy paging
  private armyPage = 0;
  // credits scroll (objTransTextScroll speed 1: scroll up to the text height, then end)
  private creditsScroll = 0;
  private creditsDone = false;
  // keyConfig selection cursor
  private keyIndex = 0;

  constructor(private assets: Assets, private viewW: number, private viewH: number) {}

  /** reset per-open state when an overlay is (re)opened. */
  open(overlay: string): void {
    if (overlay === "showArmy") this.armyPage = 0;
    if (overlay === "instructions") { /* static */ }
    if (overlay === "keyConfig") this.keyIndex = SCHEMES.indexOf(game.input.schemeName);
  }
  openCredits(): void { this.creditsScroll = 0; this.creditsDone = false; }

  // ── credits (creditsMaster): auto-scroll the block up at speed 1 to its full height, then signal end.
  tickCredits(): boolean {
    if (this.creditsDone) return true;
    this.creditsScroll += 1; // objTransTextScroll speed 1
    const lineH = 16;
    const total = CREDITS.length * lineH + this.viewH; // scroll until the last line has passed the top
    if (this.creditsScroll >= total) { this.creditsDone = true; return true; }
    return false;
  }
  renderCredits(renderer: Renderer): void {
    const ctx = renderer.ctx;
    // original creditsMaster: bold white text on a BLACK stage, scrolling upward.
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, this.viewW, this.viewH);
    ctx.textAlign = "center";
    const lineH = 16;
    let y = this.viewH - this.creditsScroll;
    CREDITS.forEach((line, i) => {
      const yy = y + i * lineH;
      if (yy < -lineH || yy > this.viewH + lineH) return;
      ctx.fillStyle = "#fff";
      ctx.font = i === 0 ? "bold 16px serif" : "bold 11px serif";
      ctx.fillText(line, this.viewW / 2, yy);
    });
    ctx.textAlign = "left";
  }

  // ── overlay input/render (showArmy / instructions / keyConfig). Returns true to CLOSE the overlay.
  handleInput(overlay: string, input: Input): boolean {
    switch (overlay) {
      case "showArmy": {
        const pages = this.layoutArmyPages().length;
        if (input.pressed("arrowright") || input.pressed("d")) { if (this.armyPage < pages - 1) this.armyPage++; }
        if (input.pressed("arrowleft") || input.pressed("a")) { if (this.armyPage > 0) this.armyPage--; }
        if (input.pressed("escape") || input.pressed(" ") || input.pressed("enter")) return true;
        return false;
      }
      case "instructions":
        return input.pressed("escape") || input.pressed(" ") || input.pressed("enter");
      case "keyConfig": {
        if (input.pressed("arrowup") || input.pressed("w")) this.keyIndex = (this.keyIndex + SCHEMES.length - 1) % SCHEMES.length;
        if (input.pressed("arrowdown") || input.pressed("s")) this.keyIndex = (this.keyIndex + 1) % SCHEMES.length;
        if (input.pressed(" ") || input.pressed("enter")) { game.input.setScheme(SCHEMES[this.keyIndex]!); return true; } // #ok: setKeySet
        if (input.pressed("escape")) return true; // #cancel
        return false;
      }
    }
    return false;
  }

  render(renderer: Renderer, overlay: string): void {
    switch (overlay) {
      case "showArmy": this.renderShowArmy(renderer); break;
      case "instructions": this.renderInstructions(renderer); break;
      case "keyConfig": this.renderKeyConfig(renderer); break;
    }
  }

  // ── showArmy (showArmyMaster.setupDisplay): a DYNAMIC reflow of the reserve army — each unit's cell is
  // sized from its real stand-sprite + level-stars dimensions (objUnitDisplayer.calcBoundingRect), wrapped
  // into rows/pages by armyLayout.layoutArmy. Order is the reserve's own banking order (armyMaster's own
  // dict-of-append-only-lists — getReserveArmy does NOT sort).
  private reserve() { return game.armyMaster.getReserveArmy(game.teamMaster ? "#aldevar" : "#aldevar"); }
  private readonly displayBox = { x: 35, y: 48, rightMargin: 20, bottomMargin: 30 }; // within the 310×240 scroll box

  /** real per-unit cell size for the layout: stand-sprite dims + level-stars dims (0×0 when unloaded). */
  private unitSizeOf = (u: ArmyUnit): { unitW: number; unitH: number; starsW: number; starsH: number } => {
    const idx = this.assets.index.anims;
    const frame = (idx[`${u.typ}_stand`] ?? idx[`blackOrc_stand`])?.frames[0];
    const loaded = frame && this.assets.images.has(frame.file);
    const unitW = loaded ? frame!.w : 16, unitH = loaded ? frame!.h : 16; // 16×16 fallback box pre-load
    if (frame && !loaded) void this.assets.ensureChar(u.typ); // kick off the load for next frame
    const stars = starRow(u.level).map((n) => this.assets.member(n)).filter((m): m is NonNullable<typeof m> => !!m);
    const starsW = stars.reduce((s, m) => s + m.w, 0), starsH = stars.reduce((h, m) => Math.max(h, m.h), 0);
    return { unitW, unitH, starsW, starsH };
  };

  private layoutArmyPages(): PlacedUnit[][] {
    const b = this.displayBox;
    // box coords are only known at render time (centred on the view), but the box is fixed-size (310×240)
    // and centred, so its origin is derivable without re-drawing: box.x = viewW/2 - 155, box.y = viewH/2 - 120.
    const boxX = this.viewW / 2 - 155, boxY = this.viewH / 2 - 120;
    const rect = { left: boxX + b.x, top: boxY + b.y, right: boxX + 310 - b.rightMargin, bottom: boxY + 240 - b.bottomMargin };
    return layoutArmy(this.reserve(), rect, this.unitSizeOf);
  }

  private renderShowArmy(renderer: Renderer): void {
    const ctx = renderer.ctx;
    ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(0, 0, this.viewW, this.viewH);
    ctx.textAlign = "center";

    // Draw the authentic 310x240 scroll box
    const box = drawScrollBox(renderer, this.assets, this.viewW / 2, this.viewH / 2, 310, 240, true);

    ctx.fillStyle = "#000";
    drawText(ctx, this.assets, "menu", "RESERVE ARMY", this.viewW / 2, box.y + 16, { top: true, align: "center", fallbackFont: "bold 14px serif" });

    const army = this.reserve();
    const pages = this.layoutArmyPages();
    if (this.armyPage >= pages.length) this.armyPage = pages.length - 1;
    if (army.length === 0) {
      ctx.fillStyle = "#555";
      drawText(ctx, this.assets, "small", "(no units banked — summon and re-field allies)", this.viewW / 2, this.viewH / 2, { align: "center", fallbackFont: "11px monospace" });
    } else {
      ctx.textAlign = "center";
      for (const p of pages[this.armyPage] ?? []) {
        const cx = p.x + p.w / 2;
        this.drawUnitCell(ctx, p);
        ctx.fillStyle = "#000";
        drawText(ctx, this.assets, "small", "L" + p.unit.level, cx, p.y + p.h - 2, { align: "center", fallbackFont: "8px monospace" });
      }
    }

    ctx.fillStyle = "#555";
    drawText(ctx, this.assets, "small", `page ${this.armyPage + 1}/${pages.length}   <-/-> page   esc/space: back`, this.viewW / 2, box.y + box.h - 14, { align: "center", fallbackFont: "9px monospace" });
    ctx.textAlign = "left";
  }

  // draw a placed unit cell: level stars ABOVE (objMoveableLevelBar-style row, real star images when
  // loaded), the unit's stand frame BELOW that (objUnitDisplayer.displayUnit's stacking), both centred
  // within the cell's real bounding width.
  private drawUnitCell(ctx: CanvasRenderingContext2D, p: PlacedUnit): void {
    const cx = p.x + p.w / 2;
    const stars = starRow(p.unit.level).map((n) => this.assets.member(n)).filter((m): m is NonNullable<typeof m> => !!m);
    if (stars.length) {
      const starsW = stars.reduce((s, m) => s + m.w, 0);
      let sx = Math.round(cx - starsW / 2);
      for (const m of stars) { ctx.drawImage(m.img, sx, p.y); sx += m.w; }
    }
    const idx = this.assets.index.anims;
    const anim = idx[`${p.unit.typ}_stand`] ?? idx[`blackOrc_stand`];
    const frame = anim?.frames[0];
    const unitTop = p.y + p.starsH + 4; // objUnitDisplayer: stars height + STARS_GAP(4), then the sprite
    if (frame && this.assets.images.has(frame.file)) {
      const img = this.assets.img(frame.file) as CanvasImageSource;
      const w = (img as HTMLImageElement).width;
      ctx.drawImage(img, Math.round(cx - w / 2), unitTop);
    } else {
      if (frame) void this.assets.ensureChar(p.unit.typ); // kick off the load; draw a placeholder this frame
      ctx.fillStyle = "#46c"; ctx.fillRect(cx - 8, unitTop, 16, 18);
    }
  }

  private renderInstructions(renderer: Renderer): void {
    const ctx = renderer.ctx;
    ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(0, 0, this.viewW, this.viewH);
    ctx.textAlign = "center";

    let maxW = 0;
    for (const line of INSTRUCTIONS) {
      const w = measureText(ctx, this.assets, "small", line);
      if (w > maxW) maxW = w;
    }
    const boxW = Math.max(280, Math.ceil((maxW + 48) / 16) * 16);
    const boxH = Math.ceil((48 + INSTRUCTIONS.length * 14) / 16) * 16;

    const box = drawScrollBox(renderer, this.assets, this.viewW / 2, this.viewH / 2 - 8, boxW, boxH, true);

    INSTRUCTIONS.forEach((line, i) => {
      ctx.fillStyle = i === 0 ? "#000" : "#000";
      if (i === 0) {
        drawText(ctx, this.assets, "menu", line, this.viewW / 2, box.y + 16, { top: true, align: "center", fallbackFont: "bold 15px serif" });
      } else {
        drawText(ctx, this.assets, "small", line, this.viewW / 2, box.y + 40 + (i - 1) * 14, { top: true, align: "center", fallbackFont: "11px monospace" });
      }
    });

    ctx.fillStyle = "#555";
    drawText(ctx, this.assets, "small", "esc/space: back", this.viewW / 2, box.y + box.h - 14, { align: "center", fallbackFont: "9px monospace" });
    ctx.textAlign = "left";
  }

  private renderKeyConfig(renderer: Renderer): void {
    const ctx = renderer.ctx;
    const input = game.input;
    ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(0, 0, this.viewW, this.viewH);
    ctx.textAlign = "center";

    let maxW = measureText(ctx, this.assets, "small", "The Current Keys are:");
    SCHEMES.forEach((sc) => {
      const w = measureText(ctx, this.assets, "small", "▶ " + SCHEME_LABEL[sc] + "  (active)");
      if (w > maxW) maxW = w;
    });
    KEY_DESCRIPTIONS.forEach((row) => {
      const key = input.keyForControlInScheme(row.control, SCHEMES[this.keyIndex]!).toUpperCase();
      const w = measureText(ctx, this.assets, "small", key.padEnd(6) + " - " + row.desc);
      if (w > maxW) maxW = w;
    });
    const boxW = Math.max(260, Math.ceil((maxW + 48) / 16) * 16);
    const boxH = Math.ceil((48 + SCHEMES.length * 16 + 24 + KEY_DESCRIPTIONS.length * 14 + 16) / 16) * 16;

    const box = drawScrollBox(renderer, this.assets, this.viewW / 2, this.viewH / 2, boxW, boxH, true);

    ctx.fillStyle = "#000";
    drawText(ctx, this.assets, "menu", "CHOOSE KEYS", this.viewW / 2, box.y + 16, { top: true, align: "center", fallbackFont: "bold 14px serif" });

    // the scheme chooser (pKeyMenu): pick the active key-set.
    SCHEMES.forEach((sc, i) => {
      const sel = i === this.keyIndex;
      const active = sc === input.schemeName;
      ctx.fillStyle = sel ? "#c00" : active ? "#009" : "#000"; // Red selected, Blue active, Black normal
      drawText(ctx, this.assets, "small", (sel ? "▶ " : "  ") + SCHEME_LABEL[sc] + (active ? "  (active)" : ""), this.viewW / 2, box.y + 44 + i * 16, { top: true, align: "center", fallbackFont: "11px monospace" });
    });

    const preview = SCHEMES[this.keyIndex]!;
    const tableY = box.y + 44 + SCHEMES.length * 16 + 12;
    ctx.fillStyle = "#000";
    drawText(ctx, this.assets, "small", "The Current Keys are:", this.viewW / 2, tableY, { top: true, align: "center", fallbackFont: "10px monospace" });

    KEY_DESCRIPTIONS.forEach((row, i) => {
      const key = input.keyForControlInScheme(row.control, preview).toUpperCase();
      ctx.fillStyle = "#333";
      drawText(ctx, this.assets, "small", key.padEnd(6) + " - " + row.desc, this.viewW / 2, tableY + 16 + i * 14, { top: true, align: "center", fallbackFont: "10px monospace" });
    });

    ctx.fillStyle = "#555";
    drawText(ctx, this.assets, "small", "↑/↓ choose   space: OK   esc: cancel", this.viewW / 2, box.y + box.h - 14, { align: "center", fallbackFont: "9px monospace" });
    ctx.textAlign = "left";
  }
}
