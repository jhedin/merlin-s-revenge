// Build-time: copy the assets the vertical slice needs (merlin4 tileset sheets + Merlin player
// frames) from ../extracted into public/assets, and emit src/generated/assets.json with
// regpoints + tileset column counts. Animation frames are grouped/sorted per animStripMaster
// (char=tok[1], action=tok[2], delay=tok[3]; frame order = numeric prefix of last token).
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const EXTRACTED = join(here, "../../extracted/engine");
const OUT_ASSETS = join(here, "../public/assets");
const OUT_GEN = join(here, "../src/generated");

interface Bmp { file: string; id: number; name: string; w: number; h: number; reg: [number, number]; }
const manifest = JSON.parse(readFileSync(join(here, "../../extracted/manifest.json"), "utf8"));
const bitmaps: Bmp[] = manifest.engine.bitmaps;

mkdirSync(OUT_ASSETS, { recursive: true });
mkdirSync(OUT_GEN, { recursive: true });

const copy = (b: Bmp): string => {
  const src = join(EXTRACTED, b.file);
  const out = basename(b.file);
  if (existsSync(src)) copyFileSync(src, join(OUT_ASSETS, out));
  return out;
};

// --- tilesets: pick merlin4 passive/active/objects sheets by name prefix ---
const tilesets: Record<string, { file: string; w: number; h: number; cols: number; tile: number }> = {};
const TILE = 32;
for (const [sym, prefix] of [
  ["#merlin4Passive", "tlk_merlin4Passive"],
  ["#merlin4Active", "tlk_merlin4Active"],
  ["#merlin4Objects", "tlk_merlin4Objects"],
] as const) {
  const b = bitmaps.find((x) => x.name.startsWith(prefix));
  if (!b) { console.warn("missing tileset sheet", prefix); continue; }
  tilesets[sym] = { file: copy(b), w: b.w, h: b.h, cols: Math.floor(b.w / TILE), tile: TILE };
}

// --- character animations: grouped by <char>_<action> for each bundled character ---
const CHARS = [
  "mer", "blackOrc", "dwarf",
  // real spawn-table combatants present in the dungeon maps
  "swordOrc", "warrior", "skelitonLord", "kongFuChicken", "bowOrc", "mageOrc",
  "vultureGuard", "archer", "ninja", "shurikenNinja", "monk", "druid", "scw", "ochreWizard",
  "uli", "ber", "tv", // cutscene cast (merlin is "mer")
  "goblinHut", "orcHouse", "dojo", // dwellings (construction/residents economy)
];
interface Frame { file: string; w: number; h: number; reg: [number, number]; }
const anims: Record<string, { delay: number; frames: Frame[] }> = {};
const frameNo = (tok: string): number => parseInt(/^\d+/.exec(tok)?.[0] ?? "0", 10);
for (const b of bitmaps.filter((x) => CHARS.some((c) => x.name.startsWith(`anm_${c}_`)))) {
  const t = b.name.split("_");
  const char = t[1] ?? "?";
  const action = t[2] ?? "?";
  const delay = Number.isFinite(Number(t[3])) ? Number(t[3]) : 1;
  const key = `${char}_${action}`;
  (anims[key] ??= { delay, frames: [] }).frames.push({ file: copy(b), w: b.w, h: b.h, reg: b.reg });
  (anims[key].frames.at(-1) as any)._n = frameNo(t.at(-1) ?? "0");
}
for (const k of Object.keys(anims)) {
  anims[k]!.frames.sort((a, b) => (a as any)._n - (b as any)._n);
  anims[k]!.frames.forEach((f) => delete (f as any)._n);
}

// --- stage a real map + its tile keys for the runtime (10-room horizontal dungeon) ---
const MAPS = join(here, "../../casts/data");
copyFileSync(join(here, "../../maps/works/descent_into_darkness-megaman4ever.txt"), join(OUT_ASSETS, "map.txt"));
copyFileSync(join(MAPS, "tlk_merlin4Active_key.txt"), join(OUT_ASSETS, "active_key.txt"));
copyFileSync(join(MAPS, "tlk_merlin4Objects_key.txt"), join(OUT_ASSETS, "objects_key.txt"));
copyFileSync(join(MAPS, "scr_demo_001.txt"), join(OUT_ASSETS, "intro.txt")); // intro cutscene

writeFileSync(join(OUT_GEN, "assets.json"), JSON.stringify({ tile: TILE, tilesets, anims }, null, 1));
console.log(`assets: ${Object.keys(tilesets).length} tilesets, ${Object.keys(anims).length} animations`);
console.log(`tilesets: ${Object.entries(tilesets).map(([k, v]) => `${k}(${v.cols}c)`).join(", ")}`);
console.log(`player anims: ${Object.entries(anims).map(([k, v]) => `${k}:${v.frames.length}`).join(", ")}`);
