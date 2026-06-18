# Merlin's Revenge — Lingo → TypeScript/HTML5 Porting Plan

Status: **planning**. This document is the master plan and roadmap for porting the
Director/Lingo engine to a modern TypeScript/HTML5 game. It is synthesized from a full
read of the runtime Lingo source (`casts/`), the decompiled engine (`extracted/engine/scripts/`),
and the extracted assets/scene model (`extracted/`).

---

## 0. Bottom line up front

- **Overall difficulty: HIGH, but de-risked.** The hard part of most Director ports — gameplay
  smeared across a Score timeline with tweens and frame scripts — **does not exist here**. The
  movie runs off a single pinned frame; all logic is data-driven Lingo we already have as
  readable text, and all art/audio is already extracted.
- **The whole port hinges on two things:** (1) faithfully translating the **module-mixin object
  system + its dispatch semantics** into a TypeScript component model, and (2) a **data pipeline**
  that parses the Lingo property-list content into typed game data. Get those two right and the
  rest is largely mechanical, subsystem-by-subsystem work.
- **Strategy: reimplement, don't transpile.** Do **not** auto-translate Lingo. Re-architect into
  idiomatic TS (entity/component + systems), porting each module's *logic* by hand while preserving
  the exact dispatch order and the data semantics. The loose `casts/` source is the authoritative
  spec; the decompiled `extracted/` scripts fill gaps (movie-level scripts, the global helper
  library) and serve as a cross-check.
- **Approach: thin vertical slice first.** Build the kernel + render + one room + player + one enemy
  + one weapon end-to-end before breadth. Everything else layers on top of that spine.

---

## 1. Target stack & project layout

| Concern | Choice | Why |
|---|---|---|
| Language | **TypeScript** (strict) | type the data records + component contracts |
| Build/dev | **Vite** | fast HMR, zero-config TS, simple static build |
| Rendering | **Canvas 2D** (`drawImage`) behind a `Renderer` interface | the engine is a z-sorted 2D sprite compositor; Canvas2D maps 1:1. Keep it abstracted so a WebGL/Pixi batch renderer can be swapped in later for the per-frame `color` tint effects |
| Audio | **Web Audio API** | unlimited voices; replaces the 8-channel `puppetsound` model |
| ECS | **custom, lightweight** (Entity + component map + `broadcast`/`query`) | a generic ECS lib won't reproduce the ordered first-match dispatch semantics we must preserve |
| Game loop | **fixed 30 Hz logical tick** + `requestAnimationFrame` render, decoupled | the original is tick-based (counters scaled by `gGameSpeed`), *not* wall-clock |
| Data | **build-time Lingo→JSON parser** + runtime resolver | data files are Lingo literals (with a few embedded expressions); parse once, resolve `#inherit`/registry at runtime |
| Tests | **Vitest** + deterministic tick-replay golden tests | lock in parity for combat math, collision, leveling |

No heavyweight game framework (Phaser/etc.) — the engine brings its own architecture and a
framework would fight it. Keep dependencies minimal.

```
/src
  /engine        kernel: Entity, Component, dispatch, EventBus, Relationships, Updater, loop
  /render        Renderer interface, Canvas2D impl, sprite/display-list, animation player
  /data          Lingo parser (build-time CLI) + runtime registry/resolver + generated types
  /world         Map, Room, TileLayer, TileSet, Collision (tile solver), zones, screen-exits
  /components    ported mod* modules (one file each)
  /entities      archetype factories (objBullet, objCharacter, … → component lists)
  /systems       input, AI, combat resolution, teams, spawning, save/load
  /scenes        screen state machine (scenes.json), menus, cutscene engine
  /game          GameInitGlobals config, boot sequence, masters (object pool, teams, sound…)
/assets          converted PNG atlases + manifests + transcoded audio + maps.json
/tools           asset/data conversion scripts (extends extracted/tools/)
/data            generated JSON (records, schemas, scenes, key bindings)
```

