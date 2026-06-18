# Adversarial Review of `PORTING_PLAN.md`

Three adversarial audits read the actual Lingo (`casts/`, `extracted/engine/scripts/`) and
attacked the plan's assumptions: **dispatch correctness**, **runtime performance**, and the
**data/asset pipeline**. Plus an independent determinism check. This is the blunt result.

## Verdict

The plan's **strategy is sound** — reimplement as entity/component (not transpile), vertical
slice first, data-driven content. But **three load-bearing pieces are wrong or underspecified**,
and every failure mode is *silent* (wrong-but-plausible behavior or gradual jank), which is the
worst kind for a parity port:

1. **The `broadcast`/`query` dispatch model is too coarse** and will silently corrupt combat,
   the mode FSM, animation, and save/load. It needs **four** dispatch primitives, generated from
   the real chain — not two.
2. **Performance: three changes are mandatory, not optional** — object pooling, an
   allocation-free movement hot path, and precompiled dispatch. The plan's own dispatch code
   sketch is a megamorphic hot loop.
3. **The data/asset pipeline had a blocking bug (regpoints were never extracted — now FIXED)**
   plus grammar/format gaps that will produce wrong data.

Plus a **determinism caveat** the plan oversells.

Nothing here invalidates the roadmap; it sharpens Phase 0/1. Items marked **[FIXED]** are already done.

---

## 1. Dispatch model — REWORK REQUIRED (most dangerous area)

The plan models the Lingo `ancestor`-chain + module system with two helpers: `broadcast` (call
`msg` on every component) and `query` (first component that has `msg`). The chain is actually a
**forwardable, transformable, shadowable, order-sensitive pipeline**. Verified counterexamples:

- **Order-dependent pipelines, base mutates LAST.** `goMode`/`takeHit`/`update` are not
  broadcasts. The state write `pMode = newMode` lives at the *base* `objGameObject.goMode`, which
  runs **after** every leaf/module inspected the *old* mode. `takeHit` carries explicit ordering
  comments: `modExperience.takeHit` must set `#lastAttacker` **before** `modEnergy.takeHit`
  discovers `outOfEnergy`, or XP goes to the wrong character; `objGameObject.takeHit` applies
  knockback **before** forwarding so `modReel`/`modEnergy` see post-knockback velocity;
  `objPlayerMerlinCharacter.takeHit` runs `ancestor.takeHit` then *overrides* modReel's result.
  Iterating components "in addModule order" does **not** reproduce this (in Lingo the leaf `obj*`
  handlers run *before* any module — modules are spliced below `objModules`).
- **Real shadow handlers that never forward** → `broadcast` over-fires: `objWeapon.goMode` sets
  `pMode` directly with no `ancestor.goMode`; `modSplashDamage.internalEvent` and
  `objAiPlayer.internalEvent` consume without forwarding; `objModuleCatcher` is a *shadow boundary*
  for `paws/start/unpaws` (infra below it must NOT receive them).
- **`me.big.foo()` is full top-of-chain re-entry, not a sibling call.** Used heavily (modThespian
  25×, modSpellMultistage 24×, modAnimSet 20×, modEnergy 16×…). `modReel.goDamageMode` calls
  `me.big.goMode(#reel)` to re-run the *leaf* `goMode` handlers that sit **above** it — collapsing
  this to a plain `broadcast('goMode')` erases "restart from top" vs "continue downward," which
  select different handler sets.
- **Value-transforming fold pipelines.** `getAnimSym` and `checkCollisions` thread a value down the
  chain, each link mutating it (`sym = ancestor.getAnimSym(sym)` then rewrite; `newLoc =
  ancestor.checkCollisions(newLoc, oldLoc)` then adjust). `query` (first-match, stops) and
  `broadcast` (ignores returns) both fail here.
- **Multi-responder queries won by a NON-module base.** `getAttack` is answered in 5 places;
  for an AI character the *base* `objAiGameObject.getAttack` wins over any module. `getMode` is
  base-owned for game objects, `objAi`-owned for AI objects. If base-service components aren't
  ordered **before** modules, `query` silently picks the wrong responder.
- **Save/load is namespaced sub-dicts, not a flat sweep.** `objGameObject` stores `pMoveXY` as a
  nested `[:]`, `objAiGameObject` stores `pAI`, `objMap`/`objRoom` store per-room nests. Flattening
  collides keys isolated today (`pMode`, `pTargetLoc`, `pFin`). Restore is strictly ordered
  ("character before AI") and masters (`potion/sound/armyMaster`) are separate singletons that must
  **not** be entity-swept.
