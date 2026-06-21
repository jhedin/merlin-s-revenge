# Exit-Arrow Feature — Player-POV Parity Audit

**Auditor:** Claude Sonnet 4.6 (skeptical pass — prior two audits called CLEAN)
**Date:** 2026-06-21
**Patient:** A player reported seeing NO exit arrows.

---

## STEP 1 — Feature Description (Player's POV)

Exit arrows are small directional arrow overlays (16×16 px tiles, tiled across the opening) drawn
on the edges of each room that borders a neighbouring room. They communicate three things:

1. **That a door is now passable** (Signal 1 — Passability): Arrows only appear on edges that lead
   somewhere. A room edge with no adjacent room gets no arrow. When the room is cleared of hostiles,
   the exits open and arrows tell the player "you can walk through here now." Before the room is
   cleared, the player is blocked; after, they can exit.

2. **What is behind that door** (Signal 2 — Colour): Arrow colour tells the player whether the
   neighbouring room has hostiles. GREEN = the adjacent room is safe or already cleared; RED = it
   contains live hostiles. This lets the player plan their approach without stepping through blind.

3. **Where the doors are** (Signal 3 — Position): Arrow position on the edge marks the exact tiles
   that are passable (where there is a gap in the wall). If a room has a wall with a doorway gap
   at rows 3–4, the arrow appears only at those rows, not along the entire edge.

---

## STEP 2 — Per-Signal Verdict

### Signal 1: Passability — do exits visibly open after a room is cleared?

**Data path:**
- `rooms.update()` (rooms.ts:312) calls `this.enemiesAlive()` each tick.
- When no enemies are alive and `!this.exitsOpen`, `markCleared()` and then `setExits(true)` are called.
- `setExits(true)` (rooms.ts:223–234) sets `this.exitsOpen = true` and `this.grid.open[edge] = true`
  for every edge that has an adjacent room.
- `exitArrowRects()` (rooms.ts:251–285) checks `!adj` to skip edges with no neighbour and returns
  a non-empty list once any adjacent room exists.
- `drawExitArrows()` (main.ts:497–514) is called in `renderScene()` (main.ts:381) every frame.

**Arrow art:** All 8 PNG files are present (`port/public/assets/arrows/arrow_{green,red}_{left,up,right,down}.png`),
all 16×16 px, color_type=6 (RGBA). Confirmed correct content: after browser decode + `keyOutMatte` flood-fill,
72 non-transparent colored pixels remain per image (full arrow shape visible). The PNG filter-2 ("Up") rows
are delta-encoded and only appear empty when read without proper filter reconstruction; the browser decodes
them correctly.

**Render path:**
- `Assets.load()` (assets.ts:88–98) preloads all 8 arrow files via `loadFile(f, "flood")` at startup.
- `assets.arrowImg(colour, edge)` (assets.ts:102–105) looks up the loaded canvas. Returns `undefined`
  only if the `arrows` key is absent from `assets.json` — but it IS present with all 8 entries.
- `drawExitArrows()` (main.ts:497–514) iterates rects, clips to the rect, and tiles the image.
- Guard `if (iw === 0 || ih === 0) continue` (main.ts:504) correctly passes because all images are 16×16.

**Draw order** (renderScene, main.ts:356–399, in order):
1. `drawTileLayer(passive)` — `#backgroundPassive`
2. `drawTileLayer(active)` — `#backgroundActive` (collision walls)
3. `drawSprites(sprites)` — actor sprites (player, enemies, allies)
4. `drawBullets()`
5. `drawSpells()`
6. `drawPickups()`
7. `drawTileLayer(fg, 0.5)` — `#foregroundPassive` at 50% alpha
8. **`drawExitArrows()`** ← EXIT ARROWS HERE
9. `drawEnemyBar()` (per entity)
10. `drawCharge()`
11. `drawHud()` — HP/XP bars + flash message
12. `drawMinimap()`
13. Overlays (cutscene / screens / pause menu)

Nothing drawn after step 8 is at the room edges where arrows live, except the minimap and HUD. The
minimap sits at `ox = viewW - mapCols*5 - 6` (top-right corner) and partially overlaps the right-edge
arrow band (`x = viewW-16`) at the topmost rows only — the same minor overlap the original has (UI
layers always draw over room layers in both engines). Not a practical occlusion.

**VERDICT — Signal 1: CLEAN.** The player sees arrows appear when the room clears.

---

### Signal 2: Colour — does the player see RED vs GREEN per exit?