---

## 2. The engine kernel (the centerpiece)

### 2.1 Object model translation

The Lingo system is a single linear `ancestor` chain with a **module (mixin) layer woven into it**
at construction. It encodes two separable things — collapse them differently:

- **Concrete `obj*` leaf** (`objBullet`, `objPlayerMerlinCharacter`, …) → an **Entity**:
  `{ id, type, flags:Set, components:Map<Ctor, Component> }`. The Lingo `me.big` / `me.ID.bigMe`
  "virtual self" back-pointer collapses to *the entity itself* — there is only one object now.
- **Each `mod*` module** → a **Component class** with the same `pX` data and `on foo` handlers.
  The per-archetype `addModule` lists (documented in the object-system research) become each
  archetype factory's component set, in the **same order** (order is dispatch-significant).
- **Shared infra nodes** map to base services, not deep inheritance:
  - `objMoveXY` (already composition-by-reference) → a **Movement** component.
  - `objAutoUpdate` → an **Updatable** marker + the central **Updater** scheduler.
  - `objEventNotify` → an **EventBus** (keepMePosted/eventNotify → subscribe/emit; auto-unsubscribe on finish).
  - `objModuleCatcher`'s default stubs → a **defaults table** consulted by `query` (below), not a class.
  - The truly-shared `objGameObject`/`objCharacter` base methods → a small set of always-on
    components (or a base system), **not** a deep `extends` tree. Reserve real TS `extends` only for
    trivial leaves (e.g. `objImageButton`/`objTextButton` over `objButton`).
- **AI** (`objAi*`) stays **composition by reference** — an AIController component holding a back-ref
  to its character (it already works this way in Lingo).

### 2.2 Dispatch — port BOTH patterns faithfully (highest-risk detail)

Lingo "send a message; first handler up the chain wins; many handlers re-broadcast via
`ancestor.foo()`" splits into two distinct TS patterns. **Classify every ported handler as one:**

1. **Broadcast / lifecycle hooks** — `update`, `paws`, `unpaws`, `start`, `finish`,
   `internalEvent`, `goMode`, `restoreFromSave`, `addSaveData`, `takeHit`: every component reacts.
   ```ts
   broadcast(msg, ...args) { for (const c of this.comps.values()) (c as any)[msg]?.(...args); }
   ```
2. **Single-responder queries** — `getInvinceActive`, `isDwelling`, `getMode`, `getWalkSpeed`:
   exactly one component answers; the catcher supplies the default.
   ```ts
   query<T>(msg, dflt: T): T { for (const c of this.comps.values()) if (typeof (c as any)[msg]==='function') return (c as any)[msg](); return dflt; }
   ```
3. **`me.big` re-entry** — a component calling a sibling/leaf method → explicit
   `entity.get(OtherComponent).method()`.

Because Lingo had no reflection, the message set is **closed and static** — build a
**message → owning-component(s) index** at port time (it both documents the system and lets us turn
the dynamic chain walk into direct calls). **Component order within an entity must match the
`addModule` order**, or query winners silently change.

### 2.3 Construction → two-phase init

Lingo builds an object in three passes (`new` → `getParams(#init)` weaves modules + collects
defaults → `init(params)` distributes a flat dict). Flatten to **eager construction + two-phase init**:

```ts
const e = factory();                  // add components in documented order
const cfg = mergeDefaults(e);         // each component.collectDefaults() -> merged config (watch key collisions!)
applyData(cfg, record);              // overlay the resolved data record (ListModifyProperties semantics)
for (const c of e.comps.values()) c.init?.(cfg);
```

Param keys live in **one shared namespace** today — keep a registry of which component owns which
key to catch collisions. Drop the Lingo object **pool** unless GC pressure demands it (it was a
2011 Director optimization); if kept, components need explicit `reset()`.

### 2.4 The loop & scheduler

