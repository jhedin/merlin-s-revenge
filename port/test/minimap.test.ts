import { describe, it, expect } from "vitest";
import { statusFor, type MinimapInputs } from "@/render/minimap";
import type { GameMap, Room, Vec2i } from "@/world/map";

// F3 minimap 5-state status selection (modMiniMap.getMiniMapStatus). The current room is forced #cur;
// room-data #fre/#spe win when present; otherwise #inf (infested) or #clr.

function fakeMap(rooms: Record<number, { x: number; y: number; status?: string }>, mapSize: Vec2i): GameMap {
  const roomMap = new Map<number, Room>();
  const byLoc = new Map<string, number>();
  for (const [num, r] of Object.entries(rooms)) {
    const n = Number(num);
    roomMap.set(n, { num: n, layers: [], miniMapStatus: r.status, layer: () => undefined });
    byLoc.set(`${r.x},${r.y}`, n);
  }
  return {
    mapSize, roomSize: { x: 1, y: 1 }, tilePx: 32, startRoom: { x: 1, y: 1 },
    layerDefs: [], rooms: roomMap,
    roomAt: (loc) => { const n = byLoc.get(`${loc.x},${loc.y}`); return n ? roomMap.get(n) : undefined; },
  } as GameMap;
}

describe("F3 minimap 5-state status", () => {
  const map = fakeMap({
    1: { x: 1, y: 1 }, 2: { x: 2, y: 1 }, 3: { x: 1, y: 2, status: "#fre" }, 4: { x: 2, y: 2, status: "#spe" },
  }, { x: 2, y: 2 });
  const base: MinimapInputs = {
    map, loc: { x: 1, y: 1 }, cleared: new Set([1]), infested: new Set([2]),
    playerPx: { x: 0, y: 0 }, cursorPx: null,
  };

  it("the current room is #cur", () => { expect(statusFor(base, 1, 1)).toBe("#cur"); });
  it("an infested (uncleared, hostiles) room is #inf", () => { expect(statusFor(base, 2, 1)).toBe("#inf"); });
  it("room-data #fre wins over live state", () => { expect(statusFor(base, 1, 2)).toBe("#fre"); });
  it("room-data #spe wins", () => { expect(statusFor(base, 2, 2)).toBe("#spe"); });
  it("a cleared, non-current, non-infested room is #clr", () => {
    const inp = { ...base, loc: { x: 2, y: 1 }, cleared: new Set([1, 2]), infested: new Set<number>() };
    expect(statusFor(inp, 1, 1)).toBe("#clr"); // room 1: cleared, not current now
  });
  it("an empty loc (no room) returns null", () => { expect(statusFor(base, 5, 5)).toBeNull(); });
});
