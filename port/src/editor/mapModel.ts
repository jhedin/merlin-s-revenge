// Editor view over a parsed Lingo map value. The underlying LingoValue is the source of truth — every
// mutation writes back into it in place, so `serialize()` always reflects the current edits and ALL
// non-tile fields (#displayScale, #roomMapScale, #miniMapStatus, …) round-trip untouched. This is a thin
// navigation/mutation layer; the game's own parseMap stays the read path for actually playing a map.

import { parse, serialize, propGet, propSet, type LingoValue } from "./lingo";

export interface Vec2 { x: number; y: number; }
export interface LayerDef { name: string; tileSet: string; }

const sym = (v: string): LingoValue => ({ t: "sym", v });
const int = (v: number): LingoValue => ({ t: "int", v });
const pt = (x: number, y: number): LingoValue => ({ t: "call", name: "point", args: [int(x), int(y)] });

function asInt(v: LingoValue | undefined, dflt = 0): number {
  return v && (v.t === "int" || v.t === "float") ? v.v : dflt;
}
function asPoint(v: LingoValue | undefined): Vec2 {
  if (v && v.t === "call" && v.name === "point") return { x: asInt(v.args[0]), y: asInt(v.args[1]) };
  return { x: 0, y: 0 };
}
function asSymName(v: LingoValue | undefined): string {
  return v && v.t === "sym" ? v.v : "";
}
function items(v: LingoValue | undefined): LingoValue[] {
  return v && v.t === "list" ? v.items : [];
}

export class EditorMap {
  /** the whole file value: a prop-list `[#map: <mapProps>]` */
  readonly root: LingoValue;
  /** the inner `#map` prop-list */
  private readonly map: LingoValue;

  constructor(root: LingoValue) {
    this.root = root;
    const m = propGet(root, "map");
    if (!m || m.t !== "props") throw new Error("editor: not a map file (missing #map prop-list)");
    this.map = m;
  }

  static load(src: string): EditorMap { return new EditorMap(parse(src)); }
  serialize(): string { return serialize(this.root); }

  /** Build a fresh blank map: the standard 3 layers + a dense grid of all-0 rooms (1..cols*rows). */
  static createBlank(mapCols: number, mapRows: number, roomCols: number, roomRows: number,
    tilesets: [string, string, string] = ["merlinOpenPassive", "merlinOpenActive", "merlinOpenObjects"]): EditorMap {
    const names = ["backgroundPassive", "backgroundActive", "objects"];
    const layerDefs: LingoValue = {
      t: "list",
      items: names.map((n, i) => ({
        t: "props",
        pairs: [
          { key: sym("name"), value: sym(n) },
          { key: sym("tileSet"), value: sym(tilesets[i]!) },
          { key: sym("displayScale"), value: int(1) },
        ],
      }) as LingoValue),
    };
    const mapProps: LingoValue = {
      t: "props",
      pairs: [
        { key: sym("mapSize"), value: pt(mapCols, mapRows) },
        { key: sym("roomSize"), value: pt(roomCols, roomRows) },
        { key: sym("startRoom"), value: pt(1, 1) },
        { key: sym("endRoom"), value: sym("none") },
        { key: sym("refreshRoomMapImage"), value: int(1) },
        { key: sym("roomMapScale"), value: { t: "float", v: 0.0625 } },
        { key: sym("roomEditScale"), value: int(1) },
        { key: sym("roomPlayScale"), value: int(1) },
        { key: sym("layerDefinitions"), value: layerDefs },
        { key: sym("rooms"), value: { t: "list", items: [] } },
      ],
    };
    const m = new EditorMap({ t: "props", pairs: [{ key: sym("map"), value: mapProps }] });
    for (let num = 1; num <= mapCols * mapRows; num++) m.addRoom(num); // dense blank grid
    return m;
  }