- **Teardown order + a latent bug.** `objBasic.finish` frees the object from its pool; handlers that
  call `ancestor.finish()` before their own cleanup free sub-objects after the parent is gone.
  Also `modRotator.unpaws` calls `ancestor.paws()` (a real copy-paste bug) — a naive broadcast
  would silently "fix" it and diverge from the original. **Reproduce original semantics first.**

**Required redesign — four primitives, generated at port-time from the actual chain:**
1. **Ordered chain walk** with shadow/forward control + fixed state-commit points (`goMode`,
   `takeHit`, `update`, `internalEvent`, `finish`, `paws/start`).
2. **First-match query with a pinned winner** per archetype (base-services ordered before modules).
3. **Fold/pipeline** that threads & transforms a value (`getAnimSym`, `checkCollisions`,
   `getParams`, `addSaveData`).
4. **Full re-entry** for `me.big.foo()` (restart at top — distinct from mid-chain `ancestor.foo()`).
   Plus: `call(#sym, list)` list-fanouts are **cross-entity** broadcasts over separate objects — a
   different mechanism than the intra-entity dispatch.

Build the static **message→owning-handler index** (leaf→base→modules-in-order→catcher) the plan
already mentions, and classify every message into one of the four kinds. Add golden replay tests
on `takeHit`/`goMode`.

---

## 2. Performance — three mandatory changes (verified with numbers)

Baseline from code: `gMaxEnemies=16`, `gMaxFriends=9`; busy room ≈ **~26 updating characters** +
bullets/stars; a CPU enemy is a **~28-link chain**, Merlin ~36; `objBullet`=10 modules.

1. **Dispatch is megamorphic AND the wrong shape (HIGHEST).** The plan's
   `for (c of comps) (c as any)[msg]?.()` visits *every* component per message; the engine
   transparently skips non-handlers. At ~26 chars × ~25 msgs/frame × ~28-component scan ≈
   **~550,000 dynamic string-keyed lookups/sec**, most returning `undefined`. `(c as any)[msg]`
   over heterogeneous shapes deopts V8 to megamorphic ICs (slowest path). **Fix:** precompile
   **per-archetype arrays of bound method refs** (the handlers that actually exist, in order);
   resolve query winners once. ~550k megamorphic → ~150k monomorphic direct calls/sec. **Do it in
   Phase 1**, not "later" — this is the same message→owner index item 1 needs.
2. **Object pooling is mandatory, not optional.** Many enemies fire at `#cooldown:0` (~30
   bullets/sec each); magic bursts spawn tens–hundreds of bullets in one cast
   (`modSpellMultistage` loops `charge/chargePerUnit`, `chargeMax:999`); star/level-up cascades
   spawn dozens (`starMaster.starBurstX` = 4 each, `objStar` lifeCount=1). **200–500 create+destroy
   per second steady, hundreds in a single frame** → guaranteed GC-scavenge hitches at 30 Hz. The
   original pools 100/type via `objFree`. **`objBullet`/spell-bullets and `objStar` MUST be pooled
   with `reset()` from day one.**
3. **Allocation-free movement hot path.** `objMoveXY.update` allocates **8–15 `Point` objects per
   call** (`.duplicate()` ×17 in the file); ×26 entities ×30 Hz ≈ **6–12k Points/sec** from
   movement alone — and the plan's "port `Point*` helpers 1:1" multiplies it. **Fix:** packed
   numeric fields (`x,y,vx,vy`) or a scratch-vector pool in the integrator; keep the allocating
   pure `Point*` API for cold code only.

**Canvas2D is fine** (room composited once per room load = 1 drawImage/frame; `blend`→`globalAlpha`)
**except** the per-frame `sprite.color` glow/hit-flash tint (added by `objGameObject`, so any actor
can flash). Canvas2D has no per-pixel multiply — **never** use `getImageData`/`putImageData` per
frame (GPU→CPU readback stall). **Day-one tint:** offscreen `globalCompositeOperation='multiply'`
+ `'destination-in'` mask, **keyed on a quantized tint color** so the glow tween reuses cached
tinted bitmaps. This is acceptable without WebGL, but the plan must *forbid* the getImageData trap
explicitly. Keep the `Renderer` interface so a Pixi/WebGL batch swap stays cheap.

**Good news:** collision/targeting is **not** a bottleneck — 4-corner broad-phase, tile-bucketed
spatial hash, retargeting throttled to every ~30 frames. Don't accidentally make target search run
every frame. (Correctness golden-tests still warranted on the tile solver.)

