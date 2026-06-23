// Regression: re-entering a cleared ("beaten") room restored each dead actor with its Anim still at the
// default "stand" pose; the grave action only applied on the first update(), so the unit rendered ONE
// frame as a live stand sprite before snapping to its grave — "units spawn as not graves, then instantly
// switch". respawnActor now primes the Anim from the restored state (syncAnimAfterRestore) so the very
// first rendered frame is the grave.
import { describe, it, expect, beforeEach } from "vitest";
import { RoomManager } from "@/world/rooms";
import type { GameMap, Room, Layer, Vec2i } from "@/world/map";
import type { TileKey } from "@/data/tlk";
import { spawnPlayer, spawnEnemy, spawnUnit, spawnAlly } from "@/entities/archetypes";
import { Energy } from "@/components/combat";
import { Anim } from "@/components/anim";
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

const objectsKey: TileKey = { tileSize: { w: TILE, h: TILE }, symbols: ["#player", "#blackOrc"] };
const activeKey: TileKey = { tileSize: { w: TILE, h: TILE }, symbols: ["#solid"] };

function grid(rows: number, cols: number, fill: [number, number, number][] = []): number[][] {
  const g = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
  for (const [r, c, n] of fill) g[r]![c] = n;
  return g;
}
function mkRoom(num: number, objects: number[][]): Room {
  const layers: Layer[] = [
    { name: "#backgroundActive", tileSet: "#a", grid: grid(objects.length, objects[0]!.length) },
    { name: "#objects", tileSet: "#o", grid: objects },
  ];
  return { num, layers, layer(n) { return this.layers.find((l) => l.name === n); } };
}
function mkMap(): GameMap {
  const rows = 6, cols = 6;
  const room1 = mkRoom(1, grid(rows, cols, [[3, 3, 1], [2, 2, 2]]));
  const room2 = mkRoom(2, grid(rows, cols, [[3, 3, 1], [2, 2, 2]]));
  const rooms = new Map<number, Room>([[1, room1], [2, room2]]);
  return {
    mapSize: { x: 1, y: 2 }, roomSize: { x: cols, y: rows }, tilePx: TILE,
    startRoom: { x: 1, y: 1 }, endRoom: undefined,
    layerDefs: [{ name: "#backgroundActive", tileSet: "#a" }, { name: "#objects", tileSet: "#o" }],
    rooms,
    roomAt(loc) { if (loc.x < 1 || loc.x > 1 || loc.y < 1 || loc.y > 2) return undefined; return rooms.get((loc.y - 1) + loc.x); },
  };
}
const viewW = 6 * TILE, viewH = 6 * TILE;

describe("room re-entry: restored dead actors render as graves on the first frame", () => {
  beforeEach(setupWorld);

  it("a restored dead enemy is in the grave anim immediately (no live-stand flicker)", () => {
    const map = mkMap();
    const player = spawnPlayer(0, 0); game.player = player;
    game.entities = [player];
    const rm = new RoomManager(map, game.assets, activeKey, objectsKey, viewW, viewH, player, () => {});
    rm.enter({ x: 1, y: 1 });
    for (const e of game.entities) if (e.type === "enemy") e.get(Energy).dead = true; // clear room 1
    rm.update();
    rm.enter({ x: 1, y: 2 });   // leave -> room 1 frozen with its dead orc
    rm.enter({ x: 1, y: 1 });   // RE-ENTER the cleared room
    const restored = game.entities.filter((e) => e.type === "enemy");
    expect(restored.length).toBeGreaterThan(0);
    for (const e of restored) {
      expect(e.send("isDead")).toBe(true);
      // BEFORE any update() runs (i.e. the first render frame): the grave pose, not "stand".
      expect((e.get(Anim) as any).action).toBe("grave");
    }
  });
});
