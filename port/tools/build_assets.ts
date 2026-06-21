// Build-time asset pipeline (F1 — "maps are data; the engine must load whatever the data ships").
// Bundles the COMPLETE asset set the engine can drive: all 10 tilesets, all 171 animation chars'
// individual frame PNGs (the renderer draws whole frames — no atlas), all 47 maps + their tile
// keys, and a vocabulary-driven SFX map. Emits src/generated/{assets.json,maps.json}.
//
// No image library is available and public/assets/ is build-generated (gitignored), so frames are
// copied as individual PNGs exactly as before — the F1 win is COMPLETENESS + load-any-map, not
// atlasing. Runtime loads lazily per map (see assets.ts) so first paint stays as fast as today.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const REPO = join(here, "../..");
const EXTRACTED = join(REPO, "extracted/engine");
const DATA = join(REPO, "casts/data");
const MAPS_ROOT = join(REPO, "maps");
const OUT_ASSETS = join(here, "../public/assets");
const OUT_GEN = join(here, "../src/generated");

interface Bmp { file: string; id: number; name: string; w: number; h: number; reg: [number, number]; }
const manifest = JSON.parse(readFileSync(join(REPO, "extracted/manifest.json"), "utf8"));
const bitmaps: Bmp[] = manifest.engine.bitmaps;

mkdirSync(OUT_ASSETS, { recursive: true });
mkdirSync(OUT_GEN, { recursive: true });

const copy = (b: Bmp): string => {
  const src = join(EXTRACTED, b.file);
  const out = basename(b.file);
  if (existsSync(src)) copyFileSync(src, join(OUT_ASSETS, out));
  return out;
};

// ── (a) tilesets: all 10 sheets = 4 families × {Passive,Active,Objects} + menu ────────────────
// Bitmap names are Director-name-mangled (e.g. #merlin4Objects → "tlk_merlin4ObjectskMoaCfFormat_PNGK"),
// so match by the longest-unique prefix "tlk_<family><Layer>" — NOT equality. `merlin` is a prefix of
// `merlin4`/`merlinOpen`, so longest-prefix among candidates disambiguates. Per-tileset tile size is
// read from the matching key file's `tileSize | point(w,h)` (32 gameplay, 16 menu); cols = floor(w/tile).
interface TilesetMeta { file: string; w: number; h: number; tile: number; cols: number; keyFile: string; }
const tilesets: Record<string, TilesetMeta> = {};

const tileSizeOf = (keyPath: string): number => {
  const m = /tileSize\s*\|\s*point\(\s*(\d+)\s*,\s*\d+\s*\)/i.exec(readFileSync(keyPath, "utf8"));
  return m ? Number(m[1]) : 32;
};

const OUT_KEYS = join(OUT_ASSETS, "keys");
mkdirSync(OUT_KEYS, { recursive: true });

// (symbol, sheet-prefix, key-file-stem). Listed longest-first per family so the unique-prefix match
// can't grab a sibling (#merlinActive must not match tlk_merlin4Active…).
const TILESET_DEFS: { sym: string; prefix: string; key: string }[] = [];
for (const family of ["merlinOpen", "merlin4", "merlin"]) {
  for (const layer of ["Passive", "Active", "Objects"]) {
    TILESET_DEFS.push({ sym: `#${family}${layer}`, prefix: `tlk_${family}${layer}`, key: `tlk_${family}${layer}_key.txt` });
  }
}
TILESET_DEFS.push({ sym: "#menu", prefix: "tlk_menu", key: "tlk_menu_key.txt" });

for (const { sym, prefix, key } of TILESET_DEFS) {
  const b = bitmaps.find((x) => x.name.startsWith(prefix));
  if (!b) { console.warn("missing tileset sheet for", sym, "(prefix", prefix + ")"); continue; }
  const keyPath = join(DATA, key);
  if (!existsSync(keyPath)) { console.warn("missing tileset key", key, "for", sym); continue; }
  const tile = tileSizeOf(keyPath);
  const keyOut = `keys/${key}`;
  copyFileSync(keyPath, join(OUT_ASSETS, keyOut));
  tilesets[sym] = { file: copy(b), w: b.w, h: b.h, tile, cols: Math.floor(b.w / tile), keyFile: keyOut };
}

