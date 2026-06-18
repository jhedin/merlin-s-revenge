// RoomManager (objMap + objRoom + modScreenExits): flip-screen room navigation. Holds the
// current room, builds its collision (open edges where an adjacent room exists), spawns its
// objects-layer actors, and transitions when the player walks off an open edge.

import type { GameMap, Room, Vec2i } from "./map";
import { CollisionGrid } from "./collision";
import { tileSymbol, type TileKey } from "../data/tlk";
import type { Assets } from "../render/assets";
import type { TileSheet } from "../render/renderer";
import { game } from "../game/context";
import { spawnEnemy } from "../entities/archetypes";
import { Movement } from "../components/movement";
import type { Entity } from "../engine/dispatch";

// Stand-in mapping: spawn-table symbols -> bundled actor sprites (melee->blackOrc, ranged->dwarf).
// Faithful spawn POSITIONS from the map; sprites are placeholders until more anims are bundled.
const ENEMY_STANDIN: Record<string, { char: string; ranged: boolean }> = {
  "#warrior": { char: "blackOrc", ranged: false }, "#goblinWarrior": { char: "blackOrc", ranged: false },
  "#goblinHero": { char: "blackOrc", ranged: false }, "#skeletonWarrior": { char: "blackOrc", ranged: false },
  "#ninja": { char: "blackOrc", ranged: false }, "#monk": { char: "blackOrc", ranged: false },
  "#berlinInGame": { char: "blackOrc", ranged: false },
  "#dwarf": { char: "dwarf", ranged: false },
  "#archer": { char: "dwarf", ranged: true }, "#goblinArcher": { char: "dwarf", ranged: true },
  "#skeletonArcher": { char: "dwarf", ranged: true }, "#skeletonThrower": { char: "dwarf", ranged: true },
  "#goblinMage": { char: "dwarf", ranged: true }, "#dwarfTower": { char: "dwarf", ranged: true },
};

export class RoomManager {
  loc: Vec2i;
  room!: Room;
  grid!: CollisionGrid;
  passiveSheet?: TileSheet;
  activeSheet?: TileSheet;
  private margin = 12;

  constructor(
    private map: GameMap, private assets: Assets,
    private activeKey: TileKey, private objectsKey: TileKey,
    private viewW: number, private viewH: number, private player: Entity,
  ) { this.loc = { ...map.startRoom }; }

  enter(loc: Vec2i, repositionPlayer?: "left" | "right" | "up" | "down"): void {
    this.loc = loc;
    this.room = this.map.roomAt(loc) ?? this.map.rooms.get(1)!;
    const active = this.room.layer("#backgroundActive");
    this.grid = active
      ? CollisionGrid.fromActiveLayer(active, this.activeKey, this.map.tilePx)
      : new CollisionGrid(this.map.roomSize.x, this.map.roomSize.y, this.map.tilePx);
    this.grid.open = {
      left: !!this.map.roomAt({ x: loc.x - 1, y: loc.y }),
      right: !!this.map.roomAt({ x: loc.x + 1, y: loc.y }),
      up: !!this.map.roomAt({ x: loc.x, y: loc.y - 1 }),
      down: !!this.map.roomAt({ x: loc.x, y: loc.y + 1 }),
    };
    game.grid = this.grid;
    this.passiveSheet = this.sheetFor("#backgroundPassive");
    this.activeSheet = this.sheetFor("#backgroundActive");

    // keep only the player; clear enemies/bullets from the previous room
    game.entities = game.entities.filter((e) => e.type === "player");
    this.spawnObjects(repositionPlayer);
  }

  /** Transition when the player crosses an open edge; returns true if a room change happened. */
  update(): boolean {
    const m = this.player.get(Movement);
    const o = this.grid.open;
    if (m.x < 0 && o.left) { this.enter({ x: this.loc.x - 1, y: this.loc.y }, "left"); return true; }
    if (m.x > this.viewW && o.right) { this.enter({ x: this.loc.x + 1, y: this.loc.y }, "right"); return true; }
    if (m.y < 0 && o.up) { this.enter({ x: this.loc.x, y: this.loc.y - 1 }, "up"); return true; }
    if (m.y > this.viewH && o.down) { this.enter({ x: this.loc.x, y: this.loc.y + 1 }, "down"); return true; }
    return false;
  }

  private spawnObjects(reposition?: "left" | "right" | "up" | "down"): void {
    const objects = this.room.layer("#objects");
    const t = this.map.tilePx;
    const m = this.player.get(Movement);
    let playerPlaced = false;
    if (objects) {
      for (let r = 0; r < objects.grid.length; r++) {
        const row = objects.grid[r]!;
        for (let c = 0; c < row.length; c++) {
          const n = row[c]!;
          if (n <= 0) continue;
          const sym = tileSymbol(this.objectsKey, n);
          const px = c * t + t / 2, py = r * t + t / 2;
          if (sym === "#player") {
            if (!reposition) { m.x = px; m.y = py; m.vx = m.vy = 0; playerPlaced = true; }
          } else {
            const s = ENEMY_STANDIN[sym];
            if (s) game.entities.push(spawnEnemy(s.char, px, py, { ranged: s.ranged }));
          }
        }
      }
    }
    // reposition the player to the opposite edge after a transition
    if (reposition === "left") m.x = this.viewW - this.margin;
    else if (reposition === "right") m.x = this.margin;
    else if (reposition === "up") m.y = this.viewH - this.margin;
    else if (reposition === "down") m.y = this.margin;
    if (reposition) { m.vx = m.vy = 0; }
    else if (!playerPlaced) { m.x = this.viewW / 2; m.y = this.viewH / 2; }
  }

  private sheetFor(layerName: string): TileSheet | undefined {
    const layer = this.room.layer(layerName);
    if (!layer) return undefined;
    const ts = this.assets.index.tilesets[layer.tileSet];
    if (!ts) return undefined;
    return { img: this.assets.img(ts.file), cols: ts.cols, tile: ts.tile };
  }
}
