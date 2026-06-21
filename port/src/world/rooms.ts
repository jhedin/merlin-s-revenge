// RoomManager (objMap + objRoom + modScreenExits): flip-screen room navigation. Holds the
// current room, builds its collision (open edges where an adjacent room exists), spawns its
// objects-layer actors, and transitions when the player walks off an open edge.

import type { GameMap, Room, Vec2i } from "./map";
import { CollisionGrid } from "./collision";
import { tileSymbol, type TileKey } from "../data/tlk";
import type { Assets } from "../render/assets";
import type { TileSheet } from "../render/renderer";
import { game } from "../game/context";
import { serializeActor, respawnActor, spawnFromSymbol, isRecordableActor, symbolIsNonRecordable, type ActorSave } from "../entities/actorSerial";
import { SKIP_SPAWN } from "./spawnTable";
import { rebuildCombatSubstrate } from "../systems/combatTick";
import { Movement } from "../components/movement";
import type { Entity } from "../engine/dispatch";

// #recordInRoomState (objGameObject, K13): transient combat objects (in-flight bullets and the placed
// fire mines / auras / hazards flagged #recordInRoomState:false) are NOT frozen into the per-room pState
// snapshot. On re-entry the recordable actors restore from pState exactly as left, and the non-recordable
// placed actors re-tile-spawn FRESH (their FSM/explosion count re-inits) — matching the original, where
// room activation always re-runs its tile spawn and restoreState only overlays the recorded actors. So a
// detonated mine comes back on re-entry (fresh), and a bullet in flight when you leave simply vanishes.

// K22: one arrow overlay rect (room pixel space) + which edge it sits on and its green/red colour.
export interface ExitArrowRect { x: number; y: number; w: number; h: number; edge: "left" | "up" | "right" | "down"; colour: "green" | "red"; }