  // ── header ───────────────────────────────────────────────────────────────────
  get mapSize(): Vec2 { return asPoint(propGet(this.map, "mapSize")); }     // rooms grid (cols, rows)
  get roomSize(): Vec2 { return asPoint(propGet(this.map, "roomSize")); }   // tiles per room (cols, rows)
  get startRoom(): Vec2 { return asPoint(propGet(this.map, "startRoom")); }
  /** #endRoom is point(x,y) or the symbol #none */
  get endRoom(): Vec2 | null {
    const v = propGet(this.map, "endRoom");
    return v && v.t === "call" ? asPoint(v) : null;
  }

  get layerDefs(): LayerDef[] {
    return items(propGet(this.map, "layerDefinitions")).map((d) => ({
      name: asSymName(propGet(d, "name")),
      tileSet: asSymName(propGet(d, "tileSet")),
    }));
  }

  // ── rooms ────────────────────────────────────────────────────────────────────
  /** room #num values present, in file order */
  get roomNums(): number[] {
    return items(propGet(this.map, "rooms")).map((r) => asInt(propGet(r, "num")));
  }

  private roomValue(num: number): LingoValue | undefined {
    return items(propGet(this.map, "rooms")).find((r) => asInt(propGet(r, "num")) === num);
  }

  private layerValue(num: number, layerName: string): LingoValue | undefined {
    const room = this.roomValue(num);
    if (!room) return undefined;
    return items(propGet(room, "layers")).find((l) => asSymName(propGet(l, "name")) === layerName);
  }

  /** the raw rows list (#map) for a room+layer, or [] */
  private gridRows(num: number, layerName: string): LingoValue[] {
    const layer = this.layerValue(num, layerName);
    return items(propGet(layer, "map"));
  }

  /** read the whole tile grid for a room+layer as numbers (rows of indices) */
  grid(num: number, layerName: string): number[][] {
    return this.gridRows(num, layerName).map((row) => items(row).map((c) => asInt(c)));
  }

  tile(num: number, layerName: string, r: number, c: number): number | undefined {
    const rows = this.gridRows(num, layerName);
    const row = rows[r];
    if (!row || row.t !== "list") return undefined;
    const cell = row.items[c];
    return cell ? asInt(cell) : undefined;
  }

  /** set a single tile in place; returns the PREVIOUS index (for undo), or undefined if out of range */
  setTile(num: number, layerName: string, r: number, c: number, value: number): number | undefined {
    const rows = this.gridRows(num, layerName);
    const row = rows[r];
    if (!row || row.t !== "list") return undefined;
    const cell = row.items[c];
    if (cell === undefined) return undefined;
    const prev = asInt(cell);
    row.items[c] = int(value);
    return prev;
  }

  // ── structural edits ───────────────────────────────────────────────────────────
  hasRoom(num: number): boolean { return this.roomNums.includes(num); }
  private point(x: number, y: number): LingoValue { return { t: "call", name: "point", args: [int(x), int(y)] }; }

  setStartRoom(x: number, y: number): void { propSet(this.map, "startRoom", this.point(x, y)); }
  /** set #endRoom to point(x,y) (the win room) or null → #none */
  setEndRoom(pos: Vec2 | null): void {
    propSet(this.map, "endRoom", pos ? this.point(pos.x, pos.y) : sym("none"));
  }

  /** append a fresh BLANK room — all layers filled with 0, exactly like the original's createBlank
   *  (objDataMap blankEntry = 0). The original editor never grass-fills a new room. */
  addRoom(num: number): void {
    if (this.hasRoom(num)) return;
    const { x: cols, y: rows } = this.roomSize;
    const blankGrid = (): LingoValue => ({
      t: "list",
      items: Array.from({ length: rows }, () => ({ t: "list", items: Array.from({ length: cols }, () => int(0)) }) as LingoValue),
    });
    const layers: LingoValue[] = this.layerDefs.map((d) => ({
      t: "props",
      pairs: [
        { key: sym("name"), value: sym(d.name) },
        { key: sym("map"), value: blankGrid() },
      ],
    }));
    const room: LingoValue = {
      t: "props",
      pairs: [
        { key: sym("num"), value: int(num) },
        { key: sym("layers"), value: { t: "list", items: layers } },
      ],
    };
    const roomsList = propGet(this.map, "rooms");
    if (roomsList && roomsList.t === "list") roomsList.items.push(room);
  }

