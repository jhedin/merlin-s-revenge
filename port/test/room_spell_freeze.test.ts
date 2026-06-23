// Regression for the intermittent room-re-entry FREEZE: a live objSpell in flight when you leave a room was
// frozen into the per-room pState snapshot (act_spell ships #recordInRoomState:true), then on re-entry
// respawnActor routed the "spell" key to the #spell PICKUP effect — producing a pickup entity mislabelled
// type "spell" with NO SpellActor, which drawSpells' e.get(SpellActor) threw on every render frame. Spells
// (and other transient/pooled actors) must NEVER enter the snapshot.
import { describe, it, expect, beforeEach } from "vitest";
import { RoomManager } from "@/world/rooms";
import type { GameMap, Room, Layer, Vec2i } from "@/world/map";
import type { TileKey } from "@/data/tlk";
import { spawnPlayer, spawnEnemy, spawnUnit, spawnAlly } from "@/entities/archetypes";
import { spawnSpell } from "@/systems/spells";
import { SpellActor } from "@/components/spellActor";
import { resolveAttack } from "@/components/weapon";
import { registry } from "@/game/data";
import { isRecordableActor } from "@/entities/actorSerial";
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
  const rooms = new Map<number, Room>([[1, mkRoom(1, grid(rows, cols, [[3, 3, 1]]))], [2, mkRoom(2, grid(rows, cols, [[3, 3, 1]]))]]);
  return {
    mapSize: { x: 1, y: 2 }, roomSize: { x: cols, y: rows }, tilePx: TILE,
    startRoom: { x: 1, y: 1 }, endRoom: undefined,
    layerDefs: [{ name: "#backgroundActive", tileSet: "#a" }, { name: "#objects", tileSet: "#o" }],
    rooms,
    roomAt(loc) { if (loc.x < 1 || loc.x > 1 || loc.y < 1 || loc.y > 2) return undefined; return rooms.get((loc.y - 1) + loc.x); },
  };
}
const viewW = 6 * TILE, viewH = 6 * TILE;
const atkOf = (a: string) => resolveAttack(((registry.resolveActor(a) ?? {})["attack"]) as any, registry.resolveActor(a) as any);

describe("room re-entry freeze: a live spell is not frozen into the snapshot", () => {
  beforeEach(setupWorld);

  it("a live objSpell is NON-recordable (never enters pState)", () => {
    const spell = spawnSpell(atkOf("energyBlast"), 1, 100, 100, "#aldevar", ["#teamMembers"], "#enemy");
    expect(spell.type).toBe("spell");
    expect(isRecordableActor(spell)).toBe(false); // the guard: a spell is transient, like a bullet
  });

  it("leaving a room with a spell mid-flight, then re-entering, yields NO component-less 'spell' entity", () => {
    const map = mkMap();
    const player = spawnPlayer(viewW / 2, viewH / 2); game.player = player;
    game.entities = [player];
    const rm = new RoomManager(map, game.assets, activeKey, objectsKey, viewW, viewH, player, () => {});
    rm.enter({ x: 1, y: 1 });
    // a live spell mid-flight in room 1 at the moment we leave
    const spell = spawnSpell(atkOf("energyBlast"), player.id, 80, 80, "#aldevar", ["#teamMembers"], "#enemy");
    spell.get(SpellActor).release(200, 80, 6);
    game.entities.push(spell);

    rm.enter({ x: 1, y: 2 }); // leave -> room 1 snapshot taken (the spell must be EXCLUDED)
    expect(rm.fullPState()[1]!.some((s) => s.type === "spell")).toBe(false); // not frozen

    rm.enter({ x: 1, y: 1 }); // RE-ENTER -> restore room 1
    // the bug: a restored pickup entity mislabelled type "spell" with no SpellActor. Assert every "spell"
    // entity is a real SpellActor-bearing actor (drawSpells' e.get(SpellActor) would otherwise throw).
    for (const e of game.entities) {
      if (e.type === "spell") expect(e.tryGet(SpellActor)).toBeTruthy();
    }
  });
});
