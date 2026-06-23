// SS-1 regression: the `small` font sheet (05299_fnt_smallCC) has a LEADING BLANK cell 0, so glyph
// key-index k lives at sheet-cell k+1. Without the per-face cellOffset the blitter drew cell k, so every
// UI letter rendered the PREVIOUS glyph ('A' blank, 'B'→A, …) — all on-screen sprite text was wrong.
import { describe, it, expect } from "vitest";
import { BitmapFont } from "@/render/bitmapFont";

const sheet = { width: 600, height: 12 } as any;
function capture() {
  const sx: number[] = [];
  const ctx = { drawImage: (_img: unknown, x: number) => { sx.push(x); } } as any;
  return { sx, ctx };
}

describe("BitmapFont cellOffset", () => {
  it("cellOffset 0: glyph key-index k blits from cell k (menu/numbers/smallgrey)", () => {
    const f = new BitmapFont(sheet, 8, 10, 0, "ABC", "white", 0);
    const a = capture(); f.draw(a.ctx, "A", 0, 0); expect(a.sx[0]).toBe(0);   // 'A' index 0 -> 0
    const b = capture(); f.draw(b.ctx, "B", 0, 0); expect(b.sx[0]).toBe(8);   // 'B' index 1 -> 8
  });

  it("cellOffset 1: glyph key-index k blits from cell k+1, skipping the blank cell 0 (small)", () => {
    const f = new BitmapFont(sheet, 8, 10, 0, "ABC", "white", 1);
    const a = capture(); f.draw(a.ctx, "A", 0, 0); expect(a.sx[0]).toBe(8);   // 'A' index 0 -> (0+1)*8
    const c = capture(); f.draw(c.ctx, "C", 0, 0); expect(c.sx[0]).toBe(24);  // 'C' index 2 -> (2+1)*8
  });
});
