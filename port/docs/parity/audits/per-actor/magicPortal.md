# Actor Audit: magicPortal

**Actor Type:** #objDwelling  
**Date:** 2026-06-21  
**Status:** CLEAN

## Data Parity

| Property | Lingo (act_magicPortal.txt) | TypeScript (data.json) | Match |
|----------|---------------------------|----------------------|-------|
| objType | #objDwelling | #objDwelling | ✓ |
| inherit | #dwelling | #dwelling | ✓ |
| energy | 25 | 25 | ✓ |
| experienceImWorth | 20 | 20 | ✓ |
| frictionReel | point(100,100) | {x:100, y:100} | ✓ |
| dieSound | #none | #none | ✓ |
| team | #magicalAlliance | #magicalAlliance | ✓ |
| totalResidents | 6 | 6 | ✓ |
| residentGroups[0].typ | #bombMage | #bombMage | ✓ |
| residentGroups[0].buildTime | [4,5] | [4,5] | ✓ |
| residentGroups[0].groupSize | [1,2] | [1,2] | ✓ |
| residentGroups[0].releaseInterval | [5,20] | [5,20] | ✓ |
| residentGroups[1].typ | #thunderMonk | #thunderMonk | ✓ |
| residentGroups[1].buildTime | [5,7] | [5,7] | ✓ |
| residentGroups[1].groupSize | [1,2] | [1,2] | ✓ |
| residentGroups[1].releaseInterval | [5,20] | [5,20] | ✓ |

## Behavioral Verification

### Initialization & Startup
- **Lingo (modResidents.txt:31-47):** Init sets `pResidentsRemainingCounter.tim = [0, params.totalResidents]` (budget = 6), initializes all counters, then objDwelling.start() calls startBuilding().
- **TypeScript (dwelling.ts:28-34):** Init reads `budget` from cfg (resolved as 6 from totalResidents in archetypes.ts:88), then calls `startProduction()` immediately.
- **Parity:** ✓ Both initialize the budget/resident counter to 6 and begin the production cycle.

### Production Cycle
- **Lingo (modResidents.txt:178-192):** startProduction() selects a random group from residentGroups, calculates `groupSize` as min(random(groupSize range), remaining), sets production timer to `groupSize * random(buildTime range)`.
- **TypeScript (dwelling.ts:38-52):** startProduction() selects a random group, calculates `groupLeft = min(rnd(groupSize), budget)`, sets timer to `groupLeft * rnd(buildTime)`.
- **Parity:** ✓ Identical logic: random group selection, group size capped by remaining budget, production time = units × build time per unit.

### Release Sequence
- **Lingo (modResidents.txt:194-215 update cycle):**
  1. produceGroup mode: decrement production timer; when fin, transition to awaitPermission.
  2. awaitPermission mode: check reservationsMaster permission; on approval, transition to releaseCountdown.
  3. releaseCountdown mode: decrement release timer; when fin, call releaseResident() and postReleaseResident().
  4. postReleaseResident (line 129-135): if checkEndOfGroup() true (group exhausted), call produceNextGroupOrDie(); else loop with new releaseInterval.
  5. produceNextGroupOrDie (line 137-144): if pResidentsRemainingCounter.fin (budget exhausted), call noMoreResidents(); else startProduction().
- **TypeScript (dwelling.ts:54-68 update cycle):**
  1. produce mode: decrement timer; when timer <= 0, switch to release mode, reset timer to next releaseInterval.
  2. release mode: if residents.length >= aliveCap (6), delay (await soft cap); else call releaseOne(), decrement budget and groupLeft, check if groupLeft <= 0 (group done), then startProduction() or reset releaseInterval.
  3. startProduction (line 39-46): if budget <= 0 or no groups, send takeHit(999999) to self (death trigger) and set mode to empty.
- **Parity:** ✓ Both follow a produce→release cycle with staggered unit spawning. The Lingo's reservationsMaster → TypeScript's aliveCap is a documented simplification (dwelling.ts comment line 6, 20). The kill-switch logic is identical: when budget exhausted, trigger death.

