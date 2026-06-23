# Per-actor blindspot census — what the per-ACTOR pass structurally could not reach

**Date:** 2026-06-23 · **Scope:** every `casts/script_objects/*.txt` + `casts/master_objects/*.txt`,
mapped to its port home and tagged by which audit pass (if any) ever reached it. The per-actor sweep
(`per-actor/*.md`) examined enemy/ally/spell/pickup archetypes **in isolation**; by construction it is
blind to MASTER/MANAGER singletons, GLOBAL systems, the DATA-TRANSLATION layer, CROSS-ACTOR seams, and
emergent timing. This census enumerates those, verifies the existing `cross-cutting-census.md` /
`data-pipeline-census.md` / `code-vs-ts/*` mappings, and ranks the objects **no audit pass ever reached**.

**Method.** (1) Enumerated all 39 `master_objects` + 199 `script_objects`. (2) For each, located its port
home (`grep` the symbol/behavior in `port/src`) and classified it. (3) Tagged coverage by scanning every
`port/docs/parity/audits/**/*.md` for the object name (excluding this file + the two prior censuses).
(4) Spot-checked the 4 highest-impact never/weakly-reached masters by reading the Lingo + the port:
**reservationsMaster, weaponMaster, showArmyMaster, characterEnergyRollOverMaster**.

**Headline.** The two prior censuses + the `code-vs-ts/` master sweep are broad: 12 masters have a dedicated
`code-vs-ts` doc and ~17 more are reached in passing. The genuine blindspots are **(a) one stale verdict that
DRIFTED** (`_globals.md` says no global unit cap; the port now has one in `teams.ts`), **(b) several REAL
masters mapped to a port home but never audited for parity** (reservationsMaster cap-from-data,
showArmyMaster layout, rollover.ts), and **(c) a cluster of faithfully-absent editor/online masters** that
deserve a one-line "out of scope, confirmed unreferenced by data" stamp so they stop showing up as gaps.

---

## A. MASTER / MANAGER singletons — coverage matrix

Legend — Class: `MGR`=manager singleton · Port: file or NONE · Audit: `cvt`=code-vs-ts doc ·
`pa`=per-actor · `ss`=substituted-subsystems · `xc`=cross-cutting/pipeline · `—`=none ·
Cov: ✅ audited / 🟡 reached-in-passing only / 🔴 never reached.

