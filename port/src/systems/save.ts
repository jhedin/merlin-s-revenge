// Save/load (saveMaster) — the WHOLE-WORLD save tree. The original cascades
//   currentMap -> pRooms[] -> pRoomObjects[]   (objMap.addSaveData -> objRoom.pState -> actor chain)
// plus three master singletons (potion/sound/army). H3 supersedes G1's Option-A (current-room-only)
// with the FULL per-room pState map: EVERY visited room's snapshot is serialized, so a load restores
// every room's exact state (objRoom.pState per room), not just the current one. SAVE_VERSION bumps to 3
// (the same graceful-reject gate: a version/shape mismatch returns null, never migrates).
//
// On load, the caller (main.ts) reloads the map, restores the cleared set + the whole pState map + masters,
// restores the player, then rooms.restoreInto(currentRoom, pState[currentRoom]) tears down + respawns the
// current room and runs the deferred relationship pass (G1c). Persisted to localStorage as JSON.

import type { Entity } from "../engine/dispatch";
import type { Vec2i } from "../world/map";
import type { ActorSave } from "../entities/actorSerial";
import { game } from "../game/context";

export const SAVE_VERSION = 3;
const KEY = "mr_save_v3";
const LEGACY_KEYS = ["mr_save_v1", "mr_save_v2"]; // older blobs — ignored (clean break, plan §f.3)

export interface RoomSave { num: number; cleared: boolean; objects: ActorSave[]; }
export interface SaveDataV3 {
  ver: number;
  map: string;                 // map id (F1 multi-map: restore reloads the right map first)
  currentRoom: Vec2i;          // pCurrentRoomLoc
  currentRoomNum: number;      // the room whose live objects are entered on load
  rooms: RoomSave[];           // cleared flag per room (+ EACH room's frozen objects, H3 full pState)
  player: Record<string, any>; // the player's component chain (energy/xp/mana/weaponMgr/medikit/lives)
  potions: Record<string, any>;// g_potionMaster slice (G3b)
  army: Record<string, any>;   // g_armyMaster slice (G2)
  sound?: { muted: boolean };  // g_soundMaster.pActive (saveMaster saves the sound state too)
}
// back-compat alias for callers that import the type name
export type SaveDataV2 = SaveDataV3;

// buildSave: assemble the v3 blob from the live world. EVERY room in the pState map carries its frozen
// actors (H3); the current room's slot holds its live actors. A cleared room with no live actors carries
// an empty list (stays cleared/empty). Masters serialize whole.
export function buildSave(args: {
  player: Entity; mapId: string; currentRoom: Vec2i; currentRoomNum: number;
  clearedRooms: number[]; currentObjects: ActorSave[];
  pState?: Record<number, ActorSave[]>; // the full per-room snapshot map (H3); falls back to current-only
}): SaveDataV3 {
  const cleared = new Set(args.clearedRooms);
  const pState = args.pState ?? { [args.currentRoomNum]: args.currentObjects };
  const rooms: RoomSave[] = [];
  const seen = new Set<number>();
  // one entry per room that is EITHER cleared OR has a pState snapshot (visited).
  for (const num of new Set<number>([...cleared, ...Object.keys(pState).map(Number)])) {
    seen.add(num);
    rooms.push({ num, cleared: cleared.has(num), objects: pState[num] ?? [] });
  }
  if (!seen.has(args.currentRoomNum)) {
    rooms.push({ num: args.currentRoomNum, cleared: cleared.has(args.currentRoomNum), objects: args.currentObjects });
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
    sound: { muted: !!game.audio?.muted }, // soundMaster.addSaveData: persist the mute state across save/load
  };
}

export function saveGame(blob: SaveDataV3): void {
  localStorage.setItem(KEY, JSON.stringify(blob));
}

// loadSave: read + parse; REJECT a version/shape mismatch (return null, like isLoadAvailable). A malformed
// or legacy blob never throws — it returns null (clean break).
export function loadSave(): SaveDataV3 | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const sd = JSON.parse(raw) as SaveDataV3;
    if (!sd || sd.ver !== SAVE_VERSION) return null; // version gate (no migration)
    return sd;
  } catch { return null; }
}

/** rebuild the full per-room pState map from a loaded save's room list (H3 restore). */
export function pStateFromSave(sd: SaveDataV3): Record<number, ActorSave[]> {
  const out: Record<number, ActorSave[]> = {};
  for (const r of sd.rooms) out[r.num] = r.objects;
  return out;
}

export function hasSave(): boolean {
  const raw = localStorage.getItem(KEY);
  if (!raw) return false;
  try { const sd = JSON.parse(raw); return !!sd && sd.ver === SAVE_VERSION; } catch { return false; }
}

export function clearLegacy(): void { for (const k of LEGACY_KEYS) localStorage.removeItem(k); }