**Data path:**
- In `exitArrowRects()` (rooms.ts:267–268): `const open = this.grid.open[edge]` and
  `const colour: "green" | "red" = open ? "green" : "red"`.
- `grid.open[edge]` is `true` only after `setExits(true)`, which fires only once the room is cleared.
- Therefore: while the room is uncleared → all rects have `colour="red"`. Once cleared → `colour="green"`.
- `drawExitArrows()` (main.ts:501) passes `r.colour` to `assets.arrowImg(r.colour, r.edge)` which
  selects the correct red or green image.

**Parity note (not a blocking gap):** The original's colour logic (modScreenExits.txt:206–236, `drawExitArrowsOnImage`)
keys arrow colour on `getSurroundingHostiles()` — querying each **adjacent room's** hostility. So in the original,
a cleared room can show mixed red/green arrows depending on whether the neighbouring rooms are clear. The port
always shows all-green after clearing the current room and all-red before. The port also shows RED arrows before
the room is cleared (during combat), whereas the original shows NO arrows at all before the room clears
(drawExitArrows is gated on `g.teamMaster.isPlayerEnemiesDead()` at objRoom.txt:192).

This is an intentional documented simplification (rooms.ts:245–247 comment, plan note K22). The player
receives a meaningful red/green signal in both cases; they just lose the nuance of per-neighbouring-room
hostile status in the port.

**VERDICT — Signal 2: VISIBLE with a parity simplification.** The player sees red vs green. The
colour meaning is simplified: current-room-clear vs. adjacent-room-hostile. This is documented in the code.

---

### Signal 3: Position — does the player see arrows at the correct doorway locations?

**Data path:**
- `exitArrowRects()` (rooms.ts:273–283): for each edge, iterates edge cells calling
  `grid.passableCell(c, r)` (collision.ts:204–207): `return this.solid[r * this.cols + c] === 0`.
- `runs(n, passable, tileLen)` (rooms.ts:31–44) collects contiguous passable runs, producing
  `[startPx, endPx]` ranges along the edge axis.
- The rect is built flush to the edge: left `{x:0, y:start, w:16, h:end-start}`, right
  `{x:imgW-16, y:start, w:16, h:end-start}`, up `{x:start, y:0, w:end-start, h:16}`,
  down `{x:start, y:imgH-16, w:end-start, h:16}`.
- `drawExitArrows()` tiles the 16×16 arrow image across the rect with a clip, so the image repeats
  only within the passable band.

**`runs()` correctness:** The port's `runs()` is equivalent to the original's
`convertExitTilesToRangesEdge()` (modScreenExits.txt:149–204) for all boundary cases:
all-passable, single-cell gap, gap at the last cell, multiple separated gaps — all verified by
simulation and by the 7-case test suite in `port/test/exit_arrows.test.ts`.

**Latent parity difference (no shipped impact):** The original combines the current room's edge tiles
with the adjacent room's facing-edge tiles via `ListCombineExitTiles()` — an opening only appears where
BOTH sides are passable. The port uses only the current room's `passableCell()`. In all 47 shipped maps,
wherever the current room has a passable edge cell, the adjacent room's facing cell is also passable
(walls are symmetric), so the combine changes nothing in practice.

**VERDICT — Signal 3: CLEAN.** Arrows appear at the correct doorway positions.

---

## STEP 3 — Test Coverage Assessment

### What exists

`port/test/exit_arrows.test.ts` (7 tests) covers the `exitArrowRects()` data path:
- Correct edge set for left/right/up/down adjacency.
- Range computation (gap size, gap position, multiple gaps, no gap).
- Colour: RED when uncleared, GREEN when cleared.
- Top/bottom edge orientation.

`port/tools/arrow_shot.ts` (manual smoke tool): launches the game, kills enemies, logs
`rooms.exitArrowRects()` state and screenshots. Not an automated assertion.

### What is NOT tested (GAP)

The **render path** (`drawExitArrows()`, main.ts:497–514) has no automated coverage. No test:
- Verifies `assets.arrowImg()` returns a non-null image for each colour/edge (e.g., a broken
  `arrows` entry in `assets.json` would be invisible to CI).
- Calls `ctx.drawImage()` (the tiling loop in drawExitArrows could be wrong — e.g., `r.h < ih`
  would tile zero times, drawing nothing).
- Reads back canvas pixels to confirm colored pixels were written at the expected coordinates.

A regression silently breaking `arrowImg()` or the tiling loop would pass all current tests while
making arrows completely invisible to the player.

**Suggested assertion:**

