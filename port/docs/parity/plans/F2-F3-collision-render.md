# Plan F2 + F3 — Collision tile-types & Render/Anim fidelity

Status: ☑ DONE (Iter 9). Owner: world/render (agent 5). Backlog rows: F2, F3 in
[`../README.md`](../README.md). Input audit: [`../05-world-render-shell.md`](../05-world-render-shell.md)
§1 (collision), §2 (render/anim), §5 (the "play any map" gap), §7 (faithfulness risks).

> **Goal:** the collision solver handles *every* active-layer tile type the original supports
> (`#solid`/`#platform`/`#ceiling`/`#wallLeft`/`#wallRight`) with the original's per-edge merge,
> corner detection, and directional collision **events**; and the renderer/anim layer reproduces
> the real `modColourTransform` tint/glow palette, per-sprite alpha/blend, the `#foregroundPassive`
> over-actor layer, data-driven per-frame anim delay + loop flags, and the 5-state minimap — all to
> 100% behavioral parity for any of F1's 47 maps. **room-1 (solid-only) is the golden no-regression.**

These are the last two world/render fidelity items. F2 is collision; F3 is render/anim. They are
independent (different files: `world/collision.ts`+`world/tlk.ts`+`components/movement.ts` vs
`render/renderer.ts`+`components/anim.ts`+`main.ts`) and can ship in either order, but F2 is
**golden-testable** and lower-risk, so it goes first.

---

## Part A — Original mechanics (grounded in cited Lingo)

### A.1 Collision tile-types (`objCollisionTile.txt`, `objCollisionMap.txt`, `objMoveXY.txt`)

The original derives a per-room **collisionMap** from the active layer. Each cell is an
`objCollisionTile` with a `pTileType` ∈ `{#none, #solid, #ceiling, #platform, #wallLeft, #wallRight}`
and **four `pCollisionEdges`** (`#left/#top/#right/#bottom`), each carrying `{axis, location, solid}`.

**Per-edge solidity** (`objCollisionTile.initCollisionEdge`, lines 46–97) — the load-bearing table.
A tile is one-way: which *edges* are solid depends on the type:

