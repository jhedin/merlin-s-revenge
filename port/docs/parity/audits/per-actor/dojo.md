# Dwelling Parity Audit: DOJO (#objDwelling, team #karate)

## Summary

| Aspect | Status | Notes |
|--------|--------|-------|
| Data (residentGroups, totalResidents) | ✓ CLEAN | 7 residents across 3 groups; all resident types resolve correctly (case-insensitive fallback handles #SpeedyGuy → act_speedyGuy) |
| Resident type roster | ✓ CLEAN | karateGuy, kongFuChicken, speedyGuy; all have team: #karate |
| Spawn cadence (buildTime, releaseInterval) | ✓ CLEAN | Faithful to modResidents FSM: produce → release → next group |
| Team-aware spawn routing | ✓ CLEAN | Residents spawned via game.spawnUnit, which routes by actor's OWN team (#karate) |
| Budget (totalResidents = 7) | ✓ CLEAN | Correctly passed from data → spawnDwelling → Dwelling.init() → budget field |
| Resident release FSM | ✓ CLEAN | produce (groupSize*buildTime) → release (one per releaseInterval) → next group (or self-destruct when empty) |
| Soft concurrent cap | ✓ CLEAN | aliveCap = 6 stand-in for reservationsMaster (line 20, dwelling.ts) |
| Dwelling self-destruct | ✓ CLEAN | When budget ≤ 0, calls takeHit(999999, ...) to self-destruct (line 41, dwelling.ts) |

## BEHAVIORAL DIVERGENCE

| Gap | Severity | Evidence |
|-----|----------|----------|
| **Dwelling Experience Module Missing** | MINOR | **Original:** objDwelling.txt line 15 adds modExperience; modResidents.txt line 170 calls `me.big.levelUp()` after each resident release. **Port:** DwellingArchetype (archetypes.ts line 38) has NO Experience component. **Impact:** Residents spawn with fixed 50% chance to level up (dwelling.ts line 76), not based on dwelling's experience level. Original: `if me.big.getExperienceLevel() > 0 then newUnit.setStartingLevel(random(me.big.getExperienceLevel()))` (modResidents.txt lines 159–161) — residents spawn at 0 to dwelling_level. Port: fixed 50% chance for all residents regardless of dwelling progression. **Note:** This is catalogued as non-blocking for dojo specifically (dwellings typically don't accumulate much XP in play), but represents a code structure divergence. |

## Conclusion

**ACTOR=dojo | GAPS=1** | Dwelling lacks Experience component, preventing level-up-based resident scaling. All other behaviors (release FSM, team routing, budget tracking, self-destruct) are behaviorally correct.
