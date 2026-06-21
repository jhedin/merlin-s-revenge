# Re-sweep Audit: gameMaster / saveMaster / screenMaster vs TypeScript Port
**Target files:** `casts/master_objects/gameMaster.txt`, `casts/master_objects/saveMaster.txt`,
`casts/master_objects/screenMaster.txt`  
**Port files:** `port/src/scenes/sceneManager.ts`, `port/src/main.ts`, `port/src/systems/save.ts`,
`port/src/scenes/screens.ts`, `port/src/scenes/menu.ts`  
**Auditor note:** The prior pass (gameMaster.md) applied only lens #1 (translation). This pass applies
all six lenses — especially activation/reachability (#2), global+initial state (#3), and player-POV (#4).

---

## LENS MAP — handler × six lenses

### `gameMaster.on gameOver` (lines 102–112)

**1 TRANSLATION** — `sceneManager.ts:174–177` (`gameOver(hasWastedScript)`).
Original: if `gGameOverScript = #none` → `quitToTitle`; else `finishGame()` then `goScreen(#animScreenGameOver, #gameOver)`.
Port: if `!hasWastedScript` → `toTitle()`; else `goScreen("gameOver","playWasted")`.
`finishGame()` is NOT called before `goScreen` in the port. In the original it is called explicitly at line 109 before transitioning.

**2 ACTIVATION** — Fires from `main.ts:278` (`resolveDeath` calls `scene.gameOver(!!wastedScript)`) after
the 36-frame die-animation delay. Reachable. Trigger is correct.

**3 GLOBAL/INITIAL STATE** — `gGameOverScript` is set in game-specific init (a data symbol; port
replaces it with `wastedScript` nullable loaded from `/assets/wasted.txt`). The guard logic is
equivalent. No mismatch here.

**4 PLAYER-POV** — **GAP-1 (REAL):** In the original, `finishGame()` is called at line 109 before the
wasted cutscene starts. `finishGame()` calls `actorMaster.finishActors()` + `enemyEnergyMaster.finish()`
+ `currentMap.finish()` — it stops all game objects cleanly. In the port, `scene.gameOver()` goes
straight to `goScreen("gameOver","playWasted")` without an equivalent teardown. `freshGame()` is only
called on the `startGame` action (after the *intro* cutscene), not after the wasted cutscene. After the
wasted cutscene, `cutSceneFinished("wasted")` in `sceneManager.ts:148–154` calls `doLoad()` then sets
`this.screen = "game"` and `this.actions.resume()` — it never calls `freshGame()` or any teardown of
the prior game state. The prior run's entities and effects remain in `game.entities` until `freshGame()`
clears them (which only happens on a new game from the title). This means after a game-over + reload,
dead/stale entity references from the previous run can accumulate alongside the restored state.

**5 DRAW-ORDER/OCCLUSION** — The wasted cutscene `cutscene.render(renderer)` occupies the full frame
(sceneManager: `isCutscene()` returns true for `gameOver` screen → `cutscene.render` early-returns).
No occlusion issue.

**6 MISSING TEST** — No test covers "die → deathT countdown → resolveDeath → gameOver →
wastedCutscene → doLoad → game state restored" end-to-end. Player-visible flow untested.

---

### `gameMaster.on gameComplete` (lines 81–94)

**1 TRANSLATION** — `sceneManager.ts:170` (`gameComplete()` → `goScreen("gameComplete","playComplete")`).
Original calls `finishGame()` first (line 82), then `movieMaster.gameComplete()`, then plays
`gGameCompleteSound`. Port calls `audio.play("end_level")` and `audio.playMusic("last_stand_v4")`
inside the `playCutScene` callback (`main.ts:215–216`) but does NOT call `finishGame()`.

**2 ACTIVATION** — Fired by `rooms.ts:onMapClear()` callback → `scene.gameComplete()`. Correct trigger.

**3 GLOBAL/INITIAL STATE** — `gGameCompleteSound` is played in the original at gameComplete time
(gameMaster.txt:90–92). The port substitutes `audio.play("end_level")` which fires inside the
`playCutScene` callback. This is equivalent in timing (fires before the cutscene starts, not after
`finishGame`). The `gGameCompleteEvent = #mapClear` gate is replaced by the direct `onMapClear`
callback. No mismatch in the event semantics.

**4 PLAYER-POV** — **GAP-2 (REAL, same class as GAP-1):** `finishGame()` is NOT called before the
game-complete cutscene in the port. Actors keep ticking in `game.entities` while the complete cutscene
runs. In the original, `finishGame()` at line 82 stops all actors before the cutscene plays. In the
port the `isCutscene()` branch in the loop returns early (`sceneManager.ts:60` — "gameComplete" is a
cutscene state), so `game.entities[].send("update")` is NOT called while the cutscene runs. The
entities are stale but not actively ticking. However `inGameCut` logic (`isInGameCutscene`) is not
asserted here, so the game-complete cutscene state is correctly guarded. The missing `finishGame()` is
cosmetically present (entities linger) but does not cause active simulation during the cutscene.
After `cutSceneFinished("complete")` routes to `screen = "victory"`, entities are abandoned without
explicit teardown. On next `freshGame()` (if the player returns to title and starts again) they are
re-created from scratch, so no state leaks across new runs. The gap is real (no explicit finishGame)
but the player does NOT see active enemies during the credits because the `isCutscene()` guard stops
entity updates.

**5 DRAW-ORDER** — Victory screen uses `screens.renderCredits(renderer)` early-return; no overlap
issue.

**6 MISSING TEST** — No test for complete cutscene → credits → title pathway.

---

### `gameMaster.on escapePressed` (line 63–69)

**1 TRANSLATION** — `sceneManager.ts:180–185`. Original: `pauseGame()` then `screenOn(#ingameMenu)`.
Port: set `overlay = "ingameMenu"` and call `actions.pause()`. Correct.

**2 ACTIVATION** — `main.ts:313` (`input.pressed("escape")` when `s === "game"` and not paused) and
`main.ts:320` (re-pressing escape while the ingame menu is up calls `scene.escapePressed()` again).
The second call to `escapePressed()` while already in `ingameMenu` overlay goes to the `closeOverlay()`
branch (`sceneManager.ts:183`), which resumes the game — this correctly mirrors the original's toggle
(re-pressing Esc was handled by the menu's #back option or by the button callback, not double-escape,
but the net effect is resume).

**3 GLOBAL/INITIAL STATE** — No globals involved beyond `overlay` state. Correct.

**4 PLAYER-POV** — **GAP-3 (REAL):** In `gameMaster.menuOptionSelected` at lines 176–177, the
in-game menu calls `g.screenMaster.screenOff(#ingameMenu)` FIRST, then routes the option. This
means the menu visually clears before the next screen appears. In the port (`main.ts:311–318`), the
pause-menu handler does NOT call `scene.screenOn("ingameMenu")` again after sub-screens close; instead,
returning `true` from `screens.handleInput(ov, input)` calls `scene.screenOn("ingameMenu")` (line 315)
to re-open the menu. This routes back to the ingame menu on overlay close — **correct**. HOWEVER, for
`#back` from the in-game menu itself, the original calls `g.screenMaster.backAScreen()` which pops to
`pBackToScreen`. The port's `backAScreen()` is `sceneManager.ts:192` — it only sets `overlay = null`
(no resume). The ingame menu has no "Back" item; the closest is "Resume" which correctly calls
`scene.closeOverlay()` (which calls `actions.resume()`). No live bug here; the #back path for
instructions/showArmy works via `screens.handleInput returning true → screenOn("ingameMenu")`.

**5 DRAW-ORDER** — Pause menu `pauseMenu.render(renderer, viewW, viewH)` is drawn last (main.ts:413),
over all game content. The overlay check (`scene.currentOverlay() === "ingameMenu"`) gates this. Correct.

**6 MISSING TEST** — Escape toggle (pause → menu open → escape again → resume) not in observable test.

---

### `gameMaster.on menuOptionSelected: #saveGame` (lines 200–202)

**1 TRANSLATION** — Original: `saveMaster.saveGame()` then `gameMaster.resumeGame()`. Port
(`main.ts:265`): `doSave()` then `flash("game saved")` then `scene.closeOverlay()`. `closeOverlay()`
calls `actions.resume()` → correct.

**2 ACTIVATION** — Pause menu "Save game" item, action fires on space/enter. Correct path.

**3 GLOBAL/INITIAL STATE** — `isMenuItemShadowed` for `#saveGame` checks `cutSceneMaster.isScriptBeingPerformed()` in the original (gameMaster.txt:153). Port uses `shadowed: () => scene.isCutscene()` (main.ts:265).
`isCutscene()` in `sceneManager.ts:60` returns true only for `intro|gameOver|gameComplete` SCREENS.
When an **in-game cutscene** (chatter stones, `isInGameCutscene()`) is playing, `scene.isCutscene()` is `false` because the base screen is still `"game"`. **GAP-4 (REAL):** During an in-game chatter cutscene, `scene.isPaused()` returns true (sceneManager.ts:65 — `isPaused()` checks `this.inGameCut !== null`), so the pause menu IS accessible. But `isCutscene()` is false, so the Save item is NOT shadowed. The original shadows save whenever `cutSceneMaster.isScriptBeingPerformed()` — which includes in-game scripts. In the port, a player can open the escape menu during an in-game cutscene (via whatever escape path reaches the menu — though normally `isInGameCutscene()` swallows input in the `scene.isInGameCutscene()` branch at main.ts:303–309, before the escape check at 320). Re-checking: while `isInGameCutscene()`, the loop hits line 303–309 and returns early (`input.endTick(); return`). The escape key cannot reach line 320 while an in-game cutscene is running. So the pause menu is not accessible during in-game cutscenes in practice. The shadowing discrepancy is therefore unreachable in the current input flow. **Downgraded to theoretical/unreachable gap.**

**4 PLAYER-POV** — Save → flash message "game saved" → menu closes → game resumes. Correct.

**5 DRAW-ORDER** — N/A (save is invisible).

**6 MISSING TEST** — Save round-trip during a live game session not verified by an observable test.

---

### `gameMaster.on menuOptionSelected: #loadGame` (lines 189–190)

**1 TRANSLATION** — Original: `saveMaster.loadGame()`. Port (`main.ts:266`): `doLoad()` with flash.
The original's `loadGame` does NOT call `resumeGame()` after — the load goes through `movieMaster.goScreen(#gameScreen, #loadGame)` which reloads the whole screen. The port's `doLoad()` just restores state in place and then `scene.closeOverlay()` resumes the overlay-cleared game. Functionally equivalent (the player is back playing), but the original goes through a full screen transition.

**2 ACTIVATION** — "Load game" menu item. Correct path.

**3 GLOBAL/INITIAL STATE** — **GAP-5 (REAL):** The original `saveMaster.isMenuItemShadowed(#loadGame)` (saveMaster.txt:56–68) returns `true` (shadows the item) when `isLoadAvailable()` is false — i.e., no valid save exists. The port's "Load game" menu item (main.ts:266) has NO `shadowed` predicate at all. A player with no save can click "Load game" and get no feedback (doLoad returns false, flash("game loaded") does NOT fire because `if (doLoad()) flash(...)` gates it). The item is selectable but silently does nothing. The original prevents selection entirely by shadowing. **Real but low-severity player-visible gap** (confusing UX; not a simulation bug).

**4 PLAYER-POV** — If no save exists: original shows "Load game" greyed/unselectable. Port shows it
selectable but clicking does nothing (no flash, no close). Player-visible discrepancy.

**5 DRAW-ORDER** — N/A.

**6 MISSING TEST** — Load-game-when-no-save edge case not tested.

---

### `gameMaster.on menuOptionSelected: #resumeGame` (lines 197–198)

**1 TRANSLATION** — Port: "Resume" → `scene.closeOverlay()` which calls `actions.resume()`. Correct.

**2-6** — CLEAN.

---

### `gameMaster.on menuOptionSelected: #quitToTitle` (line 195)

**1 TRANSLATION** — Original: `quitToTitle()` → `finishGame()` + `goScreen(#titleScreen)`. Port:
`scene.toTitle()` (main.ts:270, pause menu "Return to title"). `toTitle()` in sceneManager.ts:195–198
sets `screen = "title"`, clears overlay/cutscene, and calls `onTitle()` (plays title music). No
`finishGame()` equivalent. Same class as GAP-1/GAP-2: entities are not torn down on quit.

**4 PLAYER-POV** — From player perspective: game stops (loop goes to title branch → no entity
updates), music changes, title renders. No visible ghost entities. On next `freshGame()` the entity
list is rebuilt. No player-visible bug, but a resource hygiene issue (entities not finalized).

**2-6** — Not a live player-visible flow bug. Resources are rebuilt on next game. Downgraded to
hygiene/non-critical.

---

### `gameMaster.on goNavMode` / `on leaveNavMode` (lines 134–137, 168–171)

**1-6** — Verified clean in prior audit. `rooms.ts:setExits()` covers both; `game.navMode` flag
drives the 3× speed and chatter gate. No new findings.

---

### `gameMaster.on teamDied` (lines 304–332)

**1-6** — Verified clean in prior audit. `rooms.ts:markCleared()` covers the exact two-trigger win
condition (end room OR all rooms cleared). No new findings.

---

### `saveMaster.on saveGame` (lines 71–101)

**1 TRANSLATION** — Port: `doSave()` in main.ts:150–157 calls `buildSave(...)` then `saveGame(blob)`.
Original saves: `currentMap`, `g_potionMaster`, `g_soundMaster`, `g_armyMaster`.
Port saves: map, currentRoom, clearedRooms, pState (per-room actors), player chain, potions, army.
`g_soundMaster` is NOT saved in the port. Original `saveMaster.saveGame` persists `g.soundMaster.addSaveData(sd[#g_soundMaster])` (saveMaster.txt:89–91) and restores it on load (saveMaster.txt:50 `g.soundMaster.restoreFromSave`).

**GAP-6 (REAL):** Sound master state (muted/unmuted, volume settings) is saved and restored in the
original but NOT in the port. Specifically, `soundMaster.addSaveData` / `restoreFromSave` is absent
from the port's save system entirely. After a load in the port, sound settings are reset to defaults.
Player-visible if the player muted sound before saving, then loads — sound will be un-muted. Severity:
low (the mute toggle "M" is always available), but it is a documented parity gap.

**2 ACTIVATION** — Pause menu "Save game" → `doSave()`. Correct.

**3 GLOBAL/INITIAL STATE** — `gGameSaveFile = "mr4_saveGame_0_03.txt"` in original (stored via
`setPref`). Port uses `localStorage` key `"mr_save_v3"`. Save version: original uses `pSaveVersion = 12`,
port uses `SAVE_VERSION = 3`. These are independent version spaces — no cross-compatibility needed.

**4 PLAYER-POV** — Save works. Load restores map/room/player/army/potions. Sound preferences are
lost on load (GAP-6).

**5-6** — No draw-order issue. No observable test for sound-setting persistence across save/load.

---

### `saveMaster.on loadGame` (lines 38–54)

**1 TRANSLATION** — Port: `doLoad()` in main.ts:161–174. Original restores:
`currentMap.restoreFromSave`, `potionMaster.restoreFromSave`, `soundMaster.restoreFromSave`,
`armyMaster.restoreFromSave`, `characterEnergyRollOverMaster.restoreFromSave()`. Port restores:
army, potions, clearedRooms, pState (per-room actors), player chain, current room actors.
Sound restore: absent (see GAP-6). `characterEnergyRollOverMaster.restoreFromSave()` (original line 53)
has no equivalent in port — the rollover master is the health-on-hover system; its state on restore
is a cosmetic UI thing (cursor position) — not a gameplay defect.

**2 ACTIVATION** — After wasted cutscene: `cutSceneFinished("wasted")` calls `this.actions.loadGame()`
(sceneManager.ts:151). Also from pause menu. Both correct.

**3 GLOBAL/INITIAL STATE** — `gGameSaveFile` used via `getPref()` in original. Port uses `localStorage`.
Version gate (ver=12 vs SAVE_VERSION=3) is independent — no cross-compat needed.

**4 PLAYER-POV** — **GAP-7 (REAL, wasted-path only):** After the wasted cutscene, the original routes
`goScreen(#gameScreen, #loadGame)` — a full screen transition to the game screen, then loads the save.
This means the player goes through a visible screen change before seeing the restored game. The port
does `doLoad()` directly then `this.screen = "game"; this.actions.resume()` (sceneManager.ts:152–153)
— instantaneous, no screen transition. The original's `screen = #gameScreen` also fires
`gameMaster.start()` at the new game-screen enter, which calls `g.armyMaster.clearArmy()`,
`g.collisionMaster.initPlayArea()`, `g.actorMaster.start()` — initialization steps that the port omits.
The port's `doLoad()` restores world state but does not re-initialize the collision master or actor
master. In practice `rebuildCombatSubstrate()` runs at the top of each game tick, and `rooms.restoreInto`
respawns the room's actors, so the missing explicit init is covered. Not a visible simulation bug.

**5-6** — No draw-order issue. No observable test.

---

### `saveMaster.on isMenuItemShadowed` (lines 56–68)

**1 TRANSLATION** — Shadows `#loadGame` when `isLoadAvailable()` is false. Port has NO shadowing for
the Load game menu item (see GAP-5 above — already catalogued under gameMaster.menuOptionSelected).

**2-6** — Same as GAP-5.

---

### `screenMaster.on screenOn` (lines 159–168) / `on screenOff` (lines 175–185)

**1 TRANSLATION** — Port: `sceneManager.ts:188–193` (`screenOn`, `backAScreen`, `closeOverlay`). The
original uses a dictionary of screen objects that can be individually turned on/off, with
`pCurrentScreen` / `pBackToScreen` tracking. The port collapses this to a single `overlay: Overlay`
string and `backTo: Screen`.

**2 ACTIVATION** — `screenOn(#ingameMenu)` fires from `gameMaster.escapePressed` (line 67–68 of
gameMaster.txt). Port: `sceneManager.escapePressed()` sets `this.overlay = "ingameMenu"` directly.
Correct.

**3 GLOBAL/INITIAL STATE** — `pCurrentScreen` / `pBackToScreen` in original track TWO levels of screen
history (current + previous). Port's `backTo` field in SceneManager is set in `screenOn()` at
`sceneManager.ts:189` but is NEVER READ — `backAScreen()` at line 192 sets `overlay = null` without
consulting `backTo`. The `backTo` field is dead code.

**GAP-8 (REAL, low severity):** `screenMaster.backAScreen()` (screenMaster.txt:42–47) restores the
PREVIOUS screen (pBackToScreen.sym + caller). The port's `backAScreen()` (sceneManager.ts:192) just
nulls the overlay. This means the two-level history is lost. For the in-game flow: instructions or
showArmy are opened from the pause menu → user presses back → should return to the in-game menu
(`#ingameMenu`). In the port, returning from overlay is done by `screens.handleInput() returning true →
scene.screenOn("ingameMenu")` (main.ts:315) — which correctly re-opens the ingame menu. The semantic
is different (explicit re-open rather than history pop) but the player sees the same result. The `backTo`
field is simply dead (written but never read). Not a live player-visible bug.

**4 PLAYER-POV** — Back-navigation from overlay screens (instructions → ingame menu) works correctly
via the explicit re-open path.

**5 DRAW-ORDER** — `screenMaster.initScreenList` (lines 88–103) iterates frameLabels to build screen
objects. Port has no equivalent screen-object initialization — screens are statically defined as
`Screens` class members. No occlusion issue; overlays always draw last.

**6 MISSING TEST** — Overlay open/close/back navigation not in an observable test.

---

### `screenMaster.on goScreen` / `on finishTransition` / `on goScreenFinished` (lines 53–59, 219–223)

**1 TRANSLATION** — Port: `sceneManager.ts:71–82` (`goScreen`) and `sceneManager.ts:98–109`
(`tickTransition`). Original's `finishTransition` calls `ct.caller.goScreenFinished(ct.targetScreenSym)`.
`goScreenFinished` in `movieMaster` calls `goScreenAction()`. In the port this is collapsed into
`runGoScreenAction` firing at transition end. Functionally correct.

**2 ACTIVATION** — Transition fires on every `goScreen()` call with a non-zero `transitionFrames` (3
frames in main.ts:206). While transitioning, `scene.isTransitioning()` returns true and the main loop
swallows input (main.ts:287). Correct.

**GAP-9 (REAL, narrow):** The `startTransition` in screenMaster.txt:194–205 calls `sendAllScreens(#offScreen)` — it sends an `offScreen` message to ALL currently-on screens before bringing on the new one. The `continueTransition` then calls `onScreen` for the target only. The port's `goScreen` sets `this.screen = target` immediately and defers the action (sceneManager.ts:76–80). During the tween, the screen is already the target, so the fade renders OVER the target (not over the old screen). In the original, the fade covers the old screen going OFF, then the new screen coming ON. **The visual direction of the transition is inverted** — in the port the new screen is always shown (with a black fade-in), whereas the original shows the old screen (with a black fade-out) then the new. Player-visible on slow hardware but the game-flow semantics (actions fire correctly) are unaffected.

**3-6** — No state or draw-order bug beyond the cosmetic transition direction.

---

### `movieMaster.cutSceneFinished: gIntroScript` guard `gMapLoaded` (movieMaster.txt:111–115)

**1 TRANSLATION** — Original: after the intro cutscene, if `gMapLoaded` then go to `#gameScreen`; else
go to `#titleScreen`. Port: `cutSceneFinished("intro")` always goes to `goScreen("game","startGame")`
(sceneManager.ts:146).

**GAP-10 (REAL):** The `gMapLoaded` guard does not exist in the port. If the intro plays but no map
was successfully loaded, the original falls back to the title; the port always tries to start a game.
In the port `loadMap()` is called unconditionally in `main()` before the game loop starts — if it
throws, the entire `main()` rejects with a console error and the game never starts. If it succeeds,
there is always a valid map. So the `gMapLoaded=false` branch is structurally unreachable in the port
(the map is loaded before the title even renders). Not a live player-visible bug; the guard is defense
against a loading failure that the port handles differently (hard error vs silent fallback).

**2-6** — Not reachable in normal operation. Theoretical gap.

---

## SUMMARY OF GAPS

| # | Handler | Severity | Description |
|---|---------|----------|-------------|
| GAP-1 | `gameOver` | REAL / HYGIENE | `finishGame()` not called before wasted cutscene; stale entities in `game.entities` during/after |
| GAP-2 | `gameComplete` | REAL / HYGIENE | `finishGame()` not called before complete cutscene; same class as GAP-1 |
| GAP-5 | `menuOptionSelected #loadGame` / `saveMaster.isMenuItemShadowed` | REAL / UX | "Load game" item not shadowed when no save exists; selectable but silently does nothing |
| GAP-6 | `saveMaster.saveGame` / `loadGame` | REAL / LOW | Sound master state not saved or restored; mute/volume preferences reset on load |
| GAP-8 | `screenMaster.backAScreen` | REAL / DEAD CODE | `backTo` field written but never read; `backAScreen()` always nulls overlay; functionally covered by explicit re-open |
| GAP-9 | `screenMaster.startTransition` | COSMETIC | Transition direction inverted — port fades in over target; original fades out old then in new |
| GAP-3 | `escapePressed` | CLEAN | Toggle behavior correct via closeOverlay path |
| GAP-4 | `isMenuItemShadowed #saveGame` during in-game cutscene | THEORETICAL | Unreachable: in-game cutscene loop branch swallows escape before menu is accessible |
| GAP-7 | `loadGame` on wasted path | CLEAN | Instantaneous vs screen-transition reload; simulation coverage adequate |
| GAP-10 | `gMapLoaded` guard in `cutSceneFinished(intro)` | THEORETICAL | Structurally unreachable; map load failure handled by hard error in port |

### Critical (live player-visible simulation):
- **None** — no simulation-correctness bugs.

### Real (player-visible UX or resource hygiene):
- **GAP-5:** Load game item always selectable even with no save → silently does nothing (UX confusion).
- **GAP-6:** Sound settings lost on save/load round-trip.
- **GAP-1/GAP-2:** No `finishGame()` teardown before cutscenes/quit → stale entities accumulate
  (hygiene; not visible during cutscene because `isCutscene()` guards entity updates, but the array
  is not compacted until `freshGame()` on the next title→game run).

### Cosmetic:
- **GAP-9:** Transition fade direction inverted.
- **GAP-8:** `backTo` dead code in SceneManager.

---
