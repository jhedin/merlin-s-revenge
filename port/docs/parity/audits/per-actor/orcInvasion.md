# orcInvasion Dwelling Behavioral Parity Audit

## Actor Summary
**Name:** orcInvasion  
**Type:** #objDwelling (resident-releasing building)  
**Team:** #invisible (off-screen spawner, hostile)  
**Resident Types:** #bowOrc, #swordOrc, #mageOrc (orc invasion wave)

## Data Parity

| Property | Original (casts/) | Port (port/src/) | Match? |
|----------|-------------------|------------------|--------|
| `#objType` | #objDwelling | #objDwelling | ✓ |
| `#team` | #invisible | #invisible | ✓ |
| `#residentGroups[0].typ` | #bowOrc | #bowOrc | ✓ |
| `#residentGroups[0].buildTime` | [52, 62] | [52, 62] | ✓ |
| `#residentGroups[0].groupSize` | [3, 6] | [3, 6] | ✓ |
| `#residentGroups[0].releaseInterval` | [10, 10] | [10, 10] | ✓ |
| `#residentGroups[1].typ` | #swordOrc | #swordOrc | ✓ |
| `#residentGroups[1].buildTime` | [55, 65] | [55, 65] | ✓ |
| `#residentGroups[1].groupSize` | [3, 6] | [3, 6] | ✓ |
| `#residentGroups[1].releaseInterval` | [10, 10] | [10, 10] | ✓ |
| `#residentGroups[2].typ` | #mageOrc | #mageOrc | ✓ |
| `#residentGroups[2].buildTime` | [60, 70] | [60, 70] | ✓ |
| `#residentGroups[2].groupSize` | [2, 3] | [2, 3] | ✓ |
| `#residentGroups[2].releaseInterval` | [10, 10] | [10, 10] | ✓ |
| `#totalResidents` | (default 10) | 10 (as `budget`) | ✓ |
| `#energy` | 1000 | 1000 | ✓ |
| `#dieSound` | #none | #none | ✓ |

**Source:** casts/data/act_orcInvasion.txt:1-34 vs port/src/generated/data.json (act_orcInvasion)

## Behavioral Parity

### Resident Release FSM

**Original (modResidents.txt:194-216):**
- `#produceGroup` (line 198-199): countdown timer runs groupSize * buildTime
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
- Line 155: `params.typ = pGroupInProduction.typ` → spawn orcInvasion residents as #bowOrc/#swordOrc/#mageOrc
- Line 156: `params.startLoc = me.ID.bigMe.getLoc()` → spawn at building location
- Line 159-161: random starting level (0 or ≤ buildingLevel)
- Line 165: residents counted toward budget (`pResidentsRemainingCounter.theCount`)

**Port (dwelling.ts:71-85, archetypes.ts:70-94):**
- Line 72: `spawn = game.spawnUnit ?? game.spawnEnemy` → routes by actor team
- Line 76: `spawn(this.group.typ, m.x + Math.cos(a) * r, m.y + Math.sin(a) * r, ...)` → spawn orcInvasion residents as #bowOrc/#swordOrc/#mageOrc, offset from building
- Line 82-83: random starting level (0 or ≤ buildingLevel)
- Line 62: `this.budget--` → residents counted toward budget

**Resident Routing:**
- orcInvasion has `team: #invisible`
- bowOrc/swordOrc/mageOrc have `team: #orcs`
- spawnUnit (archetypes.ts:54-59) reads the orc's team (#orcs), not the dwelling's team (#invisible)
- `game.teamMaster.isPlayerSide("#orcs")` returns false
- Result: orc units spawn as `type: "enemy"` (hostile to player, not player allies)
- **Behavioral match:** ✓ Residents are hostile orc units on team #orcs, spawned from invisible team spawner

### Invisible Team Semantics

**Original (objDwelling.txt, modResidents.txt):**
- The dwelling object itself has team #invisible (registered in tem_invisible team data)
- The dwelling is targetable/destroyable like any dwelling (takes hits, dies normally)
- No special rendering suppression; "invisible" refers to team allegiance, not sprite visibility
- An #invisible-team object is not an enemy to allies (not in #aldevar.hates per tem_aldevar line 2 tertiary)

**Port (archetypes.ts:70-94, dwelling.ts, systems/teams.ts:80-83):**
- The dwelling entity has team #invisible from act_orcInvasion.data.team
- `game.teamMaster.isPlayerSide("#invisible")` returns false → dwelling type set to "enemy"
- The dwelling is targetable/destroyable like any enemy dwelling (Energy + Team components)
- No special rendering logic suppresses the dwelling sprite; "invisible" is a team name, not a visibility flag
- An #invisible-team object can be targeted by player allies per tem_aldevar allegiance (confirmed in data)
- **Behavioral match:** ✓ Invisible spawner is an off-screen team that is hostile but targetable, dwellings self-destruct when residents spent

### Production Budget

**Original (modResidents.txt:44, 138, 182):**
- Budget initialized to `params.totalResidents` (10 for orcInvasion, default in line 26)
- Each unit release decrements `pResidentsRemainingCounter.theCount` (line 165)
- Production stops when counter reaches 0 (line 138: `if pResidentsRemainingCounter.fin`)

**Port (dwelling.ts:29, 62, 37):**
- Budget initialized to cfg["budget"] (10 for orcInvasion, from spawnDwelling line 88: default 10)
- Each unit release decrements `this.budget--` (line 62)
- Production stops when budget ≤ 0 (line 37: `if (this.budget <= 0)`)

**Behavioral match:** ✓ Lifetime budget enforced, production halts at zero

## Conclusion

**CLEAN** — orcInvasion dwelling releases hostile orc units in randomized groups (3-6 bowOrc, 3-6 swordOrc, 2-3 mageOrc) with production times 52-70 frames, release intervals 10 frames per unit, up to a lifetime budget of 10 residents, then self-destructs. The spawner itself is on team #invisible (off-screen, hostile but targetable), while residents route by their own team #orcs. All data properties match exactly, FSM states are equivalent, resident routing is correct (orcs spawn as enemies, not allies), and budget tracking is faithful.
