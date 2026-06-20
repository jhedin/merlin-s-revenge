import { describe, it, expect } from "vitest";
import { CollisionGrid } from "@/world/collision";
import type { TileKey } from "@/data/tlk";
import type { Layer } from "@/world/map";
import { game } from "@/game/context";
import { Archetype, Component, type NextFn } from "@/engine/dispatch";
import { Movement } from "@/components/movement";

// F2: per-edge collision tile types (objCollisionTile). These exercise the TYPED path (a non-#solid
// tile is present) — built via the real fromActiveLayer (so merge + corner detection run). None of the
// 47 shipped maps ship non-solid types (all #solid/#none), so these are the parity locks for the
// breadth the editor can author. The solid-only golden (collision_golden.test.ts) is unchanged.

// a tile key whose tile numbers map to specific collision types (1-based).
const KEY: TileKey = {
  tileSize: { w: 32, h: 32 },
  // tile 1=#solid, 2=#platform, 3=#ceiling, 4=#wallLeft, 5=#wallRight, 6=#none
  symbols: ["#solid", "#platform", "#ceiling", "#wallLeft", "#wallRight", "#none"],
};
const N = { solid: 1, platform: 2, ceiling: 3, wallLeft: 4, wallRight: 5, none: 6 } as const;

function gridFrom(rows: number[][]): CollisionGrid {
  const layer: Layer = { name: "#backgroundActive", tileSet: "#x", grid: rows };
  return CollisionGrid.fromActiveLayer(layer, KEY, 32);
}

describe("F2 collision tile types — per-edge one-way", () => {
  it("#platform: a downward mover lands flush on the top edge", () => {
    // platform at row 2 (px 64..96 top edge = y 64). box 16, starting at y=40, moving down 40 -> 80.
    const g = gridFrom([[N.none, N.none], [N.none, N.none], [N.platform, N.platform]]);
    const r = g.moveBox(0, 40, 16, 16, 0, 40, 40);
    expect(r.hitY).toBe(true);
    expect(r.y).toBe(64 - 16 - 1); // flush to the top edge (with the -1,-1 push-out fudge)
    expect(r.events.platform).toBe(true);
  });

  it("#platform: does NOT block a mover passing upward through it", () => {
    const g = gridFrom([[N.none, N.none], [N.none, N.none], [N.platform, N.platform]]);
    // box sitting inside the platform row moving up: top edge faces downward movers only.
    const r = g.moveBox(0, 70, 16, 16, 0, -40, 70);
    expect(r.hitY).toBe(false);
    expect(r.y).toBe(30);
  });

  it("#platform: does NOT block sideways motion", () => {
    const g = gridFrom([[N.platform, N.platform, N.platform]]);
    const r = g.moveBox(0, 0, 16, 16, 40, 0, 0);
    expect(r.hitX).toBe(false);
    expect(r.x).toBe(40);
  });

  it("#platform: a mover already below does not snap up (was-above gate)", () => {
    // box already overlapping the platform from below last frame -> top edge does not catch it.
    const g = gridFrom([[N.none], [N.platform]]);
    // platform top edge at y=32. box starts with its top BELOW the edge (oldTop=40), moving down.
    const r = g.moveBox(0, 40, 16, 16, 0, 5, 40);
    expect(r.hitY).toBe(false);
    expect(r.events.platform).toBeFalsy();
    expect(r.events.noPlatform).toBe(true); // moved down, never landed
  });

  it("#ceiling: blocks an upward mover at the bottom edge, passes a downward mover", () => {
    // ceiling at row 0 (bottom edge y=32). rows below are open (none) so a downward mover has room.
    const g = gridFrom([[N.ceiling, N.ceiling], [N.none, N.none], [N.none, N.none], [N.none, N.none]]);
    const up = g.moveBox(0, 40, 16, 16, 0, -20, 40);
    expect(up.hitY).toBe(true);
    expect(up.y).toBe(32); // flush below the ceiling's bottom edge
    expect(up.events.ceiling).toBe(true);
    // a downward mover is unaffected by a ceiling tile (stays in open rows 1..3)
    const down = g.moveBox(0, 40, 16, 16, 0, 20, 40);
    expect(down.hitY).toBe(false);
    expect(down.y).toBe(60);
  });

  it("#wallLeft: blocks rightward-into-left-face only, passes leftward", () => {
    // wallLeft at col 2 (left face px 64). box approaching from the left moving right.
    const g = gridFrom([[N.none, N.none, N.wallLeft, N.none]]);
    const right = g.moveBox(40, 0, 16, 16, 40, 0, 0);
    expect(right.hitX).toBe(true);
    expect(right.x).toBe(64 - 16 - 1); // flush to the left face (push-out fudge)
    expect(right.events.wallRight).toBe(true);
    // approaching from the right moving left is NOT blocked (only the left edge is solid)
    const left = g.moveBox(80, 0, 16, 16, -30, 0, 0);
    expect(left.hitX).toBe(false);
  });

  it("#wallRight: blocks leftward-into-right-face only, passes rightward", () => {
    // wallRight at col 1 (right face px 64). box approaching from the right moving left.
    const g = gridFrom([[N.none, N.wallRight, N.none, N.none]]);
    const left = g.moveBox(80, 0, 16, 16, -30, 0, 0);
    expect(left.hitX).toBe(true);
    expect(left.x).toBe(64); // flush to the right face
    expect(left.events.wallLeft).toBe(true);
    const right = g.moveBox(30, 0, 16, 16, 20, 0, 0);
    expect(right.hitX).toBe(false);
  });
});

