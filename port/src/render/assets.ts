// Runtime asset loading: images + the generated assets.json index.

export interface FrameMeta { file: string; w: number; h: number; reg: [number, number]; }
export interface AnimMeta { delay: number; frames: FrameMeta[] }
export interface TilesetMeta { file: string; w: number; h: number; cols: number; tile: number }
export interface AssetIndex {
  tile: number;
  tilesets: Record<string, TilesetMeta>;
  anims: Record<string, AnimMeta>;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("failed to load " + src));
    img.src = src;
  });
}

export class Assets {
  images = new Map<string, HTMLImageElement>();
  constructor(public index: AssetIndex, public base = "/assets/") {}

  static async load(base = "/assets/"): Promise<Assets> {
    const index = (await import("../generated/assets.json")).default as unknown as AssetIndex;
    const a = new Assets(index, base);
    const files = new Set<string>();
    for (const t of Object.values(index.tilesets)) files.add(t.file);
    for (const anim of Object.values(index.anims)) for (const f of anim.frames) files.add(f.file);
    await Promise.all([...files].map(async (f) => a.images.set(f, await loadImage(base + f))));
    return a;
  }

  img(file: string): HTMLImageElement {
    const i = this.images.get(file);
    if (!i) throw new Error("image not loaded: " + file);
    return i;
  }
}
