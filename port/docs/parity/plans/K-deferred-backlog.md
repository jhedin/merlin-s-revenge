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
- ☐ **K9. armySummon reservation requirement.** `createUnit` returns `#none` for `armySummon` with
  `armyDetails=#none` — it draws from the army reserve (G2). Wire the spell to the reserve. [C3 §g]
- ☐ **K10. `randomSummon` charge wobble.** Verify/implement the skeleton/goblin/sc/undead summon
  charge-wobble in `charge.ts`. [C3]
- ☐ **K11. `calcAttackChargeStart` faithful overwrite.** Raw Lingo overwrites the start (discards burst
  in one branch); port kept `0+burst` to match the old number. Reconcile. [C, charge.ts note]
- ☑ **K12. Chatter cutscenes.** Bundled all 10 `scr_stonesN` scripts in `build_assets.ts`; generic
  `loadCutscene(name)` (lazy fetch+parse+cache); `SceneManager` widened to an arbitrary named scene + a
  default-finish→resume branch (mirrors `movieMaster.cutSceneFinished` fall-through) + `playInGameCutScene`
  (`#ingame` env binds the LIVE Merlin, combat paused, ulin spawned, above-head speech bubble); the
  `Chatter` overlap FSM (320-reach box, `pPerformed` latch, talking-member swap) plays its
  `#scriptToPerform` over the live game — replacing the inert sprite. Intro/wasted/complete unchanged.
  Exercised in `?map=works_mr4Demo` (stones1 in room (2,14)). [I5 §g.8]
- ☐ **K13. recordInRoomState:false.** Fire mines (`#recordInRoomState:false`) shouldn't snapshot into
  pState (re-spawn fresh). [I §c.9 note]

## Tier 3 — render / shell / audio fidelity
- ☐ **K14. Beam sprite-strip render.** energyBeam as the original stretched sprite-strip, not a 2D line.
  [I8 §g.2]
- ☐ **K15. `objTransColor` exact tween.** Real speed-33 white→black tween + true `#current`-start colour
  (port uses linear + black-start). [F3]
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
- ☐ **K20. Per-effect sound channels.** `soundMaster` 0–255 volume + channel management. [05-audit]
- ☐ **K21. Grave system + pState graves.** A real grave actor on death + its pState persistence. [G/H]
- ☐ **K22. Collision edges.** AI one-way-platform drop-through, discrete layer-Z, per-tile screen-exit
  ranges, exit arrows. [F2/F3 §g — no shipped map uses non-solid tiles, but support + AI hook]

## Genuinely out of scope (engine-not-game; confirmed)
Map editor (`mapEditMaster`, separate executable), copy-protection, the `ochreWizard`/`scw` orphan symbols
(no `act_` record in the original either). These are NOT deferrals — they're non-game or faithful-as-is.

## Status log
- Opened K to burn down every deferral per the owner's directive.
