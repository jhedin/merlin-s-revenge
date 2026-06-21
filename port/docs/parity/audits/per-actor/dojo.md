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

## Catalogued Gaps (Known, Not Flagged)

The following divergences from the original are documented in `/port/docs/parity/02-actors-bosses-dwellings.md` (§2, dwellings table) and tracked in the parity audit backlog:

1. **No per-resident leveling** (documented line 129–131): Original `modResidents.releaseResident` calls `me.big.levelUp()` on each release; port has flat level-1 spawns. Effort: M. Status: not yet implemented.
2. **`reservationsMaster` replaced by per-building `aliveCap`** (line 132–135): Port uses soft cap 6 instead of global reservation system. Acceptable stand-in for slice.

## Conclusion

**ACTOR=dojo | CLEAN** — All behavioral parity checks pass. Resident groups release correctly on schedule, residents spawn with the correct team (#karate), and the budget is consumed faithfully. Known dwelling-system gaps (leveling, global reservations) are catalogued backlog items, not dojo-specific divergences.
