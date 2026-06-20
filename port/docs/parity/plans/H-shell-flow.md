# H — Shell & Game Flow (presentation, scenes, death, win)

**Phase H** of the parity port. Three backlog rows, dependency-ordered:

- **H1 — cutscene engine over real actors** (`modThespian` + `cutSceneMaster` + `objScriptPerformer` +
  `objScript`): replace the standalone presentational re-impl with a faithful engine that drives
  **REAL spawned actors** through their modules (`goMode`/walkTo/teleport/props), the full **29-verb**
  set, frame-timed lines, `#key` interpolation, and async line callbacks. This is the explicit
  **PLAN §6** contract and it GATES H2's missing game-over / game-complete / wasted flows.
- **H2 — scene FSM + menus + death/respawn/reincarnate flow**: formalize the scene state machine
  (mirroring `gameMaster`/`screenMaster`/`movieMaster`) beyond today's mode var; data-driven `objMenu`
  menus/buttons; the death → wasted → respawn / game-over player flow.
- **H3 — `#endRoom` win condition + live room-state restore on re-entry**: win on *reaching* the
  designated end room (vs clearing all rooms), and the per-room `pState` snapshot-on-leave that G1
  deferred (G used a current-room-only snapshot; H3 is full per-room persistence).

> Read alongside: [`../05-world-render-shell.md`](../05-world-render-shell.md) §4/§6/§7 (the shell audit
> and the three prioritized targets), [`G-save-progression.md`](G-save-progression.md) (whose Option-A
> current-room snapshot H3 supersedes), and [`../README.md`](../README.md) Phase H rows.

---

## (a) Original mechanics — grounded in cited handlers

### A1.1 The cutscene call graph (who drives whom)

The original cutscene engine is **four cooperating objects**, NOT a self-contained player:

```
cutSceneMaster.playCutScene(sceneSym)              -- casts/master_objects/cutSceneMaster.txt:311
  → acquireSprites (background + title), calcEnvironment (#cutScene vs #ingame :220)
  → objScriptPerformer.init + startPerformance      -- objScriptPerformer.txt:376
        acquirePlayers  → objectMaster.getPlayers(script.getPlayers())   :53
        createMissingPlayers → actorMaster.newActor(typ=objCharacter, startLoc=wings)  :77
              ** the players ARE real actors, spawned via the normal actor factory **
        introduceMeToPlayers → each actor.setScriptPerformer / setSpeechDisplayMode   :195
        putPlayersIntoCharacter → each actor.goThespianMode()    :323  (mounts modThespian's text member, AI→thespian)
        performNextLine()
  loop:
    objScript.getNextLine() → #finished | scriptLine                 -- objScript.txt:71
    makeLinePackage (computes displayTime = basicTimePerLine + chars·timePerLetter)  :243
    translateObjCharacterToObj → the actor object, OR cutSceneMaster for non-character verbs  :387
    linePackage.obj.performLine(linePackage)
       • actor verb → modThespian.performLine (drives me.ID.bigMe — the real character)  modThespian.txt:395
       • global verb → cutSceneMaster.performLine → call(cmd, me, args)                cutSceneMaster.txt:307
    when the line is done, the performer is called back → lineFinished() → performNextLine()  :120
  on #finished → scriptFinished → putCreatedPlayersIntoWings, putPlayersOutOfCharacter,
                 finishPlayersInWings, pCaller.scriptFinished()                          :364
cutSceneMaster.scriptFinished → movieMaster.cutSceneFinished(scene)                       cutSceneMaster.txt:334
```

**The load-bearing fact:** a cutscene "character" is a **real `actorMaster.newActor`** (the same
factory the gameplay uses). `modThespian.walkTo` calls `me.ID.bigMe.moveToLoc(loc)`; `goMode` calls
`me.big.goMode(sym)`; `teleportInAt` calls the real `teleportInAt`. The actors **animate themselves
through their own modules** (walk anim, fall, teleport, prop-carry). The engine just sequences verbs
and waits for each to finish. This is exactly what the port's draw-frames re-impl does NOT do.

### A1.2 Line lifecycle — sync verbs vs async (speak / fade)

Two completion models, both routed through the performer's `lineFinished` → `performNextLine` chain:

- **Immediate verbs** (`at`, `walkTo`, `goMode`, `teleportInAt`, `enterStageLeft`…): `performLine`
  runs the action then calls `me.lineFinished()` **synchronously** (modThespian.txt:395-486). The next
  line begins the same frame. (Even `walkTo` returns immediately — the actor keeps walking under its
  own `moveToLoc`; the *script* does not block on arrival. Blocking-until-arrival is only needed for
  `exitStage*`/`gotoWings`, handled via `pExitingStage` + `moveToLocFinished` → `gotoWings`, NOT via
  the line chain. :388)
