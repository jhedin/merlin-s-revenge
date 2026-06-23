# Title Screen Composition (Director Score, frame 30 = `titleScreen`)

**Source:** `merlin_engine_76_speed.dir` → `VWSC` (Score) chunk, frame 30.
**Recovered by:** `extracted/tools/dump_score.py` (delta-replay + D7/D10 sprite-record decode).
**Machine-readable copy:** `extracted/engine/title.json` (consumed by `port/tools/build_assets.ts`).

> Resolves the long-standing GAP 9 in `rendering-fidelity.md` ("title background DEFERRED —
> no large title-screen bitmap identifiable"): the title is **not** one big bitmap, it is a
> composite of individual letter glyphs + decorative tiles/sprites laid out by the Score.

## How it was recovered

The `VWSC` chunk header is big-endian: `[12] numFrames=3773`, with a per-frame `u32` offset
table at byte 32. Each table entry is the absolute chunk offset of that frame's delta block; the
block is a stream of `(u16 writeOffset, u16 size, <size> bytes)` records written into a persistent
~48 KB Score channel buffer. Replaying blocks cumulatively to frame 30 reconstructs the buffer.

The live sprite array starts at buffer **offset 256** (a 256-byte main-channel header precedes it);
each channel is a **48-byte D7/D10 sprite record**:

| off | field | off | field |
|-----|-------|-----|-------|
| 0 `u8` spriteType | 1 `u8` ink (`&0x3f`) | 2 `u8` foreColor | 3 `u8` backColor |
| 4 `u16` **castLib** | 6 `u16` **memberID** | 8 `u32` spriteListIdx | 12 `u16` **locV** (y) |
| 14 `u16` **locH** (x) | 16 `u16` height | 18 `u16` width | 20+ flags/blend/reserved |

`memberID` resolves to a `CASt` chunk through the per-castLib `CAS*` member table (a big-endian
`u32` array indexed by `memberID-1`). The owning castLib is encoded in the `CAS*` chunk's KEY*
owner id as `(castLib << 16) | 0x400`. The resolved chunk id matches the extracted manifest's
bitmap `id`. **Validation:** the row-1 glyph widths `91,67,81,63,30,82,68` exactly match the
extracted `M,E,R,L,I,N,S` bitmaps, and every locH/locV lands on the 576×288 stage.

`locH/locV` is the **registration-point** position; the bitmap top-left = `(locH - reg.x, locV - reg.y)`.

## Composition (channel = draw order, back→front)

The title is **3 layers**:

### 1. Backdrop tiles (`gfx` cast, ink 9 = background-transparent, **stretched**)
| ch | member | bitmap | loc (x,y) | sprite w×h | bitmap w×h |
|----|--------|--------|-----------|-----------|-----------|
| 16 | `background`   | `bitmaps/00048_background.png`   | (52,126)  | 84×72 | 64×10 |
| 18 | `background02` | `bitmaps/00046_background02.png` | (585,46)  | 90×72 | 64×10 |

(Both are small 64×10 bar-pattern tiles **scaled up** to the sprite rect — this is exactly why the
earlier audit's name-matched `background` member looked wrong at 64×10.)

### 2. Logo lettering — "MERLIN'S" (row 1, y=9) + "REVENGE" (row 2, y=90)
All `gfx` cast, ink 36, native size (reg `[0,0]`, so loc = top-left):

| ch | glyph | bitmap | loc (x,y) | w×h |
|----|-------|--------|-----------|-----|
| 1 | M | `bitmaps/00053_M.png` | (10,9)   | 91×72 |
| 2 | E | `bitmaps/00057_E.png` | (104,9)  | 67×72 |
| 3 | R | `bitmaps/00051_R.png` | (174,9)  | 81×72 |
| 4 | L | `bitmaps/00054_L.png` | (254,9)  | 63×72 |
| 5 | I | `bitmaps/00055_I.png` | (319,9)  | 30×72 |
| 6 | N | `bitmaps/00052_N.png` | (351,9)  | 82×72 |
| 7 | ' (apostrophe, `kL`) | `bitmaps/00115_kL.png` | (435,9) | 30×29 |
| 8 | S | `bitmaps/00050_S.png` | (467,9)  | 68×72 |
| 9 | R | `bitmaps/00051_R.png` | (98,90)  | 81×72 |
| 10 | E | `bitmaps/00057_E.png` | (179,90) | 67×72 |
| 11 | V | `bitmaps/00049_V.png` | (246,90) | 87×72 |
| 12 | E | `bitmaps/00057_E.png` | (333,90) | 67×72 |
| 13 | N | `bitmaps/00052_N.png` | (403,90) | 82×72 |
| 14 | G | `bitmaps/00056_G.png` | (488,90) | 72×72 |
| 15 | E | `bitmaps/00057_E.png` | (563,90) | 67×72 |

### 3. Decorative army/monster sprites (`gfx` cast, scattered around the lower-left + edges)
| ch | member | bitmap | loc (x,y) | w×h | reg |
|----|--------|--------|-----------|-----|-----|
| 17 | `anm_warrior_stand_03_01C` | `bitmaps/408279_anm_warrior_stand_03_01C.png` | (61,131) | 16×16 | [7,8] |
| 24 | `anm_ber_walk_06C` | `bitmaps/06471_anm_ber_walk_06C.png` | (38,142) | 16×16 | [8,8] |
| 25 | `anm_uli_naturalMelee_3_07C` | `bitmaps/09102_anm_uli_naturalMelee_3_07C.png` | (24,145) | 20×16 | [10,8] |
| 26 | `WWLK0001` | `bitmaps/00044_WWLK0001.png` | (51,151) | 16×16 | [8,8] |
| 27 | `anm_warrior_stand_03_01C` | `bitmaps/408279_anm_warrior_stand_03_01C.png` | (47,119) | 16×16 | [7,8] |
| 28 | `5_anm_fourArmGolem_naturalRanged_01_03G` | `bitmaps/442000_5_anm_fourArmGolem_naturalRanged_01_03G.png` | (601,54) | 61×69 | [32,45] |
| 29 | `anm_archer_weaponRanged_02_01D` | `bitmaps/26836_anm_archer_weaponRanged_02_01D.png` | (26,107) | 26×24 | [16,16] |
| 30 | `anm_monk_walk_03_06C` | `bitmaps/12922_anm_monk_walk_03_06C.png` | (19,126) | 16×16 | [7,8] |
| 31 | `anm_doubleDarkGolem_stand_03_01K` | `bitmaps/441947_anm_doubleDarkGolem_stand_03_01K.png` | (571,56) | 39×65 | [24,43] |

### Text / UI members (no bitmap — Lingo field/button members)
These `gfx` members carry no `BITD`, so they render as live text fields / buttons in Director.
They are the menu/credit labels overlaid on the title and are reproduced with the bitmap font:

| ch | member | name | loc (x,y) | w×h |
|----|--------|------|-----------|-----|
| 0 | 36 | `episode` | (554,161) | 78×12 |
| 19 | 39 | `version` | (546,175) | 85×12 |
| 20 | 56 | `butt_copyright` | (44,303) | 323×12 (off-stage footer) |
| 21 | 57 | `butt_tmbLink` | (412,303) | 182×12 (off-stage footer) |
| 22 | 74 | `dd_menu_title` | (230,180) | 224×64 |
| 23 | 58 | `dd_playMusic_stopMusic` | (0,-23) | 224×16 (off-stage) |

(The interactive menu buttons themselves — Intro / Start / Reload / Instructions / Credits — are
created by Lingo, not Score sprites, so they live in the port's `Menu` scene, not here.)

## Notes for the port

- The title is composited from **`gfx`-cast members**, all bundled into `assets.json` under a new
  `title` array by `build_assets.ts` (reading `extracted/engine/title.json`).
- The two `background*` tiles must be **stretched** to their sprite rect (64×10 → 84×72 / 90×72).
- Glyphs render at native size at `(locH, locV)` (reg `[0,0]`); the decorative sprites render at
  `(locH - reg.x, locV - reg.y)`.
- `animScreen` (frame 120) is a **cutscene host surface** with no static Score composition (per
  `extracted/engine/scenes.json` it is composited at runtime by `cutSceneMaster`), so there is no
  title-style sprite list to recover there.
