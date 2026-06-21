// K22 exit-arrow range logic (objRoom.drawExitArrows → modScreenExits.convertExitTilesToRangesEdge /
// convertExitRangesToArrowRectsEdge). Tests the RANGE computation (not pixels): which edges carry an arrow,
// where along the edge the passable run falls, and the green/red colour from the room's cleared/open state.
import { describe, it, expect, beforeEach } from "vitest";
import { RoomManager, type ExitArrowRect } from "@/world/rooms";
import type { GameMap, Room, Layer, Vec2i } from "@/world/map";
import type { TileKey } from "@/data/tlk";
import { spawnPlayer, spawnEnemy, spawnUnit, spawnAlly } from "@/entities/archetypes";
import { Energy } from "@/components/combat";
import { game } from "@/game/context";
import { CollisionGrid } from "@/world/collision";

const TILE = 32;
function setupWorld() {
  game.grid = new CollisionGrid(20, 20, TILE);
  game.entities = [];
  game.assets = { index: { anims: {}, tilesets: {} }, images: new Map(), ensureChar: () => {}, img: () => null } as any;
  game.spawnEnemy = spawnEnemy; game.spawnUnit = spawnUnit; game.spawnAlly = spawnAlly;
  game.teamMaster.reset(); game.armyMaster.reset(); game.potionMaster.reset();
  game.teamMaster.unitMap.configure(TILE, 0, 0);
}

// active key: tile 1 = #solid (a wall). objects key: tile 1 = #player, tile 2 = #blackOrc (a live enemy).
const activeKey: TileKey = { tileSize: { w: TILE, h: TILE }, symbols: ["#solid"] };
const objectsKey: TileKey = { tileSize: { w: TILE, h: TILE }, symbols: ["#player", "#blackOrc"] };

function emptyGrid(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
}

// build a room with an explicit #backgroundActive wall layer (1 = solid) and a #player marker at centre.
// when `enemy` is true, also drop a #blackOrc so the room is NOT auto-cleared on entry.
function mkRoom(num: number, rows: number, cols: number, active: number[][], enemy = false): Room {
  const objects = emptyGrid(rows, cols);
  objects[Math.floor(rows / 2)]![Math.floor(cols / 2)] = 1; // #player marker so the room populates
  if (enemy) objects[1]![1] = 2;                             // a live orc keeps the room uncleared
  const layers: Layer[] = [
    { name: "#backgroundActive", tileSet: "#a", grid: active },
    { name: "#objects", tileSet: "#o", grid: objects },
  ];
  return { num, layers, layer(n) { return this.layers.find((l) => l.name === n); } };
}

// a horizontal 3-room strip at y=1: room1 (1,1), room2 (2,1), room3 (3,1). `actives` keyed by room num.
// `enemyRooms` lists room nums that should spawn a live orc (so they don't auto-clear on entry).
function mkStrip(rows: number, cols: number, actives: Record<number, number[][]>, enemyRooms: number[] = []): GameMap {
  const rooms = new Map<number, Room>();
  for (let x = 1; x <= 3; x++) rooms.set(x, mkRoom(x, rows, cols, actives[x] ?? emptyGrid(rows, cols), enemyRooms.includes(x)));
  return {
    mapSize: { x: 3, y: 1 }, roomSize: { x: cols, y: rows }, tilePx: TILE,
    startRoom: { x: 2, y: 1 }, endRoom: undefined,
    layerDefs: [{ name: "#backgroundActive", tileSet: "#a" }, { name: "#objects", tileSet: "#o" }],
    rooms,
    // strip: room num = x.
    roomAt(loc: Vec2i) { return loc.y === 1 ? rooms.get(loc.x) : undefined; },
  };
}

const ROWS = 5, COLS = 5;
const viewW = COLS * TILE, viewH = ROWS * TILE;

function newRM(map: GameMap) {
  const player = spawnPlayer(0, 0); game.player = player;
  game.entities = [player];
  return new RoomManager(map, game.assets, activeKey, objectsKey, viewW, viewH, player);
}
function clearRoom() { for (const e of game.entities) if (e.type === "enemy") e.get(Energy).dead = true; }
const byEdge = (rects: ExitArrowRect[], edge: string) => rects.filter((r) => r.edge === edge);

