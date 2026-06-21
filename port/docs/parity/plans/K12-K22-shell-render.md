# Plan K12 + K14–K22 — Shell / Render / Audio completeness cluster

**Scope:** the deferred shell/render/audio items in the Phase-K burndown
([`K-deferred-backlog.md`](K-deferred-backlog.md)): **K12** (chatter cutscenes), **K14** (beam
sprite-strip render), **K15** (`objTransColor` exact tween), **K16** (cutscene prop/walkScroll/
random-flash verbs), **K17** (lights/fade per-actor fader), **K18** (screen content), **K19**
(screen-transition tweens), **K20** (per-effect sound channels), **K21** (grave system), **K22**
(collision/render edges). Owner directive: implement **all** deferrals — none are dropped.

**Where these were deferred (source plans, §g of each):**
[`H-shell-flow.md`](H-shell-flow.md) §g (cutscene prop/walkScroll/randomFlash verbs · per-actor fader ·
credits/profile/showArmy/instructions/key-config screens · screen-transition tweens · grave persistence),
[`F2-F3-collision-render.md`](F2-F3-collision-render.md) §F (beam line vs sprite-strip · `objTransColor`
exact tween curve · AI platform drop-through · discrete-Z display list · per-tile exit ranges / exit
arrows), [`I-mr4demo-content.md`](I-mr4demo-content.md) §g.8 (chatter cutscene availability), and the
05-audit (per-effect sound channels).

> **The grounding rule (README correction):** reachability is asserted **against the map data**, never
> from an audit scan. Stones (K12) ARE placed (`stones1-5` × 2 maps each, I-plan §h). Non-`#solid`
> collision tiles (K22) are placed in **zero** of the 47 maps. That split — exercised-by-content vs
> support-only — drives the priority and the verification strategy below.

---

## (a) Per-item original mechanics (cited) + port gap

### K12 — Chatter cutscenes
**Original.** `objChatter.txt` (= `objPowerUp` + `modProp` + `modThespian`, `#objAiChatter`). On
`collected` (the player walks onto the 320×320 trigger in nav mode), if `pPerformed=false`:
`goMode(#talking)` (swap to `pTalkingMember`) → `g.cutSceneMaster.playCutScene(pScriptToPerform)` → latch
`pPerformed=true`; a second touch while `#talking` → `goMode(#finishedTalking)` (revert to
`pWaitingMember`) (`objChatter.txt:43-61, 75-89`). `act_stonesN` set `#scriptToPerform:#stonesN`,
`#team:#chatters`(stones1)/`#collectables`(2-5). The scripts `scr_stones1..10` **exist** in
`casts/data/` — `scr_stones1` is a real 30-line cutscene: `wait 20` → `u teleportInAt point(500,128)` →
many `u:`/`m:` dialogue lines (several with `#key #wizard`/`#wizardSelector` interpolation) →
`u teleportOut` → `wait 60`. `cutSceneMaster.playCutScene` (`:311`) is the SAME engine the intro/wasted
use, returning via `scriptFinished → movieMaster.cutSceneFinished(pScene)` (`:334`) — for a stones scene
this just ends the overlay and returns to gameplay (it isn't `gIntroScript`/`gGameOverScript`/
`gGameCompleteScript`, so the dispatch is a no-op → resume game).

