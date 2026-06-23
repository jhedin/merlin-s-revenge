// SS-1 text routing: the single helper every scene/HUD draw site calls instead of ctx.fillText. It
// pulls the requested bitmap face from Assets, splits the string into runs so digit runs route through
// the #numbers face (the alpha faces — menu/small/smallgrey — carry NO digits), draws each run with the
// blitter, and GRACEFULLY FALLS BACK to ctx.fillText when the face/sheet isn't loaded (so text never
// disappears if the font art is missing — e.g. in unit tests with a stubbed Assets).

import type { Assets, Drawable } from "./assets";
import type { BitmapFont, TextAlign } from "./bitmapFont";

export interface TextOpts {
  /** baseline-ish y handling: the bitmap blitter draws from the TOP-LEFT, but ctx.fillText draws from
   *  the baseline. Sites pass their existing fillText y; we lift the glyph up by ~cellH so the bitmap
   *  text sits where the old text did. Set `top:true` to treat y as the top edge instead. */
  top?: boolean;
  align?: TextAlign;
  scale?: number;
  colour?: string;            // tint (white-matte faces) — defaults to the live ctx.fillStyle
  /** the system-font fallback string used when no bitmap face is available (defaults to ctx.font). */
  fallbackFont?: string;
}

// route digits (and any glyph the primary face lacks) through #numbers; everything else through `face`.
function pickFaces(assets: Assets, face: string): { primary?: BitmapFont; numbers?: BitmapFont } {
  return { primary: assets.font(face), numbers: assets.font("numbers") };
}

/** measure a string as it WOULD be laid out by drawText (mixed primary/numbers runs), in px. Falls back
 *  to ctx.measureText when no bitmap face is available. */
export function measureText(ctx: CanvasRenderingContext2D, assets: Assets, face: string, s: string, scale = 1): number {
  const { primary, numbers } = pickFaces(assets, face);
  if (!primary && !numbers) return ctx.measureText(s).width;
  let w = 0;
  for (const ch of s) {
    const f = faceFor(ch, primary, numbers);
    w += f ? f.charW * scale : (primary ?? numbers)!.charW * scale;
  }
  return w;
}

function faceFor(ch: string, primary?: BitmapFont, numbers?: BitmapFont): BitmapFont | undefined {
  if (ch >= "0" && ch <= "9") return numbers ?? primary;
  if (primary && primary.index(ch) >= 0) return primary;
  return primary ?? numbers;
}

/** Draw `s` at (x,y) through the bitmap face, with digit runs routed to #numbers and a graceful
 *  ctx.fillText fallback. Returns the laid-out advance width. */
export function drawText(ctx: CanvasRenderingContext2D, assets: Assets, face: string, s: string,
  x: number, y: number, opts: TextOpts = {}): number {
  const { primary, numbers } = pickFaces(assets, face);
  const scale = opts.scale ?? 1;
  // ── fallback: no bitmap art → keep the existing system-font path so nothing vanishes. ──
  if (!primary && !numbers) {
    const prevFont = ctx.font, prevAlign = ctx.textAlign;
    if (opts.fallbackFont) ctx.font = opts.fallbackFont;
    if (opts.colour) ctx.fillStyle = opts.colour;
    ctx.textAlign = opts.align ?? "left";
    ctx.fillText(s, x, y);
    ctx.font = prevFont; ctx.textAlign = prevAlign;
    return ctx.measureText(s).width;
  }
  const cellH = (primary ?? numbers)!.cellH;
  // alignment: compute total width, shift the start x.
  const total = measureText(ctx, assets, face, s, scale);
  let cx = x;
  if (opts.align === "center") cx = x - total / 2;
  else if (opts.align === "right") cx = x - total;
  // y: lift to top-left unless caller already passes a top edge.
  const ty = opts.top ? y : y - cellH * scale;
  // tint: honour the live ctx.fillStyle (the original's setSpriteColor) so each site's colour carries
  // through to the glyph mask. A non-string fillStyle (gradient/pattern) isn't a colour → leave native.
  const colour = opts.colour ?? (typeof ctx.fillStyle === "string" ? ctx.fillStyle : undefined);
  for (const ch of s) {
    const f = faceFor(ch, primary, numbers);
    if (!f) { cx += (primary ?? numbers)!.charW * scale; continue; }
    f.draw(ctx, ch, cx, Math.round(ty), { scale, colour, align: "left" });
    cx += f.charW * scale;
  }
  return total;
}

// re-export the Drawable type users may need (keeps imports local to this module).
export type { Drawable };
