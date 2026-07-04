// The editor core: renders the active room onto a canvas (reusing the game's tilesets + drawTileLayer),
// draws a tile palette from the active layer's tileset, and applies paint/erase/eyedropper edits to the
// EditorMap (which mutates the underlying Lingo value, so save() round-trips). Phase 1 scope; fill/rect and
// full undo history are layered on in tools.ts later.

import type { Assets } from "../render/assets";
import { Renderer, type TileSheet } from "../render/renderer";
import type { Layer } from "../world/map";
import { tileSymbol, type TileKey } from "../data/tlk";
import { EditorMap, type Vec2 } from "./mapModel";
import { floodRegion, rectRegion } from "./tools";

// brush + grab are the original editor's two tools (objBrushTool / objGrabberTool); the rest are additions.
export type Tool = "paint" | "grab" | "erase" | "eyedropper" | "fill" | "rect";

export interface EditorOpts {
  mapCanvas: HTMLCanvasElement;
  paletteCanvas: HTMLCanvasElement;
  minimapCanvas: HTMLCanvasElement;
  assets: Assets;
  map: EditorMap;
  mapId: string;
  tileKeys?: Record<string, TileKey>; // tileset symbol → its parsed key (symbol↔index), for labels + remap
  scale?: number;
  onChange?: () => void;          // fired after any edit (so the shell can mark "unsaved")
  onRoom?: (num: number) => void; // fired when the active room changes (e.g. via the minimap)
  onStructure?: () => void;       // fired when rooms are added/removed (so the shell rebuilds the room list)
  onZoom?: (z: number) => void;   // fired when the display scale changes (so the shell shows the %)
  onTool?: (tool: Tool) => void;  // fired when the active tool changes (e.g. grabber → brush)
}

const MINI_TILE = 3;  // px per map-tile in a minimap room thumbnail
const MINI_GAP = 2;   // px between room thumbnails

interface UndoEntry { room: number; layer: string; r: number; c: number; prev: number }
// one undoable action: a tile stroke/fill/rect (cheap per-cell diff) OR a full-map snapshot for the
// coarse structural edits (resize / add-delete room / tileset swap / start-end), restored by re-parsing.
type UndoItem =
  | { kind: "tiles"; batch: UndoEntry[] }
  | { kind: "snap"; text: string; room: number; layer: string };

export class EditorApp {
  map: EditorMap;       // mutable: New-map swaps it; resize mutates it in place
  mapId: string;
  private assets: Assets;
  private tileKeys: Record<string, TileKey>;
  private renderer: Renderer;
  private pal: CanvasRenderingContext2D;
  private paletteCanvas: HTMLCanvasElement;
  private mini: CanvasRenderingContext2D;
  private miniCanvas: HTMLCanvasElement;
  private scale: number;
  private zoom = 2; // adjustableDisplayScale: the room view's CSS magnification (internal res stays crisp)
  private onChange?: () => void;
  private onRoom?: (num: number) => void;
  private onStructure?: () => void;
  private onZoom?: (z: number) => void;
  private onTool?: (tool: Tool) => void;

  room: number;
  layerName: string;
  // The original brush (objBrushTool) is a multi-tile RECTANGULAR pattern: select a tile range in the
  // palette → a 2D array of indices, stamped anchored at the top-left of the clicked cell (objRoom
  // .setTilesBrush). brush[row][col]; 1×1 by default.
  brush: number[][] = [[1]];
  private palSel: { x0: number; y0: number; x1: number; y1: number } | null = null; // palette drag-select (tile coords)
  tool: Tool = "paint";
  private hover: { r: number; c: number } | null = null;
  private painting = false;
  private rectStart: { r: number; c: number } | null = null;
  private undoStack: UndoItem[] = []; // each item is ONE user action (tile stroke/fill/rect or structural)
  private batch: UndoEntry[] | null = null;
  private dirty = false;

