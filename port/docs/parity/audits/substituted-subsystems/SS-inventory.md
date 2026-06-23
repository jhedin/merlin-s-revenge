# SS-inventory — substituted-subsystem inventory audit

Walk of the CANDIDATE INVENTORY from `../substituted-subsystems.md`. Each subsystem was traced at its
PORT draw site, compared to the ORIGINAL member-blit / draw routine, and the real `extracted` asset
family + its bundle status verified directly (assets.json keys + extracted/engine/bitmaps listing).
**Audit only — no fixes applied. No probe files were created.**

Method: read the port renderer/scene/component draw sites; read the matching original master/script
(`casts/master_objects`, `casts/script_objects`); confirm asset existence in `extracted/engine/bitmaps`
and bundling in `port/src/generated/assets.json` (and the `MEMBER_NAMES` allow-list in
`port/tools/build_assets.ts`). Verdicts are NOT taken from prior "ALREADY RESOLVED" claims — re-verified.

---

## Inventory table

| # | Subsystem | Port impl (draw site) | Original member art / mechanism | Verdict | Real asset family + bundled? |
|---|-----------|-----------------------|---------------------------------|---------|------------------------------|
| 1 | Room/screen transitions & fades | `main.ts:356-363` triangle-alpha black `fillRect`; `sceneManager.ts` `goScreen` flips instantly, `tickTransition` is a frame countdown | `screenMaster.startTransition` → Director `puppetTransition #flick`/`#fade` | **PARTIAL / procedural** | No member art (engine transition). A black-fillRect approximation of `#flick`/`#fade` — acceptable-ish, but it is NOT the engine `#flick` and is described in-code as "F3 cosmetic". |
| 2a | Title screen | `main.ts:446 drawTitle` — `fillRect` bg + `ctx.fillText("MERLIN'S REVENGE", serif)` | Director score screen (`movieMaster #titleScreen`); no extractable single title bitmap | **PROCEDURAL** (font) | No `*title*` bitmap in extracted; title is score-placed. Ties to **SS-1** (system fonts). No member to blit → low-impact gap. |
| 2b | Menu / pause overlays | `menu.ts:39`, `screens.ts` (showArmy/instructions/keyConfig/credits) — `fillRect` panels + `fillText` (serif/monospace) | `objMenu` / `screenMaster` screens, bitmap-font text (`objFont`) | **PROCEDURAL** (font) | `fnt_menu`/`fnt_small`/`fnt_numbers` exist in extracted, **NOT bundled** (0 `fnt_` keys in assets.json). Same root as **SS-1**. showArmy DOES blit real unit stand frames; only the text/panels are procedural. |
| 2c | Wasted / cutscene backdrop | `cutscenePlayer.ts:78-103` — `fillRect` background colour + dark overlay; actors drawn from real `Anim` sprites; captions `fillText` | `cutSceneMaster pBackgroundMember = member("cutSceneStage")` blitted as the stage backdrop | **PROCEDURAL** (backdrop) | `05433_cutSceneStage.png` EXISTS in extracted, **NOT bundled** (no `cutSceneStage` key). Actors are faithful; the backdrop bitmap is dropped → flat colour fill. |
| 3 | Exit arrows | `main.ts:541 drawExitArrows` — tiles the real arrow member across each edge rect (clipped) | `modScreenExits.drawExitArrowsOnImage` → `ImageDrawRepeated(arrow_<colour>_<edge>)` | **REUSES-REAL** ✓ | `arrow_green/red_{left,up,right,down}` — 13 `arrow_` keys bundled (`arrows` block, build_assets §e). Faithful. |
| 4 | Explosion / splash VFX | `splash.ts` / `spellActor.explode` / `mine.ts` / `projectile.detonate` — run `resolveSplash` (damage) + play a sound; **NO explosion sprite drawn**. Spell orb fallback is a `createRadialGradient` circle (`main.ts:602`) | `objExplodingBullet`/`modExploder.resetAnim(#explode)` plays the actor's `_explode_` strip; `objSpell #explode` just `getAnimSym→#charge` + `startQuickFade` (orb fade, no strip) | **PROCEDURAL / MISSING** ✗ | `bomb_explode`, `flamingRock_explode`, `darkRock_explode`, `energyMine_explode`, `pitMonster_explode`, `fire_explode`, `smoke_explode`, `freezeBlast_explode`, `thunderBlast_explode`, `iceAura/orcAura/snowAura/quadAura/undeadAura/energyPulse/energyBeam/cracks_explode` — **ALL bundled** (each has an `*_explode` anim key) but **NEVER requested by any render code**. Bombs/mines/rocks detonate with zero on-screen burst. |
| 5 | Freeze / glow / colourTransform overlays | `renderer.ts:103 tinted()` offscreen source-atop fill; `colourTransform.ts` / `freeze.ts` drive the resolved tint | `modColourTransform.setSpriteColour` (Director colour mix); freeze = `glowTeal`, low-HP = `glowRed`, hit = white flick | **REUSES-REAL (mechanism)** ✓ | No member art in the original either — it tints the unit's own sprite. The source-atop fill is the faithful equivalent of `setSpriteColour`. No separate freeze/glow overlay object exists. |
| 6 | Cursor / aim reticle | none — no reticle drawn; cursor only read for rollover/aim (`input.cursor()`) | original uses the default OS/Director cursor (no `cursor`/reticle member exists) | **REUSES-REAL (none needed)** ✓ | No cursor bitmap in extracted. Nothing to substitute. |
| 7 | Charge orb over enemy heads | `main.ts:564 drawSpells` — blits the real `spell_charge` strip, tinted to `chargeColour` + scaled to charge size; summon spells overlay the real `spellIcons_<spell>` tier face | `objSpell act_spell #character:#spell` `spell_charge` strip + `objSpellIcons` face | **REUSES-REAL** ✓ (verified) | `spell_charge` (3 keys) + `spellIcons_*` bundled. Faithful. Gradient circle is fallback-only (pre-load). |
| 8a | Level-up stars | `effects.ts:37 draw` — blits real `experienceStar_stand` frame rising from the unit | `starMaster.experienceStar` (`act_experienceStar`, setLocZ-1) | **REUSES-REAL** ✓ | `experienceStar` (3 keys) bundled. Faithful. |
| 8b | Rollover level stars | `rollover.ts:46-53` — blits real `star_large/medium/tiny` member row | `objMoveableLevelBar.calcNumbersOfStars` | **REUSES-REAL** ✓ | `star_tiny/medium/large` (6 keys) bundled. Faithful. |
| 8c | Rollover energy/XP bars + bg box | `rollover.ts:49-59` — `fillRect` energy bar (real colour model) + black box + XP fillRect | `objMoveableEnergyBar/ExperienceBar` (member frame) | **PROCEDURAL** | Overlaps **SS-2**. Per-unit hover bars are drawn with `fillRect`, not the real bar member frames. (Colour model `healthBar.ts` is faithful; the bar geometry/frame is procedural.) |
| 8d | Score popups | none found (no score-popup subsystem in the port) | n/a | n/a | No score-popup family identified. |
| 9 | Death / stretch-death | `anim.ts:209-221` — stretches (scaleY) + fades (alpha) the unit's OWN body sprite over STRETCH_DURATION | `modStretchDeath.startStretchHeight + startTransBlend` on the unit's own sprite | **REUSES-REAL (mechanism)** ✓ | No separate member — the original also transforms the body sprite. Faithful. (Normal deaths use the real `_grave` frame — faithful.) |
| – | Player HUD health bar | `main.ts:467-471` — blits real `health_bar_surround` over a `fillRect` colour fill | `objPlayerCharacter` surround member + multicolour fill | **REUSES-REAL** ✓ (surround) | `health_bar_surround` + `medikit_on/off` bundled. The surround is blitted; the fill behind it is procedural (faithful — keyed interior). This is the SS-2 player-HUD path and it IS converted. |

