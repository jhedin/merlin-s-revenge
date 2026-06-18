# Extracted assets from the Director binaries

This folder holds content pulled out of the two compiled Adobe/Macromedia
Director movies in the project root, as a starting point for a
TypeScript / HTML5 port:

- `merlin_engine_76_speed.dir` — the game engine (`engine/`)
- `map_editor_open_40_*.dir` — the map editor (`map_editor/`)

Both are little-endian RIFX (`XFIR`) movies authored in **Director MX 2004
(v10)**. Everything here was produced by `tools/extract_assets.py` (assets)
and [ProjectorRays](https://github.com/ProjectorRays/ProjectorRays) (scripts);
nothing here is hand-edited, so it can be regenerated at any time.

## What's where

| Path | Count | Source | Notes |
|------|------:|--------|-------|
| `engine/bitmaps/*.png` | 3104 | `BITD` cast members | sprites, tilesets, UI, fonts — 1/8/16/**32-bit (ARGB)** decoded, alpha preserved |
| `engine/sounds/*.wav` | 29 | `sndH`+`sndS` | **only copy of the audio** — no loose sound files exist in the project |
| `engine/scripts/*.ls` | 348 | decompiled Lingo | full source recovered by ProjectorRays |
| `engine/scripts/*.lasm` | 348 | Lingo bytecode | assembly listing for each script (verification / fallback) |
| `map_editor/bitmaps/*.png` | 43 | `BITD` | editor UI bitmaps |
| `map_editor/scripts/*` | 118 | decompiled Lingo | editor logic |
| `engine/scenes.json` | 16 | Score `VWLB` labels + `movieMaster`/`screenMaster` | the movie's screens/scenes + flow wiring |
| `manifest.json` | — | derived | name→file index of every extracted asset |

## Scenes / screens (`engine/scenes.json`)

The Director movie defines 16 frame-marker "screens" (title, key config, the four
`animScreen*` cutscene hosts, `gameScreen`, pause menu, credits, etc.). Crucially the
**Score is not a runtime timeline** — the playhead is pinned on frame 1 (the `loop frame`
behavior) and `screenMaster.initScreenList` snapshots each marker's static sprite layout at
boot, compositing them on demand via `movieMaster.goScreen(sym, #fade)`. So scenes port to a
small `Scene`/state machine, not Score playback. Only `gameScreen` is gameplay; 3 markers are
dead/unused/transient (`3DMode`, `New Marker`, `initMap`).

**Known gap — per-screen pixel layout (`screen_layout_extraction: DEFERRED`).** The `VWSC`
Score uses a pooled/pointer-encoded sprite format (dedup data pool + 3773-entry frame offset
table + per-frame pointer records); field-accurate decode is high-effort/low-value. Screens
are instead reconstructed from `objMenu` text-definitions + the extracted background bitmaps,
refined visually during the port. The original `.dir` remains in the repo if a full decode is
ever wanted.

Filenames are `<resourceID>_<castMemberName>.png` / `<index>_<name>.wav`,
with names recovered from each cast member's info block where present.

## How this changes the port plan (important)

The game's **logic and data are not trapped in the binary** — they already
live as plain text in the project's `casts/` folder (~660 files, 1,849 Lingo
handlers) and are loaded by the engine at runtime (see the root `readme.txt`).
That loose source is the authoritative, complete copy of both the gameplay
**and** the engine objects (`obj*`, `mod*`).

So the decompiled `scripts/` here mostly **overlap** the loose `casts/`
source. Their added value is:

1. recovering the handful of **movie-/frame-level scripts** that aren't loose
   files (`GameInitGlobals`, `Loader`, `loadScripts`, the global `Geom*` /
   `Point*` / `Rect*` / `List*` helper library, etc.);
2. the **map editor** logic, which has no loose-text equivalent;
3. acting as a **cross-check** that the loose `.txt` source matches what was
   actually compiled into the shipped engine.

The binaries' genuinely unique payload is therefore the **art and audio**
(`bitmaps/`, `sounds/`) — those exist only inside the `.dir`. Note some
bitmaps may overlap with the loose `gfx/` source art, but here they are in
final, engine-ready form (consolidated atlases, 32-bit with alpha).

## Format notes (for anyone extending the extractor)

- **Container**: RIFX, little-endian. The `mmap` chunk lists every resource;
  the `KEY*` chunk links child resources (`BITD`, `sndH`/`sndS`, `STXT`, …) to
  their owning `CASt` member.
- **Cast members** (`CASt`): `>III` header = (type, infoLen, specificDataLen),
  then the info block, then the type-specific data.
- **Bitmaps** (`BITD`): specific data holds `pitch`, the bounding rect (depth
  is `pitch / width` bytes), reg point, and bit depth at offset 23. Pixels are
  PackBits-RLE compressed. 32-bit is stored **planar per scanline** in
  `A, R, G, B` order. Transparency lives in the alpha plane (and, for 24 cast
  members, separate `ALFA` chunks — not yet applied here).
- **Sounds**: `sndH` header gives sample rate (offset 0x30), channels (0x4c)
  and bytes/frame (0x50); `sndS` is big-endian signed PCM (byte-swapped to
  little-endian for WAV). A few high rates read as 88200 may actually be
  44100 — the header field is taken at face value.

## Regenerating

```sh
python3 extracted/tools/extract_assets.py merlin_engine_76_speed.dir extracted/engine
# scripts (needs a built ProjectorRays binary):
projectorrays decompile merlin_engine_76_speed.dir --dump-scripts -o engine_scripts
```
