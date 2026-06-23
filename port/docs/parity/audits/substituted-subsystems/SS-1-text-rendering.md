# SS-1 — Text rendering: canvas system fonts instead of original bitmap fonts

Status: **OPEN — audit + plan (renderer not implemented here).**
Class: substituted subsystem (whole text-render subsystem reimplemented procedurally; the `fnt_*`
glyph-sheet family goes unbundled).

---

## 0. Verdict (traced, not asserted)

- The original renders **all** on-screen text by blitting per-glyph sprites out of four bitmap
  font sheets (`fnt_menu` / `fnt_numbers` / `fnt_small` / `fnt_smallgrey`) via `objFont`, sized by
  a `#charSize` point read from a sibling `*_properties` `#field`. Colour is a per-sprite **tint**
  applied to a white-on-matte (or grey) glyph mask (`setSpriteColor`), not baked per glyph.
- The port draws every string with `ctx.fillText` + `ctx.font = "...serif"/"...monospace"` — generic
  system fonts, wrong glyphs and wrong metrics (e.g. HUD `Lv`, `Kits`, lives, flash msgs; the title;
  all menus; cutscene titles + speech; the army/keys screens).
- **`build_assets.ts` never touches `fnt_*`.** It bundles `tlk_*` (tilesets), `anm_*` (animations),
  `*_ws*` (weapon icons) and a hardcoded `MEMBER_NAMES` list — there is no `fnt_` branch. Verified:
  `grep -ic fnt src/generated/assets.json` → **0**. The glyph sheets sit in `extracted/` unbundled.
- The glyph **metrics** (`theKey`, `charSize`, `gap`) *are* already in the bundle: the four
  `fnt_*_properties` `#field`s were parsed into `src/generated/data.json` (`grep -ic charSize
  data.json` → 1 line, all four present). They are **dead data** today — nothing reads them, and the
  matching glyph sheets aren't bundled, so they can't be used.

**Count of `ctx.fillText` call sites to convert: 31** (across 5 files; see §1.3).

---

## 1. SECTION 1 — Original text subsystem

### 1.1 `objFont` (casts/script_objects/objFont.txt) — glyph layout

`objFont` extends `objTileSet`. Construction (`collectionsMaster.initCollections`): every `data`-cast
member whose name starts with `fnt_` becomes an `objFont`, keyed by the symbol after the prefix
(`fnt_menu` → `#menu`, `fnt_numbers` → `#numbers`, `fnt_small` → `#small`, `fnt_smallgrey` →
`#smallgrey`). Members containing `"properties"` are skipped (`pNamesToSkip`).

`initLetterProperties` loads the sibling `member("<name>_properties","data")` and `value()`s its text
to a prop-list:
- `pLetterKey  = .theKey`   — the ordered glyph string; a char's **tile index = StringGetPos(key, char)**
  (1-based, left-to-right along the sheet). `getLetterNum` returns 0 for chars not in the key (skipped).
- `pLetterSize = .charSize`  — `point(w,h)`; passed to `objTileSet` as `tileSize`. **This is the cell
  size the sheet is sliced into**, NOT the bitmap height/width. Authoritative for addressing.
- `pLetterGap  = .gap`       — inter-letter gap (0 for all four fonts; the tile-map packs cells flush).

`objTileSet.makeTiles` slices `allTilesImage` into `floor(w/tileW) × floor(h/tileH)` cells via
`copyPixels`; `getTileNo(i)` returns cell `i`. `getString(theString)` builds an `objTileMap`
(`point(strLen,1)`), pokes each char's tile number, and `getImage()` composites the row into one
image. `getCharWidth` = `charSize.locH` (== width, since these are `point(w,h)` and Lingo `locH` = x).

There is **no kerning** — fixed-cell, gap 0, monospaced-by-cell. Strings are left-to-right, one row.

### 1.2 The four font families — metrics (from casts/data/fnt_*_properties.txt) + sheets

