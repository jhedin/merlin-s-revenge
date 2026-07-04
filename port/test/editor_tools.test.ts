import { describe, it, expect } from "vitest";
import { floodRegion, rectRegion } from "../src/editor/tools";

const sortCells = (cs: [number, number][]) => [...cs].sort((a, b) => a[0] - b[0] || a[1] - b[1]);

describe("floodRegion", () => {
  it("fills a contiguous same-value region (4-connected)", () => {
    const grid = [
      [1, 1, 2],
      [1, 2, 2],
      [3, 2, 2],
    ];
    // flood from (0,0): the connected 1s = (0,0),(0,1),(1,0)
    expect(sortCells(floodRegion(grid, 0, 0))).toEqual([[0, 0], [0, 1], [1, 0]]);
  });

  it("does not cross to diagonally-touching same values", () => {
    const grid = [
      [5, 0],
      [0, 5],
    ];
    expect(floodRegion(grid, 0, 0)).toEqual([[0, 0]]); // the other 5 is only diagonal
  });

  it("fills the whole region of 2s", () => {
    const grid = [
      [1, 1, 2],
      [1, 2, 2],
      [3, 2, 2],
    ];
    expect(floodRegion(grid, 1, 1).length).toBe(5); // five connected 2s
  });

  it("out-of-bounds start returns nothing", () => {
    expect(floodRegion([[1]], 5, 5)).toEqual([]);
  });
});

describe("rectRegion", () => {
  it("inclusive rectangle, order-independent corners", () => {
    expect(sortCells(rectRegion(2, 3, 1, 2))).toEqual([[1, 2], [1, 3], [2, 2], [2, 3]]);
  });
  it("single cell", () => {
    expect(rectRegion(4, 4, 4, 4)).toEqual([[4, 4]]);
  });
});
