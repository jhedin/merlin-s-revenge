# Substituted-subsystem audit (port-shortcut / non-faithful reimplementation)

A distinct bug class from the data-pipeline ones: the port **reimplemented an entire original
subsystem a different, lower-fidelity way** instead of reusing the real assets/mechanism. Nothing
is dropped or mis-parsed — the code just does the job differently. Tell-tale: a whole *family* of
source assets goes unused/unbundled because the consuming subsystem was replaced.

**Detection cardinality** (these are invisible to the field-key census and the per-actor sweep —
not a `#key`, not an actor):
- **Pass B — source→output reconciliation:** every `extracted` asset family maps to something in the
  bundle OR is explainably excluded. Flags unbundled families (e.g. `fnt_*`) immediately.
- **Subsystem inventory:** enumerate every original rendering/feedback subsystem and mark each
  `reuses-real-asset` vs `reimplemented-procedurally`. The reimplemented ones are the candidate list.

---

## OPEN

### SS-1 — Text rendering uses canvas system fonts, not the original bitmap fonts (FIRST of this class)
- **Original:** bitmap-font text — blits letter sprites from `fnt_menu` / `fnt_numbers` / `fnt_small` /
  `fnt_smallgrey` (sized by `#charSize`, via `objFont`).
- **Port:** `ctx.font = "...serif"/"...monospace"` + `ctx.fillText` (`main.ts` title + HUD: Lv, Kits,
  lives, flash messages, etc.). Generic system fonts, wrong glyphs/metrics.
- **Downstream symptom:** the `fnt_*` sheets sit in `extracted` but are **not bundled** — `build_assets`
  only bundles `anm_*` (`name.startsWith("anm_")`), so `fnt_*` falls out (same filter that dropped the
  numeric-prefixed art).
- **Fix (later):** make `build_assets` bundle `fnt_*` sheets + their key/metrics; add a bitmap-font
  blitter (per-glyph from `charSize`) for the HUD/menu/numbers; route the canvas `fillText` calls through it.
- Surfaced via: the `charSize` field-key census hit → traced to `objFont` → found the unbundled `fnt_*` family.

### SS-2 — Health-bar sprite (RE-OPENED — user reports it still isn't faithful)
- A prior pass claimed the HUD bars were swapped to the real `health_bar_surround` member art (see ALREADY
  RESOLVED below), but in play the health bar still looks wrong — so either the swap is incomplete (drawn
  procedurally on top of / instead of the real frames), or the per-unit enemy/boss health bars and the
  player HUD bar use different draw paths and only one was converted.
- **Audit:** RUN the game, compare the player HUD bar AND the floating per-unit/boss health bars against the
  original's `objHealthBar`/`health_bar*` member art (fill frames, surround, segment count, position). Trace
  every health-bar draw call in the renderer/HUD and mark each `reuses-real-member` vs `drawn-procedurally`.

---

## ROADMAP (this sweep is step 3 of 3, per user direction 2026-06-23)
1. **Cutscene/thespian sweep** (in progress) — reproduce the scripts, command-by-command vs modThespian.
2. **General cross-cutting check** — the data-pipeline/field-key census + source→output reconciliation pass
   for systemic issues that are neither per-actor nor a substituted subsystem.
3. **THIS sweep — substituted subsystems.** Re-verify by RUNNING, do NOT trust the porting agent's
   "equivalent enough" judgement OR the "ALREADY RESOLVED" claims below — each needs a real visual
   comparison against the original member art (the resolved ones may be partial). Text rendering (SS-1) and
   the health bar (SS-2) are confirmed live targets.

---

## ALREADY RESOLVED instances of this class (for reference — same pattern, fixed earlier this session)
- Procedural gradient spell-orb → real `spell_charge` strip (tinted/scaled) + the summon-tier face icons.
- Diamond/coloured-dot pickups → real `*_potion` / `*_scroll` member sprites.
- Procedural 3-state minimap grid → real `mini*` status tiles.
- Procedural HUD bars → real `health_bar_surround` + medikit/extra-lives member art.
- Team-coloured dot projectiles → real `<char>_fly` strips.
- `blackOrc` (96×96) fallback for unbundled chars → kin-sprite aliases.

## CANDIDATE INVENTORY (to audit for this class — reuses-real vs reimplemented)
Room/screen transitions & fades; cutscene/thespian rendering; the title/menu screens; pause/wasted
overlays; exit arrows; death/stretch-death effects; rollover/level stars; charge orb over enemy heads;
explosion/splash VFX; freeze/glow overlays; cursor/aim reticle. Walk each: does it blit the original's
member art, or draw procedurally?
