# Behavioral Audit: act_monsterSummonAi
**Spell:** monsterSummonAi (CPU summon variant) | #magic #summonUnit
CPU summon path (summonUnit at caster loc, randomSummon wobble where applicable) verified faithful.
Agent flagged "summon spawns at caster, not post-flight target loc" — this is the documented spell-flight
→ instant re-field approximation (plan §g), a known deviation, not a new gap.
**Status: CLEAN (summon spawn-loc is a documented approximation).**
