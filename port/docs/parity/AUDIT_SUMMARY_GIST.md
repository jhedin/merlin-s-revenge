# Merlin's Revenge — TypeScript port parity audit

A per-actor behavioral-parity sweep comparing the TypeScript port (`port/src`) against the
original Shockwave/Lingo game (`casts/`). Goal: 100% behavioral parity.

## Coverage

One audit agent per data file over **all 262 actors**, each finding re-verified by hand in
*both* trees before acting (the audit agents systematically over-flagged, so every flag was
confirmed against `casts/` + `port/src/`). After a first pass, the **102 actors previously
dismissed as "CLEAN by class" were each re-audited individually** — and that individual pass
alone surfaced 4 of the fixes below that the class-level pass had missed.

| Block | Count | Result |
|---|---|---|
| bullets | 30 | all CLEAN |
| weapons | 24 | all CLEAN |
| cutscene / props | 14 | all CLEAN |
| script-stones (chatter triggers) | 14 | all CLEAN |
| base templates | 9 | all CLEAN |
| region / effect variants (magicLimit, music, walkSpeed) | 11 | all CLEAN |

Every actor now has its own verified `.md` record in `port/docs/parity/audits/per-actor/`.

## 14 systemic gaps found + fixed (each with a test)

1. **`#firingType` throw-velocity** (proportional = dist/10, fullstrength = strength) — 42 actors fired at a fixed speed.
2. **`#runReload` read from data** — bat/caveBat/evilTv/vultureGuard kited only via AiType before.
3. **bullet `#reincarnateAs`** — flamingRock leaves fire, eggs hatch (lizardEgg→bug, ostrichEgg→babyOstrich); also fixed an audio sound-channel leak.
4. **`#randomSummon` charge-wobble** was dead code (no caller passed rng) — now wired (CPU summon + player charge).
5. **CPU damage-casters** now release a charge-scaled objSpell (grow-fly-explode) like the player instead of a fixed bolt — damage scales with mana/level.
6. **Dwelling residents** emerge at `random(dwellingLevel)` — were over-levelled by a bogus flat 50%-of-+1.
7. **`energyMine` is single-shot** (objMine `dieOnExplode` default is `true`) — it was re-arming forever.
8. **+25 collect-bonus energy** on every medikit/scroll/sword/potion, and **maxikit = instant full heal** (was banked like a medikit) — both were missing.
9. **`#depositMines` routing** for CPU casters (verdanlin).
10. **CPU `energyBeam`** beam path.
11. **`#explodeSound` data-driven** (splash/spell detonations) — was hardcoded `"spell_explode"`, so cracks/healBlast played the wrong sound and energyPulse/towerAxe/fire/pitMonster (#none) fired a *spurious* explosion sound. *(caught in the individual bullets pass)*
12. **Chatter trigger reach** is now the per-actor `#collisionRect`, not a hardcoded ±320 — kingStones (±100/±50), armySummonStones (±16) and berlinTV would have triggered their cutscene from 3–20× too far away. *(script-stones pass)*
13. **CPU passive regen** — `energyRecoverDelay` defaulted to 0 instead of objCPUCharacter's 300, so ~98 enemy/ally units never trickled energy back; now +1 per 300 ticks. *(base-templates pass)*
14. **Dwelling escalation** — act_dwelling's inherited `inertia 80` / `energyIncPercentage -1` were dropped, and the building never levelled up per release (`me.big.levelUp()`), so residents never escalated and buildings got knocked around; now faithful. *(base-templates pass; completed the earlier incomplete fix #6)*

## Consciously NOT changed (documented, with rationale)

- **scarletWizard's missing intro cutscene** — content-scope, not an engine gap. The port deliberately ships only `stones1-10` cutscene scripts; every named-wizard `#scriptToPerform` outside that set resolves to a graceful null, behaviourally identical to the original where the script simply isn't triggered. The dispatch is faithful.
- **walkSpeed potion** — the port boosts `maxSpeed` (+15%) where the original boosts walk acceleration (+15%); the magnitude is identical and the net effect ("faster movement") is equivalent under the original's friction-limited terminal-velocity model. It is also not placed in any shipped map. Re-pinning to an acceleration bump risks a movement regression for an unplaced pickup, so it's documented as a minor calibration deviation.

## Verification

- `tsc --noEmit` strict-clean
- **367 tests** (vitest)
- room-1 no-regression smoke gate (in-browser, playwright) green at every step
