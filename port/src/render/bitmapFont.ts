// SS-1 bitmap-font blitter (objFont / objTileSet.getString). The original renders ALL on-screen text
// by blitting per-glyph cells out of a fnt_<name> sheet — fixed-cell, gap 0, monospaced-by-cell, no
// kerning. A char's cell INDEX = StringGetPos(theKey, char) (left-to-right along the sheet); cell i is
// the window [i*cellW, 0, cellW, cellH]. The sheet is a white-on-matte (numbers/small/menu) or grey-on-
// dark (smallgrey) mask, keyed to transparency at load (assets.keyOutMatte) — so the glyph pixels survive
// as opaque-on-transparent and can be TINTED to any colour (the original's setSpriteColor), cached per
// (face, colour). Missing glyphs (▶ ✦ ♥ ↑ ↓ ← → and digits in alpha faces) are advance-and-skip.

import type { Drawable } from "./assets";

export type TextAlign = "left" | "center" | "right";
export interface DrawOpts { scale?: number; colour?: string; align?: TextAlign }

export class BitmapFont {
  /** cell advance = cell width + inter-letter gap (0 for all four shipped fonts). */
  readonly charW: number;
  // per-colour tinted copies of the whole sheet (source-in on the keyed mask), keyed by colour string.
  private tintCache = new Map<string, Drawable>();
  private static readonly TINT_CACHE_MAX = 24;

  constructor(
    private sheet: Drawable,
    public readonly cellW: number,
    public readonly cellH: number,
    private gap: number,
    private key: string,
    private matte: "white" | "dark",
  ) {
    this.charW = cellW + gap;
  }

  /** cell index of a glyph in the key (-1 if absent → caller advances + skips). */
  index(ch: string): number { return this.key.indexOf(ch); }

  /** does the key contain EVERY char of `s` (space excluded)? lets a caller pick this face only when it
   *  can render the whole string, else fall back. */
  canRender(s: string): boolean {
    for (const ch of s) { if (ch === " ") continue; if (this.key.indexOf(ch) < 0) return false; }
    return true;
  }

  /** laid-out pixel width of `s` at scale 1 (fixed cell, no kerning). Replaces ctx.measureText. */
  measure(s: string, scale = 1): number { return s.length * this.charW * scale; }

  /** A colour-tinted copy of the (already-keyed) sheet, cached by colour. The keyed sheet is an
   *  opaque glyph on transparency; `source-in` paints the requested colour through the glyph's alpha,
   *  preserving the mask shape — exactly the original's white-mask + setSpriteColor model. White-matte
   *  faces tint freely; the dark-matte (smallgrey) face also tints fine since it's keyed to an alpha mask. */
  private tinted(colour: string): Drawable {
    const cached = this.tintCache.get(colour);
    if (cached) return cached;
    const w = this.sheet.width, h = this.sheet.height;
    const out = document.createElement("canvas");
    out.width = w; out.height = h;
    const c = out.getContext("2d")!;
    c.drawImage(this.sheet, 0, 0);
    c.globalCompositeOperation = "source-in";
    c.fillStyle = colour;
    c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = "source-over";
    if (this.tintCache.size >= BitmapFont.TINT_CACHE_MAX) {
      const first = this.tintCache.keys().next().value;
      if (first !== undefined) this.tintCache.delete(first);
    }
    this.tintCache.set(colour, out);
    return out;
  }

  /** draw `s` with its top-left at (x,y). Returns the advance width drawn (after alignment offset). */
  draw(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, opts: DrawOpts = {}): number {
    const sc = opts.scale ?? 1;
    const align = opts.align ?? "left";
    const sheet = opts.colour ? this.tinted(opts.colour) : this.sheet;
    let cx = x;
    if (align === "center") cx = x - this.measure(s, sc) / 2;
    else if (align === "right") cx = x - this.measure(s, sc);
    const adv = this.charW * sc;
    for (const ch of s) {
      if (ch === " ") { cx += adv; continue; }
      const i = this.index(ch);
      if (i < 0) { cx += adv; continue; } // absent glyph: advance, draw nothing
      ctx.drawImage(sheet, i * this.cellW, 0, this.cellW, this.cellH,
        Math.round(cx), Math.round(y), this.cellW * sc, this.cellH * sc);
      cx += adv;
    }
    return cx - (align === "left" ? x : (align === "center" ? x - this.measure(s, sc) / 2 : x - this.measure(s, sc)));
  }
}
