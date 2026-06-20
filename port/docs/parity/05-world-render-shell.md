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
| World / rooms / collision | ~30% | Loads 3-layer maps + flip-screen nav + `#solid` AABB; missing zone tile-types, runtime exit-tile insertion, foreground layer, end-room, minimap status, save-state restore |
| Render / animation | ~35% | z-sorted display list + regpoints + flip + binary hit-flash; missing the whole `modColourTransform` tint palette, per-frame anim delays, per-strip loop flags, blend/alpha, layer-Z model |
| Asset + data pipeline | ~45% | **Data** pipeline complete (263/263 actors parsed); **asset** pipeline is a vertical-slice copier: 3 of 10 tilesets, ~26 of 171 anim chars, 1 of 47 maps, no atlas, lossy sound-name mangling |
| Shell / scenes / menus / audio | ~35% | Title/pause/gameover/victory FSM + keyboard menu + SFX/music playback; cutscene engine is a standalone re-impl (not driving real actors); 12+ scene markers, button-DSL menus, transitions, showArmy/credits/instructions/keyconfig absent |

---

## 1. World / rooms / collision

`objMap` (room grid) → `objRoom` (ordered tile layers composited to one image) → `objTileLayer`
(tile grid + `modScreenExits`) → `objTileSetKey` (sheet slice + tile→symbol key) →
`objCollisionMap`/`objCollisionTile` (derived per-room collision grid). Port: `world/map.ts`,
`world/rooms.ts`, `world/collision.ts`, `data/tlk.ts`.

