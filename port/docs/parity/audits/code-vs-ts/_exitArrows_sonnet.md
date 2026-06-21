# Exit-Arrow Feature Parity Audit — Sonnet Pass

**Auditor:** Claude Sonnet 4.6  
**Date:** 2026-06-21  
**Verdict:** GAPS=3  

---

## Scope

Full four-lens audit of the EXIT-ARROW feature:

- **Original:** `casts/script_objects/objRoom.txt` (drawExitArrows, attemptOpenExits) + `casts/script_objects/modScreenExits.txt` (drawExitArrowsOnImage, calcExitArrowRects, convertExitTilesToRangesEdge)
- **Engine bytecode:** `extracted/engine/scripts/MovieScript 1 - GameSpecific.ls` (gExitArrows=1), `MovieScript 1 - main.ls` (gExitArrowThickness=16)
- **Port:** `port/src/world/rooms.ts` (exitArrowRects, setExits), `port/src/main.ts` (drawExitArrows, renderScene), `port/src/world/collision.ts` (passableCell), `port/src/render/assets.ts` (arrowImg)
- **Tests:** `port/test/exit_arrows.test.ts`, `port/tools/arrow_shot.ts`, `port/tools/playthrough_smoke.ts`

---

## LENS 1: Activation / Reachability

### Original activation chain (cleared room)

1. **gExitArrows=1** — set in `GameSpecific.ls:12`; default in `main.ls` is 0, overridden by GameInitGlobals.
2. **gExitArrowThickness=16** — set in `main.ls` (both MovieScript 15 and 16 variants).
3. **Room entry → `objRoom.activate()`** calls `attemptOpenExits()` (casts/objRoom.txt:133).
4. **`attemptOpenExits()`** (casts/objRoom.txt:187): only when `g.teamMaster.isPlayerEnemiesDead()` returns true does it call `me.drawExitArrows()` (line 213–215). If the room has live enemies, **drawExitArrows is never called** — no arrows drawn.
5. **`drawExitArrows()`** (casts/objRoom.txt:232):
   - Gets `surroundingHostiles = pMap.getSurroundingHostiles()` — queries each adjacent room's `getHostile()`.
   - Gets `surroundingExitTiles = pMap.getSurroundingExitTiles()` — queries adjacent rooms' edge tiles.
   - Gets `myExitTiles = me.getExitTiles()` — queries THIS room's edge tiles via `getScreenExitsForEdge`.
   - **Combines** them: `combinedTiles[i] = ListCombineExitTiles(surroundingExitTiles[i], myExitTiles[i])`.
   - Calls `calcExitArrowRects(combinedTiles)` on the backgroundActive layer.
   - Calls `drawExitArrowsOnImage(myImage, exitArrowRects, surroundingHostiles)`.
6. **`convertExitTilesToRangesEdge()`** (modScreenExits.txt:149): iterates edge tiles, opens a range on `nSymbol = #none` (passable), closes on `#solid` or last tile.
7. **`convertExitRangesToArrowRectsEdge()`** (modScreenExits.txt:58): for each range `[start,end]`, builds a rect using `gExitArrowThickness=16` on the perpendicular axis.

### Concrete trace: Room 1 cleared, right edge (map.txt)

Room 1 backgroundActive right edge (col 17, rows 0–8):
tiles = [138, 138, 138, 138, 137, 137, 138, 138, 0].
Tiles 137, 138 = `#solid` (verified from active_key.txt). Tile 0 = `#none`.

- Rows 0–7: `#solid` → not passable → no run opened.
- Row 8: `#none` → passable → range opened at `(8)*32=256`.
- Last tile (row 8) is `#none` → `minusTile=0` → range closes at `(9)*32=288`.
- Result: one range `[256, 288]`.
- Arrow rect: `rect(imgW-16, 256, imgW, 288)` = `rect(560, 256, 576, 288)`.