```
fixed-timestep accumulator @ 30 Hz:
  updater.tick():  iterate priority buckets [#hi,#med,#lo]; each registered entity.update()
  -> entities self-register/unregister via the Updatable/Updater (objAutoUpdate.calcStart/calcFin)
render (rAF, decoupled): z-sort the display list by locZ; draw.
```

Port the `general_functions/` helper library (`Geom*`, `Point*`, `Rect*`, `List*`, `Var*`,
`Counter*`, `String*`) **1:1** — they're pure and underpin everything. **Never** port the
`frameTimer` busy-wait.

---

## 3. Data pipeline

Game content is ~660 Lingo files; the `data/` records (`act_*`, `tem_*`, `bnd_*`, `tlk_*`, `scr_*`)
drive everything. Pipeline:

1. **Build-time tokenizer/parser** for the Lingo literal grammar → JSON. Support: prop-lists
   `[#k: v]`, lists `[...]`, `[:]`/`[]`, symbols `#sym`, strings, ints, floats (incl. leading-dot),
   `true/false`, `point(x,y)`, `rgb(r,g,b)`. **Critical gotcha:** a few records embed Lingo
   *expressions* evaluated by `value()` — keep these as **tagged nodes**, don't try to evaluate:
   - `member("x","gfx")` → `{ $member: ["x","gfx"] }`
   - `gGameObjectLayer` → `{ $global: "gGameObjectLayer" }`
   - `random(450)` → `{ $expr: "random(450)" }`
2. **Two extra grammars** (not Lingo literals): the `tlk_*` tileset-key (`prop | value` + symbol
   list) and the `scr_*`/`cut_scenes` cutscene DSL (`characters` + `lines` with verbs).
3. **Runtime registry** mirroring `collectionsMaster`: `Map<typePrefix, Map<name, Record>>`
   (prefix→type: `act→Actor, tem→Team, bnd→KeyBinding, tlk→TileSetKey, …`). Resolves `#weapon:#archerBow`.
4. **`#inherit` merge** (data-level): recursively flatten parent→child with child-overrides
   (`Object.assign({}, parent, child)`), memoized.
5. **`#attack` schema merge**: overlay the record's `#attack` onto the ported `structMaster.structAttack`
   defaults (recursive for nested prop-lists).
6. **Class/module composition table**: `#objType` → archetype factory (component list); `#AiType` →
   AI component. Merge resolved data over the union of component defaults exactly as
   `ListModifyProperties` does.

Generate TS types from the schemas (`ActorRecord`, `AttackData`, `TeamRecord`, `KeyBinding`, …).
Keep `#inherit` resolution at runtime (or memoized build-time) so content stays data-only editable.

---

## 4. Rendering, animation, scenes, sound

- **Renderer:** replace Director sprite channels with a plain **`locZ`-sorted display list**
  (drop the channel free-list — it only existed because the Score has finite channels).
  `copyPixels` → `drawImage(src, sx,sy,sw,sh, dx,dy,dw,dh)`; `blend` → `globalAlpha`. **Respect
  registration points** — members are positioned by regPoint, not top-left (subtract regPoint every
  draw or sprites drift). Use the Z-layer globals (`gMapLayer=1 … gGridSelectorLayer=250`) as draw order.
  Reserve a small **WebGL/Pixi** path only for the animated per-sprite `color` tint
  (`modColourTransform` glow) which Canvas2D can't do cheaply per frame.
- **Animation:** pre-bake atlases + a JSON manifest at build time from the
  `anm_<char>_<action>_<delay>_<frame>` cast-member naming; export per-frame regPoints; convert
  delays to **ticks** (not ms). Runtime is a tick-driven frame player keyed off the character
  **mode FSM** (`getAnimSym`: mode→strip, walk→stand if idle, etc.).
