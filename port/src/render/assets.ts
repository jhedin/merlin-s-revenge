// Runtime asset loading: images + the generated assets.json index.

export interface FrameMeta { file: string; w: number; h: number; reg: [number, number]; }
export interface AnimMeta { delay: number; frames: FrameMeta[] }
export interface TilesetMeta { file: string; w: number; h: number; cols: number; tile: number }
export interface AssetIndex {
  tile: number;
  tilesets: Record<string, TilesetMeta>;
  anims: Record<string, AnimMeta>;
}

export type Drawable = HTMLCanvasElement;

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("failed to load " + src));
    img.src = src;
  });
}

// Director drew cast bitmaps with "background transparent" ink; the extracted 32-bit BITDs
// baked the matte as opaque white. Key out the white matte by flood-filling transparency from
// the image border (interior whites — e.g. sprite highlights — are preserved). One-time at
// load (the per-frame getImageData ban only concerns the render loop).
function keyOutMatte(img: HTMLImageElement, mode: "flood" | "global"): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const w = c.width, h = c.height;
  if (w === 0 || h === 0) return c;
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const isWhite = (i: number) => px[i]! > 244 && px[i + 1]! > 244 && px[i + 2]! > 244 && px[i + 3]! > 0;
  if (mode === "global") {
    // tile sheets: matte is interior to the sheet (per-cell), so key all near-white.
    for (let i = 0; i < px.length; i += 4) if (isWhite(i)) px[i + 3] = 0;
  } else {
    // sprites: flood transparency from the image border (preserves interior white highlights).
    const stack: number[] = [];
    const push = (x: number, y: number) => { if (x >= 0 && y >= 0 && x < w && y < h) stack.push(y * w + x); };
    for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
    for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
    const seen = new Uint8Array(w * h);
    while (stack.length) {
      const p = stack.pop()!;
      if (seen[p]) continue; seen[p] = 1;
      const i = p * 4;
      if (!isWhite(i)) continue;
      px[i + 3] = 0;
      const x = p % w, y = (p / w) | 0;
      push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
    }
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

export class Assets {
  images = new Map<string, Drawable>();
  constructor(public index: AssetIndex, public base = "/assets/") {}

  static async load(base = "/assets/"): Promise<Assets> {
    const index = (await import("../generated/assets.json")).default as unknown as AssetIndex;
    const a = new Assets(index, base);
    const tilesetFiles = new Set(Object.values(index.tilesets).map((t) => t.file));
    const files = new Set<string>(tilesetFiles);
    for (const anim of Object.values(index.anims)) for (const f of anim.frames) files.add(f.file);
    await Promise.all([...files].map(async (f) => {
      const img = await loadImage(base + f);
      a.images.set(f, keyOutMatte(img, tilesetFiles.has(f) ? "global" : "flood"));
    }));
    return a;
  }

  img(file: string): Drawable {
    const i = this.images.get(file);
    if (!i) throw new Error("image not loaded: " + file);
    return i;
  }
}