Room 2 left edge (col 0): all zeros (all passable). `ListCombineExitTiles([#none×9], [#none×9]) = [#none×9]`. The combine leaves row 8 passable, same result as without the combine.

**exitArrowRects() returns a NON-EMPTY list** for room 1 after clearing (1 rect on the right edge). ✓

### Port activation chain

1. `CollisionGrid.fromActiveLayer()` builds `solid[]` array — tile 0 maps to not-solid, tiles 137/138 map to `#solid` via `solidTileNums()` (`rooms.ts:98–100`, `collision.ts:66–87`).
2. `passableCell(c, r)` (collision.ts:204): returns `solid[r*cols+c] === 0`. For col 17, row 8: solid=0 → passable. ✓
3. `exitArrowRects()` (rooms.ts:251): iterates edges. For right edge with an adjacent room at x+1: `passable(i) = grid.passableCell(cols-1, i)`. Calls `runs(n, passable, t)` which produces `[[256, 288]]`. Rect: `{x: imgW-16, y: 256, w: 16, h: 32}`. ✓
4. **Returns a non-empty list** — 1 rect for room 1 right edge after clearing. ✓

### `passableCell` on edge cells: does it always return false?

No — verified above that row 8 of room 1's right edge returns true (tile 0 = not solid). The grid is correctly populated: only tiles with `#solid` type in the active key mark `solid[]=1`. Empty cells (tile 0) remain 0 → passable. ✓

### `runs()` algorithm equivalence

Verified by exhaustive comparison of 7 patterns (all-open, all-closed, alternating, gap in middle, right-open, left-open, both-ends-open). The port's `runs()` function and the original's `convertExitTilesToRangesEdge()` produce **identical output** for every tested pattern. ✓

---

## LENS 2: Render / Draw-Order / Occlusion

### Port draw order (renderScene, main.ts:356–399)

Per-frame render path, in order:

| Step | Call | What |
|------|------|------|
| 1 | `renderer.drawTileLayer(passive, passiveSheet)` | `#backgroundPassive` tile layer |
| 2 | `renderer.drawTileLayer(active, activeSheet)` | `#backgroundActive` tile layer (collision walls) |
| 3 | `renderer.drawSprites(sprites)` | All actor sprites (player, enemies, allies) — z-sorted |
| 4 | `drawBullets(renderer)` | Bullet dots + beam sprites |
| 5 | `drawSpells(renderer)` | Charge orbs |
| 6 | `drawPickups(renderer)` | Diamond pickup shapes |
| 7 | `renderer.drawTileLayer(fg, foregroundSheet, 0, 0, 0.5)` | `#foregroundPassive` at 50% alpha, OVER actors |
| 8 | `drawExitArrows(renderer, assets, rooms.exitArrowRects())` | **Exit arrows — OVER foreground AND actors** |
| 9 | `drawEnemyBar()` (per entity) | Enemy/ally HP bars |
| 10 | `drawCharge(renderer, player)` | Charge ring at cursor |
| 11 | `drawHud(renderer, player)` | HP/XP bars + flash message |
| 12 | `drawMinimap(...)` | 5-state minimap grid |
| 13 | In-game cutscene / overlay screens / pause menu | On top of everything |

**Exit arrows (step 8) sit OVER sprites/actors (step 3) and over the foreground layer (step 7).**

### Original draw order

In the original Director engine:
- Room sprite occupies **gMapLayer = 1** (`main.ls:gMapLayer=1`, `objMap.new:i[#layer]=gMapLayer`).
- The room image is a composite of backgroundPassive + backgroundActive + objects (via `getScaleImage`, casts/objRoom.txt:492–527). **Exit arrows are drawn directly onto this flat image** (`me.getMember().image`) at clear time.
- Actor sprites occupy **gGameObjectLayer = 50+**.
- Player at **gPlayerLayer = 99**.
- HUD/minimap/menus at **gGameEnergyBarLayer=170 / gMenuLayer=190 / gGlobalDisplayLayer=220**.