  constructor(o: EditorOpts) {
    this.map = o.map;
    this.mapId = o.mapId;
    this.assets = o.assets;
    this.tileKeys = o.tileKeys ?? {};
    this.scale = o.scale ?? 2;
    this.zoom = this.scale;
    this.onChange = o.onChange;
    this.paletteCanvas = o.paletteCanvas;

    const { x: cols, y: rows } = this.map.roomSize;
    const t = this.tilePx();
    this.renderer = new Renderer(o.mapCanvas, cols * t, rows * t, this.scale);
    const pctx = this.paletteCanvas.getContext("2d");
    if (!pctx) throw new Error("editor: no palette 2d context");
    pctx.imageSmoothingEnabled = false;
    this.pal = pctx;

    this.miniCanvas = o.minimapCanvas;
    const mctx = this.miniCanvas.getContext("2d");
    if (!mctx) throw new Error("editor: no minimap 2d context");
    mctx.imageSmoothingEnabled = false;
    this.mini = mctx;
    this.onRoom = o.onRoom;
    this.onStructure = o.onStructure;
    this.onZoom = o.onZoom;
    this.onTool = o.onTool;

    this.room = this.map.roomNums[0] ?? 1;
    this.layerName = this.map.layerDefs[0]?.name ?? "backgroundPassive";

    this.wireMapCanvas(o.mapCanvas);
    this.wirePalette();
    this.wireMinimap();
  }

  /** room number at grid (x,y), 1-based row-major — matches the game's roomAt. */
  roomNumAt(x: number, y: number): number { return (y - 1) * this.map.mapSize.x + x; }
  /** grid (x,y) of a room number (inverse of roomNumAt) */
  gridPosOf(num: number): { x: number; y: number } {
    const cols = this.map.mapSize.x;
    return { x: ((num - 1) % cols) + 1, y: Math.floor((num - 1) / cols) + 1 };
  }

  /** snapshot the whole map BEFORE a structural edit, so it's undoable. */
  private snapshot(): void {
    this.undoStack.push({ kind: "snap", text: this.map.serialize(), room: this.room, layer: this.layerName });
  }
  /** mark a non-tile (structural/header) change: dirty + redraw. (snapshot() captured the prior state.) */
  private structuralEdit(): void { this.dirty = true; this.onChange?.(); this.redraw(); }

  setStartHere(): void { this.snapshot(); const p = this.gridPosOf(this.room); this.map.setStartRoom(p.x, p.y); this.structuralEdit(); }
  setEndHere(): void { this.snapshot(); const p = this.gridPosOf(this.room); this.map.setEndRoom(p); this.structuralEdit(); }
  clearEnd(): void { this.snapshot(); this.map.setEndRoom(null); this.structuralEdit(); }

  /** add a room at grid (x,y) and jump to it (or just jump if one's already there). */
  addRoomAt(x: number, y: number): void {
    if (x < 1 || y < 1 || x > this.map.mapSize.x || y > this.map.mapSize.y) return;
    const num = this.roomNumAt(x, y);
    if (this.map.hasRoom(num)) { this.setRoom(num); return; }
    this.snapshot();
    this.map.addRoom(num);
    this.room = num; this.onRoom?.(num);
    this.structuralEdit();
    this.onStructure?.();
  }

  /** delete the current room (keeps at least one) and jump to the first remaining. */
  deleteRoom(): void {
    if (this.map.roomNums.length <= 1) return;
    this.snapshot();
    this.map.removeRoom(this.room);
    this.room = this.map.roomNums[0]!; this.onRoom?.(this.room);
    this.structuralEdit();
    this.onStructure?.();
  }

  get isDirty(): boolean { return this.dirty; }
  get layerNames(): string[] { return this.map.layerDefs.map((d) => d.name); }
  /** single-tile view of the brush (setter makes a 1×1 brush) — eyedropper / single-click / tests. */
  get selectedTile(): number { return this.brush[0]?.[0] ?? 0; }
  set selectedTile(v: number) { this.brush = [[v]]; }
  get brushW(): number { return this.brush[0]?.length ?? 1; }
  get brushH(): number { return this.brush.length; }

