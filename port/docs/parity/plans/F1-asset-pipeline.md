# F1 — Complete the asset pipeline ("maps are data; the engine must load whatever the data ships")

Status: PLAN. Owner domain: agent 5 (world/render/pipeline). Prereqs: A1/B1/B2 ☑ (engine
faithful). Unblocks: C (spell roster), D (per-enemy sprites), E (bosses) — they need the art,
maps, and audio the engine can already drive but the pipeline doesn't yet ship.

Grounding: `port/tools/build_assets.ts` (the slice-copier today), `extracted/manifest.json`
(name→file index of every extracted bitmap/sound), `extracted/README.md`,
`casts/master_objects/animStripMaster.txt` + `spriteMaster.txt` + `soundMaster.txt`,
`casts/data/tlk_*_key.txt`, `maps/**/*.txt`, and the consumers `port/src/render/{assets,renderer}.ts`,
`port/src/components/anim.ts`, `port/src/world/map.ts`, `port/src/systems/audio.ts`, `port/src/main.ts`.

---

## (a) The real asset inventory (counts + keying)

All counts measured from `extracted/manifest.json` and `maps/`/`casts/` — not guessed.

### Tilesets — **10 sheets = 4 families × {Passive, Active, Objects} (+ menu)**

`tlk_` bitmaps in `extracted/engine/bitmaps` (10) and `tlk_*_key.txt` in `casts/data` (10):

| family | symbol stems | sheet bitmaps (name as extracted) | key file | tile px |
|---|---|---|---|---|
| merlin | `#merlinPassive/Active/Objects` | `tlk_merlinPassiveD` (224×416), `tlk_merlinActiveEm` (256×544), `tlk_merlinObjectsE` (256×352) | `tlk_merlin{Passive,Active,Objects}_key.txt` | 32 |
| merlin4 | `#merlin4Passive/Active/Objects` | `tlk_merlin4PassiveK` (224×448), `tlk_merlin4ActiveH` (256×608), `tlk_merlin4ObjectskMoaCfFormat_PNGK` (256×448) | `tlk_merlin4{…}_key.txt` | 32 |
| merlinOpen | `#merlinOpenPassive/Active/Objects` | `tlk_merlinOpenPassiveLgNiL` (351×447), `tlk_merlinOpenActiveLgHUL` (351×735), `tlk_merlinOpenObjectsLg` (351×735) | `tlk_merlinOpen{…}_key.txt` | 32 |
| menu | `#menu*` | `tlk_menuC0O_L` (48×64) | `tlk_menu_key.txt` | **16** |

Keying notes (the gap-makers):
- **Bitmap names are Director-name-mangled.** The sheet for `#merlin4Objects` is extracted as
  `tlk_merlin4ObjectskMoaCfFormat_PNGK`; `#merlinObjects` is `tlk_merlinObjectsE`. So the
  symbol→sheet match must be a **longest-unique-prefix match on `tlk_<family><Layer>`**, not equality
  (today's `startsWith("tlk_merlin4Passive")` works for the 3 it picks but is unscalable).
- **tile size is per-tileset, read from the key file's `tileSize | point(w,h)` directive** (32 for
  gameplay, 16 for menu) — not a global `TILE=32`. `cols = floor(sheet.w / tileSize.w)`.
- Maps reference tilesets by symbol in `#layerDefinitions[].tileSet`. Across all 47 maps the
  referenced families are: **merlin (25 maps), merlin4 (14), merlinOpen (8)**; `menu` is UI-only.
  So the runtime must resolve any of the 9 gameplay sheets per map.

### Animation chars / strips — **171 distinct chars, 2,211 `anm_` frame bitmaps (~14 MB)**

Member name format (per `animStripMaster.addFrame`): `anm_<chr>_<animName>_<delay>_<frameNo>`,
underscore-separated; `[1]="anm"`, `[2]=chr`, `[3]=animName(action)`, `[4]=delay`, last=frameNo.
- `extracted/manifest.json` bitmaps with `name` starting `anm_`: **2,211**; **171 distinct chars**
  (token `[2]`). Today's `CHARS` list bundles **~26 chars → ~125 anims**; the other ~145 chars fall
  back to `blackOrc` via `spriteCharOr`. Goal: **all 171**.
- Each frame carries `reg:[x,y]` (regpoint) and `w,h` in the manifest (already correct — the upstream
  regpoint extraction bug is fixed). Regpoints drive `Sprite.regX/regY` (draw at `x-regX, y-regY`,
  flip mirrors about the anchor) — see `renderer.ts`.