---

## Ranked by visual impact (procedural / non-faithful only)

1. **Explosion / splash VFX (#4)** — HIGHEST. Every bomb, flaming/dark rock, energy mine, pit monster,
   and all aura/blast detonations should play a multi-frame `*_explode` strip (8–48 frames each). The
   port shows NOTHING on detonation (silent damage + sound). 17 explosion families are bundled and
   unused. This is the single most visible missing subsystem — combat detonations have no burst at all.
2. **Cutscene / wasted backdrop (#2c)** — HIGH. The `cutSceneStage` backdrop bitmap exists in extracted
   but isn't bundled, so every full-stage cutscene (intro / wasted / complete) plays over a flat colour
   fill instead of the real stage art. Actors on top are faithful, so the gap is the whole backdrop.
3. **Title / menu / overlay text (#2a/#2b)** — MEDIUM (= SS-1). System fonts (serif/monospace) instead
   of the `fnt_*` bitmap fonts, which are unbundled. Wrong glyphs/metrics across title, menus, HUD
   labels, captions. Already tracked as SS-1; the unbundled `fnt_*` family is the shared root cause.
4. **Rollover per-unit energy/XP bars (#8c)** — MEDIUM (= SS-2 floating-bar path). `fillRect` bars on
   hover instead of the real moveable-bar member frames; the level-star row beside them IS real.
5. **Room/screen transition fade (#1)** — LOW. A black-alpha approximation of the engine `#flick`/`#fade`.
   No member art exists to reuse; it's a cosmetic tween mismatch, not a dropped asset.

### Faithful (reuses-real) — verified, no action: 
exit arrows (#3), freeze/glow colourTransform (#5), cursor/none (#6), charge orb + summon-icon (#7),
level-up stars (#8a), rollover level stars (#8b), stretch-death + grave (#9), player HUD surround +
medikit icons. The prior "ALREADY RESOLVED" claims for the orb, arrows, stars and HUD surround hold up.

### Notable: bundled-but-unused families
The `*_explode` anim strips (17 families) and `cutSceneStage.png` are present in `extracted` AND (for the
explode strips) already in the bundle, yet no render code references them — a clean "subsystem replaced,
asset family orphaned" signature. `fnt_*` remains unbundled (SS-1).

---

SS-inventory | PROCEDURAL=5
Procedural (non-faithful): explosion/splash VFX (no `*_explode` strip drawn); cutscene/wasted backdrop (`cutSceneStage` unbundled, flat fill); title/menu/overlay text (system fonts, `fnt_*` unbundled = SS-1); rollover per-unit energy/XP bars (`fillRect`, not the real bar member = SS-2); room/screen transition fade (black-alpha approximation of `#flick`/`#fade`).
