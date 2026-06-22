// Tile collision (objCollisionMap / objCollisionTile). The original derives a per-room collision map
// from the active layer: each cell is an objCollisionTile with a pTileType and four per-edge solidity
// flags, merged with neighbours (facing solid faces cancel) and corner-detected (anti-diagonal escape).
// A 4-corner "magic rect" broad-phase + per-axis push-out resolves a move and emits directional events.
//
// PORT STRATEGY (F2): the #solid-only path is GOLDEN-LOCKED (room-1 + collision_golden are all #solid/
// #none). So CollisionGrid keeps its original swept-AABB resolver BYTE-IDENTICAL for solid grids — the
// `solid` Uint8Array, set()/solidCell()/moveBox() are unchanged. The per-edge EdgeGrid model is layered
// ON TOP (derived edge masks + merge + corners) and only changes behaviour when a non-#solid tile type
// is present (none ship in the 47 maps; this is breadth for editor-authored maps). moveBox additionally
// returns a directional event set computed from the resolved collision; for solid grids only wall/ceiling
// events fire (matching checkCollisions), never platform/noPlatform.

import type { Layer } from "./map";
import { solidTileNums, tileTypeNums, type TileType, type TileKey } from "../data/tlk";

export interface OpenEdges { left: boolean; right: boolean; up: boolean; down: boolean; }

// Per-edge solidity bits (objCollisionTile.initCollisionEdge): a tile is one-way depending on its type.
export const EDGE_L = 1, EDGE_T = 2, EDGE_R = 4, EDGE_B = 8;
// Corner bits (objCollisionTile.identifyAsCornerTile): anti-diagonal escape guards.
export const CORNER_TL = 1, CORNER_TR = 2, CORNER_BR = 4, CORNER_BL = 8;

/** raw edge mask for a tile type, before neighbour merge (the A.1 per-edge table). */
function edgeMaskForType(t: TileType): number {
  switch (t) {
    case "#solid": return EDGE_L | EDGE_T | EDGE_R | EDGE_B;
    case "#platform": return EDGE_T;          // land from above only (top edge solid)
    case "#ceiling": return EDGE_B;           // block from below only (bottom edge solid)
    case "#wallLeft": return EDGE_L;          // block leftward motion only
    case "#wallRight": return EDGE_R;         // block rightward motion only
    case "#none": return 0;
  }
}

/** the directional collision events emitted by a move (checkCollisions 266-295). */
export interface MoveEvents {
  wallLeft?: boolean; wallRight?: boolean; ceiling?: boolean;
  platform?: boolean; noPlatform?: boolean;
}
export interface MoveResult { x: number; y: number; hitX: boolean; hitY: boolean; events: MoveEvents; }

export class CollisionGrid {
  readonly cols: number;
  readonly rows: number;
  readonly tilePx: number;
  private solid: Uint8Array;
  // per-edge model (derived). edges[i] = solidity mask (post-merge); type[i] = TileType ordinal.
  // Only populated for non-solid-only grids (built by fromActiveLayer); for hand-built solid grids the
  // edge model is kept in lockstep with `solid` via set(), so the typed path stays correct there too.
  private edges: Uint8Array;
  private corners: Uint8Array;
  private oneWayTop: Uint8Array;   // 1 where a #platform top edge is one-way (was-above-last-frame gate)
  private hasTypedTiles = false;   // true once any non-#solid collision tile was placed (typed path active)
  /** edges that lead to an adjacent room are passable (the player exits through them) */
  open: OpenEdges = { left: false, right: false, up: false, down: false };
  // Per-edge BILATERAL exit mask (objCollisionMap.openExits/insertExitTiles): the exit is carved only at the
  // doorway tiles where BOTH this room's edge cell AND the neighbour's facing cell are passable. Index runs
  // along the edge axis (rows for left/right, cols for up/down); 1 = a passable doorway cell. null = this
  // edge has no neighbour mask wired (fall back to this room's own edge-cell solidity). Set by the room on
  // setExits so collision crossing and the exit arrows derive from ONE source and cannot drift.
  exitMask: { left: Uint8Array | null; right: Uint8Array | null; up: Uint8Array | null; down: Uint8Array | null } =
    { left: null, right: null, up: null, down: null };