| `pTileType` | left | top | right | bottom | meaning |
|---|:--:|:--:|:--:|:--:|---|
| `#solid` | ✔ | ✔ | ✔ | ✔ | all edges block (today's only case) |
| `#none` | — | — | — | — | no collision |
| `#platform` | — | ✔ | — | — | land **from above only** (top edge solid) |
| `#ceiling` | — | — | — | ✔ | block **from below only** (bottom edge solid) |
| `#wallLeft` | ✔ | — | — | — | block leftward motion only (left edge solid) |
| `#wallRight` | — | — | ✔ | — | block rightward motion only (right edge solid) |

Edge geometry (`initCollisionEdges`, 99–121): `pEndOfTile = firstTile + tileSize*locInMap`,
`pStartOfTile = pEndOfTile - tileSize - point(1,1)` (the **−1,−1 is the "push fully out of tile on
contact" fudge** — port it literally). Left/right edges carry axis 1; top/bottom carry axis 2.

**Per-edge merge** (`mergeEdges`, 455–487): two solid edges that face each other between adjacent
tiles are both set **non-solid** ("nothing can hit them anyway"). Walks `#right` and `#bottom`
neighbours only (top/left already merged from the neighbour's pass). **Exception:** if the tile
**below** is a `#platform`, the bottom edge is *left solid* (the platform's top still needs the
solid face above it). After merge, `initSolidEdgesList` caches the surviving solid edges
(`pSolidEdges`).

**Corner detection** (`identifyAsCornerTile`, 388–453; `calcSolidCorner`, 295–303) — anti-diagonal
escape. Only `#solid` tiles can be corners. For each *non-solid* edge of a solid tile, check the two
neighbours that meet at the diagonal; if **both** of their facing edges are solid, that corner
(`#topLeft`/`#topRight`/`#bottomRight`/`#bottomLeft`) is solid → cached in `pSolidCorners`. This
stops a small box squeezing diagonally between two tiles whose inner faces were merged away.

**The "magic rect" broad-phase** (`objCollisionMap.selectTilesFromCollisionRect`, 405–459) — the
solver the audit warns is **partly not understood**. Per move it picks the **4 corner tiles** of the
moving object's `collisionRect`:
```
tileScreenRect = collisionRect.rect + pMagicRect   -- "magic rect! I don't get why this is required"
tileRect       = tileScreenRect / pTileSize
tileRect       = tileRect + pBorderThickness        -- borderThickness = 2 (a 2-tile solid frame)
```
`pMagicRect = rect(magicPoint, magicPoint)` where `magicPoint = tileSize − roomLocation`
(`initMagicRect`, 85–89). It is an offset that maps screen-space rect → collisionMap tile-index
space, accounting for the room's on-screen origin and the 2-tile border. **Port it literally** — do
not try to derive a cleaner form until golden tests pass.

**Per-axis push-out + directional events** (`checkCollisions`, 175–297). For each selected tile:
`overlap = tile.calcOverlap(collisionRect.rect, dir)` (a `[xOverlap, yOverlap, bothAxes]` triple,
`calcOverlapEdges` 237–264 + corner pass `calcOverlapCorners` 198–234). Then:
- pick `axisToChange`: `#both` if `overlap[3]`, else the only non-`#none` axis, else (both present)
  the axis with the **larger** positive overlap (`PointPositive`, 245–252).
- push `newLoc[axis] -= overlap[axis]`, recompute `collisionRect`, then **emit a directional event**
  on `callingPrg`:
  - axis 2, `overlap[2] < 0` → `collisionCeiling()` (hit ceiling, moving up)
  - axis 2, `dir[2] = 1` → `collisionPlatform()` (landed from above) + set `collisionPlatform = true`
  - axis 1, `overlap[1] < 0` → `collisionWallLeft()`
  - axis 1, `dir[1] = 1` → `collisionWallRight()`
- after the loop, if `dir[2] = 1 and collisionPlatform = false` → `collisionNoPlatform()`
  (the "you walked off the platform / nothing under you" signal).

`#platform` one-way logic (`calcOverlapPlatform`, 273–293): only lands if `dir[2] >= 1` **and** the
object was *above* the platform last frame (`oldCollisionRect.bottom` top-overlap ≤ 0) **and** the
AI isn't requesting a drop-through (`getAIPlatformDrop()`). Note: `checkCollisions` currently routes
`#platform` through the same `calcOverlap` path (line 218 is commented out — "I don't think this
engine is still being used for rapunzel's escape"), so on top-down Merlin maps a `#platform` behaves
as a top-edge-solid `#solid` via the per-edge table. **Port the per-edge table path** (the live one);
keep `calcOverlapPlatform`'s "was-above-last-frame" gate as the faithful one-way semantic behind a
flag, since it is the documented intent and editor maps may rely on it.

**Who reads the events.** `collisionPlatform`/`collisionWall*`/`collisionCeiling`/`collisionNoPlatform`
are `callingPrg` (the moving actor) methods. In the shipped top-down content the consumers are:
reelFly landing (a knocked-back/flying actor that resolves to grounded on `collisionPlatform`), and
AI scenic pathing (a CPU that turns/repaths on `collisionWall*`). These are the **event surface**
gameplay reads — F2 must emit them even though room-1 (solid-only) only ever fires the wall/ceiling
ones.

### A.2 `modColourTransform` palette (`modColourTransform.txt`)

The original is **not** a binary white flash. Each transform tweens the sprite's `color` from a
start to a target colour at a `speed`, optionally ping-ponging, optionally chaining to a
`pNextTransform` when it finishes (`transColorFin`, 281–293). The palette:

| Transform | start → target | speed | pingpong | chain (`pNextTransform`) | fired by |
|---|---|---:|:--:|---|---|
| `glowRed` | current → `rgb(255,0,0)` | 10 | ✔ | — (held) | low health (`modEnergy.glowRedOnLowHealth`) |
| `glowTeal` | current → `rgb(0,255,255)` | 100 | — | — (held) | freeze (`modFreeze`) |
| `glowRedAndTeal` | `rgb(0,255,255)` → `rgb(255,0,0)` | 10 | ✔ | — | low-health **while** frozen |
| `glowGold` | current → `rgb(255,201,57)` | 10 | — | `fadeGoldBlack` | heal (`modEnergy` 264) |
| `fadeGoldBlack` | `rgb(255,201,57)` → black | 10 | — | — | (tail of glowGold) |
| `glowPink` | current → `rgb(255,200,200)` | 10 | — | `fadeBlack` | (pink ping) |
| `fadeBlack` | last → black | 10 | — | — | (tail of glowPink) |
| `flashWhite` | white → black | (default) | — | — | — |
| `flickWhite` | white → black | 33 | — | — | **every non-lethal hit** (`modEnergy.loseEnergy` 203) |
| `pulseWhite` | white ↔ black | (def) | ✔ | — | invince (`modInvince`) |

**Trigger sites** (the seam the audit flags — combat/status logic *requests* the glow; this domain
*plays* it):
- `modEnergy.glowRedOnLowHealth` (125–131): `if health < pGlowRedPercentage then glowRed()`;
  `increaseEnergy` (142–144) calls `stopGlowRed` once health ≥ threshold. Re-checked on every
  `#colourTransformFin` (`internalEvent` 158–160) so glowRed re-arms while still hurt.
- `modEnergy.loseEnergy` (203): `flickWhite()` on every non-lethal damage tick — **this is what the
  port's binary flash approximates**, and the real thing is a tweened white→black at speed 33.
- `modEnergy` 264 heal → `glowGold` (→ fadeGoldBlack tail).
- `modFreeze` 57/77–78 → `glowTeal` when frozen / when an attack carries `getAttack().glowTeal`.
- glowRed/glowTeal **interact**: each promotes to `glowRedAndTeal` if the other is active
  (`glowRed`/`glowTeal` guards 151/167), and `stopGlowRed`/`stopGlowTeal` demote back (253–271).

Conceptually each transform is an **additive/replace colour overlay** on the sprite, animated over
time. `pCurrentTransform` is the single active one (a new one cancels the old via
`cancelTransColor`); `pNextTransform` chains one follow-up. `objTransColor` (not read here) is the
tweener that steps `color` toward target each frame.

### A.3 Anim model (`animStripMaster.txt`, `objAnimStrip.txt`)

- **Per-frame delay.** Each frame member is named `anm_<chr>_<anim>_<dela>_<fr>` and stored as
  `[#mem, #dela]` (`animStripMaster.addFrame` 23–41). `objAnimStrip` holds a **`pDelayList`** (one
  delay *per frame*, `moveNextFrame` sets `pDelay.tim[2] = pDelayList.nextValue()`, 115–119) — so
  delay varies **frame-to-frame**, not once per strip.
- **`gGameSpeed` scaling.** The frame counter `pDelay.inc = 1 * gGameSpeed` (`init` 30–33). Frames
  advance in **ticks scaled by gGameSpeed**, not wall-ms.
- **Loop vs one-shot — data-driven.** `getLooped = pMemberList.getLooped() and pDelay.fin` (85–87)
  and `getFin = pMemberList.getFin() and pDelay.fin` (69–71). The loop/one-shot flag is a **property
  of the member list** (the strip data), read at runtime — **not** a hard-coded action-name set.
- **`seperateMembers`** (`animStripMaster` 85–102): a member named `"a b c"` (space-separated) is a
  frame of **multiple** strips. F1 already records this; the renderer doesn't depend on it.
- **F1 already recorded** per-frame `reg` and `dela` into `assets.json` (verified: 2211 `dela`
  entries; **47 of 556 anims have a varying per-frame `dela`** — so the loss is real, not cosmetic).
  But F1 also wrote a single `delay` per anim (token-3 collapse) that `anim.ts` currently uses.

### A.4 Minimap (`modMiniMap.txt`)

5-state per-room status (`statusImages`, 30–37): `#clr` (clear), `#cur` (current), `#fre`
(friendly), `#inf` (infested), `#spe` (special). Each room answers `getMiniMapStatus`; the current
room is forced to `#cur` (`getMiniMapData` 169–171). Distance blend: `blend = VarMapRange(minDist,
[60,200], [10,90])` from min(mouseDist, playerDist) (`setBlendForMouseOrPlayer`, 208–222) — the
whole minimap sprite fades by proximity. Per-sprite `blend`/`ink` is set on the sprite channel
(`spriteMaster.freeSprite` defaults `blend=100, ink=36`).

### A.5 `#foregroundPassive` & Z-order (`objRoom`, `spriteMaster`)

`objRoom` doc lists four layers: `#backgroundPassive`, `#backgroundActive` (= solid), `#objects`
(spawn table, never drawn in `#activate` mode), `#foregroundPassive` (**drawn OVER actors**). Z is
`locz`-sorted with global layer constants (`gMapLayer=1 … gGridSelectorLayer=250`); the foreground
passive layer sits above the actor band. F1 preserved the `#foregroundPassive` tile data
non-destructively; the renderer never draws it.

---

## Part B — Gap vs the port today

### B.1 Collision (`world/collision.ts`, `world/tlk.ts`, `components/movement.ts`)
- `tlk.solidTileNums` collects **only `#solid`** (tlk.ts 39–43). `#platform`/`#ceiling`/`#wall*`
  fall through to `#none` → not collidable.
- `CollisionGrid` is a single `Uint8Array` of "solid yes/no" with plain swept-AABB push-out
  (`moveBox`, 86–123). **No per-edge solidity, no merge, no corner tiles, no one-way semantics.**
- **No directional events.** `Movement.update` (movement.ts 86–93) reads only `hitX/hitY` booleans
  and zeroes velocity; nothing emits `collisionPlatform`/`collisionWall*`/`collisionCeiling`/
  `collisionNoPlatform`. reelFly-landing and AI-scenic-repathing have no signal to read.
- The 2-tile border + open-exit model is faithful-enough (`solidCell`, 44–54) and golden-tested.
- **Faithful for shipped maps** (room-1 active tlk = 403 `#solid` / 106 `#none`, zero others), so
  this is a *breadth* gap for editor-authored maps, **not** a room-1 regression.

### B.2 Tint/glow (`render/renderer.ts`, `components/anim.ts`)
- Only a **binary white flash** (`renderer.whiten`, 76–88; `Anim.sprite().flash` reads `isHurt`).
  None of glowRed/glowTeal/glowGold/glowRedAndTeal/flickWhite-tween/pulseWhite/chained transforms
  exist. The low-health red glow, heal gold, freeze teal are drawn today as **ad-hoc HUD overlays**
  (`main.ts drawEnemyBar` teal rect 363–366; `Energy.goldGlow` is tracked but never rendered as a
  tint).

### B.3 Alpha/blend
- `Sprite` has no `blend`/`alpha`; renderer never sets `globalAlpha` for actor sprites (only pickups,
  via a blink). No `#foregroundPassive` blend, no minimap distance blend, no ghost/fade transparency.

### B.4 Foreground layer
- `parseMap` only routes `#backgroundPassive`/`#backgroundActive`/`#objects`. A `#foregroundPassive`
  layer in the data is preserved by F1 but **never drawn** (main.ts 231–234 draws passive+active
  only, then sprites; nothing after).

### B.5 Anim delay & loop flags
- `anim.ts` uses **one uniform `delay` per anim** and a **hard-coded `ONE_SHOT` Set** (anim.ts
  17–21). Per-frame `dela` variation (47 anims) is lost; `gGameSpeed` scaling absent; loop/one-shot
  is a name heuristic, not data.

### B.6 Minimap
- `main.ts drawMinimap` (372–385) is a **3-state** grid: current (`#fff`) / exists (`#69a`) / empty
  (`#333`). No friendly/infested/special, no distance blend.

---

## Part C — Concrete design

### C.1 Collision solver extension (`world/tlk.ts`, `world/collision.ts`)

**Strategy: port the per-edge model literally, golden-test, then (optionally) keep the fast path.**

1. **tlk.ts** — replace `solidTileNums` with `tileTypeNums(key): Map<number, TileType>` returning the
   *symbol* per tile number (`#solid`/`#platform`/`#ceiling`/`#wallLeft`/`#wallRight`/`#none`). Keep a
   `solidTileNums` shim (= entries whose type is `#solid`) so nothing else breaks until callers move.

2. **`CollisionGrid` → per-edge `EdgeGrid`.** Store, per cell, a 4-bit **edge-solidity mask**
   `{L,T,R,B}` derived from the tile type via the A.1 table, plus a `corner` byte (4 corner bits).
   Build in `fromActiveLayer`:
   - phase 1: set each cell's raw edge mask from its type (solid=LTRB, platform=T, ceiling=B,
     wallLeft=L, wallRight=R, none=0). Apply the **−1,−1 fudge** in the px↔cell conversion exactly
     as `initCollisionEdges` does, so flush snapping matches.
   - phase 2 **merge** (`mergeEdges`): for each cell, for its `#right` and `#bottom` neighbour, if
     both facing edges solid → clear both, **except** keep `#bottom` solid when the cell below is
     `#platform`.
   - phase 3 **corners** (`identifyAsCornerTile`): for each `#solid` cell, for each non-solid edge,
     set the diagonal corner bit if both meeting neighbour faces are solid.
   - The 2-tile border stays as today's out-of-bounds-is-solid rule (border tiles are all-edges-solid
     `#solid` equivalents; open-exit edges already handled by `solidCell`).

3. **`moveBox` → edge-aware, directional-event-returning sweep.** Replace the "cell is solid"
   broad-phase with the **magic-rect 4-corner select** + `calcOverlap` per-edge push, ported from
   `checkCollisions`/`calcOverlapEdges`/`calcOverlapCorners`. The mover passes `dir = sign(dx,dy)`;
   for each selected cell only the edges **facing the motion** block (left edge blocks only when
   `dir.x=1`, etc. — exactly the `calcOverlapEdges` guards). Return, in addition to `{x,y,hitX,hitY}`,
   a small **event set**:
   ```ts
   interface MoveResult { x:number; y:number; hitX:boolean; hitY:boolean;
     events: { wallLeft?:boolean; wallRight?:boolean; ceiling?:boolean;
               platform?:boolean; noPlatform?:boolean } }
   ```
   computed by the same axis/overlap-sign branches as `checkCollisions` 266–295 (incl. the
   `dir[2]=1 && !collisionPlatform → noPlatform` tail).

4. **One-way `#platform`.** Implement `calcOverlapPlatform`'s "was-above-last-frame" gate behind a
   per-cell `oneWayTop` flag: a `#platform`'s top edge only blocks a downward mover whose *previous*
   box-bottom was at/above the edge (the solver needs the mover's old box, so thread `oldY` into
   `moveBox`). For `#solid` cells this gate is a no-op. **Drop-through** (`getAIPlatformDrop`) is an
   AI hook — out of scope for F2 unless a shipped map needs it (none do); leave a TODO seam.

5. **`Movement` emits the events.** In `movement.ts update`, after `moveBox`, dispatch the returned
   events as chain messages on the entity so gameplay components can listen:
   `if (r.events.platform) this.entity.send("collisionPlatform")`, etc. reelFly-landing and
   AI-scenic-repathing subscribe via `static handles`. **Keep `hitX/hitY`/velocity-zeroing exactly as
   today** so room-1 feel is byte-identical when only `#solid` is present.

**Performance / save note.** The per-room `EdgeGrid` is built once on room load (`fromActiveLayer`),
same cost class as today. It is **derived data** (rebuildable from the layer + tlk) so it is **not**
serialized — G1's save tree restores the map id and rebuilds the grid, no new save fields.

### C.2 Renderer tint/alpha/foreground passes (`render/renderer.ts`, `components/anim.ts`)

**C.2a — `ColourTransform` component (`components/colourTransform.ts`, new).** Port
`modColourTransform` as a per-entity component holding `{current, next, t, color}`. Methods
`glowRed/glowTeal/glowGold/glowRedAndTeal/glowPink/fadeBlack/fadeGoldBlack/flickWhite/pulseWhite/
flashWhite/stopGlowRed/stopGlowTeal/pulseWhiteStop`, each setting start/target/speed/pingpong/`next`
exactly per the A.2 table; `cancelTransColor` on a new transform; `transColorFin` advances `next` or
clears. A per-tick `step()` tweens `color` toward target by `speed` (ping-pong reverses at the ends),
and on finish runs the chain. The component exposes a **resolved tint** to the sprite:
`getTint(): { rgb:[r,g,b], strength:0..1 } | null`.

**Wire the triggers** (the combat/status seam): `Energy` calls `glowRed`/`stopGlowRed` around the
`pGlowRedPercentage` low-health test and `flickWhite` on each non-lethal `takeHit` (replacing the
`isHurt`→binary-flash path); `Energy.takeHeal`→`glowGold`; `Freeze` first-hit→`glowTeal` and the
glowRed/glowTeal↔glowRedAndTeal promotion guards. The `Hurt` component's white flash is **retired**
in favour of `flickWhite`.

**C.2b — renderer applies the tint.** Extend `Sprite` with `tint?: {rgb,strength}` and `alpha?:number`
(replacing the boolean `flash`). In `drawSprites`:
- **alpha**: `ctx.globalAlpha = s.alpha ?? 1` around the draw (cheap composite, no offscreen).
- **tint**: needs an **offscreen tint pass** for the colored glows (canvas2d can't recolor opaque
  pixels in one blit). Reuse the existing `flashCanvas`/`flashCtx` scratch: stamp the sprite, then
  `source-atop` fill `rgba(r,g,b, strength)` (the same trick `whiten` uses, generalized to any colour
  + strength). For **white** flick at low strength a `globalAlpha` white `source-atop` is identical;
  for **additive glow feel** (red/gold/teal) use `globalCompositeOperation = "lighter"` on the fill so
  the glow brightens rather than flatly replaces — pick per-transform (replace for white flick;
  lighter/screen for glows). Document in the renderer which transforms use replace vs lighten.
- **Cache to avoid per-frame getImageData** (still banned): key the tinted result by
  `(sprite-frame, quantized-colour, quantized-strength)` and reuse for the (few) simultaneously
  glowing sprites. Quantize strength to ~8 steps. This keeps the cost to a handful of small
  source-atop fills per frame.

**C.2c — `#foregroundPassive` pass.** `parseMap` already preserves it; route it as a 4th layer.
After `drawSprites` in `main.ts`, draw `rooms.room.layer("#foregroundPassive")` with its tileset
(resolve the same way as passive/active, lazy-load via `ensureMapAssets`). Apply
`pFrontLayerBlendLevel=128` as `globalAlpha=0.5` if a map sets a front blend (default opaque). This
realizes the `gMapLayer` over-actor Z-band without the full discrete-Z display list (that stays a
deferred render item — see §F out-of-scope).

### C.3 Anim per-frame delay + loop flags (`components/anim.ts`, build/`assets.json`)

1. **Per-frame delay.** `assets.json` already stores `frames[i].dela`. Change `Anim.update` to read
   the **current frame's** `dela` (not the anim-level `delay`): advance when `++timer >= frame.dela`.
   Scale by `gGameSpeed` (a render/game-speed global; default 1) — `timer += gGameSpeed` and compare
   to `dela`, matching `pDelay.inc = 1*gGameSpeed`. Keep the anim-level `delay` only as a fallback.
2. **Data-driven loop flag.** Replace the hard-coded `ONE_SHOT` Set. The original reads the flag off
   the **member list**. Source it from data: extend the F1 builder to record a per-anim
   `loop: boolean` (the original `getLooped`/`getFin` distinction — derivable from the strip's
   member-list flag; where the source doesn't expose a per-strip bool, fall back to the current
   action-name heuristic as a documented default). `Anim` reads `anim.loop`: cyclic strips wrap,
   one-shot strips advance-and-hold (the existing two branches, now data-gated). **No build change
   ships in this plan if the loop bool isn't recoverable from the cast** — in that case keep the
   heuristic but move it to a single data-overridable table and note the residual gap.
3. `seperateMembers` multi-strip membership is already F1's; no change.

### C.4 Minimap 5-state (`main.ts drawMinimap` or a small `render/minimap.ts`)

Compute each room's `miniMapStatus` ∈ `{#clr,#cur,#fre,#inf,#spe}`:
- `#cur` current room; `#clr` cleared rooms (RoomManager already tracks the cleared set);
- `#inf` infested = has live hostile units (room has uncleared enemies) — query the room/`teamMaster`;
- `#fre` friendly, `#spe` special — from room data (`getMiniMapStatus`) when present, else `#clr`.
Map each state to a colour (port the status-image palette as solid colours since we have no minimap
bitmaps bundled). Apply the **distance blend** (`VarMapRange(minDist,[60,200],[10,90])`) as the
minimap's `globalAlpha` from min(player, cursor) distance. This lifts the port 3-state → 5-state +
blend. (Nav-mode toggle / mouse interaction stay out of scope — §F.)

---

## Part D — Step-by-step order (F2 first, golden-first; then F3)

Each step is independently testable and leaves the build green + room-1 clearing.

**F2 — collision (golden-first):**
1. **tlk `tileTypeNums`** + keep `solidTileNums` shim. Unit-test the type map on a synthetic key.
   *(no behavior change yet.)*
2. **`EdgeGrid` build** (edge masks + merge + corners) behind the existing `CollisionGrid` API;
   `#solid`-only path produces a mask identical to today. **Golden: room-1 + all existing
   `collision_golden.test.ts` pass unchanged.**
3. **edge-aware `moveBox`** with the magic-rect select + `calcOverlap` push. **Golden:** the existing
   5 scenarios + new per-type goldens (platform one-way, ceiling-from-below, wallLeft/Right one-way,
   corner anti-diagonal, merged interior face). room-1 still clears.
4. **directional events** returned + dispatched by `Movement`. Test: an entity moving down onto a
   platform receives `collisionPlatform`; off it receives `collisionNoPlatform`; into a wall receives
   `collisionWallRight`. room-1 unaffected (still only wall/ceiling fire).
5. **wire one consumer** (reelFly-landing or AI-scenic-repath) to the events as a smoke that the
   surface is live; if no shipped map exercises it, ship the event surface + a unit test and note the
   consumer as data-gated.

**F3 — render/anim (each visually smoke-checkable):**
6. **anim per-frame delay + `gGameSpeed`** (data already present) — lowest risk, no new assets.
7. **data-driven loop flag** (or single overridable table if the bool isn't recoverable).
8. **`ColourTransform` component** + trigger wiring (glowRed/flickWhite/glowGold/glowTeal/
   glowRedAndTeal), retire the binary flash + ad-hoc overlays. Renderer tint pass + cache.
9. **per-sprite alpha/blend** on `Sprite` (used by glow strength, front-layer, minimap).
10. **`#foregroundPassive`** render pass (over actors).
11. **minimap 5-state + distance blend.**

F2 (1–5) and F3 (6–11) are independent; if parallelized, the only shared file is none (collision
vs renderer/anim/main). Recommended: land F2 fully (golden-locked) before F3 to keep the no-regression
signal clean.

---

## Part E — Test plan

**Collision golden tests (extend `port/test/collision_golden.test.ts`):**
- **room-1 no-regression (the pin):** the `#solid`-only `EdgeGrid` produces the same blocked
  positions as today; the 5 existing scenarios pass **unchanged**; `playthrough_smoke` ends
  `enemies:0, exitsOpen:true, errors:none`.
- **per tile-type goldens:** (a) `#platform` — a downward mover lands flush on the top edge and is
  *not* blocked moving up through it or sideways past it; a mover already below does **not** snap up.
  (b) `#ceiling` — blocks an upward mover at the bottom edge, passes a downward mover. (c) `#wallLeft`
  — blocks rightward-into-left-face only; passes leftward. (d) `#wallRight` symmetric. (e) **merge** —
  two adjacent `#solid` cells: the shared interior face never produces a spurious overlap (a mover
  along the seam slides clean). (f) **corner** — a small box cannot squeeze diagonally between two
  solids meeting at a merged corner.
- **directional events:** assert the exact event set for moving down-onto-platform
  (`platform`+not-`noPlatform`), walking-off (`noPlatform`), into walls (`wallLeft`/`wallRight`),
  into a ceiling (`ceiling`).
- **magic-rect parity:** a fixture replicating `initMagicRect` geometry (roomLocation, tileSize=32,
  border=2) confirms the px→tile-index mapping selects the same 4 corner tiles as the Lingo for a
  handful of hand-computed boxes. (Literal-port confidence check.)
- **load-any-map:** loading each of F1's 47 maps builds an `EdgeGrid` without throwing (structural).

**Render — structural + visual smoke (render is hard to unit-test):**
- **structural unit tests:** `ColourTransform` state machine — glowGold chains to fadeGoldBlack and
  ends; glowRed ping-pongs and `stopGlowRed` clears; glowRed+glowTeal promote to glowRedAndTeal;
  flickWhite is a one-shot white→black; `getTint` returns the expected rgb/strength at sampled `t`.
  `Anim` advances on per-frame `dela` (a 2-frame strip with `dela=[1,5]` advances at the right ticks)
  and scales with `gGameSpeed`; data loop flag wraps vs holds.
- **renderer smoke:** `drawSprites` with a `tint` produces a non-source image without calling
  `getImageData` (spy the ctx); `alpha` sets `globalAlpha`; `#foregroundPassive` draws **after**
  sprites (ordering assert on a ctx call log).
- **visual smoke (manual, `?map=`):** low-health red pulse on the player; hit → white flick (not a
  flat flash); heal → gold glow→fade; freeze → teal hold; a map with a `#foregroundPassive` layer
  occludes an actor; 5-state minimap shows current/cleared/infested distinctly and fades with
  distance. **room-1 plays identically** (the no-regression).

---

## Part F — Faithfulness risks

1. **The "magic rect" solver (highest).** The source author states they don't fully understand
   `pMagicRect`/`selectTilesFromCollisionRect`. **Mitigation:** port it *literally* (offset = tileSize
   − roomLocation, +borderThickness, the −1,−1 fudge), lock with the magic-rect parity fixture +
   room-1 golden **before** any refactor. Do not "clean it up" until parity is green.
2. **One-way platform "was-above-last-frame" gate.** Needs the mover's previous box; if threaded
   wrong, platforms become solid or pass-through. Golden-test the up/down/side cases explicitly; for
   shipped (solid-only) maps this code path is never taken, so room-1 is unaffected.
3. **Tint performance in canvas2d.** Per-frame `getImageData` is banned (PORTING_PLAN); the offscreen
   source-atop tint pass + quantized `(frame,colour,strength)` cache keeps it to a few small fills.
   Risk: many simultaneously-glowing sprites blow the cache — cap cache size, fall back to no-tint (or
   a globalAlpha approximation) under pressure. White flick can stay a globalAlpha fill (no offscreen).
4. **Anim-timing desync.** Switching to per-frame `dela` + `gGameSpeed` changes playback cadence for
   the 47 varying anims; a wrong `gGameSpeed` default (must be 1) or counting ms instead of ticks
   desyncs everything. Test the cadence on a known strip; keep `gGameSpeed` a single global.
5. **Save/perf of per-room collision.** The `EdgeGrid` is derived (rebuilt on load from layer+tlk),
   so **nothing new is serialized**; G1's map-id restore suffices. Build cost is one pass per room
   load (same class as today) — no per-frame cost. Risk is only a build-time bug; the load-any-map
   structural test covers it.
6. **Loop-flag recoverability.** If the per-strip loop bool can't be cleanly recovered from the cast
   member list, the data-driven step degrades to a single overridable table (documented residual
   gap), not a regression — the current heuristic is already mostly right for bundled chars.

---

## Part G — Out of scope (explicit)

- **WebGL tinting** — canvas2d offscreen source-atop + cache is sufficient for the handful of glowing
  sprites; a WebGL tint path is only a perf escape hatch if §F.3 proves inadequate.
- **The map editor** (`map_editor.exe`/`mapEditMaster`) — separate executable, README §8, not parity.
- **Minimap interaction** — nav-mode toggle, mouse hover, the minimap-as-fast-travel; only the
  5-state status + distance blend **display** is in scope.
- **Discrete Z-layer display list** (`gMapLayer=1…gGridSelectorLayer=250` unified channel order) —
  F3 adds the `#foregroundPassive` over-actor band specifically; the full discrete-Z reorder of
  bullets/pickups/HUD/effects stays the deferred render item (05-audit §2 "Display list").
- **Per-tile exit ranges / exit arrows / `#endRoom`** — separate "play any map" rows (05-audit §5
  items 3–4), not F2/F3.
- **AI platform drop-through** (`getAIPlatformDrop`) and the legacy side-on **zones** engine
  (`initZones/mergeZones/shiftZones`) — no shipped top-down map uses them; leave TODO seams only.
- **Live room-state restore** (actor positions/graves on re-entry) — H3, not F2/F3.
- **`objTransColor` exact tween curve** — port the linear start→target step at `speed`; if the
  original uses a non-linear curve it's a cosmetic refinement, not a parity blocker.
```
