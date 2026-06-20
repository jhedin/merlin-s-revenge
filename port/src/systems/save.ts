// Save/load (saveMaster) — the WHOLE-WORLD save tree (G1b). The original cascades
//   currentMap -> pRooms[] -> pRoomObjects[]   (objMap.addSaveData -> objRoom -> actor chain)
// plus three master singletons (potion/sound/army). The port ships Option A (plan §C.2): snapshot the
// CURRENT room's live actors + the cleared-room flag set + the player chain, version the blob (v2), and
// REJECT (not migrate) an old-format save (saveMaster.isLoadAvailable gates on sd.ver == pSaveVersion).
//
// On load, the caller (main.ts) reloads the map, restores the cleared set + masters, restores the player,
// then rooms.restoreInto(currentRoom, objects) tears down + respawns the room's actors and runs the
// deferred relationship pass (G1c). Persisted to localStorage as JSON (the port's analogue of
// setPref(string(sd))).

import type { Entity } from "../engine/dispatch";
import type { Vec2i } from "../world/map";
import type { ActorSave } from "../entities/actorSerial";
import { game } from "../game/context";

export const SAVE_VERSION = 2;
const KEY = "mr_save_v2";
const LEGACY_KEY = "mr_save_v1"; // old {v:1, room, player} blob — ignored (clean break, plan §f.3)

export interface RoomSave { num: number; cleared: boolean; objects: ActorSave[]; }
export interface SaveDataV2 {
  ver: number;
  map: string;                 // map id (F1 multi-map: restore reloads the right map first)
  currentRoom: Vec2i;          // pCurrentRoomLoc
  currentRoomNum: number;      // the room whose live objects are snapshotted below
  rooms: RoomSave[];           // cleared flag per room (+ the current room's live objects)
  player: Record<string, any>; // the player's component chain (energy/xp/mana/weaponMgr/medikit)
  potions: Record<string, any>;// g_potionMaster slice (G3b)
  army: Record<string, any>;   // g_armyMaster slice (G2)
}

// buildSave: assemble the v2 blob from the live world. The CURRENT room carries its live actors; every
// cleared room carries its flag (objects: []). The current room may not yet be cleared, so it always gets
// an entry. Masters serialize whole.
export function buildSave(args: {
  player: Entity; mapId: string; currentRoom: Vec2i; currentRoomNum: number;
  clearedRooms: number[]; currentObjects: ActorSave[];
}): SaveDataV2 {
  const rooms: RoomSave[] = [];
  const seen = new Set<number>();
  for (const num of args.clearedRooms) {
    seen.add(num);
    rooms.push({ num, cleared: true, objects: num === args.currentRoomNum ? args.currentObjects : [] });
  }
  if (!seen.has(args.currentRoomNum)) {
    rooms.push({ num: args.currentRoomNum, cleared: false, objects: args.currentObjects });
  }
  const playerChain: Record<string, any> = {};
  args.player.send("addSaveData", playerChain);
  return {
    ver: SAVE_VERSION,
    map: args.mapId,
    currentRoom: { ...args.currentRoom },
    currentRoomNum: args.currentRoomNum,
    rooms,
    player: playerChain,
    potions: game.potionMaster ? game.potionMaster.addSaveData({}) : {},
    army: game.armyMaster ? game.armyMaster.addSaveData({}) : {},
  };
}

export function saveGame(blob: SaveDataV2): void {
  localStorage.setItem(KEY, JSON.stringify(blob));
}

// loadSave: read + parse; REJECT a version/shape mismatch (return null, like isLoadAvailable). A malformed
// or legacy blob never throws — it returns null (clean break).
export function loadSave(): SaveDataV2 | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const sd = JSON.parse(raw) as SaveDataV2;
    if (!sd || sd.ver !== SAVE_VERSION) return null; // version gate (no migration)
    return sd;
  } catch { return null; }
}

export function hasSave(): boolean {
  const raw = localStorage.getItem(KEY);
  if (!raw) return false;
  try { const sd = JSON.parse(raw); return !!sd && sd.ver === SAVE_VERSION; } catch { return false; }
}

export function clearLegacy(): void { localStorage.removeItem(LEGACY_KEY); }