### Maps — **47 single-line Lingo prop-lists across 6 folders**

`maps/works` 20, `maps/not_fully_tested` 14, `maps/wont_work` 6, `maps/some_bugs` 4, `maps/new` 2,
`maps/` 1 = **47**. Each is `[#map: [#mapSize, #roomSize, #startRoom, #endRoom, #roomMapScale,
#layerDefinitions:[…], #rooms:[[#num, #layers:[[#name, #map:[[…grid…]]]]]] ]]`.
- **Size variety (why the loader/atlas must be size-general):** roomSize ∈ {18×9 (38 maps), 16×9 (3),
  35×18 (3), 16×12, 37×25, **64×64**}; mapSize ranges 1×1 … **30×30**, **50×1**, 15×15.
- Layers shipped: every map uses exactly `#backgroundPassive`, `#backgroundActive`, `#objects`
  (2,790 each). **No `#foregroundPassive` ships** — the loader still shouldn't choke if one appears
  (F1 just bundles/loads; foreground *render* is F3, see seams).
- The `_key.txt` for the active and objects layers of each referenced tileset must accompany the map
  (active key → collision symbols, objects key → spawn symbols).

### Audio — **29 SFX (wav) + 8 music (mp3)**

- SFX: `extracted/engine/sounds/*.wav`, **29**, named `NNN_<logicalName><MANGLE>.wav`. The MANGLE is a
  Director name suffix: a trailing capital (`…C`,`…D`) or an underscore-uppercase tail (`_U`, `_U_EL`).
  Examples: `005_wizard_punchC.wav`, `003_skeleton_fireC.wav`, `014_boulder_fire_U.wav`,
  `017_tree_die_U_EL.wav`, `009_collect_powerup_01C.wav`.
- **Data references a closed vocabulary of logical names** (from `casts/data`): `#sound:` /
  `#attack.sound` → `wizard_punch, skeleton_fire, blackOrc_fire, boulder_fire, darkGolem_fire,
  dragon_fire, fangBunny_fire, fangBunnyBaby_fire, goblin_fire, hydra1_fire, hydra2_fire, orc_fire,
  quadranid_fire, vulture_fire`; `#collectSound:` → `collect_powerup_01/02`; `#dieSound:` →
  `blackOrc_die, boulder_die, goblin_hut_die_02, greyGhost_die, tree_die`. Plus engine effects
  `spell_release/explode/charge, heal_spell_release/explode, level_up, end_level, end_screen,
  dragon_hit, vulture_hit`.
- Music: `extracted/engine/music/*.mp3`, **8**, keyed by basename (already faithful):
  `baroque_rock_v1, electronic_merlin_v1_02, last_stand_v4, woods_of_evil_v1, final_stand_2_v1,
  merl2319_v1, the_ultimate_song_thing_v1, baroque_rock_techno_v1`.

### The animStripMaster model (and how `anim.ts`/`spriteCharOr` consume it)