describe("K22: exit-arrow ranges", () => {
  beforeEach(setupWorld);

  it("open-box room (no edge walls): one full-edge range on each edge that has an adjacent room", () => {
    // middle room of the strip: neighbours left (room1) and right (room3); none up/down.
    const map = mkStrip(ROWS, COLS, {});
    const rm = newRM(map);
    rm.enter({ x: 2, y: 1 });
    const rects = rm.exitArrowRects();
    // only left + right edges (no room up/down) → exactly 2 arrow rects, one per horizontal neighbour.
    expect(rects.map((r) => r.edge).sort()).toEqual(["left", "right"]);
    expect(byEdge(rects, "up")).toHaveLength(0);
    expect(byEdge(rects, "down")).toHaveLength(0);
    // an open edge spans the whole edge: left edge is one full-height range.
    const left = byEdge(rects, "left")[0]!;
    expect(left.y).toBe(0);
    expect(left.h).toBe(ROWS * TILE); // full edge height
    expect(left.x).toBe(0);           // flush to the left edge
    const right = byEdge(rects, "right")[0]!;
    expect(right.x).toBe(COLS * TILE - 16); // arrow thickness inset from the right
    expect(right.h).toBe(ROWS * TILE);
  });

  it("no adjacent room → no arrow on that edge", () => {
    const map = mkStrip(ROWS, COLS, {});
    const rm = newRM(map);
    rm.enter({ x: 1, y: 1 }); // leftmost room: only a RIGHT neighbour (room2)
    const rects = rm.exitArrowRects();
    expect(rects.map((r) => r.edge)).toEqual(["right"]);
  });

  it("wall with a gap on the left edge → a range only at the passable gap", () => {
    // room2's left column (c=0) is solid EXCEPT rows 1..2 (a 2-tile doorway).
    const active = emptyGrid(ROWS, COLS);
    for (let r = 0; r < ROWS; r++) active[r]![0] = 1; // wall the whole left column
    active[1]![0] = 0; active[2]![0] = 0;             // punch a 2-tile gap at rows 1,2
    const map = mkStrip(ROWS, COLS, { 2: active });
    const rm = newRM(map);
    rm.enter({ x: 2, y: 1 });
    const left = byEdge(rm.exitArrowRects(), "left");
    expect(left).toHaveLength(1);                 // one contiguous passable run
    expect(left[0]!.y).toBe(1 * TILE);            // range starts at the top of row 1
    expect(left[0]!.h).toBe(2 * TILE);            // spans rows 1..2 (two tiles)
  });

  it("two separated gaps on an edge → two ranges", () => {
    const active = emptyGrid(ROWS, COLS);
    for (let r = 0; r < ROWS; r++) active[r]![0] = 1; // solid left column
    active[0]![0] = 0;                                // gap at row 0
    active[3]![0] = 0;                                // gap at row 3 (separated by solid rows 1,2)
    const map = mkStrip(ROWS, COLS, { 2: active });
    const rm = newRM(map);
    rm.enter({ x: 2, y: 1 });
    const left = byEdge(rm.exitArrowRects(), "left");
    expect(left).toHaveLength(2);
    expect(left.map((r) => [r.y, r.h])).toEqual([[0, TILE], [3 * TILE, TILE]]);
  });

  it("a fully-walled edge with an adjacent room → no arrow (no passable tiles)", () => {
    const active = emptyGrid(ROWS, COLS);
    for (let r = 0; r < ROWS; r++) active[r]![0] = 1; // solid left column, no gap
    const map = mkStrip(ROWS, COLS, { 2: active });
    const rm = newRM(map);
    rm.enter({ x: 2, y: 1 });
    expect(byEdge(rm.exitArrowRects(), "left")).toHaveLength(0);
    expect(byEdge(rm.exitArrowRects(), "right")).toHaveLength(1); // right edge is open
  });

  it("colour is RED while the room is uncleared, GREEN once cleared (open[edge])", () => {
    // room2 spawns a live orc → it does NOT auto-clear on entry → exits closed.
    const map = mkStrip(ROWS, COLS, {}, [2]);
    const rm = newRM(map);
    rm.enter({ x: 2, y: 1 });
    expect(rm.exitsOpen).toBe(false);
    const red = rm.exitArrowRects();
    expect(red.length).toBeGreaterThan(0);
    expect(red.every((r) => r.colour === "red")).toBe(true);
    // clear the room → exits open → arrows GREEN.
    clearRoom();
    rm.update();
    expect(rm.exitsOpen).toBe(true);
    const green = rm.exitArrowRects();
    expect(green.length).toBeGreaterThan(0);
    expect(green.every((r) => r.colour === "green")).toBe(true);
  });

  it("top/bottom edges: range runs along the horizontal axis, thickness on the vertical", () => {
    // a vertical 1×3 strip so the middle room has up + down neighbours.
    const rooms = new Map<number, Room>();
    for (let y = 1; y <= 3; y++) rooms.set(y, mkRoom(y, ROWS, COLS, emptyGrid(ROWS, COLS)));
    const map: GameMap = {
      mapSize: { x: 1, y: 3 }, roomSize: { x: COLS, y: ROWS }, tilePx: TILE,
      startRoom: { x: 1, y: 2 }, endRoom: undefined,
      layerDefs: [{ name: "#backgroundActive", tileSet: "#a" }, { name: "#objects", tileSet: "#o" }],
      rooms, roomAt(loc: Vec2i) { return loc.x === 1 ? rooms.get(loc.y) : undefined; },
    };
    const rm = newRM(map);
    rm.enter({ x: 1, y: 2 });
    const rects = rm.exitArrowRects();
    expect(rects.map((r) => r.edge).sort()).toEqual(["down", "up"]);
    const up = byEdge(rects, "up")[0]!;
    expect(up.x).toBe(0); expect(up.w).toBe(COLS * TILE); // full-width run
    expect(up.y).toBe(0); expect(up.h).toBe(16);          // thickness on top
    const down = byEdge(rects, "down")[0]!;
    expect(down.y).toBe(ROWS * TILE - 16);                // thickness flush to the bottom
    expect(down.w).toBe(COLS * TILE);
  });
});