// ── (b) animations: ALL 171 chars' frame PNGs ─────────────────────────────────────────────────
// Member name (animStripMaster.addFrame): `anm_<chr>_<animName>_<delay>_<frameNo>`, underscore-split:
// [1]=chr, [2]=action, [3]=delay, last=frameNo. `seperateMembers`: a member named "a b c" (space-
// separated) belongs to MULTIPLE strips → split the member name on spaces FIRST, then process each
// token as its own anm_ name. Per-frame `reg` (regpoint) + `dela` (delay) recorded for F3 fidelity.
interface Frame { file: string; w: number; h: number; reg: [number, number]; dela: number; }
const anims: Record<string, { delay: number; loop: boolean; frames: Frame[] }> = {};
const chars: Record<string, true> = {};
const frameNo = (tok: string): number => parseInt(/^\d+/.exec(tok)?.[0] ?? "0", 10);

// Loop vs one-shot (objAnimStrip.getLooped / modAnimSet character-mode logic): the original treats every
// strip as cyclic in objAnimStrip, but the CHARACTER mode logic reverts after one play for "transient"
// actions (a swing, a cast, a death, a reel). The per-strip loop bool is NOT cleanly recoverable from the
// cast (it's runtime counter state), so we record the action-name classification here (data-overridable
// at runtime via assets.json), matching the port's prior ONE_SHOT set. Documented residual gap (plan §C.3.2).
const ONE_SHOT_ACTIONS = new Set([
  "grave", "die", "reel",
  "naturalMelee", "weaponMelee", "magicMelee", "weaponMagic",
  "release", "weaponRanged", "naturalRanged",
]);
const isLoopAction = (action: string): boolean => !ONE_SHOT_ACTIONS.has(action);

for (const b of bitmaps) {
  // a single bitmap may carry several logical anm_ names (seperateMembers) — space-split first.
  for (const name of b.name.split(/\s+/)) {
    if (!name.startsWith("anm_")) continue;
    const t = name.split("_");
    const char = t[1] ?? "?";
    const action = t[2] ?? "?";
    const dela = Number.isFinite(Number(t[3])) ? Number(t[3]) : 1;
    chars[char] = true;
    const key = `${char}_${action}`;
    const file = copy(b);
    (anims[key] ??= { delay: dela, loop: isLoopAction(action), frames: [] }).frames.push({ file, w: b.w, h: b.h, reg: b.reg, dela });
    (anims[key].frames.at(-1) as any)._n = frameNo(t.at(-1) ?? "0");
  }
}
for (const k of Object.keys(anims)) {
  anims[k]!.frames.sort((a, b) => (a as any)._n - (b as any)._n);
  anims[k]!.frames.forEach((f) => delete (f as any)._n);
}

// ── (c) maps: ALL 47 + a maps.json manifest ───────────────────────────────────────────────────
// Copy every maps/**/*.txt to public/assets/maps/<id>.txt (id = filename stem; folder-qualified when
// the stem collides across folders). Parse each map's #layerDefinitions[].tileSet + #roomSize/#mapSize.
const OUT_MAPS = join(OUT_ASSETS, "maps");
mkdirSync(OUT_MAPS, { recursive: true });

const mapFiles: { folder: string; path: string; stem: string }[] = [];
const walk = (dir: string, folder: string) => {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) walk(join(dir, ent.name), folder ? `${folder}/${ent.name}` : ent.name);
    else if (ent.name.endsWith(".txt")) mapFiles.push({ folder: folder || ".", path: join(dir, ent.name), stem: basename(ent.name, ".txt") });
  }
};
walk(MAPS_ROOT, "");

const stemCounts = new Map<string, number>();
for (const f of mapFiles) stemCounts.set(f.stem, (stemCounts.get(f.stem) ?? 0) + 1);
const idFor = (f: { folder: string; stem: string }): string =>
  (stemCounts.get(f.stem)! > 1 && f.folder !== ".") ? `${f.folder.replace(/\//g, "_")}_${f.stem}` : f.stem;

const point = (src: string, key: string): { x: number; y: number } => {
  const m = new RegExp(`#${key}:\\s*point\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*\\)`).exec(src);
  return { x: m ? Number(m[1]) : 1, y: m ? Number(m[2]) : 1 };
};

