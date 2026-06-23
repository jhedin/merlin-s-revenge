# Cross-cutting census — systemic data-pipeline gaps (refresh)

A refresh of the field-key census + source→output reconciliation, scoped to find **systemic**
gaps (a dropped `#field` across many actors, an unbundled asset family, a default that masks
data) — NOT per-actor bugs (per-actor sweep) and NOT substituted subsystems (separate audit).

Method, by pass:
- **A** — enumerate every distinct `#key` in `casts/data/*.txt` (top-level + `#attack`/`#weapon`),
  diff against `port/src` references, then VERIFY each candidate by tracing the actual consumer
  (`registry.resolveActor`/`resolveAttack`/`archetypes`/components) — "referenced in src" ≠ "consumed"
  (could be comment-only) and "unreferenced" ≠ "bug" (could be inherited-default no-op).
- **B** — classify all 3104 `extracted/manifest.json` bitmaps + `extracted/{sounds,music}` by family,
  simulate `build_assets.ts`'s matchers, and list families it does NOT bundle.
- **C** — read every `num(k,DFLT)` / `?? DFLT` in the spawn paths; for each, compare DFLT to the
  resolved struct/inherit default and count how often data would override it.

This pass found **no new high-severity systemic gap**. The session's prior fixes are confirmed
landed (see end). The open items below are the cosmetic/visual tail; the two B families are the
most material (whole UI elements unrendered, but cosmetic).

---

## PASS A — dropped / unconsumed `#key`s (top-level + #attack)

Census: 152 top-level keys, 94 attack keys. After verifying each non-noise candidate against its
consumer, the genuinely **parsed-but-dropped** keys are below. Every high-cardinality "unreferenced"
hit turned out to be either consumed-via-different-name, an inherited no-op, or a false positive
(actor/symbol name caught by the `#key:` regex). Net: only **cosmetic, low-count** real drops remain.

| #key | scope | #actors set | consumed? | gameplay effect | severity |
|---|---|---|---|---|---|
| `#speechColor` | top | 33 | NO | colour of an NPC's chatter/speech text; port draws speech in a fixed colour | Cosmetic |
| `#initFaceDir` / `#startOffset` | top | 23 / 23 | NO | initial facing + spawn pixel-nudge; port spawns at the placed loc facing default | Cosmetic |
| `#explodeVolume` | top | 3 | NO | per-actor detonation SFX volume (sound itself plays) | Cosmetic |
| `#dieVolume` | top | 2 | NO | per-actor death SFX volume (dieSound plays) | Cosmetic |
| `#takeHitSoundVolume` | top | 1 | NO | per-actor hit SFX volume (takeHitSound plays) | Cosmetic |
| `#counterColour` | top | 5 | NO | bar/counter tint | Cosmetic |
| `#chargeOffsetSide` | top | 6 | NO | caster spell-charge spawn offset for `#side` casters (only `#top` wired) | Minor |
| `#splashGraveOn` | top | 2 | NO | impact-crack grave sprite (cracks/towerAxe) | Cosmetic |
| `#layerZ` | top | 5 | NO | Director render layer (engine-internal; port has fixed z-order) | Faithful |
| `#stallSpeedIncLevel` / `#buildRateInc` | top | 6 / 2 | NO | per-level stall/build-rate growth (side-view / builder micro) | Minor |
| `#walkType` (`#anyDirSpeed`) | top | 1 (base) | NO | omni-dir top-down move — port already does this | Faithful no-op |
| `#immuneToAttack` | top | 1 (`tem_chatters`) | NO | NPC-template invuln flag (chatter stones are non-combat anyway) | Faithful |
| `#minCollisionSpeed`/`#overlapToLeaveRoom`/`#pathFindingTime`/`#createOnSolid`/`#jumpPower`/`#initLoc`/`#masterPrg`/`#propCarryLoc`/`#gmgChargeLoc` | top | 1–2 each | NO | engine-internal / side-view / placement | Faithful |
| `#collideWithTarget` | top | 9 | NO | mine/aura "don't hit the target unit, splash only" — port's splash path is area-only, so respected inherently | Faithful |
| `#dammageMultiplier` (typo) | atk | 2 | NO | OGB-1: the original reader uses the correct `damageMultiplier` too — faithful to drop | Faithful (OGB) |
| `#throwType` | atk | 2 | NO | throw-arc model (side-view lob) | Faithful |

