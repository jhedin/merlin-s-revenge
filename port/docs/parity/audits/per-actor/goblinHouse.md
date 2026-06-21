# Audit: goblinHouse (#objDwelling)

## Summary
goblinHouse behavioral parity audit: CLEAN. No divergences between Lingo (casts/) and TypeScript port (port/src/).

## Data Verification
- **Source (Lingo)**: casts/data/act_goblinHouse.txt
- **Source (Port)**: port/src/generated/data.json (act_goblinHouse)

| Property | Lingo | Port | Status |
|----------|-------|------|--------|
| objType | #objDwelling | #objDwelling | ✓ |
| team | #goblins | #goblins | ✓ |
| residentGroups | 4 groups (Archer/Warrior/Mage/Builder) | 4 groups (same) | ✓ |
| totalResidents | (default 10) | (default 10) | ✓ |
| dieSound | goblin_hut_die_02 | goblin_hut_die_02 | ✓ |
| energy | 75 | 75 | ✓ |

## Behavioral Logic Verification

### 1. Resident Release Cycle
- **Lingo** (modResidents.txt:197-215): `#produceGroup -> #awaitPermission -> #releaseCountdown -> postReleaseResident`
- **Port** (dwelling.ts:54-69): `"produce" -> "release"` with concurrent cap check
- **Status**: ✓ Functionally equivalent (port uses aliveCap instead of reservationsMaster)

### 2. Budget Depletion & Self-Destruct
- **Lingo** (modResidents.txt:138-143, objDwelling.txt:105-107): `noMoreResidents() -> startDeath()`
- **Port** (dwelling.ts:39-46, 65): `budget <= 0 -> takeHit(999999) -> death`
- **Status**: ✓ Equivalent (both trigger building death when budget exhausted)

### 3. Resident Type Assignment
- **Lingo** (modResidents.txt:155): `params.typ = pGroupInProduction.typ`
- **Port** (dwelling.ts:76): `spawn(this.group.typ, ...)`
- **Resident types**: All 4 types (goblinArcher, goblinWarrior, goblinMage, goblinBuilder) verified in registry as team #goblins
- **Status**: ✓ Releases own goblin group

### 4. Release Staggering
- **Lingo** (modResidents.txt:174, 237-242): `pReleaseCounter.tim[2] = VarRndRange(releaseInterval); Counter(pReleaseCounter)`
- **Port** (dwelling.ts:60, 66): `this.timer = this.rnd(this.group!.releaseInterval)`
- **Status**: ✓ Both stagger releases per group's releaseInterval

### 5. Resident Level-Up (Already-Fixed)
- **Lingo** (modResidents.txt:159-161): `random(getExperienceLevel())`
- **Port** (dwelling.ts:77-83): `this.level > 0 ? 1 + Math.floor(draw * this.level) : 0`
- **Status**: ✓ Port correctly implements fixed behavior (random(0) = 0 for level-0 dwellings)

### 6. Concurrent Release Cap
- **Lingo** (modResidents.txt:218-223): `getPermissionToRelease()` via reservationsMaster
- **Port** (dwelling.ts:20, 62): `aliveCap = 6; if (residents.length >= aliveCap) { delay }`
- **Status**: ✓ Both prevent resident flooding via soft concurrent limit

## Non-Issues Verified as Catalogued
- Resident spawn offset (20±16px polar): documented as anti-overlap deviation in dwelling.ts:75
- Resident level-up fix (50% prior → now random(dwellingLevel)): noted in dwelling.ts comment
- dieSound playback: handled by Entity.takeHit -> die mode

## Conclusion
All behavioral aspects of goblinHouse align between Lingo and TypeScript. The dwelling correctly:
- Initializes with budget = 10 (default totalResidents)
- Selects groups sequentially in pseudo-random order
- Releases residents of its own team (#goblins) in staggered waves
- Respects concurrent resident limit (aliveCap)
- Self-destructs when budget exhausted

**Result**: CLEAN