### Release Mechanism
- **Lingo (modResidents.txt:146-171 releaseResident):**
  - Create new actor via actorMaster.newActor(params).
  - params.typ set to pGroupInProduction.typ (e.g., bombMage, thunderMonk).
  - Spawn at me.ID.bigMe.getLoc() with useOffset=false (uses dwelling center).
  - If dwelling.getExperienceLevel() > 0, setStartingLevel(random(level)) — **magicPortal has level 0 (default), so always 0 level-ups** (line 160).
  - Decrement pCurrentGroupSize and pResidentsRemainingCounter (line 164-165).
  - Call levelUp() on the dwelling (line 170) — dwellings gain no XP in shipped builds.
- **TypeScript (dwelling.ts:71-86 releaseOne):**
  - Spawn via game.spawnUnit(typ, x, y) or game.spawnEnemy(typ, x, y).
  - Spawn location: dwelling.x + cos(angle)×20-36, dwelling.y + sin(angle)×20-36 (offset by 20-36 px, random angle).
  - Level-up logic (line 81-82): `const draw = rng.next(); const ups = level > 0 ? 1 + floor(draw * level) : 0;` — **with level=0, always 0 level-ups** (faithful to line 82 comment).
  - Add entity to game.entities and this.residents (tracked for aliveCap).
- **Parity:** ✓ Both spawn the resident unit type from the group, at the dwelling's location, with level-up scaled to the dwelling's experience level (0 for magicPortal → no level-ups). The offset (Lingo: useOffset=false → center; TS: 20-36px radius) is a documented non-issue (audited non-issue list).

### Team Assignment
- **Lingo:** Residents inherit their actor data team. bombMage and thunderMonk both have team=#magicalAlliance (data/act_bombMage.txt, data/act_thunderMonk.txt).
- **TypeScript (archetypes.ts:72-93):** spawnDwelling resolves team from actor data (line 73), passes to build. releaseOne (dwelling.ts:76) calls spawnUnit/spawnEnemy with typ (e.g., bombMage), which resolves the actor's team (archetypes.ts:54-59). Residents route by their own team via game.teamMaster.isPlayerSide().
- **Parity:** ✓ Both route residents by the actor's own team data. magicPortal residents spawn on #magicalAlliance (their team).

### Group Cycling & Termination
- **Lingo (modResidents.txt:137-144 produceNextGroupOrDie):**
  - If pResidentsRemainingCounter.fin (budget counter hit zero), call me.ID.bigMe.noMoreResidents() (line 139).
  - objDwelling.noMoreResidents() (script_objects/objDwelling.txt:105-107) calls me.startDeath() (line 106).
  - startDeath (line 121-128) checks if not already dead, then calls goMode(#dead), which plays dieSound and flashes.
  - Lingo: dieSound=#none (no audio output).
- **TypeScript (dwelling.ts:38-46):**
  - If budget <= 0 (spent) and groups exist, send takeHit(999999) via dwelling entity to self (line 43).
  - takeHit is handled by Energy/Hurt components → triggers death FSM.
  - Dwelling's archetype includes Grave component (archetypes.ts:38), so death leaves a grave (faithful to objDwelling behavior).
  - dieSound is passed in cfg but evaluated by Energy/death handler; magicPortal.dieSound=#none (no audio).
- **Parity:** ✓ Both self-destruct when budget exhausted, triggering death animation and grave (dieSound #none is handled identically).

### Edge Cases
1. **Concurrent Resident Cap:** Lingo uses reservationsMaster (complex gating); TypeScript uses aliveCap=6 (hard cap, not soft). This is documented as a simplification (dwelling.ts:6, archetypes.ts:87). Behavior: if 6+ residents alive, delay next spawn. magicPortal budget=6, max group size [1,2], so max concurrent ~6-8 units (balanced). ✓
2. **Empty Groups:** If a group's random groupSize is 0 (impossible with [1,2] range), startProduction would loop. Dwelling gracefully handles empty groups (budget <= 0 check line 39). ✓
3. **Resident Death Tracking:** Lingo tracks via counters; TS tracks via residents array (dwelling.ts:56). Both count active residents for release gating. ✓

## Conclusion

**CLEAN.** The magicPortal dwelling exhibits behavioral parity between the Lingo original and TypeScript port across all material aspects:
- Data is bit-identical.
- Initialization, production, and release cycles follow the same state machine logic.
- Resident spawning preserves team, type, and level-up logic.
- Self-destruction on budget exhaustion is identical.
- The reservationsMaster → aliveCap simplification is documented and does not diverge behavior for shipped dwellings.

No gaps detected.
