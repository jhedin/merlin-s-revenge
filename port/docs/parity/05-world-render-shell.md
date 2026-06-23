# Parity Audit 05 — World / Rooms, Render / Animation, Asset+Data Pipeline, Game Shell

Domain owner: agent 5 (world/rooms loading, rendering/animation, asset+data pipeline, game
shell — scenes/menus/flow/audio playback). Seams to agents 1–4 noted inline.

Grounded in: `casts/script_objects/*` (objMap, objRoom, objTileLayer, objTileSetKey,
objCollisionMap, objCollisionTile, modScreenExits, modCollisionDetection, modAnimSet, modSprite,
modColourTransform, modThespian, modMiniMap, objAnimSet, objAnimStrip, objMenu),
`casts/master_objects/*` (animStripMaster, soundMaster, cutSceneMaster, screenMaster, movieMaster,
spriteMaster), `extracted/{README.md,manifest.json,engine/scenes.json}`, and the port under
`port/src/{world,render,scenes,systems,data}`, `port/tools/{build_assets,parse_data}.ts`.

> **Framing (from project owner): maps are DATA, not code.** The audit below judges whether the
> loader/renderer/collision can faithfully *play any shipped map*, not whether more maps are
> "ported." The shipped maps (`maps/works/*.txt`, 47 files) are single-line Lingo prop-lists.

---

## Headline coverage for this domain: **~35%**

Sub-area rough weights (engineering surface): world/collision 30%, render/anim 30%, pipeline 20%,
shell/scenes/audio 20%.

| Sub-area | Coverage | One-line reason |
|---|---:|---|
| World / rooms / collision | ~55% | Loads 3-layer maps + flip-screen nav + **full per-edge collision tile-types (F2 ☑):** `#solid`/`#platform`/`#ceiling`/`#wallLeft`/`#wallRight` with per-edge merge, corner detection, directional events (`#solid`-only stays byte-identical, golden-locked); end-room + per-room state restore (H3 ☑). Missing: runtime exit-tile insertion |
| Render / animation | ~70% | z-sorted display list + regpoints + flip + **the real `modColourTransform` tint palette (F3 ☑):** glowRed/glowTeal/glowGold/glowRedAndTeal/flickWhite chained transforms via an offscreen cached tint pass (no getImageData); **per-frame anim `dela` + gGameSpeed + data-driven loop flag (F3 ☑)**; per-sprite alpha; `#foregroundPassive` over-actor pass; 5-state minimap + distance blend. Missing: discrete layer-Z model |
| Asset + data pipeline | ~90% | **Data** pipeline complete (263/263 actors parsed); **asset** pipeline complete (F1 ☑): all 10 tilesets, all 171 anim chars, all 47 maps + load-any-map, vocabulary-driven SFX. (No atlas — individual frame PNGs, no image lib available; atlasing dropped from F1 scope.) |
| Shell / scenes / menus / audio | ~65% | **H ☑:** `SceneManager` FSM (movieMaster/screenMaster/gameMaster — goScreen + cutSceneFinished dispatch + overlays) + data-driven `objMenu` (shadowed items) + SFX/music; **`Thespian` cutscene engine drives REAL actors** through Movement/Anim (31 verbs + speakLine, frame-timed lines, `#key`); faithful death->wasted->reload + extra-lives respawn. Screen-transition tweens + credits/showArmy/instructions/keyconfig CONTENT still absent (transitions wired, overlays stubbed) |

---

## 1. World / rooms / collision

`objMap` (room grid) → `objRoom` (ordered tile layers composited to one image) → `objTileLayer`
(tile grid + `modScreenExits`) → `objTileSetKey` (sheet slice + tile→symbol key) →
`objCollisionMap`/`objCollisionTile` (derived per-room collision grid). Port: `world/map.ts`,
`world/rooms.ts`, `world/collision.ts`, `data/tlk.ts`.