**Port gap.** `tools/build_assets.ts:154-156` bundles **only** `intro.txt`/`wasted.txt`/`complete.txt`.
`components/chatter.ts` spawns the stones as **inert decorative sprites** with no overlap trigger ("the
faithful fallback" while scripts are unbundled). `scenes/sceneManager.ts` only knows the three named
cutscenes (`type CutScene = "intro" | "wasted" | "complete"`) and the host loads exactly those three
files. So: scripts not bundled, no on-demand load, no overlap trigger, no arbitrary-named-script play.

### K14 — Beam sprite-strip render
**Original.** `objBullet.setBeam(dist, distXY)` (`objBullet.txt:239-246`): `pHScale = dist+1`;
`setSpriteWidth(pHScale)`; `setAnimKeepSize(true)`; `rot = GeomAngle(distXY)`;
`ID.bigMe.setSpriteRotation(rot)`. I.e. ONE bullet sprite **stretched horizontally to the caster→target
distance and rotated to the beam angle** — a sprite-strip beam. `modAttack.performBeamAttack` spawns the
bullet **at the target loc** (±jitter), calls `setBeam`, and detonates the explode `#attack` there.

**Port gap.** `components/projectile.ts` has a `beam` mode (I8), but it resolves the splash and lingers a
few frames as a **2-D drawn line** — `configureBeam` stores `beamDist/beamAngle/beamCasterX/Y` for "the
renderer's stretched-line draw", and the renderer draws a line between caster and target. It does NOT
stretch+rotate the actual bullet **sprite** via per-sprite scaleX + rotation (the F3 renderer supports
rotation/scale, but the beam path doesn't use a sprite strip).

### K15 — `objTransColor` exact tween + `#current`-start colour
**Original.** `objTransColor` (the tweener `modColourTransform` drives) is an `objTransformer` with
`pCurr` stepping 0→100 (`init` `setTarget(100)`, `initialValue=0`). Each frame `updateAttribute`:
`newColor = VarColRange(pCurr, pStartColor, pTargetColor)` and writes it to the sprite/text colour
(`objTransColor.txt:22-46, 86-97`). The **start colour** is `#current` by default
(`modColourTransform.addModParams` `c[#startColor]=#current`) → `initCurrentColor` reads the sprite's
**actual current colour** (`pSpr.color`/`member.color`) as the start (`objTransColor.txt:32-36, 48-57`).
`flickWhite` is `white→black @ speed 33` (`modColourTransform.txt:114-124`). The transformer steps
`pCurr` by the configured `speed` and fires `informCallingPrg → transColorFin` when it reaches target;
ping-pong reverses. So a glow tween starts from **whatever colour the sprite already is**, not black.

**Port gap.** `components/colourTransform.ts` (F3) is close but two documented approximations remain:
(1) `arm()` uses `start = opts.start ?? BLACK` — a `#current` start is **approximated as black** (comment
lines 64-66: "approximated as black ... correct for the common idle→glow case"); (2) the tween parameter
`t` runs 0..255 stepping by `speed*gameSpeed` (linear), whereas the original runs `pCurr` 0..100 and
`VarColRange` interpolates — the **numeric step/scale differ** (255 vs 100), and `getColourTransform`
synthesizes a `strength` heuristic (`0.15 + k*0.85`) rather than emitting the literal interpolated
colour. The hue/visual is right; the exact ramp and the `#current` start are not.

### K16 — Cutscene verbs: prop / walkScroll / random-flash
**Original.** `modThespian.performLine` actor verbs (`:395-487`): `#produceProp`
(`bigMe.carryProp(propObj)` + `propObj.beProducedAsProp` — a character is carried as a prop by another),
`#putAwayProp`/`#dropProp` (`big.putAwayProp/dropProp`), `#propAt` (`setPropStatus(#prop)` + `at`).
walkScroll (global, via `cutSceneMaster` → `pScriptPerformer.putPlayersIntoWalkMode(#left/#right/#stop)`
→ `modThespian.startWalkScrollLeft/Right/stopWalkScroll` `:567-596`: `lockTurnToFace` +
`moveHorizReaction(±1)` — continuous scroll-walk while the background scrolls; a `#prop` character
exits the stage instead). `backgroundColourRandomFlash` (global, `cutSceneMaster.txt:157-170`):
`goMode(#backgroundColourRandomFlash)` + a self-restarting random colour-tween loop on the background
(`eventNotification(#colourTransformFin) → backgroundColourToRandom`), fire-and-forget. Usage counts
(H1 table): produceProp 18, propAt 16, putAwayProp/dropProp 8 each, walkScroll* 4/3/1, randomFlash 1.

**Port gap.** `scenes/thespian.ts:204,215,216` stage these as **no-ops**: `produceProp`/`putAwayProp`/
`dropProp` → `break`; `walkScrollRight/Left/Stop` → `break`; `backgroundColourRandomFlash` → `break`.
`propAt` partially works (it just teleports + makes visible, no `#prop` status). None of intro/wasted/
complete use them; the stones scripts don't either — but full parity requires them.

### K17 — Lights/fade per-actor fader
**Original.** `objScriptPerformer.lightsChange(dir)` (`:211-233`): `pWaitingForPlayers=0`; for **each
player** call `startSlowFadeIn`/`startSlowFadeOut` and `pWaitingForPlayers += 1`. Each actor fades under
its **own** fader; on finish `modThespian.faderFin → pScriptPerformer.playerFaderFin` (`:282-286`)
decrements; when `pWaitingForPlayers=0` → `lineFinished` (`:286-292`). The line completes only when
**every** actor has finished fading — and each actor's fade is its own counting object, so they can
differ.

**Port gap.** `scenes/thespian.ts:34,209-210,273` uses a single shared `FADE_DURATION = 18` frame window
for `lightsUp`/`lightsDown`/`fadeDown` and a single `lightsAlpha` tween for the whole stage — no
per-actor fader, no per-actor sprite alpha, no count-down-to-zero gate.

### K18 — Screen content (credits / profile / showArmy / instructions / key-config)
**Original.** Each is a real screen master:
- `creditsMaster.txt`: loads `member("txt_credits","gfx")` text (or a net request), displays it in a
  scrolling member (`objTransTextScroll`, speed 1, scroll-up to `pCreditsMember.height`), fade
  "Loading…" in/out (`:57-132`). Reached after `gGameCompleteScript` (`movieMaster.cutSceneFinished →
  goScreen(#creditsScreen)`).
- `showArmyMaster.txt`: paginated reserve-army roster grid — `getReserveArmy()` (the G2 reserve) laid
  out by `objUnitDisplayer`s into rows/pages (`setupDisplay`/`displayPage`/`displayUnit`), `nextPage`/
  `previousPage` with `isMenuItemShadowed` page guards, `#backToGameMenu` returns to the ingame menu
  (`:51-246`).
- `keyChooseMaster.txt`: the key-config screen — `pKeyBindings` per key-set (`#wasd`/arrows/etc.),
  `pKeysByNum` (keyNum→glyph table, `:34-62`), `pKeyDescriptions` (control→description), a menu to choose
  the active set + a descriptions text member.
- `instructions` / `profileMaster`: instructions is a static overlay screen; `profileMaster` is a
  **developer profiler** (`startProfile`/`writeReport` timing — NOT a player screen).

**Port gap.** `H-shell-flow.md` §g: H2 wired the **transitions/syms** but the screen **content** is
stubbed. `scenes/sceneManager.ts` has `Overlay = "ingameMenu" | "showArmy" | "instructions"` and a
`"victory"`/`"complete"` route, but there are no actual credits/showArmy/keyConfig/instructions renderers
— `screenOn("showArmy")` flips a flag with nothing drawn.

### K19 — Screen-transition tweens
**Original.** `screenMaster` runs every transition as a two-phase tween: `startTransition` →
`sendAllScreens(#offScreen, transition)` (all screens flick/fade off, counting `pWaitingForScreens`) →
`continueTransition` (target `onScreen`) → `finishTransition → caller.goScreenFinished`
(`screenMaster.txt:194-223`). `movieMaster.goScreen` passes `transition:#fade` (`:130-137`);
default in `screenMaster.init` is `#flick`. So inter-screen changes are an animated off→on, not instant.

**Port gap.** `scenes/sceneManager.ts:46-47` comment: "transition to a screen (**instant**) — the
#fade/#flick tweens are F3 cosmetic"; `goScreen` sets `this.screen = target` immediately.

### K20 — Per-effect sound channels (volume + channel management)
**Original.** `soundMaster.txt`: **0–255 volume** (`pDefaultVolume=150`, `calcVolumeDefault`), an 8-slot
channel mixer (`pMixMaster[1..8]`), music on a dedicated channel (`pMusicChannel=1`) with a restart-guard
(`checkRestartMusic`: don't restart the same track if `soundBusy`), SFX round-robin across channels
2..8 (`playSound`: pick `pNextChan` or `SoundEmptyChan()` if busy, set `sound(chan).volume = vol`,
`VarChangeInRange(pNextChan,1,8,1)`) (`:142-208`), and a per-frame **add-cap** (`checkadded`: max 4 new
sounds/frame, `:246-259`). `pActive`/`pEnable` mute flags persist in the save (`addSaveData`).

**Port gap.** `systems/audio.ts`: a flat `play(name, volume=1)` — Web Audio creates a fresh
`BufferSource` per call (effectively unlimited overlap, no channel cap, no round-robin, no 4/frame cap);
volume is a 0..1 multiplier × a fixed `sfxGain=0.7` (no 0–255 model, no per-effect default). Music has
the restart-guard (`currentMusic===name`) but no save of the active/enable flags.

### K21 — Grave system + pState graves
**Original.** `modGrave.drawGrave` (on death, if `pGraveOn`): `setFlipFromDir(1)` →
`currentRoom.drawAndRecordGrave(bigMe)` (`modGrave.txt:31-39`); the grave member is the actor's `#grave`
anim strip (`getGraveMember`). `modRoomGraves` (on the room): `drawAndRecordGrave` blits the grave image
into the **room background image** (`copyPixels`, ink 36) AND records a `graveRecord` (`actorType`,
`member`, `rect`) into `pGraves`; `reDrawGraves` re-blits them on room re-entry; `pGraves` persists via
`addSaveData`/`restoreFromSave` (`modRoomGraves.txt:32-74`). So a death leaves a **permanent decal**
baked into the room that survives leave/return and save/load.

**Port gap.** The port has a `#grave` anim (dead actors render a grave **frame** while their entity
lingers — `anim.ts:44`), but **no persistent decal**: when the dead entity is finally removed the grave
disappears, and re-entering a room shows no graves (H3's `pState` restores live actors only; H §g
explicitly lists "graves persistence" out of H3). No `pGraves` record, no save field.

### K22 — Collision / render edges
**Original.** Four sub-items, all in `F2-F3-collision-render.md` Part F as TODO seams:
1. **AI one-way-platform drop-through** — `calcOverlapPlatform`'s gate consults `getAIPlatformDrop()`; a
   `#platform` lets a *dropping* AI fall through (`objCollisionMap`, F2 §A.1).
2. **Discrete layer-Z display list** — `gMapLayer=1 … gGridSelectorLayer=250`; sprites are `locz`-sorted
   into a unified channel order (bullets/pickups/effects/HUD bands). F2 added only the
   `#foregroundPassive` over-actor band.
3. **Per-tile screen-exit ranges** — `modScreenExits`: an exit edge can be a **sub-range** of a screen
   edge (not the whole edge), so you only cross where the door is. (05-audit §5 item 3.)
4. **Exit arrows** — the on-screen arrow glyphs that mark open exits (05-audit §5 item 4).

**Port gap.** F2 shipped the per-edge `EdgeGrid` (solid/platform/ceiling/wall + merge + corners +
directional events) and wired the event surface, but left the **AI drop-through** as a TODO seam
(`getAIPlatformDrop`), kept a flat sprite draw order (no discrete-Z), and `RoomManager.tryTransition`
(`rooms.ts:208-217`) treats the **whole edge** as the exit (`m.x<0 && o.left → enter`) with **no exit
arrows**. None of the 47 maps ship non-solid active tiles → drop-through and exit-ranges are
**support-only** (editor/AI-hook breadth), never exercised by shipped content.

---

## (b) Concrete file-level design

### K12 — Chatter cutscenes (bundle + on-demand load + overlap trigger + generalized SceneManager)

1. **Bundle the stones scripts** (`tools/build_assets.ts`). After the three named cutscene copies
   (`:154-156`), copy every `casts/data/scr_stonesN.txt` to `public/assets/cutscenes/stonesN.txt` and
   record them in a manifest (extend `assets.json` with `cutscenes: { stones1:"cutscenes/stones1.txt",
   … }`, or a sibling `cutscenes.json`). Bundle all **10** (`stones1-10`) — `stones6-10` are dead
   content (placed in 0 maps, I-plan §h) but the on-demand loader is generic, so bundling them is free
   and removes a special-case. Keep `intro/wasted/complete` as-is (they keep their fixed names).
2. **On-demand load.** Add `loadCutscene(name): Promise<Cutscene>` to the cutscene host/loader: fetch +
   `parseCutscene` (the existing `data/cutscene.ts` parser already handles the `characters`/`lines`
   format `scr_stones1` uses — verify the `#playerCharacter - m` alias resolves to the player). Cache by
   name. The intro/wasted/complete keep eager-loading; stones load lazily on first trigger.
3. **Generalize `SceneManager` to an arbitrary named script.** Today `CutScene` is the closed union
   `"intro"|"wasted"|"complete"`. Widen to `type CutScene = string` (or `NamedCutScene = "intro" |
   "wasted" | "complete" | `\``stones${number}`\`). The load-bearing `cutSceneFinished(scene)` dispatch
   (`sceneManager.ts:69-87`) keeps its three explicit cases; **add a default branch**: an
   unrecognized script (a stones scene) finished → **return to gameplay** (no screen change, `resume()`),
   mirroring `movieMaster.cutSceneFinished`'s `case` falling through for a non-`gIntro/Over/Complete`
   scene. Add an in-game cutscene entry point distinct from `goScreen`: `playInGameCutScene(name)` that
   pauses combat, plays the Thespian over the **live game view** (not a separate stage — `pEnvironment =
   #ingame` when there's no cutscene background), and on finish resumes. (The intro/wasted/complete stay
   `#cutScene` full-stage; stones are `#ingame` overlay — the original's `calcEnvironment` distinction,
   `cutSceneMaster.txt:220-227`.)
4. **Overlap trigger** (`components/chatter.ts`). Replace the inert `update` no-op with the
   `objChatter.collected` FSM: each tick, if `!performed` and the player overlaps the trigger box
   (320×320 reach, AABB vs the player's pos), `goMode("#talking")` (swap to `pTalkingMember` via Anim
   override), call `game.sceneManager.playInGameCutScene(scriptToPerform)`, latch `performed=true`. The
   stone stays a static `Anim+Team` actor (already spawned by I5 dispatch) — only the trigger + the
   `talkingMember`/`waitingMember` swap are added. Honor `pPerformed` (talks once). `getScriptToPerform`
   already exists; wire `talkingMember`/`waitingMember`/`talkOnlyOnNavMode` from the act data.
5. **Stones are `#ingame` cutscenes** so the existing Thespian + the live-actor cast work as-is: the
   stone's script (e.g. `scr_stones1`) drives the `ulin`/`merlin` cast — `ulin` is spawned by the
   Thespian (`createMissingPlayers`), the player `m` binds to the **live Merlin** (host `bound:{m:
   player}`), `#key` interpolation resolves the live bindings. The teleportIn/teleportOut verbs already
   work.

### K14 — Beam as a stretched/rotated sprite strip

In `components/projectile.ts` the beam already spawns at the target with `beamDist`/`beamAngle`. Change
the **render** path (not the projectile logic): give the beam bullet's `Sprite` a `scaleX = beamDist+1`
(matching `setSpriteWidth(dist+1)`) and `rotation = beamAngle` (matching `setSpriteRotation(GeomAngle)`),
drawn from the **caster** anchor with the beam sprite's regpoint at the left end. The F3 renderer already
supports per-sprite `rotation`/`alpha`; add per-sprite `scaleX`/`scaleY` (and a left-edge anchor for the
stretch) to `Sprite` + `renderer.drawSprites`. The beam bullet uses the energyBeam strip member (the
`anm_…_beam`/bullet sheet) stretched along its long axis. Keep the one-frame explode-at-target detonate
(already correct). Result: a real stretched sprite-strip beam from caster→target, replacing the 2-D
`ctx.lineTo` draw. (`setAnimKeepSize(true)` → the stretch doesn't reset on anim advance: hold `scaleX`
across frames.)

### K15 — `objTransColor` exact tween + `#current` start

In `components/colourTransform.ts`:
1. **`#current` start.** `arm()` must default the start to the sprite's **current rendered colour**, not
   black. The renderer is the only place that knows the composited colour, but for the tween the relevant
   "current" is the previous transform's last colour (`pLastFinishingColour`, already tracked as
   `lastColour`) when chaining, else **no-tint (the sprite's base palette)**. Add a `currentStart` flag:
   when set (the default for glowRed/glowTeal/glowGold/glowPink, which omit `startColor` in Lingo), the
   tween's start is `lastColour` if a transform just finished, else the sprite's base (treated as
   the renderer's source pixels — i.e. a tint that ramps FROM 0 strength of the target hue, which is what
   the heuristic approximates, but now driven by the real `pCurr` ramp). Keep an explicit `start` only
   for the transforms that set `startColor` in Lingo (glowRedAndTeal=teal, fade*=gold/last, white
   flick/flash/pulse=white).
2. **Exact ramp.** Rescale the tween parameter to the original's **`pCurr` 0..100** stepping by `speed`
   per tick (`Counter`/`gGameSpeed`-scaled), and compute the colour with a faithful `VarColRange(pCurr,
   start, target)` = component-wise lerp at `pCurr/100`. Emit the **literal interpolated rgb** as the
   tint, with strength = the perceptual brightness of `(interpolated − base)` (so a fade-to-black ramps
   down, a glow ramps up) — retire the `0.15 + k*0.85` synthetic strength. Fire `finish()` when
   `pCurr ≥ 100` (non-ping-pong) exactly as `informCallingPrg → transColorFin`. Ping-pong reverses at
   100/0. This makes `flickWhite` a true `white→black @ speed 33` over `100/33 ≈ 3` frames (the original
   cadence) instead of the current `255/33 ≈ 8`-step ramp — the visible white-flick duration changes,
   so re-pin the F3 structural tests to the new ramp.

### K16 — prop / walkScroll / random-flash verbs

In `scenes/thespian.ts`, replace the three `break` no-ops with real effects on the live cast:
- **Props.** A cutscene character can be **carried by another** as a prop. Model a `prop` link on
  `Player`: `produceProp <other>` → set `other.carriedBy = thisPlayer`, hide its own walk (its position
  tracks the carrier + an offset), set `other.propStatus = "#prop"`; `putAwayProp`/`dropProp` clear the
  link (drop = leave at current loc; putAway = snap to carrier's wings). `propAt <loc>` → set
  `propStatus="#prop"` + `at(loc)` (the current partial just needs the status flag). In `driveActors`,
  a carried prop follows its carrier instead of its own walkTarget. `turnToFace` is suppressed for a
  `#prop` (matches `modThespian.turnToFace` `:556-558`).
- **walkScroll.** `walkScrollLeft/Right` → set a per-player `scrollDir = ∓1` and, in `driveActors`, move
  the actor continuously at walk speed in that direction (lockTurnToFace) while leaving the
  background/stage scrolling to the host (a stage-scroll offset the host applies — or, since the port's
  cutscene stage is a fixed view, scroll the **actors** the other way to fake the camera, matching the
  visible effect). `walkScrollStop` clears `scrollDir`. A `#prop` character `propExitStage*` instead (it
  rides off). These are sync verbs (fire + `lineFinished` same tick) — the scroll persists until
  `walkScrollStop`.
- **backgroundColourRandomFlash.** Set a `bgFlash = { speed }` state; in `tweenStage`, when active, on
  each `colourTransformFin`-equivalent (the bg reaching its random target) pick a **new random target**
  (`ColourRandom`) and keep tweening — a self-restarting loop (`cutSceneMaster.backgroundColourToRandom`).
  `backgroundColourTo`/`setStage` cancels it (`goMode(#none)`). Fire-and-forget (sync + `lineFinished`).

### K17 — Per-actor fader (lights/fade)

Give each `Player` its own fade state `{ alpha, target, fading }` and a per-actor sprite `alpha` the host
renderer reads. `lightsUp`/`lightsDown`/`fadeDown`:
- start a fade on **each** player (lightsUp/Down: all; `fadeDown`: just the verb's actor), set
  `pWaitingForPlayers = count of faders started`;
- per tick, advance each fading actor's `alpha` toward its target by the fader step; when an actor's
  fade completes, decrement `pWaitingForPlayers` (the `playerFaderFin` count);
- the line completes (`pending` cleared) only when `pWaitingForPlayers === 0` — NOT a fixed
  `FADE_DURATION`. Different actors can have different fade lengths (the original allows per-actor
  faders; even with a uniform step the **count gate** is the faithful completion model). The host
  renderer applies each cutscene actor's `alpha` (replaces the single stage `lightsAlpha` for actors;
  keep a stage-darkness for the background if desired, but actor visibility is now per-actor).

### K18 — Screen content (faithful overlays)

A small `scenes/screens.ts` with per-screen render + input, driven by `SceneManager`'s overlay/screen
syms (the transitions are already wired by H2):
- **credits** (`creditsMaster`): bundle `txt_credits` (copy `member("txt_credits","gfx")` text — extract
  from the cast, or the shipped `cut_scenes`/`gfx` text if available; else author from the real credits
  string) into the build, render it as a **scrolling text block** that auto-scrolls up at speed 1 to its
  full height then ends → `goScreen(title)` (`displayCreditsText` + `objTransTextScroll`). Reached after
  the `complete` cutscene (`cutSceneFinished("complete") → credits`, currently → `victory`; re-route to
  credits, then credits → title).
- **showArmy** (`showArmyMaster`): query the **G2 reserve** (`game.armyMaster.getReserveArmy()`), lay
  the units out in a paginated grid (rows wrap at the display-rect width; pages when rows exceed height —
  `setupDisplay`), render each unit's sprite + level, `nextPage`/`prevPage` keys with the shadow guards,
  `back` → ingame menu. Reuses the existing unit sprites (no `objUnitDisplayer` art needed — draw the
  actor's `stand` frame).
- **instructions**: a static text/overlay screen (the instructions string) with `back` to the menu.
- **key-config** (`keyChooseMaster`): list the available key-sets (the port's `Input` schemes:
  arrows/wasd/zqsd/both) with each control→key shown (port `keyForControl` already exists for `#key`
  interpolation — reuse it for the description table), let the player pick the active set; persist the
  choice. The `pKeysByNum` glyph table maps to the browser key names. (Full per-key **rebinding** UI is
  the lower-fidelity edge — see §g; choosing among the existing schemes is the parity-meaningful bit.)
- **profile** is the dev profiler — **NOT a player screen** (see §g; out of scope, but documented so the
  "profile" sym in the backlog is accounted for).

### K19 — Screen-transition tweens

In `SceneManager.goScreen`, replace the instant `this.screen = target` with a short transition state: an
`off → on` tween (the host renders the leaving screen fading/flicking out, then the target in) gated by a
frame counter, then run the on-screen action at `finishTransition` (mirroring
`startTransition → continueTransition → finishTransition → goScreenFinished`). Default `#fade` (movieMaster
passes `#fade`); a `#flick` instant variant for overlays (`screenOn` uses `#flick`). Keep the FSM
unit-testable by allowing a `transitionFrames=0` test mode (instant) so the existing scene-FSM tests
don't need timing. The action (startGame/playCutscene/loadGame) fires **after** the transition completes
(it already does logically; now it's deferred by the tween instead of synchronous).

### K20 — Per-effect sound channels (`systems/audio.ts`)

Model the 8-channel mixer + 0–255 volume faithfully:
- **Volume.** Accept 0–255 (default `pDefaultVolume=150`); map to a 0..1 gain (`vol/255`). Keep the
  per-call `volume` arg (callers pass 0..1 today → accept both: ≤1 is a fraction, >1 is a 0–255 value;
  or migrate callers to 0–255). Music on its own channel (channel 1) with the existing restart-guard.
- **Channels.** Maintain `channels[2..8]` of active `BufferSource`s. `play()` picks `pNextChan`; if that
  channel is busy use the first empty (`SoundEmptyChan`); set its gain to the resolved volume;
  `VarChangeInRange(nextChan, 2, 8, 1)` round-robin advance. A new sound on a busy channel **overrides**
  the oldest (stop the old source) — bounding concurrency to 7 SFX (matches the original's fixed mixer,
  vs the port's current unbounded overlap).
- **Per-frame add-cap.** `checkadded`: at most **4** new sounds per frame (`newframe` resets the count);
  the 5th+ request in a frame is dropped — prevents the explosion-spam audio pileup the original guards.
- **Mute/enable persistence.** `pActive`/`pEnable` flags saved/restored (extend the save tree — the
  sound-slice save was deferred in G's notes). `isMenuItemShadowed(#soundOn/#soundOff)` greys the menu
  toggle (feeds K18/menu).

### K21 — Grave system (`components/grave.ts` + room grave records + save)

- **`Grave` component** (`modGrave`): on a `#grave`-capable actor (the data sets `#grave` anim/`graveOn`),
  on the death-finalize edge (the same edge E1's Reincarnate uses), if `graveOn` and not a ghost, call
  `roomManager.recordGrave(actorType, getGraveMember(), pos)`. (The `#grave` anim already exists —
  `anim.ts`.) Skip for `#ghost`.
- **Room grave records** (`modRoomGraves` → `RoomManager`): a `graves: Map<roomNum, GraveRecord[]>` where
  `GraveRecord = { actorType, member, x, y }`. `recordGrave` appends; on room enter, **draw** each grave
  as a static decal (blit the grave frame at its loc into a per-room grave layer, drawn UNDER live actors
  — `copyPixels` ink 36 → a `globalAlpha`-composited frame). Graves are **permanent** (never cleared on
  room re-enter; `reDrawGraves`). The port can't bake into a mutable room-background image cheaply, so
  draw the grave records each frame as a static decal pass (cached) — visually identical.
- **Save** (`modRoomGraves.addSaveData`): cascade `graves` into the save tree (per-room, like pState);
  `SAVE_VERSION` bump. A grave is a tiny `{actorType, x, y}` record (the member resolves from actorType's
  `#grave` strip), so cost is small. Reconcile with H3 pState: graves are a SEPARATE per-room map from
  pState (graves are decals, not live actors) — re-entry restores live actors (pState) **and** redraws
  graves.

### K22 — Collision / render edges

1. **AI one-way-platform drop-through.** Implement the `getAIPlatformDrop()` seam F2 left: a `#platform`
   cell's top edge does **not** block a downward AI mover that has requested a drop (a `Movement`/AI flag
   `wantsDrop`). Thread the flag into the edge solver's `#platform` one-way gate (the "was-above-last-
   frame" check already exists; add the drop-request bypass). **Support-only** (no shipped map has
   platforms) → ship behind the typed-tile path + a golden test; zero room-1 impact.
2. **Discrete layer-Z display list.** Replace the flat draw order with a `locz`-sorted display list using
   the global layer bands (`gMapLayer=1 … gGridSelectorLayer=250`): map → background-passive →
   background-active → graves → actors (by locz) → bullets → pickups → effects → foreground-passive (F2's
   over-actor band) → HUD/minimap. `Sprite` carries a `locz`; the renderer sorts by it. This subsumes
   the F3 `#foregroundPassive` special-case into the general order. Low risk (pure draw-order); golden:
   room-1 looks identical (its actors all sit in the actor band).
3. **Per-tile screen-exit ranges** (`modScreenExits`). Today `tryTransition` (`rooms.ts:214-217`) treats
   the **whole edge** as the exit. Parse per-edge exit **sub-ranges** from the room/map data (the door
   span) and only transition when the player crosses **within** the open sub-range. **Support-only**
   (verify no shipped map narrows an exit — the I/H maps use full-edge exits; if true, ship the
   range-gate behind a "has explicit exit range" data check, full-edge default unchanged → room-1
   byte-identical).
4. **Exit arrows.** When a room is cleared (exits open), draw an arrow glyph at each open edge's exit
   range (the on-screen "you can leave this way" marker). A small render pass keyed off
   `RoomManager.exitsOpen` + the open-edge set. Cosmetic; reachable in **every** map (every cleared room
   has open exits) — so unlike (1)/(3), exit arrows ARE exercised by shipped content.

---

## (c) Reachability — exercised by shipped content vs support-only

| Item | Reachability | Evidence |
|---|---|---|
| **K12 chatter** | **Exercised** | `stones1-5` placed ×2 maps each (I-plan §h); `scr_stones1-5` are real scripts. `stones6-10` placed in 0 maps → bundle-for-completeness (free via the generic loader). |
| **K14 beam render** | **Exercised** | `energyBeamSpell` placed ×4 maps (I-plan §h); the beam fires in-game — only its *render form* is the gap. |
| **K15 transColor** | **Exercised** | Every actor glows (low-health red / hit white-flick / heal gold / freeze teal) — fires constantly in room 1. The exact ramp/`#current` start is the gap. |
| **K16 prop/walkScroll/flash** | **Support-only** | Used 18/16/8/4/1 times across **all** shipped cutscene scripts (H1 table) — but NONE in intro/wasted/complete OR `scr_stones1-5` (verified: stones1 uses only wait/teleport/speak). So they're authored in scripts the port doesn't currently route content through; full-parity completeness, not a current playthrough. |
| **K17 per-actor fader** | **Exercised (behaviorally)** | `lightsUp`/`lightsDown` appear 29× each (H1 table) incl. the wasted/intro scenes the port plays — the shared-duration approximation is visibly active; per-actor fidelity refines a played path. |
| **K18 screen content** | **Mixed** | **credits** reachable (game-complete → credits); **showArmy**/**instructions**/**key-config** reachable via the ingame menu (H2 wired the overlays). **profile** = dev-only (out of scope, §g). |
| **K19 transition tweens** | **Exercised** | Every screen change (title→intro→game, game-over→reload, complete→credits) currently snaps; the tween refines a constantly-traversed path. |
| **K20 sound channels** | **Exercised** | SFX play continuously in room 1 (hits/spells/deaths); the channel cap + 4/frame guard + 0–255 volume govern audible behavior under load. |
| **K21 graves** | **Exercised** | Enemies die in **every** room (room 1 included) → graves should appear and persist on re-entry/save. Currently they vanish. |
| **K22.1 AI drop-through** | **Support-only** | 0/47 maps ship `#platform` tiles (F2 verified: 403 `#solid`/106 `#none`, zero others). Editor/AI-hook breadth + golden. |
| **K22.2 discrete-Z** | **Exercised** | Draw order affects every frame; room-1 must stay visually identical (golden). |
| **K22.3 exit ranges** | **Support-only** | Shipped maps use full-edge exits; range-gate behind a data check, full-edge default unchanged (golden). |
| **K22.4 exit arrows** | **Exercised** | Every cleared room opens exits → arrows show in every map. |

**Summary:** **Exercised:** K12, K14, K15, K17, K18(credits/showArmy/instructions/key-config),
K19, K20, K21, K22.2(Z-order), K22.4(arrows). **Support-only (build-for-completeness + golden, no shipped
content fires them):** K16 (prop/walkScroll/randomFlash verbs), K22.1 (platform drop-through), K22.3
(exit ranges). **Out of scope:** K18-profile (dev profiler).

---

## (d) Implementation order (grouped: cutscene/shell → render → audio)

Each step leaves `tsc` clean, tests green, and **room-1 clearing** (`playthrough_smoke` ends
`enemies:0, exitsOpen:true, errors:none`).

**Group 1 — cutscene / shell (K12, K16, K17, K18, K19):**
1. **K12 chatter cutscenes** (highest value, exercised) — bundle `scr_stonesN`, add `loadCutscene`,
   generalize `SceneManager.CutScene` to an arbitrary name + `playInGameCutScene` + default-finish→resume,
   wire the `Chatter` overlap trigger. The biggest single behavioral gain.
2. **K17 per-actor fader** — small, refines the already-played intro/wasted fade.
3. **K16 prop/walkScroll/randomFlash verbs** — completes the Thespian verb set (support-only; do after
   the engine touches in 1–2 are in).
4. **K19 transition tweens** — `SceneManager.goScreen` off→on tween (instant test mode preserved).
5. **K18 screen content** — credits (after 4 routes complete→credits), then showArmy/instructions/
   key-config overlays. Largest UI surface; do once the FSM/transition plumbing is solid.

**Group 2 — render (K15, K14, K21, K22):**
6. **K15 `objTransColor` exact tween + `#current` start** — pure component change; re-pin F3 ramp tests.
7. **K14 beam sprite-strip** — add per-sprite `scaleX`/anchor to `Sprite`+renderer; switch the beam path.
8. **K21 graves** — `Grave` component + room grave records + decal pass + save cascade.
9. **K22.2 discrete-Z display list** — sort sprites by `locz` (subsumes F3 foreground-passive); golden
   room-1 identical.
10. **K22.4 exit arrows** — render pass off `exitsOpen` (exercised).
11. **K22.1 platform drop-through** + **K22.3 exit ranges** — support-only seams behind data gates;
    golden tests only.

**Group 3 — audio (K20):**
12. **K20 per-effect sound channels** — 8-channel mixer + 0–255 volume + 4/frame cap + mute-persist;
    independent of all the above (single file `audio.ts` + a save slice + the K18 menu toggle).

> Groups are largely independent (cutscene/scenes vs renderer/anim/projectile/collision vs audio); K18
> depends on K19's transition plumbing; K14 depends on the `Sprite` scaleX add. Recommended sequence as
> numbered.

---

## (e) Test / verification plan + room-1 no-regression

**The pin (every step):** `playthrough_smoke` ends `enemies:0, exitsOpen:true, errors:none`; `tsc`
clean; no pageerrors. The collision/Z/audio changes must keep room-1 byte-identical where it's
solid-only (K22) or draw-order-stable (K22.2).

**Unit (vitest):**
- **K12:** `parseCutscene(scr_stones1)` yields the right `characters` (`m`→player, `u`→ulin) + line list
  (teleportInAt point, `#key #wizard` interpolation, teleportOut); `SceneManager.cutSceneFinished
  ("stones1")` returns to game (resume, no screen change); the `Chatter` overlap trigger fires once
  (`performed` latches), swaps to talkingMember, calls `playInGameCutScene`.
- **K14:** the beam bullet's `Sprite` carries `scaleX = beamDist+1` and `rotation = beamAngle`.
- **K15:** `flickWhite` ramps white→black over `100/33` steps (the original cadence); a `#current`-start
  glow begins from `lastColour` (not black) when chained; `getColourTransform` emits the literal
  `VarColRange` colour at sampled `pCurr`.
- **K16:** `produceProp`/`dropProp` link/unlink the prop (carried position tracks the carrier);
  `walkScrollRight` moves the actor continuously until `walkScrollStop`; `randomFlash` re-randomizes the
  bg target on each cycle.
- **K17:** `lightsDown` over 2 actors with different fade lengths completes (`pending` clears) only after
  **both** faders finish (the `pWaitingForPlayers→0` gate), not a fixed window.
- **K18:** showArmy paginates the reserve (rows wrap at width, pages at height; `nextPage` shadow guard);
  credits scroll-to-end ends the screen; key-config lists schemes + the active control→key table.
- **K19:** `goScreen` runs the on-screen action only after the transition frames elapse (and instantly in
  `transitionFrames=0` test mode — existing FSM tests unchanged).
- **K20:** `play` round-robins channels 2..8; the 8th concurrent SFX overrides the oldest; the 5th sound
  in one frame is dropped (4/frame cap); volume 255→full gain, 150→default; mute/enable save round-trip.
- **K21:** a killed actor records a grave in its room; the grave persists on leave→return (decal redrawn,
  not respawned as a live actor); the grave map save round-trips; a `#ghost` leaves no grave.
- **K22:** golden — room-1 + existing `collision_golden`/`world` pass UNCHANGED (solid-only path); a
  synthetic `#platform` map: a downward AI with `wantsDrop` falls through, without it lands; a narrowed
  exit range transitions only within the door span (full-edge maps unchanged); the `locz` sort produces
  the room-1 draw order identical to today (ordering assert).

**In-browser smoke:**
- **K12:** walk Merlin onto a `stones1` trigger in a map that places it → the stones cutscene plays
  in-game (ulin teleports in, dialogue auto-advances with the live `#key` glyphs), then resumes gameplay;
  re-touch → no replay (`performed`).
- **K14:** fire `energyBeamSpell` → a stretched/rotated beam **strip** from caster to target (not a thin
  line).
- **K15:** take a hit → a tweened white-flick (not a flat flash); low health → red pulse from the
  sprite's current colour.
- **K17:** the intro/wasted scenes fade actors individually.
- **K18:** finish a map (`?map=merliniii` endRoom) → game-complete cutscene → **credits scroll** → title;
  open the ingame menu → showArmy lists the summoned reserve; key-config switches scheme.
- **K19:** screen changes fade rather than snap.
- **K20:** spam spells in a crowded room → audio stays bounded (no pileup), volumes balanced; mute
  persists across save/load.
- **K21:** kill enemies in room 1, leave and return → graves are still there; save/load → graves persist.
- **K22:** every cleared room shows exit arrows; room-1 renders identically.

---

## (f) Risks

1. **K12 in-game cutscene over the live game (biggest).** A stones scene plays `#ingame` (no separate
   stage) driving the **live Merlin** + a spawned `ulin` while gameplay is paused. The Thespian was
   exercised only for full-stage `#cutScene` scenes (intro/wasted/complete). Risks: the player must bind
   (not respawn), combat must pause cleanly and resume at the exact state, the `#ingame` speech bubble
   (above-head) vs the `#cutScene` caption differs (`modThespian.displaySpeechInGame` vs `CutScene`).
   Mitigation: reuse H1's `bound:{m:player}` path, pause via the existing `SceneManager.pause`, render
   the bubble at the speaker's head; golden the stones-finish→resume.
2. **K15 ramp re-pinning.** Switching `t` from 0..255 to `pCurr` 0..100 changes the white-flick duration
   and every glow cadence — the F3 structural tests assert sampled strengths and WILL change. Mitigation:
   re-derive the expected values from the `VarColRange`/speed math and re-pin; verify the visual cadence
   matches the original's frame count (flick ≈ 3 frames).
3. **K20 concurrency model mismatch.** Web Audio has no fixed channels; emulating the 8-slot override +
   4/frame cap could clip legitimate overlapping SFX or, if too loose, not bound the pileup. Mitigation:
   match the original's exact caps (7 SFX channels, 4 new/frame), unit-test the round-robin/override, and
   keep music on its own path.
4. **K21 decal vs baked image.** The original bakes graves into a mutable room-background `image`; the
   port draws frames per-pass. A per-frame grave-decal pass (cached) is visually identical but a
   different mechanism — risk of Z-order or alpha mismatch (ink 36). Mitigation: draw graves in the
   K22.2 display list at the grave band (under actors), cache the static decal layer per room.
5. **K22 golden discipline.** The discrete-Z reorder and the platform/exit-range typed paths must not
   perturb the solid-only room-1 path. Mitigation (as F2): the typed/range paths are data-gated
   (`hasTypedTiles`/`hasExitRange`), the `locz` sort must reproduce today's order for the actor band —
   lock with the room-1 golden + an ordering assert BEFORE shipping.
6. **K18 credits text source.** The credits text member (`txt_credits`) and instructions strings must be
   extracted from the cast or authored from the real content — if not cleanly extractable, the screen is
   functionally faithful (scroll behavior) with the best-available text (note the residual content gap,
   not a flow gap).

---

## (g) Genuinely out of scope (justified)

- **`profileMaster`** — a **developer performance profiler** (`startProfile`/`stopProfile`/`writeReport`
  timing, `profileMaster.txt:1-50`), NOT a player-facing screen. It is listed in the task's screen set
  but is engine-not-game; no parity surface. (The task's "profile" overlay is the dev profiler, not a
  player profile screen — there is no player-profile screen in the cast.)
- **Map editor** (`mapEditMaster`, brush/tool palettes, `saveMap`) — a **separate executable**
  (`map_editor.exe`), already ruled out (README "Out of scope"). Maps are externally-authored data.
- **Copy protection** (`copyProtectionMaster`, `redirectMovie`, `updateCopyProtectionStatus`) —
  **disabled in the original itself** ("disabled due to problems on the Mac", `gameMaster.txt:17`); never
  a runtime path.
- **Net-loaded credits / `objNetRequest`** (`creditsMaster.requestCreditsText` server fetch) — the
  original falls back to the **local** `txt_credits` member when present (`:106-113`); the port ships the
  local text and skips the net path (no server, and the local member is the shipped default).
- **Full per-key REBINDING UI** (`keyChooseMaster`'s keyboard-capture remap) — the parity-meaningful bit
  is **choosing among the shipped key-sets** (arrows/wasd/zqsd/both) + the control→key description table
  (K18); arbitrary single-key capture/remap is a UI edge the port's scheme model doesn't need for
  playthrough parity. (Documented residual; not a flow gap.)
- **Per-effect sound *mixing* hardware quirks** (Director `puppetsound` channel semantics beyond
  count/volume/override) — the port reproduces the **observable** behavior (channel cap, 0–255 volume,
  4/frame guard, music restart-guard); exact Director mixer internals are not observable.

These are non-game (editor, profiler), disabled-in-original (copy protection), or unobservable engine
internals — faithful-as-is or correctly absent, consistent with the README's out-of-scope list.
