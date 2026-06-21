// Canvas2D renderer: a z-sorted sprite display list (replacing Director's sprite-channel pool)
// + tile-layer blitting. Sprites are positioned by registration point (subtract reg), matching
// the engine — see PLAN_REVIEW §3. Per-frame `color` tint (modColourTransform) is done via an
// OFFSCREEN source-atop pass cached by quantized (frame, colour, strength) — never getImageData (banned).

import type { Layer } from "../world/map";

export interface SpriteTint { rgb: [number, number, number]; strength: number; additive: boolean; }

export interface Sprite {
  img: CanvasImageSource;
  x: number; y: number;      // world position of the registration point
  regX: number; regY: number;
  z: number;
  visible?: boolean;
  flip?: boolean;            // mirror horizontally (face left)
  tint?: SpriteTint;         // modColourTransform overlay (white flick / glowRed/Teal/Gold)
  alpha?: number;            // per-sprite globalAlpha (modColourTransform/front-layer blend), default 1
  rotation?: number;         // I8 beam: sprite rotation in radians about the registration point (setSpriteRotation)
  scaleX?: number;           // I8 beam: horizontal stretch about the registration point (setSpriteWidth -> width/imgW)
  scaleY?: number;
}

export interface TileSheet { img: CanvasImageSource; cols: number; tile: number; }

export class Renderer {
  readonly ctx: CanvasRenderingContext2D;
  // scratch canvas for the colour-transform tint pass: stamp the sprite, tint via source-atop, blit once.
  // Used only for the few tinted sprites, so the per-frame getImageData ban is respected.
  private tintCanvas = document.createElement("canvas");
  private tintCtx = this.tintCanvas.getContext("2d")!;
  // cache of tinted results keyed by (image, quantized colour, quantized strength, additive). Bounded.
  private tintCache = new Map<string, HTMLCanvasElement>();
  private static readonly TINT_CACHE_MAX = 64;
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

  /** Blit one tile layer at origin (ox,oy). Tile 0 = empty. Optional alpha for blended layers. */
  drawTileLayer(layer: Layer, sheet: TileSheet, ox = 0, oy = 0, alpha = 1): void {
    const { tile, cols, img } = sheet;
    const ctx = this.ctx;
    if (alpha !== 1) ctx.globalAlpha = alpha;
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
    if (alpha !== 1) ctx.globalAlpha = 1;
  }

  /** Draw a z-sorted display list. Sprites drawn at (x-regX, y-regY). */
  drawSprites(sprites: Sprite[]): void {
    const list = sprites.filter((s) => s.visible !== false);
    list.sort((a, b) => a.z - b.z);
    const ctx = this.ctx;
    for (const s of list) {
      const x = Math.round(s.x), y = Math.round(s.y);
      const img = s.tint ? this.tinted(s.img, s.tint) : s.img;
      const alpha = s.alpha ?? 1;
      if (alpha !== 1) ctx.globalAlpha = alpha;
      // I8 beam: a rotated/stretched sprite (setSpriteRotation + setSpriteWidth). Transform about the
      // registration point so the beam pivots at the caster-facing anchor and stretches along its axis.
      if (s.rotation || s.scaleX !== undefined || s.scaleY !== undefined) {
        ctx.save();
        ctx.translate(x, y);
        if (s.rotation) ctx.rotate(s.rotation);
        ctx.scale((s.flip ? -1 : 1) * (s.scaleX ?? 1), s.scaleY ?? 1);
        ctx.drawImage(img, -s.regX, -s.regY);
        ctx.restore();
        if (alpha !== 1) ctx.globalAlpha = 1;
        continue;
      }
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
      if (alpha !== 1) ctx.globalAlpha = 1;
    }
  }

  /** A colour-tinted copy of a sprite (keeps its alpha shape), cached by (image, colour, strength).
   *  Replace mode (white flick/flash) fills over the sprite; additive (glows) brightens via "lighter". */
  private tinted(img: CanvasImageSource, tint: SpriteTint): HTMLCanvasElement {
    const w = (img as HTMLCanvasElement).width, h = (img as HTMLCanvasElement).height;
    // quantize the cache key: colour to 5-bit channels, strength to 8 steps.
    const qr = tint.rgb[0] >> 3, qg = tint.rgb[1] >> 3, qb = tint.rgb[2] >> 3;
    const qs = Math.round(Math.max(0, Math.min(1, tint.strength)) * 8);
    const key = `${(img as any).src ?? (img as any).__id ?? w + "x" + h}|${qr},${qg},${qb}|${qs}|${tint.additive ? 1 : 0}`;
    const cached = this.tintCache.get(key);
    if (cached) return cached;

    const out = document.createElement("canvas");
    out.width = w; out.height = h;
    const c = out.getContext("2d")!;
    c.clearRect(0, 0, w, h);
    c.globalCompositeOperation = "source-over";
    c.drawImage(img, 0, 0);
    // source-atop tints ONLY the sprite's opaque pixels (clips to its silhouette, keeps alpha shape).
    // Additive glows (red/teal/gold) use a stronger fill so the glow reads as a brighten; replace
    // transforms (white flick/flash) fill at their raw strength.
    c.globalCompositeOperation = "source-atop";
    c.globalAlpha = Math.min(1, tint.additive ? tint.strength * 0.9 : tint.strength);
    c.fillStyle = `rgb(${tint.rgb[0]},${tint.rgb[1]},${tint.rgb[2]})`;
    c.fillRect(0, 0, w, h);
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";

    if (this.tintCache.size >= Renderer.TINT_CACHE_MAX) {
      // evict the oldest entry (insertion order) — cap memory under many simultaneous glows.
      const first = this.tintCache.keys().next().value;
      if (first !== undefined) this.tintCache.delete(first);
    }
    this.tintCache.set(key, out);
    return out;
  }
}
