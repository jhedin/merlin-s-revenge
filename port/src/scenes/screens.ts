// Screen content (K18): the already-wired overlay/screen syms get real renderers + input. Each mirrors a
// master_object:
//   credits      (creditsMaster):   a scroll-to-end credits text block; re-routes complete -> credits -> title.
//   showArmy     (showArmyMaster):  the G2 army reserve paginated into a unit-stand-frame grid; nextPage/
//                                   prevPage with the isMenuItemShadowed page guards; back -> ingame menu.
//   instructions:                   a static how-to-play overlay; back -> menu.
//   keyConfig    (keyChooseMaster): choose among the shipped input schemes via the control->key table
//                                   (keyForControl); the active scheme is persisted (Input.setScheme).
//
// profileMaster is a DEV profiler (not a player screen) — out of scope (plan §g).

import type { Renderer } from "../render/renderer";
import type { Input } from "../systems/input";
import type { Assets } from "../render/assets";
import type { SchemeName } from "../systems/input";
import { game } from "../game/context";

// The control rows shown in key-config (keyChooseMaster.pKeyDescriptions): control name -> description.
const KEY_DESCRIPTIONS: { control: string; desc: string }[] = [
  { control: "up", desc: "Move Up" },
  { control: "down", desc: "Move Down" },
  { control: "left", desc: "Move Left" },
  { control: "right", desc: "Move Right" },
  { control: "fire", desc: "Attack / Cast" },
  { control: "wizard", desc: "Summon Wizard" },
  { control: "wizardSelector", desc: "Select Wizard" },
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
  "1-9 pick a spell; E opens the weapon palette.",
  "Q summons a found wizard ally (Tab cycles); C summons your army.",
  "Clear every room (or reach the end room) to win.",
  "Walk onto a glowing stone to hear its tale.",
  "",
  "F5 / F9 save & load   Esc pause   M mute",
];