| symbol       | properties charSize | key (glyphs)                                   | #glyphs | engine sheet (extracted)             | sheet w×h | depth |
|--------------|---------------------|------------------------------------------------|---------|--------------------------------------|-----------|-------|
| `#menu`      | point(10,16)        | `A–Z a–z . , ( ) !`                             | 55      | `fnt_menuB` (id 5310)                | 1000×16   | 1-bit |
| `#numbers`   | point(8,10)         | `1234567890`                                    | 10      | `fnt_numbersC9S` (id 442989)         | 80×10     | 1-bit |
| `#small`     | point(8,10)         | `A–Z a–z . , ( ) : ; ! ?`                       | 58      | `fnt_smallCC` (id 5299)              | 609×12    | 1-bit |
| `#smallgrey` | point(7,8)          | `A–Z a–z`                                       | 52      | `fnt_smallgreyCC` (id 5883)          | 364×8     | 32-bit|

Verified slicing (index-based, charSize-driven — **trailing sheet pixels past the key are blank
padding, do NOT divide w by cells**):
- `numbers`: 80/8 = 10 cells == 10 keys, h 10 == charSize.y. Clean.
- `smallgrey`: 364/7 = 52 cells == 52 keys, h 8 == charSize.y. Clean.
- `small`: key 58 glyphs × 8 = 464px used; sheet is 609×12 → trailing padding + 2px extra height. The
  blitter must address cell `i` at `x = i*8`, take an 8×10 window (NOT 609/8 ≈ 76 cells, NOT h 12).
- `menu`: key 55 glyphs × 10 = 550px used; sheet 1000×16 → ~45 blank trailing cells. Address `x=i*10`.

**Matte / colour model** (corner sampling of the PNGs):
- `numbers`, `small`, `menu` are **black glyph on a white matte** (corners all `(255,255,255,255)`).
  Original drew with background-transparent ink and tinted the mask via `setSpriteColor(pColour)`
  (e.g. `objDisplayCounter` defaults white; potion counters pass the potion colour). → the port must
  **key out white → transparent**, then **tint the remaining (black) glyph** to the requested colour.
- `smallgrey` is **grey-on-dark RGBA** (corner `(24,8,16,255)`), already an alpha-style mask; key its
  dark matte and use as-is (or tint).