- **Scenes (`extracted/engine/scenes.json`):** a small **Scene/state machine** — title → key-config →
  intro cutscene → `gameScreen` ⇄ pause → game-over/victory → credits. The Score is a *layout
  container, not a timeline*; reconstruct each screen from `objMenu` text-definitions + extracted
  background bitmaps (per-pixel VWSC layout decode is deferred — see `extracted/README.md`).
- **Sound:** transcode the 29 SWA sounds (already WAV in `extracted/engine/sounds/`) to web formats;
  keyed `AudioBuffer` map replaces cast lookup; keep "don't restart same music"; rescale volume 0–255→0–1.

---

## 5. World model

`objMap` (grid of rooms) → `objRoom` (ordered tile layers, composited to one image) → `objTileLayer`
(tile-number grid + tileset) → `objTileSet`/`objTileSetKey` (sheet slice + tile→symbol key) →
`objCollisionMap`/`objCollisionTile` (derived per-room collision grid).

- **No scrolling camera** — flip-screen, one 18×9-tile (576×288) room fills the play area; cross an
  open edge → `objMap.moveRoom(dir)`, reposition to opposite edge. 128px boundary frame (`gMapBoundary`).
- **Map format** = single-line Lingo prop-list (`#mapSize`, `#roomSize`, `#layerDefinitions`,
  `#rooms[].layers[].map = 9 rows × 18 ints`). The `#objects` layer **doubles as the spawn table**
  (tile symbol → actor/player/item via `activateActors`). Parse to JSON with the data pipeline.
- **Collision** is rect/tile, no pixel masks: object-vs-background via the collision tile solver
  (broad-phase "magic rect" → 1–4 tiles → per-edge push-out); object-vs-object via `teamMaster`
  unit-tile-map broad-phase + `point.inside(rect)` narrow. **The tile solver is bespoke and the
  original source admits parts it doesn't fully understand — port carefully with golden tests.**

---

## 6. Subsystem port notes (difficulty + dependencies)

| Subsystem | Diff. | Key port notes |
|---|---|---|
| **Helpers/geometry** | LOW | `general_functions/` port 1:1; pure functions; do first |
| **Input** | LOW–MED | poll→command + edge detection; translate **Mac keyNums** → web codes; whole-keyset remap (`bnd_*`) |
| **Render/sprite** | MED | display list + regpoints + alpha; tint via WebGL later |
| **Physics (`objMoveXY`)** | MED | friction/gravity/velocity integrate; `stallSpeed`, inertia/weight; `checkCollisions` callback |
| **Maps/tiles/collision** | HIGH | tile solver is the risk; data ports to JSON trivially; no camera |
| **AI** | MED | hierarchical FSM + reactive overrides; pathfinding is **beeline→scenic**, *not* A*; tight coupling to character/team |
| **Teams** | MED | data-driven allegiance (`tem_*`), unit tile-map, `findTarget`, relationships pub/sub |
| **Combat/weapons** | HIGH | one `#attack` prop-list flows weapon→char→bullet→victim; **damage == knockback magnitude** (`power: point`); per-type branching |
| **Characters/stats** | HIGH | ~22-module composition; energy=health; XP/level (deterministic + 1 random stat); magic/charge; summon+persistence |
| **World/structures** | HIGH | construction economy, dwellings/residents, **army reserve persistence** across rooms, minimap |
| **Presentation/flow** | MED | scene FSM + bitmap-composited menus; **cutscene engine drives real actors** through their modules (async line callbacks) |
| **Save/load** | MED–HIGH | localStorage + JSON is easy; fidelity is hard — ~40 modules' `addSaveData`/`restoreFromSave` + custom leaf serializers for point/rect/refs; load replays a side-effectful multi-phase rebuild |

---

## 7. Roadmap (phased, dependency-ordered)

Each phase builds on the previous. ★ marks the first playable milestone.

**Phase 0 — Tooling & scaffold**
- Vite+TS project scaffold; `Renderer`/`AudioEngine` interfaces.
- Lingo data parser CLI → JSON (incl. tagged-node handling) + generated TS types.
- Asset pipeline: sprite atlases + animation manifest from `anm_*` naming (regpoints, tick delays);
  audio transcode; map → JSON.

