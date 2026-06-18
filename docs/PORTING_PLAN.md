# Merlin's Revenge — Lingo → TypeScript/HTML5 Porting Plan

Status: **planning** (revised after adversarial review). This document is the master plan and
roadmap for porting the Director/Lingo engine to a modern TypeScript/HTML5 game. It is synthesized
from a full read of the runtime Lingo source (`casts/`), the decompiled engine
(`extracted/engine/scripts/`), and the extracted assets/scene model (`extracted/`).

> **Read `PLAN_REVIEW.md` alongside this.** An adversarial audit (dispatch correctness, performance,
> data pipeline) corrected several load-bearing assumptions — the dispatch model (§2.2), the
> performance rules (§2.5), and grammar/format/regpoint gaps (§3–5) reflect those corrections.

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

### 2.2 Dispatch — FOUR primitives, generated from the real chain (highest-risk area)

> Revised after adversarial audit (see `PLAN_REVIEW.md` §1). An earlier draft used just two helpers
> (`broadcast`=call-everyone, `query`=first-match). **That is too coarse and silently corrupts
> combat/FSM/animation/save.** The Lingo chain is a *forwardable, transformable, shadowable,
> order-sensitive pipeline*, not a component sweep.

The message set is **closed and static** (Lingo has no reflection). At port time, build the
**message → ordered-handler index** for each archetype — order is **leaf `obj*` handlers → base
services → modules in `addModule` order → catcher** (NOT generic component-map order; in Lingo the
leaf runs before any module, and base state-commits like `pMode` run *last*). Then **precompile a
per-archetype array of bound method refs per message** (only handlers that exist) so dispatch is a
tight monomorphic loop, never a `(c as any)[msg]` string scan (see perf §2.5). Classify **every**
message into one of four kinds:

1. **Ordered chain walk** (`update`, `goMode`, `takeHit`, `internalEvent`, `finish`, `paws/start`):
   run handlers in chain order; each may do work + forward or **shadow** (stop). Honor real
   shadows (`objWeapon.goMode` sets `pMode` and never forwards; `modSplashDamage.internalEvent`
   consumes; `objModuleCatcher` blocks `paws/start` from infra) and **fixed state-commit points**
   (e.g. `pMode` written once at the base position, after leaf/module inspection). Ordering is a
   contract — `modExperience.takeHit` MUST precede `modEnergy.takeHit`.
2. **First-match query with a pinned winner** (`getMode`, `getInvinceActive`, `isDwelling`,
   `getAttack`…): index the *actual* winning handler per archetype. The winner is often a **base
   service, not a module** (`getAttack`→`objAiGameObject`) — so base-service handlers must be
   ordered **before** modules. Catcher default last.
3. **Fold / pipeline** (`getAnimSym`, `checkCollisions`, `getParams`, `addSaveData`): thread a value
   through the ordered handlers, each transforming it (`sym = next.getAnimSym(sym)`). Neither
   broadcast nor first-match reproduces this.
4. **Full re-entry** for `me.big.foo()` / `me.ID.bigMe.foo()`: dispatch **restarts at the top** of
   the ordered list — a *different, larger* handler set than mid-chain `ancestor.foo()`. Do not
   collapse the two.

Separately, `call(#sym, listOfObjects, …)` is a **cross-entity** fan-out over *separate* entities
(e.g. a room iterating its actors) — a system loop, not intra-entity dispatch.

**Reproduce original semantics first, then fix bugs deliberately** — e.g. `modRotator.unpaws`
calls `ancestor.paws()` (a real copy-paste bug); a naive sweep would silently "fix" it and diverge.
Add golden replay tests on `takeHit`/`goMode`.

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
key to catch collisions. **Object pooling is MANDATORY for high-churn classes, not optional**
(audit §2.2): `objBullet`/spell-bullets and `objStar` see 200–500 create+destroy/sec (hundreds in a
single frame on magic bursts / level-up cascades) — un-pooled that is guaranteed GC-hitch territory
at 30 Hz. Ship `reset()` on those archetypes from day one; pooling characters/effects is optional.

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

### 2.5 Performance rules (non-negotiable — audit §2 / `PLAN_REVIEW.md`)

