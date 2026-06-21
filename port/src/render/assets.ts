// Runtime asset loading: images + the generated assets.json index. Loading is LAZY per map: the 10
// tileset sheets are small and load up front, but the 171 char frame-sets (~14 MB total) load on
// demand — ensureMapAssets(mapId) loads only the chars a map can spawn + its tilesets, so the
// default map paints as fast as it ever did. (F1: bundle ALL, load only what a map needs.)

import mapsIndex from "../generated/maps.json";

export interface FrameMeta { file: string; w: number; h: number; reg: [number, number]; dela?: number; }
export interface AnimMeta { delay: number; loop?: boolean; frames: FrameMeta[] }
export interface TilesetMeta { file: string; w: number; h: number; cols: number; tile: number; keyFile?: string }
export interface MapMeta {
  id: string; name: string; folder: string; file: string;
  roomSize: { x: number; y: number }; mapSize: { x: number; y: number }; tilesets: string[];
}
export interface AssetIndex {
  version?: number;
  defaultMap?: string;
  tile?: number;                                 // legacy global (per-tileset `tile` is authoritative)
  tilesets: Record<string, TilesetMeta>;
  chars?: Record<string, true>;                  // all bundled animation chars (171)
  anims: Record<string, AnimMeta>;
  sounds?: Record<string, string>; // SFX name (#attack.sound / collectSound / dieSound) -> file
  music?: Record<string, string>;  // musicName -> file
  cutscenes?: Record<string, string>; // K12: cutscene script name (stones1..10) -> file (lazy loaded)
  // K22 exit arrows (structMaster #exitArrowMembers): colour ("green"|"red") -> edge -> png file.
  // Empty/absent when the .tif→png conversion was unavailable at build time (overlay then no-ops).
  arrows?: Record<string, Record<string, string>>;
  // modWeaponSelector palette: weapon symbol (energyBlast/merlinSword/...) + greenBox/yellowBox -> icon png.
  weaponIcons?: Record<string, string>;
}

export const mapList = mapsIndex as MapMeta[];

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
  private loadedChars = new Set<string>();
  private inflight = new Map<string, Promise<void>>();
  constructor(public index: AssetIndex, public base = "/assets/") {}

  /** Load the index + all 10 tileset sheets (small) up front. Char frames load lazily per map. */
  static async load(base = "/assets/"): Promise<Assets> {
    const index = (await import("../generated/assets.json")).default as unknown as AssetIndex;
    const a = new Assets(index, base);
    await Promise.all(Object.values(index.tilesets).map((t) => a.loadFile(t.file, "global")));
    // K22 exit arrows: 8 small members, loaded up front (flood-keyed white matte like sprites). Absent
    // when the build couldn't convert the .tif art — arrowImg() then returns undefined and the overlay
    // no-ops (collision/transition behaviour is unaffected either way).
    const arrowFiles = Object.values(index.arrows ?? {}).flatMap((edges) => Object.values(edges));
    await Promise.all(arrowFiles.map((f) => a.loadFile(f, "flood")));
    // modWeaponSelector icons: ~24 tiny PNGs, loaded up front (flood-keyed white matte like the arrows).
    await Promise.all(Object.values(index.weaponIcons ?? {}).map((f) => a.loadFile(f, "flood")));
    return a;
  }

  /** K22: the loaded arrow member for a colour ("green"|"red") + edge ("left"|"up"|"right"|"down"),
   *  or undefined when the art wasn't bundled (the renderer skips the arrow). */
  arrowImg(colour: "green" | "red", edge: "left" | "up" | "right" | "down"): Drawable | undefined {
    const file = this.index.arrows?.[colour]?.[edge];
    return file ? this.images.get(file) : undefined;
  }

  /** modWeaponSelector: the loaded icon for a weapon symbol (or greenBox/yellowBox), or undefined. */
  weaponIcon(sym: string): Drawable | undefined {
    const file = this.index.weaponIcons?.[sym.replace(/^#/, "")];
    return file ? this.images.get(file) : undefined;
  }

  private async loadFile(file: string, mode: "flood" | "global"): Promise<void> {
    if (this.images.has(file)) return;
    const img = await loadImage(this.base + file);
    this.images.set(file, keyOutMatte(img, mode));
  }

  /** Load one char's animation frames on demand (deduped; idempotent). */
  async ensureChar(char: string): Promise<void> {
    if (this.loadedChars.has(char)) return;
    let p = this.inflight.get(char);
    if (!p) {
      p = (async () => {
        const files = new Set<string>();
        const prefix = `${char}_`;
        for (const [key, anim] of Object.entries(this.index.anims)) {
          if (!key.startsWith(prefix)) continue;
          for (const f of anim.frames) files.add(f.file);
        }
        await Promise.all([...files].map((f) => this.loadFile(f, "flood")));
        this.loadedChars.add(char);
      })().finally(() => this.inflight.delete(char));
      this.inflight.set(char, p);
    }
    await p;
  }

  /**
   * Load everything a map needs to render/spawn: its tilesets (already loaded if standard) + every
   * char that map can spawn. Chars are resolved from the map's #objects-layer spawn symbols by the
   * caller and passed in; the blackOrc fallback is loaded too as a safety net for unbundled actors.
   */
  async ensureMapAssets(tilesetFiles: string[], spawnChars: string[]): Promise<void> {
    await Promise.all(tilesetFiles.map((f) => this.loadFile(f, "global")));
    const need = new Set<string>(spawnChars);
    need.add("mer");       // the player
    need.add("blackOrc");  // spriteCharOr fallback safety net
    await Promise.all([...need].map((c) => this.ensureChar(c)));
  }

  img(file: string): Drawable {
    const i = this.images.get(file);
    if (!i) throw new Error("image not loaded: " + file);
    return i;
  }

  /** True once a char's frames are loaded (renderer/anim can fall back if not). */
  hasChar(char: string): boolean { return this.loadedChars.has(char); }
}
