# Deep Engine Audit — original Lingo vs the TypeScript port

A read-only audit run as **9 parallel investigations**, each cross-referencing the decompiled original
(`casts/`) against the port (`port/src/`): timing/frame-rate, collision/physics/numeric, lifecycle/pooling/
leaks, and six "classic-engine-footgun" sweeps (list-mutation-during-iteration, off-by-one/wrong-var,
uninitialized/div-by-zero, FSM-wedge/unbounded-growth, ancestor double-dispatch, symbol-typos/dead-branches).
Every agent finding was re-verified against the source before inclusion — which caught at least one wrong
attribution (an agent credited the unused `engine/updater.ts` for a fix that actually comes from the main
loop's deferred-sweep design).

## Headline
Across nearly every bug class the **port is stricter/safer than the original** — its restructuring
(deferred-sweep update loop, deep-copied team data, guarded geometry, fixed-timer reel, explicit AI
bootstrap) *eliminated* several genuine original footguns by construction. A handful of issues are
port-introduced; **two are fixed in this pass**, the rest are latent or are gameplay-faithfulness decisions
for the owner.

---

## A. Bugs baked into the ORIGINAL engine (and the port's disposition)

| # | Original bug (cite) | Severity | Port disposition |
|---|---|---|---|
| A1 | **iceBoulder/freezeBlast deal 2× damage.** `objBullet.updateFly` calls `myTarget.takeHit()` directly **and** runs the `#takeHit` payload list (`CallPayloadFunction`) on the same victim same-frame (`objBullet.txt:317-321`). The only shipped `#type:#bullet` actors with `#takeHit` in their payload are `iceBoulder` (fired by `iceRock`, placed in shipped maps) and `freezeBlast` (`frostyMonk`). | **High** (shipped) | **Not reproduced** — `Projectile.update` resolves each collision through mutually-exclusive plain/payload/splash branches, so `takeHit` runs once (`projectile.ts:99-107`). Port is *more correct*. |
| A2 | **Update-skip on self-removal.** `objUpdater.updatePrgs` walks the live priority bucket by index while `removePrg` does `deleteAt` on that same list mid-iteration → the next entity is skipped one frame (`objUpdater.txt:30-38,55-62`). Fires whenever any actor finishes (bullet lands, timer ends, unit dies). | Med | **Avoided** — the port's real loop (`main.ts:320`) caches length and does **all** removals in post-loop sweeps; no `update()` mutates `game.entities`. (Note: `engine/updater.ts` is *dead code*; the safety comes from the main loop, not it.) |
| A3 | **Reel/daze can wedge forever.** A unit stays in `#reel`/`#dazed` until a *velocity stall* (`speed ≤ 0.2`) fires the stall counter — there is **no timeout** (`modReel.txt:161-168`, `objMoveXY.stallUpdate`). An actor with near-zero `frictionReel` or a sustained impulse never stalls → frozen AI forever. | Med | **Fixed** — reel is a fixed `flashT=6` countdown that *always* un-dazes at 0 (`hurt.ts:26`, `control.ts:392-398`). Cannot wedge. |
| A4 | **CPU AI never bootstraps from `#none`.** `objAiCPU.start`'s mode kick is commented out (`objAiCPU.txt:347`); the only `#none`→`#findTarget` path requires passing through `#dazed`. A never-dazed plain enemy can stand inert. | Med (latent) | **Fixed** — AI inits `mode="findTarget"` (`control.ts:311,356`), the original's commented-out kick made real. |
| A5 | **Original bullets pass through walls.** `gBulletsCollideWithBackground` gates bullet-vs-terrain collision (`objBullet.txt:119`) but is **declared and never assigned anywhere** → VOID/false → the branch is dead → original bullets ignore terrain. | Med | **Divergent (decision below)** — the port detonates a bullet on first wall contact (`projectile.ts:90`). |
| A6 | **Shared `#hates` corruption.** `findA*Target` do `priorityTeams.deleteOne(#collectables)` on a list that is only a *shallow* copy of `team.hates`, permanently stripping the shared config (`teamMaster.txt:268-269`). Idempotent, so benign, but mutates shared state. | Low | **Avoided** — the port deep-copies each tier and filters non-destructively (`teams.ts:46,120`). |
| A7 | **`calcAttackChargeStart` discards mana_burst.** The trailing guard tests/uses `pChargeStart` instead of the local `chargeStart`, overwriting the burst addition (`modAttack.txt:147-149`). | Med (shipped) | **Faithfully reproduced** (K11, documented — `charge.ts:57`). |
| A8 | **`reincarnate` `j=1` reset.** `j` is reset *inside* the spawn loop so `useOffset` is always false — every reincarnated part spawns with no offset (`modReincarnate.txt:52`). | Low | **Fixed** — port fans out on `spawned>0` (`reincarnate.ts:88`). |
| A9 | **Counter `inc==0` → `tim[void]`.** `CounterReset`'s `case dir of` has no arm for `inc==0` (`CounterReset().txt`). | Low (latent) | **Fixed** — port treats `inc>=0` as the low end (`counter.ts:26`). |
| A10 | **Missing void-guard** in `objEventNotify.eventNotification` (sibling handlers guard, this one doesn't) → `VOID.count` error on desync (`objEventNotify.txt:90-94`). | Med (edge) | **Fixed** — `events.ts:28` guards the Map miss. |
| A11 | **`objBullet` anti-tunnel relies on `gMoveSpeedLimit`** — a global per-frame `±(tile−1)` clamp on *every* mover (`modCollisionDetection.txt:138-143`, `objMoveXY.txt:181-183`); without it the corner-only collision check would tunnel. | Low | **Replaced** — the port's solid `moveBox` genuinely *sweeps* per-axis to the first solid tile (`collision.ts:254`), so no clamp is needed and nothing tunnels. |
| A12 | **Dead / never-triggered originals** (catalogued, not ported or inert): `#platform` one-way code commented out (`objCollisionMap.txt:218`); `#errorOutsidMap` typo'd debug `halt` never matches (`objTileMap.txt:164`); `releaseSummons` duplicates `.locv` so auto-summoned units stack in a column (`modAutoSummon.txt:84-85`); `StringExtractList` drops/truncates the final token (`StringExtractList().txt:9`); `gameMaster.scriptFinished` writes undeclared `pScripPerformer` (`gameMaster.txt:282`); `findRandomInTeam` `lookInMember` typo (commented-out caller); `modResidents`/`modAutoSummon` data-driven `/0` risks; `objAiEnemyTargetSeek.goMode(void)`; `VarChangeInRange`/`StringCharReplace`/`PointFrameMove`/`SineDist`/`GeomMoveVector` div-by-zero — **all guarded, dead, or in unported subsystems.** | Nit | n/a |

**Takeaway for "bugs in the original":** the original carried real defects — chiefly the **iceBoulder 2× damage**, the **update-skip**, the **reel-wedge**, and the **bullets-pass-through-walls** non-feature. The port did not inherit the harmful ones (it's stricter), faithfully kept the one deliberate-parity quirk (chargeStart), and the rest are dead/unshipped.

---

## B. Port-introduced issues (ranked)

| # | Issue | Severity | Status |
|---|---|---|---|
| B1 | **Freeze accumulated unbounded** — dropped the original's `pFreezeCounter.tim=[0,1000]` ceiling (`modFreeze.txt:25`); freeze-spam could lock an actor permanently. | Med | **FIXED** this pass — clamp to `FREEZE_MAX=1000` (`freeze.ts`). |
| B2 | **Player death mid-charge leaked the held spell** — the death early-return skipped release/discard, so a charge-mode orb (never finishes) was never reaped and polluted pState. | Low-Med | **FIXED** this pass — death branch discards the orb (`control.ts:109`). |
| B3 | **Dead actors retained as full entities (graves).** K21 keeps every dead actor live in `game.entities` — updated, rendered, and serialized every tick for the room's lifetime — whereas the original bakes the grave into the room background bitmap and **frees** the actor (`modRoomGraves.txt:32-62`). On populated maps (works_mr4Demo: dozens of bodies per heavily-fought room) this is a real CPU/memory/save-size drift, bounded by the room visit. Behaviorally faithful; architecturally not. | **Med** | **Open — owner decision** (re-architect to bake+free, or accept). |
| B4 | **Bullets collide with walls** (A5) — the port stops/detonates a bullet on terrain; the original's bullets fly through. A genuine gameplay-feel divergence. | Med | **Open — owner decision** (reproduce pass-through, or keep collide). |
| B5 | **Enemy bullets ignore their `#takeFreeze` payload** — `CpuAI` fires plain `fireBullet(... freeze=0 ...)` (`control.ts:530`), so enemy ice attacks (iceBoulder/freezeBlast) don't freeze the player's *allies* (the player itself is unfreezable in the original too). | Low | Open (faithfulness gap; route the bullet's payload to fix). |
| B6 | **No parse-time symbol-case normalization.** Lingo symbol compares are case-INSENSITIVE; the port preserves case verbatim (`lingo.ts`) and the data carries inconsistent casing (`#fullStrength` vs `#fullstrength`, `#inGame` vs `#ingame`, …). No *confirmed* live mismatch today (the affected `firingType` dispatch isn't ported), but any case-sensitive symbol compare the port adds inherits the hazard. | Low (latent) | Open (recommend normalizing symbols at parse). |

---

## C. Latent / no-action (documented, no shipped impact at `gameSpeed=1`)
- **Movement friction/gravity/knockback-decay not `gameSpeed`-scaled** (the original scaled those by `gGameSpeed`). Invisible while `gameSpeed=1`; diverges only in a future variable-speed build.
- **Render `alpha` computed but unused** → sprites snap at 30 Hz instead of interpolating on high-refresh displays. Cosmetic.
- **Accumulator backlog-drop** on stalls >167 ms slows tick-based timers *uniformly* (conventional spiral-of-death guard; no desync).
- **`engine/updater.ts` is dead code** (the priority-bucket scheduler is unused; the flat main-loop is authoritative). Confusing; candidate for removal or wiring.
- **Box half-extent simplification** — symmetric `box/2` AABB vs the original's per-actor rect with a 4 px "hair" shave; sub-pixel wall-stop difference, not a hazard.
- **RNG stream not persisted** across save/load — but the original never seeded/persisted `the randomSeed` either, so no parity loss.
- **Typed (non-`#solid`) collision path** lacks both the sweep and the speed-clamp, so it *could* tunnel — but no shipped map uses non-`#solid` tiles, so it's unreachable.

---

## D. Open decisions for the owner
1. **Dead-actor graves (B3)** — re-architect K21 to bake the grave into a background layer and free the entity (faithful + fixes the perf/memory drift), or accept the current keep-the-entity model (behaviorally faithful, bounded cost)?
2. **Bullets vs walls (B4/A5)** — reproduce the original's pass-through-walls (faithful to the shipped binary, even though it's an accidental dead-branch), or keep the port's collide-on-wall (arguably better feel)?
3. **Enemy freeze payload (B5)** — route enemy bullet payloads so ice attacks freeze allies (faithful), or leave enemy bullets damage-only?

## Net assessment
No crash, corruption, tunneling, NaN, double-fire, dangling-reference, or unbounded-growth defect survives into shipped port play. The two clear port regressions found (freeze cap, death-charge leak) are fixed. The remaining items are either latent (no effect at `gameSpeed=1`) or genuine faithfulness-vs-feel decisions — notably that the port is, in several places, **deliberately less buggy than the original it ports.**