  removeRoom(num: number): void {
    const roomsList = propGet(this.map, "rooms");
    if (!roomsList || roomsList.t !== "list") return;
    const i = roomsList.items.findIndex((r) => asInt(propGet(r, "num")) === num);
    if (i >= 0) roomsList.items.splice(i, 1);
  }

  // ── resize ───────────────────────────────────────────────────────────────────
  /** change #mapSize, keeping each existing room at its (x,y) grid position (renumbered), dropping rooms
   *  outside the new grid and adding blank rooms for new cells (stays dense). */
  setMapSize(newCols: number, newRows: number): void {
    const old = this.mapSize;
    const roomsList = propGet(this.map, "rooms");
    if (!roomsList || roomsList.t !== "list") return;
    const byPos = new Map<string, LingoValue>();
    for (const room of roomsList.items) {
      const num = asInt(propGet(room, "num"));
      const x = ((num - 1) % old.x) + 1, y = Math.floor((num - 1) / old.x) + 1;
      byPos.set(`${x},${y}`, room);
    }
    propSet(this.map, "mapSize", pt(newCols, newRows));
    const kept: LingoValue[] = [];
    for (let y = 1; y <= newRows; y++) {
      for (let x = 1; x <= newCols; x++) {
        const existing = byPos.get(`${x},${y}`);
        if (existing) { propSet(existing, "num", int((y - 1) * newCols + x)); kept.push(existing); }
      }
    }
    roomsList.items = kept;
    for (let num = 1; num <= newCols * newRows; num++) if (!this.hasRoom(num)) this.addRoom(num); // densify
  }

  /** change #roomSize, padding (with 0) or cropping every layer grid of every room to fit. */
  setRoomSize(newCols: number, newRows: number): void {
    propSet(this.map, "roomSize", pt(newCols, newRows));
    const roomsList = propGet(this.map, "rooms");
    if (!roomsList || roomsList.t !== "list") return;
    for (const room of roomsList.items) {
      const layers = propGet(room, "layers");
      if (!layers || layers.t !== "list") continue;
      for (const layer of layers.items) {
        const grid = propGet(layer, "map");
        if (!grid || grid.t !== "list") continue;
        if (grid.items.length > newRows) grid.items.length = newRows; // crop rows
        for (const row of grid.items) {
          if (row.t !== "list") continue;
          if (row.items.length > newCols) row.items.length = newCols; // crop cols
          while (row.items.length < newCols) row.items.push(int(0)); // pad cols
        }
        while (grid.items.length < newRows) grid.items.push({ t: "list", items: Array.from({ length: newCols }, () => int(0)) }); // pad rows
      }
    }
  }

  // ── changeKeySet: swap a layer's tileset + remap its tiles across every room ──────
  /** rewrite a layer's #tileSet symbol in #layerDefinitions (pass the name WITHOUT the leading '#'). */
  setLayerTileset(layerName: string, tileSetName: string): void {
    const defs = propGet(this.map, "layerDefinitions");
    if (!defs || defs.t !== "list") return;
    for (const d of defs.items) {
      if (asSymName(propGet(d, "name")) === layerName) propSet(d, "tileSet", sym(tileSetName));
    }
  }

  /** apply an index remap to every tile of a layer across ALL rooms (objMap.setCurrentEditLayerTileSet). */
  remapLayer(layerName: string, remap: (oldIdx: number) => number): void {
    for (const num of this.roomNums) {
      for (const row of this.gridRows(num, layerName)) {
        if (row.t !== "list") continue;
        for (let i = 0; i < row.items.length; i++) row.items[i] = int(remap(asInt(row.items[i])));
      }
    }
  }
}

export { sym, int };