---

## 3. Data / asset pipeline — one blocking bug [FIXED] + grammar/format gaps

- **[FIXED] Regpoints were never extracted.** `extract_assets.py` read up to the registration
  point and threw it away; **1,509 of 3,104 bitmaps have off-center anchors** (e.g. `vultureGuard`
  63×72 anchored at (21,55)), so ~half the sprites would have been misaligned and jittery. Patched
  `bmp_info` to read `regY`=s16(spec[18]), `regX`=s16(spec[20]); re-ran extraction; each bitmap now
  carries `reg:[x,y]` + `w,h` in `bitmaps.meta.json` and `manifest.json`. Verified consistent
  per-animation anchors.
- **Animation naming reality ≠ the plan's pattern.** The plan invented `anm_<char>_<action>_<delay>
  _<frame>`. The real `animStripMaster` uses tokens [2]=char, [3]=action, [4]=delay; there is **no
  separate frame token** (frame order = numeric prefix of the last token; the trailing letter is a
  sheet/version marker). 42 members have only 4 tokens (no delay). The baker must **mirror
  `animStripMaster.extractData`**, not the prose pattern. (~64 member names also carry binary junk
  from the greedy `cast_name` regex — a port-time cleanup; mostly cosmetic.)
- **Grammar gaps in the parser plan:** `rect(t,l,b,r)` is **missing entirely** (22 uses, all with
  negatives); each data file has **two top-level lists** (header + payload), not one; `random()`
  appears **nested inside `point()`** (`point(random(450),300)`) so tagged-node logic must recurse
  into `point`/`rect` args; it's **4 globals, not 3** (`gGameObjectLayer`, `gGameBulletLayer`,
  `gPlayerLayer`×2); comma-splitting must be **string-aware** (literal `", "` values exist).
  `member()`=41 ✓, `random()`=1 ✓.
- **Maps are NOT fixed 18×9.** `#roomSize` ranges `16×9 … 35×18 … 64×64`; `#mapSize` up to 30×30.
  The loader/renderer must read `#roomSize`/`#mapSize`/`#roomMapScale` per-map; tilesets are
  **per-layer** (`#objects` resolved through a *different* `tlk_` key than backgrounds).
- **`tlk_` tile keys interleave `--` comments** that must be stripped **before** positional tile
  indexing, or every tile→symbol mapping shifts (off-by-N collision/spawn bugs). Also a
  `tileSize | point()` pipe-delimited line.
- **Four `bnd_*` keymaps disagree** on Mac keycodes per action — needs a Mac-vkey→`KeyboardEvent.code`
  table applied **per binding file**, with round-trip tests; keycode `0` is a valid code (don't
  treat falsy as unbound).
- **Cutscene DSL:** separate two-section grammar; treat everything after `<alias>:` as opaque text;
  parse the alias table before statements (first token is verb OR alias); enumerate the full verb
  set from all 16 `scr_` + `cut_scenes/` files before writing the parser.

---

## 4. Determinism — the parity-test claim is oversold

The plan proposes "seedable RNG mirroring Lingo `random()`" for tick-replay golden tests against
the original. The engine uses `random()` at **30 sites across 14 files** plus trig/sqrt in geometry
and targeting. **Lingo's internal RNG is undocumented and not reproducible**, so we can get
*internal* determinism (our own seeded PRNG — fine for save/replay and our own regression tests) but
**cannot** byte-match the original's behavior for anything RNG- or trig-dependent. Reframe golden
tests as **self-consistency/regression** tests, and reserve original-vs-port parity testing for the
*deterministic* paths (collision math, damage=knockback, leveling thresholds, data resolution).
Also honor `gGameSpeed` (15 sites scale logic) and confirm `the milliseconds` in `objMap` gates only
profiling, not logic, under the fixed timestep.

---

## 5. Net changes folded into `PORTING_PLAN.md`

- Dispatch §2.2 rewritten: **four primitives** + shadow/forward + message→owner index (not 2 helpers).
- Perf: pooling **mandatory** for bullets/stars; allocation-free movement; precompiled dispatch in
  Phase 1; Canvas2D tint via composite-op + quantized cache, **getImageData banned**.
- Data §3: add `rect()`, two-top-level-lists, nested tagged nodes, 4 globals; per-map room sizes;
  `tlk_` comment-stripping; per-file keycode translation; baker mirrors `animStripMaster`.
- Regpoints marked **done**; determinism caveat added; Phase 0 gains the per-file keymap + cutscene
  verb enumeration tasks.