- **Async / timed verbs**:
  - **`speakLine`** — `goThespMode(#displayLine)` sets `pFrameCounter.tim[2] = displayTime`; the
    actor's `update` ticks the counter; on expiry → `#delayAfterLine` (delayTime) → `lineFinished`.
    The performer is NOT called back until the text has been shown for `displayTime` + `delayTime`
    frames. (modThespian.txt:308-323, 602-628). Speech also clears via `displaySpeech("")`.
  - **`wait N`** — `cutSceneMaster.wait` → `startWaitTimer(N)` → an `objTimer` calls back
    `waitTimerFinished` → `pScriptPerformer.lineFinished()` N frames later. (cutSceneMaster.txt:386-394)
  - **`fadeDown`/lights** — `lightsChange` calls each player's fader and counts `pWaitingForPlayers`;
    each `playerFaderFin` decrements; when 0 → `lineFinished` (objScriptPerformer.txt:211-292,
    modThespian.faderFin:282). I.e. the line completes only when **all** actors finish fading.
  - **`backgroundColourTo`** is fire-and-forget: `cutSceneMaster.backgroundColourTo` starts a colour
    transform then calls `lineFinished` immediately (the transform tweens in the background).

### A1.3 `#key` interpolation + speech display modes

`interpretSpeechVariables` (modThespian.txt:353) scans the line's words right-to-left; on the token
`#key` it replaces `#key <controlName>` with the live bound key from `g.keyMaster.getKeyFor(...)`,
re-evaluated **at display time** (so rebinding keys updates already-authored lines). Speech renders in
one of two modes (`pSpeechDisplayMode`): `#cutscene` (a caption near the top of the stage,
`displaySpeechCutScene`) or `#ingame` (a bubble above the speaker's head, with a blended background
rect, `displaySpeechInGame`). The performer picks the mode from `cutSceneMaster.getSpeechDisplayMode`
(= `pEnvironment`: `#cutScene` if a background sprite exists, else `#ingame`).

### A1.4 The FULL verb set (29 verbs in use)

Enumerated from `objScript.interpretLineArgs` (the parser, objScript.txt:152) + `modThespian.performLine`
(actor verbs) + `cutSceneMaster.performLine` (global verbs), cross-checked against an exhaustive grep of
`casts/data/scr_*.txt` + `cut_scenes/*.txt`. **Usage counts** are occurrences across all shipped scripts.

| # | Verb | Target | Drives (real-actor effect) | Sync? | Args (parsed by objScript) | Uses |
|---|------|--------|----------------------------|-------|----------------------------|-----:|
| 1 | `wait` | global | `cutSceneMaster.startWaitTimer(N)` → objTimer | **async** N frames | `value(w2..)` (frame count) | 97 |
| 2 | `backgroundColourTo` | global | `pBackground.colourTransform(target, speed 2)` | sync (tween in bg) | `value(w2..)` rgb | 73 |
| 3 | `at` | actor | `me.setLoc(interpretLoc(x))` (teleport, no walk) | sync | `value(w3..)` x or point | 71 |
| 4 | `turnToFace` | actor | `setSpriteFlipFromDir(dirTo(otherActor))` | sync | other character name | 55 |
| 5 | `walkTo` | actor | `me.ID.bigMe.moveToLoc(loc)` → **walk anim** | sync (walks on) | `value(w3..)` x or point | 49 |
| 6 | `setStage` | global | `putPlayersIntoWings`+`makePlayersInvisible`+`backgroundColour(setColour)` | sync | — | 29 |
| 7 | `lightsUp` | global | `lightsChange(#up)` → each actor `startSlowFadeIn` | **async** (all faders) | — | 29 |
| 8 | `lightsDown` | global | `lightsChange(#down)` → each actor `startSlowFadeOut` | **async** (all faders) | — | 29 |
| 9 | `showTitle` | global | `pTitle.showTitle(text)` | sync | `w2..` (raw text) | 25 |
| 10 | `teleportOut` | actor | `me.ID.bigMe.teleportOut(#modThespian, floor)` → **teleport anim**; on fin → `gotoWings` | sync (anim runs) | — | 24 |
| 11 | `teleportInAt` | actor | `me.ID.bigMe.teleportInAt(interpretLoc(x))` → **teleport-in anim** | sync | `value(w3..)` x or point | 18 |
| 12 | `produceProp` | actor | `bigMe.carryProp(otherActorObj)` + `propObj.beProducedAsProp` | sync | other character name | 18 |
| 13 | `propAt` | actor | `setPropStatus(#prop)` + `at(loc)` | sync | `value(w3..)` x or point | 16 |
| 14 | `exitStageRight` | actor | `walkTo(calcStageRightOffLoc())`, `pExitingStage=true` → `gotoWings` on arrival | sync (walks off) | — | 15 |
| 15 | `putAwayProp` | actor | `me.big.putAwayProp()` | sync | — | 8 |
| 16 | `dropProp` | actor | `me.big.dropProp()` | sync | — | 8 |
| 17 | `goMode` | actor | `me.big.goMode(sym)` (e.g. `#stand`, `#look`) | sync | `value(w3)` symbol | 7 |
| 18 | `exitStageLeft` | actor | `walkTo(calcStageLeftOffLoc())`, exit → `gotoWings` | sync (walks off) | — | 6 |
| 19 | `enterStageRight` | actor | `at(offRight)` then `walkTo(stageRightOnLoc)` → **walks on** | sync | — | 6 |
| 20 | `gotoWings` | actor | `pScriptPerformer.actorToWings(actorID)` (snap offscreen) | sync | — | 5 |
| 21 | `enterStageLeft` | actor | `at(offLeft)` then `walkTo(stageLeftOnLoc)` | sync | — | 4 |
| 22 | `walkScrollRight` | global | `putPlayersIntoWalkMode(#right)` (continuous scroll-walk) | sync | dir/speed/chars | 4 |
| 23 | `goWastedMode` | actor | `me.ID.bigMe.wastedModeOn()` (blend 30, squash h=60) + `reAlignToStageFloor` | sync | — | 3 |
| 24 | `walkScrollStop` | global | `putPlayersIntoWalkMode(#stop)` | sync | — | 3 |
| 25 | `walkToPlayer` | actor | `walkTo(otherActor.getLoc().locH)` | sync | other character name | 2 |
| 26 | `playSound` | global | `soundMaster.playSound(member, volume)` | sync | member + volume(255) | 2 |
| 27 | `fadeDown` | actor | `me.big.startSlowFadeOut()` | sync (or via faderFin) | — | 2 |
| 28 | `atPlayer` | actor | `at(otherActor.getLoc().locH)` | sync | other character name | 2 |
| 29 | `walkScrollLeft` | global | `putPlayersIntoWalkMode(#left)` | sync | dir/speed/chars | 1 |
| 30 | `playMusic` | global | `soundMaster.playMusic(member, volume)` | sync | member + volume(255) | 1 |
| 31 | `backgroundColourRandomFlash` | global | `goMode(#bgRandomFlash)` + loop random colour tweens | sync (loops in bg) | `value(w2)` speed | 1 |

