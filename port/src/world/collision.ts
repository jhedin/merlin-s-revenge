// Tile collision (objCollisionMap / objCollisionTile). The original derives a per-room solid
// grid from the active layer and does a 4-corner broad-phase + per-edge push-out with a 2-tile
// solid border. This is a faithful-enough AABB-vs-grid resolver to stand up the vertical slice;
// it is flagged for golden-test parity work against the bespoke solver (PLAN_REVIEW §2/§3).

import type { Layer } from "./map";
import { solidTileNums, type TileKey } from "../data/tlk";

export interface OpenEdges { left: boolean; right: boolean; up: boolean; down: boolean; }

export class CollisionGrid {
  readonly cols: number;
  readonly rows: number;
  readonly tilePx: number;
  private solid: Uint8Array;
  /** edges that lead to an adjacent room are passable (the player exits through them) */
  open: OpenEdges = { left: false, right: false, up: false, down: false };

  constructor(cols: number, rows: number, tilePx: number) {
    this.cols = cols; this.rows = rows; this.tilePx = tilePx;
    this.solid = new Uint8Array(cols * rows);
  }

  static fromActiveLayer(active: Layer, key: TileKey, tilePx: number): CollisionGrid {
    const rows = active.grid.length;
    const cols = active.grid[0]?.length ?? 0;
    const g = new CollisionGrid(cols, rows, tilePx);
    const solids = solidTileNums(key);
    for (let r = 0; r < rows; r++) {
      const row = active.grid[r]!;
      for (let c = 0; c < cols; c++) {
        if (solids.has(row[c] ?? 0)) g.set(c, r, true);
      }
    }
    return g;
  }

  set(c: number, r: number, v: boolean): void {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return;
    this.solid[r * this.cols + c] = v ? 1 : 0;
  }

  /** Out-of-bounds is solid (2-tile border in the original) unless the edge is an open exit. */
  solidCell(c: number, r: number): boolean {
    if (c < 0 || c >= this.cols) {
      const exit = c < 0 ? this.open.left : this.open.right;
      return !(exit && r >= 0 && r < this.rows);
    }
    if (r < 0 || r >= this.rows) {
      const exit = r < 0 ? this.open.up : this.open.down;
      return !(exit && c >= 0 && c < this.cols);
    }
    return this.solid[r * this.cols + c] === 1;
  }

  solidAtPx(px: number, py: number): boolean {
    return this.solidCell(Math.floor(px / this.tilePx), Math.floor(py / this.tilePx));
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
   * Axis-separated swept move of an AABB. On contact, snaps flush to the *blocking* tile's
   * near face (scanning for the first solid tile along the swept span — not the box's far
   * edge), which is the bug the golden tests caught. Caller zeroes velocity on a blocked axis.
   */
  moveBox(x: number, y: number, w: number, h: number, dx: number, dy: number):
    { x: number; y: number; hitX: boolean; hitY: boolean } {
    const t = this.tilePx;
    let nx = x, ny = y, hitX = false, hitY = false;
    if (dx !== 0) {
      const tryX = x + dx;
      if (this.boxHits(tryX, y, w, h)) {
        hitX = true;
        const r0 = Math.floor(y / t), r1 = Math.floor((y + h - 1) / t);
        if (dx > 0) {
          let blocked = Math.floor((tryX + w - 1) / t);
          for (let c = Math.floor((x + w) / t); c <= blocked; c++) { if (this.colSolid(c, r0, r1)) { blocked = c; break; } }
          nx = blocked * t - w;
        } else {
          let blocked = Math.floor(tryX / t);
          for (let c = Math.floor((x + w - 1) / t); c >= blocked; c--) { if (this.colSolid(c, r0, r1)) { blocked = c; break; } }
          nx = (blocked + 1) * t;
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
        } else {
          let blocked = Math.floor(tryY / t);
          for (let r = Math.floor((y + h - 1) / t); r >= blocked; r--) { if (this.rowSolid(r, c0, c1)) { blocked = r; break; } }
          ny = (blocked + 1) * t;
        }
      } else ny = tryY;
    }
    return { x: nx, y: ny, hitX, hitY };
  }
}
