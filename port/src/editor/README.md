# Merlin Map Editor (web)

A browser map editor for the `.txt` Merlin maps, served as a second Vite entry. Open **`/editor.html`**
under `npm run dev` (e.g. `http://localhost:5173/editor.html?map=very_big_map`).

> Scope: this edits + saves valid map files. Making *edited* maps playable in the game is a separate
> project (the editor only guarantees the file round-trips the format the game's `parseMap` reads).

## Pieces
- **`lingo.ts`** — generic Director "Lingo" value parser **+ serializer** (the keystone). Parses the whole
  `[#map: …]` value into a tagged, round-trippable representation and serializes it back to one normalized
  form. Contract is **value round-trip**, not byte (the source formatting is irregular and the game
  tokenizes/ignores whitespace). Parses leniently like the game's `parseLingo` — a few bundled maps carry
  trailing junk after a valid value; we ignore it, so opening + saving such a map *repairs* it. (The game's
  read-only `src/data/lingo.ts` is lossy — it collapses `point(x,y)` and `[#x:1,#y:2]`, drops int/float —
  so it can't serialize faithfully; hence a separate representation here.)
- **`mapModel.ts`** — `EditorMap`: a thin view over the Lingo value (mapSize/roomSize/layers/rooms/tiles)
  whose mutations write back **in place**, so every non-tile field round-trips untouched. Includes the
  **structural** ops (`setStartRoom`/`setEndRoom`/`addRoom`/`removeRoom`).
- **`editorApp.ts`** — canvas render (reuses the game's tilesets + `Renderer.drawTileLayer`; layers above
  the active one are ghosted), the per-layer tile palette, the **room minimap** (clickable thumbnails of
  every room in the `mapSize` grid; current room highlighted yellow, **start** room green-`S`, **end**/win
  room red-`E`; click an empty grid cell to **add** a room there), paint/fill/rect/erase/eyedropper,
  **stroke-grouped undo** (a drag/fill/rect is one undo step), a hover tile readout, and the room-structure
  actions (make start/end, clear end, add/delete room — these rebuild the room list, not on the tile-undo
  stack). New rooms are **blank (all layers 0)**, matching the original's `createBlank` (it never grass-fills).
- **`tools.ts`** — pure, unit-tested cell-region helpers (`floodRegion` 4-connected flood, `rectRegion`).
- **`main.ts`** — bootstrap + DOM toolbar wiring (map/room/layer/tool selectors, save, shortcuts, minimap sync).
- **`save.ts`** + **`vite.config.ts` `saveMapPlugin`** — save tries `POST /api/save-map` (dev plugin writes
  `public/assets/maps/<id>.txt` and **upserts the `maps.json` manifest** from the editor-supplied metadata,
  so a NEW map id becomes loadable by the game — HMR picks it up) and falls back to a browser download on
  the static build. **Verified end-to-end:** an edited map and a brand-new from-scratch map both load and
  **play** in the game (`/?map=<id>`) — terrain + painted tiles render, the player spawns, room exits work.

## Matching the original editor
Studied from the extracted source (`extracted/map_editor/scripts`). The original's only tools are a
**brush** and a grabber (pan); its defining feature is the **multi-tile rectangular brush** — `objTileSet
.calcTileNums` turns a tile-range selection into a 2D pattern and `objRoom.setTilesBrush` stamps it anchored
top-left at the clicked cell. The web editor matches this: **drag-select a range in the palette** → an N×M
brush, painted as a pattern (the hover shows the brush footprint). The **Grab** tool is the original's second
tool (`objGrabberTool`): marquee a rectangle on the room to load that patch as the multi-tile brush, then
rubber-stamp it elsewhere (it auto-flips back to Brush, like the original). Front layers are ghosted at ~50%
to match `objRoom pFrontLayerBlendLevel = 128`. The exe's "adjustableDisplayScale" is the **Zoom** control
(1–6×, CSS-only so pixels stay crisp; Ctrl+wheel or the toolbar). New rooms are blank (all-0) like the
original's `createBlank` (it never grass-fills). Save writes back to the map file like `mapEditMaster.saveMap`.

**Audited against the original** (`extracted/map_editor/scripts`): tile-index math, multi-tile stamp anchor,
edge-clipping, select-on-press drag-paint, room/layer/save STRUCTURE, header typing, and `#endRoom`/`#none`
all match. Known remaining divergence: the original's `changeKeySet` command (swap a layer's tileset across
all rooms, remapping tiles by their symbol key) is **not yet ported**; and the web allows sparse rooms
(add/delete) where the original keeps a dense one-room-per-cell grid (intentional web enhancement).

## Controls
**Brush**: pick one tile (click) or a rectangle of tiles (drag) in the palette, then click/drag to stamp ·
click a room in the minimap to jump (empty cell to add) · **G** fill · **R** rect · **E** eyedropper ·
**X** erase · **Ctrl+wheel** zoom · **Ctrl+Z** undo · **Ctrl+S** save. Layers above the one you're editing
are dimmed; the bottom-left chip shows the hovered cell + its index.

## Tests
`test/editor_lingo.test.ts` (round-trips all 47 bundled maps, value-identity + idempotence; trailing-junk
maps repair on save), `test/editor_mapmodel.test.ts` (read/mutate/round-trip), and
`test/editor_tools.test.ts` (flood/rect regions).

## Full feature set
Brush (multi-tile), **Grab** (region clone), Fill, Rect, Erase, Pick · per-layer **Tileset switch**
(`changeKeySet`: re-themes terrain keeping indices, remaps objects by symbol) · **hover tile labels** from
the keyFiles (e.g. `#warrior`) · room **minimap** (jump / add) · **Start/End** room + **Add/Del** room ·
**New** blank map + **Resize** (mapSize renumbers rooms densely; roomSize pads/crops grids) · **Zoom** 1–6× ·
stroke-grouped **Undo** · **Save** (dev-write or download).

**Undo covers structural edits too**: tile strokes/fill/rect push a per-cell batch; resize / add-delete
room / tileset swap / start-end push a full-map snapshot — `Ctrl+Z` reverts either. New maps drop a
**`#player` spawn marker** at the start-room centre so they open at a defined point.

## Not yet
Copy/paste a whole room (the Grab tool already clones a region within/between rooms).