  // ── tilesets ──────────────────────────────────────────────────────────────────
  private tilesetMeta(layerName: string) {
    const def = this.map.layerDefs.find((d) => d.name === layerName);
    if (!def) return undefined;
    return this.assets.index.tilesets["#" + def.tileSet]; // tileset keys carry the leading '#'
  }
  private tilePx(): number { return this.tilesetMeta(this.map.layerDefs[0]!.name)?.tile ?? 32; }
  /** the symbol name (e.g. "#warrior") for a tile index in a layer, via that layer's tileset key. */
  tileLabel(layerName: string, n: number): string {
    if (n <= 0) return "";
    const def = this.map.layerDefs.find((d) => d.name === layerName);
    const key = def && this.tileKeys["#" + def.tileSet];
    return key ? tileSymbol(key, n) : "";
  }
  private sheetFor(layerName: string): TileSheet | undefined {
    const ts = this.tilesetMeta(layerName);
    if (!ts) return undefined;
    const img = this.assets.img(ts.file);
    return img ? { img, cols: ts.cols, tile: ts.tile } : undefined;
  }
  private asLayer(layerName: string): Layer {
    return { name: layerName, tileSet: "", grid: this.map.grid(this.room, layerName) };
  }

  // ── render ──────────────────────────────────────────────────────────────────
  render(): void {
    const t = this.tilePx();
    const ctx = this.renderer.ctx;
    this.renderer.clear();
    ctx.fillStyle = "#2b2b2b";
    ctx.fillRect(0, 0, this.renderer.viewW, this.renderer.viewH);

    const defs = this.map.layerDefs;
    const activeIdx = defs.findIndex((d) => d.name === this.layerName);
    defs.forEach((d, i) => {
      const sheet = this.sheetFor(d.name);
      if (!sheet) return;
      // layers ABOVE the one you're editing are ghosted so you can see what you paint.
      // Match the original objRoom front-layer blend: pFrontLayerBlendLevel = 128/256 ≈ 0.5.
      const alpha = i <= activeIdx ? 1 : 0.5;
      this.renderer.drawTileLayer(this.asLayer(d.name), sheet, 0, 0, alpha);
    });

    // grid overlay
    const { x: cols, y: rows } = this.map.roomSize;
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    for (let c = 0; c <= cols; c++) { ctx.beginPath(); ctx.moveTo(c * t, 0); ctx.lineTo(c * t, rows * t); ctx.stroke(); }
    for (let r = 0; r <= rows; r++) { ctx.beginPath(); ctx.moveTo(0, r * t); ctx.lineTo(cols * t, r * t); ctx.stroke(); }

    // rect/grab-tool drag preview (rect = cyan fill, grab = green marquee)
    if ((this.tool === "rect" || this.tool === "grab") && this.rectStart && this.hover) {
      const r0 = Math.min(this.rectStart.r, this.hover.r), r1 = Math.max(this.rectStart.r, this.hover.r);
      const c0 = Math.min(this.rectStart.c, this.hover.c), c1 = Math.max(this.rectStart.c, this.hover.c);
      const grab = this.tool === "grab";
      ctx.fillStyle = grab ? "rgba(80,255,120,0.15)" : "rgba(0,255,255,0.18)";
      ctx.fillRect(c0 * t, r0 * t, (c1 - c0 + 1) * t, (r1 - r0 + 1) * t);
      ctx.strokeStyle = grab ? "#5f5" : "#0ff"; ctx.lineWidth = 2;
      ctx.strokeRect(c0 * t + 1, r0 * t + 1, (c1 - c0 + 1) * t - 2, (r1 - r0 + 1) * t - 2);
    } else if (this.hover) {
      // hover highlight — paint/erase show the brush W×H footprint; other tools a single cell
      const isBrush = this.tool === "paint" || this.tool === "erase";
      const w = isBrush ? this.brushW : 1, h = isBrush ? this.brushH : 1;
      ctx.strokeStyle = this.tool === "erase" ? "#f55" : "#ff0";
      ctx.lineWidth = 2;
      ctx.strokeRect(this.hover.c * t + 1, this.hover.r * t + 1, w * t - 2, h * t - 2);
    }

    // hover readout (cell coords + the tile index there) — bottom-left chip
    if (this.hover) {
      const idx = this.map.tile(this.room, this.layerName, this.hover.r, this.hover.c);
      const sym = idx ? this.tileLabel(this.layerName, idx) : "";
      const label = `r${this.hover.r} c${this.hover.c} = ${idx ?? "·"}` + (sym && sym !== "#none" ? "  " + sym : "");
      ctx.font = "10px monospace"; ctx.textAlign = "left";
      const w = ctx.measureText(label).width + 8;
      ctx.fillStyle = "rgba(0,0,0,0.65)"; ctx.fillRect(2, this.renderer.viewH - 15, w, 13);
      ctx.fillStyle = "#bfb"; ctx.fillText(label, 6, this.renderer.viewH - 5);
    }
  }