describe("F2 collision tile types — merge + corner", () => {
  it("merge: a solid's interior face toward an adjacent solid is merged away (typed path)", () => {
    // Force the typed per-edge path by including a non-solid tile (#wallRight, col 3). Solids at cols
    // 1,2 row 0: their shared interior face (col1.right / col2.left) is merged to non-solid so a mover
    // hitting the block from the left stops at the OUTER left face of col 1, never the merged seam.
    const g = gridFrom([[N.none, N.solid, N.solid, N.wallRight]]);
    const r = g.moveBox(8, 0, 16, 16, 40, 0, 0);
    expect(r.hitX).toBe(true);
    expect(r.x).toBe(32 - 16 - 1); // flush to col 1's outer left face (with the push-out fudge)
    // and crucially: a mover starting between the seam does not get ejected by the merged interior face.
    // place a box straddling the col1/col2 boundary moving down (no vertical edges to catch it).
    const seam = g.moveBox(56, 4, 16, 8, 0, 0, 4); // sitting on the seam, no motion
    expect(seam.x).toBe(56);
  });

  it("corner: a small box cannot squeeze diagonally between two solids meeting at a corner (typed path)", () => {
    // Force the typed path with a #wallRight somewhere harmless. Solid block: (2,2) with solids above
    // (2,1) and left (1,2). (2,2)'s top & left edges merge away, but its top-LEFT corner stays solid
    // (top-neighbour's left edge + left-neighbour's top edge both solid, facing the empty (1,1) gap). A
    // small box in that gap moving down-right is stopped from squeezing through (identifyAsCornerTile).
    const g = gridFrom([
      [N.none, N.none, N.none, N.wallRight],
      [N.none, N.none, N.solid, N.none],
      [N.none, N.solid, N.solid, N.none],
      [N.none, N.none, N.none, N.none],
    ]);
    // box in the (1,1) gap (px 32..64) approaching (2,2)'s top-left corner (px 64,64) diagonally.
    const r = g.moveBox(54, 54, 8, 8, 8, 8, 54);
    expect(r.hitX || r.hitY).toBe(true);
  });
});

describe("F2 directional events", () => {
  it("walking down onto a platform fires platform (not noPlatform)", () => {
    const g = gridFrom([[N.none], [N.none], [N.platform]]);
    const r = g.moveBox(0, 40, 16, 16, 0, 40, 40);
    expect(r.events.platform).toBe(true);
    expect(r.events.noPlatform).toBeFalsy();
  });
  it("moving down over empty space fires noPlatform", () => {
    const g = gridFrom([[N.none], [N.platform]]); // typed grid, but moving in open space above
    const r = g.moveBox(0, 0, 8, 8, 0, 4, 0);
    expect(r.events.noPlatform).toBe(true);
    expect(r.events.platform).toBeFalsy();
  });
  it("solid-only grid never fires platform/noPlatform (only wall/ceiling)", () => {
    const g = new CollisionGrid(4, 1, 32);
    g.set(2, 0, true);
    const r = g.moveBox(40, 0, 16, 16, 40, 0); // into a solid wall moving right
    expect(r.events.wallRight).toBe(true);
    expect(r.events.platform).toBeFalsy();
    expect(r.events.noPlatform).toBeFalsy();
  });
});

// A probe component that records the directional collision messages Movement dispatches.
class CollisionProbe extends Component {
  static handles = ["collisionWallLeft", "collisionWallRight", "collisionCeiling", "collisionPlatform", "collisionNoPlatform"];
  events: string[] = [];
  collisionWallLeft(_n: NextFn): void { this.events.push("wallLeft"); }
  collisionWallRight(_n: NextFn): void { this.events.push("wallRight"); }
  collisionCeiling(_n: NextFn): void { this.events.push("ceiling"); }
  collisionPlatform(_n: NextFn): void { this.events.push("platform"); }
  collisionNoPlatform(_n: NextFn): void { this.events.push("noPlatform"); }
}
const ProbeArchetype = new Archetype("probe", [Movement, CollisionProbe]);

describe("F2 Movement dispatches directional events", () => {
  it("walking right into a wallLeft tile dispatches collisionWallRight on the entity", () => {
    game.grid = gridFrom([[N.none, N.none, N.wallLeft, N.none]]);
    const e = ProbeArchetype.create(1).build({ x: 56, y: 16, box: 12 }); // box right edge ~62, near col2 (px64)
    const m = e.get(Movement); m.intentX = 1; // walk right toward the wall's left face
    for (let i = 0; i < 10; i++) { m.intentX = 1; e.send("update"); } // accelerate into the wall
    expect(e.get(CollisionProbe).events).toContain("wallRight");
  });
});

describe("F2 load-any-map structural", () => {
  it("builds an EdgeGrid from a mixed-type layer without throwing", () => {
    const g = gridFrom([
      [N.solid, N.platform, N.ceiling],
      [N.wallLeft, N.none, N.wallRight],
      [N.solid, N.solid, N.solid],
    ]);
    // a no-op move returns cleanly
    const r = g.moveBox(40, 40, 8, 8, 0, 0);
    expect(r.x).toBe(40);
    expect(r.events).toBeDefined();
  });
});
