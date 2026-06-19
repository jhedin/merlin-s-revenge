// RoomManager (objMap + objRoom + modScreenExits): flip-screen room navigation. Holds the
// current room, builds its collision (open edges where an adjacent room exists), spawns its
// objects-layer actors, and transitions when the player walks off an open edge.

import type { GameMap, Room, Vec2i } from "./map";
import { CollisionGrid } from "./collision";
import { tileSymbol, type TileKey } from "../data/tlk";
import type { Assets } from "../render/assets";
import type { TileSheet } from "../render/renderer";
import { game } from "../game/context";
import { spawnUnit, spawnDwelling, spawnPickup } from "../entities/archetypes";
import { spriteCharOr } from "../components/anim";
import { Movement } from "../components/movement";
import { registry } from "../game/data";
import type { PickupEffect } from "../components/pickup";
import type { Entity } from "../engine/dispatch";

// Powerup tiles -> collectible pickup effect (the effect is a port abstraction; the rest of a
// spawn's behavior comes from its real actor data — dwellings/units are detected by #objType).
const PICKUPS: Record<string, PickupEffect> = {
  "#medikit": "heal", "#maxikit": "heal",
  "#walkSpeed": "speed",
  // each mana powerup raises its own stat (objManaCapacity/Burst/Flow), not one generic boost
  "#manaCapacity": "manaCapacity", "#manaBurst": "manaBurst", "#manaFlow": "manaFlow",
  "#merlinSword": "sword", // melee weapon upgrade (act_merlinSword, damageMultiplier 16)
  "#energyBlast": "spell",  // scroll (room 6): grants Merlin's charged magic — he starts punch-only
};

// Items / spells with no unit/dwelling behavior yet (scrolls, mines, music, towers). Characters
// (#objCPUCharacter) and dwellings (#objDwelling) are handled by data; this only skips the rest.
const SKIP_SPAWN = new Set([
  "#none", "#player", "#musicLastStand",
  // unplaced-or-unreachable spell scrolls (none appear in the map except #energyBlast, now a pickup)
  "#energyMines", "#energyMine", "#energyPulseSpell", "#armySummon", "#dwarfTower",
]);

export class RoomManager {
  loc: Vec2i;
  room!: Room;
  grid!: CollisionGrid;
  passiveSheet?: TileSheet;
  activeSheet?: TileSheet;
  exitsOpen = false;             // edges are solid until the room's hostiles are dead
  private margin = 12;
  private cleared = new Set<number>(); // room nums already cleared (persist across visits)
  private won = false;

  constructor(
    private map: GameMap, private assets: Assets,
    private activeKey: TileKey, private objectsKey: TileKey,
    private viewW: number, private viewH: number, private player: Entity,
    private onMapClear: () => void = () => {},
  ) {
    this.loc = { ...map.startRoom };
  }

  enter(loc: Vec2i, repositionPlayer?: "left" | "right" | "up" | "down"): void {
    this.loc = loc;
    this.room = this.map.roomAt(loc) ?? this.map.rooms.get(1)!;
    const active = this.room.layer("#backgroundActive");
    this.grid = active
      ? CollisionGrid.fromActiveLayer(active, this.activeKey, this.map.tilePx)
      : new CollisionGrid(this.map.roomSize.x, this.map.roomSize.y, this.map.tilePx);
    game.grid = this.grid;
    this.passiveSheet = this.sheetFor("#backgroundPassive");
    this.activeSheet = this.sheetFor("#backgroundActive");

    // keep only the player; clear enemies/bullets from the previous room
    game.entities = game.entities.filter((e) => e.type === "player");
    const alreadyClear = this.cleared.has(this.room.num);
    this.spawnObjects(repositionPlayer, !alreadyClear); // cleared rooms keep their dead
    // a room with no hostiles is cleared on entry (objRoom.attemptOpenExits)
    if (alreadyClear || !this.enemiesAlive()) this.markCleared();
    this.setExits(this.cleared.has(this.room.num));
  }

  /** open edges only where an adjacent room exists, and only once the room is cleared. */
  private setExits(open: boolean): void {
    this.exitsOpen = open;
    const { x, y } = this.loc;
    this.grid.open = open ? {
      left: !!this.map.roomAt({ x: x - 1, y }), right: !!this.map.roomAt({ x: x + 1, y }),
      up: !!this.map.roomAt({ x, y: y - 1 }), down: !!this.map.roomAt({ x, y: y + 1 }),
    } : { left: false, right: false, up: false, down: false };
  }

  private enemiesAlive(): boolean {
    return game.entities.some((e) => e.type === "enemy" && !e.send("isDead"));
  }

  private markCleared(): void {
    if (this.cleared.has(this.room.num)) return;
    this.cleared.add(this.room.num);
    if (!this.won && this.cleared.size >= this.map.rooms.size) { this.won = true; this.onMapClear(); }
  }

  /** Transition on edge crossing; gate exits behind clearing the room; returns true on room change. */
  update(): boolean {
    // open the exits the moment the room's hostiles are dead (objRoom.attemptOpenExits)
    if (!this.exitsOpen && !this.enemiesAlive()) { this.markCleared(); this.setExits(true); }
    const m = this.player.get(Movement);
    const o = this.grid.open;
    if (m.x < 0 && o.left) { this.enter({ x: this.loc.x - 1, y: this.loc.y }, "left"); return true; }
    if (m.x > this.viewW && o.right) { this.enter({ x: this.loc.x + 1, y: this.loc.y }, "right"); return true; }
    if (m.y < 0 && o.up) { this.enter({ x: this.loc.x, y: this.loc.y - 1 }, "up"); return true; }
    if (m.y > this.viewH && o.down) { this.enter({ x: this.loc.x, y: this.loc.y + 1 }, "down"); return true; }
    return false;
  }

  private spawnObjects(reposition?: "left" | "right" | "up" | "down", spawnActors = true): void {
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
            // the player marker is always honored so we drop into the room at its start tile
            if (!reposition) { m.x = px; m.y = py; m.vx = m.vy = 0; playerPlaced = true; }
          } else if (!spawnActors) {
            // already-cleared room: keep its dead, spawn no actors/pickups
          } else if (PICKUPS[sym]) {
            game.entities.push(spawnPickup(PICKUPS[sym]!, px, py));
          } else if (registry.resolveActor(sym.slice(1))?.["objType"] === "#objDwelling") {
            const name = sym.slice(1); // a building: its residents come from its own #residentGroups
            game.entities.push(spawnDwelling(name, px, py, spriteCharOr(name)));
          } else if (!SKIP_SPAWN.has(sym)) {
            const name = sym.slice(1);
            // route by team (#aldevar units join Merlin as allies); ranged-ness comes from #attack
            game.entities.push(spawnUnit(name, px, py, { animChar: spriteCharOr(name) }));
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
