# Phase K — implement everything previously deferred

The owner's directive: *anything previously deferred needs to be implemented.* This is the consolidated,
grounded list of every still-open deferral/approximation across the A–J plans (the already-closed
deferrals — per-room pState→H3, committed-target-save→G1c, GMG/limiter→Phase I, army-reserve→G2 — are
omitted). Worked top-down by fidelity impact. Each item cites where it was deferred.

## Tier 1 — substantive combat/AI behaviour
- ☑ **K1. Inertia damps DAMAGE + faithful attack power.** `Movement.takeHit` damps the collision vector
  by `(100−inertia)/100` ONCE and passes the **damped** vector to Energy/Freeze/Heal — so inertia cuts
  damage *and* knockback (the coupling). Enemy melee = `power·strength·mult·ENEMY_DAMAGE_SCALE` (0.18);
  enemy bullets = `speed·power·mult·BULLET_DAMAGE_SCALE` (0.40); player melee unchanged on `MELEE_SCALE`/
  `DAMAGE_SCALE` (2.5). The whole-game rebalance avoids the 5–25× lethality blow-up via the two enemy-side
  scales (the documented px-scale decoupling); faithful ordering restored (blackOrc > swordOrc ≈ warrior),
  no one-shots, room-1 still clears (gate verified). See [`K1-faithful-damage.md`](K1-faithful-damage.md).
  [A1 §4, B2 §f.1 — resolved] **The keystone deferral.**
- ☐ **K2. Spell-actor live-growth lifecycle.** `objAiAttack.ensureSpell`/`chargeSpell`/`releaseMagic`: a
  charged spell is a live `objSpell` actor that grows over the caster's head and converts to bullets on
  release (`getCurrentCharge`, `calcChargeLoc`, attack-frame gating, eyestrain). Port currently does
  instant `fireBullet`-on-release. [B2 §g] *(deferred to a later pass; not in the K3–K8a AI-completeness batch)*
- ☑ **K3. `modPathFinding` beeline→scenic (NOT A*).** `PathFinding` helper on `CpuAI`: beeline at the goal;
  on a 5-frame zero-movement stall → `#scenic` with one random `±100px` waypoint (`PointRoughly`, map-rect
  clamped); next stall → beeline; arrival within 5px. Replaced the `seek`/perpendicular-detour heuristic.
  Open terrain never stalls (room-1 unchanged). Unblocks K4/K5/K6/K8a.
- ☑ **K4. Bullet-dodge kiting.** `bulletMap` broad-phase on `TeamMaster` + `findNearestEnemyBullets`
  (hostile-owned only) + a caster `optimumPosition` mode running `runTangentToObjects` (perpendicular to the
  incoming bullet, blended 25–75% with the straight-flee mirror) > flee > approach > idle. Layers on
  `runReload` (kept for plain ranged enemies). Gated by `dodgesBullets` (set for `#objAiCPUSpellCaster`).
- ☑ **K5. Ghost possession.** `objAiCPUGhost`: `findUnitOfType(#monk, teamWhenAlive)` + drift (K3) +
  `attemptPossess` (`mergeExperience` = monk gains FULL imWorth+gained, `glowPink`, ghost `#finish`/grave).
  Replaced `wander`. No-monk maps (samii) drift forever — faithful.
- ☑ **K6. setMultiAttack.** `WeaponManager.setMultiAttack` + 2-weapon spawn (`attack2`): ninja/shrouder
  carry ranged weapon 1 + melee weapon 2, range-switched each `moveToAttack` tick (squared compares, the
  ranged-weapon-2 buffer override, the melee-target poke nuance).
- ☑ **K7. modWeaponTechnique.** `WeaponTechnique` component: in the `#attack` window, accrue `technique`,
  spend ±100 → `Anim.frameAdvance`/`frameExtendDelay` (faster/slower attack anim); `#levelUp` +2; default 0
  = no effect (player + 26 actors unchanged). ninja/shrouder 20, kongFuChicken 200, archers negative.
- ☑ **K8a. Builder AI (`objAiCPUBuilder`).** `dwarf`/`goblinBuilder` build instead of fighting: walk-to-site
  (K3) → accrue `buildRate` advancing build frames → spawn the `#unitToBuild` dwelling/tower; dwarf builds
  one `dwarfTower` then retires (`leaveWhenFinished`), goblinBuilder builds a goblin dwelling then dies
  (`buildDie`); no site → plain-CpuAI fight fallback. (The K-backlog's "MISSING" was a port gap on reachable
  actors — placed in `works_mr4Demo`.)
- ☐ **K8b/K8c. `objAiEnemyTargetSeek` ("hairSeek") + `objAICPUWeaponSeek` — UNREACHABLE (no code).** Both
  carry **0 actor records** (`#AiType` grep empty across all 47 maps); `objAiEnemyTargetSeek`'s base class
  `objAiEnemy` is absent from the source cast (cannot instantiate); the weapon-drop economy `objAICPUWeaponSeek`
  needs is unused. Evidence-backed dead engine code — left unbuilt (per K2-K8 plan §g).

