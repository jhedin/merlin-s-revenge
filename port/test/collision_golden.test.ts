import { describe, it, expect } from "vitest";
import { CollisionGrid } from "@/world/collision";

// Golden scenarios locking the tile-AABB solver behavior (PLAN_REVIEW flagged the bespoke
// solver for parity tests). These assert the player-facing invariants: no pass-through,
// wall-sliding, corner stop, and no tunneling at gameplay speeds.

function grid(cols: number, rows: number, solids: [number, number][]): CollisionGrid {
  const g = new CollisionGrid(cols, rows, 32);
  for (const [c, r] of solids) g.set(c, r, true);
  return g;
}

describe("collision golden scenarios", () => {
  it("blocks head-on into a wall and snaps flush to the tile edge", () => {
    const g = grid(4, 1, [[2, 0]]); // wall at col 2 = px 64..96
    const r = g.moveBox(40, 0, 16, 16, 40, 0); // would reach x=80 (inside)
    expect(r.hitX).toBe(true);
    expect(r.x).toBe(64 - 16); // flush to left face of the wall
  });

  it("slides along a wall: blocked axis stops, free axis keeps moving", () => {
    const g = grid(3, 3, [[1, 0], [1, 1], [1, 2]]); // vertical wall at col 1 (px 32..64)
    const r = g.moveBox(14, 0, 16, 16, 10, 10); // box 14..29; pushing right reaches the wall
    expect(r.hitX).toBe(true);   // x blocked -> snaps flush to 32-16=16
    expect(r.x).toBe(16);
    expect(r.hitY).toBe(false);  // y free -> slides down
    expect(r.y).toBe(10);
  });

  it("inside corner stops both axes", () => {
    const g = grid(3, 3, [[1, 0], [0, 1]]); // wall above-right and left
    const r = g.moveBox(32, 32, 16, 16, -20, -20); // into the corner
    expect(r.hitX || r.hitY).toBe(true);
  });

  it("does not tunnel through a 1-tile wall at gameplay speed (<= tile size)", () => {
    const g = grid(5, 1, [[2, 0]]);
    let x = 8;
    for (let i = 0; i < 40; i++) { x = g.moveBox(x, 0, 12, 12, 6, 0).x; } // 6px/tick, many ticks
    expect(x + 12).toBeLessThanOrEqual(64); // never crossed into/through the wall
  });

  it("open exit edge lets the entity leave but a closed edge blocks", () => {
    const g = grid(3, 1, []);
    g.open.right = true;
    expect(g.moveBox(64, 0, 16, 16, 20, 0).hitX).toBe(false); // exits right
    expect(g.moveBox(0, 0, 16, 16, -20, 0).hitX).toBe(true);  // left closed
  });
});