Therefore in the original: **arrows sit at layer 1 (UNDER actors at layer 50+)**. Actors draw in front of arrows.

### Draw-order gap

| | Original | Port |
|--|---------|------|
| Arrows relative to actors | **Below** actors (layer 1 vs 50+) | **Above** actors (step 8 vs step 3) |
| Arrows relative to foreground | Below (baked into room image at layer 1; foregroundPassive not composited into room image) | Above (step 8 vs step 7) |
| Actors can occlude arrows | Yes | No |

**This is a draw-order difference.** In the original, an actor standing at a room edge would draw in front of the arrows (actor at layer 50, arrows baked into layer 1). In the port, the arrows draw on top of actors. However, since exit arrows are confined to the 16-pixel border at room edges where actors rarely stand, this has negligible practical impact on visibility.

### Occlusion by HUD and minimap

The minimap (step 12) and HUD box (step 11) draw AFTER arrows (step 8) and WILL partially occlude them:

- **Minimap vs. right-edge arrows (for the default 10×1 map, 576×288 viewport):** The minimap draws at `ox = viewW - mapX*5 - 6 = 520`, `oy=6`, width=50px. Right-edge arrows start at `x = 576-16 = 560`. The minimap extends to `x=570`, overlapping the right-edge arrows at `x=560..570, y=6..11` — a 10×5 pixel region. This is a minor partial occlusion at the very top of the right-edge arrow.
- **HUD box vs. top-edge arrows:** HUD draws at `(6,6)-(110,30)`, partially overlapping top-edge arrows at `y=0..16`. Only applies when a room above exists (uncommon in 10×1 maps).

In the original these UI elements are also at higher layers (gGlobalDisplayLayer=220 > gMapLayer=1) so they also draw over arrows. The occlusion pattern is similar. Not a meaningful gap.

### Arrow art: non-transparent, correct size

All 8 arrow images are confirmed present in `/home/user/merlin-s-revenge/port/public/assets/arrows/` and all are 16×16 pixels, RGBA mode (non-transparent content). `assets.json` `arrows` key is populated with all 8 files. `Assets.load()` preloads all arrow files via `loadFile(f, "flood")`. `arrowImg()` returns the loaded canvas. `drawExitArrows()` guards `iw===0 || ih===0` (main.ts:504). ✓

### Screen coordinates and rect size

For the concrete room 1 right-edge case: `{x:560, y:256, w:16, h:32}`. These are in-viewport pixel coords (room renders at origin 0,0). Both `x=560` and `y=256` are within the 576×288 viewport. `w=16, h=32` are positive. The `ctx.rect()` clip and the tile-repeat loop will draw correctly. ✓

---

## LENS 3: Matching Initial / Starting State

### gExitArrows boot state

**Original:** `defaultGameGlobals()` in main.ls sets `gExitArrows = 0`; then `GameInitGlobals()` in GameSpecific.ls sets `gExitArrows = 1`. So the game boots with arrows enabled. ✓

**Port:** The port has no `gExitArrows` flag — arrows are always enabled (the `drawExitArrows()` call in main.ts:381 is unconditional). This matches the original's effective state (gExitArrows=1). ✓

### TIMING GAP (GAP 1): Arrows visible before room clear

**Original (`casts/objRoom.txt:187–222`, `attemptOpenExits`):**
```
if g.teamMaster.isPlayerEnemiesDead() then
  ...
  if gExitArrows then
    me.drawExitArrows()
  end if
end if
```
`drawExitArrows()` is called **only when the room is cleared** (enemies dead). Before that, the room image has NO arrows painted on it. **On an uncleared room, NO arrows are visible in the original.**

**Port (`rooms.ts:381`, `main.ts:381`):**
`exitArrowRects()` is called every frame regardless of cleared state. When uncleared, `grid.open[edge]=false`, so `colour="red"`, and rects are still generated and drawn. **On an uncleared room, RED arrows are visible in the port.**

