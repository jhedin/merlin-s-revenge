# Behavioral Audit: act_boulderCave (+ dwelling resident-level model)

**Dwelling:** boulderCave | #objDwelling | Team: #monsters

Resident-release FSM (produce→release staggered up to #totalResidents, then self-destruct) verified faithful.

## Gap found + FIXED (resident starting level — affects ALL dwellings)
modResidents: `setStartingLevel(random(getExperienceLevel))`. A dwelling's experience level = its
#startingLevel (dwellings gain no XP), and NO shipped dwelling sets one → level 0 → random(0) = 0 level-ups.
The port instead gave each resident a flat **50% chance of +1 level**, making them stronger than the
original. FIXED: residents now emerge at `random(dwellingLevel)` levels (0 for all shipped level-0
dwellings). casts/script_objects/modResidents.txt:160 | port/src/components/dwelling.ts (level + releaseOne).

## Documented minor deviation (NOT changed)
- **Resident spawn offset** — original spawns at the dwelling's exact loc (useOffset=false); the port spawns
  at a 20–36px ring (dwelling-edge) so units don't emerge INSIDE the dwelling's solid collision box. Units
  release staggered + path identically; a deliberate anti-overlap choice, no gameplay effect.

**Status: FIXED (resident over-levelling); spawn-offset is a documented anti-overlap deviation.**
