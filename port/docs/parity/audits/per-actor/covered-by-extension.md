# Per-actor sweep — completion summary

All 262 queued actors (every `act_*.txt`) now have a per-actor record. ~180 were individually agent-audited
(one agent per data file, ~5 concurrent, failures retried). The remaining tail is CLEAN by *class*, each
class validated through the individual audits rather than re-asserted:

## Individually audited (~180)
Every enemy/ally combat actor (97), every player spell/summon/powerup, the dwellings (18), the mine/aura
class (8), the pickups, and the region mechanics (magicLimit/teamOverride/music). See the per-actor `.md`.

## CLEAN-by-class (validated, not assumed)
- **Plain/special bullets (~30)** — `#inherit #bullet`. Each bullet's attack/splash/reincarnate/freeze
  resolution was verified through its THROWER's audit, and pinned by tests: firingType velocity
  (attack.test), splash (spells_c), bullet `#reincarnateAs` hatch (bullet_reincarnate), freeze (freeze).
- **Weapons (~24)** — `#objType #objPowerUp #inherit #weapon`. Each weapon's `#attack` is resolved and
  exercised through every WIELDER's audit (e.g. archerBow via archer, goblinSword via goblinWarrior).
- **Cutscene/prop characters (~14)** — `#inherit #actorPlayer`, `#character #prop`/named wizard, team
  `#collectables`. NOT present in any object key → never placed in a gameplay map (verified). Story/intro
  presentation; the gameplay `*InGame`/player variants (audited) carry the behavior.
- **`#scriptToPerform` chatter triggers (~14)** — stones1-10 / armySummonStones / goblinRunner(Stones) /
  kingStones. `#chatter` ambient objects that fire a named Lingo cutscene/demo/lore script on touch
  (`#demo_006_ulin`, `#stones1`, `#collectArmySummon`, …). Narrative scripting is out of the port's gameplay
  scope; the port renders them as ambient chatter.
- **Base templates (~9)** — CPUCharacter/actor/character/dwelling/effects/game/weapon/bullet/spell. Pure
  inheritance bases, never spawned standalone (merged into the concrete, audited actors).
- **Region-marker / effect variants (~11)** — magicLimit1/25/50/75 (→ magicLimit), music* (→ music),
  walkSpeed (→ the pickup `speed` effect).

## Systemic fixes shipped during the sweep (10)
1. `#firingType` throw-velocity (proportional=dist/10, fullstrength=strength) — 42 actors.
2. `#runReload` read from data (bat/caveBat/evilTv/vultureGuard).
3. bullet `#reincarnateAs` (flamingRock→fire, lizardEgg→bug, ostrichEgg→babyOstrich) + audio channel-leak.
4. `#randomSummon` charge-wobble wiring (CPU summon + player charge).
5. CPU caster beam (energyBeam) — earlier.
6. `#depositMines` for CPU casters (verdanlin) — earlier.
7. CPU damage-casters release a charge-scaled objSpell (user-approved "fully faithful").
8. Dwelling residents emerge at `random(dwellingLevel)` (was a bogus flat 50%-of-+1).
9. energyMine single-shot (objMine `dieOnExplode` default true).
10. +25 collect-bonus energy on every medikit/scroll/sword/potion + maxikit = instant full heal.

All fixes carry tests; the suite + the room-1 in-browser gate stay green throughout.
