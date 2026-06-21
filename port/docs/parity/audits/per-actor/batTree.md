# batTree Dwelling Behavioral Parity Audit

## Actor Summary
**Name:** batTree  
**Type:** #objDwelling (resident-releasing building)  
**Team:** #cave  
**Resident Type:** #bat (hostile units)

## Data Parity

| Property | Original (casts/) | Port (port/src/) | Match? |
|----------|-------------------|------------------|--------|
| `#objType` | #objDwelling | #objDwelling | ✓ |
| `#team` | #cave | #cave | ✓ |
| `#residentGroups[0].typ` | #bat | #bat | ✓ |
| `#residentGroups[0].buildTime` | [20, 30] | [20, 30] | ✓ |
| `#residentGroups[0].groupSize` | [1, 6] | [1, 6] | ✓ |
| `#residentGroups[0].releaseInterval` | [10, 50] | [10, 50] | ✓ |
| `#totalResidents` | 10 | 10 (as `budget`) | ✓ |
| `#energy` | 100 | 100 | ✓ |
| `#dieSound` | "tree_die" | "tree_die" | ✓ |

**Source:** casts/data/act_batTree.txt:1-21 vs port/src/generated/data.json (act_batTree)

## Behavioral Parity

### Resident Release FSM

**Original (modResidents.txt:194-216):**
- `#produceGroup` (line 198): countdown timer runs groupSize * buildTime
- `#awaitPermission` (line 204-206): checks reservationsMaster for slot
- `#releaseCountdown` (line 208-213): countdown per releaseInterval, fires each unit
- `#empty` (line 140): terminal state when budget spent

**Port (dwelling.ts:52-67):**
- `"produce"` (line 57-58): decrement timer, then enter "release" mode, reset timer to next releaseInterval
- `"release"` (line 59-65): 
  - Soft cap check: if `residents.length >= aliveCap` (6 units), defer and re-schedule
  - Else: release one unit, decrement budget/groupLeft
  - If groupLeft ≤ 0: call startProduction (next group or empty)
  - Else: reset timer to next releaseInterval
- `"empty"` (line 43): terminal state; building self-destructs (takeHit 999999)

**Mapping:**
- Original `#produceGroup` → Port `"produce"`: ✓ Same timer-based production
- Original `#awaitPermission` → Port resident cap check (line 60): ✓ Soft-cap replaces reservationsMaster
- Original `#releaseCountdown` → Port `"release"`: ✓ Same interval-spaced single-unit release
- Original `#empty` → Port `"empty"`: ✓ Same terminal state with self-destruct

### Resident Spawning

**Original (modResidents.txt:146-171):**
- Line 155: `params.typ = pGroupInProduction.typ` → spawn batTree residents as #bat
- Line 156: `params.startLoc = me.ID.bigMe.getLoc()` → spawn at building location
- Line 159-161: random starting level (0 or 1)
- Line 165: residents counted toward budget (`pResidentsRemainingCounter.theCount`)

**Port (dwelling.ts:69-79, archetypes.ts:70-94):**
- Line 70: `spawn = game.spawnUnit ?? game.spawnEnemy` → routes by actor team
- Line 74: `spawn(this.group.typ, m.x + Math.cos(a) * r, m.y + Math.sin(a) * r, ...)` → spawn batTree residents as #bat, offset from building
- Line 76: `if (game.rng.next() < 0.5) e.send("forceLevelUp")` → random starting level (50% chance)
- Line 62: `this.budget--` → residents counted toward budget

**Resident Routing:**
- batTree has `team: #cave`
- bat has `team: #cave`
- spawnUnit (archetypes.ts:54-59) reads bat's team → `game.teamMaster.isPlayerSide(team)` returns false for #cave
- Result: bat spawned as `type: "enemy"` (hostile to player)
- **Behavioral match:** ✓ Residents are hostile units on team #cave, not player allies

### Production Budget

**Original (modResidents.txt:44, 138, 182):**
- Budget initialized to `params.totalResidents` (10 for batTree)
- Each unit release decrements `pResidentsRemainingCounter.theCount` (line 165)
- Production stops when counter reaches 0 (line 138: `if pResidentsRemainingCounter.fin`)

**Port (dwelling.ts:29, 62, 37):**
- Budget initialized to cfg["budget"] (10 for batTree, from spawnDwelling line 88)
- Each unit release decrements `this.budget--` (line 62)
- Production stops when budget ≤ 0 (line 37: `if (this.budget <= 0)`)

**Behavioral match:** ✓ Lifetime budget enforced, production halts at zero

## Conclusion

**CLEAN** — batTree dwelling releases hostile #cave-team bat units in staggered groups (1-6) with production times 20-30 frames, release intervals 10-50 frames, up to a lifetime budget of 10 residents, then self-destructs. All data properties match, FSM states are equivalent, resident routing is correct (bats spawn as enemies, not allies), and budget tracking is faithful.
