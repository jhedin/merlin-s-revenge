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

// NOTE on #recordInRoomState (objGameObject): some placed actors (fire mines) opt OUT of the per-room
// snapshot in the original — they re-tile-spawn fresh on re-entry. The port's pState restore replaces
// tile-spawning wholesale, so to avoid dropping content (a missing mine on re-entry) the port snapshots
// them like any other recordable actor; since a mine's FSM (and explosion count) re-inits on respawn,
// the on-re-entry state is equivalent to a fresh spawn — behavioral parity, save-bookkeeping deviation
// noted (plan §a.1 "minor"). The flag is preserved in data for a later strict-snapshot pass.

export class RoomManager {
  loc: Vec2i;
  room!: Room;
  grid!: CollisionGrid;
  passiveSheet?: TileSheet;
  activeSheet?: TileSheet;
  foregroundSheet?: TileSheet; // #foregroundPassive (drawn OVER actors, F3)
  exitsOpen = false;             // edges are solid until the room's hostiles are dead
  private margin = 12;
  private cleared = new Set<number>(); // room nums already cleared (persist across visits)
  // pState (objRoom.pState, H3): per-room snapshot of recordable live actors, taken on room-leave and
  // restored on re-entry, so a half-fought room comes back exactly as you left it (not re-spawned fresh).
  private pState = new Map<number, ActorSave[]>();
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
    const leavingNum = this.room?.num;
    // notify before tearing down the room we're leaving (G2 army teleport-out); skip on a restore.
    if (!this.restoring) {
      this.onLeaveRoom(game.entities.filter((e) => e.type !== "player"));
      // pState snapshot-on-leave (objRoom.deactivate -> freezeObjects -> saveState): freeze the leaving
      // room's recordable actors AFTER the teleport-out hook (so a reserve-banked ally is excluded —
      // it lives in the army reserve, not pState — avoiding a double-spawn on re-entry, plan §f.4).
      if (leavingNum !== undefined) {
        this.pState.set(leavingNum, game.entities.filter((e) => e.type !== "player").map(serializeActor));
      }
    }
    // room-scoped region effects (I1/I3): reset the magic limiter + team override to their defaults
    // BEFORE this room's markers re-apply on spawn (mirrors objMagicLimit/objTeamOverride `on finish`
    // restoring the default on room-leave). A dimmed region or a gang-up override can't leak rooms (§g.5).
    game.magicLimit.setDefault();
    game.teamMaster.teamOverride = null;
    this.loc = loc;
    this.room = this.map.roomAt(loc) ?? this.map.rooms.get(1)!;
    const active = this.room.layer("#backgroundActive");
    this.grid = active
      ? CollisionGrid.fromActiveLayer(active, this.activeKey, this.map.tilePx)
      : new CollisionGrid(this.map.roomSize.x, this.map.roomSize.y, this.map.tilePx);
    game.grid = this.grid;
    this.passiveSheet = this.sheetFor("#backgroundPassive");
    this.activeSheet = this.sheetFor("#backgroundActive");
    this.foregroundSheet = this.sheetFor("#foregroundPassive");

    // keep only the player; clear enemies/bullets from the previous room
    game.entities = game.entities.filter((e) => e.type === "player");
    // restore source: an explicit save-restore (restoreObjects) > a live pState snapshot (re-entry).
    const snapshot = restoreObjects ?? (this.restoring ? undefined : this.pState.get(this.room.num));
    if (snapshot) {
      // RESTORE PATH (objRoom.restoreState): respawn the saved live actors instead of tile-spawning, so a
      // re-entered room comes back exactly as you left it (same enemies/HP/positions, not a fresh spawn).
      this.restoreRoomObjects(snapshot, repositionPlayer);
      // re-field banked reserve allies near the player (G2 army teleport-in on the next room) — a live
      // re-entry still re-fields the reserve (only a save-restore suppresses it via `restoring`).
      if (!this.restoring && !restoreObjects) { const pm = this.player.get(Movement); this.onEnterRoom(pm.x, pm.y); }
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
  /** the cleared set (for the minimap status). */
  clearedSet(): Set<number> { return this.cleared; }
  // infested rooms (getMiniMapStatus #inf): the current room while it still holds live hostiles, plus
  // any VISITED (pState-snapshotted) room that isn't cleared and recorded a live hostile when left.
  infestedRooms(): Set<number> {
    const inf = new Set<number>();
    if (this.room && !this.cleared.has(this.room.num) && this.enemiesAlive()) inf.add(this.room.num);
    for (const [num, snap] of this.pState) {
      if (this.cleared.has(num)) continue;
      if (snap.some((s) => s.type === "enemy")) inf.add(num);
    }
    return inf;
  }
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
  /** the full per-room pState (H3): every visited room's snapshot + the live current room. The current
   *  room's slot is taken fresh from the live world (it may be mid-fight, not yet frozen into pState). */
  fullPState(): Record<number, ActorSave[]> {
    const out: Record<number, ActorSave[]> = {};
    for (const [num, snap] of this.pState) out[num] = snap;
    out[this.room.num] = this.snapshotCurrentRoom(); // current room's live actors override its frozen slot
    return out;
  }
  /** restore the whole pState map (loadGame): every room re-enters from its saved snapshot. */
  restorePState(map: Record<number, ActorSave[]> | undefined): void {
    this.pState = new Map();
    if (!map) return;
    for (const k of Object.keys(map)) this.pState.set(Number(k), map[Number(k)]!);
  }
  /** loadGame: enter `loc` and rebuild it from saved actors (suppressing the teleport-out hook). The
   *  current-room objects come from pState[currentRoomNum] (restored above) — passed explicitly here. */
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

  // isEndRoom (objMap.txt:499): the current room IS the designated #endRoom.
  private isEndRoom(): boolean {
    const er = this.map.endRoom;
    return !!er && er.x === this.loc.x && er.y === this.loc.y;
  }

  // markCleared (gameMaster.teamDied / objRoom.attemptOpenExits): a room clears. TWO independent win
  // triggers fire onMapClear (A3): reaching+clearing the designated #endRoom (isEndRoom), OR clearing
  // every room (isMapClear). A map with #endRoom:#none wins only on the clear-all path.
  private markCleared(): void {
    const firstClear = !this.cleared.has(this.room.num);
    if (firstClear) this.cleared.add(this.room.num);
    if (this.won) return;
    const endRoomWin = this.isEndRoom();                        // reached + cleared the end room
    const clearAllWin = this.cleared.size >= this.map.rooms.size; // cleared every room
    if (endRoomWin || clearAllWin) { this.won = true; this.onMapClear(); }
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
