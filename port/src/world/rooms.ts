// RoomManager (objMap + objRoom + modScreenExits): flip-screen room navigation. Holds the
// current room, builds its collision (open edges where an adjacent room exists), spawns its
// objects-layer actors, and transitions when the player walks off an open edge.

import type { GameMap, Room, Vec2i } from "./map";
import { CollisionGrid } from "./collision";
import { tileSymbol, type TileKey } from "../data/tlk";
import type { Assets } from "../render/assets";
import type { TileSheet } from "../render/renderer";
import { game } from "../game/context";
import { serializeActor, respawnActor, spawnFromSymbol, type ActorSave } from "../entities/actorSerial";
import { SKIP_SPAWN } from "./spawnTable";
import { rebuildCombatSubstrate } from "../systems/combatTick";
import { Movement } from "../components/movement";
import type { Entity } from "../engine/dispatch";

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

  // onLeaveRoom: called with the live entity list of the room BEING LEFT, before it's torn down. G2
  // hooks this to teleport summoned allies to the army reserve (armyTeleportOut) instead of despawning.
  onLeaveRoom: (leaving: Entity[]) => void = () => {};
  // onEnterRoom: called after a fresh (non-restore) room is populated, with the player drop loc. G2
  // hooks this to re-field banked reserve allies near the player (armyTeleportIn on the next room).
  onEnterRoom: (x: number, y: number) => void = () => {};
  private restoring = false; // suppress onLeaveRoom/onEnterRoom while loadGame tears the world down

  enter(loc: Vec2i, repositionPlayer?: "left" | "right" | "up" | "down", restoreObjects?: ActorSave[]): void {
    // notify before tearing down the room we're leaving (G2 army teleport-out); skip on a restore.
    if (!this.restoring) this.onLeaveRoom(game.entities.filter((e) => e.type !== "player"));
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
    if (restoreObjects) {
      // RESTORE PATH (objRoom.restoreRoomObjects): respawn the saved live actors instead of tile-spawning.
      this.restoreRoomObjects(restoreObjects, repositionPlayer);
    } else {
      const alreadyClear = this.cleared.has(this.room.num);
      this.spawnObjects(repositionPlayer, !alreadyClear); // cleared rooms keep their dead
      // re-field banked reserve allies near the player (G2 army teleport-in on the next room).
      if (!this.restoring) { const pm = this.player.get(Movement); this.onEnterRoom(pm.x, pm.y); }
    }
    // a room with no hostiles is cleared on entry (objRoom.attemptOpenExits)
    if (this.cleared.has(this.room.num) || !this.enemiesAlive()) this.markCleared();
    this.setExits(this.cleared.has(this.room.num));
  }

  // --- save-tree hooks (G1b) ---
  /** the num of the current room (the one whose live actors are snapshotted). */
  currentRoomNum(): number { return this.room.num; }
  /** the cleared-room flag set (objRoom.pRoomCleared), serialized whole. */
  clearedRooms(): number[] { return [...this.cleared]; }
  /** restore the cleared set (loadGame, before entering the current room). */
  restoreCleared(nums: number[]): void {
    this.cleared = new Set(nums);
    // keep `won` latched if the restored set already covers every room (don't re-fire onMapClear).
    this.won = this.cleared.size >= this.map.rooms.size;
  }
  /** snapshot the CURRENT room's live actors (everything but the player) for the save tree. */
  snapshotCurrentRoom(): ActorSave[] {
    return game.entities.filter((e) => e.type !== "player").map(serializeActor);
  }
  /** loadGame: enter `loc` and rebuild it from saved actors (suppressing the teleport-out hook). */
  restoreInto(loc: Vec2i, objects: ActorSave[]): void {
    this.restoring = true;
    try { this.enter(loc, undefined, objects); } finally { this.restoring = false; }
  }

  // restoreRoomObjects (objRoom 613-653): respawn each saved actor at rest, then a deferred phase-2
  // relationship pass re-acquires committed targets POSITIONALLY (G1c) once the world is fully populated.
  private restoreRoomObjects(objects: ActorSave[], reposition?: "left" | "right" | "up" | "down"): void {
    const restored: { e: Entity; rel?: ActorSave["rel"] }[] = [];
    for (const snap of objects) {
      const e = respawnActor(snap);
      if (e) { game.entities.push(e); restored.push({ e, rel: snap.rel }); }
    }
    // register the freshly-spawned batch into teamMaster's rosters + unit-map (so restoreTarget's spatial
    // query has a populated world to search) — the per-tick substrate refresh, run once here on restore.
    rebuildCombatSubstrate();
    // phase 2: re-link committed targets by spatial query (teamMaster.restoreTarget) — strictly AFTER
    // every actor exists + is rostered, so the nearest live unit of the saved team+role/loc can win.
    for (const { e, rel } of restored) {
      if (rel) game.teamMaster.restoreTarget(e, rel);
    }
    // a restore keeps the player at its saved Movement loc (restored from the chain by doLoad) — do NOT
    // re-center it; pass playerPlaced=true so placePlayer only honors an explicit walk-in reposition.
    this.placePlayer(reposition, true);
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
          } else if (!SKIP_SPAWN.has(sym)) {
            // shared symbol routing (spawnFromSymbol): pickups / dwellings / units — same branching as
            // the save-restore path so first-spawn and restore cannot drift.
            const e = spawnFromSymbol(sym, px, py);
            if (e) game.entities.push(e);
          }
        }
      }
    }
    this.placePlayer(reposition, playerPlaced);
  }

  // reposition the player to the opposite edge after a transition, else center if no #player marker.
  private placePlayer(reposition: "left" | "right" | "up" | "down" | undefined, playerPlaced: boolean): void {
    const m = this.player.get(Movement);
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
