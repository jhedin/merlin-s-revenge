# mysteriousCloud Parity Audit

## Actor Overview
mysteriousCloud is a cloud dwelling (#objDwelling) that spawns enemy ninja units in staggered groups, then self-destructs when its budget is exhausted.

### Data Contract
| Aspect | Lingo (casts/) | TypeScript (port/src/) | Match |
|--------|---|---|---|
| Actor Type | #objDwelling | #objDwelling | ✓ |
| Team | #ninja | #ninja | ✓ |
| Total Residents Budget | 6 | 6 (budget) | ✓ |
| Resident Groups | 3 groups (ninja, shurikenNinja, swordNinja) | 3 groups (ninja, shurikenNinja, swordNinja) | ✓ |
| Group 1: ninja | buildTime [20,50], groupSize [1,3], releaseInterval [30,50] | buildTime [20,50], groupSize [1,3], releaseInterval [30,50] | ✓ |
| Group 2: shurikenNinja | buildTime [35,45], groupSize [1,3], releaseInterval [25,45] | buildTime [35,45], groupSize [1,3], releaseInterval [25,45] | ✓ |
| Group 3: swordNinja | buildTime [35,45], groupSize [1,3], releaseInterval [25,45] | buildTime [35,45], groupSize [1,3], releaseInterval [25,45] | ✓ |

### Behavior Contract

#### Production & Release Logic
Both implementations follow identical state machine:
1. **Produce**: Pick random group → hold for `groupSize * buildTime` frames
2. **Release**: Emit one resident every `releaseInterval` frames until group exhausted
3. **Repeat**: Proceed to next group or self-destruct when budget = 0

**Lingo** (casts/script_objects/modResidents.txt:177-192, objDwelling.txt:105-107):
- Line 180: `varRndRange(1, pResidentGroups.count)` selects random group
- Line 182-186: Production timer = groupSize * buildTime
- Line 164-165: Each releaseResident decrements both counters
- Line 138-143: When pResidentsRemainingCounter.fin, calls noMoreResidents() → startDeath()

**TypeScript** (port/src/components/dwelling.ts:38-52, 54-68):
- Line 48: `this.groups[Math.floor(game.rng.next() * this.groups.length)]` selects random group
- Line 50: Production timer = groupLeft * buildTime (same formula)
- Line 64: Each releaseOne() decrements both budget and groupLeft
- Line 39: When budget <= 0, calls `this.entity.send("takeHit", 999999, 0, this.entity.id)` → death

Both trigger death equivalently: Lingo via noMoreResidents → startDeath (objDwelling:106), TypeScript via takeHit on Energy component.

#### Resident Team Assignment
Both implementations derive resident teams from the individual unit's actor data (NOT the dwelling's team):

**Lingo** (casts/script_objects/modResidents.txt:154-158):
- Line 155: `params.typ = pGroupInProduction.typ` (e.g., "ninja")
- Resident creation calls spawnUnit with typ parameter
- Original spawnUnit resolver reads team from act_ninja.txt data → #ninja

**TypeScript** (port/src/components/dwelling.ts:71-76, port/src/entities/archetypes.ts:54-60):
- Line 76: `spawn(this.group.typ, ...)` where typ = "ninja" / "shurikenNinja" / "swordNinja"
- spawnUnit (archetypes.ts:54-60) resolves team from registry.resolveActor(actorName)["team"]
- ninja/shurikenNinja/swordNinja all resolve to team = "#ninja" (port/src/generated/data.json)

Both are correct: residents are #ninja team units, spawning as enemies to the player.

#### Resident Spawning (Offset & Level)
**Spawn Location** (not flagged as divergence per brief):
- Lingo: `params.useOffset = false` (modResidents:157) → handled by actor spawn default
- TypeScript: Polar offset (radius 20-36, angle random) applied directly in dwelling.ts:75

**Resident Level** (known acceptable per brief):
- Lingo: random(dwellingLevel), dwellings default level 0 → always 0 (modResidents:160)
- TypeScript: Equivalent (dwelling.ts:82: level 0 → 0 level-ups)

---

## Verdict
✓ **CLEAN** — All core behaviors match. Residents spawn from correct groups, released staggered by correct intervals, team assignment correct, dwelling self-destructs on budget exhaustion.
