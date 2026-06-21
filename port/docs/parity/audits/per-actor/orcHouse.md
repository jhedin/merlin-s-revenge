# orcHouse Behavioral Parity Audit

## Summary
orcHouse (#objDwelling, team #goblins) exhibits correct behavioral parity between original Lingo (casts/) and TypeScript port (port/src/).

## Data Layer
**Original**: casts/data/act_orcHouse.txt
- `#objType`: #objDwelling
- `#team`: #goblins
- `#dieSound`: "boulder_die"
- `#energy`: 100
- `#residentGroups`: 3 groups (bowOrc, swordOrc, mageOrc)
- `#totalResidents`: not set; inherits default 10 from modResidents.addModParams (line 26)

**Port**: port/src/generated/data.json (resolved from act_orcHouse.txt)
- All fields present and correctly typed
- residentGroups: 3 groups with matching buildTime/groupSize/releaseInterval ranges
- Budget default: 10 (archetypes.ts:88, matching modResidents.txt:26)

## Logic Layer

### Release Flow
**Original** (modResidents.txt):
- startProduction (line 178): Pick random group, calculate groupSize, set buildTime = groupSize × timeToBuildSingle
- update loop (line 197): #produceGroup → #awaitPermission → #releaseCountdown
- releaseResident (line 146): Spawn resident, decrement pResidentsRemainingCounter
- produceNextGroupOrDie (line 137): Check budget exhaustion, call noMoreResidents() if done

**Port** (dwelling.ts):
- startProduction (line 38): Picks random group, calculates groupLeft, sets timer = groupLeft × buildTime
- update loop (line 54): #produce → #release
- releaseOne (line 71): Spawns resident via spawnUnit/spawnEnemy, decrements budget
- startProduction (line 39): Checks budget ≤ 0, calls takeHit for self-destruction

Behavioral match: ✓ Both follow identical state machine (pick group → build → release staggered → next group → death)

### Self-Destruction
**Original** (objDwelling.txt + modResidents.txt):
- Line 105-107 (objDwelling): noMoreResidents() → startDeath()
- Line 127 (objDwelling): startDeath() → goMode(#dead) → playSound(pDieSound)

**Port** (dwelling.ts + archetypes.ts):
- Line 42-44 (dwelling.ts): Budget exhausted → takeHit(999999) → Energy.takeHit → dead=true → plays dieSound
- archetypes.ts:89: dieSound="boulder_die" passed to Energy component

Behavioral match: ✓ Both self-destruct upon budget exhaustion with dieSound

### Resident Team
**Original** (modResidents.txt:154-158):
- Spawns via g.actorMaster.newActor(params) with params.typ = group resident type
- Resident inherits team from act_*.txt (e.g., bowOrc has team #orcs per act_bowOrc.txt)
- Note: orcHouse (#goblins) releases #orcs units — teams are independent

**Port** (dwelling.ts:76):
- Spawns via game.spawnUnit(this.group.typ) 
- Resident inherits team from registry.resolveActor (same data source)
- Same team independence preserved

Behavioral match: ✓ Residents inherit their own teams, not dwelling's

## Catalogued Non-Issues
Per audit spec, the following are pre-approved non-issues and not flagged:
- Resident spawn offset (dwelling.ts:75-76 adds 20-36px radial offset; original used useOffset=false — spec notes this as "already-fixed")
- Resident level-up logic (dwelling.ts:82-83: random(level) draw; original line 160 same logic)
- Audio/volume, eyestrain, rotational, miniMapStatus, speechColor, layerZ, underConstruction visual
- Attack-cooldown rate, dieSound #none override

## Conclusion
No behavioral divergences detected. orcHouse release cadence, team assignment, self-destruction trigger, and resident spawn logic all exhibit faithful parity with the original Lingo implementation.