**Phase 1 — Engine kernel**
- Entity/Component + `broadcast`/`query` dispatch + message-owner index + catcher defaults.
- EventBus + Relationships; Updater + fixed-timestep loop.
- Port `general_functions/` helpers 1:1.
- Data registry + `#inherit` merge + `#attack` schema merge + class/module composition table.

**Phase 2 — Render + world**
- Canvas2D display-list renderer (z-sort, drawImage, regpoints, alpha).
- Map/Room/TileLayer/TileSet + collision tile solver; render one room with walls. *(golden tests on collision)*

**Phase 3 — ★ Vertical slice (playable)**
- `objMoveXY` Movement + `objGameObject` base.
- Input → `objAiPlayer` → player walks the room.
- Minimal `teamMaster` + `objCPUCharacter` + `objAiCPU` (beeline/attack FSM): one enemy.
- One weapon: `#attack` → `modAttack` melee → `CallPayloadFunction` → `takeHit` → `modEnergy`
  (damage=knockback). **Milestone: a fight in one room.**

**Phase 4 — Combat & character depth**
- Projectiles (`objBullet`) + remaining weapon types; magic/spells + charge + `objMagicLimit`.
- `modEnergy` bar, `modExperience`/leveling + stars; status effects (freeze/invince/medikit).

**Phase 5 — World systems**
- Screen exits + multi-room navigation + minimap.
- Construction/`modBuilder`/dwellings/`modResidents`; army units + reserve persistence; summoning.

**Phase 6 — Presentation & flow**
- Scene state machine (scenes.json) + `objMenu` menus + buttons.
- Cutscene engine (`scr_*` DSL + `modThespian` verbs over live actors).
- Death/respawn/wasted/reincarnate flow.

**Phase 7 — Persistence & polish**
- Save/load (localStorage + custom serializers; matching `addSaveData`/`restoreFromSave`).
- Key config/prefs; transitions; audio polish.

**Phase 8 — Content & parity**
- Full map loading; all actors/teams; balance/behavior parity testing vs the original engine.

---

## 8. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Module dispatch-order fidelity** (touches everything) | behavior drift everywhere | build the static message→component index; preserve `addModule` order; unit-test broadcast vs query winners |
| **Collision tile solver** (bespoke, partly not understood) | gameplay-breaking | port literally first; golden tests replaying known positions; refactor only after parity |
| **damage == knockback semantics** | wrong combat feel | encode `power: point` faithfully; parity tests on `takeHit`/`modEnergy` math |
| **Lingo `value()` expressions in data** | parse failures | tagged nodes resolved at runtime against a constants/asset registry |
| **Determinism** (tick-based + RNG) | desyncs, save bugs | fixed-timestep; seedable RNG mirroring Lingo `random()`; integer counters |
| **Save/restore multi-phase rebuild** | corrupt loads | implement last; per-component serialize keyed by component name (reuse `pInstalledModules` as manifest); replay tests |
| **Scope** (~660 scripts, ~120 actors) | stall | vertical slice first; data-driven content means breadth is mostly data, not code |

---

## 9. Immediate next steps

1. Scaffold the Vite+TS project and the `Renderer`/`AudioEngine` interfaces (Phase 0).
2. Write the **Lingo data parser** and run it across `casts/data/` → `/data/*.json` + generated types
   (this also validates the grammar against all 321 records early).
3. Stand up the **engine kernel** (Entity/Component/dispatch/EventBus/Updater/loop) with a couple of
   trivial components to prove the broadcast/query model.
4. Then drive toward the **Phase 3 vertical slice**.

References: object-system / loop-render / data-pipeline / subsystem research in the session record;
extracted assets + scene model in `extracted/` (`README.md`, `manifest.json`, `engine/scenes.json`).
