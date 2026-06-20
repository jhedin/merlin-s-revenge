import { describe, it, expect, beforeEach } from "vitest";
import { RoomManager } from "@/world/rooms";
import type { GameMap, Room, Layer, Vec2i } from "@/world/map";
import type { TileKey } from "@/data/tlk";
import { spawnPlayer, spawnEnemy, spawnUnit, spawnAlly } from "@/entities/archetypes";
import { Energy } from "@/components/combat";
import { Movement } from "@/components/movement";
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

// objects key: tile 1 = #player, tile 2 = #blackOrc.
const objectsKey: TileKey = { tileSize: { w: TILE, h: TILE }, symbols: ["#player", "#blackOrc"] };
const activeKey: TileKey = { tileSize: { w: TILE, h: TILE }, symbols: ["#solid"] };

// build a layer grid sized rows x cols (default empty).
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

// a 1-wide, 2-tall map (rooms stacked); room 1 at (1,1), room 2 at (1,2). endRoom configurable.
function mkMap(endRoom?: Vec2i): GameMap {
  const rows = 6, cols = 6;
  const room1 = mkRoom(1, grid(rows, cols, [[3, 3, 1], [2, 2, 2]]));  // #player at (r3,c3), an orc at (r2,c2)
  const room2 = mkRoom(2, grid(rows, cols, [[3, 3, 1], [2, 2, 2]]));  // same shape
  const rooms = new Map<number, Room>([[1, room1], [2, room2]]);
  return {
    mapSize: { x: 1, y: 2 }, roomSize: { x: cols, y: rows }, tilePx: TILE,
    startRoom: { x: 1, y: 1 }, endRoom,
    layerDefs: [{ name: "#backgroundActive", tileSet: "#a" }, { name: "#objects", tileSet: "#o" }],
    rooms,
    roomAt(loc) { const idx = (loc.y - 1) * 1 + loc.x; return rooms.get(idx); },
  };
}

const viewW = 6 * TILE, viewH = 6 * TILE;

describe("H3: endRoom win trigger", () => {
  beforeEach(setupWorld);

  it("with #endRoom set, clearing the START room does NOT win; reaching+clearing the end room DOES", () => {
    let won = 0;
    const map = mkMap({ x: 1, y: 2 }); // end room is room 2
    const player = spawnPlayer(0, 0); game.player = player;
    game.entities = [player];
    const rm = new RoomManager(map, game.assets, activeKey, objectsKey, viewW, viewH, player, () => { won++; });
    rm.enter({ x: 1, y: 1 });
    // kill room 1's orc -> the room clears, but it isn't the end room -> NO win
    for (const e of game.entities) if (e.type === "enemy") e.get(Energy).dead = true;
    rm.update();
    expect(rm.exitsOpen).toBe(true);
    expect(won).toBe(0);
    // move to room 2 (the end room), clear it -> WIN
    rm.enter({ x: 1, y: 2 });
    for (const e of game.entities) if (e.type === "enemy") e.get(Energy).dead = true;
    rm.update();
    expect(won).toBe(1);
  });

  it("with #endRoom #none (undefined), the map wins ONLY on clear-all (default-map regression)", () => {
    let won = 0;
    const map = mkMap(undefined); // no end room
    const player = spawnPlayer(0, 0); game.player = player;
    game.entities = [player];
    const rm = new RoomManager(map, game.assets, activeKey, objectsKey, viewW, viewH, player, () => { won++; });
    rm.enter({ x: 1, y: 1 });
    for (const e of game.entities) if (e.type === "enemy") e.get(Energy).dead = true;
    rm.update();
    expect(won).toBe(0); // room 1 cleared, but not ALL rooms
    rm.enter({ x: 1, y: 2 });
    for (const e of game.entities) if (e.type === "enemy") e.get(Energy).dead = true;
    rm.update();
    expect(won).toBe(1); // now every room cleared -> win
  });
});

describe("H3: per-room pState restore round-trip", () => {
  beforeEach(setupWorld);

  it("damage an enemy, leave, return -> it restores at the SAVED HP (not full, not re-spawned fresh)", () => {
    const map = mkMap(undefined);
    const player = spawnPlayer(0, 0); game.player = player;
    game.entities = [player];
    const rm = new RoomManager(map, game.assets, activeKey, objectsKey, viewW, viewH, player, () => {});
    rm.enter({ x: 1, y: 1 });
    const orc = game.entities.find((e) => e.type === "enemy")!;
    const fullHp = orc.get(Energy).max;
    orc.get(Energy).energy = 7; // wound it (but keep it alive so the room doesn't clear)
    expect(orc.get(Energy).energy).toBeLessThan(fullHp);

    rm.enter({ x: 1, y: 2 }); // leave -> room 1 frozen into pState
    rm.enter({ x: 1, y: 1 }); // return -> restore from pState
    const orc2 = game.entities.find((e) => e.type === "enemy")!;
    expect(orc2.get(Energy).energy).toBe(7);     // saved HP, not full
    expect(orc2.get(Energy).max).toBe(fullHp);
  });

  it("a cleared room restores EMPTY (its dead stay dead) on re-entry", () => {
    const map = mkMap(undefined);
    const player = spawnPlayer(0, 0); game.player = player;
    game.entities = [player];
    const rm = new RoomManager(map, game.assets, activeKey, objectsKey, viewW, viewH, player, () => {});
    rm.enter({ x: 1, y: 1 });
    for (const e of game.entities) if (e.type === "enemy") e.get(Energy).dead = true; // clear room 1
    rm.update();
    rm.enter({ x: 1, y: 2 });
    rm.enter({ x: 1, y: 1 });
    const liveEnemies = game.entities.filter((e) => e.type === "enemy" && !e.send("isDead"));
    expect(liveEnemies.length).toBe(0); // no fresh re-spawn
  });

  it("the full pState map round-trips through save/restore (every visited room)", () => {
    const map = mkMap(undefined);
    const player = spawnPlayer(0, 0); game.player = player;
    game.entities = [player];
    const rm = new RoomManager(map, game.assets, activeKey, objectsKey, viewW, viewH, player, () => {});
    rm.enter({ x: 1, y: 1 });
    game.entities.find((e) => e.type === "enemy")!.get(Energy).energy = 9;
    rm.enter({ x: 1, y: 2 }); // freeze room 1 with the wounded orc
    game.entities.find((e) => e.type === "enemy")!.get(Energy).energy = 4;
    const full = rm.fullPState();
    expect(Object.keys(full).map(Number).sort()).toEqual([1, 2]);
    expect(full[1]![0]!.chain.energy.energy).toBe(9);
    expect(full[2]![0]!.chain.energy.energy).toBe(4); // current room's live actor

    // restore into a fresh manager
    const rm2 = new RoomManager(map, game.assets, activeKey, objectsKey, viewW, viewH, player, () => {});
    rm2.restorePState(full);
    rm2.restoreInto({ x: 1, y: 2 }, full[2]!);
    rm2.enter({ x: 1, y: 1 }); // walk back to room 1 -> restored from the round-tripped pState
    expect(game.entities.find((e) => e.type === "enemy")!.get(Energy).energy).toBe(9);
  });
});