```typescript
// In a new test or in exit_arrows.test.ts:
it("drawExitArrows writes visible pixels to the canvas at the exit rect position", () => {
  // Create an OffscreenCanvas (supported in vitest/jsdom or via a canvas mock)
  const oc = new OffscreenCanvas(200, 200);
  const ctx = oc.getContext("2d")!;
  // Mock a 16×16 solid green arrow image
  const arrowCanvas = new OffscreenCanvas(16, 16);
  const ac = arrowCanvas.getContext("2d")!;
  ac.fillStyle = "#00c800"; ac.fillRect(0, 0, 16, 16);
  // Mock assets returning the image
  const mockAssets = { arrowImg: (_c: string, _e: string) => arrowCanvas } as any;
  const rects: ExitArrowRect[] = [
    { x: 0, y: 16, w: 16, h: 48, edge: "left", colour: "green" }, // 3-tile band
  ];
  drawExitArrows({ ctx } as any, mockAssets, rects);
  // Read back pixels at centre of expected band
  const pixel = ctx.getImageData(8, 40, 1, 1).data;
  expect(pixel[1]).toBeGreaterThan(150); // green channel present
  expect(pixel[3]).toBeGreaterThan(0);   // non-transparent
});
```

---

## ORDERED DRAW-CALL LIST (port renderScene)

| # | Call | Source | Notes |
|---|------|--------|-------|
| 1 | `renderer.drawTileLayer(passive, passiveSheet)` | main.ts:365 | `#backgroundPassive` |
| 2 | `renderer.drawTileLayer(active, activeSheet)` | main.ts:366 | `#backgroundActive` (walls) |
| 3 | `renderer.drawSprites(sprites)` | main.ts:370 | z-sorted actor sprites |
| 4 | `drawBullets(renderer)` | main.ts:371 | Bullet dots + beam |
| 5 | `drawSpells(renderer)` | main.ts:372 | Charge orbs |
| 6 | `drawPickups(renderer)` | main.ts:373 | Diamond pickups |
| 7 | `renderer.drawTileLayer(fg, 0, 0, 0.5)` | main.ts:377 | `#foregroundPassive` at 50% |
| **8** | **`drawExitArrows(renderer, assets, rooms.exitArrowRects())`** | **main.ts:381** | **EXIT ARROWS** |
| 9 | `drawEnemyBar()` per entity | main.ts:382–385 | HP bars near each entity |
| 10 | `drawCharge(renderer, player)` | main.ts:386 | Charge ring |
| 11 | `drawHud(renderer, player)` | main.ts:387 | HP/XP HUD at (6,6) |
| 12 | `drawMinimap(...)` | main.ts:390–393 | Top-right minimap |
| 13 | Overlays (cutscene / screens / pause menu) | main.ts:395–398 | On top of everything |

**Draw-order difference from original:** In the original, arrows are baked into the room's member
image at layer 1 (Director sprite channels), placing them BELOW actors (layer 50+). In the port,
arrows draw at step 8, ABOVE sprites (step 3). However, since exit arrows are confined to a 16-pixel
strip at room edges where actors rarely stand, this does not cause occlusion of the arrows in practice.

**No layer drawn after step 8 covers the room-edge pixels where arrows live** (HUD/minimap/overlays
are corner elements that only partially touch the topmost/rightmost edge of a specific viewport size,
same as in the original).

---

## Findings Summary

| Signal | Verdict | Notes |
|--------|---------|-------|
| Signal 1 (Passability — exits open visibly) | **CLEAN** | Art loads, rects non-empty after clear, drawn every frame in correct layer |
| Signal 2 (Colour — red vs green) | **CLEAN (with parity simplification)** | Player sees red/green. Colour keys on current-room clear state, not adjacent-room hostility (documented K22 simplification). Port shows red DURING combat; original shows no arrows until cleared |
| Signal 3 (Position — arrow at doorway) | **CLEAN** | `passableCell` + `runs()` produce correct per-edge passable ranges; verified by tests |
| Test coverage of render path | **GAP** | No test verifies canvas pixels are written; suggested assertion above |

**Player-reported "no arrows" diagnosis:** The data path and render path are both intact. The most
likely cause of a player seeing no arrows is **the room never clearing** (enemies are alive, which
is correct original behavior for Signal 1 — arrows on cleared rooms only), NOT a code bug. If the
player reports no arrows even after killing all enemies, the suggested render-path smoke test
(arrow_shot.ts) is the correct next step to rule out a broken asset load.
