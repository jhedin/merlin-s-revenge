# Audit: undeadInvasion (objDwelling)

## Data Parity

**Lingo source:** casts/data/act_undeadInvasion.txt

**TS port data:** port/src/generated/data.json (act_undeadInvasion)

### Properties Match
- `objType`: #objDwelling ✓
- `inherit`: #dwelling ✓
- `dieSound`: #none ✓
- `energy`: 1000 ✓
- `experienceImWorth`: 0 ✓
- `graveOn`: false ✓
- `reelProof`: true ✓
- `inertia`: 150 ✓
- `frictionReel`: {x: 100, y: 0} ✓
- `team`: #invisible ✓
- `name`: "undeadInvasion" ✓

### Resident Groups Match
All 5 resident groups (skeletonArcher, skeletonThrower, skeletonWarrior, necromancer, darkMage) have identical buildTime, groupSize, and releaseInterval ranges. ✓

### totalResidents
Neither Lingo nor TS port defines explicit `#totalResidents`. Both correctly default to 10:
- Lingo: modResidents.txt line 26 sets default to 10
- TS port: dwelling.ts line 30 sets default to 10 ✓

## Behavioral Parity

### Spawning Logic
**Lingo:** objDwelling.txt spawns residents via modResidents module, which:
1. Selects a random residentGroup (line 180-181 in modResidents.txt)
2. Produces the group with staggered timing (buildTime × groupSize)
3. Releases units one at a time (releaseInterval between each)
4. Continues until budget exhausted

**TS port:** dwelling.ts (lines 38-68) implements identical FSM:
1. Selects random residentGroup (line 48)
2. Produces with `groupLeft * buildTime` total production time (line 50)
3. Releases one per releaseInterval (line 60, 66)
4. Continues until budget exhausted (line 39-46)

Parity: ✓

### Team Assignment
**Lingo:** #invisible team
**TS port:** #invisible team

The dwelling's own team is #invisible (an invasion force). Spawned residents have individual teams (e.g., #undead for skeleton units), and spawnUnit/spawnEnemy route them correctly by their resident type's team.

Parity: ✓

### Group Size Constraints
Both cap current group size to remaining budget: `Math.min(groupSize, remaining)` (dwelling.ts line 49 mirrors modResidents.txt line 182)

Parity: ✓

### Level-ups
Residents emerge at level 0 (dwelling has no starting level). Both implementations match:
- Lingo: modResidents.txt lines 159-161 (random(0) = 0)
- TS port: dwelling.ts lines 81-82 (level > 0 check, else 0)

Parity: ✓

## Conclusion

CLEAN — undeadInvasion exhibits full behavioral parity between Lingo and TS port. All data matches exactly, and the invasion spawning FSM is faithfully ported.
