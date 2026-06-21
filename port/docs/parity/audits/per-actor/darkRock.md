# Behavioral Audit: act_darkRock (+ the #explodeSound data-drive)

**Bullet:** darkRock | #inherit #bullet | #type #explode (splash) | thrown by dark/double/fourArm/summonGolem.

All damage/splash properties faithful (type→splashBullet path, explodeCharge 40→radius, power 1, mult 1,
payload [#takeHit], radial falloff). One cross-cutting gap surfaced here + FIXED:

## Gap found + FIXED (#explodeSound — systemic)
The port HARDCODED `"spell_explode"` for every splash/spell detonation. The original plays the actor's
top-level `#explodeSound` (structMaster default #none). So the port played the WRONG/spurious sound for:
cracks (should be `darkGolem_fire`), healBlast (`heal_spell_explode`), and **energyPulse/towerAxe/fire/
pitMonster (#none → should be SILENT, but the port fired a spurious explosion sound — energyPulse streams
rapidly + pitMonster re-arms, so this was audible noise)**. FIXED: AttackData carries #explodeSound (read
from the actor top-level, ignoring the merged "#none" attack default); projectile.ts `detonate` and
spellActor explode play it data-driven and stay silent on #none. (Mines already read explodeSound; only the
splash-bullet + spell-actor paths were hardcoded.) casts/data/act_*.txt #explodeSound +
structMaster.txt:177 | port/src/components/{weapon,projectile,spellActor}.ts. spells_c.test asserts it.

**Status: FIXED (explodeSound now data-driven across all splash/spell detonations).**
