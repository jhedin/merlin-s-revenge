# Audit Charter — the failure-mode lens

The canonical prompt/checklist for any parity audit of the port. The per-actor and per-module sweeps
verify **"does the port's code mirror the cast's code, per unit / per module, in isolation?"** — and that
axis is largely exhausted and *clean*. Every bug found in play-testing since then fell **outside** it. This
charter exists so an audit (human or agent) deliberately looks for the **styles of error** those passes are
structurally blind to. **An audit that only re-runs the per-actor/per-module axis is not worth running.**

When launching an audit agent, paste the relevant sections below into its prompt. Derive "correct" from the
cast (`casts/`, `extracted/`), never from the port; reject probe artifacts before reporting; cite both trees
`file:line`.

---

## Two lenses every subsystem audit MUST apply

**A. Purpose lens — "what is this *supposed to do*, and does it do it, driven end-to-end as a user would?"**
Re-derive the feature's intended behavior from the cast first, then DRIVE the whole flow — not method by
method. A module-by-module "each method matches the cast" pass is *necessary but not sufficient* and has
repeatedly given false confidence (see B-style failures below).

**B. Visual lens — "does it render at all, at the right size, in the right place, for the right duration?"**
Headless combat probes check damage/shots/state; they never look at the screen. Most of the recent bugs were
purely visual. Assert the four visual parities: **liveness, size, placement, duration** (techniques below).

---

## The failure-mode taxonomy (look for each, by name)

Each is a real bug class the isolation axes missed, with the canonical example and how to actually catch it.

1. **Cross-system flow broken in the SEAMS.** Each module matches the cast alone, but the *feature* doesn't
   work end-to-end. → *Army banking:* the bank/retire methods were all "CLEAN," but `spawnUnit` never set the
   `teleportable` flag on summoned units, so the reserve was always empty.
   **Catch it:** drive the whole user flow (summon → fight → leave room → re-summon), and trace each
   precondition *upstream* — if a gate checks a flag, verify someone actually *sets* it.

2. **Player-input state machines, stateful over time / across ROOM transitions.** Lifecycle/singleton
   invariants get violated by key sequences a spawn-and-observe probe never performs. → *Duplicate wizard:*
   auto-refield-on-room-enter spawned a second, untracked copy.
   **Catch it:** simulate the player's key sequences across room transitions; assert invariants explicitly
   ("exactly one wizard, ever"; "the reserve empties and refills correctly across N rooms").

3. **TRUSTED documented divergences.** Notes like "collapsed to instant," "out of scope," "the port falls
   back to…", or a verdict of "EQUIVALENT" get read as *acknowledged* rather than as *suspects*. → *Stretch
   animation* was documented as "collapsed to instant — render only"; the *auto-refield* was stamped
   "EQUIVALENT" when the original has no such behavior.
   **Catch it:** treat EVERY such note as a candidate bug. Re-verify the adaptation against the cast; never
   trust the note. Audit your own prior "CLEAN/EQUIVALENT" verdicts hardest.

4. **Visual LIVENESS — the effect renders 0 frames.** A timed effect collapsed to instant, or an asset
   bundled but never requested by any render path. → *Stretch beam* (0 frames); *17 `*_explode` strips* sat
   bundled-but-never-drawn.
   **Catch it:** duration-parity test (drive the effect, assert frames > 0); static lint that every bundled
   `*_explode`/`*_charge`/teleport/icon strip is referenced by some render path. See `duration_parity.test.ts`.

5. **Visual SIZE parity — renders at the wrong size.** → *Charge orb* had a `Math.max(4,…)` floor the original
   lacks; *summon face* was blitted at native size while the original scales it to the orb rect.
   **Catch it:** size-parity test — assert rendered px == the cast's size formula at specific inputs (e.g.
   `armySummon chargeSize 2 → charge 10/15/20 = 20/30/40 px`). See `spell_face_size.test.ts`.

6. **Visual PLACEMENT / SPACING / LAYOUT parity — right thing, wrong position.** UI elements mis-positioned or
   mis-spaced; whole scenes laid out wrong. → *medikit counter spacing*; *start-view scene composition*.
   **Catch it:** placement-parity — read the cast's actual layout numbers (sprite `setLoc`/`loc`, reg points,
   per-item spacing, anchor edge, scene member coordinates) and assert each element's x/y/step against them.
   A scene that was *analyzed but never corrected* is a placement bug still open — analysis ≠ done.

7. **DURATION parity — plays, but for the wrong span.** → a 15-frame teleport playing for 2.
   **Catch it:** assert the port's playback frame-count ≈ the cast's (`pTeleportFrames`, `blendSpeed`, anim
   `dela` sums). See `duration_parity.test.ts` (extend the `CASES` table).

8. **Method-transcription FALSE CONFIDENCE (meta).** "Port mirrors the cast method" marked CLEAN without
   exercising behavior; worse, tests written to assert the port's *current* behavior, locking a bug in green.
   → *`save.test`* asserted "tile-spawned allies are not teleportable" — encoding the army bug as correct.
   **Catch it:** every CLEAN/EQUIVALENT verdict needs a *behavioral* repro, not a code-shape match. Tests must
   assert the **cast's** intended behavior, never the port's observed behavior.

---

## Standing parity guards (extend these, don't reinvent)

| Axis | Test / tool | Add a case when… |
|---|---|---|
| Duration | `test/duration_parity.test.ts` (`CASES` table) | any new timed effect (fades, stretches, transitions) |
| Size | `test/spell_face_size.test.ts` | any charge/state-scaled visual |
| Placement | *(to build)* a layout-parity test reading cast `loc`/spacing | any HUD row, counter, or scene composition |
| Liveness | *(to build)* static lint: every `*_explode`/`*_charge`/icon/teleport strip is referenced by a render path | any new effect-strip family |

---

## Per-subsystem audit procedure

1. **Re-derive intent from the cast** — what is this feature/scene FOR, what should the player see and be able
   to do? Write it down before reading the port.
2. **Drive it end-to-end** against a real bundle (the test harness; `rebuildCombatSubstrate` each tick) —
   exercise the user flow, the key sequences, the room transitions.
3. **Look at the screen** — assert the four visual parities (liveness/size/placement/duration) with cast
   numbers, not "looks right."
4. **Re-examine every documented divergence** in this subsystem's notes as a suspect.
5. **Report** with dual-tree `file:line`, the failure-mode class from the taxonomy, and a fix sketch. A clean
   finding must cite the *behavioral* evidence (numbers), not "the methods line up."