  constructor(cols: number, rows: number, tilePx: number) {
    this.cols = cols; this.rows = rows; this.tilePx = tilePx;
    this.solid = new Uint8Array(cols * rows);
    this.edges = new Uint8Array(cols * rows);
    this.corners = new Uint8Array(cols * rows);
    this.oneWayTop = new Uint8Array(cols * rows);
  }

  static fromActiveLayer(active: Layer, key: TileKey, tilePx: number): CollisionGrid {
    const rows = active.grid.length;
    const cols = active.grid[0]?.length ?? 0;
    const g = new CollisionGrid(cols, rows, tilePx);
    // tile-type map (objCollisionMap.initTiles): every collision-typed cell. #solid still drives the
    // golden swept-AABB path (set() marks it solid); other types only set their per-edge mask.
    const types = tileTypeNums(key);
    const solids = solidTileNums(key);
    for (let r = 0; r < rows; r++) {
      const row = active.grid[r]!;
      for (let c = 0; c < cols; c++) {
        const n = row[c] ?? 0;
        const t = types.get(n);
        if (!t) continue;
        if (t === "#solid") { g.set(c, r, true); }     // golden path: marks solid + all-4 edges
        else { g.setType(c, r, t); }                    // typed path: per-edge mask only
      }
    }
    if (g.hasTypedTiles) g.activate();
    void solids; // (kept import-parity; solidTileNums shim still used elsewhere)
    return g;
  }

  set(c: number, r: number, v: boolean): void {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return;
    const i = r * this.cols + c;
    this.solid[i] = v ? 1 : 0;
    // keep the edge model in lockstep: a solid cell has all four raw edges; clearing zeroes them.
    this.edges[i] = v ? (EDGE_L | EDGE_T | EDGE_R | EDGE_B) : 0;
    this.corners[i] = 0; this.oneWayTop[i] = 0;
  }

  // setType (objCollisionTile.setTileType): place a non-#solid collision tile by its per-edge mask.
  private setType(c: number, r: number, t: TileType): void {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return;
    const i = r * this.cols + c;
    this.edges[i] = edgeMaskForType(t);
    this.oneWayTop[i] = t === "#platform" ? 1 : 0;
    this.hasTypedTiles = true;
  }

  // raw type at a cell, inferred from its edge mask (for merge/corner neighbour checks).
  private rawMask(c: number, r: number): number {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return 0;
    return this.edges[r * this.cols + c]!;
  }
  private isSolidTile(c: number, r: number): boolean {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return false;
    return this.solid[r * this.cols + c] === 1;
  }
  private isPlatform(c: number, r: number): boolean {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return false;
    return this.oneWayTop[r * this.cols + c] === 1;
  }

  // activate (objCollisionMap.activateTiles): merge facing edges, then detect corner tiles. Built once
  // on room load; only runs when a typed (non-solid) tile is present (solid-only grids skip it — their
  // merge/corner state is irrelevant to the golden swept-AABB path).
  private activate(): void {
    this.mergeEdges();
    this.identifyCorners();
  }