## Tier 2 — spells / content mechanics
- ☑ **K9. armySummon reservation requirement.** `summonUnit` (modSpellMultistage.summonPayload →
  armyMaster.createUnitFromSummonSpell → `createUnit(team, typ, startLoc, spellName)`) now routes through
  the G2 army reserve: `#armySummon` REQUIRES a banked record — it withdraws the highest-level reserve unit
  of `[team][typ]` (`game.armyMaster.createUnit`), re-fields it AT its saved level, and consumes the record;
  an empty reserve returns null (the spell fizzles to its bolt, matching `createUnit` returning `#none` for
  `armySummon` w/ `armyDetails=#none`). Every OTHER summon (`#monsterSummon`/`#undeadSummon`/`#goblinSummon`/
  `#skelitonSummon`/`#scSummon`) still withdraws+re-fields a reserve record IF one exists (faithful to
  createUnit's unconditional lookupArmyDetails), else spawns a FRESH default-level unit. Tested
  (empty-reserve fizzle, withdraw-at-level + consume, fresh monsterSummon). [C3 §g — resolved]
- ☑ **K10. `randomSummon` charge wobble.** `chargeMaxOf(attack, mana, rng?)` implements
  `calcAttackChargeMax`'s randomSummon ceiling wobble: with an rng + `randomSummon` + ≥2 tiers, the per-cast
  charge ceiling is randomised (so the top affordable tier varies cast-to-cast); deterministic without an
  rng / for a non-randomSummon attack. Seeded-deterministic, bounded `[0, chargeMax]`. Tested in `spells_c`. [C3 — resolved]
- ☑ **K11. `calcAttackChargeStart` faithful overwrite.** `chargeStartOf` caps the start at
  `chargeStartMax` (numeric → cap, `#none` → ∞), faithful to the raw Lingo trailing
  `if pChargeStart <> #none then chargeStart = min(pChargeStart, chargeStartMax)` (the burst-discarding
  overwrite for summon spells). [C, charge.ts note — resolved]
- ☑ **K12. Chatter cutscenes.** Bundled all 10 `scr_stonesN` scripts in `build_assets.ts`; generic
  `loadCutscene(name)` (lazy fetch+parse+cache); `SceneManager` widened to an arbitrary named scene + a
  default-finish→resume branch (mirrors `movieMaster.cutSceneFinished` fall-through) + `playInGameCutScene`
  (`#ingame` env binds the LIVE Merlin, combat paused, ulin spawned, above-head speech bubble); the
  `Chatter` overlap FSM (320-reach box, `pPerformed` latch, talking-member swap) plays its
  `#scriptToPerform` over the live game — replacing the inert sprite. Intro/wasted/complete unchanged.
  Exercised in `?map=works_mr4Demo` (stones1 in room (2,14)). [I5 §g.8]
- ☑ **K13. recordInRoomState:false.** `isRecordableActor` excludes the `#recordInRoomState:false` actors
  (in-flight bullets + the placed fire mines/auras/hazards) from the per-room pState snapshot
  (`RoomManager.enter` leave-snapshot + `snapshotCurrentRoom`). On re-entry the recordable actors restore
  from pState while `spawnNonRecordableTileActors` re-tile-spawns the non-recorded placed content FRESH
  (their FSM/explosion count re-inits) — faithful to the original, where room activation always re-runs its
  tile spawn and `restoreState` only overlays the recorded actors (a detonated mine returns on re-entry; a
  bullet in flight when you leave vanishes). Tested in `rooms_h3` (mine not in snapshot, re-spawns fresh,
  orc restores wounded). [I §c.9 note — resolved]

## Tier 3 — render / shell / audio fidelity
- ☑ **K14. Beam sprite-strip render.** `drawBullets` now renders energyBeam as the `energyBeam_fly` strip
  (`act_energyBeam` #member `anm_energyBeam_fly_03_01`) stretched to the caster→target distance
  (`scaleX = beamDist/frameWidth`, setSpriteWidth) and rotated to the beam angle (`rotation = beamAngle`,
  setSpriteRotation = GeomAngle), pivoting at the caster anchor (regX 0) — through the renderer's existing
  rotate/scale-about-regpoint sprite path. The char loads lazily (the spell is a pickup), with the bright
  line kept only as a pre-load fallback. [I8 §g.2 — resolved]
- ☑ **K15. `objTransColor` exact tween.** `ColourTransform` rewritten to the faithful `objTransColor`/
  `objTransformer` model: `pCurr` is a percent in [0,100], `VarToward(pCurr,100,speed·gGameSpeed)` per tick
  (first frame holds, `pFirstFrame`), colour = `VarColRange(pCurr,start,target)`, pingpong swaps the ends
  (`finishConditionMet`), and a `#current` start captures the LIVE resolved colour at arm time
  (`initCurrentColor`) — so flickWhite (speed 33 white→black) ramps strength DOWN and a glow interrupting
  another starts from the on-screen hue, not black. [F3 — resolved]
- ☑ **K16. Cutscene verbs: prop / walkScroll / random-flash.** Implemented in the Thespian engine:
  `produceProp`/`putAwayProp`/`dropProp` (a carried character tracks its carrier, #prop suppresses
  turnToFace), `propAt` sets #prop status, `walkScrollLeft/Right/Stop` (continuous scroll-walk; a #prop
  rides off), `backgroundColourRandomFlash` (self-restarting random colour loop). Support-only
  (no shipped script uses them) → golden/unit-tested. [H1 §f.1]
- ☑ **K17. Lights/fade per-actor fader.** Each cutscene actor has its OWN fade state (alpha + fadeTarget);
  `lightsUp`/`lightsDown` start a fader on every actor, `fadeDown` on one — the line completes only when
  the started-fader count reaches zero (objScriptPerformer.pWaitingForPlayers count-to-zero gate), not a
  fixed shared duration. The host renderer applies each actor's alpha. Intro/wasted lights still look right. [H1]
- ☑ **K18. Screen content.** `scenes/screens.ts` drives the wired overlay syms: credits (scroll-to-end,
  complete→credits→title re-route), showArmy (paginate the G2 army reserve via unit stand frames, page
  shadow guards), instructions (static), key-config (choose among the input schemes via the control→key
  table / `keyForControlInScheme`). profileMaster is OUT (dev profiler). [H2 §g]
- ☑ **K19. Screen-transition tweens.** `SceneManager` runs an inter-screen fade tween (screen flips at
  once; the goScreen ACTION is deferred to finishTransition). `transitionFrames=0` test mode keeps the FSM
  unit tests synchronous; the host (main) uses a 3-frame fade. [H2/F3]
- ☑ **K20. Per-effect sound channels.** `AudioSystem` ports soundMaster's fixed 8-channel pool: channel 1
  reserved for music (`pMusicChannel`), channels 2–8 the SFX pool allocated via the round-robin cursor
  `pNextChan` (→ `soundEmptyChan` lowest-free fallback, → drop when all busy, matching the commented-out
  "override oldest" branch); the 0–255 volume scale (`pDefaultVolume=150` → gain) via `vol255ToGain` + an
  optional `vol255` param + `adjustVol`/`stopSound`/`stopAllSound`. The existing `play(name, volume)` 0–1
  API is unchanged (`onended` frees the channel). [05-audit — resolved]
- ☑ **K21. Grave system + pState graves.** `Grave` component (modGrave `pGraveOn`): a dead actor IS its
  own grave — it holds the `#grave` anim frame at the death loc, renders BEHIND the living (a low render-z,
  modelling the original's room-background blit), and faces RIGHT (`setFlipFromDir(1)`). A GHOST
  (`#ghost:true` → `pGraveOn=false`) leaves NO grave (sprite null — it vanishes). Grave persistence rides
  the existing per-room pState snapshot (dead actors round-trip with their `#grave` pose), matching
  modRoomGraves' `pGraves` save. The heavy-entity-vs-baked-blit difference is internal (dead actors are
  already inert: out of the unit map, off the team roster, no health bar) — the observable grave behaviour
  (where it falls, behind the living, persists on re-entry/save, none for ghosts) is faithful. Tested in
  `render_f3`. [G/H — resolved]
- ☐ **K22. Collision edges.** AI one-way-platform drop-through, discrete layer-Z, per-tile screen-exit
  ranges, exit arrows. [F2/F3 §g — no shipped map uses non-solid tiles, but support + AI hook]

## Genuinely out of scope (engine-not-game; confirmed)
Map editor (`mapEditMaster`, separate executable), copy-protection, the `ochreWizard`/`scw` orphan symbols
(no `act_` record in the original either). These are NOT deferrals — they're non-game or faithful-as-is.

## Status log
- Opened K to burn down every deferral per the owner's directive.
- Tier 1 closed (K1 keystone + K3–K8a AI completeness; K8b/c evidence-backed dead engine code).
- Tier 2 closed: K9 (armySummon → G2 reserve), K10 (randomSummon wobble), K11 (chargeStart overwrite),
  K12 (chatter cutscenes), K13 (recordInRoomState:false).
- Tier 3 closed: K14 (beam sprite-strip), K15 (objTransColor faithful tween), K16–K19 (cutscene verbs /
  faders / screens / transitions), K20 (sound channels), K21 (grave system). The K14/K15/K20 passes were
  built by worktree-isolated agents and reviewed + cherry-picked here. **Only K22 (collision edges) and
  K2 (spell-actor live-growth) remain open.** 336 tests green, tsc clean, room-1 gate green.