// convertExitTilesToRangesEdge (modScreenExits ~149): collapse a 1-D run of matching (passable) edge cells
// into [startPx, endPx] ranges. A range opens at the first matching cell's start ((i)*tileLen) and closes at
// the end of the last matching cell in the run ((i+1)*tileLen) — i.e. the original's currentStart/currentEnd
// arithmetic, re-expressed as 0-based cell indices. Returns one range per contiguous passable run.
function runs(n: number, passable: (i: number) => boolean, tileLen: number): [number, number][] {
  const out: [number, number][] = [];
  let openStart = -1;
  for (let i = 0; i < n; i++) {
    const m = passable(i);
    if (m && openStart < 0) openStart = i;          // start a new range
    if (openStart >= 0 && (!m || i === n - 1)) {     // close on a non-match or the final cell
      const lastCell = m ? i : i - 1;                // include the final cell only if it matched
      out.push([openStart * tileLen, (lastCell + 1) * tileLen]);
      openStart = -1;
    }
  }
  return out;
}

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
        this.pState.set(leavingNum, game.entities.filter((e) => e.type !== "player" && isRecordableActor(e)).map(serializeActor));
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
    return game.entities.filter((e) => e.type !== "player" && isRecordableActor(e)).map(serializeActor);
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
    // K13: the #recordInRoomState:false placed actors (fire mines/auras/hazards) were excluded from the
    // snapshot — re-tile-spawn them FRESH now (the original's room activation always re-runs its tile
    // spawn; restoreState only overlays the recorded actors). Detonated mines thus return on re-entry.
    this.spawnNonRecordableTileActors();
    // a restore keeps the player at its saved Movement loc (restored from the chain by doLoad) — do NOT
    // re-center it; pass playerPlaced=true so placePlayer only honors an explicit walk-in reposition.
    this.placePlayer(reposition, true);
  }

  // spawnNonRecordableTileActors (K13): spawn just the placed #recordInRoomState:false actors from the
  // room's #objects layer (fire mines / auras / hazards) — used on the restore path, where the recorded
  // actors come from pState but the non-recorded placed content must re-spawn fresh.
  private spawnNonRecordableTileActors(): void {
    const objects = this.room.layer("#objects");
    if (!objects) return;
    const t = this.map.tilePx;
    for (let r = 0; r < objects.grid.length; r++) {
      const row = objects.grid[r]!;
      for (let c = 0; c < row.length; c++) {
        const n = row[c]!;
        if (n <= 0) continue;
        const sym = tileSymbol(this.objectsKey, n);
        if (SKIP_SPAWN.has(sym) || !symbolIsNonRecordable(sym)) continue;
        const e = spawnFromSymbol(sym, c * t + t / 2, r * t + t / 2);
        if (e) game.entities.push(e);
      }
    }
  }

  /** open edges only where an adjacent room exists, and only once the room is cleared. */
  private setExits(open: boolean): void {
    this.exitsOpen = open;
    // gNavMode=1 (GameSpecific): a CLEARED room puts the player in nav mode (objRoom.goNavMode ->
    // player.setWalkAcceleration(pNavModeAcceleration 6) vs combat walkAcceleration 2 -> ~3x faster). The
    // player Movement reads game.navMode for the speed boost; Chatter gates its trigger on it (talkOnlyOnNavMode).
    game.navMode = open;
    const { x, y } = this.loc;
    this.grid.open = open ? {
      left: !!this.map.roomAt({ x: x - 1, y }), right: !!this.map.roomAt({ x: x + 1, y }),
      up: !!this.map.roomAt({ x, y: y - 1 }), down: !!this.map.roomAt({ x, y: y + 1 }),
    } : { left: false, right: false, up: false, down: false };
  }

  private enemiesAlive(): boolean {
    return game.entities.some((e) => e.type === "enemy" && !e.send("isDead"));
  }

  // ── K22 exit arrows (objRoom.drawExitArrows + modScreenExits) ─────────────────────────────────────
  // Per room edge, the contiguous runs of passable edge tiles where an adjacent room exists become arrow
  // rects: GREEN when that exit is currently usable (this room cleared → grid.open[edge]), else RED.
  // Faithful chain: getScreenExitsForEdge → convertExitTilesToRangesEdge(match #none) → convertExitRanges-
  // ToArrowRectsEdge. The colour mirrors drawExitArrowsOnImage's green/red-by-surroundingHostiles: in the
  // port a room's exits don't open until it's cleared, so open[edge] is the usability (green) signal and an
  // uncleared room shows its (would-be) exits RED. (Original keyed RED off the DESTINATION room's hostiles;
  // here it's the current room's clear state — the port's actual exit-gating signal — see plan note K22.)
  private static readonly ARROW_THICKNESS = 16; // the arrow art is 16×16 (no gExitArrowThickness in cast)

  /** Arrow overlay rects for the current room, in room pixel space. Empty when the room has no exits. */
  exitArrowRects(): ExitArrowRect[] {
    const out: ExitArrowRect[] = [];
    const { x, y } = this.loc;
    const cols = this.grid.cols, rows = this.grid.rows, t = this.grid.tilePx;
    const th = RoomManager.ARROW_THICKNESS;
    const imgW = cols * t, imgH = rows * t;
    type Edge = "left" | "up" | "right" | "down";
    // (edge, adjacent room exists?, the column/row of cells along that edge).
    const edges: { edge: Edge; adj: boolean }[] = [
      { edge: "left", adj: !!this.map.roomAt({ x: x - 1, y }) },
      { edge: "up", adj: !!this.map.roomAt({ x, y: y - 1 }) },
      { edge: "right", adj: !!this.map.roomAt({ x: x + 1, y }) },
      { edge: "down", adj: !!this.map.roomAt({ x, y: y + 1 }) },
    ];
    for (const { edge, adj } of edges) {
      if (!adj) continue; // no arrow on an edge with no neighbouring room
      const open = this.grid.open[edge];
      const colour: "green" | "red" = open ? "green" : "red";
      // passable run of edge cells (match #none) → ranges, in px along the edge axis.
      const horizontal = edge === "up" || edge === "down";
      const n = horizontal ? cols : rows;
      const passable = (i: number): boolean =>
        horizontal ? this.grid.passableCell(i, edge === "up" ? 0 : rows - 1)
                    : this.grid.passableCell(edge === "left" ? 0 : cols - 1, i);
      for (const [start, end] of runs(n, passable, t)) {
        // convertExitRangesToArrowRectsEdge: thickness on the perpendicular axis, range along the edge.
        const rect = edge === "left" ? { x: 0, y: start, w: th, h: end - start }
          : edge === "right" ? { x: imgW - th, y: start, w: th, h: end - start }
          : edge === "up" ? { x: start, y: 0, w: end - start, h: th }
          : { x: start, y: imgH - th, w: end - start, h: th };
        out.push({ ...rect, edge, colour });
      }
    }
    return out;
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
