// Save/load (saveMaster): the player's component chain contributes namespaced sub-dicts via the
// ordered addSaveData fold; restoreFromSave reads them back. Persisted to localStorage as JSON.
// (Faithful to the addSaveData/restoreFromSave cascade — PLAN_REVIEW §1 item 6.)

import type { Entity } from "../engine/dispatch";
import type { Vec2i } from "../world/map";

const KEY = "mr_save_v1";

export interface SaveData { v: number; room: Vec2i; player: Record<string, any>; }

export function saveGame(player: Entity, room: Vec2i): void {
  const sd: Record<string, any> = {};
  player.send("addSaveData", sd);          // each component writes its namespaced slice
  localStorage.setItem(KEY, JSON.stringify({ v: 1, room: { ...room }, player: sd }));
}

export function loadSave(): SaveData | null {
  const raw = localStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as SaveData) : null;
}

export function hasSave(): boolean { return localStorage.getItem(KEY) != null; }
