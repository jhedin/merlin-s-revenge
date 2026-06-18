// Tile collision (objCollisionMap / objCollisionTile). The original derives a per-room solid
// grid from the active layer and does a 4-corner broad-phase + per-edge push-out with a 2-tile
// solid border. This is a faithful-enough AABB-vs-grid resolver to stand up the vertical slice;
// it is flagged for golden-test parity work against the bespoke solver (PLAN_REVIEW §2/§3).

import type { Layer } from "./map";
import { solidTileNums, type TileKey } from "../data/tlk";

export class CollisionGrid {
  readonly cols: number;
  readonly rows: number;
  readonly tilePx: number;
  private solid: Uint8Array;

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

  /** Out-of-bounds is solid (the original pads a 2-tile solid border). */
  solidCell(c: number, r: number): boolean {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return true;
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

  /**
   * Axis-separated swept move of an AABB. Returns the resolved position and which axes were
   * blocked. Caller integrates velocity; blocked axes should zero their velocity component.
   */
  moveBox(x: number, y: number, w: number, h: number, dx: number, dy: number):
    { x: number; y: number; hitX: boolean; hitY: boolean } {
    let nx = x, ny = y, hitX = false, hitY = false;
    if (dx !== 0) {
      const tryX = x + dx;
      if (this.boxHits(tryX, y, w, h)) {
        // snap to tile edge in the direction of travel
        const t = this.tilePx;
        nx = dx > 0 ? Math.floor((tryX + w) / t) * t - w : Math.floor(tryX / t) * t + t;
        hitX = true;
      } else nx = tryX;
    }
    if (dy !== 0) {
      const tryY = y + dy;
      if (this.boxHits(nx, tryY, w, h)) {
        const t = this.tilePx;
        ny = dy > 0 ? Math.floor((tryY + h) / t) * t - h : Math.floor(tryY / t) * t + t;
        hitY = true;
      } else ny = tryY;
    }
    return { x: nx, y: ny, hitX, hitY };
  }
}