interface MapMeta { id: string; name: string; folder: string; file: string; roomSize: { x: number; y: number }; mapSize: { x: number; y: number }; tilesets: string[]; }
const maps: MapMeta[] = [];
const DEFAULT_MAP = "descent_into_darkness-megaman4ever";
for (const f of mapFiles) {
  const src = readFileSync(f.path, "utf8");
  const id = idFor(f);
  const out = `maps/${id}.txt`;
  copyFileSync(f.path, join(OUT_MAPS, `${id}.txt`));
  const ts = [...new Set([...src.matchAll(/#tileSet:\s*(#\w+)/g)].map((m) => m[1]!))];
  maps.push({ id, name: f.stem, folder: f.folder, file: out, roomSize: point(src, "roomSize"), mapSize: point(src, "mapSize"), tilesets: ts });
}
if (!maps.some((m) => m.id === DEFAULT_MAP)) console.warn("default map missing:", DEFAULT_MAP);

// cutscenes (loaded separately by main.ts): the intro, the wasted (gGameOverScript — death flow), and a
// game-complete script. All are real shipped scr_*/cut_scene scripts the Thespian engine plays (H1/H2).
const OUT_CUT = join(OUT_ASSETS, "cutscenes");
mkdirSync(OUT_CUT, { recursive: true });
copyFileSync(join(DATA, "scr_demo_001.txt"), join(OUT_ASSETS, "intro.txt"));
copyFileSync(join(DATA, "scr_cut_scene_to_play_when_wasted.txt"), join(OUT_ASSETS, "wasted.txt"));
copyFileSync(join(REPO, "cut_scenes/mr4Complete.txt"), join(OUT_ASSETS, "complete.txt"));

// K12 chatter cutscenes: bundle every shipped scr_stonesN script so a chatter stone plays its
// #scriptToPerform on overlap. stones1-5 are placed (×2 maps each, I-plan §h); stones6-10 are dead
// content (placed in 0 maps) but the on-demand loader is generic, so bundling all 10 removes a special-
// case. Each lands at cutscenes/stonesN.txt, recorded in the cutscenes manifest for the lazy loader.
const cutscenes: Record<string, string> = {};
for (let i = 1; i <= 10; i++) {
  const srcPath = join(DATA, `scr_stones${i}.txt`);
  if (!existsSync(srcPath)) { console.warn("missing stones script", `scr_stones${i}.txt`); continue; }
  const out = `cutscenes/stones${i}.txt`;
  copyFileSync(srcPath, join(OUT_ASSETS, out));
  cutscenes[`stones${i}`] = out;
}

// ── (d) audio: vocabulary-driven SFX map + music ──────────────────────────────────────────────
// Build the CLOSED set of logical SFX names from casts/data (#sound:/#collectSound:/#dieSound:
// string values) ∪ engine effects, then match each wav (strip `^\d+_` + the trailing MANGLE) to it.
// A wav whose de-mangled name lands in the vocabulary keys off that name; misses are warned, not
// silently mangled. This replaces the lossy regex with a verifiable map + a build-time report.
const dataVocab = new Set<string>();
for (const file of readdirSync(DATA).filter((f) => f.endsWith(".txt"))) {
  const src = readFileSync(join(DATA, file), "utf8");
  for (const m of src.matchAll(/#(?:sound|collectSound|dieSound):\s*"([^"]+)"/g)) dataVocab.add(m[1]!);
}
const ENGINE_EFFECTS = [
  "spell_release", "spell_explode", "spell_charge", "heal_spell_release", "heal_spell_explode",
  "level_up", "end_level", "end_screen", "dragon_hit", "vulture_hit",
];
for (const e of ENGINE_EFFECTS) dataVocab.add(e);

// de-mangle: drop the index prefix, then underscore-uppercase tails (_U, _U_EL), then one trailing cap.
const demangle = (f: string): string =>
  f.replace(/\.wav$/i, "").replace(/^\d+_/, "").replace(/(_[A-Z]+)+$/, "").replace(/[A-Z]$/, "");

const sounds: Record<string, string> = {};
const sfxWarnings: string[] = [];
const SND_SRC = join(EXTRACTED, "sounds"), SND_OUT = join(OUT_ASSETS, "sounds");
if (existsSync(SND_SRC)) {
  mkdirSync(SND_OUT, { recursive: true });
  for (const f of readdirSync(SND_SRC).filter((f) => f.endsWith(".wav"))) {
    copyFileSync(join(SND_SRC, f), join(SND_OUT, f));
    const name = demangle(f);
    if (!dataVocab.has(name)) sfxWarnings.push(`${f} → "${name}" (not in data vocabulary)`);
    if (sounds[name]) sfxWarnings.push(`${f} collides with ${sounds[name]} on "${name}"`);
    sounds[name] = `sounds/${f}`;
  }
}
// report any data-referenced names that ship no wav (informational — data may reference unshipped SFX)
const missingFromData = [...dataVocab].filter((v) => !sounds[v]).sort();

const music: Record<string, string> = {};
const MUS_SRC = join(EXTRACTED, "music"), MUS_OUT = join(OUT_ASSETS, "music");
if (existsSync(MUS_SRC)) {
  mkdirSync(MUS_OUT, { recursive: true });
  for (const f of readdirSync(MUS_SRC).filter((f) => f.endsWith(".mp3"))) {
    copyFileSync(join(MUS_SRC, f), join(MUS_OUT, f));
    music[basename(f, ".mp3")] = `music/${f}`;
  }
}

// ── (e) exit arrows (K22): the 8 directional arrow members (structMaster.txt ~374-398) ───────────
// modScreenExits.drawExitArrowsOnImage tiles `pExitArrowMembers[#grn|#rdd][#left|#top|#right|#bottom]`
// across each exit rect. The source art ships as 16×16 palette .tif (gfx/.../arrow_{green,red}_*.tif).
// node has no image lib here, so we shell to Python/PIL (available) to flatten each .tif → RGBA PNG; the
// runtime keys out the white matte at load (assets.keyOutMatte, flood mode), matching Director's
// "background transparent" ink. The art ships only {plain,down,left,up}; the plain arrow IS the
// right-facing one (arrow_green.tif == mirror(arrow_green_left.tif), verified) → plain maps to #right,
// matching structMaster's member("arrow_green_right"). If PIL/conversion is unavailable, `arrows` is
// left empty and the render path no-ops (the arrow overlay simply doesn't draw — collision unaffected).
const GFX_ARROWS = join(REPO, "gfx/gfx/mr2_gfx/background/episode_one");
const OUT_ARROWS = join(OUT_ASSETS, "arrows");
// arrows[colour][edge] = png filename. colour ∈ {green,red}; edge ∈ {left,up,right,down}.
const arrows: Record<string, Record<string, string>> = {};
// (edge → source .tif stem). `right` has no own .tif; the plain `arrow_{col}` is the right-facing arrow.
const ARROW_EDGES: { edge: string; stem: (col: string) => string }[] = [
  { edge: "left", stem: (c) => `arrow_${c}_left` },
  { edge: "up", stem: (c) => `arrow_${c}_up` },
  { edge: "right", stem: (c) => `arrow_${c}` },
  { edge: "down", stem: (c) => `arrow_${c}_down` },
];
// tif → png via PIL: `Image.open(src).convert('RGBA').save(out)`. One probe first; bail cleanly if absent.
const tifToPng = (src: string, out: string): boolean => {
  const r = spawnSync("python3", ["-c",
    "import sys;from PIL import Image;Image.open(sys.argv[1]).convert('RGBA').save(sys.argv[2])",
    src, out], { encoding: "utf8" });
  return r.status === 0;
};
let arrowsOk = false;
if (existsSync(GFX_ARROWS)) {
  mkdirSync(OUT_ARROWS, { recursive: true });
  arrowsOk = true;
  outer:
  for (const col of ["green", "red"]) {
    arrows[col] = {};
    for (const { edge, stem } of ARROW_EDGES) {
      const src = join(GFX_ARROWS, `${stem(col)}.tif`);
      const outName = `arrows/arrow_${col}_${edge}.png`;
      if (!existsSync(src) || !tifToPng(src, join(OUT_ASSETS, outName))) {
        console.warn("  arrow conversion failed for", src, "— exit-arrow overlay will no-op");
        arrowsOk = false;
        break outer;
      }
      arrows[col]![edge] = outName;
    }
  }
}
if (!arrowsOk) { for (const k of Object.keys(arrows)) delete arrows[k]; }

// ── emit + report ─────────────────────────────────────────────────────────────────────────────
writeFileSync(join(OUT_GEN, "assets.json"),
  JSON.stringify({ version: 2, defaultMap: DEFAULT_MAP, tilesets, chars, anims, sounds, music, cutscenes, arrows }, null, 1));
writeFileSync(join(OUT_GEN, "maps.json"), JSON.stringify(maps, null, 1));

const charCount = Object.keys(chars).length, animCount = Object.keys(anims).length;
console.log(`F1 asset pipeline — bundled:`);
console.log(`  tilesets: ${Object.keys(tilesets).length}  (${Object.keys(tilesets).join(", ")})`);
console.log(`  chars:    ${charCount}   anims: ${animCount}`);
console.log(`  maps:     ${maps.length}`);
console.log(`  sounds:   ${Object.keys(sounds).length}   music: ${Object.keys(music).length}`);
console.log(`  cutscenes: ${Object.keys(cutscenes).length}  (stones1-10 + intro/wasted/complete)`);
console.log(`  arrows:   ${arrowsOk ? "8 (green/red × left/up/right/down)" : "0 (conversion unavailable — overlay no-ops)"}`);
if (sfxWarnings.length) console.warn("  SFX warnings:\n    " + sfxWarnings.join("\n    "));
if (missingFromData.length) console.log("  data vocab with no shipped wav (ok): " + missingFromData.join(", "));