  // mergeEdges (objCollisionTile.mergeEdges): two solid edges facing each other between adjacent tiles
  // both become non-solid (nothing can hit them). Walk #right and #bottom neighbours only. EXCEPTION:
  // keep #bottom solid when the tile below is a #platform (its top still needs the solid face above it).
  private mergeEdges(): void {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const i = r * this.cols + c;
        let m = this.edges[i]!;
        if (m === 0) continue;
        // right neighbour: my #right vs its #left
        if ((m & EDGE_R) && (this.rawMask(c + 1, r) & EDGE_L)) {
          m &= ~EDGE_R;
          this.edges[r * this.cols + (c + 1)]! &= ~EDGE_L;
        }
        // bottom neighbour: my #bottom vs its #top (unless the tile below is a platform)
        if ((m & EDGE_B) && (this.rawMask(c, r + 1) & EDGE_T) && !this.isPlatform(c, r + 1)) {
          m &= ~EDGE_B;
          this.edges[(r + 1) * this.cols + c]! &= ~EDGE_T;
        }
        this.edges[i] = m;
      }
    }
  }

  // identifyCorners (objCollisionTile.identifyAsCornerTile / calcSolidCorner): only #solid tiles can be
  // corners. For each non-solid edge of a solid tile, if BOTH meeting neighbour faces are solid the
  // diagonal corner is solid (stops a small box squeezing diagonally between two merged solids).
  private identifyCorners(): void {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.isSolidTile(c, r)) continue;
        const m = this.edges[r * this.cols + c]!;
        let cor = 0;
        // calcSolidCorner(vert, side): the corner is solid when the VERT neighbour's SIDE edge is solid
        // AND the SIDE neighbour's VERT edge is solid (the two faces meeting at the diagonal). Only checked
        // for the tile's non-solid edges (identifyAsCornerTile gathers those first).
        // topLeft: top-neighbour's LEFT edge & left-neighbour's TOP edge.
        if (!(m & EDGE_T) && !(m & EDGE_L) &&
            (this.rawMask(c, r - 1) & EDGE_L) && (this.rawMask(c - 1, r) & EDGE_T)) cor |= CORNER_TL;
        // topRight: top-neighbour's RIGHT edge & right-neighbour's TOP edge.
        if (!(m & EDGE_T) && !(m & EDGE_R) &&
            (this.rawMask(c, r - 1) & EDGE_R) && (this.rawMask(c + 1, r) & EDGE_T)) cor |= CORNER_TR;
        // bottomRight: bottom-neighbour's RIGHT edge & right-neighbour's BOTTOM edge.
        if (!(m & EDGE_B) && !(m & EDGE_R) &&
            (this.rawMask(c, r + 1) & EDGE_R) && (this.rawMask(c + 1, r) & EDGE_B)) cor |= CORNER_BR;
        // bottomLeft: bottom-neighbour's LEFT edge & left-neighbour's BOTTOM edge.
        if (!(m & EDGE_B) && !(m & EDGE_L) &&
            (this.rawMask(c, r + 1) & EDGE_L) && (this.rawMask(c - 1, r) & EDGE_B)) cor |= CORNER_BL;
        this.corners[r * this.cols + c] = cor;
      }
    }
  }

  /** Out-of-bounds is solid (2-tile border in the original) unless the edge is an open exit — and then
   *  ONLY at the doorway gap, not anywhere along the edge. objCollisionMap.openExits (insertExitTiles)
   *  carves passable (#none) only the specific EXIT TILES of the edge; the rest of the border stays #solid
   *  (closeExits = initMap re-solidifies the whole frame). So a player may leave only where THIS room's
   *  facing border cell is itself a gap — mirroring the exit-arrow run. Otherwise you could walk off the
   *  wall part of an open edge and reappear embedded in the next room's wall ("odd spot"). */
  solidCell(c: number, r: number): boolean {
    if (c < 0 || c >= this.cols) {
      const exit = c < 0 ? this.open.left : this.open.right;
      if (!exit || r < 0 || r >= this.rows) return true;          // closed edge / corner -> solid border
      const mask = c < 0 ? this.exitMask.left : this.exitMask.right;
      if (mask) return mask[r] !== 1;                             // open only at a bilateral doorway cell
      return this.solid[r * this.cols + (c < 0 ? 0 : this.cols - 1)] === 1; // fallback: this room's edge cell
    }
    if (r < 0 || r >= this.rows) {
      const exit = r < 0 ? this.open.up : this.open.down;
      if (!exit || c < 0 || c >= this.cols) return true;
      const mask = r < 0 ? this.exitMask.up : this.exitMask.down;
      if (mask) return mask[c] !== 1;
      return this.solid[(r < 0 ? 0 : this.rows - 1) * this.cols + c] === 1;
    }
    return this.solid[r * this.cols + c] === 1;
  }

  solidAtPx(px: number, py: number): boolean {
    return this.solidCell(Math.floor(px / this.tilePx), Math.floor(py / this.tilePx));
  }

  // K22 exit ranges: passability of an IN-BOUNDS edge cell as the exit-arrow scan sees it (getScreenExitsForEdge
  // → convertExitTilesToRangesEdge match #none). A cell is passable when it carries no solid collision tile —
  // the same `solid` array the resolver reads. (Edge open/closed state is the room's, not the cell's: an open
  // box with no edge walls is all-passable, so the whole edge is one range; a wall with a doorway gap yields a
  // range only at the gap.) Deliberately ignores `open`/out-of-bounds — callers pass in-range indices only.
  passableCell(c: number, r: number): boolean {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return false;
    return this.solid[r * this.cols + c] === 0;
  }

  private boxHits(x: number, y: number, w: number, h: number): boolean {
    const t = this.tilePx;
    const c0 = Math.floor(x / t), c1 = Math.floor((x + w - 1) / t);
    const r0 = Math.floor(y / t), r1 = Math.floor((y + h - 1) / t);
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++)
        if (this.solidCell(c, r)) return true;
    return false;
  }

  /** any solid cell in column c across rows r0..r1 */
  private colSolid(c: number, r0: number, r1: number): boolean {
    for (let r = r0; r <= r1; r++) if (this.solidCell(c, r)) return true;
    return false;
  }
  /** any solid cell in row r across cols c0..c1 */
  private rowSolid(r: number, c0: number, c1: number): boolean {
    for (let c = c0; c <= c1; c++) if (this.solidCell(c, r)) return true;
    return false;
  }

  /**
   * Axis-separated swept move of an AABB. On contact, snaps flush to the *blocking* tile's near face
   * (scanning for the first solid tile along the swept span). Returns {x,y,hitX,hitY} BYTE-IDENTICAL to
   * the original solid-only resolver (golden-locked), PLUS a directional event set:
   *  - axis-y blocked moving up (dy<0) -> ceiling; moving down (dy>0) onto a solid -> platform-land event
   *    is NOT fired by solid tiles (only #platform tiles fire platform/noPlatform — typed path);
   *  - axis-x blocked moving left (dx<0) -> wallLeft; right (dx>0) -> wallRight.
   * When non-#solid tile types are present, routes through the per-edge resolver (moveBoxTyped).
   *
   * `oldY` (the box's previous top) feeds the #platform "was-above-last-frame" one-way gate; callers
   * that don't track it may omit it (the gate then only blocks a strictly-downward mover, the common case).
   */
  moveBox(x: number, y: number, w: number, h: number, dx: number, dy: number, oldY?: number): MoveResult {
    if (this.hasTypedTiles) return this.moveBoxTyped(x, y, w, h, dx, dy, oldY);
    const t = this.tilePx;
    let nx = x, ny = y, hitX = false, hitY = false;
    const events: MoveEvents = {};
    if (dx !== 0) {
      const tryX = x + dx;
      if (this.boxHits(tryX, y, w, h)) {
        hitX = true;
        const r0 = Math.floor(y / t), r1 = Math.floor((y + h - 1) / t);
        if (dx > 0) {
          let blocked = Math.floor((tryX + w - 1) / t);
          for (let c = Math.floor((x + w) / t); c <= blocked; c++) { if (this.colSolid(c, r0, r1)) { blocked = c; break; } }
          nx = blocked * t - w;
          events.wallRight = true;
        } else {
          let blocked = Math.floor(tryX / t);
          for (let c = Math.floor((x + w - 1) / t); c >= blocked; c--) { if (this.colSolid(c, r0, r1)) { blocked = c; break; } }
          nx = (blocked + 1) * t;
          events.wallLeft = true;
        }
      } else nx = tryX;
    }
    if (dy !== 0) {
      const tryY = y + dy;
      if (this.boxHits(nx, tryY, w, h)) {
        hitY = true;
        const c0 = Math.floor(nx / t), c1 = Math.floor((nx + w - 1) / t);
        if (dy > 0) {
          let blocked = Math.floor((tryY + h - 1) / t);
          for (let r = Math.floor((y + h) / t); r <= blocked; r++) { if (this.rowSolid(r, c0, c1)) { blocked = r; break; } }
          ny = blocked * t - h;
          // a solid tile blocking a downward move is NOT a platform-land in the original (only #platform
          // tiles fire collisionPlatform); solid grids therefore emit no platform/noPlatform events.
        } else {
          let blocked = Math.floor(tryY / t);
          for (let r = Math.floor((y + h - 1) / t); r >= blocked; r--) { if (this.rowSolid(r, c0, c1)) { blocked = r; break; } }
          ny = (blocked + 1) * t;
          events.ceiling = true;
        }
      } else ny = tryY;
    }
    return { x: nx, y: ny, hitX, hitY, events };
  }

  // ── per-edge typed resolver (objCollisionMap.checkCollisions) ─────────────────────────────────────
  // Used when a non-#solid tile type is present. Picks the 4 corner tiles via the magic-rect broad-phase,
  // computes per-edge overlaps (only edges FACING the motion block), pushes out per axis, and emits the
  // directional events. One-way #platform uses the was-above-last-frame gate (oldY).
  private moveBoxTyped(x: number, y: number, w: number, h: number, dx: number, dy: number, oldY?: number): MoveResult {
    const dirX = Math.sign(dx), dirY = Math.sign(dy);
    const events: MoveEvents = {};
    let hitX = false, hitY = false;
    if (dx === 0 && dy === 0) return { x, y, hitX, hitY, events };

    let collisionPlatform = false;
    // resolve target box, then iterate selected tiles applying per-axis push-out (recomputing the box).
    // nx/ny track the (moved) box position; bx/by mirror them for the overlap math.
    let bx = x + dx, by = y + dy;
    let nx = bx, ny = by;
    const oldTop = oldY ?? y; // previous box top (for the platform one-way gate)

    for (const [tc, tr] of this.selectTiles(bx, by, w, h, dirX, dirY)) {
      const mask = this.cellEdges(tc, tr);
      const cor = (tc >= 0 && tr >= 0 && tc < this.cols && tr < this.rows) ? this.corners[tr * this.cols + tc]! : 0;
      if (mask === 0 && cor === 0) continue;
      const tileL = tc * this.tilePx - 1, tileT = tr * this.tilePx - 1;          // pStartOfTile (the -1,-1 fudge)
      const tileR = (tc + 1) * this.tilePx, tileB = (tr + 1) * this.tilePx;      // pEndOfTile

      // calcOverlapEdges: an edge only blocks when the box moves INTO its face.
      let oX: number | null = null, oY: number | null = null, both = false;
      const boxL = bx, boxT = by, boxR = bx + w, boxB = by + h;

      // #platform one-way gate (calcOverlapPlatform): a top edge only catches a downward mover whose
      // PREVIOUS box-bottom was at/above the top edge (so it was above the platform last frame).
      const topIsOneWay = this.isPlatformCell(tc, tr);
      const topGate = !topIsOneWay || (oldTop + h) <= tileT + 1;

      if ((mask & EDGE_L) && dirX === 1) oX = boxR - tileL;       // hit the tile's left face moving right
      if ((mask & EDGE_R) && dirX === -1) oX = boxL - tileR;      // hit its right face moving left
      if ((mask & EDGE_T) && dirY === 1 && topGate) oY = boxB - tileT; // land on its top moving down
      if ((mask & EDGE_B) && dirY === -1) oY = boxT - tileB;      // hit its bottom (ceiling) moving up

      // corner anti-diagonal (calcOverlapCorners): only when both axes are otherwise free and we move
      // diagonally toward the corner — push out both axes.
      if (cor && oX === null && oY === null) {
        if ((cor & CORNER_TL) && dirX === 1 && dirY === 1) { oY = boxB - tileT; oX = boxR - tileL; both = true; }
        else if ((cor & CORNER_TR) && dirX === -1 && dirY === 1) { oY = boxB - tileT; oX = boxL - tileR; both = true; }
        else if ((cor & CORNER_BR) && dirX === -1 && dirY === -1) { oY = boxT - tileB; oX = boxL - tileR; both = true; }
        else if ((cor & CORNER_BL) && dirX === 1 && dirY === -1) { oY = boxT - tileB; oX = boxR - tileL; both = true; }
      }

      if (oX === null && oY === null) continue;

      // decide which axis to change (checkCollisions 235-253).
      let axis: "x" | "y" | "both";
      if (both) axis = "both";
      else if (oX === null) axis = "y";
      else if (oY === null) axis = "x";
      else axis = (this.posAbs(oX) > this.posAbs(oY)) ? "y" : "x";

      if (axis === "both" || axis === "x") { nx -= oX!; bx -= oX!; hitX = true; }
      if (axis === "both" || axis === "y") { ny -= oY!; by -= oY!; hitY = true; }

      // emit the directional event for the axis we changed.
      if (axis === "y" || axis === "both") {
        if (oY! < 0) events.ceiling = true;
        else if (dirY === 1) { events.platform = true; collisionPlatform = true; }
      }
      if (axis === "x" || axis === "both") {
        if (oX! < 0) events.wallLeft = true;
        else if (dirX === 1) events.wallRight = true;
      }
    }
    // collisionNoPlatform: walked-off / nothing-underneath (dir down but never landed).
    if (dirY === 1 && !collisionPlatform) events.noPlatform = true;
    return { x: nx, y: ny, hitX, hitY, events };
  }

  private posAbs(v: number): number { return v < 0 ? 0 : v; } // PointPositive: negative overlaps -> 0

  // cellEdges: the merged edge mask for an in-bounds cell, OR the full solid frame for out-of-bounds
  // (the 2-tile border) unless that edge is an open exit (so the typed path keeps the border solid too).
  private cellEdges(c: number, r: number): number {
    if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) {
      return this.solidCell(c, r) ? (EDGE_L | EDGE_T | EDGE_R | EDGE_B) : 0;
    }
    return this.edges[r * this.cols + c]!;
  }
  private isPlatformCell(c: number, r: number): boolean {
    if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return false;
    return this.oneWayTop[r * this.cols + c] === 1;
  }

  // selectTilesFromCollisionRect (the "magic rect" broad-phase, ported literally): the 4 corner tiles of
  // the moving box's target rect, mapped screen-space -> tile-index space. In the port the room renders
  // from world origin (0,0) at tilePx, so the original's screen offset (tileSize - roomLocation) collapses
  // to 0 and the +borderThickness is already accounted for by our 0-based grid (out-of-bounds = border).
  // We therefore select the box's 4 corner CELLS directly (floor(px/tile)) — the same 4 tiles the Lingo
  // picks once its magic-rect offset is undone. (See plan §F.1 — kept literal; no clever broad-phase.)
  private selectTiles(bx: number, by: number, w: number, h: number, _dirX: number, _dirY: number): [number, number][] {
    const t = this.tilePx;
    const cl = Math.floor(bx / t), cr = Math.floor((bx + w - 1) / t);
    const rt = Math.floor(by / t), rb = Math.floor((by + h - 1) / t);
    const out: [number, number][] = [];
    const seen = new Set<number>();
    const add = (c: number, r: number) => { const k = (r + 4) * 100000 + (c + 4); if (!seen.has(k)) { seen.add(k); out.push([c, r]); } };
    add(cl, rt); add(cr, rt); add(cr, rb); add(cl, rb);
    return out;
  }
}