// the shipped credits text (creditsMaster falls back to the local txt_credits member; the net path is
// out of scope, plan §g). The exact roster is the best-available content (residual content gap, not flow).
const CREDITS = [
  "MERLIN'S REVENGE",
  "",
  "A faithful TypeScript / HTML5 port",
  "of the Director / Lingo original.",
  "",
  "Original game by the Merlin's Revenge team.",
  "",
  "Engine, combat, AI, economy,",
  "world, render, scenes & audio",
  "reimplemented on the component-dispatch kernel.",
  "",
  "Thanks for playing!",
  "",
  "",
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
    ctx.fillStyle = "#0a1020"; ctx.fillRect(0, 0, this.viewW, this.viewH);
    ctx.textAlign = "center";
    const lineH = 16;
    let y = this.viewH - this.creditsScroll;
    CREDITS.forEach((line, i) => {
      const yy = y + i * lineH;
      if (yy < -lineH || yy > this.viewH + lineH) return;
      ctx.fillStyle = i === 0 ? "#fc4" : "#9cf";
      ctx.font = i === 0 ? "bold 18px serif" : "11px serif";
      ctx.fillText(line, this.viewW / 2, yy);
    });
    ctx.textAlign = "left";
  }

  // ── overlay input/render (showArmy / instructions / keyConfig). Returns true to CLOSE the overlay.
  handleInput(overlay: string, input: Input): boolean {
    switch (overlay) {
      case "showArmy": {
        const pages = this.armyPages();
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

  // ── showArmy: a paginated grid of the reserve army, each unit drawn as its stand frame + level.
  private reserve() { return game.armyMaster.getReserveArmy(game.teamMaster ? "#aldevar" : "#aldevar"); }
  private readonly cell = 40; // per-unit cell (stand frame + level label)
  private cols(): number { return Math.max(1, Math.floor((this.viewW - 24) / this.cell)); }
  private rowsPerPage(): number { return Math.max(1, Math.floor((this.viewH - 80) / this.cell)); }
  private perPage(): number { return this.cols() * this.rowsPerPage(); }
  private armyPages(): number { return Math.max(1, Math.ceil(this.reserve().length / this.perPage())); }

  private renderShowArmy(renderer: Renderer): void {
    const ctx = renderer.ctx;
    ctx.fillStyle = "rgba(6,12,24,0.92)"; ctx.fillRect(0, 0, this.viewW, this.viewH);
    ctx.textAlign = "center";
    ctx.fillStyle = "#fc4"; ctx.font = "bold 14px serif";
    ctx.fillText("RESERVE ARMY", this.viewW / 2, 22);
    const army = this.reserve();
    const pages = this.armyPages();
    if (this.armyPage >= pages) this.armyPage = pages - 1;
    if (army.length === 0) {
      ctx.fillStyle = "#9ab"; ctx.font = "11px monospace";
      ctx.fillText("(no units banked — summon and re-field allies to build a reserve)", this.viewW / 2, this.viewH / 2);
    } else {
      const start = this.armyPage * this.perPage();
      const slice = army.slice(start, start + this.perPage());
      const cols = this.cols();
      const x0 = 12, y0 = 40;
      ctx.textAlign = "center";
      slice.forEach((u, i) => {
        const cx = x0 + (i % cols) * this.cell + this.cell / 2;
        const cy = y0 + Math.floor(i / cols) * this.cell + this.cell / 2;
        this.drawUnitFrame(ctx, u.typ, cx, cy);
        ctx.fillStyle = "#cde"; ctx.font = "8px monospace";
        ctx.fillText("L" + u.level, cx, cy + this.cell / 2 - 2);
      });
    }
    ctx.fillStyle = "#9ab"; ctx.font = "9px monospace"; ctx.textAlign = "center";
    ctx.fillText(`page ${this.armyPage + 1}/${pages}   ←/→ page   esc/space: back`, this.viewW / 2, this.viewH - 10);
    ctx.textAlign = "left";
  }

  // draw a unit's stand frame (objUnitDisplayer art: the actor's #stand frame) centered at (cx,cy).
  private drawUnitFrame(ctx: CanvasRenderingContext2D, typ: string, cx: number, cy: number): void {
    const idx = this.assets.index.anims;
    const anim = idx[`${typ}_stand`] ?? idx[`blackOrc_stand`];
    const frame = anim?.frames[0];
    if (frame && this.assets.images.has(frame.file)) {
      const img = this.assets.img(frame.file) as CanvasImageSource;
      const w = (img as HTMLImageElement).width, h = (img as HTMLImageElement).height;
      ctx.drawImage(img, Math.round(cx - w / 2), Math.round(cy - h / 2 - 4));
    } else {
      if (frame) void this.assets.ensureChar(typ); // kick off the load; draw a placeholder this frame
      ctx.fillStyle = "#46c"; ctx.fillRect(cx - 8, cy - 12, 16, 18);
    }
  }

  private renderInstructions(renderer: Renderer): void {
    const ctx = renderer.ctx;
    ctx.fillStyle = "rgba(6,12,24,0.92)"; ctx.fillRect(0, 0, this.viewW, this.viewH);
    ctx.textAlign = "center";
    INSTRUCTIONS.forEach((line, i) => {
      ctx.fillStyle = i === 0 ? "#fc4" : "#cde";
      ctx.font = i === 0 ? "bold 15px serif" : "11px monospace";
      ctx.fillText(line, this.viewW / 2, 40 + i * 18);
    });
    ctx.fillStyle = "#9ab"; ctx.font = "9px monospace";
    ctx.fillText("esc/space: back", this.viewW / 2, this.viewH - 10);
    ctx.textAlign = "left";
  }

  private renderKeyConfig(renderer: Renderer): void {
    const ctx = renderer.ctx;
    const input = game.input;
    ctx.fillStyle = "rgba(6,12,24,0.94)"; ctx.fillRect(0, 0, this.viewW, this.viewH);
    ctx.textAlign = "center";
    ctx.fillStyle = "#fc4"; ctx.font = "bold 14px serif";
    ctx.fillText("CHOOSE KEYS", this.viewW / 2, 22);
    // the scheme chooser (pKeyMenu): pick the active key-set.
    ctx.font = "11px monospace";
    SCHEMES.forEach((sc, i) => {
      const sel = i === this.keyIndex;
      const active = sc === input.schemeName;
      ctx.fillStyle = sel ? "#fff" : active ? "#9cf" : "#89a";
      ctx.fillText((sel ? "▶ " : "  ") + SCHEME_LABEL[sc] + (active ? "  (active)" : ""), this.viewW / 2, 44 + i * 16);
    });
    // the control->key table for the HIGHLIGHTED scheme (keyChooseMaster.displayCurrentKeySet) — previewed
    // WITHOUT mutating the live scheme (only #ok commits via setScheme on space).
    const preview = SCHEMES[this.keyIndex]!;
    const tableY = 44 + SCHEMES.length * 16 + 12;
    ctx.font = "10px monospace";
    ctx.fillStyle = "#cde";
    ctx.fillText("The Current Keys are:", this.viewW / 2, tableY);
    KEY_DESCRIPTIONS.forEach((row, i) => {
      const key = input.keyForControlInScheme(row.control, preview).toUpperCase();
      ctx.fillStyle = "#bcd";
      ctx.fillText(key.padEnd(6) + " - " + row.desc, this.viewW / 2, tableY + 16 + i * 14);
    });
    ctx.fillStyle = "#9ab"; ctx.font = "9px monospace";
    ctx.fillText("↑/↓ choose   space: OK   esc: cancel", this.viewW / 2, this.viewH - 10);
    ctx.textAlign = "left";
  }
}
