# Cutscene DSL semantics audit — `modThespian` vs the port Thespian

Command-by-command comparison of the cutscene DSL vocabulary. The original splits the runner across
`modThespian` (actor verbs), `cutSceneMaster` (global verbs), `objScriptPerformer` (line pump / timing /
fader gate) and `objScript` (parser). The port collapses all four into `src/scenes/thespian.ts`
(`performLine` dispatch) + `src/data/cutscene.ts` (parser) + `src/scenes/cutscenePlayer.ts` (host/render).

Method: derived each command's semantics from the original casts; reproduced the port's behaviour with a
throwaway probe (`tools/_audit_thespian.ts`, since deleted) that parsed scripts, stepped the engine, and
asserted advance/landing for representative verbs. 44/44 probe assertions passed for the verbs marked
faithful below; the divergences were confirmed by reading the original handlers + the probe's `fadeDown`
observation (`finished=false faders=1` after the fadeDown line — i.e. the chain blocked).

## Completion model (the load-bearing axis)

Original line completion = "when does `lineFinished` fire and `performNextLine` run":

- **Actor verbs** (`modThespian.performLine`): dispatch the verb, then call `me.lineFinished()`
  **immediately** in the same case. So every actor verb is a **sync fall-through** — the actor may still
  be walking/teleporting/fading under its own module `update`, but the *script* does not wait. The sole
  exception is `#speakLine`, which does **not** call `lineFinished`; it enters `#displayLine` mode and the
  `update` loop advances `#displayLine` (displayTime frames) → `#delayAfterLine` (delayTime frames) →
  `lineFinished`.