  renderPalette(): void {
    const ts = this.tilesetMeta(this.layerName);
    const pc = this.paletteCanvas;
    const ctx = this.pal;
    if (!ts) { ctx.clearRect(0, 0, pc.width, pc.height); return; }
    const img = this.assets.img(ts.file);
    pc.width = ts.w; pc.height = ts.h;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, pc.width, pc.height);
    ctx.fillStyle = "#111"; ctx.fillRect(0, 0, pc.width, pc.height);
    if (img) ctx.drawImage(img as CanvasImageSource, 0, 0);
    // highlight the selected tile RANGE (the brush footprint in the palette)
    let hx0: number, hy0: number, hx1: number, hy1: number;
    if (this.palSel) {
      hx0 = Math.min(this.palSel.x0, this.palSel.x1); hx1 = Math.max(this.palSel.x0, this.palSel.x1);
      hy0 = Math.min(this.palSel.y0, this.palSel.y1); hy1 = Math.max(this.palSel.y0, this.palSel.y1);
    } else if (this.selectedTile > 0) {
      const p = this.selectedTile - 1; hx0 = hx1 = p % ts.cols; hy0 = hy1 = Math.floor(p / ts.cols);
    } else { return; }
    ctx.strokeStyle = "#ff0"; ctx.lineWidth = 2;
    ctx.strokeRect(hx0 * ts.tile + 1, hy0 * ts.tile + 1, (hx1 - hx0 + 1) * ts.tile - 2, (hy1 - hy0 + 1) * ts.tile - 2);
  }

  redraw(): void { this.render(); this.renderPalette(); this.renderMinimap(); }

  // ── minimap (room navigator with thumbnails) ──────────────────────────────────
  private drawRoomThumb(ctx: CanvasRenderingContext2D, num: number, ox: number, oy: number): void {
    for (const d of this.map.layerDefs) {
      if (d.name === "objects") continue; // a cleaner thumbnail from the two background layers
      const sheet = this.sheetFor(d.name);
      if (!sheet) continue;
      const grid = this.map.grid(num, d.name);
      for (let r = 0; r < grid.length; r++) {
        const row = grid[r]!;
        for (let c = 0; c < row.length; c++) {
          const n = row[c]!;
          if (n <= 0) continue;
          const sx = ((n - 1) % sheet.cols) * sheet.tile, sy = Math.floor((n - 1) / sheet.cols) * sheet.tile;
          ctx.drawImage(sheet.img as CanvasImageSource, sx, sy, sheet.tile, sheet.tile,
            ox + c * MINI_TILE, oy + r * MINI_TILE, MINI_TILE, MINI_TILE);
        }
      }
    }
  }

  renderMinimap(): void {
    const { x: cols, y: rows } = this.map.mapSize;
    const rw = this.map.roomSize.x * MINI_TILE, rh = this.map.roomSize.y * MINI_TILE;
    const W = cols * (rw + MINI_GAP) + MINI_GAP, H = rows * (rh + MINI_GAP) + MINI_GAP;
    this.miniCanvas.width = W; this.miniCanvas.height = H;
    const ctx = this.mini;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#0d0d0d"; ctx.fillRect(0, 0, W, H);
    const roomSet = new Set(this.map.roomNums);
    const start = this.map.startRoom;
    const end = this.map.endRoom;
    const tag = (ctx2: CanvasRenderingContext2D, ox: number, oy: number, ch: string, color: string) => {
      ctx2.fillStyle = color; ctx2.font = "bold 8px monospace"; ctx2.textAlign = "left"; ctx2.textBaseline = "top";
      ctx2.fillText(ch, ox + 2, oy + 2);
    };
    for (let y = 1; y <= rows; y++) {
      for (let x = 1; x <= cols; x++) {
        const num = this.roomNumAt(x, y);
        const ox = MINI_GAP + (x - 1) * (rw + MINI_GAP), oy = MINI_GAP + (y - 1) * (rh + MINI_GAP);
        if (roomSet.has(num)) this.drawRoomThumb(ctx, num, ox, oy);
        else { ctx.fillStyle = "#1c1c1c"; ctx.fillRect(ox, oy, rw, rh); }
        if (x === start.x && y === start.y) { ctx.strokeStyle = "#3f3"; ctx.lineWidth = 1; ctx.strokeRect(ox + 0.5, oy + 0.5, rw - 1, rh - 1); tag(ctx, ox, oy, "S", "#3f3"); }
        if (end && x === end.x && y === end.y) { ctx.strokeStyle = "#f55"; ctx.lineWidth = 1; ctx.strokeRect(ox + 0.5, oy + 0.5, rw - 1, rh - 1); tag(ctx, ox + rw - 9, oy, "E", "#f77"); }
        if (num === this.room) { ctx.strokeStyle = "#ff0"; ctx.lineWidth = 2; ctx.strokeRect(ox + 1, oy + 1, rw - 2, rh - 2); }
      }
    }
  }

  private wireMinimap(): void {
    this.miniCanvas.addEventListener("mousedown", (e) => {
      const rect = this.miniCanvas.getBoundingClientRect();
      const rw = this.map.roomSize.x * MINI_TILE, rh = this.map.roomSize.y * MINI_TILE;
      const cx = (e.clientX - rect.left) / rect.width * this.miniCanvas.width;
      const cy = (e.clientY - rect.top) / rect.height * this.miniCanvas.height;
      const x = Math.floor((cx - MINI_GAP) / (rw + MINI_GAP)) + 1;
      const y = Math.floor((cy - MINI_GAP) / (rh + MINI_GAP)) + 1;
      if (x < 1 || y < 1 || x > this.map.mapSize.x || y > this.map.mapSize.y) return;
      const num = this.roomNumAt(x, y);
      if (this.map.roomNums.includes(num)) this.setRoom(num);
      else this.addRoomAt(x, y); // clicking an empty grid cell creates a room there
    });
  }

  // ── editing ──────────────────────────────────────────────────────────────────
  get zoomLevel(): number { return this.zoom; }
  /** adjustableDisplayScale: magnify the room view (CSS only; the internal resolution stays crisp). */
  setZoom(z: number): void {
    this.zoom = Math.max(1, Math.min(6, Math.round(z)));
    const c = this.renderer.canvas;
    c.style.width = `${this.renderer.viewW * this.zoom}px`;
    c.style.height = `${this.renderer.viewH * this.zoom}px`;
    this.onZoom?.(this.zoom);
  }

  // ── new map / resize ─────────────────────────────────────────────────────────
  private rebuildRenderer(): void {
    const { x: cols, y: rows } = this.map.roomSize;
    const t = this.tilePx();
    this.renderer = new Renderer(this.renderer.canvas, cols * t, rows * t, this.zoom);
  }

  /** resize every room's tile grids (#roomSize), padding with 0 / cropping; rebuilds the canvas. */
  resizeRoom(cols: number, rows: number): void {
    this.snapshot();
    this.map.setRoomSize(cols, rows);
    this.rebuildRenderer();
    this.dirty = true; this.onChange?.();
    this.redraw();
  }

  /** resize the room grid (#mapSize), renumbering rooms by position and densifying. */
  resizeMap(cols: number, rows: number): void {
    this.snapshot();
    this.map.setMapSize(cols, rows);
    if (!this.map.hasRoom(this.room)) this.room = this.map.roomNums[0] ?? 1;
    this.dirty = true; this.onChange?.();
    this.onRoom?.(this.room); this.onStructure?.();
    this.redraw();
  }

  /** swap in a freshly-built blank map (New Map), with a #player spawn marker at the start room centre. */
  newBlankMap(mapCols: number, mapRows: number, roomCols: number, roomRows: number): void {
    this.replaceMap(EditorMap.createBlank(mapCols, mapRows, roomCols, roomRows), "untitled");
    const objDef = this.map.layerDefs.find((d) => d.name === "objects");
    const key = objDef && this.tileKeys["#" + objDef.tileSet];
    const playerIdx = key ? key.symbols.indexOf("#player") + 1 : 0; // symbol→1-based index
    if (playerIdx > 0) {
      const startNum = this.roomNumAt(this.map.startRoom.x, this.map.startRoom.y);
      this.map.setTile(startNum, "objects", Math.floor(roomRows / 2), Math.floor(roomCols / 2), playerIdx);
      this.redraw();
    }
  }

  private replaceMap(newMap: EditorMap, newId?: string): void {
    this.map = newMap;
    if (newId) this.mapId = newId;
    this.rebuildRenderer();
    this.room = newMap.roomNums[0] ?? 1;
    this.layerName = newMap.layerDefs[0]?.name ?? "backgroundPassive";
    this.undoStack = []; this.batch = null; this.dirty = false;
    this.onRoom?.(this.room); this.onStructure?.();
    this.redraw();
  }

  setRoom(num: number): void { this.room = num; this.onRoom?.(num); this.redraw(); }
  setLayer(name: string): void { this.layerName = name; this.redraw(); }
  setTool(tool: Tool): void { this.tool = tool; this.onTool?.(tool); }

  // ── changeKeySet: swap the active layer's tileset, remapping tiles by symbol ──────────
  /** tileset symbols (with '#') compatible with a layer — same Passive/Active/Objects category. */
  tilesetsForLayer(layerName: string): string[] {
    const l = layerName.toLowerCase();
    const cat = l.includes("passive") ? "passive" : l.includes("active") ? "active" : l.includes("object") ? "objects" : "";
    if (!cat) return [];
    return Object.keys(this.assets.index.tilesets).filter((s) => s.toLowerCase().endsWith(cat));
  }
  currentLayerTileset(): string {
    const def = this.map.layerDefs.find((d) => d.name === this.layerName);
    return def ? "#" + def.tileSet : "";
  }

  /** objMap.setCurrentEditLayerTileSet: swap `layerName`'s tileset to `newSym` (with '#') and remap every
   *  room's tiles by their symbol — a tile keeps its identity if the new set has the same symbol, else 0. */
  changeLayerTileset(layerName: string, newSym: string): void {
    const def = this.map.layerDefs.find((d) => d.name === layerName);
    if (!def || "#" + def.tileSet === newSym) return;
    this.snapshot();
    const oldKey = this.tileKeys["#" + def.tileSet];
    const newKey = this.tileKeys[newSym];
    if (oldKey && newKey) {
      const symToNew = new Map<string, number>();
      newKey.symbols.forEach((s, i) => { if (s !== "#none" && !symToNew.has(s)) symToNew.set(s, i + 1); });
      this.map.remapLayer(layerName, (oldIdx) => {
        if (oldIdx <= 0) return 0;
        const s = tileSymbol(oldKey, oldIdx);
        // No symbol (terrain — passive/active keys are symbol-less) → KEEP the index and just re-theme,
        // exactly like the original's `if tileDef = 0 then setTile(tileVal)`. A real symbol (objects:
        // #warrior, …) → the same symbol's index in the new set, or 0 if the new set lacks it.
        if (s === "#none") return oldIdx;
        return symToNew.get(s) ?? 0;
      });
    }
    this.map.setLayerTileset(layerName, newSym.replace(/^#/, ""));
    this.dirty = true; this.onChange?.();
    this.redraw();
  }

  private paintValue(): number { return this.tool === "erase" ? 0 : this.selectedTile; }

  /** write one cell into the OPEN batch (no commit); returns true if it actually changed */
  private editCell(r: number, c: number, value: number): boolean {
    const prev = this.map.setTile(this.room, this.layerName, r, c, value);
    if (prev === undefined || prev === value) return false;
    this.batch?.push({ room: this.room, layer: this.layerName, r, c, prev });
    return true;
  }

  /** stamp the brush pattern (objRoom.setTilesBrush) anchored top-left at (r,c); erase stamps 0s. */
  private stampAt(r: number, c: number): boolean {
    let changed = false;
    const erase = this.tool === "erase";
    for (let py = 0; py < this.brush.length; py++) {
      const prow = this.brush[py]!;
      for (let px = 0; px < prow.length; px++) {
        if (this.editCell(r + py, c + px, erase ? 0 : prow[px]!)) changed = true;
      }
    }
    return changed;
  }

  private beginBatch(): void { this.batch = []; }
  private commitBatch(): void {
    if (this.batch && this.batch.length) { this.undoStack.push({ kind: "tiles", batch: this.batch }); this.dirty = true; this.onChange?.(); }
    this.batch = null;
  }

  private pick(r: number, c: number): void {
    const v = this.map.tile(this.room, this.layerName, r, c);
    if (v !== undefined) { this.selectedTile = v; this.palSel = null; this.renderPalette(); } // 1×1 brush
  }

  /** objGrabberTool: marquee a rectangle ON THE ROOM, grab those tiles as the multi-tile brush, then flip
   *  back to the brush so you can rubber-stamp the grabbed patch elsewhere. */
  private grabRegion(r0: number, c0: number, r1: number, c1: number): void {
    const R0 = Math.min(r0, r1), R1 = Math.max(r0, r1), C0 = Math.min(c0, c1), C1 = Math.max(c0, c1);
    const pat: number[][] = [];
    for (let r = R0; r <= R1; r++) {
      const row: number[] = [];
      for (let c = C0; c <= C1; c++) row.push(this.map.tile(this.room, this.layerName, r, c) ?? 0);
      pat.push(row);
    }
    this.brush = pat;
    this.palSel = null;
    this.setTool("paint"); // grabber returns to the brush after grabbing
    this.renderPalette();
  }

  private floodAt(r: number, c: number, value: number): void {
    for (const [rr, cc] of floodRegion(this.map.grid(this.room, this.layerName), r, c)) this.editCell(rr, cc, value);
  }
  private rectAt(r0: number, c0: number, r1: number, c1: number, value: number): void {
    for (const [rr, cc] of rectRegion(r0, c0, r1, c1)) this.editCell(rr, cc, value);
  }

  undo(): void {
    const item = this.undoStack.pop();
    if (!item) return;
    if (item.kind === "tiles") {
      for (let i = item.batch.length - 1; i >= 0; i--) {
        const e = item.batch[i]!;
        this.map.setTile(e.room, e.layer, e.r, e.c, e.prev);
        this.room = e.room; this.layerName = e.layer;
      }
    } else {
      // structural undo: re-parse the snapshot and swap the map back in (rebuilds the renderer/dropdowns).
      this.map = EditorMap.load(item.text);
      this.rebuildRenderer();
      this.room = this.map.hasRoom(item.room) ? item.room : (this.map.roomNums[0] ?? 1);
      this.layerName = item.layer;
      this.onRoom?.(this.room); this.onStructure?.();
    }
    this.dirty = this.undoStack.length > 0;
    this.onChange?.();
    this.redraw();
  }

  markSaved(): void { this.dirty = false; }
  serialize(): string { return this.map.serialize(); }
  /** manifest metadata so a saved map is game-loadable by id (matches the maps.json entry shape). */
  mapMeta(): { name: string; roomSize: Vec2; mapSize: Vec2; tilesets: string[] } {
    return {
      name: this.mapId,
      roomSize: this.map.roomSize,
      mapSize: this.map.mapSize,
      tilesets: this.map.layerDefs.map((d) => "#" + d.tileSet),
    };
  }

  // ── input wiring ──────────────────────────────────────────────────────────────
  private cellFromEvent(canvas: HTMLCanvasElement, e: MouseEvent): { r: number; c: number } | null {
    const rect = canvas.getBoundingClientRect();
    const t = this.tilePx();
    const c = Math.floor(((e.clientX - rect.left) / rect.width) * this.map.roomSize.x);
    const r = Math.floor(((e.clientY - rect.top) / rect.height) * this.map.roomSize.y);
    if (c < 0 || r < 0 || c >= this.map.roomSize.x || r >= this.map.roomSize.y) return null;
    void t;
    return { r, c };
  }

  private isStroke(): boolean { return this.tool === "paint" || this.tool === "erase"; }

  private wireMapCanvas(canvas: HTMLCanvasElement): void {
    canvas.addEventListener("mousedown", (e) => {
      const cell = this.cellFromEvent(canvas, e);
      if (!cell) return;
      if (this.tool === "eyedropper") { this.pick(cell.r, cell.c); return; }
      if (this.tool === "fill") {
        this.beginBatch(); this.floodAt(cell.r, cell.c, this.paintValue()); this.commitBatch(); this.render(); return;
      }
      if (this.tool === "rect" || this.tool === "grab") { this.rectStart = cell; this.painting = true; this.render(); return; }
      // paint / erase: open a stroke batch and stamp the brush at the first cell
      this.painting = true; this.beginBatch(); this.stampAt(cell.r, cell.c); this.render();
    });
    canvas.addEventListener("mousemove", (e) => {
      const cell = this.cellFromEvent(canvas, e);
      this.hover = cell;
      if (this.painting && cell && this.isStroke()) this.stampAt(cell.r, cell.c);
      this.render(); // also draws the rect preview + hover readout
    });
    canvas.addEventListener("mouseup", () => {
      if (this.tool === "grab" && this.rectStart && this.hover) {
        this.grabRegion(this.rectStart.r, this.rectStart.c, this.hover.r, this.hover.c);
      } else if (this.tool === "rect" && this.rectStart && this.hover) {
        this.beginBatch();
        this.rectAt(this.rectStart.r, this.rectStart.c, this.hover.r, this.hover.c, this.paintValue());
        this.commitBatch();
      } else if (this.isStroke()) {
        this.commitBatch();
      }
      this.painting = false; this.rectStart = null; this.render();
    });
    canvas.addEventListener("mouseleave", () => {
      if (this.painting && this.isStroke()) this.commitBatch();
      this.painting = false; this.rectStart = null; this.hover = null; this.render();
    });
    canvas.addEventListener("wheel", (e) => {
      if (!e.ctrlKey) return; // ctrl+wheel zooms; plain wheel scrolls the surrounding container
      e.preventDefault();
      this.setZoom(this.zoom + (e.deltaY < 0 ? 1 : -1));
    }, { passive: false });
  }

  private palTileAt(e: MouseEvent): { x: number; y: number } | null {
    const ts = this.tilesetMeta(this.layerName);
    if (!ts) return null;
    const rect = this.paletteCanvas.getBoundingClientRect();
    const rows = Math.ceil(ts.h / ts.tile);
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * ts.cols);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * rows);
    if (x < 0 || y < 0 || x >= ts.cols || y >= rows) return null;
    return { x, y };
  }

  /** build the 2D brush pattern from a palette tile-range selection (objTileSet.calcTileNums). */
  private brushFromPaletteSel(sel: { x0: number; y0: number; x1: number; y1: number }): number[][] {
    const cols = this.tilesetMeta(this.layerName)?.cols ?? 1;
    const x0 = Math.min(sel.x0, sel.x1), x1 = Math.max(sel.x0, sel.x1);
    const y0 = Math.min(sel.y0, sel.y1), y1 = Math.max(sel.y0, sel.y1);
    const pat: number[][] = [];
    for (let y = y0; y <= y1; y++) {
      const row: number[] = [];
      for (let x = x0; x <= x1; x++) row.push(y * cols + x + 1); // sheet position -> tile index (+1; 0 = empty)
      pat.push(row);
    }
    return pat;
  }

  private wirePalette(): void {
    let dragging = false;
    this.paletteCanvas.addEventListener("mousedown", (e) => {
      const t = this.palTileAt(e); if (!t) return;
      dragging = true;
      this.palSel = { x0: t.x, y0: t.y, x1: t.x, y1: t.y };
      if (this.tool === "erase" || this.tool === "eyedropper") this.tool = "paint"; // selecting a tile implies painting
      this.renderPalette();
    });
    this.paletteCanvas.addEventListener("mousemove", (e) => {
      if (!dragging || !this.palSel) return;
      const t = this.palTileAt(e); if (!t) return;
      this.palSel.x1 = t.x; this.palSel.y1 = t.y;
      this.renderPalette();
    });
    const finish = () => {
      if (!dragging || !this.palSel) return;
      dragging = false;
      this.brush = this.brushFromPaletteSel(this.palSel); // 1×1 for a click, N×M for a drag
      this.renderPalette();
    };
    this.paletteCanvas.addEventListener("mouseup", finish);
    this.paletteCanvas.addEventListener("mouseleave", finish);
  }
}
