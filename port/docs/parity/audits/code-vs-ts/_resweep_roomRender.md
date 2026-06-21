# Re-Sweep Audit: Room Render / Map / MiniMap / Screen Exits

> **Triage (2026-06-21):** A/B/C/F FIXED, D/E noted as minor.
> - **A (arrow colour)** — FIXED: new `RoomManager.roomHasHostiles` (objRoom.getHostile) colours by the NEIGHBOUR's hostiles — cleared→no, visited→pState enemies, unvisited→scan its `#objects` layer for `#inf` actors. An enemy-less neighbour now reads green. (exit_arrows.test.ts)
> - **B (bilateral edges)** — FIXED: the arrow `passable(i)` now ANDs the neighbour's facing-edge grid (`ListCombineExitTiles`), so an arrow never marks a spot walled off on the other side. (exit_arrows.test.ts)
> - **C (minimap timing)** — FIXED: `drawMinimap` is gated on `game.navMode` (modMiniMap is off until goNavMode), so it appears only once the room is cleared, not during combat.
> - **F (arrow z-order)** — FIXED: arrows now draw right after the active tile layer (before the actor sprites), matching the original's bake-into-backgroundActive — actors render OVER them.
> - **D (#spe vs #inf for rooms with both)** — minor edge case (rooms holding enemies AND a special actor); left as-is.
> - **E (pScale=2 minimap size)** — cosmetic; the port's `cell=5` is a calibrated substitute. Left as-is.

**Files**: `casts/script_objects/objRoom.txt`, `casts/script_objects/objMap.txt` (via objMap.txt),
`casts/script_objects/modMiniMap.txt`, `casts/script_objects/modScreenExits.txt`
**TS port**: `port/src/world/rooms.ts`, `port/src/render/minimap.ts`, `port/src/main.ts`
**Globals**: `extracted/engine/scripts/MovieScript 1 - GameSpecific.ls` (gExitArrows=1, gNavMode=1)
**Method**: All six lenses applied per handler (translation, activation/reachability, global/initial state,
player-POV, draw-order/occlusion, missing-test). Focus on present-but-wrong bugs the first pass missed.

---

## A. EXIT-ARROW COLOUR: WRONG SOURCE (PRESENT-BUT-WRONG)

### Lingo chain (objRoom.drawExitArrows → modScreenExits.drawExitArrowsOnImage)

`objRoom.drawExitArrows` (objRoom.txt:232-258):
1. Calls `pMap.getSurroundingHostiles()` → `getSurroundingInfo(#getHostile)` (objMap.txt:457-481).
2. For each of the four cardinal neighbours, invokes `nRoom.getHostile(nEdgeName)`.
3. `objRoom.getHostile` (objRoom.txt:342-351):
   - If the neighbour has never been entered (`pBeenActivated = false`): queries the neighbour's `#objects`
     tile layer directly for any `#inf`-status actors.
   - If it has been entered: calls `getHostileInState()` → `getMiniMapStatusFromRoomState(#exitArrows)` which
     scans `pState` (saved actor list) for any actor whose miniMapStatus is `#inf` (the
     `#exitArrowsStatusProgression = [#clr, #inf]` from structMaster).
4. `surroundingHostiles[#left/#top/#right/#bottom]` = `true` (hostiles in that neighbour) or `false`/`[]`.
5. `drawExitArrowsOnImage` (modScreenExits.txt:206-236):
   - For each edge: `hostile = surroundingHostiles[nEdge]`
   - `false` or `[]` → `#grn` (green arrow: safe next room)
   - `true` → `#rdd` (red arrow: hostile next room)

**The colour is driven by the NEIGHBOUR room's threat level, not the current room.**

### Port (rooms.ts:exitArrowRects, line 252-293)

```typescript
// rooms.ts:276
const colour: "green" | "red" = this.cleared.has(nbr.num) ? "green" : "red";
```

The port uses `this.cleared.has(nbr.num)`:
- `green` if the neighbour is in the cleared set.
- `red` if not.

### Why this diverges

The original's `getHostile()` returns `false` (green) for a neighbour whose objects layer contains only
`#clr`-status actors even if that room was never visited. The port marks every unvisited room as `red`
(not in `cleared` set). Concretely: a room containing only friendly or neutral actors (`#miniMapStatus: #fre`)
would show a GREEN arrow in the original (getHostile returns false/no #inf actors) but a RED arrow in the
port (never cleared → not in `this.cleared`).

More importantly, a room that IS cleared but was exited while still containing
`#fre`-status actors (e.g. friendly NPCs or dwellings) also diverges: original shows green (no #inf in
pState), port shows green (in cleared set). That case is consistent.

The divergence affects rooms that have only `#fre`- or `#spe`-actors (not enemies):
- Original: green arrow (getHostile returns false — no #inf)
- Port: red arrow until the player enters AND defeats enemies (but there are none)

**Lens 4 (Player-POV)**: Player sees RED arrows on exits to friendly or empty (NPC-only) rooms.
Original shows GREEN. This is a visible, observable, present-but-wrong colour error.

**Severity**: Medium. Behavioural mismatch only for rooms whose actors are all non-hostile by minimap status
(#fre / #spe / #clr typed). The acknowledged note at rooms.ts:248 ("Original keyed RED off the DESTINATION
room's hostiles; here it's the current room's clear state") is a documented deliberate simplification but it
produces wrong colours for the case above.

---

## B. EXIT-ARROW GEOMETRY: UNILATERAL VS BILATERAL EDGE MATCHING (PRESENT-BUT-WRONG)

### Lingo chain

`objRoom.drawExitArrows` (objRoom.txt:237-244):
```lingo
surroundingExitTiles = pMap.getSurroundingExitTiles()   -- neighbour's facing edge tiles
myExitTiles = me.getExitTiles()                          -- current room's edge tiles
-- combine:
combinedTiles[i] = ListCombineExitTiles(surroundingExitTiles[i], myExitTiles[i])
```

`ListCombineExitTiles` (extracted/engine/scripts/MovieScript 37.ls):
```lingo
if (nItem1 = #solid) or (nItem2 = #solid) then
  nItem = #solid
else
  nItem = #none
end if
```

A position is passable (`#none`) **only if BOTH** the current room's edge tile AND the neighbouring room's
matching edge tile are passable. The arrow rects are built from these combined tiles.

`getSurroundingExitTiles` via `getSurroundingInfo` (objMap.txt:461-481):
- For `#left` direction: queries the left-neighbour's `#right` edge tiles.
- For `#right` direction: queries the right-neighbour's `#left` edge tiles.
- etc. (edgeNames = [#right, #bottom, #left, #top] mapped from dirNames = [#left, #top, #right, #bottom])

### Port (rooms.ts:exitArrowRects, line 279-282)

```typescript
const passable = (i: number): boolean =>
  horizontal ? this.grid.passableCell(i, edge === "up" ? 0 : rows - 1)
              : this.grid.passableCell(edge === "left" ? 0 : cols - 1, i);
```

Only the CURRENT room's collision grid is queried. The neighbour room's facing edge is never consulted.

**Consequence**: If the current room has a wall-free column on its right edge but the neighbour room has a
solid tile on its left edge at the same position, the original would show NO arrow there (both must be
passable), but the port shows an arrow. The arrows do not match the actual navigable corridor.

**Lens 4 (Player-POV)**: Player sees an exit arrow over a position that is geometrically blocked from the
other side. Attempting to navigate there results in collision with the neighbour room's wall — the arrow is
misleading. This is a present-but-wrong geometry placement.

**Severity**: Low-medium. Affects maps where adjoining rooms have asymmetric open edges (not all maps do).
The navigation still works (the player can still walk through the open tiles on THIS side), but the arrow may
cover a location that's immediately blocked on re-entry.

---

## C. MINIMAP DISPLAY TIMING: ALWAYS-ON VS NAV-MODE GATED

### Lingo chain (modMiniMap.goNavMode / leaveNavMode)

`modMiniMap.goNavMode` (modMiniMap.txt:177-179):
```lingo
on goNavMode me
  me.displayMiniMap()
end
```

`modMiniMap.leaveNavMode` (modMiniMap.txt:181-183):
```lingo
on leaveNavMode me
  me.miniMapOffScreen()
end
```

The original minimap is **OFF by default** (`pShowMiniMap = false` at init, modMiniMap.txt:48). It turns ON
when `goNavMode` fires, which happens inside `objRoom.attemptOpenExits` (objRoom.txt:209-211):
```lingo
if gNavMode = true then
  g.gameMaster.goNavMode()   -- which calls map.goNavMode() -> modMiniMap.goNavMode() -> displayMiniMap()
end if
```

`goNavMode` fires ONLY when `isPlayerEnemiesDead()` is true (exits opening). The minimap is NEVER shown
while the room still has live enemies.

`leaveNavMode` fires when the player moves to a new room (objPlayerMerlinCharacter.txt:261 calls
`theMap.moveRoom(pLeaveDir)` which involves calling `leaveNavMode`). The minimap goes OFF on room
transition, then re-activates on the NEXT room's clear.

### Port (main.ts:renderScene, lines 403-408)

```typescript
drawMinimap(renderer, {
  map, loc: rooms.loc, cleared: rooms.clearedSet(), infested: rooms.infestedRooms(),
  playerPx: { x: pm.x, y: pm.y }, cursorPx: game.input.cursor(),
}, viewW);
```

`drawMinimap` is called **unconditionally** on every game frame during the `s === "game"` branch.
The minimap is always visible during gameplay — even in an uncleared room with live enemies.

**Lens 2 (Activation/Reachability)**: In the original, the minimap does not appear on room entry; it appears
after the room is cleared (navMode trigger). The port shows the minimap from the very first frame of gameplay.

**Lens 4 (Player-POV)**: Original: player enters a room, no minimap visible. After killing all enemies,
minimap appears (visual reward / navigation cue that the room is now safe). Port: minimap is always visible,
eliminating this feedback signal.

The prior audit (modMiniMap.md) calls this "SAME OUTCOME" and "FUNCTIONALLY SAME" but it is not: the
original's minimap is an action-unlocked UI element gated on room clear; the port's is a persistent HUD.

**Lens 6 (Missing-Test)**: No test covers the "minimap is hidden until navMode fires" behaviour.

**Severity**: Medium. Cosmetic on first analysis, but meaningful as a game-feel signal: the minimap
appearing signals "room cleared, nav mode active." That signal is absent in the port.

---

## D. MINIMAP STATUS DECISION TREE: MISSING #CLR GATE FOR VISITED ROOMS

### Lingo (objRoom.getMiniMapStatus, objRoom.txt:409-433)

```lingo
on getMiniMapStatus me
  if pBeenActivated = true then
    miniMapStatus = me.getMiniMapStatusFromRoomState(#miniMap)
  else if pTileLayers[#objects] <> void then
    miniMapStatus = pTileLayers.objects.getMiniMapStatus(#miniMap)
  else
    miniMapStatus = #clr
  end if
  
  if miniMapStatus = #clr then
    pRoomCleared = true   -- side effect: rooms that start clear are recorded
  end if
  
  return miniMapStatus
end
```

`getMiniMapStatusFromRoomState` (objRoom.txt:435-460) uses `#miniMapStatusProgression = [#clr, #inf, #fre, #spe]`
(structMaster.txt:570-573). It starts at `#clr` and escalates: the HIGHEST-ranking status among all actors
in `pState` wins. If `pState` is empty (all enemies defeated, room cleared), it returns `#clr`.

### Port (minimap.ts:statusFor, lines 39-47)

```typescript
export function statusFor(inp: MinimapInputs, x: number, y: number): MiniStatus | null {
  const room = inp.map.roomAt({ x, y });
  if (!room) return null;
  if (x === inp.loc.x && y === inp.loc.y) return "#cur";
  const data = room.miniMapStatus;
  if (data === "#fre" || data === "#spe") return data;
  if (inp.infested.has(room.num)) return "#inf";
  return "#clr";
}
```

The port's `infestedRooms()` (rooms.ts:138-146):
```typescript
infestedRooms(): Set<number> {
  const inf = new Set<number>();
  if (this.room && !this.cleared.has(this.room.num) && this.enemiesAlive()) inf.add(this.room.num);
  for (const [num, snap] of this.pState) {
    if (this.cleared.has(num)) continue;
    if (snap.some((s) => s.type === "enemy")) inf.add(num);
  }
  return inf;
}
```

**Issue**: A visited but not-yet-cleared room where `pState` contains an actor with `miniMapStatus: #spe`
(e.g. `act_ochre.txt`, `act_scarletWizard.txt`, `act_berlin.txt`) would show:
- Original: `#spe` (the progression escalates to #spe because #spe > #inf > #fre > #clr in position)
- Port: `#inf` if the room also has an enemy in pState (enemy check wins over room.miniMapStatus data)

The port's `statusFor` checks `room.miniMapStatus` (the STATIC value parsed from map data) not the LIVE
`pState` actors' minimap status. In the original, `getMiniMapStatusFromRoomState` iterates `pState` and
calls `getMiniMapStatusForSymbol(nActorType)` for EACH LIVE actor, producing a dynamic result based on what
actors remain alive.

For a visited room that currently contains both a `#inf`-type enemy AND a `#spe`-type actor (e.g. a special
boss), the original returns `#spe` (highest in progression). The port returns `#inf` (infested set wins in
statusFor).

**Lens 4 (Player-POV)**: A room containing a special actor plus enemies shows as `#inf` (red) in the port
instead of `#spe` (yellow) as in the original. The distinction signals boss rooms — this information is lost.

**Severity**: Low. Only affects maps with rooms containing both enemies and special-type actors simultaneously.

---

## E. MINIMAP SCALE FACTOR (modMiniMap `pScale = 2`) — NOT APPLIED

### Lingo (modMiniMap.setupSprite, modMiniMap.txt:224-243)

```lingo
on setupSprite me, mapImage
  ...
  pMember.image = mapImage
  pMember.regPoint = point(pMember.width, pMember.height)
  SpriteSetMember(pSprite, pMember)
  
  pSprite.width = pSprite.width * pScale     -- scale applied here
  pSprite.height = pSprite.height * pScale
end
```

`pScale = 2` is set in `addModParams` (modMiniMap.txt:26-39: `i[#scale] = 2`). The minimap sprite
is displayed at DOUBLE the size of the mapImage.

### Port (minimap.ts:drawMinimap, lines 49-74)

```typescript
const cell = 5;
const w = map.mapSize.x * cell, h = map.mapSize.y * cell;
```

The port draws directly at `cell=5` pixels per room tile. There is no `pScale=2` doubling applied.

**Lens 4 (Player-POV)**: The port minimap is rendered at whatever size `cell=5` produces. The original
renders the base status-image size, then doubles via `pSprite.width/height *= 2`. If the original's status
images are, say, 4×4 pixels, the displayed sprite is 8×8 per cell. The port's 5×5 per cell may be an
approximation, but the render comment at minimap.ts:5 ("no bundled minimap bitmaps — each state maps to a
solid colour") confirms the scale factor was not intentionally ported.

**Severity**: Low / cosmetic. The `cell=5` value is a calibrated substitute for the unresolved
`statusImage.width * pScale` product. Not a behavioural parity gap, but the original's size is not matched.

---

## F. DRAW-ORDER: EXIT ARROWS DRAWN ON BAKED IMAGE vs CANVAS OVERLAY

### Lingo (objRoom.drawExitArrows, objRoom.txt:250-253)

```lingo
myImage = me.getMember().image
me.pTileLayers[#backgroundActive].drawExitArrowsOnImage(myImage, exitArrowRects, surroundingHostiles)
```

The arrows are drawn directly **INTO the room's backing bitmap** (the member's image). They are baked into
the tile layer render; actors (sprites) are then drawn ON TOP of this baked image. Exit arrows appear UNDER
actors.

### Port (main.ts:renderScene, lines 389 and after actors)

```typescript
drawExitArrows(renderer, assets, rooms.exitArrowRects());  // line 389
```

This call is placed AFTER `renderer.drawSprites(sprites)` (actors, line 377-378), meaning exit arrows
render ON TOP of actors. The z-order is reversed.

**Lens 5 (Draw-order/Occlusion)**: In the original, actors walk over the exit arrows. In the port, exit
arrows overlay actors near room edges — an enemy standing at the edge is partially covered by the arrow
overlay.

**Severity**: Low-medium. Visible when actors are positioned near room edges, which is common (enemies patrol
to boundaries). The arrows have a finite thickness (`ARROW_THICKNESS = 16`), so any actor near an edge will
be partially covered in the port but visible over the arrows in the original.

---

## G. NAV-MODE ENTRY GUARD: `gNavMode` GLOBAL CHECK

### Lingo (objRoom.attemptOpenExits, objRoom.txt:209-211)

```lingo
if gNavMode = true then
  g.gameMaster.goNavMode()
end if
```

`gNavMode = 1` from `GameSpecific.ls:20`. In Lingo, `1 = true` is `true`. The guard is always true for
Merlin's Revenge. Rooms that clear → navMode always fires.

### Port (rooms.ts:setExits)

```typescript
game.navMode = open;  // line 229
```

The port unconditionally sets `game.navMode = open` with no gNavMode guard. Equivalent for this game
(gNavMode is always 1), but the guard is not replicated. **Not a functional gap for Merlin's Revenge.**

---

## H. ROOM-CLEARED SOUND: `isMapClear()` GATE CONFIRMED CORRECT

### Lingo (objRoom.attemptOpenExits, objRoom.txt:200-207)

```lingo
if pRoomCleared = false then
  pRoomCleared = true
  if pMap.isMapClear() = false then
    me.playSound(pRoomClearedSound)   -- "end_screen"
  end if
end if
```

Sound plays only on FIRST clear of a non-final room.

### Port (rooms.ts:markCleared, line 313)

```typescript
if (firstClear && !(endRoomWin || clearAllWin)) game.audio?.play("end_screen");
```

**Confirmed correct**. `firstClear` mirrors `pRoomCleared = false`, the sound is gated on not winning.

---

## I. `#minimap` SYMBOL CASE IN `getMiniMapStatusFromRoomState` — NOT A BUG

`objRoom.getMiniMapStatus` calls `getMiniMapStatusFromRoomState(#miniMap)` (line 415, capital M).
The `case forWhat of` inside that handler at line 441 tests `#minimap` (lowercase). In Lingo, symbols are
case-insensitive (the runtime normalises them), so `#miniMap = #minimap`. Both `objRoom.txt:441` and
`objTileMap.txt:88` use `#minimap` in their case blocks; the capital-M call is a harmless stylistic variant.
**Not a bug in original or port.**

---

## SUMMARY TABLE

| # | Handler(s) | Lens | Finding | Severity |
|---|---|---|---|---|
| A | `drawExitArrows` / `drawExitArrowsOnImage` | 4 Player-POV | Arrow colour uses `cleared.has(nbr)` instead of neighbour's `getHostile()` — rooms with only `#fre`/`#spe` actors show RED instead of GREEN | Medium |
| B | `drawExitArrows` + `ListCombineExitTiles` | 4 Player-POV | Arrow rects computed from current-room tiles only; original AND-combines current + neighbour facing edges — arrows may mark positions blocked from the neighbour side | Low-Med |
| C | `modMiniMap.goNavMode` / `leaveNavMode` | 2 Activation, 4 Player-POV, 6 Missing-Test | Minimap is always on in port; original gates it on nav-mode (room-clear) — the clear-signal UX feedback is absent | Medium |
| D | `getMiniMapStatus` + `getMiniMapStatusFromRoomState` | 4 Player-POV | Port statusFor uses static `room.miniMapStatus` data; original iterates live pState actors and picks highest progression status — rooms with #spe actors + enemies show #inf in port instead of #spe | Low |
| E | `modMiniMap.setupSprite` (`pScale=2`) | 4 Player-POV | Scale factor not applied in port; minimap rendered at cell=5 vs original's statusImage.width × 2 | Low / Cosmetic |
| F | `drawExitArrowsOnImage` vs canvas overlay order | 5 Draw-order | Port draws arrows AFTER sprites (actors overlap); original bakes arrows into room image (actors ON TOP) — z-order reversed near edges | Low-Med |
| G | `attemptOpenExits` gNavMode guard | 1 Translation | gNavMode guard not ported; no functional impact for this game (always 1) | Non-issue |
| H | `attemptOpenExits` sound gate | 1 Translation | Correct — `firstClear && !winCondition` matches original | Clean |

**Confirmed clean** (re-verified against source):
- navMode speed boost: rooms.ts:228-229 → `game.navMode = open` → movement.ts:115 (NAV_SPEED_MULT=3) ✓
- `isMapClear` / `isEndRoom` win conditions: rooms.ts:296-314 ✓
- Proximity blend formula: minimap.ts:23-27 exactly matches VarMapRange([60,200],[10,90]) ✓
- pState snapshot/restore cycle: rooms.ts:85-90, 111-113 ✓
- Room-clear sound gate: rooms.ts:313 ✓
- `#minimap` symbol case in Lingo handler: not a bug (symbols are case-insensitive) ✓

---

FILE=_resweep_roomRender | GAPS=6 | A: exit-arrow colour uses cleared-set not neighbour getHostile (rooms with only friendly actors show red instead of green) | B: arrow rects unilateral (current room only) vs bilateral AND-combine | C: minimap always-on vs original nav-mode-gated (clear-signal UX missing, no test) | D: statusFor uses static room.miniMapStatus not live pState actor progression (#spe rooms show #inf) | E: pScale=2 sprite scale not applied | F: exit arrows drawn after sprites (z-order reversed vs original baked-into-image)
