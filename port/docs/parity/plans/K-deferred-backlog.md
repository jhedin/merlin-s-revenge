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
  instant `fireBullet`-on-release. [B2 §g]
- ☐ **K3. `modPathFinding` beeline→scenic / A*.** `findPathToLoc`, `moveToLoc` target-mode, `objMoveXY`
  stall detection. Port uses the `seek`/perpendicular-detour heuristic. [B1 §g]
- ☐ **K4. Bullet-dodge kiting.** `objAiCPUSpellCaster.updateMoveToOptimumPosition`: `runTangentToObjects`
  over `findNearestEnemyBullets` (the `bulletMap`). Port kites with the simple `runReload` band. [B1 §g]
- ☐ **K5. Ghost possession.** `objAiCPUGhost`: `findUnitOfType(#monk)` + drift + `attemptPossess`
  (`mergeExperience` + `goMode(#finish)`). Port uses the `wander` approximation. [B1 §g]
- ☐ **K6. setMultiAttack.** Range-based 2-weapon auto-switch for CPUs (ranged weapon 1 + melee weapon 2).
  [B2 §g]
- ☐ **K7. modWeaponTechnique.** Attack-anim speedup accumulator. [B2 §g]
- ☐ **K8. Remaining AIs.** `objAiHairSeek` / builder (`objAiBuilder`) / `objAiWeaponSeek` — MISSING. [B1 §g]

## Tier 2 — spells / content mechanics
- ☐ **K9. armySummon reservation requirement.** `createUnit` returns `#none` for `armySummon` with
  `armyDetails=#none` — it draws from the army reserve (G2). Wire the spell to the reserve. [C3 §g]
- ☐ **K10. `randomSummon` charge wobble.** Verify/implement the skeleton/goblin/sc/undead summon
  charge-wobble in `charge.ts`. [C3]
- ☐ **K11. `calcAttackChargeStart` faithful overwrite.** Raw Lingo overwrites the start (discards burst
  in one branch); port kept `0+burst` to match the old number. Reconcile. [C, charge.ts note]
- ☐ **K12. Chatter cutscenes.** Bundle the `scr_stonesN` scripts so stones play their cutscene (port
  spawns them inert — the original's "disabled inGame scripts" fallback). [I5 §g.8]
- ☐ **K13. recordInRoomState:false.** Fire mines (`#recordInRoomState:false`) shouldn't snapshot into
  pState (re-spawn fresh). [I §c.9 note]

## Tier 3 — render / shell / audio fidelity
- ☐ **K14. Beam sprite-strip render.** energyBeam as the original stretched sprite-strip, not a 2D line.
  [I8 §g.2]
- ☐ **K15. `objTransColor` exact tween.** Real speed-33 white→black tween + true `#current`-start colour
  (port uses linear + black-start). [F3]
- ☐ **K16. Cutscene verbs: prop / walkScroll / random-flash.** Staged no-op; implement. [H1 §f.1]
- ☐ **K17. Lights/fade per-actor fader.** Per-actor fade counting vs the fixed shared-duration model. [H1]
- ☐ **K18. Screen content.** credits / profile / showArmy / instructions / key-config overlays (transitions
  are wired; the screens are stubbed). [H2 §g]
- ☐ **K19. Screen-transition tweens.** Instant today. [H2/F3]
- ☐ **K20. Per-effect sound channels.** `soundMaster` 0–255 volume + channel management. [05-audit]
- ☐ **K21. Grave system + pState graves.** A real grave actor on death + its pState persistence. [G/H]
- ☐ **K22. Collision edges.** AI one-way-platform drop-through, discrete layer-Z, per-tile screen-exit
  ranges, exit arrows. [F2/F3 §g — no shipped map uses non-solid tiles, but support + AI hook]

## Genuinely out of scope (engine-not-game; confirmed)
Map editor (`mapEditMaster`, separate executable), copy-protection, the `ochreWizard`/`scw` orphan symbols
(no `act_` record in the original either). These are NOT deferrals — they're non-game or faithful-as-is.

## Status log
- Opened K to burn down every deferral per the owner's directive.