**Verified NON-issues (would otherwise look like big drops):**
- `#charSize`/`#thekey` (4 "actors") — **NOT** actor render-scale. They live in `fnt_*_properties.txt`
  (font glyph dimensions + character set), part of the known `fnt_` exclusion. The prior census's
  "wrong sprite size" worry is a false alarm; no actor uses `#charSize`.
- `#damageSpeed` (97), `#teamRole`, `#graveOn`, `#frictionReel` (34), `#eyestrain` (67),
  `#takeHitSound`/`#takeHitVolume` (9/8), `#dieSound` (73), `#collectSound` (22), `#chargeVolumeMap`(16),
  `#mana_capacityIncLevel` (15) — all **now consumed** (this session's fixes — see end). Confirmed in
  `archetypes.ts`/`weapon.ts`.
- `#spell3..8`, `#summonWarrior/Golem/Boulder`, skeleton-part names, named-wizard symbols — false
  positives (symbol/tier values, not field keys).

---

## PASS B — unbundled `extracted` asset families

`build_assets.ts` bundles: `anm_*` (all 171 chars incl. `anm_spellIcons_*`), 10 tilesets (`tlk_*`),
47 maps + tile-keys, SFX (vocab-matched) + music, exit arrows, `*_ws*` weapon/wizard icons,
`*_potion`/`*_scroll`/mini-/star-/health-/medikit static members, cutscenes (intro/wasted/complete/
stones1-10). Of 3104 bitmaps, the families it does NOT bundle, classified:

| family | #bitmaps | what it is | port handling | severity |
|---|---|---|---|---|
| `*_writing` | 19 | powerup-collect name caption (`objPowerUpWriting` — "Energy Blast"/"Medikit"/… fades over the pickup on collect) | NOT rendered — `pickup.ts` applies the effect with no caption fade | **Cosmetic (whole family)** |
| `<wizard>_off` + `wizard_on` | 9 | the wizard-summon HUD bar portraits (`wizardMaster`/`objWizardDisplayer`: `<name>_off` portrait per found wizard + a yellow `wizard_on` selection box) | NOT rendered — `WizardMaster` tracks found/selected but draws no portrait bar | **Cosmetic (whole family)** |
| `gmg_off` / `gmg_on` | 2 | GMG (golden-machine-gun) HUD on/off toggle icon (`gmgMaster`) | NOT rendered — `control.ts` tracks `gmgOn` state, no HUD icon | Cosmetic |
| `credits_fadey_block/mask_*` | 4 | fade-edge mattes for the credits scroll | port renders credits as a plain text scroll (`screens.ts`) — mattes are decorative | Faithful |
| `fnt_*` (`smallCC`/`menuB`/`smallgreyCC`/`numbersC9S`) | 4 | bitmap-font glyph sheets | KNOWN exclusion — port renders text with the canvas font | Faithful (known) |
| `dot`/`dot_left/right/up` | 4 | 1-px bar-fill primitive (`objEnergyBar`/`objExperienceBar`) | port draws bars with canvas rects | Faithful |
| `N`,`M`,`V`,`prg_*`,`help_*`,`background*`,single-letters | ~95 | Director runtime/script members + bg/help art (mostly mangle noise) | engine-internal / not gameplay | Faithful |

Net new vs the known `fnt_` exclusion: **two cosmetic UI families** (`*_writing` collect-captions,
`<wizard>_off`+`wizard_on` summon-bar portraits) and the `gmg_*`/`credits_fadey` toggle/matte art.
None affects gameplay state; each is a missing/absent HUD overlay.

---

## PASS C — defaults that mask data

Every `num(k,DFLT)` in the spawn paths was checked against the resolved inherit/struct default and
data coverage. The spawn defaults are sound: where the DFLT differs from a base value, the inherit
chain (`act_actor`→`act_character`→`act_CPUCharacter`) supplies the real value first, so the DFLT only
fires for actors genuinely missing the key. No default was found to silently override commonly-set data.

| port default | DFLT | base/struct default | data coverage | masking? | severity |
|---|---|---|---|---|---|
| `walkSpeedIncLevel = walkSpeed>0 ? 0.045 : 0` | derived | data `#walkSpeedIncLevel` | 4 actors set it = `0`, all with `walkSpeed:0` | NO — the `walkSpeed>0?` derivation already yields 0 for exactly those 4; coincidentally faithful, but it does IGNORE the literal `#walkSpeedIncLevel` field | Faithful (no live effect) |
| `dexterity` | 0.2 | `act_character` = 1 | 100 actors set it; rest inherit `1` | NO — chain supplies 1; the 0.2 DFLT is unreachable for real CPUs | Faithful |
| `energy` | 100 | `objCharacter.new` seeds 100 | 113 actors set it | NO — matches the engine seed | Faithful |
| `energyRecoverDelay` | 300 | `objCPUCharacter` overrides 30→300 | 1 actor sets it | NO — 300 is the real inherited CPU value (NOT 0) | Faithful (deliberate) |
| `box` (collision size) | 14 / 24 | data `#collisionRect` | 22 actors set `#collisionRect` | PARTIAL — hardcoded for combat; but 18 of the 22 are stones/chatters/wizards whose trigger box IS read from `#collisionRect` by `chatter.ts`; only ~4 combat actors (ochreHydra/berlin/king) use a fixed 14 instead of their rect | Minor |
| `frictionReel.x` | 10 | `act_CPUCharacter` = point(10,10) | 34 set it | NO — DFLT == base | Faithful |
| `bufferDist` | 100 | — | 0 actors set it | NO | Faithful |

The one literal-vs-derived mismatch (`walkSpeedIncLevel`) has zero live effect today (the derivation
agrees with the data for all 4 actors). The `box` hardcode masks `#collisionRect` for ~4 combat actors
only; the trigger-box use (stones/chatters) already reads the rect. Neither rises to a systemic gap.

---

## Confirmed RESOLVED this session (re-verified, do not re-flag)

Traced each into the live port:
- **damageSpeed** — `damageSpeed: num("damageSpeed", 5)` forwarded in `spawnEnemy` (`archetypes.ts`).
- **teamRole** — `teamRole: str("teamRole", "#teamMembers")` (towers join `#teamBuildings`).
- **targetRoles tiers** — `targetRoles: Array.isArray(...) ? ... : [["#teamMembers","#teamBuildings"]]`.
- **reach clamp** — melee reach from `#collisionLoc.x` clamped once to `[16,90]`, fed to approach + area.
- **graveOn** — `graveOn: d["graveOn"] !== false` (`#graveOn:false` → vanish, no grave).
- **friction** — bullet `#friction` resolved in `resolveAttack` (5 refs); actor `#frictionReel.x` forwarded.
- **cadence** — `effectiveCooldown`/`attackFireFrameOffset` per-actor fire-frame recovery (replaces flat +18/+6).
- **#name sprite** — `spriteCharOr(actorName)` resolves the faithful `#name` sprite char.
- **case-fold** — `lcPartitions` lowercase fallback index in `registry.ts` (Lingo case-insensitive symbols).
- (bonus, also confirmed consumed) **takeHitSound/takeHitVolume/dieSound/collectSound/mana_capacityIncLevel/eyestrain**.

All present and correct.

---

census | OPEN=5
Top open systemic gaps: (B) `*_writing` powerup-collect captions [19 sprites] + (B) `<wizard>_off`/`wizard_on` summon-bar portraits [9 sprites] both unbundled & unrendered; (B) `gmg_off/on` HUD toggle icon unrendered; (A) `#speechColor` [33 actors] + `#initFaceDir`/`#startOffset` [23 each] dropped — all COSMETIC, no gameplay-state effect.
