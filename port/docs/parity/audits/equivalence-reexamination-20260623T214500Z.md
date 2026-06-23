# Equivalence Re-Examination — 20260623T214500Z

Skeptical re-audit of every documented DEVIATION / PARTIAL / EQUIVALENT / REUSES-REAL / PROCEDURAL /
"out of scope" / "deferred [resolved]" claim across the parity tables, `substituted-subsystems/*`,
`plans/K*`, and `code-vs-ts/*`. Per the AUDIT-CHARTER, every such verdict was treated as a SUSPECT and
re-derived from the cast (`casts/`) + extracted art (`extracted/`), not trusted. Read-only; no source
edited.

**Headline:** the codebase has, since most of these audit docs were written (many predate the
2026-06-22 "Wave 11-12" + SS-* fix commits), SHIPPED the overwhelming majority of the procedural/gap
claims. The single named "KNOWN LIVE LEAD" (cutscene backdrop) is a **FALSE POSITIVE** — the asset is a
1×1 colour swatch, so the port's flat fill IS faithful. Two genuinely-open FIXABLE-NOW items remain,
both low-to-medium impact. No high-impact dropped-art-to-fallback bug survives.

---

## Tally

- **GENUINELY-EQUIVALENT ✓ (claim was a suspect; re-verified faithful):** cutscene backdrop (1×1 swatch),
  freeze/glow colourTransform, no-cursor, room/screen `#flick`/`#fade` (engine transition, no art),
  exit arrows, charge orb + summon-icon, stretch-death/grave, player HUD surround, `#foregroundPassive`
  map layer (defined `#none` in shipped content), stretch-death "collapsed-to-instant" (it isn't),
  K1–K17/K19–K22 backlog resolutions (verified invoked in code).
- **STALE-BUT-FIXED (doc still says PROCEDURAL/GAP; code has since shipped the fix):** title-screen
  composition, all 17+ `*_explode` strips (projectile/mine/beam), SS-hud families 1/2/3
  (`_writing`/`gmg`/`wizard`), rollover bar team colour, `small` bitmap-font off-by-one, cutscene title
  cross-fade, cutscene speech-above-head, CPU enemy charge-orb wind-up, charge-orb `Math.max(4,…)` floor.
- **ACTUALLY-A-GAP:** 1 (cutscene teleport beam — see B1).
- **FIXABLE-NOW (real art in extracted, dropped to a fill/no-op):** 1 (credits fade-mask art — see C1).

---

## A. The named KNOWN LIVE LEAD — OVERTURNED (GENUINELY-EQUIVALENT ✓)

**Claim:** `substituted-subsystems/SS-inventory.md:22,43-45` (item #2c, PROCEDURAL/HIGH) —
"`05433_cutSceneStage.png` EXISTS in extracted, NOT bundled, so cutscenePlayer.ts draws a flat fill
instead of the real stage art … the gap is the whole backdrop." Briefed as the FIXABLE-NOW exemplar.

**Evidence (overturns the claim):**
- `extracted/engine/bitmaps/05433_cutSceneStage.png` is **1×1 px, 70 bytes** (`manifest.json:1866` →
  `"w":1,"h":1`). It is a sprite *placeholder*, NOT artwork.
- `casts/master_objects/cutSceneMaster.txt:40` `pBackgroundMember = member("cutSceneStage","gfx")`;
  `:102-126` takes that sprite's `.rect` as `pStageRect`; `:148-149` `backgroundColour` →
  `setSpriteColour`. `objCutSceneBackGround` is just `objSpriteMember` + `modColourTransform` — there is
  no image-draw path. The "backdrop" is a 1×1 sprite **stretched to the stage rect and tinted** = a
  solid colour fill that colour-tweens and can random-flash.
- Port `cutscenePlayer.ts:84-85` `ctx.fillRect(0,0,viewW,viewH)` of `t.bg`; the colour-tween +
  random-flash are modelled in `thespian.ts` (`bg`/`bgTarget`/`bgFlash`, K16 `startBgRandomFlash`
  `:409`, `backgroundColourTo` `:287`). cutscene.ts parses `backgroundColourRandomFlash`/`backgroundColourTo`.

**Verdict: GENUINELY-EQUIVALENT ✓.** Bundling the 1×1 PNG would change nothing (or, mishandled, stretch
a junk pixel). The flat fill *is* the original `cutSceneStage`. This was already corrected by a later
audit (`audits/cutscenes/visual-fidelity.md:16-51`) that SS-inventory was never updated to reflect.
Confirmed independently by the K-backlog re-audit agent. **Do not bundle cutSceneStage.**

---

## B. ACTUALLY-A-GAP

### B1. Cutscene teleport-in/out is a plain pop — the existing stretch+fade beam is not wired in — MEDIUM

- **Claim source:** `audits/cutscenes/RESWEEP-20260623T072110Z.md` ("teleport presentation … noted for
  completeness") downgraded it to "borderline / not counted in headline GAPS — a pure VFX flourish."
  Re-examined as a suspect per charter lens 3 (trusted documented divergence).
- **Original:** `casts/script_objects/modTeleport.txt:118-200` — `teleportInAt`/`teleportOut` play a
  vertical-STRETCH + alpha-FADE on the actor's current strip (`setSpriteHeight` tall→natural + transBlend
  `#in`; natural→tall + transBlend `#out`), then fire teleportIn/OutFinished. Used to OPEN nearly every
  chatter-stone cutscene (`stones1/3/4/5-10` all begin with `teleportInAt`).
- **Port gap:** `thespian.ts:267` `teleportInAt → at(p,loc); setMode(p,"teleportIn")` and `:268`
  `teleportOut → setMode(p,"teleportOut"); gotoWings(p)`. `setMode` only sets `modeOverride`, routed to
  `Anim.animAction` (anim.ts:159) → resolves `${char}_teleportIn` → falls back to `${char}_stand`
  (no such strip). The actual stretch/fade is driven by `Anim.this.teleport`, set ONLY by
  `Anim.startTeleportIn()/startTeleportOut()` (anim.ts:104-105) — **which the cutscene path never calls.**
  So actors pop in/out instantly with no beam, while the faithful mechanism sits unused.
- **Key point:** the stretch+fade mechanism ALREADY EXISTS in the port (`anim.ts:79-106`, `TELE_FRAMES=15`
  = `pTeleportFrames`) and IS used by gameplay army summon/desummon. This is a wiring gap, not missing code.
- **Verdict: ACTUALLY-A-GAP (player-visible in every chatter cutscene opening).**
- **Fix sketch:** in `thespian.ts:267-268`, call `p.entity.get(Anim).startTeleportIn()` /
  `startTeleportOut()` (alongside/instead of `setMode`), and gate `teleportOut`'s `gotoWings(p)` /
  any removal on `Anim.teleportOutDone()` so the out-beam plays before the actor leaves. No new art
  (it is a procedural stretch, correctly with no `_teleport` strip in extracted).

---

## C. FIXABLE-NOW (real art exists in extracted, dropped to a fill)

### C1. Credits scroll fade-mask art unbundled → plain fillRect scroll — LOW

- **Claim source:** `plans/K12-K22-shell-render.md:112-114` (credits = scrolling `txt_credits` member);
  doc lists K18 credits as resolved. Re-verified.
- **Original:** `casts/master_objects/creditsMaster.txt` scrolls credits behind top/bottom fade masks.
  Art exists in extracted, all UNBUNDLED:
  - `extracted/engine/bitmaps/06796_credits_fadey_block_topC.png`
  - `extracted/engine/bitmaps/07026_credits_fadey_block_bottomC.png`
  - `extracted/engine/bitmaps/07085_credits_fadey_mask_topC.png`
  - `extracted/engine/bitmaps/06873_credits_fadey_mask_bottomC.png`
  - `grep -c credit|fadey assets.json` = **0** (none bundled).
- **Port gap:** `src/scenes/screens.ts:95-109` `renderCredits` — plain `fillRect` bg + system-serif
  scrolling `CREDITS[]` (a port-authored placeholder array, `:50-65`), no top/bottom fade masks.
- **Verdict: FIXABLE-NOW (fade-mask art); plus a residual content gap** — the credits *text* lives in the
  Director `txt_credits` member (`creditsMaster.txt:29`), not extracted as data (no `txt_credits.txt`),
  so the placeholder text is a genuine content gap, not a dropped asset. Low impact (post-completion).
- **Fix sketch:** add the 4 `credits_fadey_*` PNGs to `build_assets.ts` `MEMBER_NAMES`; composite a
  top/bottom fade mask over the scroll in `renderCredits`. If `txt_credits` content can be recovered from
  the original cast, substitute it for the placeholder array.

---

## D. STALE-BUT-FIXED — claims re-verified as already shipped (do not re-file)

Each was a documented PROCEDURAL/GAP/DEVIATION; the current code ships the faithful path:

| Claim (doc) | Was claimed | Current code (verified) |
|---|---|---|
| Title screen (`SS-inventory.md:20` 2a PROCEDURAL fillText) | system-font "MERLIN'S REVENGE" | `main.ts:466 a.titleSprites()` draws the recovered Score-frame-30 glyph/tile/sprite composition (`title-screen-composition.md`); fillText is pre-load fallback only. Real glyph bitmaps bundled (`00053_M` … in `title[]`). |
| Explosion `*_explode` strips (`SS-inventory.md:24,39` #4 HIGHEST "NEVER requested") | 17 families bundled-but-never-drawn | `projectile.ts:85,132` + `mine.ts:96` + `main.ts:709,724` all draw `drawBulletSprite(...,"_explode",false)`. SS-vfx-polish 2a/2b/2c confirm projectile/mine/beam burst. Spell orb #explode = orb-fade is itself faithful (`objSpell getAnimSym #explode→#charge`). |
| SS-hud F1 `_writing` captions (`SS-hud-families.md:79`) | 19 unbundled + instant-removal | 38 `_writing` keys bundled; `PICKUP_WRITING` map `main.ts:577`; `pickup.ts:57 writingPhase()` keeps entity alive through `WRITE_FADE` (instant-removal core gap fixed). |
| SS-hud F2 GMG icon (`SS-hud-families.md:207`) | unbundled + undrawn | `gmg_on/off` bundled; drawn `main.ts:535-537` gated on `getGmgCollected`, swap on `getGmgOn`. |
| SS-hud F3 wizard portrait bar (`SS-hud-families.md:297`) | unbundled + undrawn | `wizard_on` + per-wizard `_off` bundled; drawn `main.ts:542-550` with the yellow `wizard_on` marker overlay. |
| Rollover energy bar colour (`RESWEEP-20260623T072411Z.md` F2 GAP) | `healthBarColour` gradient | `rollover.ts:51 teamColourCss(getTeam)` (`teamColour.ts` real `tem_*` values); width tracks HP, colour = team. |
| `small` font off-by-one (`RESWEEP-…F1` HIGH) | every glyph shifted, 'A' blank | `bitmapFont.ts:85 (i+cellOffset)`; `assets.json` `small.cellOffset:1`. |
| Cutscene title pop/colour (`cutscenes/visual-fidelity.md:70`) | pops on, never leaves, wrong gold | `cutscenePlayer.ts:113-118` cross-fades via `t.titleAlpha`, gold `#cccc00`, holds; `thespian.ts:199` title lifecycle (fade-in/hold-150/fade-out). |
| Cutscene speech caption BAR (`cutscenes/visual-fidelity.md:140`) | VN bottom bar (port invention) | `cutscenePlayer.ts:121-132` bare centred text above the speaker's head (`wrapCentered`), no bar. |
| CPU enemy charge-orb wind-up (`SS-vfx-polish.md:12` REAL GAP) | orb springs into being already flying | `control.ts:837-862 windupSpell` spawns the orb over the CPU caster's head during wind-up, `setCharge` grows it, release reuses it. |
| Charge-orb size floor (`RESWEEP-spell-charge-…`) | `Math.max(4,size)` min | floor removed; `sa.size()` used directly (1px orb at charge-1). |
| ~9 "slice enemies render as blackOrc fallback" (`02-…:21,54,176`) | procedural/fallback sprite | all resolve own `_stand` via `spriteCharOr` (`anim.ts:30-50`); `skeletonWarrior`→`skelitonFootSoldier` alias (`anim.ts:25`). Real art. |
| "No modGrave/drawGrave — dead actors leave no grave" (`05-…:54,154`; `02-…:144`) | grave sprite missing | 100 `<char>_grave` anims bundled; dead actors persist (`main.ts:338-344`), `Anim.pickAction` dead→`grave` (`anim.ts:158,225`), drawn `main.ts:393`. Ghosts correctly none (`grave.ts:19`). |
| "No on-map exit arrows" (`05-…:50,140`) | absent | `arrows` block bundled, blitted `main.ts:619-636`, rects `rooms.ts:316-360`. |
| "Generic bullet for ~18 bullet actors" (`03-…:97`) | one generic bullet | per-actor `<char>_fly` drawn (`main.ts:725,738`); `bulletChar` from each actor's `#bullet` record (`archetypes.ts:37`). Dot fallback only for record-less art-less enemy bolts. |

---

## E. GENUINELY-EQUIVALENT ✓ — suspects re-verified faithful (one line each)

- **Cutscene backdrop** — 1×1 swatch tinted+stretched = the flat fill (see A).
- **Freeze/glow/colourTransform** (`SS-inventory.md:25`) — original tints the unit's OWN sprite
  (`modColourTransform.setSpriteColour`); the port's offscreen source-atop tint is the equivalent. No member.
- **Cursor / aim reticle** (`SS-inventory.md:26`) — original uses the OS cursor; no member to substitute.
- **Room/screen `#flick`/`#fade`** (`SS-inventory.md:19`, `05:line` PARTIAL) — `objScreen.txt:63-67` are
  engine transitions with NO member art; the black-alpha fillRect is the only possible substitute. Low.
- **Exit arrows** (`SS-inventory.md:23`) — 13 `arrow_*` keys bundled, tiled per edge. REUSES-REAL ✓.
- **Charge orb + summon icon** (`SS-inventory.md:27`) — `spell_charge` + `spellIcons_*` bundled & drawn.
- **Level-up / rollover stars** (`SS-inventory.md:28-29`) — `experienceStar` / `star_*` bundled & drawn.
- **Stretch-death + grave** (`SS-inventory.md:32`) — original transforms the body sprite (no member);
  port `anim.ts:209` stretches scaleY + fades. The "collapsed-to-instant" charter example does NOT apply
  here — it's a real multi-frame `STRETCH_DURATION=33` tween.
- **Player HUD surround** (`SS-inventory.md:33`) — `health_bar_surround` + `medikit_on/off` bundled & blitted.
- **Weapon-selector palette** — 24 `weaponIcons` (scroll/box) bundled & mapped (`weaponPalette.ts:79`);
  the fillRect+label is a pre-load fallback only.
- **`#foregroundPassive` over-actor layer** (`05-world-render-shell.md:137`) — `structMaster.txt:524`
  defines it `#none`; no shipped map uses it. Correctly out-of-scope, not a dropped asset.
- **K1–K22 backlog** — re-audit confirmed every claimed resolution has a real, invoked code site
  (K2 spell lifecycle, K3-K8a AI cluster, K9-K11 summon/charge, K12 chatter cutscenes, K13 room-state,
  K14 beam strip, K15 transColor tween, K16/K17 verbs+faders, K19 transitions, K20 8-ch mixer, K21
  graves, K22 exit arrows). K8b/K8c correctly left unbuilt (0 placements).

---

## F. Residual cosmetic PARTIAL (not a dropped-art gap — noted, not ranked)

- **`screens.ts` overlay text uses system fonts.** The army-reserve / instructions / key-config / credits
  overlays draw via raw `ctx.fillText` (system serif/monospace) at `screens.ts:106,155,161,173,177,203,206,
  216,223` instead of routing through `drawText`/the bundled bitmap faces that `main.ts` + `cutscenePlayer.ts`
  already use. This is the residual tail of SS-1. NOT a dropped-art gap (the original `episode`/`version`/
  credits members are live Director TEXT FIELDS with no `BITD`, per `title-screen-composition.md:82`), but
  the bundled `menu`/`small` faces could cover most glyphs. Low impact (secondary overlays); `menu` sheet
  lacks digits/arrows, so the conversion is partial. Both background agents independently flagged this.

## Notes / one residual doc-vs-code discrepancy (not a gap)

- **K2 spell calibration:** `plans/C` / K-docs assert "base-charge energyBlast fells a 300-energy enemy,"
  but `spellActor.ts:26-37` documents that invariant was DELIBERATELY discarded (`SPELL_RADIAL_SCALE =
  MELEE_SCALE = 2.5`, base centre ≈69) as an intentional spell/melee re-calibration. Intentional; flagged
  only because it contradicts the plan's stated gate. Not a code gap.
