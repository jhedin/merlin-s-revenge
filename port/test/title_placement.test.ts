// Placement parity (AUDIT-CHARTER §6): the titleScreen is the Director Score frame-30 composition
// recovered by extracted/tools/dump_score.py → emitted into assets.json as `title`. Assert the logo
// letter glyphs land at their recovered stage coordinates (so "MERLIN'S" / "REVENGE" spell out and
// tile without overlap), not "looks right". Source of truth: title-screen-composition.md.
import { describe, it, expect } from "vitest";
import assets from "@/generated/assets.json";

type T = { file: string; w: number; h: number; locH: number; locV: number; reg: [number, number]; ink: number; name: string };
const title = (assets as unknown as { title?: T[] }).title ?? [];
const byName = (n: string) => title.filter((t) => t.name === n);

describe("titleScreen composition (Director Score frame 30)", () => {
  it("bundles the recovered composite (logo glyphs + backdrop tiles + decorative sprites)", () => {
    expect(title.length).toBe(26);
    // every sprite references a copied PNG and carries a stage position + reg point
    for (const t of title) {
      expect(t.file).toMatch(/\.png$/);
      expect(t.reg).toHaveLength(2);
    }
  });

  it('row 1 spells "MERLIN\'S": glyphs in left→right x order at the y=9 baseline', () => {
    // member glyphs (M E R L I N ' S); the apostrophe member is named `kL`.
    const seq = ["M", "E", "R", "L", "I", "N", "kL", "S"];
    const xs = [10, 104, 174, 254, 319, 351, 435, 467];
    seq.forEach((nm, i) => {
      const g = byName(nm).find((t) => t.locV === 9);
      expect(g, `${nm} at row1`).toBeTruthy();
      expect(g!.locH).toBe(xs[i]);
    });
  });

  it('row 2 spells "REVENGE" at the y=90 baseline', () => {
    const seq = ["R", "E", "V", "E", "N", "G", "E"];
    const xs = [98, 179, 246, 333, 403, 488, 563];
    const row2 = title.filter((t) => t.locV === 90).sort((a, b) => a.locH - b.locH);
    expect(row2.map((t) => t.name)).toEqual(seq);
    expect(row2.map((t) => t.locH)).toEqual(xs);
  });

  it("row-1 glyphs tile left→right without overlap (each starts past the previous glyph's right edge)", () => {
    const row1 = title.filter((t) => t.locV === 9).sort((a, b) => a.locH - b.locH);
    for (let i = 1; i < row1.length; i++) {
      const prev = row1[i - 1]!, cur = row1[i]!;
      expect(cur.locH).toBeGreaterThanOrEqual(prev.locH + prev.w - 4); // glyphs abut (small kern slack)
    }
  });

  it("the two backdrop tiles stretch (sprite rect ≠ bitmap size) and the glyphs render native", () => {
    const M = byName("M")[0]!;
    expect(M.w).toBe(91); // native glyph rect
    const bg = byName("background")[0]!;
    expect(bg.w).toBe(84); // 64×10 bar-tile stretched up to the sprite rect
    expect(bg.h).toBe(72);
  });
});
