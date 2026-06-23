# Actor Audit: act_friendlyGoblinMage

**VERDICT: CLEAN — 0 divergences.** (An earlier note claimed a no-damage D1; that was a PROBE ARTIFACT —
see correction below.)

**Method:** REPRODUCED — spawned via `spawnUnit` against a hostile blackOrc on the real `assets.json`
bundle, ticked ~400 frames, observed sprite/team/routing/anim + the cast effect.

## Derived (original)
`#inherit #CPUCharacter`, `#character #goblinMage`, `#name "goblinMage"`, `#team #village` (player-side),
energy 50, `#weapon #energyBlast` (`#animType #magic`, chargeMax 999/0.75/5, spellSpeed 20) — a friendly
captured goblin mage that casts the energyBlast damage spell at hostiles.

## Observed (port) — all faithful
- **Sprite** resolves to **goblinMage** (real bundled strip, NOT blackOrc) via the `#name "goblinMage"` path.
- **Routing**: `spawnUnit` -> **ally** (type ally, team #village = player side); hunts the hostile orc.
- **Charge -> release**: plays charge then release and spawns a `spell` orb (energyBlast).
- **Damage**: the energyBlast orb flies to the target loc and explodes via `SpellActor.explode` ->
  `resolveSplash`. Against a **pinned** target it deals damage (blackOrc 1200 -> 356). It DOES damage.

## CORRECTION (probe artifact, NOT a divergence)
The earlier "D1: cast deals no damage" was a test artifact: the first probe used a **moving** target. The
spell flies to the loc captured at release (faithful objSpell behaviour — the original orb also flies to a
fixed loc), so a target that walks away dodges it. With the target pinned, `resolveSplash` damages it
normally. The CPU/ally damage-spell path (SpellActor.explode -> resolveSplash) is correct.

friendlyGoblinMage | DIVERGENCES=0
- (none) — goblinMage sprite, ally routing, charge->release, energyBlast deals damage (pinned-target verified).
