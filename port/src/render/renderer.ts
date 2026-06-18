// Canvas2D renderer: a z-sorted sprite display list (replacing Director's sprite-channel pool)
// + tile-layer blitting. Sprites are positioned by registration point (subtract reg), matching
// the engine — see PLAN_REVIEW §3. Per-frame `color` tint is intentionally NOT done via
// getImageData (banned); tinting will use a composite-op cache when added.

import type { Layer } from "../world/map";

export interface Sprite {
  img: HTMLImageElement;
  x: number; y: number;      // world position of the registration point
  regX: number; regY: number;
  z: number;
  visible?: boolean;
}

export interface TileSheet { img: HTMLImageElement; cols: number; tile: number; }

export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  constructor(readonly canvas: HTMLCanvasElement, readonly viewW: number, readonly viewH: number, readonly scale = 2) {
    canvas.width = viewW; canvas.height = viewH;
    canvas.style.width = `${viewW * scale}px`;
    canvas.style.height = `${viewH * scale}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    ctx.imageSmoothingEnabled = false;
    this.ctx = ctx;
  }

  clear(): void { this.ctx.clearRect(0, 0, this.viewW, this.viewH); }

  /** Blit one tile layer at origin (ox,oy). Tile 0 = empty. */
  drawTileLayer(layer: Layer, sheet: TileSheet, ox = 0, oy = 0): void {
    const { tile, cols, img } = sheet;
    const ctx = this.ctx;
    for (let r = 0; r < layer.grid.length; r++) {
      const row = layer.grid[r]!;
      for (let c = 0; c < row.length; c++) {
        const n = row[c]!;
        if (n <= 0) continue;
        const sx = ((n - 1) % cols) * tile;
        const sy = Math.floor((n - 1) / cols) * tile;
        ctx.drawImage(img, sx, sy, tile, tile, ox + c * tile, oy + r * tile, tile, tile);
      }
    }
  }

  /** Draw a z-sorted display list. Sprites drawn at (x-regX, y-regY). */
  drawSprites(sprites: Sprite[]): void {
    const list = sprites.filter((s) => s.visible !== false);
    list.sort((a, b) => a.z - b.z);
    const ctx = this.ctx;
    for (const s of list) {
      ctx.drawImage(s.img, Math.round(s.x - s.regX), Math.round(s.y - s.regY));
    }
  }
}