| Feature | Original behavior | Port status | Gap | Effort |
|---|---|---|---|---|
| Per-map room/map sizes | `#mapSize`/`#roomSize`/`#roomMapScale` read per map (16×9…64×64; mapSize→30×30) | **FAITHFUL** | `map.ts` reads `roomSize`/`mapSize` from data, computes view from them. `tilePx` now **resolved per-map from the active layer's tileset** (`TilePxFor` from the asset index), not hard-coded — 32 for all gameplay tlks, but a non-32 tileset would scale correctly (F1 ☑) | — |
| Layer set | objRoom doc lists `#backgroundPassive`, `#backgroundActive`(=solid), `#objects`, `#foregroundPassive` | **DONE (F3 ☑)** | Port handles passive/active/objects + **`#foregroundPassive` drawn OVER actors** (after `drawSprites`, at the front-layer blend 0.5). `RoomManager.foregroundSheet` resolves the layer's tileset; no shipped map ships a foreground layer (so it's the play-any-map path, structurally exercised) | — |
| Layer rendering order | objRoom.getScaleImage composites passive→active→objects into ONE room image; objects layer **not drawn in #activate mode** (real actors replace it) | **FAITHFUL-ish** | Port draws passive then active tile layers live each frame and spawns actors from the objects layer (never draws it) — matches behavior, different mechanism | — |
| Objects layer = spawn table | `#objects` tile→symbol via a *different* tlk key; `objTileLayer.activateActors` spawns one actor per non-`#none` tile at tile center | **FAITHFUL** | `rooms.ts spawnObjects` resolves via `objectsKey`, routes player/pickup/dwelling/unit. Pickups are a port abstraction (heal/speed/mana/etc.) rather than real actor spawns; some symbols hard-`SKIP_SPAWN`'d | S |
| tlk_ key parsing | comments (`--`) skipped without advancing index; `tileSize\|point()` directive; one symbol/line, 1-based | **FAITHFUL** | `tlk.ts` strips comments correctly (the off-by-N bug PLAN_REVIEW §3 warns of is avoided) | — |
| Collision tile types | objCollisionTile supports `#solid`, `#none`, `#ceiling`, `#platform`, `#wallLeft`, `#wallRight`; per-edge solidity, edge-merge between facing tiles, corner-tile detection (anti-diagonal-escape), platform one-way | **DONE (F2 ☑)** | `tlk.tileTypeNums` maps every type; `CollisionGrid` builds a derived **EdgeGrid** (4-bit edge mask + corner byte per cell) with per-edge merge (facing solid faces cancel, except bottom-over-platform) and corner detection. `#platform` is one-way (was-above-last-frame gate). The `#solid`-only path stays on the original swept-AABB resolver byte-identical (`hasTypedTiles` gates the typed path) — shipped maps (403 `#solid`/106 `#none`, zero others) are unaffected; the typed path plays an editor map with platform/ceiling/wall tiles. +14 golden tests | M |
| "Magic rect" broad-phase + per-axis push | objCollisionMap.selectTilesFromCollisionRect (4 corner tiles + magicRect) → objCollisionTile.calcOverlap per-edge; emits `collisionWallLeft/Right/Ceiling/Platform` events | **DONE (F2 ☑)** | The typed path picks the box's 4 corner cells (the magic-rect offset `tileSize−roomLocation` collapses to 0 at the port's world origin; +borderThickness is the 0-based grid's out-of-bounds border) and does per-edge `calcOverlap` push-out with the −1,−1 fudge. `moveBox` returns a directional **event set** (`wallLeft/Right/ceiling/platform/noPlatform`) dispatched as chain messages by `Movement`. The `#solid`-only golden stays green; consumers (reelFly-landing, AI scenic repath) are data-gated (no shipped map fires platform/noPlatform) | M |
| 2-tile solid border + runtime exit opening | collisionMap has a `borderThickness=2` solid frame; on room-clear, `openExits` **inserts the adjacent rooms' edge tiles into the border** (`modScreenExits.getScreenExitsForEdge` → `insertExitTiles`) so you walk through only where the neighbor has an opening | **DONE** | Per-tile bilateral exit mask: crossing is gated to the doorway tile-span the neighbor leaves open (RESWEEP-save-rooms verified `exitMask.right=[0,0,1,0,0,0]` — only the doorway row passable, not the whole edge) | — |
| Screen-exit ranges / arrows | modScreenExits computes exit *ranges* per edge from edge tiles; `drawExitArrows` draws green/red arrows keyed on surrounding-room hostility (`gExitArrows`) | **MISSING** | No exit-range computation, no on-map exit arrows | M |
| Flip-screen navigation | `objMap.moveRoom(dir)`: leave room → reposition to opposite edge, 128px boundary (`gMapBoundary`) | **FAITHFUL** | `RoomManager.update` transitions on edge crossing and repositions to opposite edge | — |
| Room-clear gating | objRoom.attemptOpenExits: exits open only when `teamMaster.isPlayerEnemiesDead`; plays `roomCleared` sound; rooms that start clear recognized as such | **FAITHFUL** | `RoomManager` gates exits behind `enemiesAlive()`, persists cleared rooms, fires `onMapClear` on full clear | — |
| End room / win condition | `#endRoom` loc; `objMap.isEndRoom`; map-clear = all rooms cleared → `gameMaster.gameEvent(#mapClear)` | **DONE (H3 ☑)** | `RoomManager.markCleared` fires on TWO triggers: clear-all (`isMapClear`) OR reach+clear the designated `#endRoom` (`isEndRoom`, parsed from the map; `#none`->undefined keeps clear-all-only). `merliniii (17,3)`/`mriiilongii (16,1)` now win on reaching their end room | S |
| Room save-state / freeze-restore | objRoom saves actor positions on exit (`saveState`), restores on re-entry (`restoreState`/`restoreRoomObjects`); graves persist (`modRoomGraves`) | **PARTIAL** | Port persists only "cleared" set (dead stay dead); does not restore live actor positions/HP, charging spells, graves, or army reserve. (Save/load *logic* is agent 4; the room re-entry replay is world's — note the seam) | M |
| Minimap | modMiniMap: 5-state per-room status (`#clr`,`#cur`,`#fre` friendly,`#inf` infested,`#spe` special), distance-based blend, status images, nav-mode toggle | **DONE (F3 ☑)** | `render/minimap.ts` is now **5-state**: `#cur` (current) > room-data `#fre`/`#spe` (parsed from `#miniMapStatus`; none ship) > `#inf` (live/visited-uncleared with hostiles) > `#clr`. The whole minimap fades by the **distance blend** `VarMapRange(min(player,cursor)dist, [60,200], [10,90])` as globalAlpha. Nav-mode toggle / mouse interaction stay out of scope (plan §G) | S–M |
| Zones (platform merge, ceiling shift) | objTileLayer.initZones/mergeZones/shiftZones builds collision zones (legacy side-on/Rapunzel engine) | **MISSING (intentional)** | Top-down Merlin maps don't use zones; safe to leave but note it's a real branch | — |

**Seam:** `teamMaster.isPlayerEnemiesDead` (room-clear test) is agent 4/2 territory; the port
approximates with `enemiesAlive()` over `game.entities`.

---

## 2. Render / animation

Port: `render/renderer.ts` (Canvas2D z-sorted display list), `render/assets.ts` (image load +
white-matte key-out), `components/anim.ts` (modAnimSet).

| Feature | Original behavior | Port status | Gap | Effort |
|---|---|---|---|---|
| Display list / draw order | `locZ`-sorted sprites (channel pool dropped); Z-layer globals `gMapLayer=1 … gGridSelectorLayer=250` | **PARTIAL** | Port z-sorts but uses `z = world-y` (painter's depth) for actors, not the engine's discrete Z-layer constants. Bullets/pickups/HUD drawn in fixed code order, not in the unified list. Works for the slice; a map relying on layer-Z (foreground/effects/text layering) would mis-order | M |
| Registration points | members positioned by regPoint (1,509/3,104 off-center) | **FAITHFUL** | `Sprite` carries `regX/regY`, drawn at `(x-regX, y-regY)`; flip mirrors about the anchor. Regpoints flow from `manifest.json reg:[x,y]` | — |
| Horizontal flip by facing | `SpriteGetFlipHAsDir` mirrors to face movement/aim | **FAITHFUL** | `anim.ts` sets `flip = facingLeft`; renderer mirrors about regpoint | — |
| Animation: mode→strip mapping | modAnimSet.getAnimSym: rich FSM (build→walk, fall→jump, landed/moveToLoc→walk, look→stand, dead/finish/reelSit→grave, walk→stand if idle, charge→chargeWalk when moving, release→releaseWalk, gmgOn→weaponMagic[Walk]) | **PARTIAL** | `anim.ts pickAction` handles dead→grave, moving→walk, else stand, plus a `animAction` override. Missing most transitions (charge/chargeWalk, release/releaseWalk, weaponMagic, build, fall/jump, look). Magic-weapon walk variants absent | M |
| Per-strip loop vs one-shot | objAnimStrip carries a **per-strip `looped`/`fin`** flag from data; `getFin = members.fin AND delay.fin` | **DONE (F3 ☑)** | The hard-coded `ONE_SHOT` set is retired: `build_assets.ts` records a per-anim `loop` flag and `anim.ts` reads `anim.loop` (data-overridable). The per-strip loop bool isn't cleanly recoverable from the cast (runtime counter state), so the flag is derived from the action classification and recorded as data — a single overridable table, not a code heuristic (plan §C.3.2; documented residual gap) | S |
| Per-frame tick delays | each frame has its own `#dela`; `objAnimStrip` counter scaled by `gGameSpeed` (ticks, not ms) | **DONE (F3 ☑)** | `anim.ts` advances on the **current frame's** `dela` (`assets.json` already records per-frame `dela`; 47 of 556 anims vary) and the counter steps by `gGameSpeed` (`game.gameSpeed`, default 1 — `pDelay.inc = 1*gGameSpeed`), in ticks not ms | — |
| Multi-strip / shared members | animStripMaster.seperateMembers: a member named `"a b c"` belongs to **multiple** strips (space-separated) | **PARTIAL** | `build_assets.ts` splits names by `_` only; the space-separated multi-strip membership is not reproduced (a handful of members; cosmetic for the slice) | S |
| Color tint / glow (`modColourTransform`) | full palette: `glowRed`/`glowTeal`/`glowRedAndTeal` (pingpong), `glowPink`→`fadeBlack`, `glowGold`→`fadeGoldBlack`, `pulseWhite`, `flashWhite`, `flickWhite`, chained `pNextTransform`, speed-tweened via `objTransColor` over the sprite's `color` | **DONE (F3 ☑)** | `components/colourTransform.ts` ports the whole palette as a per-entity component (start/target/speed/pingpong/chain), tweened per tick. Triggers wired: `Energy` glowRed-on-low-health (<50%, re-armed on `colourTransformFin`) + glowGold-on-heal + stopGlowRed; `Hurt` flickWhite on every non-lethal hit (retiring the binary flash); `Freeze` glowTeal; glowRed↔glowTeal promote to glowRedAndTeal. Renderer applies it via an **offscreen source-atop tint pass cached by quantized (image, colour, strength)** — NO per-frame getImageData. `objTransColor`'s exact tween curve is approximated linear (cosmetic, plan §G) | L |
| Alpha / blend levels | `blend`/`globalAlpha` per sprite; front-layer blend (`pFrontLayerBlendLevel=128`), speech-bg blend 80, minimap distance blend | **DONE (F3 ☑)** | `Sprite` carries `alpha` (set as `globalAlpha`); `drawTileLayer` takes an alpha (the `#foregroundPassive` front-layer draws at 0.5 = blend 128); the minimap fades by the distance-blend. WebGL tinting stays out of scope (canvas2d suffices, plan §G) | M |
| White-matte handling | extracted 32-bit BITDs are alpha-correct; matte was baked opaque white in some | **PORT-SPECIFIC** | `assets.ts keyOutMatte` flood-fills white from sprite borders / globally for sheets. A port workaround for the extraction, not an original feature; risk of eating legit white pixels (noted, border-flood mitigates) | — |
| Tile-sheet blit | `copyPixels(src, sx,sy,sw,sh)` per tile | **FAITHFUL** | `drawTileLayer` blits each non-zero tile from the sheet by `(n-1)` index | — |

**Seam (RESOLVED, F3 ☑):** which glow fires (hit=flick white, low-health=red, freeze=teal, heal=gold)
is driven by combat/status logic; the **playback** of those tints is now done by `ColourTransform` —
the triggers (`Energy`/`Hurt`/`Freeze`) call the palette methods directly on the component.

---

## 3. Asset + data pipeline

Two tools: `parse_data.ts` (Lingo → `generated/data.json`) and `build_assets.ts` (extracted casts
→ `public/assets/*` + `generated/assets.json`).

| Feature | Original / required | Port status | Gap | Effort |
|---|---|---|---|---|
| Lingo data grammar | prop-lists, lists, `[:]`/`[]`, symbols, strings, ints/floats (leading-dot), bools, `point`, `rgb`, `rect`, tagged `member()`/global/`random()` | **FAITHFUL** | `data/lingo.ts` covers all of these incl. `rect`, recursive tagged nodes, two-top-level-values (`parseDataFile`). Matches PLAN_REVIEW §3 | — |
| All actor/data records | 263 `act_*` + tem/bnd/tlk/scr/etc. (321 total) | **FAITHFUL** | `parse_data.ts` parses every non-scr/tlk record; `data.json` contains all 263 actors. The "blocking data-pipeline bug" (regpoints) is fixed upstream in extraction | — |
| Tilesets | 10 tlk_ tileset sheets shipped (`merlin`, `merlin4`, `merlinOpen`, `menu`) | **FAITHFUL** | `build_assets.ts` bundles **all 10** via longest-unique-prefix `tlk_<family><Layer>` match; per-tileset `tile`/`cols`/`keyFile` (32 gameplay, 16 menu). Verified in-browser: merlin / merlin4 / merlinOpen maps all render (F1 ☑) | — |
| Animations / chars | 2,211 `anm_*` members across **171 distinct chars** | **FAITHFUL** | All **171 chars / 556 anims** bundled (`seperateMembers` space-split honored; per-frame `reg` + `dela` recorded). `chars` index in `assets.json`; `spriteCharOr`'s `blackOrc` fallback kept only as a safety net (F1 ☑) | — |
| Sprite atlases | (F1 plan originally proposed atlases) | **N/A — descoped** | No image library (sharp/canvas/pngjs/jimp) in the environment and `public/assets/` is build-generated; atlasing dropped from F1. Frames stay individual PNGs (the renderer draws whole frames), loaded **lazily per map** so first paint stays fast. Atlasing can return as a perf item if needed | — |
| Maps | 47 shipped maps; loader should play any | **FAITHFUL** | Pipeline copies **all 47** to `maps/<id>.txt` + a `maps.json` manifest (`{id,name,folder,file,roomSize,mapSize,tilesets}`). `main.ts loadMap(id)` plays any of them (lazy `ensureMapAssets`); `?map=<id>` dev picker; default unchanged (F1 ☑) | — |
| Audio SFX | 29 SWA→WAV; keyed by effect name (`#attack.sound`, `collectSound`, `dieSound`) | **FAITHFUL** | All 29 copied; **vocabulary-driven** mapping: the closed logical-name set is scanned from `casts/data` (`#sound`/`#collectSound`/`#dieSound`) ∪ engine effects; each wav de-mangled and matched, warn-on-miss. All 29 land in the vocabulary (F1 ☑). soundMaster's per-effect channel-count/volume model is still collapsed (separate playback item) | S (playback only) |
| Music | 8 MP3s | **FAITHFUL** | All 8 copied, keyed by basename; `main.ts` references real names (`baroque_rock_v1`, `electronic_merlin_v1_02`, `last_stand_v4`) | — |
| Cutscene / keymap grammars | `scr_*` DSL + `bnd_*` keymaps need own parsers | **PARTIAL** | `data/cutscene.ts` parses scr DSL (subset of verbs); `bnd_*` Mac-vkey→`KeyboardEvent.code` translation is in input (agent-1/own seam) — only a few schemes wired | M |

---

## 4. Shell / scenes / menus / flow / audio playback

Port: `main.ts` (scene FSM + HUD), `scenes/menu.ts` (objMenu), `scenes/cutscenePlayer.ts`
(cutSceneMaster + modThespian), `systems/audio.ts` (soundMaster playback).

| Feature | Original behavior | Port status | Gap | Effort |
|---|---|---|---|---|
| Scene state machine | `scenes.json`: 16 Score markers (title, chooseKeys, chooseKeysMenu, 4 animScreen* cutscene hosts, gameScreen, ingameMenu, instructions, credits, showArmy, licence). `movieMaster.goScreen(sym,#fade)` composites snapshotted layouts; `screenMaster` runs flick/fade transitions | **DONE (H2 ☑)** | `scenes/sceneManager.ts` mirrors movieMaster/screenMaster/gameMaster: `goScreen(sym, action)` + `cutSceneFinished(scene)` dispatch (intro/wasted/complete each route differently) + overlay `screenOn`/`backAScreen` (ingameMenu/showArmy/instructions). Screens: title/controls/intro/game/gameOver/gameComplete/victory + overlays. Still stubbed: dedicated key-config/instructions/credits/showArmy CONTENT; screen-transition tweens are instant (F3 cosmetic) | M |
| Menus (`objMenu`) | menus built from text-definitions: `displayText | comm shadowedPrg`, tiled-bitmap backgrounds, dividers, **shadowed/disabled items** (`isMenuItemShadowed`), title image, fade-in, edit fields | **PARTIAL** | `scenes/menu.ts` is a clean keyboard list (up/down/confirm) used for title/pause. No bitmap-tiled background, dividers, shadowed items, title image, mouse, or fade. Menu content is hand-authored in `main.ts`, not loaded from the menu data definitions | M |
| Buttons | `objImageButton`/`objTextButton`, `buttClicked`→`movieMaster.buttClicked`/`goScreenAction` | **DONE (H2 ☑)** | `objMenu` items are now data-driven records (`{label, action, shadowed?}`) with shadowed/unselectable support (`isMenuItemShadowed` — Save greys while a cutscene plays). Bitmap button art is render fidelity, not flow | S |
| Start / win / lose / death | gameMaster + movieMaster: intro→game; death→`animScreenGameOver`+`gGameOverScript`; win→`animScreenEnd`+`gGameCompleteScript`; respawn/reincarnate/wasted flow | **DONE (H2 ☑)** | Faithful: intro cutscene→game; death `#die`→`modExtraLives.attemptRespawn` (lives>0 → in-place respawn) ELSE `gameOver`→**wasted cutscene** (real Merlin, `goWastedMode`)→**reload save** (NOT a fresh restart); full-clear/endRoom→**game-complete cutscene**→victory. `extraLives.ts`/`wasted.ts` added | M |
| Cutscene engine | cutSceneMaster + modThespian **drive real actors through their modules**: ~30 verbs (`walkTo`/`moveToLoc`, `enter/exitStageLeft/Right`, `teleportInAt/Out`, `produceProp`/`carryProp`/`dropProp`/`putAwayProp`, `goMode`, `goWastedMode`, `fadeDown`, `turnToFace`, `atPlayer`/`walkToPlayer`), frame-timed line display (`displayTime`/`delayTime`), `#key` variable interpolation, in-game vs cutscene speech, background flash/colour-to, lights, title, music/sound, wait timer, skip | **DONE (H1 ☑)** | `scenes/thespian.ts` is a faithful `Thespian` that **drives REAL spawned entities** through the gameplay `Movement`/`Anim` (walkTo→walk anim, goMode/goWastedMode, enter/exitStage, teleportIn/Out, turnToFace, atPlayer/walkToPlayer, backgroundColourTo/lights/fade, showTitle, playSound/Music, wait), frame-timed auto-advancing lines (`50 + chars·1.4` + delay 12), `#key` interpolation, skip. Prop/walkScroll/random-flash verbs staged behind the core path (plan §f.1; unused by the shipped intro/wasted/complete). `cutscenePlayer.ts` is a thin host | L |
| Audio playback | soundMaster: per-effect channel counts, default volume 150, `checkRestartMusic` ("don't restart same music"), volume 0–255→adjust, music on channel 1 | **PARTIAL/FAITHFUL** | `systems/audio.ts`: Web Audio SFX buffers (overlapping voices), looping `<audio>` music, mute, **"don't restart same music"** honored (`currentMusic === name`), unlock-on-gesture. Missing: per-effect channel limits, 0–255 volume scaling from data, positional/auto sound (`pAutoSound`). Adequate for playback parity | S |
| HUD / bars | objMulticolourEnergyBar, characterEnergyRollOver, magic charge feedback | **PARTIAL (port abstraction)** | `main.ts` draws HP/XP bars, charge ring, enemy/ally bars, freeze overlay directly — not the original bitmap bars. Functional, not faithful art | S |

**Seam (agent 4):** `soundMaster`'s game-logic role (which sound for which event, save of audio
prefs) is agent 4; the **playback** layer above is this domain and is in reasonable shape.

---

## 5. The real "play any map" gap — features the loader does NOT yet support

For maps as data, the loader/renderer/collision currently **cannot** faithfully play a shipped or
editor-authored map that uses any of:

1. **Non-`#solid` collision tile types** — `#platform` (one-way), `#ceiling`, `#wallLeft`,
   `#wallRight`. Collision treats only `#solid` as blocking and emits no directional collision
   events. (Shipped `*Active` tlks happen to use only `#solid`/`#none`, so today's maps survive —
   but the engine and editor support the others.)
2. **A `#foregroundPassive` layer** — `parseMap`/render only know passive/active/objects; an
   over-actor foreground layer is dropped.
3. **Per-tile screen-exit ranges** — exits open per whole-edge boolean, not gated to the tile
   spans the neighboring room actually leaves open (`modScreenExits` exit-range insertion). Exit
   arrows are absent entirely.
4. **`#endRoom` win condition** — a map that wins on *reaching* a designated end room (vs clearing
   every room) is mis-scored.
5. ~~**Tilesets other than `merlin4`**~~ — RESOLVED (F1 ☑): all 10 sheets bundled; merlin / merlin4 /
   merlinOpen maps verified rendering in-browser.
6. ~~**Per-map tile sizes ≠ 32**~~ — RESOLVED (F1 ☑): `tilePx` resolved per-map from the tileset's
   `tile` (32 gameplay, 16 menu); a non-32 gameplay tileset would scale correctly.
7. **Live room-state restore** — re-entering a partially-fought room respawns it fresh (only the
   binary cleared/uncleared persists); actor positions, graves, and reserve units are lost.
8. **Variable per-frame animation delay & data-driven loop flags** — uniform-per-strip delay and a
   heuristic one-shot set; faithful for bundled chars, not general.

The loader/nav/tlk-parsing core is sound; the gaps are **collision tile-type breadth, foreground
layer, exit-range fidelity, end-room, and the asset bundle.**

---

## 6. Prioritized build targets

1. ~~**Complete the asset pipeline (M).**~~ DONE (F1 ☑). All 10 tilesets + all 171 anim chars + all
   47 maps now bundle, with lazy per-map loading (`ensureMapAssets`) and load-any-map (`?map=<id>`),
   and the SFX mapping is vocabulary-driven (no lossy regex). Atlasing was descoped (no image lib in
   the environment; frames stay individual PNGs — the renderer draws whole frames). This makes "load
   whatever the data ships" real and unblocks D1 (per-enemy sprites).
2. **Collision tile-type breadth + directional events (M).** Add `#platform`/`#ceiling`/`#wall*`
   handling and emit `collisionWall/Ceiling/Platform` so any editor-authored map plays; keep golden
   tests. Faithful-first per PLAN §5 (the solver is bespoke/partly-not-understood).
3. **Cutscene engine over real actors (L).** Replace the standalone `cutscenePlayer` with a
   modThespian-style driver that runs the *real* actor archetypes (walkTo→walk anim, goMode, props,
   frame-timed lines, `#key` interpolation). This is the explicit PLAN §6 contract and gates the
   game-over / game-complete / wasted flows.

Runner-ups: foreground layer + per-tile exit ranges + exit arrows + `#endRoom` (S–M each, all
"play any map" fidelity); `modColourTransform` tint palette (L) for combat/status feel; minimap
status states + blend (S–M); scene transitions + data-driven menus/credits/instructions/showArmy (M).

## 7. Faithfulness risks

- **Collision divergence (highest).** AABB push-out vs the original per-edge/corner/magic-rect
  solver — different contact resolution, no one-way platforms, no directional events. Gameplay feel
  and any platform map break. Golden-test against original positions before refactoring.
- **Whole-edge exits.** Letting the player cross anywhere along a cleared edge (vs the neighbor's
  exit tile span) changes where you appear and can place the player inside walls.
- **Tint/glow absence.** Hit/freeze/level-up/invince feedback is reduced to a white flash — visible
  parity loss; the per-frame `color` tween is a known Canvas2D cost trap (getImageData banned).
- **Lossy SFX name mapping.** Heuristic suffix stripping may silently mis-key `#attack.sound`, so
  the wrong (or no) sound plays for some attacks.
- **Cutscene re-impl drift.** Because it doesn't drive real actors, any cutscene using props,
  goMode, or movement won't match; only the bundled intro is verified.

## 8. Map editor — recommendation: **OUT of scope.**

`map_editor_open_40_*.exe/.dir` is a **separate executable** from the game engine
(`merlin_engine_76`/`merlin_open.exe`). `readme.txt` confirms the workflow: *"double click
merlin_open.exe to play … or map_editor.exe to edit … Don't do both at once."* `mapEditMaster` and
its `objMenu` references live only in the editor's cast; **no game master (movieMaster, gameMaster,
screenMaster) references it.** Maps are authored externally and ship as data. Therefore the editor
(`mapEditMaster`, tool/command palettes, grid selectors, brushes, `saveMap`) is **dev tooling, not
part of "the game" for parity** — exclude it. (If level-authoring is ever wanted in-browser it'd be
a standalone tool built on the same loader, not a parity requirement.)