- **Global verbs** (`cutSceneMaster`): most call `pScriptPerformer.lineFinished()` synchronously
  (`showTitle`, `backgroundColourTo`, `backgroundColour`, `backgroundColourRandomFlash`, `walkScroll*`,
  `playSound`, `playMusic`, `setStage`-via-`backgroundColour`). Two **block**: `wait` (starts a frame timer,
  `lineFinished` only on `waitTimerFinished`) and `lightsUp`/`lightsDown` (→ `objScriptPerformer.lightsChange`
  sets `pWaitingForPlayers` = #players; each `playerFaderFin` decrements; `lineFinished` at 0).

The port mirrors this with two gates in `Thespian.tick`/`performLines`: `pending` (a frame countdown for
`wait`/`speakLine`) and `waitingForFaders` (a count-to-zero for `lightsUp`/`lightsDown`). Sync verbs run in
a `while` loop until one sets a gate or the script ends — matching the original's "run lines until one
doesn't fall through" pump. **This core model is faithful.**

## interpretLoc + stage geometry

`modThespian.interpretLoc`: a `point` passes through; a bare number `x` → `point(x, positionEdge(#bottom,
stageFloor))` (stand the actor's feet on the stage floor at that x). Port `interpretLoc` (thespian.ts:161):
`point` passes through; `number` → `{x, floor}`; faithful (the port snaps to a single floor line rather
than each sprite's bottom-edge, an acceptable simplification since cutscene sprites share a ground line).
`stageLeft=24`, `stageRight=viewW-24`, `floor=round(viewH*0.6)` stand in for `pStageRect`/`pStageFloor`.
`calcStageLeftOffLoc`/`calcStageRightOffLoc`/`calcTeleportFloor`/`realignToStageFloor` are not separate port
methods but folded into the enter/exit/teleport handlers — behaviourally faithful for the shipped scripts.

## Speech-mode routing

`#ingame` vs `#cutscene` (`calcEnvironment`: background sprite present ⇒ `#cutscene`). Port: `host.ingame`
flag selects `renderInGame` (bubble above the speaker's head, world coords, live Merlin left in place) vs
`render` (caption at the bottom of the stage). `#key` interpolation (`interpretSpeechVariables`) is
re-evaluated at display time in both. Faithful. The display-time formula `BASIC_TIME_PER_LINE(50) +
chars*TIME_PER_LETTER(1.4) + TIME_BETWEEN_LINES(12)` matches `objScriptPerformer` exactly.

## Command table

| Command | Args | Original semantics | Port status |
|---|---|---|---|
| `at` | x / point | snap to interpretLoc, sync | **faithful** |
| `atPlayer` | actor | snap near another player's x, sync | **faithful** (places ±30 of target) |
| `walkTo` | x / point | `moveToLoc`; sync fall-through (walks under own module) | **faithful** |
| `walkToPlayer` | actor | walk to another player's x; sync | **faithful** |
| `enterStageLeft` / `…Right` | — | place off the wing then `walkTo` the on-loc; sync | **faithful** |
| `exitStageLeft` / `…Right` | — | `walkTo` off-loc, `pExitingStage`; on arrival `gotoWings`; sync | **faithful** |
| `turnToFace` | actor | flip sprite toward target (unless turnToFace-locked or #prop); sync | **faithful** |
| `teleportInAt` | x / point | place + teleport-in stretch; sync | **faithful** |
| `teleportOut` | — | teleport-out stretch, then `gotoWings`; sync | **faithful** |
| `produceProp` | actor | carry `actor` as a #prop tracking the carrier; sync | **faithful** |
| `putAwayProp` | — | shrink-away the carried prop → wings; sync | **faithful** (snaps to wings) |
| `dropProp` | — | release the prop at its loc (thrown); sync | **faithful** (left at loc) |
| `propAt` | x / point | set #prop status then place; sync | **faithful** |
| `goMode` | #sym | `big.goMode(sym)`; sync | **faithful** (routed to Anim.action override) |
| `goWastedMode` | — | wastedModeOn + realign to floor; sync | **faithful** |
| `gotoWings` | — | park offscreen at the wings; sync | **faithful** |
| `walkScrollLeft` / `…Right` / `…Stop` | — | continuous scroll-walk until stop (a #prop exits instead); sync | **faithful** |
| `speakLine` (`alias:`) | text | show speech, frame-timed auto-advance; **blocks** | **faithful** timing; **divergent** auto-turn (see D2) |
| `showTitle` | text | set title text; sync | **faithful** |
| `backgroundColourTo` | rgb | tween bg toward colour (speed 2), cancel flash; sync | **faithful** |
| `backgroundColourRandomFlash` | speed | self-restarting random-colour loop; sync | **faithful** |
| `lightsUp` / `lightsDown` | — | fade every actor in/out under its own fader; **blocks** until all done | **faithful** |
| `wait` | frames | start a frame timer; **blocks** N frames | **faithful** |
| `setStage` | — | wings + invisible + set bg to scene colour; sync | **faithful** |
| `playSound` / `playMusic` | member [vol] | play through soundMaster; sync | **faithful** |
| **`fadeDown`** | (actor verb) | `startSlowFadeOut` **then `lineFinished` immediately** — SYNC | **divergent** (see D1) |
| `backgroundColour` | rgb | instant colour set + cancel flash; sync | **missing** (immaterial — see D3) |
| `fadeUp` | — | original is a `put`-debug stub + lineFinished; sync | **missing** (immaterial — see D3) |

## Divergences

### D1 — `fadeDown` blocks the chain (should be sync)

Original `modThespian.performLine` (`casts/script_objects/modThespian.txt`):
```
#fadeDown:
  me.fadeDown()        -- big.startSlowFadeOut() : the fade BEGINS (async, visual)
  me.lineFinished()    -- the script advances IMMEDIATELY (same case)
```
`fadeDown` is therefore a **sync fall-through**: the actor fades out while the *next* lines run. The fader's
completion (`faderFin` → `playerFaderFin`) is wired for `lightsChange` only; `fadeDown` never increments
`pWaitingForPlayers`, so it does not gate the chain.

Port `thespian.ts:248`:
```ts
case "fadeDown": if (p) this.fadeActor(p, 0); break;   // fadeActor: this.waitingForFaders += 1
```
`fadeActor` increments `waitingForFaders`, and `tick` (thespian.ts:199) returns early while
`waitingForFaders > 0`. So the port **blocks** the line chain until the fade finishes (~`FADE_DURATION`=18
frames). Probe evidence: after the `m fadeDown` line, `finished=false faders=1` — the chain stalled.

Impact: shipped usage is `hp fadeDown` immediately followed by `playSound collect_powerup_01 255`
(`cut_scenes/mr3IntroPart4.txt:43-45`, `mr3IntroFull.txt:275-277`). Original: the sound fires the same tick
the fade starts. Port: the sound is delayed ~18 frames (until the fade gate clears). Not dropped, but
mistimed. The stones1-10 scripts the port actually plays do not use `fadeDown`, so no shipped-content
regression — this is a DSL-vocabulary semantics divergence.

Fix: make `fadeDown` start the per-actor fade WITHOUT incrementing `waitingForFaders` (fire-and-forget),
matching `lineFinished`-immediate.

### D2 — `speakLine` does not auto-turn listeners toward the speaker

Original `objScriptPerformer.performNextLine` (`casts/script_objects/objScriptPerformer.txt`):
```
if linePackage.theCommand = #speakLine then
  if pAutoTurn then                       -- pAutoTurn defaults TRUE (objScriptPerformer.new)
    me.turnPlayersToFace(linePackage.objCharacter)   -- every OTHER player flips to face the speaker
  end if
end if
```
So on every line of dialogue, all non-speaking actors turn to face whoever is talking.

Port `speakLine` (`thespian.ts:387`) sets `this.speech` + the pending timer and makes the speaker visible,
but never iterates the other players to flip their facing. Listeners keep whatever facing they last had.

Impact: cosmetic but systemic — in any multi-actor dialogue (the stones scenes are mostly two-hander
`u`/`m` exchanges) the listener does not orient toward the speaker as it does in the original. Confirmed by
reading both sources; the probe exercises explicit `turnToFace` (faithful) but the port has no implicit
per-speakLine turn.

Fix: in `speakLine`, after setting `this.speech`, flip every other visible non-#prop actor's `facingLeft`
toward the speaker's x (the `turnToFace` logic already exists as a private method).

### D3 — `backgroundColour` (instant) and `fadeUp` not handled (immaterial)

`cutSceneMaster.backgroundColour <rgb>` (instant set + flash-cancel, distinct from `backgroundColourTo`'s
tween) and `cutSceneMaster.fadeUp` (a debug-`put` stub that just calls `lineFinished`) have no port case.
Neither appears in any shipped script (`cut_scenes/*`, `scr_*`, `cutscenes/stones*`), so this is a
vocabulary gap with zero content impact. `setStage` internally uses the instant set, which the port models
directly (`setStage` copies `bgTarget` into `bg`), so the one path that needs instant-set is covered.

## Verdict

The core dispatch, the sync/async completion model, `interpretLoc`, stage geometry, speech-mode routing,
`#key` interpolation, and 25 of the verbs are faithful. The verbs the port actually plays in shipped
content (speakLine/wait/teleportInAt/teleportOut) are all correct. Two behavioural divergences (D1
fadeDown blocking, D2 missing speakLine auto-turn) and two immaterial missing verbs (D3).

thespian-dsl | DIVERGENCES=2
- D1 fadeDown blocks the line chain (port gates on its fader) but the original is a sync fall-through; D2 speakLine does not auto-turn listening actors toward the speaker (objScriptPerformer pAutoTurn).
