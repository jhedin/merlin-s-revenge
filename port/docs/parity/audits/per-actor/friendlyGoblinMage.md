# Actor Audit: act_friendlyGoblinMage

**Method:** REPRODUCED — spawned via `spawnUnit` against a hostile blackOrc, ticked ~400 frames on the real
`assets.json` bundle, observed sprite/team/routing/anim + the cast effect.

## Derived (original)
`#inherit #CPUCharacter`, `#character #goblinMage`, `#name "goblinMage"`, `#team #village` (player-side),
energy 50, `#weapon #energyBlast` (`#animType #magic`, chargeMax 999/0.75/5, spellSpeed 20) — a friendly
captured goblin mage that casts the energyBlast damage spell at hostiles.

## Observed (port) — mostly faithful
- **Sprite** resolves to **goblinMage** (real bundled strip, NOT blackOrc) via the `#name "goblinMage"`
  path. All actions resolve (stand/walk/charge/release/reel/grave).
- **Routing**: `spawnUnit` routes it to **ally** (type ally, team #village = player side); hunts the orc.
- **Charge -> release**: plays charge then release (the caster fire-flash) and spawns a `spell` orb — casts.

## DIVERGENCE
- **D1 (PORT BUG, needs investigation):** the energyBlast cast spawns the spell orb but **deals no damage**
  (blackOrc energy 1200 -> 1200 over 400f). The CPU/ally magic path was wired for SUMMON spells
  (explodeFunction #summonUnit -> fly + summon); a DAMAGE spell's explode (resolveSplash area hit) does not
  resolve for a CPU caster. Low shipped impact - nearly every enemy caster uses a summon weapon
  (mageOrc/necromancer/greyGhost/scMonk); friendlyGoblinMage is the notable damage-spell CPU. Candidate
  systemic fix: route a CPU damage-spell's release through resolveSplash like the summon path. Affects any
  CPU whose #weapon is energyBlast/cBlast/darkBlast.

friendlyGoblinMage | DIVERGENCES=1
- D1: CPU/ally energyBlast cast spawns the orb but deals no damage (CPU magic path wired for summon, not damage spells).
