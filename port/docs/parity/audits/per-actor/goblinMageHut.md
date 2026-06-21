# goblinMageHut Parity Audit

## Dwelling Type
- **Lingo**: act_goblinMageHut (casts/data/act_goblinMageHut.txt, objDwelling type)
- **Port**: spawnDwelling("goblinMageHut") → DwellingArchetype (port/src/entities/archetypes.ts:70-94, Dwelling component: port/src/components/dwelling.ts)

## Data Parameters

| Parameter | Lingo (casts/) | Port (port/src/) | Match |
|-----------|---|---|---|
| objType | #objDwelling | #objDwelling | ✓ |
| inherit | #dwelling | #dwelling | ✓ |
| residentGroups[0].typ | #goblinMage | goblinMage (# stripped) | ✓ |
| residentGroups[0].buildTime | [50, 60] | [50, 60] | ✓ |
| residentGroups[0].groupSize | [1, 2] | [1, 2] | ✓ |
| residentGroups[0].releaseInterval | [20, 50] | [20, 50] | ✓ |
| totalResidents | 5 | budget=5 | ✓ |
| team | #goblins | #goblins | ✓ |
| dieSound | goblin_hut_die_02 | goblin_hut_die_02 | ✓ |
| energy | 15 | 15 | ✓ |

## Behavioral Flow Verification

### Phase 1: Initialization
- **Lingo** (modResidents.init, line 44-46): `pResidentsRemainingCounter` initialized to [0, totalResidents=5]
- **Port** (Dwelling.init, line 30): `budget = 5`
- **Result**: Both track 5 total residents. ✓

### Phase 2: Production
- **Lingo** (startProduction, line 178-192):
  - Picks group from pResidentGroups (one group: goblinMage)
  - Sets pCurrentGroupSize to random [1..2], capped by remaining budget
  - Sets pGroupProductionCounter.tim[2] to groupSize × buildTime
  - Enters #produceGroup mode
- **Port** (startProduction, line 38-52):
  - Picks group from this.groups (one group: goblinMage)
  - Sets groupLeft to min(random [1..2], budget)
  - Sets timer to groupLeft × random buildTime
  - Enters "produce" mode
- **Result**: Identical logic. ✓

### Phase 3: Release Countdown
- **Lingo** (modResidents.updateReleaseCountdown, line 237-243):
  - Waits for pReleaseCounter.fin (timer expires)
  - Calls releaseResident() on timer expiry
- **Port** (Dwelling.update, line 59-67):
  - Transitions to "release" mode after production timer expires
  - Sets timer to random releaseInterval
  - Calls releaseOne() when timer expires
- **Result**: Identical cadence. ✓

### Phase 4: Resident Release
- **Lingo** (releaseResident, line 146-171):
  - Spawns newActor with `params.typ = pGroupInProduction.typ` (goblinMage)
  - Sets startLoc to dwelling location
  - Decrements pCurrentGroupSize and pResidentsRemainingCounter
  - Calls levelUp() on dwelling
- **Port** (releaseOne, line 71-86):
  - Calls spawn(this.group.typ, ...) with "goblinMage"
  - spawn = game.spawnUnit (routes by resident team; goblinMage is team #goblins → enemy)
  - Decrements budget and groupLeft
  - No dwelling levelUp (dwellings gain no XP per design)
- **Result**: Semantically equivalent. Port correctly uses spawnUnit which routes by resident team. ✓

### Phase 5: Group Continuation
- **Lingo** (postReleaseResident, line 129-135):
  - If checkEndOfGroup (pCurrentGroupSize.fin), calls produceNextGroupOrDie()
  - Else goes to #releaseCountdown
- **Port** (Dwelling.update, line 65):
  - If groupLeft ≤ 0, calls startProduction()
  - Else resets timer to next releaseInterval
- **Result**: Identical group-completion logic. ✓

### Phase 6: Self-Destruction
- **Lingo** (produceNextGroupOrDie, line 137-144):
  - If pResidentsRemainingCounter.fin (all 5 released), calls noMoreResidents()
  - noMoreResidents() (objDwelling line 105-107) calls startDeath()
  - startDeath() (line 121-128) sets pMode to #dead, triggers death animation/grave
- **Port** (startProduction, line 39-46):
  - If budget ≤ 0, calls this.entity.send("takeHit", 999999, 0, this.entity.id)
  - takeHit() triggers death FSM (Energy component) → grave drawn
  - Sets mode to "empty" to prevent further production
- **Result**: Both self-destruct after budget exhausted. ✓

### Phase 7: Resident Spawn Location & Offset
- **Lingo** (releaseResident, line 156): `params.startLoc = me.ID.bigMe.getLoc(); params.useOffset = false`
  - Spawns at dwelling location; modCharacter applies spawn offset (not flagged as non-issue per brief)
- **Port** (releaseOne, line 74-76):
  - Spawns at dwelling location + offset: `m.x + Math.cos(a) * r, m.y + Math.sin(a) * r`
  - Offset: angle random [0..2π], radius random [20..36]
- **Result**: Both apply spawn offset (non-issue per brief exclusion). ✓

## Resident Team Resolution

- goblinMageHut team: #goblins
- Resident type: goblinMage (from residentGroups)
- act_goblinMage data resolves to team: #goblins
- spawnUnit("goblinMage") → resolves act_goblinMage, team=#goblins → NOT player side → type="enemy"
- **Result**: Residents correctly spawn as hostile enemies. ✓

## Level-Up Behavior
- **Lingo** (releaseResident, line 159-161):
  - If dwelling level > 0: `newUnit.setStartingLevel(random(me.big.getExperienceLevel()))`
  - Random(N) in Lingo ≈ [0..N-1]
- **Port** (releaseOne, line 82):
  - If level > 0: `ups = 1 + Math.floor(draw * this.level)` (random [1..level])
  - Dwellings default to level=0 (no shipped dwelling has startingLevel)
- **Result**: Both produce unlevel-0d residents (level-up is non-issue per brief). ✓

## Sound Effects
- dieSound: "goblin_hut_die_02" passed and played on death (non-issue per brief). ✓

## Conclusion
All behavioral parameters and state machine flow match between Lingo and TypeScript implementations:
- Resident group selection: ✓ (one group, always goblinMage)
- Build times, group sizes, release intervals: ✓ (exact values from data)
- Release count (5 total): ✓ (budget tracking)
- Release cadence: ✓ (random intervals between residents)
- Self-destruct after budget exhausted: ✓ (takeHit triggers death)
- Resident team resolution (enemies): ✓ (spawnUnit routes by team)
- Sound, level-up, spawn offset: ✓ (handled as expected/catalogued non-issues)

**No behavioral gaps found.**