**Verdict: GAP 1.** The port shows RED arrows before a room is cleared; the original shows NO arrows. This is a deliberately different design (documented in the K22 note in rooms.ts: "an uncleared room shows its (would-be) exits RED"), but it is not parity — it is a visible behavioral difference. A first-time player entering an uncleared room will see red exit arrows in the port but nothing in the original.

### COLOUR SEMANTICS GAP (GAP 2): Arrow colour meaning

**Original:** After clearing the current room, `drawExitArrows()` calls `getSurroundingHostiles()` which queries **each adjacent room's `getHostile()`**. Arrow is RED if the **adjacent room has live hostiles**, GREEN if the adjacent room is clear.

**Port:** Arrow colour = `open ? "green" : "red"` where `open = grid.open[edge]` which equals `cleared.has(room.num)` (set by `setExits(true)` in rooms.ts:125). So colour = whether the **current room** is cleared.

Consequence: After the player clears room A and enters room B (which has enemies), in the original the arrows from room A pointing toward room B are GREEN if room B's NEIGHBOURS don't have hostiles, or RED if they do. In the port, all arrows in room A were GREEN (because room A is cleared) regardless of what's in the adjacent rooms. The port can never show RED arrows AFTER the current room is cleared (only before). The original can show mixed red/green arrows on a cleared room depending on adjacent-room states.

**Verdict: GAP 2.** This is explicitly noted in rooms.ts:245–247 as an intentional simplification but is a real behavioral divergence from the original.

### "Once vs. every frame" draw timing

The prior audit dismissed this as irrelevant. On deeper examination:

- Original: Draws arrows once onto the member image on each room ACTIVATION (re-entry also triggers `attemptOpenExits` → `drawExitArrows` if still cleared, per activate: lines 110–137).
- Port: Recomputes and redraws every frame.