`animStripMaster` builds `pAnimData[chr][action] = [ {#mem, #dela}, … ]` (chars → actions → ordered
frames). Three behaviors the manifest must preserve:
1. **Per-frame delay** — each frame entry has its own `#dela` (token `[4]`). For shipped strips the
   delay token is uniform per strip, so a single `delay` per anim is *usually* right, but
   `seperateMembers`-shared and mixed strips can vary. (Variable per-frame delay + `gGameSpeed`
   scaling is F3's render-fidelity concern; F1 records per-frame `dela` so F3 can use it.)
2. **`seperateMembers`** — a member named `"a b c"` (space-separated) belongs to **multiple** strips.
   Today's builder splits on `_` only and misses this. F1 must split the member name on spaces first,
   then process each token as its own `anm_…` name (a handful of members; correctness, not cosmetics).
3. Frame order = numeric prefix of the last token; sort ascending.

Consumers today: `anim.ts.spriteCharOr(name)` checks `index.anims[`${name}_stand`]` and falls back to
`blackOrc` when absent — so bundling all 171 chars is what makes "any actor's anims" real. `Anim`
reads `index.anims[char_action].{delay, frames[].{file,reg,w,h}}`, advances on a tick `delay`, and a
hard-coded `ONE_SHOT` set decides loop-vs-hold. (Data-driven loop flags & per-frame delay = F3.)

---

## (b) Gap vs the slice-copier today (`build_assets.ts`)

| Area | Today (vertical slice) | Required (F1) |
|---|---|---|
| Tilesets | hard-codes 3 (`merlin4` P/A/O) by literal prefix; global `TILE=32` | all **10** sheets, symbol→sheet by unique-prefix match, **per-tileset tile size** from key file |
| Tile keys | copies 2 files (`active_key`, `objects_key`) for the one staged map | every tileset's `_key.txt` indexed and resolvable per map/layer |
| Anim chars | hard-coded `CHARS` (~26) → ~125 anims; rest fall back to `blackOrc` | **all 171 chars**; `seperateMembers` (space-split) honored; per-frame `dela` recorded |
| Atlas | none — each of 2,211 frames is an individual PNG copy + HTTP load | **per-char atlas PNG + JSON manifest** (regpoints/delays) to cut draw-image count & requests |
| Maps | copies **1** map to `map.txt`; runtime fetches that one | all **47** maps bundled + a manifest; runtime **loads any** by id |
| Audio | regex `sfxName()` strips index + trailing caps **heuristically** (lossy) | **vocabulary-driven** mapping (match wav → the closed set of data names) |
| Output | flat `assets.json` + loose PNGs | `assets.json` index + atlases + `maps.json` + per-map key bundle |

---

## (c) Pipeline design

### Output format (decision)

**Per-character sprite atlas + a JSON animation manifest, mirroring `animStripMaster`.** Rationale:
2,211 individual PNGs = 2,211 HTTP requests and draw-images; the engine already addresses frames by
`(file, sx, sy?, w, h, reg)`. One atlas per char (171 atlases) keeps each load small enough for
**lazy per-char / per-map loading** (needed — 14 MB total is too much to eager-load, and a 64×64-room
map only touches a handful of chars). Atlas-per-char (not one mega-atlas) is the sweet spot: bounded
file count, natural lazy unit, simple bin-packing per char.

Generated artifacts (all under `port/public/assets/` + `port/src/generated/`):

```
generated/assets.json
  tile?: removed (per-tileset now)
  tilesets: { "#merlinActive": { file, w, h, tile, cols, keyFile }, … }   // all 10
  chars:    { "blackOrc": { atlas: "atlas/blackOrc.png", w, h }, … }       // all 171, lazy
  anims:    { "blackOrc_walk": { delay, frames: [ {atlas, x,y,w,h, reg:[x,y], dela} … ] }, … }
  sounds:   { "wizard_punch": "sounds/005_wizard_punchC.wav", … }          // vocabulary-mapped
  music:    { "baroque_rock_v1": "music/baroque_rock_v1.mp3", … }
generated/maps.json   // [ { id, name, folder, file: "maps/<id>.txt", roomSize, mapSize, tilesets:[…] } × 47 ]
public/assets/atlas/<char>.png            // 171 atlases
public/assets/tilesets/<symbol>.png       // 10 sheets, copied under stable names
public/assets/keys/<tileset>_key.txt      // 10 key files
public/assets/maps/<id>.txt               // 47 maps
public/assets/sounds/*.wav, music/*.mp3
```

### `build_assets.ts` rewrite (extend, keep the proven bits)

1. **Tilesets (all 10).** For each of the 4 families × {Passive,Active,Objects} + menu: find the
   bitmap by unique-prefix `tlk_<family><Layer>`; read tile size from the matching `tlk_*_key.txt`
   `tileSize | point(w,h)`; emit `{ file, w, h, tile, cols: floor(w/tile), keyFile }` keyed by symbol.
   Copy each sheet to a stable name and each `_key.txt` to `keys/`.
2. **Anims (all 171, atlas-baked).** Collect every `anm_` bitmap. Apply `seperateMembers`
   (space-split member names → multiple logical names) **before** the `_`-split. Group by `chr` →
   `action`; sort frames by numeric last-token. For each char, **bin-pack its frames into one atlas
   PNG** (row-packing by max frame height is sufficient; record each frame's `(x,y,w,h)`); preserve
   `reg` and per-frame `dela`. Use a Node canvas/PNG lib already available to the toolchain, or, if
   none, fall back to a simple grid atlas (uniform cell = max w×h) — both are deterministic. Emit
   `chars` + `anims` as above.
3. **Maps (all 47).** Copy every `maps/**/*.txt` to `public/assets/maps/<id>.txt` (id = filename stem,
   folder recorded). Parse each map's `#layerDefinitions[].tileSet` + `#roomSize`/`#mapSize` to fill
   `maps.json`. No `map.txt` singleton; `main.ts` selects by id (default = current `descent_into_darkness`).
4. **Audio (vocabulary-driven).** Build the **closed set of logical names** by scanning `casts/data`
   for `#sound:/#attack…/#collectSound:/#dieSound:` string values, union the engine-effect names. For
   each wav, compute candidate logical name = filename minus `^\d+_` prefix minus the MANGLE
   (`(_[A-Z][A-Z]?)*$` then a single trailing `[A-Z]`); **accept only if it lands in the vocabulary**;
   otherwise keep the de-mangled name and log a warning. This replaces the silent lossy regex with a
   verifiable map + a build-time report of unmatched names.
5. Print counts (tilesets/chars/anims/maps/sounds/music) for the verification gate.

### Consumer changes

- **`assets.ts`** — `AssetIndex` gains `tilesets[sym].{tile,cols,keyFile}`, `chars`, atlas-aware
  `anims` (`frames[].{atlas,x,y,w,h,reg,dela}`). `Assets.load` becomes **lazy**: load all 10 tileset
  sheets up front (small), but load char atlases on demand via `ensureChar(name)` /
  `ensureMapAssets(mapId)` (loads only the atlases for chars a map can spawn + its tilesets).
  `img()` returns the atlas; add `frameSrc(frame) → {img, sx, sy, sw, sh}`. `keyOutMatte` stays
  (run once per atlas at load; "global" for tilesheets, "flood" for char atlases — note flood must
  be per-frame-rect on an atlas, so run keying per-frame sub-rect or pre-bake transparency in the
  builder; pre-baking in the builder is cleaner and removes runtime `getImageData`).
- **`renderer.ts`** — `Sprite.img` becomes `{img, sx, sy, sw, sh}` (or accept a sub-rect) so
  `drawSprites` blits `drawImage(img, sx,sy,sw,sh, dx,dy,sw,sh)`. `drawTileLayer` already takes a
  `TileSheet{cols,tile}`; pass the **per-tileset** `tile`/`cols` (no global 32).
- **`anim.ts`** — `sprite()` returns the atlas sub-rect; `animFor` unchanged. `spriteCharOr` now
  resolves nearly always (171 chars) — keep the `blackOrc` fallback as a safety net only.
- **`map.ts`** — `parseMap` already reads `roomSize/mapSize/layerDefs` per map (faithful). Remove the
  `tilePx: 32` hard-code: resolve each layer's tile size from its tileset (carry `tileSet` symbol; the
  caller looks up `index.tilesets[sym].tile`). Keep dropping `#foregroundPassive` gracefully (don't
  throw) — its render is F3.
- **`main.ts`** — replace the 3 hard `fetch("/assets/{map,active_key,objects_key}.txt")` with a
  map-selection path: `loadMap(id)` → fetch `maps/<id>.txt`, resolve its tilesets + each layer's key
  from the index, `ensureMapAssets(id)`, build rooms. Default id keeps current behavior.
- **`audio.ts`** — no code change needed; it already keys off `index.sounds`. The fix is in the
  builder's mapping. (Per-effect channel counts / 0–255 volume from `soundMaster` remain a separate
  small playback-fidelity item, not F1.)

