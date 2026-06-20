// Minimap (modMiniMap): 5-state per-room status + a proximity distance-blend. Replaces the port's
// 3-state grid. statusImages (modMiniMap 30-37): #clr (clear), #cur (current), #fre (friendly),
// #inf (infested), #spe (special). The current room is forced to #cur (getMiniMapData 169-171). We
// have no minimap bitmaps bundled, so each state maps to a solid colour. The whole minimap fades by
// proximity: blend = VarMapRange(minDist, [60,200], [10,90]) from min(mouse, player) distance
// (setBlendForMouseOrPlayer 208-222) — applied as globalAlpha.

import type { GameMap, Vec2i } from "../world/map";
import type { Renderer } from "./renderer";

export type MiniStatus = "#clr" | "#cur" | "#fre" | "#inf" | "#spe";

// the status-image palette as solid colours (no bundled minimap bitmaps).
const STATUS_COLOR: Record<MiniStatus, string> = {
  "#clr": "#69a", // cleared / clear room
  "#cur": "#fff", // current room
  "#fre": "#4d8", // friendly
  "#inf": "#e55", // infested (uncleared hostiles)
  "#spe": "#fc4", // special
};

// VarMapRange(v, [inLo,inHi], [outLo,outHi]) clamped (modMiniMap blend math).
function mapRange(v: number, inLo: number, inHi: number, outLo: number, outHi: number): number {
  if (v <= inLo) return outLo;
  if (v >= inHi) return outHi;
  return outLo + ((v - inLo) / (inHi - inLo)) * (outHi - outLo);
}

export interface MinimapInputs {
  map: GameMap;
  loc: Vec2i;                  // current room loc (1-based)
  cleared: Set<number>;        // cleared room nums
  infested: Set<number>;       // visited-but-uncleared room nums with live hostiles
  playerPx: { x: number; y: number }; // player screen pos (for the distance blend)
  cursorPx: { x: number; y: number } | null;
}

// status for a room loc: #cur (current) > room-data #fre/#spe > #inf (infested) > #clr.
export function statusFor(inp: MinimapInputs, x: number, y: number): MiniStatus | null {
  const room = inp.map.roomAt({ x, y });
  if (!room) return null;
  if (x === inp.loc.x && y === inp.loc.y) return "#cur";
  const data = room.miniMapStatus;
  if (data === "#fre" || data === "#spe") return data;
  if (inp.infested.has(room.num)) return "#inf";
  return "#clr";
}

export function drawMinimap(renderer: Renderer, inp: MinimapInputs, viewW: number): void {
  const ctx = renderer.ctx;
  const { map } = inp;
  const cell = 5;
  const w = map.mapSize.x * cell, h = map.mapSize.y * cell;
  const ox = viewW - w - 6, oy = 6;

  // distance blend: min(mouse, player) distance to the minimap sprite -> globalAlpha in [0.1, 0.9].
  const mapCx = ox + w / 2, mapCy = oy + h / 2;
  const pd = Math.hypot(inp.playerPx.x - mapCx, inp.playerPx.y - mapCy);
  const cd = inp.cursorPx ? Math.hypot(inp.cursorPx.x - mapCx, inp.cursorPx.y - mapCy) : Infinity;
  const minDist = Math.min(pd, cd);
  const blend = mapRange(minDist, 60, 200, 10, 90) / 100; // [0.1 .. 0.9]

  const prevAlpha = ctx.globalAlpha;
  ctx.globalAlpha = blend;
  ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(ox - 2, oy - 2, w + 4, h + 4);
  for (let y = 0; y < map.mapSize.y; y++) {
    for (let x = 0; x < map.mapSize.x; x++) {
      const st = statusFor(inp, x + 1, y + 1);
      ctx.fillStyle = st ? STATUS_COLOR[st] : "#222"; // no room here -> dim background
      ctx.fillRect(ox + x * cell, oy + y * cell, cell - 1, cell - 1);
    }
  }
  ctx.globalAlpha = prevAlpha;
}