Plus the implicit **`speakLine`** verb (#32): any line whose first word ends in `:` is dialogue
(`objScript.interpretLineCommand:248`) — the most common "verb" of all, async on `displayTime`.

> So the faithful target is **~31 verbs + speakLine** (vs the port's ~10). Verbs the port lacks
> entirely: walkTo-as-real-walk, goMode, all prop verbs, goWastedMode, walkScroll*, gotoWings,
> fadeDown, atPlayer/walkToPlayer, playMusic/playSound (from the script), backgroundColourTo-as-tween,
> backgroundColourRandomFlash, and `#key` interpolation.

### A2 Scene FSM (gameMaster / screenMaster / movieMaster)

- **`movieMaster`** is the screen router. `start` → `goScreen(#titleScreen)` (movieMaster.txt:25).
  `menuOptionSelected(#startGame)` → `goScreen(#animScreenSingleCutScene, #playLoadedCutScene)` →
  `goScreenFinished` → `goScreenAction` → `cutSceneMaster.playCutScene(gIntroScript)` (:205-236, 140).
  `cutSceneFinished(scene)` dispatches by *which* script finished (:108):
  - `gIntroScript` → `#gameScreen` (if a map loaded) else `#titleScreen`.
  - `gGameCompleteScript` → `#creditsScreen`.
  - `gGameOverScript` → `#gameScreen` with action `#loadGame` (reload the last save!).
  `gameComplete` → `goScreen(#animScreenEnd, #gameComplete)` → plays `gGameCompleteScript` (:126,145).
- **`screenMaster`** runs the actual transitions: `goScreen(params)` → `startTransition` → all screens
  `offScreen` (flick/fade), then the target `onScreen`, then `finishTransition` →
  `caller.goScreenFinished(targetSym)` (screenMaster.txt:53,194-223). `screenOn`/`screenOff` overlay a
  screen without replacing (used for the in-game menu, instructions, showArmy); `backAScreen` pops to
  `pBackToScreen` (:42). 16 Score markers = 16 screen syms (per `extracted/engine/scenes.json`).
- **`gameMaster`** owns in-game flow:
  - `escapePressed` → `pauseGame` + `screenOn(#ingameMenu)` (:63).
  - `menuOptionSelected` dispatches `#resumeGame`/`#saveGame`/`#loadGame`/`#quitToTitle`/`#showArmy`/
    `#instructions`/`#chooseKeys`/`#soundOn|Off` (:173). `isMenuItemShadowed(#saveGame)` greys out save
    while a cutscene plays (:150).
  - `gameOver` (:102): if `gGameOverScript = #none` → `quitToTitle`; else `finishGame` +
    `movieMaster.goScreen(#animScreenGameOver, #gameOver)` (which plays the wasted cutscene then
    reloads the save).
  - `teamDied(team)` (:304): the **win pathway** (see A3). `gameEvent(#mapClear)` → `gameComplete`.

### A3 `#endRoom` win condition + per-room state (H3)

- **End-room win** — `teamDied` (gameMaster.txt:304) is fired when a team is wiped. It calls
  `currentRoom.attemptOpenExits()`; if the exits opened (room cleared) it asks
  `currentMap.isEndRoom()` (objMap.txt:499 — `pCurrentRoomLoc = pEndRoom`) and if so fires
  `gameEvent(#mapClear)` → `gameComplete`. **Separately**, `attemptOpenExits` →
  `pMap.checkMapCleared` → `isMapClear` (ALL rooms `isCleared`) → also `gameEvent(#mapClear)`
  (objRoom.txt:218, objMap.txt:248,510). So **there are two independent win triggers**: *reach &
  clear the designated end room*, OR *clear every room*. `pEndRoom` is parsed from the map's
  `#endRoom` key (objMap.txt:79); when it is `#none`, `isEndRoom` can never be true and only the
  clear-all path wins.
- **Per-room freeze/restore (`pState`)** — on room exit `objRoom.deactivate` → `freezeObjects` →
  `saveState(roomObjects)`: each object that returns `getRecordInRoomState = true`
  (objGameObject.txt:506) is recorded as `{loc, actorType, saveData(full chain)}` into `pState`
  (objRoom.txt:723); then the live actors are finished. On re-entry `objRoom.activate` → (if not the
  save-game active room) `restoreState`: re-spawn each `pState` entry via `actorMaster.newActor`,
  `restoreFromSave(saveData)`, `frameAdvance`, then `restoreRelationships` (objRoom.txt:655). So a
  room you walked out of mid-fight comes back **exactly as you left it** — same enemies, same HP, same
  positions — not re-spawned fresh. Graves persist via `reDrawGraves`.

### A4 Death / wasted / respawn flow

`objPlayerMerlinCharacter.takeHit` → on `checkDead` → `goMode(#die)` + `recordRespawnPoint`
(objPlayerMerlinCharacter.txt:228; the non-Merlin `objPlayerCharacter` is the same shape :154). The
die animation runs (`stretchDeath`/`updateDie`); on finish (`stretchDeathFin` :218 /
`objPlayerCharacter.update #die` :180):

```
if modExtraLives installed: gameOver = attemptRespawn()   -- modExtraLives.txt:59
       pExtraLives>0 → bigMe.respawn() (setLoc(respawnPoint), restoreEnergy, lives--), gameOver=false
       else gameOver=true
else gameOver=true
if gameOver then g.gameMaster.gameOver()   -- → animScreenGameOver → playCutScene(gGameOverScript) → reload save
```

The **wasted cutscene** (`scr_cut_scene_to_play_when_wasted`, the shipped `gGameOverScript`) is a
normal cutscene: `setStage`, `showTitle "You Got Wasted!"`, `backgroundColourTo rgb(100,100,255)`,
`lightsUp`, `wait`, `m goWastedMode`, `m enterStageRight`, `m exitStageLeft`, `m: We must try again!`,
fade out. It DRIVES the real Merlin actor in wasted mode — so it cannot be authored until H1 exists.
After it finishes, `movieMaster.cutSceneFinished(gGameOverScript)` → `#gameScreen` + `#loadGame`
(reload the last save). "Respawn" (extra lives, in-place) and "wasted→reload" are two distinct paths.

---

## (b) Gap vs the port today

| Concern | Port today | Faithful target |
|---|---|---|
| Cutscene engine | `scenes/cutscenePlayer.ts`: a **standalone presentational re-impl** — draws each char's `stand` frame at a fixed ground line, advances dialogue **on space**, ~10 verbs (at/enter/exit/teleport/turnToFace/bgColour/lights/showTitle/wait), no real actor, no movement | A `Thespian` engine driving **real spawned entities** through `goMode`/`Movement.moveToLoc`/teleport/anim; 31 verbs + speakLine; frame-timed auto-advance; `#key`; async line callbacks |
| Cutscene cast | `SYM_CHAR` 4-entry hardcode (mer/uli/ber/tv), single `stand` frame | `actorMaster.newActor`-equivalent: spawn the real archetype by its `objCharacter` symbol, in the wings, finish on scene end |
| Verb parser | `data/cutscene.ts`: subset; splits on whitespace, no `value()` of point/rgb args, no second-word-command vs global distinction beyond a chars table | Faithful `interpretLineArgs` per-verb arg parsing (point/rgb/symbol/raw-text/sound-args); `interpretLineCommand` (`:` = speakLine; word2 if word1 is a character; else word1) |
| Scene FSM | `main.ts` **mode var**: `title→cutscene→playing↔paused→gameover/victory` (6 states); menus are JS closures hand-authored in `main.ts` | A `SceneManager` mirroring movieMaster/screenMaster: screen syms + a `goScreen(sym, action)` + `cutSceneFinished(scene)` dispatch + overlay screens (ingame menu / showArmy / instructions) |
| Menus | `scenes/menu.ts`: clean keyboard list (↑/↓/confirm), opaque overlay; content authored in code | `objMenu` data-driven: items from menu definitions, shadowed/disabled items (`isMenuItemShadowed`), dividers, title image (art fidelity is lower-priority; data-drive + shadow is the parity bit) |
| Death flow | `main.ts`: `player.send("isDead")` → `mode="gameover"` overlay → SPACE restarts via `startGame()` (fresh run) | `takeHit`→`#die`→`attemptRespawn` (extra lives in-place) **or** `gameOver`→wasted cutscene→**reload save** (not a fresh run) |
| Win condition | `RoomManager`: `cleared.size >= rooms.size` (clear-ALL only). **`#endRoom` ignored** | Two triggers: clear-all **OR** reach+clear the `#endRoom` (`isEndRoom`) |
| Per-room state | G1 Option-A: only the **current** room's actors snapshot into the save; cleared-set for the rest. Walking back into a previously-visited, half-fought room **re-spawns it fresh** | Per-room `pState`: snapshot-on-leave for **every** visited room; re-entry restores exact actor positions/HP/relationships (H3 supersedes G's current-room-only snapshot) |
| Game-complete | victory overlay text ("THE DUNGEON IS CLEARED"), SPACE → title | `animScreenEnd` → `gGameCompleteScript` cutscene → credits (credits screen itself out-of-scope) |

---

## (c) Concrete design

### H1 — `Thespian` cutscene engine over real entities

New module `scenes/thespian.ts` + a rewrite of `scenes/cutscenePlayer.ts` into a thin host. Keep the
existing parser shape but extend it (`data/cutscene.ts`) to faithful per-verb arg parsing.

**Spawn real actors.** Reuse the existing spawn substrate. `spawnFromSymbol(sym,x,y)` (already factored
in `entities/actorSerial.ts` / `rooms.ts`) maps an actor-type symbol to a live entity. A cutscene's
`characters` block lists `#merlin - m` (objCharacter + scriptName); the engine spawns each via
`spawnFromSymbol` at the **wings** loc (offscreen, e.g. `(-100,-100)`), exactly like
`createMissingPlayers` (objScriptPerformer.txt:77). The entity carries its real `Movement`, `Anim`,
`Energy`, etc. — it animates itself. On scene end, finish (remove) any actor created for the scene.

> **Reuse, not a parallel cast.** The cutscene actor is the SAME `Entity` the gameplay spawns. `walkTo`
> = the actor's real `Movement.moveToLoc` (drive an existing move-to-loc behavior or add a minimal one),
> which the existing `Anim.pickAction` already renders as `walk` while `vx/vy ≠ 0` and `stand` at rest.
> `goMode #stand`/`#look` set the anim override the port already supports (`animAction`). This means a
> cutscene actor walks, faces, and idles using the gameplay renderer — no bespoke draw path.

**The verb dispatch** mirrors the four-object graph, collapsed into one `Thespian` runner (the port has
no objectMaster/structMaster, so flatten performer+master+thespian into one class with the same phases):

```ts
class Thespian {
  // phases: spawn cast → run lines → finish cast
  cast: Map<objChar, Entity>        // spawnFromSymbol, at wings
  lineIdx: number
  pending: null | { kind:'frames', left:number }   // wait / speakLine display+delay / fader count
  // per-tick:
  tick(): done {
    if (pending) { advance the timer/fader; if not finished return; pending=null; }
    while (lineIdx < lines.length) {
      const ln = lines[lineIdx++]; performLine(ln);
      if (ln set pending) return false;   // async verb (wait/speak/lights/fade) blocks the chain
    }
    return true;  // #finished → finish cast, signal caller
  }
}
```

- **Sync verbs** run their effect and fall through to the next line same tick (matches
  `performLine`+`lineFinished` synchronous chain). `at`/`teleportInAt`/`walkTo`/`turnToFace`/`goMode`/
  `propAt`/`enterStage*`/`exitStage*`/`gotoWings`/prop verbs/`showTitle`/`backgroundColourTo`/
  `playSound`/`playMusic`/`setStage`/`walkScroll*`.
- **Async verbs** set `pending`:
  - `speakLine` → `displayTime = basicTimePerLine(50) + chars·timePerLetter(1.4)` then `delayTime(12)`
    (objScriptPerformer.txt:65,243), ticked down at 30Hz; speech auto-advances (NO space press). A
    **skip** path: pressing space/esc cancels the whole scene (`scriptCancelled`) — matches
    `pSkipCounter`/`AIisTryingToMove` (modThespian.txt:132) loosely (the port can keep "esc skips").
  - `wait N` → N frames.
  - `lightsUp`/`lightsDown`/`fadeDown` → start each actor fading; complete when all faders done
    (count, like `pWaitingForPlayers`). A simpler faithful model: a fixed fade duration shared by all
    actors → pending frames = fadeDuration.
- **`#key` interpolation** — `interpretSpeechVariables` ported: at display time, replace `#key <ctrl>`
  with the live bound key from the input scheme (the port's `Input.setScheme` knows the bindings;
  expose a `keyForControl(name)` lookup). Re-evaluated each display, not at parse.
- **`exitStage*`/`gotoWings` arrival** — these need "walk off then snap to wings". Port: the verb starts
  a `moveToLoc` to the off-stage x with an `onArrive` callback that snaps the actor to wings
  (mirrors `pExitingStage`+`moveToLocFinished`→`gotoWings`). This does NOT block the line chain in the
  original either (it's actor-internal), so the engine fires it and moves on.

**Stage geometry** — keep the port's cutscene stage rect (the canvas view) with a `stageFloor`
(bottom − 16) and `stageLeft/Right` = view edges, reproducing `cutSceneMaster.getStageFloor/Left/Right`.
`interpretLoc(x)` → `point(x, floor)` for a bare number; a `point(x,y)` passes through.

### H2 — Scene FSM + menus + death flow

**`SceneManager`** (`scenes/sceneManager.ts`) replaces the `mode` var with an explicit machine modeled
on movieMaster + screenMaster (collapsed — no Score markers in the port):

```
screens: title | controls | intro(cutscene) | game | ingameMenu(overlay) |
         gameOver(cutscene) | gameComplete(cutscene) | victory | showArmy(overlay)
goScreen(sym, action?)  → run transition (instant for now; #fade is F3 cosmetic) → onScreenFinished → runAction
runAction(action):
   #startGame        → play intro cutscene (Thespian)
   #gameOver         → play gGameOverScript (wasted) cutscene
   #gameComplete     → play gGameCompleteScript cutscene
   #loadGame         → doLoad()  (reload save, as movieMaster does after game-over)
cutSceneFinished(scene): intro→game; gameOver→game+#loadGame; gameComplete→victory/credits
```

Pause/menu: `escapePressed` → pause + overlay `ingameMenu` (a data-driven `objMenu`); items dispatch
resume/save/load/quit/showArmy/controls. `isMenuItemShadowed` greys **Save** while a cutscene plays
(port: simple guard). The existing `Menu` becomes the renderer; menu **content** loads from a small data
table (the parity bit is data-drive + shadowing, not bitmap art).

**Death flow** — `objPlayerMerlinCharacter.takeHit`→die path:
- Add an `ExtraLives` component (`modExtraLives`): `attemptRespawn()` — if lives>0, `respawn()` in place
  (`setLoc(respawnPoint)`, `restoreEnergy`, lives--), continue playing; else → `gameOver`.
  `recordRespawnPoint` captures the loc on entering `#die`. (Slice ships 0 extra lives by default, so
  the common path is straight to game-over — matching the shipped config.)
- On `gameOver`: instead of today's "fresh restart on SPACE", play the **wasted cutscene** (real Merlin
  in wasted mode), then `#loadGame` (reload the last save). This is the behavioral change H2 owes — and
  it is why H1 gates H2 (the wasted cutscene needs the real-actor engine + `goWastedMode`). Provide a
  fallback to `quitToTitle` when no save exists / no wasted script (`gGameOverScript = #none`).
- Add `goWastedMode` to the player entity (`modWastedMode`: blend 30, squash height) so the cutscene
  verb has a real effect.

### H3 — `#endRoom` win + per-room `pState` restore

**Win condition.** Parse `#endRoom` from the map (`map.ts`: already reads `roomSize`/`mapSize`; add
`endRoom?: Vec2i` from the `#endRoom` key, `#none`→undefined). In `RoomManager.markCleared`/`update`,
after a room's exits open, branch:
- if `map.endRoom` is set **and** the current room loc equals it → fire `onMapClear` (win) — the
  `teamDied`→`isEndRoom` path.
- else keep the existing clear-all trigger (`cleared.size >= rooms.size`) — the `checkMapCleared` path.
Both call the same `onMapClear`. (A map with `#endRoom:#none`, like the default
`descent_into_darkness`, wins only on clear-all — unchanged. A map with a real end room, like
`merliniii`/`mriiilongii`, wins on reaching+clearing it.)

**Per-room `pState`.** Today `RoomManager` keeps only a `cleared:Set<num>`. H3 adds a
`pState: Map<roomNum, ActorSave[]>` (the port already has `serializeActor`/`respawnActor` from G1 — the
exact tool `restoreState` needs). On `enter()` leaving a room (before teardown), snapshot the leaving
room's recordable actors into `pState[oldNum]` (mirrors `freezeObjects`→`saveState`). On entering a
room that has a `pState` entry, **restore from it** instead of tile-spawning fresh
(mirrors `restoreState`: respawn + `restoreFromSave` + the deferred `restoreTarget` relationship pass
the port already runs for the current room). A cleared room with no live actors snapshots an empty list
(stays cleared/empty). Graves are out-of-scope (no grave system yet).

**How H3 supersedes G's Option-A.** G1 snapshots only the *current* room into the save and persists a
cleared-set for the rest; re-entering a non-current visited room re-spawns it fresh. H3's `pState` is
the general per-room memory: (1) it makes mid-fight re-entry faithful at runtime, and (2) the save tree
should now serialize the whole `pState` map (not just the current room), so a load restores every
room's exact state — extend `buildSave`/`restoreInto` to cascade `pState`. This closes G1's
"per-room `pState` for non-current rooms is H3" deferral noted in the README and G plan. The current-room
snapshot becomes just "the current room's slot in `pState`."

---

## (d) Step-by-step order (substrate-first)

1. **Parser fidelity (H1 substrate).** Extend `data/cutscene.ts` to the faithful `interpretLineCommand`
   + per-verb `interpretLineArgs` (point/rgb/symbol/text/sound-args; `:`→speakLine; word2-command).
   Pure; unit-test against shipped scripts (intro + wasted + a stones script). No behavior change yet.
2. **Real-actor cast.** Wire cutscene spawn to `spawnFromSymbol` at the wings; map the `characters`
   block to live entities. Add the minimal `moveToLoc`/`onArrive` to the player/actor movement if not
   present (drive `walkTo`/exit). Verify an actor spawns + walks under the existing renderer.
3. **`Thespian` runner.** Build the line loop + sync/async (`pending`) model; port `goThespMode`
   display/delay timing + `wait` timer + lights/fade counting. Implement all 31 verbs + speakLine
   against the live cast. `#key` interpolation last. Replace `CutscenePlayer` internals with a thin
   host that owns a `Thespian`.
4. **SceneManager (H2 substrate).** Extract the `mode` var into a `SceneManager` with `goScreen`/
   `cutSceneFinished`/overlay support; rewire `main.ts` to it (no flow change yet — title/intro/game/
   pause still work identically).
5. **Death flow.** Add `ExtraLives` + `goWastedMode`; route player death → `attemptRespawn` →
   (lives) in-place respawn **or** game-over → wasted cutscene → `#loadGame`. Fallback to title when no
   save.
6. **Data-driven menus.** Move menu content to a small table; add shadowed-item support + the
   `#showArmy`/`#instructions`/`#controls` overlays through `screenOn`/`backAScreen`.
7. **endRoom win (H3).** Parse `#endRoom`; branch the win trigger in `RoomManager`.
8. **Per-room `pState`.** Add the `pState` map; snapshot-on-leave + restore-on-enter; extend the save
   tree to cascade the whole map (superseding G's current-room-only). Reconcile with G2 army reserve
   (a teleported-out ally must not also be frozen into `pState`).

---

## (e) Test plan

**Unit (vitest):**
- *Parser*: `interpretLineCommand`/`interpretLineArgs` over `scr_demo_001`, the wasted script, and a
  `stones` script — exact verb + arg structures (point/rgb/symbol/text); `:`→speakLine;
  word2-command vs global.
- *Thespian drives an actor*: a 2-line scene (`at 100`, `m walkTo 200`) → the spawned entity's
  `Movement` actually moves toward x=200; `goMode #stand` sets the anim override; `at` teleports.
- *Async timing*: `speakLine` blocks for `displayTime+delayTime` frames (no space); `wait 30` blocks
  exactly 30 ticks; `lightsDown` completes only after the (all-actor) fade duration. Scene reports
  `done` only after the last line's timer expires.
- *`#key`*: `m: Press #key fire to attack` interpolates the bound fire key for the active scheme.
- *Scene FSM*: `goScreen` transitions + `cutSceneFinished(intro)`→game, `(gameOver)`→game+load,
  `(gameComplete)`→victory. Overlay `screenOn`/`backAScreen` round-trip.
- *Death*: lives=1 → die → in-place respawn at recorded point, energy restored, lives=0; lives=0 → die
  → game-over path selected (wasted scene queued).
- *endRoom win*: a synthetic map with `#endRoom:(2,1)` — clearing room (1,1) does NOT win; clearing
  (2,1) fires `onMapClear`. A `#endRoom:#none` map wins only on clear-all (regression: default map).
- *Per-room round-trip*: enter room A, damage an enemy, leave to B, return to A → the enemy restores at
  its saved HP/position (not full HP); cleared room restores empty. Save→load cascades the whole
  `pState` map.

**In-browser smoke (the keystone reachability checks):**
- The **intro cutscene still plays** (default map) — now with the real Merlin/Ulin actors walking and
  auto-advancing dialogue, then drops into gameplay. (Already reachable: `Start Game`.)
- `?map=merliniii` (real `#endRoom: point(17,3)`) or `?map=mriiilongii` (`point(16,1)`): reach + clear
  the end room → **victory / game-complete cutscene** fires (NOT requiring clear-all). These are the
  **only two of ~57 shipped maps with a real endRoom**, and both are bundled in the port's 47 maps —
  the concrete reachability anchor for H3.
- Default map (`#endRoom:#none`): still wins on clear-all (no regression).
- **Die** in room 1 → **wasted** cutscene (real Merlin, "You Got Wasted!", blue flash) → reload save
  (or title if none). With a banked extra life, die → respawn in place instead.
- Walk out of a half-cleared room and back → enemies are where you left them at the HP you left them.

---

## (f) Faithfulness risks

1. **Driving live actors vs draw-frames (THE biggest).** The whole H1 premise is that cutscene
   characters are real entities animating through their own modules. The port's actors don't yet have a
   general `moveToLoc` with arrival callbacks, prop-carry, teleport-in/out anims, or wasted mode — these
   must be real enough that `walkTo`/`teleportOut`/`produceProp`/`goWastedMode` produce visible,
   correctly-timed motion. If any verb falls back to "snap" instead of "animate", the cutscene desyncs
   from its `wait`/`speakLine` timings (which were authored assuming real walk durations). Mitigation:
   build verbs on the gameplay `Movement`/`Anim` the port already renders; golden-test walk arrival.
   Props/walkScroll are used in only a few scripts (18/4 uses) and not in the intro/wasted — stage them
   behind the core movement+speech verbs.
2. **Async line timing.** The display-time formula (`50 + chars·1.4` frames) and the lights/fade
   all-actor-count gate must match, or dialogue pacing drifts. The port runs a fixed 30Hz tick (the
   original is tick-based too), so frame counts map 1:1 — but `backgroundColourTo` (fire-and-forget
   tween) vs `lightsDown` (blocking) must not be confused, or scenes either race or hang.
3. **Scene-FSM completeness.** movieMaster's `cutSceneFinished` dispatches by *which script* finished
   (intro/complete/over each route differently). Collapsing 16 screens to ~9 risks losing a transition
   (e.g. game-over → reload-save, not fresh-restart). Enumerate the dispatch table explicitly; the
   credits/instructions/showArmy screens are overlays we can stub without breaking the core loop.
4. **Per-room state memory cost.** `pState` holds a full actor-chain snapshot per visited room. For
   large maps (64×64 ≈ 4096 rooms) this is unbounded growth if every room is visited. The original has
   the same model (it's `objRoom.pState` per room); acceptable, but cap/serialize lazily and only
   snapshot rooms actually entered. Reconcile with G2: a teleported-out reserve ally must be excluded
   from `pState` (it lives in the army reserve, not the room) to avoid double-spawn on re-entry.
5. **`#key` binding source.** Interpolation reads live key bindings; the port's input schemes
   (arrows/wasd/zqsd/both) must expose a control→key lookup matching the original `keyMaster` control
   names, or `#key fire` shows the wrong glyph. Low blast radius (cosmetic in dialogue) but visible.

---

## (g) Explicitly out of scope

- **Credits, profile, licence, instructions, key-config, showArmy roster screens** — H2 wires the
  *transitions* to these screen syms (and stubs overlays where the loop needs them), but the screens'
  full content/art (credits scroll, `showArmyMaster` roster, `keyChooseMaster` UI, `profileMaster`) is
  not in this slice. Game-complete routes to a victory screen rather than a real credits sequence.
- **Copy protection** (`copyProtectionMaster`, `gameMaster.start` invalid→redirect,
  `updateCopyProtectionStatus`) — disabled in the original itself ("disabled due to problems on the
  Mac", gameMaster.txt:17); never ported.
- **Map editor** (`mapEditMaster`, tool/brush palettes, `saveMap`) — a separate executable, already
  ruled out of parity (README "Out of scope"; audit §8).
- **Screen transition art** (`#fade`/`#flick` tweens, `objScreen`/`objScreenSequencer` snapshot
  compositing) — transitions are instant in the port; the tween is F3-class render fidelity, not flow.
- **Graves persistence** (`modRoomGraves`/`reDrawGraves`) within per-room restore — no grave system in
  the port yet; `pState` restores live actors only.
- **Speech bitmap/font fidelity, bubble background blend, title image art** — the `objMenu`/cutscene
  text is functional Canvas2D, not the original bitmap members (render fidelity, not flow parity).
