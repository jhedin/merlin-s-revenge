# teamOverride Region Marker — Behavioral Parity Audit

## Summary
The `teamOverride` region marker has been correctly ported from Lingo to TypeScript. The marker spawns, applies the team-override effect immediately, and resets appropriately on room transitions. All targeting logic correctly consumes the override.

## Data Verification
- **Original (Lingo):** `casts/data/act_teamOverride.txt` defines `#teamToTarget: #aldevar` (line 7)
- **Port:** `port/src/generated/data.json` contains the resolved actor with `"teamToTarget": "#aldevar"`
- **Registry:** Case-insensitive lookup works correctly (registry.ts lines 61–89)

## Spawn Flow
1. `spawnFromSymbol("#teamOverride", x, y)` in `entities/actorSerial.ts:52` dispatches to:
2. `spawnRegionMarker("teamOverride", str(rec, "teamToTarget", "#none"), x, y, name)`
3. `objTypes.ts:59–63` creates a `MarkerArchetype` entity with the effect and value
4. `RegionMarker.init()` in `components/regionMarker.ts:25–30` invokes `apply()`
5. `RegionMarker.apply()` at line 42–45 sets `game.teamMaster.teamOverride = String(this.value)` (= `"#aldevar"`)

**✓ Marker correctly applies override on spawn** (mirrors original `objTeamOverride.init` at `casts/script_objects/objTeamOverride.txt:19`)

## Consumption Flow
`systems/teams.ts:calcTargetTeams()` (lines 86–97) uses the override:
- Line 88: `const ov = this.teamOverride;`
- Lines 89–92: If override is set and the actor is an enemy seeking hostiles (and not already on the override team's side), returns a gang-up targeting set: `[[...o.friends, ov]]`
- Fallback to normal allegiance-based targeting if conditions don't match

**✓ Override is consumed by targeting logic** (mirrors original `teamMaster.calcTargetTeamsOverride` at `casts/master_objects/teamMaster.txt:159–170`)

## Reset Flow
1. `RoomManager.enter()` at `world/rooms.ts:93–94`:
   - Clears `game.magicLimit` and resets `game.teamMaster.teamOverride = null`
   - Happens BEFORE new room's markers are spawned
2. Old markers are cleared (line 104: `game.entities = game.entities.filter((e) => e.type === "player")`)
3. New room's markers re-apply on spawn

**✓ Override correctly resets at room transition** (mirrors original `objTeamOverride.finish` at `casts/script_objects/objTeamOverride.txt:22–26`)

## Test Coverage
All three behavioral scenarios are tested in `port/test/phase_i.test.ts` (lines 148–174):
1. Override changes targeting: a `#monsters` unit's `#enemy` targets include the override team
2. Clearing override restores normal `#hates`-based targeting
3. Spawning the marker sets `teamMaster.teamOverride` to the actor's `#teamToTarget`

All tests pass.

## Conclusion
No gaps found. The teamOverride region marker correctly:
- Resolves its `#teamToTarget` data property
- Applies the override on spawn
- Is consumed by targeting decisions in findTarget, findHostileWithin, findNearestEnemyBullets, and impactAreaAttack
- Resets safely on room transitions

---

**ACTOR=teamOverride | CLEAN**