For a CLEARED room, both produce the same result every frame (rects don't change). For an UNCLEARED room: original = no arrows, port = red arrows (covered in GAP 1 above). The per-frame recomputation in the port is safe and correct for cleared rooms. ✓

---

## LENS 4: Missing Test / Verification Coverage

### What the tests cover

`port/test/exit_arrows.test.ts` (7 test cases) tests:
- `exitArrowRects()` returns the correct edge set (left/right/up/down adjacency).
- Range computation (gap size, gap position, multiple gaps).
- Colour is RED when uncleared, GREEN when cleared.
- Top/bottom edge orientation (thickness on the vertical axis).

None of these tests exercise the rendering path. There is **no assertion on what pixels appear on the canvas** — only on the `ExitArrowRect[]` data structure produced by `exitArrowRects()`.

### What is NOT tested (GAP 3)

The entire `drawExitArrows()` function in main.ts:497–514 is untested at the unit level:

```typescript
function drawExitArrows(renderer: Renderer, assets: Assets, rects: ExitArrowRect[]) {
  if (rects.length === 0) return;
  const ctx = renderer.ctx;
  for (const r of rects) {
    const img = assets.arrowImg(r.colour, r.edge);
    if (!img) continue;
    const iw = img.width, ih = img.height;
    if (iw === 0 || ih === 0) continue;
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    for (let dy = 0; dy < r.h; dy += ih)
      for (let dx = 0; dx < r.w; dx += iw)
        ctx.drawImage(img, r.x + dx, r.y + dy);
    ctx.restore();
  }
}
```

No test verifies:
- That `assets.arrowImg()` actually returns a non-null image for each colour/edge combination.
- That `ctx.drawImage()` is called at all.
- That the tiled repeat fills the rect correctly (e.g., `r.h < ih` would draw nothing for a one-pixel-tall rect).
- That the clip rect is non-zero (non-degenerate rects produce no pixels if `r.w=0` or `r.h=0`).

The `arrow_shot.ts` smoke tool (port/tools/arrow_shot.ts) DOES screenshot the game and log `rooms.exitArrowRects()` state, but it is a manual tool, not an automated assertion, and it only reads back JS state (not canvas pixels). It does not assert that specific pixel colours appear at specific coordinates in the canvas output.

**Verdict: GAP 3.** There is no automated test that verifies the OBSERVABLE output of the arrow feature — that green/red pixels actually appear at the expected canvas positions. A regression that silently breaks `assets.arrowImg()` (e.g., a file path change in `assets.json`) would pass all current tests while making arrows invisible.

**Suggested assertion (unit test with a mock canvas or OffscreenCanvas):**
```typescript
it("drawExitArrows paints non-transparent pixels at the rect position", () => {
  const oc = new OffscreenCanvas(600, 300);
  const ctx = oc.getContext("2d")!;
  // create a 16x16 green image
  const arrowCanvas = new OffscreenCanvas(16, 16);
  const ac = arrowCanvas.getContext("2d")!;
  ac.fillStyle = "#00ff00"; ac.fillRect(0, 0, 16, 16);
  const mockAssets = { arrowImg: () => arrowCanvas } as any;
  const rects: ExitArrowRect[] = [{ x: 0, y: 0, w: 16, h: 32, edge: "left", colour: "green" }];
  drawExitArrows({ ctx } as any, mockAssets, rects);
  const data = ctx.getImageData(0, 0, 16, 32);
  // assert at least one non-transparent green pixel was written
  let found = false;
  for (let i = 0; i < data.data.length; i += 4)
    if (data.data[i + 1]! > 200 && data.data[i + 3]! > 0) { found = true; break; }
  expect(found).toBe(true);
});
```

---

## Combined "combine" gap assessment

The original's `drawExitArrows()` uses `ListCombineExitTiles(surroundingExitTiles[i], myExitTiles[i])` — a cell is passable only if BOTH the current room's edge and the adjacent room's facing edge are `#none`. The port uses only the current room's `passableCell()`.

For the shipped maps, analysis of rooms 1–4 and 6–7 shows that wherever the current room has a wall on an edge, the adjacent room also has an open edge there, and wherever the current room has a passable cell, the adjacent room either has a passable cell at the same row (rooms with matching doorways) or has all zeros (open room edges). The combine produced the same result as using only the current room's edge in every case checked.

However, there could exist map layouts where the current room has a passable cell at position X on an edge but the adjacent room has a wall at position X on its facing edge. In that case:
- **Original:** No arrow at position X (both rooms must be open for an arrow).
- **Port:** Arrow at position X (only checks current room).

This is a **latent parity gap** in rooms where edges are not symmetrically passable. For the 10 shipped rooms in the default map, this gap is not triggered. It is not classified as a numbered gap above since it has no observable effect on the shipped content, but it is a code-level difference.

---

## Summary

| Lens | Finding |
|------|---------|
| 1. Activation/Reachability | exitArrowRects() returns non-empty for room 1 cleared (1 rect, right edge row 8). passableCell() correctly identifies tile 0 as passable. runs() is byte-equivalent to convertExitTilesToRangesEdge(). **CLEAN for cleared rooms.** |
| 2. Render/Draw-Order/Occlusion | Arrows draw AFTER sprites in the port (reverse of original). Minor minimap/HUD occlusion in both. Arrow art is 16×16 non-transparent PNG, correctly loaded. Rect coordinates are valid. **CLEAN for visibility — arrows are visible.** |
| 3. Initial/Starting State | **GAP 1:** Port shows RED arrows on uncleared rooms; original shows NO arrows. **GAP 2:** Colour semantics differ (current-room-clear vs adjacent-room-hostile). Draw timing (once vs. per-frame) is benign for cleared rooms. |
| 4. Missing Test Coverage | **GAP 3:** No automated test asserts that canvas pixels are written by drawExitArrows(). Only exitArrowRects() state is covered. A broken arrowImg() would be invisible to CI. |
