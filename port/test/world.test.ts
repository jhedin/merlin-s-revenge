import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMap } from "@/world/map";
import { parseTileKey, tileSymbol } from "@/data/tlk";
import { CollisionGrid } from "@/world/collision";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("world: real map parse (maps/works/teamtest.txt)", () => {
  const map = parseMap(read("maps/works/teamtest.txt"));
  it("reads per-map sizes and layer defs", () => {
    expect(map.roomSize).toEqual({ x: 18, y: 9 });
    expect(map.mapSize).toEqual({ x: 1, y: 1 });
    expect(map.layerDefs.map((d) => d.name)).toEqual(["#backgroundPassive", "#backgroundActive", "#objects"]);
    expect(map.layerDefs[0]!.tileSet).toBe("#merlin4Passive");
  });
  it("room 1 has 3 layers with 9x18 grids", () => {
    const room = map.roomAt({ x: 1, y: 1 })!;
    expect(room.num).toBe(1);
    const passive = room.layer("#backgroundPassive")!;
    expect(passive.grid.length).toBe(9);        // rows
    expect(passive.grid[0]!.length).toBe(18);   // cols
  });
});

describe("world: real tile key parse (tlk_merlin4Active_key)", () => {
  const key = parseTileKey(read("casts/data/tlk_merlin4Active_key.txt"));
  it("reads tileSize and 1-based symbols, skipping comments", () => {
    expect(key.tileSize).toEqual({ w: 32, h: 32 });
    expect(key.symbols.length).toBeGreaterThan(0);
    expect(tileSymbol(key, 0)).toBe("#none"); // tile 0 always empty
    // every symbol is a #symbol (no comment leakage)
    expect(key.symbols.every((s) => s.startsWith("#"))).toBe(true);
  });
});

describe("world: collision grid + AABB resolve", () => {
  it("blocks movement into solid tiles and snaps to the edge", () => {
    const g = new CollisionGrid(4, 1, 32);
    g.set(2, 0, true); // solid tile at col 2 (px 64..96)
    // a 16px box at x=40 moving +30 would reach 70 (inside solid 64) -> snap to 64-16=48
    const r = g.moveBox(40, 0, 16, 16, 30, 0);
    expect(r.hitX).toBe(true);
    expect(r.x).toBe(48);
  });
  it("out-of-bounds is solid (border)", () => {
    const g = new CollisionGrid(4, 1, 32);
    expect(g.solidCell(-1, 0)).toBe(true);
    expect(g.solidCell(4, 0)).toBe(true);
    expect(g.solidCell(0, 0)).toBe(false);
  });
  it("open edges are passable so the player can exit to an adjacent room", () => {
    const g = new CollisionGrid(4, 1, 32);
    g.open.right = true;
    expect(g.solidCell(4, 0)).toBe(false); // open right edge -> passable
    expect(g.solidCell(-1, 0)).toBe(true); // left still closed
    // a box at the right edge moving further right is no longer blocked
    const r = g.moveBox(96, 0, 16, 16, 30, 0);
    expect(r.hitX).toBe(false);
    expect(r.x).toBe(126);
  });
});
