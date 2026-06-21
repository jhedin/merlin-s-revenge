# Audit: goblinHut (objDwelling)

## Summary
**STATUS: CLEAN** — goblinHut's dwelling behavior (resident generation, cadence, self-destruct) is faithfully ported.

## Behavioral Parity Checklist

| Behavior | Original (Lingo) | Port (TS) | Status |
|----------|------------------|-----------|--------|
| **Spawn location** | Placed on map via tile layer | Placed on map via tile layer | ✓ Identical |
| **Team** | #goblins | #goblins (team config) | ✓ Verified |
| **Resident groups** | goblinArcher, goblinWarrior | Resolved from `act_goblinArcher`, `act_goblinWarrior` | ✓ Verified |
| **Group selection** | Random pick from residentGroups | `groups[Math.floor(rng() * groups.length)]` | ✓ Identical |
| **Group size range** | [3,7] per group | [3,7] per group | ✓ Verified |
| **Build time per resident** | [40,50] / [35,45] per group | [40,50] / [35,45] per group | ✓ Verified |
| **Release interval** | [30,50] / [25,45] per group | [30,50] / [25,45] per group | ✓ Verified |
| **Lifetime budget** | 10 (default via modResidents:26) | 10 (default via archetypes.ts:88; no explicit totalResidents in data) | ✓ Identical |
| **Production cadence** | `groupSize * buildTime` ticks to produce, then release staggered by releaseInterval | Same: `groupLeft * rnd(buildTime)` ticks, then release with releaseInterval spacing | ✓ Verified |
| **Release queue** | One resident per releaseInterval tick when not throttled | Same: decrements budget per release | ✓ Verified |
| **Resident level** | `random(dwellingLevel)` where dwellingLevel=0 → always 0 | Same: `level > 0 ? 1 + floor(rng * level) : 0` → always 0 | ✓ Verified |
| **Self-destruct** | `noMoreResidents()` → FSM end, building dies | `takeHit(999999)` when budget ≤ 0 | ✓ Faithful intent |
| **Concurrent cap** | reservationsMaster throttles releases (~6 units alive) | Soft cap: `aliveCap = 6`, throttles release queue | ✓ Equivalent |

## Key Code References

**Original (Lingo):**
- Data: `casts/data/act_goblinHut.txt:8-21` (residentGroups: goblinArcher [40-50, 3-7, 30-50], goblinWarrior [35-45, 3-7, 25-45])
- Logic: `casts/script_objects/modResidents.txt:26` (default totalResidents=10), `modResidents.txt:178-192` (startProduction), `modResidents.txt:146-171` (releaseResident)
- Destruction: `casts/script_objects/modResidents.txt:137-144` (produceNextGroupOrDie calls noMoreResidents when budget spent)

**Port (TS):**
- Data: `port/src/generated/data.json` (residentGroups resolved, no explicit totalResidents → defaults to 10)
- Logic: `port/src/components/dwelling.ts:38-51` (startProduction), `dwelling.ts:54-69` (update loop), `dwelling.ts:71-86` (releaseOne)
- Destruction: `port/src/entities/archetypes.ts:88` (budget default), `dwelling.ts:39-44` (takeHit when budget ≤ 0)

## Test Verification
✓ `port/test/dwelling.test.ts:18-28` — goblinHut spawns and produces goblins (team #goblins) at level 0
✓ `port/test/dwelling.test.ts:30-44` — Lifetime budget is respected; dwelling stops after budget spent

---
**Conclusion:** No behavioral gaps detected. Resident spawning, team assignment, cadence (production + staggered release), and self-destruct are all faithful to the original.
