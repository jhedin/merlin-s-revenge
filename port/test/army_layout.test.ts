// showArmyMaster.setupDisplay's dynamic reflow (armyLayout.ts): units wrap by REAL size, not a uniform
// grid; rows grow to their tallest unit; a row/page can overflow mid-row for a tall unit.
import { describe, it, expect } from "vitest";
import { layoutArmy, type ArmyUnit, type UnitSize } from "@/scenes/armyLayout";

const unit = (typ: string, level = 0): ArmyUnit => ({ typ, team: "#aldevar", level });
// fixed-size stub: every unit is 20x20 with no stars (isolates the wrap/page arithmetic).
const fixedSize = (w = 20, h = 20): ((u: ArmyUnit) => UnitSize) => () => ({ unitW: w, unitH: h, starsW: 0, starsH: 0 });

describe("layoutArmy: row wrap by real width", () => {
  it("packs units left-to-right on one row while they fit", () => {
    const units = [unit("a"), unit("b"), unit("c")];
    // each cell is 20 wide + 4 gap = 24; rect 100 wide fits all 3 (72) on one row.
    const pages = layoutArmy(units, { left: 0, top: 0, right: 100, bottom: 200 }, fixedSize(20, 20));
    expect(pages.length).toBe(1);
    expect(pages[0]!.map((p) => p.x)).toEqual([0, 24, 48]);
    expect(pages[0]!.every((p) => p.y === 0)).toBe(true); // all on row 1
  });

  it("wraps to a new row when a unit doesn't fit the remaining width", () => {
    const units = [unit("a"), unit("b"), unit("c")];
    // rect 44 wide: unit 1 at x=0..20, unit 2 would be x=24..44 (fits exactly), unit 3 wraps.
    const pages = layoutArmy(units, { left: 0, top: 0, right: 44, bottom: 200 }, fixedSize(20, 20));
    expect(pages.length).toBe(1);
    const ys = pages[0]!.map((p) => p.y);
    expect(ys[0]).toBe(0); expect(ys[1]).toBe(0);
    expect(ys[2]).toBeGreaterThan(0); // wrapped down
    expect(pages[0]![2]!.x).toBe(0); // back to the left edge
  });

  it("a new row starts below the PREVIOUS row's tallest unit (accumulated floor) + the row gap", () => {
    const sizes: Record<string, UnitSize> = {
      tall: { unitW: 20, unitH: 50, starsW: 0, starsH: 0 },
      short: { unitW: 20, unitH: 10, starsW: 0, starsH: 0 },
    };
    const sizeOf = (u: ArmyUnit) => sizes[u.typ]!;
    // row 1: "tall" (h=50) then a narrow rect forces "short" onto row 2.
    const units = [unit("tall"), unit("short")];
    const pages = layoutArmy(units, { left: 0, top: 0, right: 20, bottom: 200 }, sizeOf);
    expect(pages.length).toBe(1);
    // tall's bound height = (0+4 stars gap) + (50+4 unit gap) = 58; row 2 starts at 58 + 8 (ROW_GAP) = 66.
    expect(pages[0]![1]!.y).toBe(66);
  });
});

describe("layoutArmy: cell size follows REAL sprite + stars dimensions (not a fixed grid)", () => {
  it("a bigger unit gets a bigger cell width than a smaller one", () => {
    const sizes: Record<string, UnitSize> = {
      big: { unitW: 64, unitH: 64, starsW: 0, starsH: 0 },
      small: { unitW: 16, unitH: 16, starsW: 0, starsH: 0 },
    };
    const pages = layoutArmy([unit("big"), unit("small")], { left: 0, top: 0, right: 200, bottom: 200 }, (u) => sizes[u.typ]!);
    expect(pages[0]![0]!.w).toBe(64);
    expect(pages[0]![1]!.w).toBe(16);
    expect(pages[0]![1]!.x).toBe(64 + 4); // positioned right after the big unit's real width + gap
  });

  it("the bounding width is the max of the stars width and the unit width", () => {
    const sizeOf = () => ({ unitW: 16, unitH: 16, starsW: 40, starsH: 8 } as UnitSize); // wide star row
    const pages = layoutArmy([unit("a"), unit("b")], { left: 0, top: 0, right: 200, bottom: 200 }, sizeOf);
    expect(pages[0]![0]!.w).toBe(40); // stars are wider than the unit sprite
    expect(pages[0]![1]!.x).toBe(40 + 4);
  });
});

describe("layoutArmy: page overflow", () => {
  it("starts a new page when the row floor exceeds the display rect's bottom", () => {
    const units = [unit("a"), unit("b"), unit("c")];
    // each row is exactly 1 unit tall (rect too narrow for 2 side by side); bottom=30 fits only 1 row.
    const pages = layoutArmy(units, { left: 0, top: 0, right: 20, bottom: 30 }, fixedSize(20, 20));
    // unit height bound = (0+4)+(20+4) = 28; row1 floor=28 (fits, <=30); row2 would start at 28+8=36 > 30 -> new page.
    expect(pages.length).toBeGreaterThan(1);
    expect(pages[0]!.length).toBe(1);
  });

  it("a single very tall unit can trigger a page break on its own (mid-row overflow)", () => {
    const sizes: Record<string, UnitSize> = {
      normal: { unitW: 20, unitH: 20, starsW: 0, starsH: 0 },
      giant: { unitW: 20, unitH: 500, starsW: 0, starsH: 0 },
    };
    const pages = layoutArmy([unit("normal"), unit("giant")], { left: 0, top: 0, right: 200, bottom: 100 }, (u) => sizes[u.typ]!);
    // "normal" fits row 1 fine; "giant" alone overflows page 1's bottom -> pushed to page 2.
    expect(pages.length).toBe(2);
    expect(pages[0]!.map((p) => p.unit.typ)).toEqual(["normal"]);
    expect(pages[1]!.map((p) => p.unit.typ)).toEqual(["giant"]);
  });

  it("empty input yields a single empty page (never zero pages)", () => {
    const pages = layoutArmy([], { left: 0, top: 0, right: 100, bottom: 100 }, fixedSize());
    expect(pages.length).toBe(1);
    expect(pages[0]!.length).toBe(0);
  });
});