---

## (d) Implementation order

1. **Substrate (builder, no consumer break).** Rewrite `build_assets.ts` tileset section (all 10,
   per-tileset tile size, prefix-match) and audio section (vocabulary map) — these are additive to
   `assets.json` shape that's backward-compatible-ish; bump the index version. Land with the counts
   printout. *(Pipeline-first per the audit's "substrate before wiring".)*
2. **Atlas baking + anims (all 171).** Add atlas bin-packing + `chars`/atlas-aware `anims` to the
   builder; emit `maps.json` and copy all 47 maps + 10 keys. Builder now produces the full bundle.
3. **Consumer wiring.** Update `assets.ts` (atlas + lazy load), `renderer.ts` (sub-rect blit + per-
   tileset tile), `anim.ts` (sub-rect), `map.ts` (per-tileset tile px). Keep room-1 rendering identical.
4. **Load-any-map.** Wire `main.ts` `loadMap(id)` + `ensureMapAssets`; add a dev map-picker (query
   param `?map=<id>`). Default unchanged so the existing flow is untouched.
5. **Audio mapping verification** + builder report wired into the count gate.

Each step is independently testable; steps 1–2 don't touch product render code (only the builder +
generated files), matching the constraint that this plan changes *pipeline*, with consumer edits
gated behind their own steps.

---

## (e) Test / verification plan (prove completeness without manual inspection)

1. **Count gate (builder self-report → asserted in a test).** A `pipeline.test.ts` parses
   `assets.json` + `maps.json` and asserts: `tilesets == 10`, `chars == 171`,
   `anims >= <N>` (frozen from a baseline scan of `anm_` actions), `maps == 47`, `sounds == 29`,
   `music == 8`. Cross-check each against a fresh scan of `extracted/manifest.json` / `maps/` so the
   numbers track source, not a stale constant.
