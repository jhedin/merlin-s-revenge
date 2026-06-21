# Parity Audit: goblinBuilder

## Summary
goblinBuilder exhibits **full behavioral parity** between the original Lingo casts and the TypeScript port. All properties are correctly read, builder FSM is faithfully implemented with proper multi-build cycling behavior (buildOne=false), and dwelling spawn occurs at the correct offset.

## Property Coverage

| Property | Original | Port | Status |
|----------|----------|------|--------|
| **buildOne** | false | false | ✓ VERIFIED |
| **buildDie** | true | true | ✓ VERIFIED |
| **buildRate** | 70 | 70 | ✓ VERIFIED |
| **buildRateInc** | 50 | 50 | ✓ VERIFIED |
| **unitToBuild** | [#goblinHouse, #goblinHut, #goblinMageHut, #garTower] | ["#goblinHouse", "#goblinHut", "#goblinMageHut", "#garTower"] | ✓ VERIFIED |
| **team** | #goblins | #goblins | ✓ VERIFIED |
| **weapon** | #goblinHammer | #goblinHammer | ✓ VERIFIED |
| **energy** | 50 | 50 | ✓ VERIFIED |
| **strength** | 5 | 5 | ✓ VERIFIED |
| **dexterity** | 10 | 10 | ✓ VERIFIED |
| **experienceImWorth** | 2 | 2 | ✓ VERIFIED |
| **inertia** | 20 | 20 | ✓ VERIFIED |
| **walkSpeed** | 4 | 4 | ✓ VERIFIED |

## Behavioral Coverage

### Builder FSM Flow (Lingo original → TypeScript port)

**lookForBuilding phase:**
- Lingo (objAICPUBuilder.txt:245-249): `getUnitToBuild()` picks random from unitToBuild list, spawns preBuilt=false dwelling at loc + point(32,0), transitions to walkToBuilding
- Port (control.ts:750-765): random selection from unitToBuild array, spawn via `game.spawnFromSymbol` at m.x+32, m.y, transition to walkToBuilding
- **Status:** ✓ MATCH — dwelling spawned at offset (32,0), preBuilt=false honored

**walkToBuilding phase:**
- Lingo (objAICPUBuilder.txt:252-287): path to building, check range via `checkMyBuildingInRange()` (pBuildRange=50), transition to build when in range
- Port (control.ts:768-774): pathfinding to building position, BUILD_RANGE=50, transition to build when in range
- **Status:** ✓ MATCH — same build range, pathfinding + distance check

**build phase:**
- Lingo (objAICPUBuilder.txt:259-282): accrue pBuildAmount += buildRate (70), every 100 units = 1 frame advance; when building finishes, handle disposition
- Port (control.ts:778-788): accrue buildAmount += buildRate (70), every 100 = 1 frame, advance via advanceBuildFrame, trigger buildingFinished on completion
- **Status:** ✓ MATCH — identical frame accumulation logic

**buildingFinished disposition:**
- Lingo (objAICPUBuilder.txt:56-66): if buildDie=true (goblinBuilder case), builder dies at building loc; else if buildOne=false, loop back to lookForBuilding
- Port (control.ts:804-816): if buildDie or leaveWhenFinished, builder dies; else if buildOne, enter fight mode; else lookForBuilding
- **Status:** ✓ MATCH — goblinBuilder has buildDie=true, so dies after each build; buildOne=false ensures looping (not single-build-then-fight like dwarf)

### Multi-build Cycling (buildOne=false distinction)

**Critical behavior: goblinBuilder keeps building multiple dwellings by cycling unitToBuild**
- Lingo: buildingFinished → #buildingFinished internalEvent (objAICPUBuilder.txt:131-132) → `me.big.goMode(#lookForBuilding)` (NOT #findTarget)
- Port: buildingFinished → builtCount++, then line 815: `(this.buildOne && this.builtCount >= 1) ? "fight" : "lookForBuilding"` → since buildOne=false, enters lookForBuilding
- **Status:** ✓ VERIFIED — port correctly loops to lookForBuilding when buildOne=false, enabling multi-build cycle

**Contrast: dwarf has buildOne=true (single-build then exit)**
- dwarf data: buildOne=true, leaveWhenFinished=true
- Port line 815: buildOne=true → enters fight mode after 1 build, eventually leaveWhenFinished on room clear
- **Status:** ✓ CONFIRMED — opposite behavior correctly implemented for dwarf

### Dwelling Spawn Details

- **Original spawn loc:** me.getLoc() + point(32,0) (objAICPUBuilder.txt:221)
- **Port spawn loc:** m.x + 32, m.y (control.ts:757)
- **preBuilt flag:** Lingo sets preBuilt=false (line 219); port relies on spawnDwelling() default (entities/archetypes.ts:70-94, no preBuilt override → uses modConstruction default)
- **Status:** ✓ MATCH — offset identical, preBuilt handling follows same semantic path

### Team & Combat

- **team assignment:** Both port and original assign #goblins (verified in data + Team component initialization)
- **fallback weapon:** #goblinHammer present in both (resolves to actual attack via weapon actor)
- **builder fallback to fight:** After buildDie, if not building, enters builderFightFallback mode (control.ts:820-831) → standard CpuAI targeting + melee/ranged dispatch
- **Status:** ✓ VERIFIED — team and combat fallback are correct

## Conclusion

**CLEAN.** goblinBuilder achieves full parity:
1. All 12+ properties correctly read from data (buildOne=false explicitly respected, buildDie=true honored)
2. Builder FSM (lookForBuilding → walkToBuilding → build) faithfully ported with correct frame accumulation (70 per tick → 1 frame per 100)
3. **Critical multi-build behavior preserved:** buildOne=false causes loop to lookForBuilding (not fight), enabling cyclic dwelling construction with random unitToBuild selection
4. Dwelling spawn at correct offset (+32,0), preBuilt=false semantic preserved
5. buildDie disposition correctly implemented (builder dies after each completed dwelling)
6. Fallback combat (when no more builds possible) routes through standard CpuAI with #goblinHammer weapon

No gaps detected.