(`fnt_menuA`, id 1802, lives only in `extracted/map_editor/bitmaps` and is the editor copy — the
engine/gameplay sheet is `fnt_menuB`. `build_assets` reads `manifest.engine.bitmaps`, so only the
`*B`/`*CC`/`*C9S` engine variants are reachable; that's the correct set.)

### 1.3 manifest.json coverage

`extracted/manifest.json` **does list** all the engine font sheets (`fnt_menuB`, `fnt_numbersC9S`,
`fnt_smallCC`, `fnt_smallgreyCC` under `engine.bitmaps`, plus `fnt_menuA` under `map_editor`). So the
data is present and discoverable — the gap is purely that `build_assets` filters them out.

### 1.4 Every place the ORIGINAL renders text (the consumers)

| consumer (cast)                         | font symbol | what it draws                                   |
|-----------------------------------------|-------------|-------------------------------------------------|
| `objDisplayCounter`                     | `#numbers`  | zero-padded numeric counters (tinted)           |
| `objMedikitDisplayer` → DisplayCounter  | `#numbers`  | HUD medikit/kit count                           |
| `potionMaster.requestCounter` → Counter | `#numbers`  | potion tally counters (per-potion colour tint)  |
| `potionMaster.startTitle` → `objTextImage` | `#smallgrey` | potion-screen title (`pTitleFont=#smallgrey`) |
| `armyMaster` → `objTextImage`           | `#smallgrey` | reserve-army labels (`params.font=#smallgrey`) |
| `objTextImage` (default)                | `#menu`     | menu titles / centred screen titles             |
| `objMenuController` (`#fontObj=#menu`)  | `#menu`     | menu item labels                                |

So: **numbers → `#numbers`; menu titles/items → `#menu`; screen/potion/army labels → `#smallgrey`;
small body text → `#small`.** (No cast consumer of `#small` was found in this slice, but it's a
shipped, keyed font; reserve it for small body/speech text in the port — see §3a routing.)

---

## 2. SECTION 2 — Port `fillText` inventory + which `fnt_` each SHOULD use

`grep -n '\.fillText('` → **31 sites / 5 files**. (`ctx.font`/`measureText` lines counted separately;
54 total font-touching lines.) Each row below = a converted call.

### main.ts — 8 sites
| line | text drawn | target font |
|------|-----------|-------------|
| 451 | `MERLIN'S REVENGE` title (`bold 26px serif`) | `#menu` (scaled ×~2) |
| 453 | controls help line (`8px monospace`)         | `#small` |
| 454 | controls help line 2                          | `#small` |
| 480 | `Lv N` HUD                                     | `#small` label + `#numbers` for N |
| 481 | `✦` magic-acquired glyph                       | (icon, not a glyph in any key — keep procedural / use a member icon; not a font site) |
| 488 | `Kits N` HUD fallback                          | `#small` + `#numbers` |
| 491 | `♥ N` lives                                    | `#numbers` (`♥` not in any key — keep as icon) |
| 492 | `flashMsg` flash message                       | `#small` |

### scenes/menu.ts — 3 sites
| line | text | target |
|------|------|--------|
| 43 | menu title (`bold 16px serif`)  | `#menu` |
| 49 | menu item label (`▶ `+label)    | `#menu` (the `▶` arrow not in key → member/triangle glyph) |
| 52 | `↑/↓ select   space confirm`     | `#small` (arrows not in key → substitute or icon) |

### scenes/cutscenePlayer.ts — 7 sites
| line | text | target |
|------|------|--------|
| 72  | `move/click/esc: skip` hint   | `#small` |
| 107 | cutscene title (`bold 20px serif`) | `#menu` |
| 117 | `speaker:` label              | `#small` |
| 121 | `esc/space: skip` hint        | `#small` |
| 159 | wrapped speech line (box)     | `#small` |
| 167 | wrapped caption line          | `#small` |
| 170 | trailing caption line         | `#small` |
(`measureText` at 148/152/167 must be replaced by `font.measure(str)` from the blitter — see §3c.)

### scenes/weaponPalette.ts — 1 site
| line | text | target |
|------|------|--------|
| 84 | 3-char weapon abbreviation (`7px monospace`) | `#small` (or `#smallgrey`) |

### scenes/screens.ts — 12 sites
| line | text | target |
|------|------|--------|
| 105 | dwelling/credits line (title vs body) | `#menu` (i==0) / `#small` |
| 154 | `RESERVE ARMY` heading                 | `#menu` |
| 160 | empty-reserve note                     | `#small` |
| 172 | `L{level}` per-unit label              | `#small` + `#numbers` |
| 176 | `page X/Y …` footer                    | `#small` + `#numbers` |
| 202 | screen line (title vs body)            | `#menu` / `#small` |
| 205 | `esc/space: back`                      | `#small` |
| 215 | `CHOOSE KEYS` heading                  | `#menu` |
| 222 | scheme label row                       | `#small` |
| 230 | `The Current Keys are:`                | `#small` |
| 234 | key/desc table row                     | `#small` |
| 237 | `↑/↓ choose   space: OK   esc: cancel` | `#small` |

**Glyphs absent from every key** (port uses them today): digits `0` is in `#numbers` but `0` is
**also absent** in `#small`/`#menu`/`#smallgrey` keys (those carry no digits) → numbers must route to
`#numbers`. Symbols `▶ ✦ ♥ ↑ ↓ ← →` and lowercase punctuation like `/ - + space` are not in any key.
The blitter must (a) treat space as advance-only, and (b) for missing glyphs either skip, substitute,
or composite a small member icon — see §3c.

### 2.1 Bundle confirmation
- `build_assets.ts`: **no `fnt_` handling** — the only name filters are `tlk_`/`anm_`/`*_ws*`/the
  `MEMBER_NAMES` list. Glyph sheets are never `copyFileSync`'d to `public/assets`.
- `assets.json`: `grep -ic fnt` → **0**. No `charSize`/font metrics in `assets.json`.
- `data.json`: the four `fnt_*_properties` (`theKey`/`charSize`/`gap`) ARE present but unconsumed.

---

## 3. SECTION 3 — Fix plan

### (a) Inventory of draw sites → target sheet
See §1.4 (original consumers) and §2 (31 port sites with per-line target). Routing summary:
- **Numbers** (HUD counters, `Lv N`, `L{lvl}`, `page X/Y`, kit/life counts) → `#numbers`.
- **Headings / titles / menu items** → `#menu` (×N scale for the big title).
- **Body / hints / labels / table rows / speech** → `#small` (`#smallgrey` for the dark potion/army
  labels to match the original's `#smallgrey` choice).

### (b) `build_assets.ts` change — bundle `fnt_*` sheets + per-glyph metrics

Add a new section (mirrors the existing `members` / `weaponIcons` blocks) that emits a `fonts`
record into `assets.json`:

```ts
// ── (h) bitmap fonts (objFont): glyph sheets + metrics, keyed by font symbol ───────────────────
// The original blits per-glyph from fnt_<name> sized by fnt_<name>_properties.{theKey,charSize,gap}.
// Bundle the engine sheet + parse the sibling _properties field so the runtime blitter can address
// cell i = StringGetPos(key, char) at x = i*charSize.x. Sheets are black-on-white masks (numbers/
// small/menu) or grey-on-dark (smallgrey) → keyed + tinted at draw time.
interface FontMeta { file: string; w: number; h: number; cell: [number, number]; gap: number; key: string; matte: "white" | "dark"; }
const fonts: Record<string, FontMeta> = {};
const FONT_DEFS: { sym: string; sheetPrefix: string; props: string; matte: "white" | "dark" }[] = [
  { sym: "menu",      sheetPrefix: "fnt_menu",      props: "fnt_menu_properties.txt",      matte: "white" },
  { sym: "numbers",   sheetPrefix: "fnt_numbers",   props: "fnt_numbers_properties.txt",   matte: "white" },
  { sym: "small",     sheetPrefix: "fnt_small",     props: "fnt_small_properties.txt",     matte: "white" },
  { sym: "smallgrey", sheetPrefix: "fnt_smallgrey", props: "fnt_smallgrey_properties.txt", matte: "dark"  },
];
const parseFontProps = (path: string) => {
  const s = readFileSync(path, "utf8");
  const key  = /#thekey:\s*"([^"]*)"/i.exec(s)?.[1] ?? "";
  const cs   = /#charSize:\s*point\(\s*(\d+)\s*,\s*(\d+)\s*\)/i.exec(s);
  const gap  = Number(/#gap:\s*(-?\d+)/i.exec(s)?.[1] ?? 0);
  return { key, cell: [Number(cs?.[1] ?? 8), Number(cs?.[2] ?? 10)] as [number, number], gap };
};
const OUT_FONTS = join(OUT_ASSETS, "fonts"); mkdirSync(OUT_FONTS, { recursive: true });
for (const { sym, sheetPrefix, props, matte } of FONT_DEFS) {
  // sheetPrefix matches the longest engine bitmap (fnt_small must not grab fnt_smallgrey):
  const cands = bitmaps.filter((b) => b.name.startsWith(sheetPrefix)).sort((a, b) => a.name.length - b.name.length);
  // exclude a longer sibling family: fnt_small* would include fnt_smallgrey* → drop names that
  // continue with a letter that starts another defined family.
  const b = cands.find((c) => !(sheetPrefix === "fnt_small" && c.name.startsWith("fnt_smallgrey")));
  const propPath = join(DATA, props);
  if (!b || !existsSync(propPath)) { console.warn("missing font", sym); continue; }
  const { key, cell, gap } = parseFontProps(propPath);
  fonts[sym] = { file: copy(b), w: b.w, h: b.h, cell, gap, key, matte };
}
```
…and add `fonts` to the `assets.json` emit (`JSON.stringify({ ..., members, fonts }, ...)`).

Notes:
- `fnt_small` vs `fnt_smallgrey` prefix collision is the one trap — the guard above (or listing
  `smallgrey` first and removing matched bitmaps) handles it; verify with a build log line.
- `cell` (from `charSize`) is authoritative for slicing; `w/cell.x` over-counts (trailing padding).
- Metrics already round-trip through `data.json`, but bundling them *in `assets.json` alongside the
  sheet file* keeps the font self-contained for the runtime loader (no cross-bundle lookup).

### (c) Bitmap-font blitter design + routing

**Loader (`render/assets.ts`):** extend `AssetIndex` with
`fonts?: Record<string, { file; w; h; cell:[number,number]; gap:number; key:string; matte:"white"|"dark" }>`.
In `Assets.load`, for each font `loadFile(f.file, mode)` where the white-matte fonts use a **global**
white→transparent key (matte is interior per-cell, exactly like the tile sheets — reuse
`keyOutMatte(img,"global")`), and `smallgrey` keys its dark matte (add a `"dark"` branch to
`keyOutMatte`, or pre-multiply: treat luminance as alpha). Add a `font(sym)` accessor returning a
`BitmapFont` wrapper.

**`BitmapFont` class** (new `render/bitmapFont.ts`):
```ts
class BitmapFont {
  constructor(private sheet: Drawable, private cellW: number, private cellH: number,
              private gap: number, private key: string, private matte: "white"|"dark") {}
  index(ch: string): number { return this.key.indexOf(ch); }       // -1 if absent
  charW = this.cellW + this.gap;
  measure(s: string): number { return s.length * this.charW; }      // fixed cell, no kerning
  // draw at (x,y) top-left, optional scale + tint. Glyph cell i is at (i*cellW, 0).
  draw(ctx, s, x, y, opts?: { scale?: number; colour?: string }) {
    const sc = opts?.scale ?? 1;
    let cx = x;
    for (const ch of s) {
      if (ch === " ") { cx += this.charW * sc; continue; }
      const i = this.index(ch);
      if (i < 0) { cx += this.charW * sc; continue; }  // absent glyph: advance, draw nothing
      ctx.drawImage(this.sheet, i*this.cellW, 0, this.cellW, this.cellH,
                    cx, y, this.cellW*sc, this.cellH*sc);
      cx += this.charW * sc;
    }
    return cx - x; // advance width
  }
}
```

**Tint** (the original's `setSpriteColor`): the keyed sheet is a black/grey glyph on transparency.
To colour it, either (i) keep a small per-`(font,colour)` tinted-canvas cache (multiply the glyph
alpha by the colour, like the renderer's existing sprite-tint cache — see `assets.ts` `__id` note),
or (ii) `ctx.drawImage` then composite colour with `source-in` on an offscreen. Caching by
`font+colour` (a handful of colours: white, `#fc4`, potion colours) is cheap and avoids per-frame
`getImageData`. The white-matte fonts default to white glyphs after keying → tint freely; `smallgrey`
already carries its grey, tint optional.

**Centring / alignment:** the port uses `ctx.textAlign="center"` widely. Replace with
`x - font.measure(s)/2` (the original `objTextImage.displayCentered` does exactly this:
`(xWidth - imageWidth)/2`).

**Routing the 31 sites:** add a thin helper used by all scenes, e.g.
`drawText(ctx, sym, s, x, y, { align, scale, colour })`, that pulls `assets.font(sym)`, splits the
string into runs (route digit runs through `#numbers`, the rest through the requested face — or
simplest: route whole strings to the per-site target from §2 and accept that pure-number HUD fields
use `#numbers`). Replace each `ctx.fillText(...)` listed in §2 with a `drawText(...)` call and delete
the paired `ctx.font=`/`measureText` lines (swap `measureText` → `font.measure`).

**Missing-glyph policy:** `▶ ✦ ♥ ↑ ↓ ← → / - + : ; ?`(in non-`#small` faces)`…` aren't in the keys.
Options, in order of fidelity: (1) where the original used a member icon (e.g. the magic ✦, hearts),
draw the real member/icon instead of a glyph; (2) substitute an in-key char (`>` arrow → a small
member triangle, or `)` ); (3) advance-and-skip (current blitter default). The HUD `Lv`/`Kits`
labels are all-alpha and fully covered by `#small`/`#menu` keys; only decorative symbols need a
fallback.

### (d) Effort / risk

- **Effort: medium.** ~30 lines in `build_assets.ts` (one section + emit field, mirrors `members`);
  a ~60-line `BitmapFont` + loader hook; ~31 call-site edits across 5 files (mechanical) + a
  `drawText` helper; a `"dark"` matte branch in `keyOutMatte` for `smallgrey`. No data-format or
  engine-loop changes.
- **Risk: low-to-medium.**
  - *Low:* metrics already verified against sheet dimensions; the addressing model is proven
    (numbers/smallgrey divide cleanly; small/menu need index-based addressing, documented).
  - *Watch:* `fnt_small`/`fnt_smallgrey` prefix collision in the bundler (guard included).
  - *Watch:* the white-matte key must be **global** (per-cell interior matte), not flood — flood from
    the border would only clear the outer frame. (smallgrey needs the dark-matte branch.)
  - *Watch:* missing decorative glyphs (`▶✦♥↑↓`) — pick a fallback per site so the UI doesn't lose
    affordances; these are the only visible behaviour change vs a naive swap.
  - *Cosmetic only:* no gameplay/collision impact; purely the visual fidelity of text.

---

## Probe note
No throwaway probe scripts were written; verification used read-only `python3 -c` PIL inspections of
the already-extracted PNGs (no files created). Nothing to delete.