| Master (cast) | port home | Class | Audit doc(s) | Cov | Note |
|---|---|---|---|---|---|
| actorMaster | engine/dispatch + archetypes (newActor) | MGR | cvt/actorMaster | ✅ | spawn factory |
| armyMaster | systems/armyMaster.ts | MGR | cvt/armyMaster, RESWEEP-save | ✅ | bank/retire |
| teamMaster | systems/teams.ts | MGR | cvt+pa (97 docs) | ✅ | targeting/roster |
| gameMaster | main.ts / game loop | MGR | cvt/gameMaster | ✅ | top-level FSM |
| mapMaster | world/map.ts + rooms.ts | MGR | cvt/mapMaster | ✅ | |
| collisionMaster | world/collision.ts | MGR | cvt/collisionMaster | ✅ | |
| cutSceneMaster | scenes/cutscenePlayer + thespian | MGR | cvt/cutSceneMaster, cutscenes/* | ✅ | |
| soundMaster | systems/audio.ts | MGR | cvt/soundMaster | ✅ | |
| potionMaster | systems/potionMaster.ts | MGR | cvt/potionMaster | ✅ | |
| structMaster | data/registry + struct merge | DATA | cvt/structMaster | ✅ | struct merges |
| keyMaster | systems/input.ts | MGR | cvt/keyMaster | ✅ | |
| magicLimitMaster | systems/magicLimit.ts | MGR | cvt/_statusEffects, pa/magicLimit* | ✅ | |
| **reservationsMaster** | **systems/teams.ts `atCapacity`** | **MGR** | cvt(passing in summoner docs) | **🟡→🔴** | **see SPOT-CHECK 1 — gMaxEnemies/Friends cap; `_globals.md` verdict DRIFTED, never audited as a unit** |
| **showArmyMaster** | **scenes/screens.ts `renderShowArmy`** | **MGR/UI** | (named only in screens.ts) | **🔴** | **see SPOT-CHECK 2 — reserve-army paginated grid; NO placement/layout-parity audit** |
| **weaponMaster** | **(drop/fetch) NONE; carry via weapon.ts** | **MGR** | — | **🔴** | **see SPOT-CHECK 3 — droppable shared-weapon AI; faithfully inert (no data uses objAICPUWeaponSeek) but never confirmed** |
| **characterEnergyRollOverMaster** | **render/rollover.ts** | **MGR/UI** | ss/SS-2, cvt/gameMaster (passing) | **🟡** | **see SPOT-CHECK 4 — mouse-hover health/level/XP; rollover.ts never audited for layout/liveness** |
| medikitMaster | components/medikit.ts + render | MGR | rendering-fidelity (passing) | 🟡 | counter spacing flagged elsewhere; medikitMaster singleton itself not audited |
| starMaster | components/experience (XP star spawn) | MGR | pa/experienceStar, cvt/_deathFlow | 🟡 | `starBurstX`/`markerStar`/`experienceStar` spawn helpers — only experienceStar path audited; starBurst (4-way) + markerStar unverified |
| wizardMaster | systems/wizardMaster.ts | MGR | ss/SS-hud-families, pa/actor | 🟡 | found/selected tracked; portrait HUD bar UNRENDERED (xc PASS B) |
| gmgMaster | components/control.ts (gmgOn) | MGR | ss/SS-hud-families, pa/gmgBullets | 🟡 | state tracked; `gmg_on/off` HUD icon UNRENDERED (xc PASS B) |
| spriteMaster | render/renderer.ts (z-order, hideAll) | MGR | cvt/objGameObject, _globals (passing) | 🟡 | 2D path only (g3DMode=0); layerZ fixed |
| screenMaster | scenes/sceneManager + screens.ts | MGR | ss/SS-inventory, cvt/_resweep (passing) | 🟡 | transition/screenOn-Off flow not parity-audited as a unit |
| enemyEnergyMaster | NONE (gEnemyEnergyMasterOn=0) | MGR | cvt/_globals | ✅ | faithfully off — verdict CLEAN |
| frameTimer | engine/loop.ts (tick cadence) | GLOBAL | pa/game (passing) | 🟡 | frame pacing; never parity-checked against `frameTimer` deltas |
| animStripMaster | data/tlk.ts + render/assets (anim build) | DATA | pa (4, passing) | 🟡 | strip assembly is build-time; pipeline.test covers presence not framing |
| memberMaster | render/assets.ts (member lookup) | DATA | — | 🔴 | Director cast-member registry; port resolves via assets.json — confirm no behavior lost |
| collectionsMaster | systems/teams + struct (collections) | DATA | cvt/actorMaster, cutscenes/stones (passing) | 🟡 | team #collectables grouping |
| mouseMaster | systems/input.ts (pointer) | MGR | cvt/keyMaster (passing) | 🟡 | pointer loc; rollover + menu use it |
| movieMaster | main.ts boot / scene routing | MGR | cvt/gameMaster (passing) | 🟡 | 3D-init branch dead (g3DMode=0) |
| profileMaster | NONE | MGR | — | 🔴 | online player-profile/highscore — OUT OF SCOPE (no port net layer) |
| copyProtectionMaster | NONE | MGR | — | 🔴 | site-lock DRM — OUT OF SCOPE (correctly dropped) |
| creditsMaster | scenes/screens.ts (credits scroll) | MGR/UI | xc PASS B (fadey mattes) | 🟡 | text scroll done; fade mattes cosmetic-absent |
| controllerMaster | NONE | MGR | — | 🔴 | map-editor input controller — OUT OF SCOPE |
| keyChooseMaster | scenes/screens.ts (keyConfig) partial | MGR | — | 🔴 | key-rebind UI; port has a keyConfig overlay shell — rebind flow unverified |
| mapEditMaster | NONE | MGR | — | 🔴 | in-game MAP EDITOR — OUT OF SCOPE (no editor in port) |
| reservationsMaster (old_) | NONE | MGR | cvt/_globals (gMax consts) | ✅ | legacy; gMaxEnemies/Friends consts read, superseded by reservationsMaster |
| XMLmaster | NONE (build reads txt, not XML) | DATA | — | 🔴 | XML cast I/O — OUT OF SCOPE (port consumes pre-extracted txt/json) |

---

## B. SCRIPT_OBJECTS — the non-actor units (modules, obj* infra, editor/UI)

The per-actor `covered-by-extension.md` accounts for every `act_*` data file. The `script_objects` that are
**behavior modules** (`mod*`) and **engine/UI objects** (`obj*`) are the per-actor pass's other blindspot —
many are covered by `code-vs-ts/mod*` / `code-vs-ts/obj*` docs, but a residue is not. Grouped by status:

**Audited (have a code-vs-ts doc):** modAi, modAttack, modCharacterAttackProperties, modColourTransform,
modEnergy, modExperience, modExploder, modExtraLives, modFlasher, modFreeze, modGhost, modGrave, modHeal(→),
modMiniMap, modMoveToLoc, modPathFinding, modProp, modReel, modReincarnate, modScreenExits,
modSpellMultistage, modWeaponManager; objAiAttack, objAiCPU(+Builder/Ghost/SpellCaster/Summoner),
objAiPlayer, objBullet, objCPUCharacter, objCharacter, objChatter, objDwelling, objGameObject, objMine,
objPlayerCharacter, objPlayerMerlinCharacter, objPowerUp, objRoom, objSpell. → **covered.**

**Covered-by-component (mod has a port component, audited via its consumers):** modAnimSet/objAnimSet/
objAnimStrip→components/anim, modScale/modRotator/modRotational/modColourTransform→colourTransform+anim,
modFader→effects, modStretcher/modStretchDeath→stretch (duration_parity), modTeleport→teleport_stretch,
modPositioning/modMoveXY/modBoundary→movement, modCollisionDetection/modCollisionRect→collision,
modSplashDamage→splash, modStarReleaser→starMaster path, modFireBullets→bullets, modSummonWizard/
modSummonBerlin/modAutoSummon→summon, modArmyUnit→armyMaster, modWeaponSelector/modWeaponTechnique→
weaponTechnique, modSoundFX→audio, modWastedMode→wasted, modInvince→hurt, modSpriteMembers/modSprite/
modReel→anim, modThespian→thespian. → **reached transitively.** *(NB: these were verified by class in
`covered-by-extension.md`, not unit-audited — same TRUSTED-divergence caveat applies.)*

**🔴 NO port home / never reached (editor + Director infra — verify faithfully-absent):**

| script_object | what it is | port | classify |
|---|---|---|---|
| objBrushTool, objGrabberTool, objTool, objToolPalette, objCommandPalette, objGridSelector, objPalette, objMarker | **map-editor toolset** | NONE | dead/out-of-scope (no editor) |
| objMapController, objMapNode, objDataMap, objCollisionMap, objCollisionTile, objTileLayer, objTileMap, objTileSet, objTileSetKey | tile/map editor + runtime map model | partial→world/map.ts | DATA — runtime parts via map.ts; editor parts dead |
| objFileDude, objFolder, objNetRequest, objOutput | file/online I/O | NONE | out-of-scope |
| objButton, objImageButton, objTextButton, objEditField, objList, objScroll, objMenu(+Background/Controller/Title), objMenuBackgroundController | Director UI widget kit | scenes/menu.ts, screens.ts (reimplemented) | global-system — port reimplements; widget-level parity unaudited |
| objHair, objHairCharacter | player hair-collision subsystem | NONE | dead (gPlayerHair=0, _globals CLEAN) |
| obj3DSprite, objBox, objLine, objZone, objScreen, objScreenSequencer | 3D/primitive render infra | NONE | dead (g3DMode=0) |
| objKeyBinding, objKeyDescriptions | key-rebind model | screens.ts keyConfig shell | 🔴 rebind flow unverified |
| objUnitDisplayer, objWizardDisplayer, objGmgDisplayer, objMedikitDisplayer, objDisplayCounter, objMulticolourEnergyBar, objMoveable{Energy,Experience,Level}Bar, objEnergyBar, objExperienceBar | HUD displayer widgets | render/* (substituted) | covered by ss/SS-hud-families (cosmetic gaps logged) |
| objMusic, objPlayMusic(+Controller), objPlaySound(+Controller) | audio playback objects | systems/audio.ts | reached via soundMaster |
| objScript, objScriptPerformer, objModules, objModuleCatcher, objModule, objUpdater, objAutoUpdate, objEventNotify, objParams, objBasic, objListNode, objTimer, objText, objTextData, objTextImage, objFont, objTrans*, objTransformer | Director runtime plumbing | engine/* (reimplemented) | global-system — engine substrate, not parity-relevant |
| objNetRequest, objPlayMusicController | — | — | out-of-scope |

---

## SPOT-CHECKS (Lingo ↔ port confirmed by reading both trees)

### 1. reservationsMaster — HIGH IMPACT — verdict DRIFTED, never unit-audited
`master_objects/reservationsMaster.txt:56-74` `getPermissionToRelease`: a team holds at most
`team.maxMembers` live units; `currentMembers + reservedSlots + numToRelease <= maxMembers` gates EVERY
character-creating object (dwellings, summoners, invasions). `:62` halves a `maxMembers>5` cap when
`pTeamOverride` is set.
**Port:** `systems/teams.ts:58-62` `atCapacity()` — `cap = isPlayerSide ? 12 : 16; if (teamOverride && cap>5) cap=floor(cap/2)`; gated in `dwelling.ts:66` and `summon.ts:66`. **The cap IS implemented.**
**Finding:** `code-vs-ts/_globals.md:151-163` still asserts *"gMaxFriends — NO GLOBAL CAP / player can field
unlimited allies"* and *"gMaxEnemies — HARDCODED 6 per dwelling, not global."* **That verdict has DRIFTED —
it is now stale/wrong.** Two follow-ups for an audit: (a) re-stamp `_globals.md`; (b) the port hardcodes
`12/16`, whereas reservationsMaster reads `team.maxMembers` from each team's **teamMaster struct** — verify
no team in `casts/teams` sets a non-12/16 `maxMembers` (if any do, the hardcode masks data). Also confirm the
port decrements/cancels reservations on unit death symmetrically (`objectLeft`/`cancelReservation`) so the
cap can't deadlock-fill.

### 2. showArmyMaster — MEDIUM IMPACT — mapped but NO placement-parity audit
`master_objects/showArmyMaster.txt` lays out the banked reserve army into a paginated grid via a row/page
packing algorithm: `pXGap=4, pYGap=8` (`:21-22`), per-row floor = max unit `boundingRect.bottom`
(`:284-286`), new row when `boundingRect.right > pDisplayRect.right` (`:264`), new page when floor exceeds
`pDisplayRect.bottom` (`:290`), `isMenuItemShadowed` greys next/prev at page bounds (`:144-168`).
**Port:** `scenes/screens.ts` `renderShowArmy`/`armyPages`/page-shadow guards exist and pull
`armyMaster.getReserveArmy("#aldevar")`. Mapping is REAL.
**Finding:** never audited under the **placement/duration** lens (Charter §6). The port's grid is a
reimplementation — its xGap/yGap/row-floor packing and per-page break are NOT asserted against the cast's
numbers. Suggested audit: a `placement-parity` case asserting unit x-step = `width+4`, row y-step uses the
row's tallest unit + 8, and the page break matches `pDisplayRect.bottom`. (`hud_placement.test.ts` is the
home for it.)

### 3. weaponMaster — LOW IMPACT — faithfully INERT, confirm-and-stamp
`master_objects/weaponMaster.txt` is the **droppable/shared-weapon** system: `getNearestAvailableWeapon`
(`:22`) hands an unarmed seeker the closest free weapon; `getWeaponFirstAvailable` (`:36-58`) steals a weapon
whose current owner wandered `> weapon.dist` away (`lostWeapon`). Driven only by `objAICPUWeaponSeek` +
`objWeapon` (`objWeapon.txt:29` registers with weaponMaster).
**Port:** no `getNearestAvailableWeapon`/`lostWeapon`/ownership-transfer. `components/weapon.ts:287`
`addWeapon` is a DIFFERENT concept (a character registering its OWN attack).
**Finding (verified faithfully-absent):** grepped `casts/data/` — **no actor uses `objAICPUWeaponSeek` or
`#aiCPUWeaponSeek`**; the 117 `#inherit #weapon` actors (swords/bows) are carried-only via
`modWeaponManager` (covered per-actor through their wielders). So the drop/fetch/steal path is dead in the
shipped game and correctly omitted. Suggested action: one-line stamp in `code-vs-ts/` ("weaponMaster
fetch/steal: inert — no actor uses objAICPUWeaponSeek") so it stops reading as a gap.

### 4. characterEnergyRollOverMaster — MEDIUM IMPACT — mapped, layout/liveness unverified
`master_objects/characterEnergyRollOverMaster.txt` (`:3` "displays a character's health when the mouse rolls
over him/her"): finds the closest char to the mouse via teamMaster, mouse-inside-rect test, then overlays an
energy bar + a **level (stars)** bar + an **experience** bar above the unit (gCharacterEnergyRolloverOn=1).
**Port:** `render/rollover.ts` exists and documents exactly this (`:1-4,67`).
**Finding:** rollover.ts has NO dedicated audit doc and only passing mentions in `SS-2`/`gameMaster`. Per the
Charter's visual lens, verify: (a) liveness — does the level-stars + XP overlay actually render on hover
(not just the energy bar)? (b) placement — the pSurroundHeight offset above the unit; (c) the
closest-to-mouse selection matches teamMaster's. There IS a `rollover.test.ts` — confirm it asserts the
three-bar composition and hover-rect, not just presence.

---

## C. RANKED never-/under-reached list (by gameplay impact)

| # | object (cast file) | class | why it matters | suggested audit |
|---|---|---|---|---|
| 1 | **reservationsMaster** (`master_objects/reservationsMaster.txt`) | MGR seam | global unit cap gates ALL spawning; `_globals.md` verdict DRIFTED stale; hardcoded 12/16 may mask per-team `maxMembers`; reservation-on-death symmetry | drive summon/dwelling flood to cap across rooms; assert cap from teamMaster data; re-stamp `_globals.md` |
| 2 | **showArmyMaster** (`master_objects/showArmyMaster.txt`) | MGR/UI | reserve-army menu — reimplemented grid never placement-audited | placement-parity: xGap4/yGap8/row-floor/page-break vs cast |
| 3 | **characterEnergyRollOverMaster** (`master_objects/characterEnergyRollOverMaster.txt`) | MGR/UI | on-hover health+level+XP; rollover.ts unaudited for the 3-bar composition + liveness | visual-lens audit of rollover.ts vs the cast |
| 4 | **starMaster** (`master_objects/starMaster.txt`) | MGR | `starBurstX` (4-way burst) + `markerStar` spawn paths beyond experienceStar | verify burst dirs ×strength + lifeCount=1 marker star |
| 5 | **screenMaster** (`master_objects/screenMaster.txt`) | MGR | screen transition/on-off FSM (`#flick`, backAScreen) reimplemented in sceneManager — flow not unit-audited | drive overlay open/close/back stack; assert no orphaned screens |
| 6 | **frameTimer** (`master_objects/frameTimer.txt`) | GLOBAL | frame pacing underpins ALL duration parities — never checked as a unit | confirm tick delta vs cast `frameTimer`; ties into duration_parity |
| 7 | **keyChooseMaster + objKeyBinding/objKeyDescriptions** | MGR/UI | key-rebind flow — port has a keyConfig shell only | drive rebind, persist, conflict-resolve vs cast |
| 8 | **wizardMaster / gmgMaster HUD** (`wizardMaster.txt`,`gmgMaster.txt`) | MGR/UI | state tracked, portrait bar + gmg toggle icon UNRENDERED (already in xc PASS B — cosmetic) | render the missing HUD families (low pri) |
| 9 | **memberMaster / animStripMaster / collectionsMaster** | DATA | build-time cast-member/strip/collection assembly — presence tested, framing/grouping not | extend pipeline.test to assert strip frame counts + collection membership |
| 10 | **weaponMaster** (`master_objects/weaponMaster.txt`) | MGR | drop/fetch/steal — VERIFIED inert (no data driver); stamp only | one-line faithfully-absent note |
| — | controllerMaster, mapEditMaster, profileMaster, copyProtectionMaster, XMLmaster, objHair*, obj3DSprite/objBox/objLine/objZone, editor tools (objBrushTool/objToolPalette/…) | dead/out-of-scope | map-editor / online / DRM / 3D / hair — correctly absent | one-line "out of scope, unreferenced by data" stamps |

---

## D. Corrections to the prior censuses (verify-their-mappings step)

- **`code-vs-ts/_globals.md:151-163` — DRIFTED.** Its "gMaxFriends NO GLOBAL CAP" / "gMaxEnemies hardcoded
  6 per dwelling" verdict is stale: `systems/teams.ts:58-62 atCapacity()` now implements the 12/16 cap +
  teamOverride halving, gated in dwelling.ts/summon.ts. Re-stamp; the residual question is data-driven
  `maxMembers` vs the hardcode (item C-1).
- **`cross-cutting-census.md` PASS B (wizard/gmg HUD unrendered)** — re-confirmed accurate; folded into C-8.
- **`covered-by-extension.md`** — accurate for `act_*`; but its "CLEAN-by-class" `mod*`/`obj*` transitive
  coverage is a TRUSTED-divergence surface (Charter §3): reached, not unit-audited. The `code-vs-ts/mod*`
  docs cover the high-value ones; the editor/3D/hair residue (§B 🔴 rows) is faithfully-absent, not a gap.
- **weaponMaster** is absent from BOTH prior censuses — newly enumerated here, verified faithfully-inert.

---

CENSUS | objects=238 (39 masters + 199 script_objects) covered≈205 never-audited=10 (+~18 faithfully-absent out-of-scope)