| Feature | Original behavior | Port status | Gap | Effort |
|---|---|---|---|---|
| Per-map room/map sizes | `#mapSize`/`#roomSize`/`#roomMapScale` read per map (16×9…64×64; mapSize→30×30) | **FAITHFUL** | `map.ts` reads `roomSize`/`mapSize` from data, computes view from them. `tilePx` hard-coded to 32 (tlk says `tileSize|point(32,32)` — true for all gameplay tlks but menu tlk is 16) | — |
| Layer set | objRoom doc lists `#backgroundPassive`, `#backgroundActive`(=solid), `#objects`, `#foregroundPassive` | **PARTIAL** | Port handles passive/active/objects; **`#foregroundPassive` (over-actor layer) is silently dropped** by `parseMap` if a map ships one (shipped works/* maps don't, but the loader can't play one that does) | S |
| Layer rendering order | objRoom.getScaleImage composites passive→active→objects into ONE room image; objects layer **not drawn in #activate mode** (real actors replace it) | **FAITHFUL-ish** | Port draws passive then active tile layers live each frame and spawns actors from the objects layer (never draws it) — matches behavior, different mechanism | — |
| Objects layer = spawn table | `#objects` tile→symbol via a *different* tlk key; `objTileLayer.activateActors` spawns one actor per non-`#none` tile at tile center | **FAITHFUL** | `rooms.ts spawnObjects` resolves via `objectsKey`, routes player/pickup/dwelling/unit. Pickups are a port abstraction (heal/speed/mana/etc.) rather than real actor spawns; some symbols hard-`SKIP_SPAWN`'d | S |
| tlk_ key parsing | comments (`--`) skipped without advancing index; `tileSize\|point()` directive; one symbol/line, 1-based | **FAITHFUL** | `tlk.ts` strips comments correctly (the off-by-N bug PLAN_REVIEW §3 warns of is avoided) | — |
| Collision tile types | objCollisionTile supports `#solid`, `#none`, `#ceiling`, `#platform`, `#wallLeft`, `#wallRight`; per-edge solidity, edge-merge between facing tiles, corner-tile detection (anti-diagonal-escape), platform one-way | **PARTIAL / FAITHFUL-for-shipped** | Port `solidTileNums` treats **only `#solid`** as collidable + plain AABB push-out. Shipped active tlks contain only `#solid`/`#none` (verified: 403 `#solid`, 106 `#none`, zero platform/ceiling/wall), so this is faithful **for shipped maps** but **cannot play a map authored with platform/ceiling/wall tiles** (the editor and engine support them) | M |
| "Magic rect" broad-phase + per-axis push | objCollisionMap.selectTilesFromCollisionRect (4 corner tiles + magicRect) → objCollisionTile.calcOverlap per-edge; emits `collisionWallLeft/Right/Ceiling/Platform` events | **PARTIAL** | Port does axis-separated swept AABB with flush snap (golden-tested), but emits no directional collision events and has no platform/ceiling semantics. Source itself "doesn't fully understand the magic rect" — flagged for golden parity | M |
| 2-tile solid border + runtime exit opening | collisionMap has a `borderThickness=2` solid frame; on room-clear, `openExits` **inserts the adjacent rooms' edge tiles into the border** (`modScreenExits.getScreenExitsForEdge` → `insertExitTiles`) so you walk through only where the neighbor has an opening | **PARTIAL** | Port models exits as boolean `open` edges (whole edge passable once room cleared + neighbor exists). **Does not honor per-tile exit ranges** — original gates exits to the specific tile spans the neighbor's edge leaves open; port lets you cross anywhere along a cleared edge | M |
| Screen-exit ranges / arrows | modScreenExits computes exit *ranges* per edge from edge tiles; `drawExitArrows` draws green/red arrows keyed on surrounding-room hostility (`gExitArrows`) | **MISSING** | No exit-range computation, no on-map exit arrows | M |
| Flip-screen navigation | `objMap.moveRoom(dir)`: leave room → reposition to opposite edge, 128px boundary (`gMapBoundary`) | **FAITHFUL** | `RoomManager.update` transitions on edge crossing and repositions to opposite edge | — |
| Room-clear gating | objRoom.attemptOpenExits: exits open only when `teamMaster.isPlayerEnemiesDead`; plays `roomCleared` sound; rooms that start clear recognized as such | **FAITHFUL** | `RoomManager` gates exits behind `enemiesAlive()`, persists cleared rooms, fires `onMapClear` on full clear | — |
| End room / win condition | `#endRoom` loc; `objMap.isEndRoom`; map-clear = all rooms cleared → `gameMaster.gameEvent(#mapClear)` | **PARTIAL** | Port wins when `cleared.size >= rooms.size` (all rooms). **`#endRoom` ignored** — a map that wins on reaching a designated end room (not clearing all) plays wrong | S |
| Room save-state / freeze-restore | objRoom saves actor positions on exit (`saveState`), restores on re-entry (`restoreState`/`restoreRoomObjects`); graves persist (`modRoomGraves`) | **PARTIAL** | Port persists only "cleared" set (dead stay dead); does not restore live actor positions/HP, charging spells, graves, or army reserve. (Save/load *logic* is agent 4; the room re-entry replay is world's — note the seam) | M |
| Minimap | modMiniMap: 5-state per-room status (`#clr`,`#cur`,`#fre` friendly,`#inf` infested,`#spe` special), distance-based blend, status images, nav-mode toggle | **PARTIAL** | `main.ts drawMinimap` draws a 3-state grid (current / exists / empty). No friendly/infested/special status, no blend, no real `miniMapMaster`/status images | S–M |
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
| Per-strip loop vs one-shot | objAnimStrip carries a **per-strip `looped`/`fin`** flag from data; `getFin = members.fin AND delay.fin` | **PARTIAL** | Port hard-codes a `ONE_SHOT` string set in `anim.ts`. Mostly right for the bundled chars but not data-driven; a strip whose loop flag differs from the heuristic plays wrong | S |
| Per-frame tick delays | each frame has its own `#dela`; `objAnimStrip` counter scaled by `gGameSpeed` (ticks, not ms) | **PARTIAL** | `build_assets.ts` records **one `delay` per anim** (token 3 of the member name) and `anim.ts` uses a uniform delay. For shipped strips the delay token is uniform per strip, so usually OK; **true per-frame delay variation is lost**, and `gGameSpeed` scaling is not applied | S–M |
| Multi-strip / shared members | animStripMaster.seperateMembers: a member named `"a b c"` belongs to **multiple** strips (space-separated) | **PARTIAL** | `build_assets.ts` splits names by `_` only; the space-separated multi-strip membership is not reproduced (a handful of members; cosmetic for the slice) | S |
| Color tint / glow (`modColourTransform`) | full palette: `glowRed`/`glowTeal`/`glowRedAndTeal` (pingpong), `glowPink`→`fadeBlack`, `glowGold`→`fadeGoldBlack`, `pulseWhite`, `flashWhite`, `flickWhite`, chained `pNextTransform`, speed-tweened via `objTransColor` over the sprite's `color` | **MISSING** | Port does only a **binary white hit-flash** (`whiten()` source-atop). None of the colored glows / tweens / chained transforms / per-frame `color` animation exist. PLAN §2.5 prescribes composite-op `multiply` + quantized-tint cache; not built | L |
| Alpha / blend levels | `blend`/`globalAlpha` per sprite; front-layer blend (`pFrontLayerBlendLevel=128`), speech-bg blend 80, minimap distance blend | **MISSING** | Renderer has no per-sprite alpha/blend; `Sprite` has no `blend`. Several effects (fades, ghost monk, transparency) depend on it | M |
| White-matte handling | extracted 32-bit BITDs are alpha-correct; matte was baked opaque white in some | **PORT-SPECIFIC** | `assets.ts keyOutMatte` flood-fills white from sprite borders / globally for sheets. A port workaround for the extraction, not an original feature; risk of eating legit white pixels (noted, border-flood mitigates) | — |
| Tile-sheet blit | `copyPixels(src, sx,sy,sw,sh)` per tile | **FAITHFUL** | `drawTileLayer` blits each non-zero tile from the sheet by `(n-1)` index | — |

**Seam:** which glow fires (hit=red, freeze=teal, level-up=gold, invince=pulse) is driven by
combat/status logic (agents 3/4); the **playback** of those tints is this domain and is missing.

---

## 3. Asset + data pipeline

Two tools: `parse_data.ts` (Lingo → `generated/data.json`) and `build_assets.ts` (extracted casts
→ `public/assets/*` + `generated/assets.json`).

| Feature | Original / required | Port status | Gap | Effort |
|---|---|---|---|---|
| Lingo data grammar | prop-lists, lists, `[:]`/`[]`, symbols, strings, ints/floats (leading-dot), bools, `point`, `rgb`, `rect`, tagged `member()`/global/`random()` | **FAITHFUL** | `data/lingo.ts` covers all of these incl. `rect`, recursive tagged nodes, two-top-level-values (`parseDataFile`). Matches PLAN_REVIEW §3 | — |
| All actor/data records | 263 `act_*` + tem/bnd/tlk/scr/etc. (321 total) | **FAITHFUL** | `parse_data.ts` parses every non-scr/tlk record; `data.json` contains all 263 actors. The "blocking data-pipeline bug" (regpoints) is fixed upstream in extraction | — |
| Tilesets | 10 tlk_ tileset sheets shipped (`merlin`, `merlin4`, `merlinOpen`, `menu`) | **PARTIAL** | `build_assets.ts` bundles **only 3** (`merlin4` passive/active/objects). A map using `merlin`/`merlinOpen`/`menu` tilesets has no sheet → blank render | S |
| Animations / chars | 2,211 `anm_*` members across **171 distinct chars** | **PARTIAL** | Hard-coded `CHARS` list of ~26 → **125 anims** in `assets.json`. Unbundled actors fall back to `blackOrc` stand-in (`spriteCharOr`). Not "load any actor's anims" | M |
| Sprite atlases | PLAN §4: pre-bake atlases + manifest | **MISSING** | No atlas baking — each frame is copied as an individual PNG (`public/assets/*.png`). Works, but hundreds of draw-images and HTTP loads; not the planned packed atlas | M |
| Maps | 47 shipped maps; loader should play any | **PARTIAL** | Pipeline copies **one** map (`descent_into_darkness`) to `map.txt`. The *loader* is the parity unit (see §1); the pipeline just stages one. No map-selection / "play any of the 47" path | S (staging) |
| Audio SFX | 29 SWA→WAV; keyed by effect name (`#attack.sound`, `collectSound`, `dieSound`) | **PARTIAL** | All 29 copied, but `sfxName()` strips index prefix **and** trailing capital-letter suffixes with regexes — **lossy/heuristic**; some `#attack.sound` keys may not match. soundMaster's per-effect channel-count + default-volume model is collapsed | S–M |
| Music | 8 MP3s | **FAITHFUL** | All 8 copied, keyed by basename; `main.ts` references real names (`baroque_rock_v1`, `electronic_merlin_v1_02`, `last_stand_v4`) | — |
| Cutscene / keymap grammars | `scr_*` DSL + `bnd_*` keymaps need own parsers | **PARTIAL** | `data/cutscene.ts` parses scr DSL (subset of verbs); `bnd_*` Mac-vkey→`KeyboardEvent.code` translation is in input (agent-1/own seam) — only a few schemes wired | M |

---

## 4. Shell / scenes / menus / flow / audio playback

Port: `main.ts` (scene FSM + HUD), `scenes/menu.ts` (objMenu), `scenes/cutscenePlayer.ts`
(cutSceneMaster + modThespian), `systems/audio.ts` (soundMaster playback).

| Feature | Original behavior | Port status | Gap | Effort |
|---|---|---|---|---|
| Scene state machine | `scenes.json`: 16 Score markers (title, chooseKeys, chooseKeysMenu, 4 animScreen* cutscene hosts, gameScreen, ingameMenu, instructions, credits, showArmy, licence). `movieMaster.goScreen(sym,#fade)` composites snapshotted layouts; `screenMaster` runs flick/fade transitions | **PARTIAL** | `main.ts` has title / cutscene / playing / paused / gameover / victory. Missing: dedicated key-config screen, instructions, credits, showArmy roster, licence; no screen transitions (`#fade`/`#flick`). The 3 dead markers (`3DMode`,`New Marker`,`initMap`) correctly N/A | M |
| Menus (`objMenu`) | menus built from text-definitions: `displayText | comm shadowedPrg`, tiled-bitmap backgrounds, dividers, **shadowed/disabled items** (`isMenuItemShadowed`), title image, fade-in, edit fields | **PARTIAL** | `scenes/menu.ts` is a clean keyboard list (up/down/confirm) used for title/pause. No bitmap-tiled background, dividers, shadowed items, title image, mouse, or fade. Menu content is hand-authored in `main.ts`, not loaded from the menu data definitions | M |
| Buttons | `objImageButton`/`objTextButton`, `buttClicked`→`movieMaster.buttClicked`/`goScreenAction` | **PARTIAL** | Menu items are JS closures, not data-driven button records | S |
| Start / win / lose / death | gameMaster + movieMaster: intro→game; death→`animScreenGameOver`+`gGameOverScript`; win→`animScreenEnd`+`gGameCompleteScript`; respawn/reincarnate/wasted flow | **PARTIAL** | Port: title→intro cutscene→playing; death→gameover overlay (restart on space); full-clear→victory overlay. **No game-over / game-complete cutscenes, no wasted/reincarnate/respawn flow** (the death-cutscene `cut_scene_to_play_when_wasted` etc. unused) | M |
| Cutscene engine | cutSceneMaster + modThespian **drive real actors through their modules**: ~30 verbs (`walkTo`/`moveToLoc`, `enter/exitStageLeft/Right`, `teleportInAt/Out`, `produceProp`/`carryProp`/`dropProp`/`putAwayProp`, `goMode`, `goWastedMode`, `fadeDown`, `turnToFace`, `atPlayer`/`walkToPlayer`), frame-timed line display (`displayTime`/`delayTime`), `#key` variable interpolation, in-game vs cutscene speech, background flash/colour-to, lights, title, music/sound, wait timer, skip | **PARTIAL** | `cutscenePlayer.ts` is a **standalone presentational re-implementation** (draws each actor's `stand` frame at a ground line, advances dialogue on space). Implements ~10 verbs (at/enter/exit/teleport/turnToFace/backgroundColourTo/lights/showTitle/wait). **Does NOT drive real actors through modThespian** (PLAN §6 "cutscene engine drives real actors"): no walkTo animation, no props, no goMode/goWastedMode, no frame-timed auto-advance, no `#key` interpolation, no per-actor real movement. Only the bundled intro plays | L |
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
5. **Tilesets other than `merlin4`** — `merlin`, `merlinOpen`, `menu` sheets aren't bundled, so a
   map referencing them renders blank (asset-pipeline gap, not loader logic).
6. **Per-map tile sizes ≠ 32** — `tilePx` is hard-coded 32 (true for all gameplay tlks; the menu
   tlk is 16). A future 16px or mixed tileset would mis-blit.
7. **Live room-state restore** — re-entering a partially-fought room respawns it fresh (only the
   binary cleared/uncleared persists); actor positions, graves, and reserve units are lost.
8. **Variable per-frame animation delay & data-driven loop flags** — uniform-per-strip delay and a
   heuristic one-shot set; faithful for bundled chars, not general.

The loader/nav/tlk-parsing core is sound; the gaps are **collision tile-type breadth, foreground
layer, exit-range fidelity, end-room, and the asset bundle.**

---

## 6. Prioritized build targets

1. **Complete the asset pipeline (M).** Bundle all 10 tilesets and all 171 anim chars (or generate
   on demand), bake atlases, and fix the lossy SFX name mapping. This is the single biggest lever:
   it's what makes "load whatever the data ships" real for art, and unblocks rendering any map/actor.
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
