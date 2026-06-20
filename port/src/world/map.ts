// Map / Room / Layer model (objMap -> objRoom -> objTileLayer -> objDataMap). Maps are a
// single-line Lingo proplist `[#map: [...]]`; parse with the Lingo parser, then shape it.
// Room/map sizes are read PER-MAP (they vary 16x9..64x64 — PLAN_REVIEW §3), never hard-coded.

import { parseLingo, type Lingo } from "../data/lingo";

export interface Vec2i { x: number; y: number; }

export interface Layer {
  name: string;          // "#backgroundPassive" | "#backgroundActive" | "#objects"
  tileSet: string;       // tileset symbol, e.g. "#merlin4Passive"
  grid: number[][];      // grid[row][col], row-major; 0 = empty
}

export interface Room {
  num: number;
  layers: Layer[];
  // #miniMapStatus (objRoom.getMiniMapStatus): a data-set per-room status (#fre/#spe), when present.
  // None of the 47 shipped maps set it (they default to #clr / live-derived #inf); parsed for fidelity.
  miniMapStatus?: string;
  layer(name: string): Layer | undefined;
}

export interface GameMap {
  mapSize: Vec2i;        // rooms across/down
  roomSize: Vec2i;       // tiles across/down (e.g. 18x9)
  tilePx: number;        // gameplay tile px, resolved from the map's tilesets (32 for all shipped maps)
  startRoom: Vec2i;
  endRoom?: Vec2i;       // #endRoom (objMap.txt:79): reaching+clearing this room wins; #none -> undefined
  layerDefs: { name: string; tileSet: string }[];
  rooms: Map<number, Room>;
  roomAt(loc: Vec2i): Room | undefined;
}

/** Resolve a tileset symbol -> its tile px (from the assets index). */
export type TilePxFor = (tileSet: string) => number | undefined;

type L = Lingo | undefined;
const asObj = (v: L): Record<string, Lingo> =>
  (v && typeof v === "object" && !Array.isArray(v)) ? v as Record<string, Lingo> : {};
const asArr = (v: L): Lingo[] => Array.isArray(v) ? v : [];
const asNum = (v: L, d = 0): number => typeof v === "number" ? v : d;
const asStr = (v: L, d = ""): string => typeof v === "string" ? v : d;
const asPoint = (v: L): Vec2i => {
  const o = asObj(v); return { x: asNum(o["x"], 1), y: asNum(o["y"], 1) };
};

export function parseMap(src: string, tilePxFor?: TilePxFor): GameMap {
  const root = asObj(parseLingo(src));
  const m = asObj(root["map"]);
  const roomSize = asPoint(m["roomSize"]);
  const layerDefs = asArr(m["layerDefinitions"]).map((d) => {
    const o = asObj(d);
    return { name: asStr(o["name"]), tileSet: asStr(o["tileSet"]) };
  });
  const tileSetFor = (name: string) => layerDefs.find((d) => d.name === name)?.tileSet ?? "";

  // gameplay tile px = the active layer's tileset tile size (all gameplay tlks are 32; resolve, don't
  // hard-code, so a map referencing a non-32 tileset would scale correctly). Falls back to 32 when no
  // resolver is supplied (e.g. unit tests that parse a map without the asset index).
  const activeSym = tileSetFor("#backgroundActive") || tileSetFor("#backgroundPassive");
  const tilePx = (tilePxFor && tilePxFor(activeSym)) || 32;

  const rooms = new Map<number, Room>();
  for (const rv of asArr(m["rooms"])) {
    const ro = asObj(rv);
    const num = asNum(ro["num"]);
    const layers: Layer[] = asArr(ro["layers"]).map((lv) => {
      const lo = asObj(lv);
      const name = asStr(lo["name"]);
      const grid = asArr(lo["map"]).map((rowv) => asArr(rowv).map((c) => asNum(c)));
      return { name, tileSet: tileSetFor(name), grid };
    });
    const miniMapStatus = typeof ro["miniMapStatus"] === "string" ? asStr(ro["miniMapStatus"]) : undefined;
    rooms.set(num, { num, layers, miniMapStatus, layer(n) { return this.layers.find((l) => l.name === n); } });
  }

  const mapSize = asPoint(m["mapSize"]);
  // #endRoom (objMap.txt:79): the designated end room. #none (a symbol, not a point) -> undefined, so
  // isEndRoom is never true and the map wins only on clear-all. A real point -> the end-room win trigger.
  const endRoomRaw = m["endRoom"];
  const endRoom = (endRoomRaw && typeof endRoomRaw === "object" && !Array.isArray(endRoomRaw))
    ? asPoint(endRoomRaw) : undefined;
  return {
    mapSize, roomSize, tilePx, startRoom: asPoint(m["startRoom"]), endRoom,
    layerDefs, rooms,
    roomAt(loc) {
      // rooms are stored by 1-based incremental num, row-major across mapSize
      const idx = (loc.y - 1) * mapSize.x + loc.x;
      return rooms.get(idx);
    },
  };
}
