# Cocoon Dwelling Audit

## Data Parity

| Property | Original (casts/data/act_cocoon.txt) | Port (port/src/generated/data.json) | Match |
|----------|------|------|-------|
| objType | #objDwelling | #objDwelling | ✓ |
| Team | #monsters | #monsters | ✓ |
| Resident Type | #quadranid | #quadranid (stripped to "quadranid") | ✓ |
| Build Time Range | [10, 20] | [10, 20] | ✓ |
| Group Size Range | [1, 6] | [1, 6] | ✓ |
| Release Interval Range | [10, 20] | [10, 20] | ✓ |
| Total Residents Budget | 14 | 14 | ✓ |

## Behavioral Parity

### Resident Release FSM

**Original (casts/script_objects/modResidents.txt):**
- State machine: `#produceGroup` → `#awaitPermission` → `#releaseCountdown` (repeat) → `#empty`
- Lines 137–144: `produceNextGroupOrDie` checks `pResidentsRemainingCounter.fin` to determine if budget exhausted
- Line 211: `releaseResident()` called during `#releaseCountdown` mode
- Lines 164–165: Each release decrements both `pCurrentGroupSize` and `pResidentsRemainingCounter`
- Line 182: Group size capped to remaining budget: `min(VarRndRange(pGroupInProduction.groupSize), pResidentsRemainingCounter.theCount)`

**Port (port/src/components/dwelling.ts):**
- State machine: `"produce"` → `"release"` (repeat) → `"empty"`
- Lines 46–49: Picks random group, calculates production time, transitions to produce
- Lines 57–65: `update()` implements release FSM with timer-based state progression
- Line 62: `this.budget--` decrements budget on each release
- Line 63: When `groupLeft <= 0`, calls `startProduction()` (next group or empty)
- Line 47: Group size capped to remaining budget: `Math.min(this.rnd(this.group.groupSize), this.budget)`
- Line 37–45: When budget ≤ 0, calls `takeHit()` to destroy dwelling (equivalent to `noMoreResidents()`)

### Team & Resident Type Resolution

**Original (casts/script_objects/modResidents.txt):**
- Line 155: `params.typ = pGroupInProduction.typ` (typ from residentGroups config, e.g., `#quadranid`)
- Line 158: `newUnit = g.actorMaster.newActor(params)` spawns actor via typ lookup
- Resident team inherited from act_quadranid: `#monsters` (casts/data/act_quadranid.txt line 16)

**Port (port/src/entities/archetypes.ts):**
- Line 80: `g["typ"].replace(/^#/, "")` strips # prefix; stored as "quadranid"
- Line 85: `.filter((g) => g.typ && registry.resolveActor(g.typ))` validates resident type exists
- Line 74 in dwelling.ts: `spawn(this.group.typ, ...)` calls `spawnUnit` or `spawnEnemy`
- spawnUnit (archetypes.ts:54–59) reads team from actor data: quadranid inherits `#monsters` (port/src/generated/data.json)

### Resident Release Cadence

**Original:**
- Line 174: `pReleaseCounter.tim[2] = VarRndRange(pGroupInProduction.releaseInterval)` (lines 9–12 in example: [10, 20])
- Line 209–213: Each frame, if in `#releaseCountdown` and timer expires, release one resident and reset timer

**Port:**
- Line 58: `this.timer = this.rnd(this.group!.releaseInterval)` sets random interval from [10, 20]
- Line 55: `if (--this.timer > 0) return next()` counts down
- Line 61: When timer expires in "release" mode, calls `releaseOne()` and resets timer (line 64)

### Concurrent Cap (Soft Limit)

**Original:**
- Lines 218–222: `updateAwaitPermission()` polls `reservationsMaster.getPermissionToRelease()` to gate releases when too many residents alive

**Port:**
- Line 20: `private aliveCap = 6` (soft concurrent cap, stand-in for reservationsMaster)
- Line 60: If `this.residents.length >= this.aliveCap`, defer release and reset timer; otherwise proceed

## Conclusion

Both implementations faithfully execute the resident-release FSM: pick a randomized group from `#residentGroups`, produce it over `buildTime * groupSize` frames, then release units one at a time spaced by `releaseInterval`. The dwelling transitions to empty (and self-destructs) once the `#totalResidents` budget is exhausted. Residents spawn with their own team (quadranid = #monsters) and release cadence is staggered. The TypeScript port substitutes a soft `aliveCap` for the original's `reservationsMaster`, which is architecturally sound at slice scale.

**CLEAN**
