// A summon must never land OUT OF BOUNDS: an out-of-bounds enemy stays alive-but-unreachable so the room
// never clears (you get locked in), and an out-of-bounds ally/wizard appears off in a "random" spot. All
// summon sites (spell summonUnit, depositMines, player wizard/army at the cursor) clamp to the play area.
import { describe, it, expect, beforeEach } from "vitest";
import { clampToPlayArea } from "@/components/summon";
import { CollisionGrid } from "@/world/collision";
import { game } from "@/game/context";

describe("clampToPlayArea: summons stay inside the walkable area", () => {
  beforeEach(() => { game.grid = new CollisionGrid(10, 10, 32); }); // 320×320 room, 2-tile (64px) border

  it("pulls a point past the top-left back to the border inset", () => {
    expect(clampToPlayArea(-100, -250)).toEqual({ x: 64, y: 64 });
  });
  it("pulls a point past the bottom-right back to the border inset", () => {
    expect(clampToPlayArea(9999, 9999)).toEqual({ x: 320 - 64, y: 320 - 64 });
  });
  it("leaves an in-bounds point unchanged", () => {
    expect(clampToPlayArea(160, 200)).toEqual({ x: 160, y: 200 });
  });
});