At realistic counts (~26 updating characters + bullets/stars, ~28–36-link chains):
- **Dispatch via precompiled per-archetype bound-method arrays**, never `(c as any)[msg]?.()` over
  all components — the naive version is ~550k megamorphic string lookups/sec and JIT-deopts. Build
  this in **Phase 1** (it's the same message→owner index §2.2 needs), not "later".
- **Allocation-free hot paths.** `objMoveXY.update` allocates 8–15 `Point`s/call in Lingo; ×26
  ×30 Hz ≈ 6–12k Points/sec. The movement integrator uses **packed numeric fields** (`x,y,vx,vy`)
  or a scratch-vector pool; the allocating pure `Point*` API is for cold code only.
- **Pool bullets/stars** (§2.3).
- **Canvas2D tint** (`sprite.color` glow/hit-flash, any actor) via offscreen
  `globalCompositeOperation='multiply'` + `'destination-in'` mask, **keyed on a quantized tint
  color** so the per-frame tween reuses cached tinted bitmaps. **`getImageData`/`putImageData` per
  frame is BANNED** (GPU→CPU readback stall). This does not force WebGL day one, but the `Renderer`
  interface keeps a Pixi/WebGL swap cheap.
- Collision/targeting is already cheap (4-corner broad-phase, tile-bucketed hash, retarget throttled
  to ~30 frames) — **don't** regress it to per-frame target search.

---

## 3. Data pipeline

Game content is ~660 Lingo files; the `data/` records (`act_*`, `tem_*`, `bnd_*`, `tlk_*`, `scr_*`)
drive everything. Pipeline:

1. **Build-time tokenizer/parser** for the Lingo literal grammar → JSON. Support: prop-lists
   `[#k: v]`, lists `[...]`, `[:]`/`[]`, symbols `#sym`, strings, ints, floats (incl. leading-dot),
   `true/false`, `point(x,y)`, `rgb(r,g,b)`, **and `rect(t,l,b,r)`** (22 uses, all with negatives —
   was missing from the first draft). Notes verified by audit (`PLAN_REVIEW.md` §3):
   - **Each data file has TWO top-level values** — line 1 header `[#name…,#type…]`, line 2+ payload.
     Parse a *sequence*; the record is the 2nd value.
   - **String-aware comma splitting** (literal `", "` values exist) and negative numbers in
     `point`/`rect` args.
   - **Critical gotcha:** a few records embed Lingo *expressions* evaluated by `value()` — keep these
     as **tagged nodes**, and **recurse into `point()`/`rect()` args** (`point(random(450),300)`):
     - `member("x","gfx")` → `{ $member: ["x","gfx"] }`  (41 uses)
     - bare global → `{ $global: "gGameObjectLayer" }`  (**4 globals**: `gGameObjectLayer`,
       `gGameBulletLayer`, `gPlayerLayer`×2)
     - `random(450)` → `{ $expr: "random(450)" }`  (1 use, nested in a `point`)
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
- **Animation:** pre-bake atlases + a JSON manifest at build time. **Per-frame regpoints are now
  extracted** (`extracted/.../bitmaps.meta.json` + `manifest.json`, `reg:[x,y]`; 1,509/3,104 are
  off-center — essential, was a bug). The baker must **mirror `animStripMaster.extractData`**, not a
  fixed field pattern: tokens `[2]=char,[3]=action,[4]=delay`; **no separate frame token** (frame
  order = numeric prefix of the last token; trailing letter = sheet marker); handle 4-token
  (no-delay) members. Convert delays to **ticks** (not ms). Runtime is a tick-driven frame player
  keyed off the character **mode FSM** (`getAnimSym`: mode→strip, walk→stand if idle, etc.).
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

- **No scrolling camera** — flip-screen, one room fills the play area; cross an open edge →
  `objMap.moveRoom(dir)`, reposition to opposite edge. 128px boundary frame (`gMapBoundary`).
- **Room size is per-map, NOT a constant** (audit §3): the shipped game is 18×9 (576×288) but maps
  range `16×9 … 35×18 … 64×64` and `#mapSize` up to 30×30. The loader/renderer must read
  `#roomSize`/`#mapSize`/`#roomMapScale` from each map — do not hard-code 18×9.
- **Map format** = single-line Lingo prop-list (`#mapSize`, `#roomSize`, `#roomMapScale`,
  `#layerDefinitions`, `#rooms[].layers[].map`). **Tilesets are per-layer**; the `#objects` layer
  **doubles as the spawn table** and resolves tile numbers through a *different* `tlk_` key than the
  background layers. **`tlk_` keys interleave `--` comments that must be stripped before positional
  tile indexing** (else off-by-N spawn/collision bugs). Parse to JSON with the data pipeline.
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
- Lingo data parser CLI → JSON (incl. `rect()`, two-top-level-values, recursive tagged nodes) +
  generated TS types; validate against all 321 `data/` records.
- Asset pipeline: sprite atlases + animation manifest mirroring `animStripMaster` (regpoints already
  extracted; tick delays); audio transcode; map → JSON (per-map room sizes; `tlk_` comment strip).
- Per-binding-file Mac-vkey→`KeyboardEvent.code` table (+ round-trip test on all 4 `bnd_*`).
- Enumerate the full cutscene-DSL verb set from all `scr_`/`cut_scenes/` files.

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
| **Module dispatch-order fidelity** (touches everything) | silent behavior drift everywhere | the **four-primitive** dispatch (§2.2): ordered chain walk + pinned-winner query + fold + full re-entry, generated from a static message→handler index; honor shadows & leaf-before-module order; golden replay tests on `takeHit`/`goMode` |
| **GC churn / allocation** (bullets, stars, Point math) | frame hitches at 30 Hz | mandatory pooling + allocation-free hot path (§2.5) |
| **Collision tile solver** (bespoke, partly not understood) | gameplay-breaking | port literally first; golden tests replaying known positions; refactor only after parity |
| **damage == knockback semantics** | wrong combat feel | encode `power: point` faithfully; parity tests on `takeHit`/`modEnergy` math |
| **Lingo `value()` expressions in data** | parse failures | tagged nodes resolved at runtime against a constants/asset registry |
| **Determinism** (tick-based + RNG) | desyncs, save bugs | fixed-timestep + seedable PRNG + integer counters give *internal* determinism. **Lingo's RNG is not reproducible** — golden tests vs the original only work on deterministic paths (collision, damage, leveling, data resolution), not RNG/trig-dependent behavior (audit §4) |
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
