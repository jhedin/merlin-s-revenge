// Canvas2D renderer: a z-sorted sprite display list (replacing Director's sprite-channel pool)
// + tile-layer blitting. Sprites are positioned by registration point (subtract reg), matching
// the engine — see PLAN_REVIEW §3. Per-frame `color` tint is intentionally NOT done via
// getImageData (banned); tinting will use a composite-op cache when added.

import type { Layer } from "../world/map";

export interface Sprite {
  img: CanvasImageSource;
  x: number; y: number;      // world position of the registration point
  regX: number; regY: number;
  z: number;
  visible?: boolean;
  flip?: boolean;            // mirror horizontally (face left)
  flash?: boolean;           // white hit-flash tint
}

export interface TileSheet { img: CanvasImageSource; cols: number; tile: number; }

export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  // scratch canvas for the white hit-flash: stamp the sprite, tint via source-atop, blit once.
  // Used only for the few flashing sprites, so the per-frame getImageData ban is respected.
  private flashCanvas = document.createElement("canvas");
  private flashCtx = this.flashCanvas.getContext("2d")!;
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
      const x = Math.round(s.x), y = Math.round(s.y);
      const img = s.flash ? this.whiten(s.img) : s.img;
      if (s.flip) {
        // mirror about the registration point: with scale(-1,1) the anchor (regX from the left)
        // lands at world x when drawn at flipped-x = -(x + regX); y is unaffected.
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(img, -(x + s.regX), y - s.regY);
        ctx.restore();
      } else {
        ctx.drawImage(img, x - s.regX, y - s.regY);
      }
    }
  }

  /** A white-tinted copy of a sprite (keeps its alpha shape) for the hit-flash. */
  private whiten(img: CanvasImageSource): HTMLCanvasElement {
    const w = (img as HTMLCanvasElement).width, h = (img as HTMLCanvasElement).height;
    this.flashCanvas.width = w; this.flashCanvas.height = h;
    const c = this.flashCtx;
    c.clearRect(0, 0, w, h);
    c.globalCompositeOperation = "source-over";
    c.drawImage(img, 0, 0);
    c.globalCompositeOperation = "source-atop"; // tint only the sprite's opaque pixels
    c.fillStyle = "rgba(255,255,255,0.85)";
    c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = "source-over";
    return this.flashCanvas;
  }
}