2. **Audio vocabulary coverage.** Assert **every data-referenced SFX name resolves** to a wav
   (intersection of the `casts/data` vocabulary with `assets.json.sounds` is complete; report any
   unmatched — currently the suspect ones are `wizard_punch`, `boulder_*`, `tree_die`, `*_die`).
   Extend `port/test/audio.test.ts`'s `has()` checks with the real keys.
3. **Multi-map render smoke (headless).** Loop over a representative subset (e.g. one per roomSize:
   18×9 `teamtest`, 16×9, 35×18, 37×25, **64×64**, and a large mapSize like `50×1`/`30×30`): for each,
   `parseMap` → resolve every layer's tileset+key from the index → assert all referenced tilesets
   exist in `assets.json`, every spawn symbol resolves, and a stub render (blit each room's layers to
   an offscreen canvas via the node-canvas test harness, or assert tile indices are in-range for the
   sheet `cols`) **completes without throwing**. This proves "load + render any map" structurally.
4. **Room-1 gate stays green.** `port/test/world.test.ts` (`teamtest` parse, 9×18 grids, tlk symbols,
   collision golden) and `collision_golden.test.ts` must pass unchanged — the slice's behavior is a
   subset of the complete pipeline.
5. **Atlas correctness spot-check (automated).** For a few chars, assert each anim's frame sub-rects
   are within the atlas bounds and the regpoint equals the manifest `reg` (no regpoint drift through
   the bake).

---

## (f) Risks

1. **Browser bundle size (highest).** 14 MB of `anm_` bitmaps + 3 large tileset families. Mitigation:
   **lazy per-char/per-map atlas loading** (load only what a map can spawn), atlas packing to cut
   request count, and PNG (already compressed). Eager-loading all 171 would stall first paint.
2. **Atlas baking correctness.** Bin-packing must preserve each frame's `reg` exactly and not bleed
   neighboring frames (1px gutter); a regpoint or sub-rect off-by-one silently mis-positions sprites.
   Mitigation: pre-bake matte-keying per frame in the builder (removes runtime `getImageData`), gutter
   padding, and the automated bounds/reg spot-check (e.5).
3. **Regpoint / anim fidelity.** `seperateMembers` (space-split) and per-frame `dela` must survive the
   bake or shared-strip chars mis-animate. F1 *records* per-frame `dela` and honors space-split; the
   *playback* of variable delay/loop flags is deferred to F3 but must not be lost in the data.
4. **Audio name collisions / misses.** Vocabulary-driven mapping can still miss if a wav's de-mangled
   name isn't in the data vocabulary (orphan SFX) or two wavs collapse to one name. Mitigation: build
   report of unmatched/duplicate names + the coverage test (e.2) — fail loud, not silently silent.
5. **Tileset prefix ambiguity.** `tlk_merlin*` names are mangled and `merlin` is a prefix of
   `merlin4`/`merlinOpen`. Match must be longest-unique / layer-qualified, or `#merlinActive` could
   grab `merlin4Active`. Mitigation: match on `tlk_<family><Layer>` with family disambiguated
   (`merlin` only when not followed by `4`/`Open`).

---

## (g) Out of scope (defer; named so the seams are explicit)

- **F2 — collision tile-types.** `#platform`/`#ceiling`/`#wallLeft`/`#wallRight` handling + directional
  collision events. F1 bundles every active `_key.txt` (so the symbols are *available*); interpreting
  non-`#solid` types is F2. (Shipped active keys are `#solid`/`#none` only.)
- **F3 — render fidelity.** `modColourTransform` tint palette, per-sprite alpha/blend, layer-Z model,
  **variable per-frame anim delay + data-driven loop flags + `gGameSpeed` scaling**, and the
  `#foregroundPassive` over-actor layer *render*. F1 records the data these need (per-frame `dela`,
  foreground layer not dropped destructively) but does not implement their playback.
- **Minimap status states / blend** (modMiniMap) — separate world/shell item.
- **The map editor** (`map_editor_open_40_*`, `mapEditMaster`, brushes, `saveMap`) — a separate
  executable, explicitly excluded by audit 05 §8. Maps are authored externally and ship as data; F1
  only *loads* them.
- **Per-tile screen-exit ranges, `#endRoom` win condition, exit arrows, live room-state restore** —
  loader-fidelity items tracked elsewhere in audit 05 §1/§5, not pipeline work.
