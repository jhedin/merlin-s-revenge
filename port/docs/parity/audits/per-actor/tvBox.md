# tvBox Dwelling Parity Audit

## Summary
tvBox (#objDwelling, team #monsters) release behavior is behaviorally correct between the original Lingo and TypeScript port.

## Data Equivalence
- **casts/data/act_tvBox.txt:8-19** vs **port/src/generated/data.json (tvBox entry)**
  - residentGroups: `[{ typ: #evilTv, buildTime: [25,45], groupSize: [2,5], releaseInterval: [10,25] }]` ✓
  - totalResidents: `8` ✓
  - team: `#monsters` ✓
  - energy: `25` ✓
  - dieSound: `"goblin_hut_die_02"` ✓

## Logic Equivalence

### Production & Release Cycle
| Aspect | Lingo (modResidents) | TypeScript (dwelling.ts) | Match |
|--------|----------------------|--------------------------|-------|
| Group selection | startProduction:181 random pick | startProduction:48 random pick | ✓ |
| Group size capped | min(random(groupSize), remaining) line 182 | min(random(groupSize), budget) line 49 | ✓ |
| Production timer | groupLeft × random(buildTime) line 185 | groupLeft × random(buildTime) line 50 | ✓ |
| Release per cycle | One resident per releaseResident() call (line 146) | One resident per releaseOne() call (line 71) | ✓ |
| Release interval | random(releaseInterval) between each (line 174) | random(releaseInterval) between each (line 60,66) | ✓ |
| Concurrent cap | reservationsMaster gate (line 220) | aliveCap soft cap (line 62) | ✓† |
| Budget decrement | CounterOnce(pResidentsRemainingCounter) line 165 | budget-- line 64 | ✓ |
| Self-destruct trigger | noMoreResidents() → startDeath() (objDwelling:106-107) | budget ≤ 0 → takeHit(999999) (line 42-44) | ✓ |

†The reservation gate and occupancy cap implement concurrency control differently but achieve the same spawn rate for tvBox (1 per releaseInterval frame).

### Resident Level-Up
- **Lingo**: modResidents:159-160 `random(getExperienceLevel())`
- **TypeScript**: dwelling.ts:82 `level > 0 ? 1 + floor(draw × level) : 0`
- **For tvBox**: No `#startingLevel` in data → level = 0 → 0 level-ups (identical)

## Result
**CLEAN** — No behavioral divergence detected. tvBox releases 8 evilTv residents in staggered groups, then self-destructs as specified in data.

### Catalogued Non-Issues (Not Flagged)
- dieSound playback timing
- Resident spawn offset (polar angle + radius from dwelling center)
- Resident initial level variance
- Animation frames during production state
- Layer z-ordering
- Jitter in spawn timing
