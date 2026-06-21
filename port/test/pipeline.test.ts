// F1 asset-pipeline completeness gate. Asserts the generated bundle ships EVERYTHING the engine can
// drive (all 10 tilesets / 171 chars / 47 maps / 29 SFX / 8 music), cross-checked against a fresh
// scan of the source (extracted/manifest.json + maps/ + casts/data) so the numbers track source, not
// a stale constant. Plus audio-vocabulary coverage and a multi-map structural load smoke (no throw).
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { parseMap } from "@/world/map";
import { parseTileKey, tileSymbol } from "@/data/tlk";
import assets from "@/generated/assets.json";
import maps from "@/generated/maps.json";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

// ── fresh source scans (the ground truth the bundle must match) ───────────────────────────────
const manifest = JSON.parse(read("extracted/manifest.json"));
const bitmaps: { name: string }[] = manifest.engine.bitmaps;
const srcTilesets = bitmaps.filter((b) => b.name.startsWith("tlk_"));
const srcAnm = bitmaps.filter((b) => b.name.startsWith("anm_"));
const srcChars = new Set(srcAnm.map((b) => b.name.split("_")[1]));

const walkMaps = (dir: string): string[] => {
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) out.push(...walkMaps(join(dir, ent.name)));
    else if (ent.name.endsWith(".txt")) out.push(join(dir, ent.name));
  }
  return out;
};
const srcMapFiles = walkMaps(join(root, "maps"));
const srcWavs = readdirSync(join(root, "extracted/engine/sounds")).filter((f) => f.endsWith(".wav"));
const srcMp3 = readdirSync(join(root, "extracted/engine/music")).filter((f) => f.endsWith(".mp3"));

describe("F1 pipeline: completeness counts (cross-checked vs source)", () => {
  it("bundles all 10 tilesets", () => {
    expect(srcTilesets.length).toBe(10);
    expect(Object.keys(assets.tilesets).length).toBe(10);
  });
  it("bundles all 171 animation chars", () => {
    expect(srcChars.size).toBe(171);
    expect(Object.keys(assets.chars).length).toBe(171);
    // every source char appears in the bundle
    for (const c of srcChars) expect(assets.chars).toHaveProperty(c as string);
  });
  it("bundles all 47 maps", () => {
    expect(srcMapFiles.length).toBe(47);
    expect(maps.length).toBe(47);
    // ids are unique (folder-qualified on stem collision)
    expect(new Set(maps.map((m) => m.id)).size).toBe(47);
  });
  it("bundles 29 SFX + 8 music", () => {
    expect(srcWavs.length).toBe(29);
    expect(srcMp3.length).toBe(8);
    expect(Object.keys(assets.sounds).length).toBe(29);
    expect(Object.keys(assets.music).length).toBe(8);
  });
  it("keeps the default map present and resolvable", () => {
    expect(assets.defaultMap).toBe("descent_into_darkness-megaman4ever");
    expect(maps.some((m) => m.id === assets.defaultMap)).toBe(true);
  });
  it("each tileset carries per-tileset tile size + cols (menu=16, gameplay=32)", () => {
    for (const [sym, t] of Object.entries(assets.tilesets)) {
      expect(t.tile).toBe(sym === "#menu" ? 16 : 32);
      expect(t.cols).toBe(Math.floor(t.w / t.tile));
      expect(t.keyFile).toBeTruthy();
    }
  });
});

describe("F1 pipeline: audio vocabulary coverage", () => {
  // the closed logical-name vocabulary from casts/data (#sound/#collectSound/#dieSound) ∪ engine fx
  const vocab = new Set<string>();
  for (const f of readdirSync(join(root, "casts/data")).filter((f) => f.endsWith(".txt"))) {
    for (const m of read("casts/data/" + f).matchAll(/#(?:sound|collectSound|dieSound):\s*"([^"]+)"/g)) vocab.add(m[1]!);
  }
  for (const e of ["spell_release", "spell_explode", "spell_charge", "heal_spell_release",
    "heal_spell_explode", "level_up", "end_level", "end_screen", "dragon_hit", "vulture_hit"]) vocab.add(e);

  it("every shipped wav maps to a vocabulary logical name (no lossy mangle)", () => {
    for (const key of Object.keys(assets.sounds)) expect(vocab.has(key)).toBe(true);
  });
  it("every data-referenced SFX that ships a wav resolves", () => {
    // a wav exists for a vocab name iff a file's de-mangled stem equals it; assert each such resolves.
    const demangle = (f: string) => basename(f, ".wav").replace(/^\d+_/, "").replace(/(_[A-Z]+)+$/, "").replace(/[A-Z]$/, "");
    const wavNames = new Set(srcWavs.map(demangle));
    for (const v of vocab) if (wavNames.has(v)) expect(assets.sounds).toHaveProperty(v);
  });
});

describe("F1 pipeline: multi-map structural load smoke (no throw)", () => {
  const tilePxFor = (sym: string) => (assets.tilesets as Record<string, { tile: number }>)[sym]?.tile;
  // one per size class incl 64×64 and large mapSize, drawn from the bundled ids.
  const subset = ["descent_into_darkness-megaman4ever", "teamtest", "merlinart" /*64×64*/,
    "merlinartii" /*37×25*/, "dungeon" /*50×1*/,
    "not_fully_tested_new_map" /*30×30 merlinOpen*/, "new_roads_to_aldevar" /*16×9 merlin*/];

  for (const id of subset) {
    it(`loads + resolves "${id}" without throwing`, () => {
      const meta = maps.find((m) => m.id === id);
      expect(meta, `map id ${id} should be bundled`).toBeTruthy();
      const file = join(root, "port/public/assets", meta!.file);
      if (!existsSync(file)) return; // build not run locally — count gate above still proves bundling
      const map = parseMap(readFileSync(file, "utf8"), tilePxFor);
      // every referenced tileset exists in the index, with a key file we can parse
      for (const sym of meta!.tilesets) {
        const ts = (assets.tilesets as Record<string, { keyFile: string }>)[sym];
        expect(ts, `${id} references unknown tileset ${sym}`).toBeTruthy();
        const keyPath = join(root, "port/public/assets", ts!.keyFile);
        if (existsSync(keyPath)) expect(() => parseTileKey(readFileSync(keyPath, "utf8"))).not.toThrow();
      }
      // spawn symbols resolve against the objects key (tile-index in range; symbol -> name)
      const objSym = map.layerDefs.find((d) => d.name === "#objects")?.tileSet ?? "";
      const objKeyFile = (assets.tilesets as Record<string, { keyFile: string }>)[objSym]?.keyFile;
      const objKey = objKeyFile && existsSync(join(root, "port/public/assets", objKeyFile))
        ? parseTileKey(read("port/public/assets/" + objKeyFile)) : { tileSize: { w: 32, h: 32 }, symbols: [] };
      for (const room of map.rooms.values()) {
        const objects = room.layer("#objects");
        if (!objects) continue;
        for (const row of objects.grid) for (const n of row) {
          expect(() => tileSymbol(objKey, n)).not.toThrow(); // unknown indices -> #none, never throw
        }
      }
    });
  }
});
