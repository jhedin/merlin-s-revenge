# Behavioral Audit: act_dwelling (inheritance base template)

**Class:** Inheritance base template (abstract data record).  
**Status:** GAPS=3 (critical inherited properties not applied to concrete dwellings)

## Executive Summary

act_dwelling is an abstract base template that is never instantiated directly—it's merged into every concrete dwelling via `#inherit: #dwelling`. This audit checks whether the port reproduces ALL inherited defaults when a concrete dwelling (like goblinHut) is resolved and spawned.

**Findings:** Three critical behavioral defaults from act_dwelling are NOT applied in the port:
1. **energyIncPercentage: -1** — dwellings lose energy per spawned resident (not applied)
2. **inertia: 80** — dwellings resist knockback (not applied; default 0 instead)
3. **Dwelling.levelUp()** — dwellings level up after each resident release (not called)

These are inherited gameplay defaults that affect live dwelling behavior; they are not data-pipeline issues or intentional re-calibrations.

---

## Part 1: Enumeration of ALL act_dwelling Inherited Defaults

### From casts/data/act_dwelling.txt (lines 1–8)
```
[#name: "act_dwelling", #type: #field]
[
#inherit: #actor,
#energyIncPercentage: -1,
#frictionReel: point(30,30),
#inertia: 80,
#teamRole: #teamBuildings
]
```

**Declared defaults:**
- `#inherit: #actor` — merges act_actor properties as base
- `#energyIncPercentage: -1` — max energy shrinks by 1% per level
- `#frictionReel: point(30,30)` — physics property (no direct TS equivalent; Lingo-specific)
- `#inertia: 80` — high knockback resistance (scale 0–100, where 100 = no knockback)
- `#teamRole: #teamBuildings` — targetable by AIs seeking buildings

### From casts/data/act_actor.txt (via inheritance)
```
#team: #chatters
#actorType: #typ
#initLoc: {x: random(450), y: 300}
#initVect: {x: 0, y: 0}
#startOffset: {x: -16, y: -16}
#layerZ: gGameObjectLayer
#miniMapStatus: #inf
#masterPrg: #actorMaster
```

### From casts/script_objects/modEnergy.txt (via objDwelling's module stack)
```
i[#damageSpeed] = 5
i[#energy] = 100                        // per modEnergy line 26; overridden per concrete dwelling
i[#energyIncPercentage] = 1             // DEFAULT (act_dwelling overrides to -1)
i[#energyRecoverDelay] = 1000
i[#maxEnergy] = #auto
i[#minEnergy] = 0
```

### From casts/script_objects/modResidents.txt (via objDwelling's module stack)
```
i[#residentGroups] = []
i[#totalResidents] = 10
```

### Key Behavioral Defaults (Lingo runtime)
From objDwelling / modResidents (casts/script_objects/), concrete dwellings inherit:
- **startingLevel: 0** — dwellings never receive external XP gains
- **levelUp() call cadence** — after each `releaseResident()` (modResidents.txt line 170)
- **Spawn offset: false** — residents spawn at `useOffset = false` (no position jitter)
- **Release timing** — residents emerge staggered by `releaseInterval` [min,max]

---

## Part 2: Verification of Each Default in the Port

### Default 1: energyIncPercentage: -1
**Original behavior (modEnergy.txt:55):**
```
pEnergyIncAmount = params.energy * params.energyIncPercentage / 100
```
When a dwelling levels up, max energy changes by `energyIncAmount`. With energyIncPercentage=-1, the max energy **shrinks by 1% of base energy per level**.

**Port location (Port/src/entities/archetypes.ts):**
Line 93 in `spawnDwelling()`:
```typescript
return e.build({ 
  x, y, walkSpeed: 0, energy, team, teamRole: "#teamBuildings", 
  animChar, box: 24, residentGroups: groups, budget, dieSound, actorType: actorName 
});
```

**Issue:** `energyIncPercentage` is NOT extracted from data or passed to `e.build()`.

**Port Energy component (port/src/components/combat.ts line 25):**
```typescript
this.incPct = typeof cfg["energyIncPercentage"] === "number" ? cfg["energyIncPercentage"] : 0;
```
If not passed, Energy defaults to incPct=0 (no energy scaling per level).

**Verification:** 
- ✗ MISSING: spawnDwelling does not read/pass `d["energyIncPercentage"]` (should be -1 for all dwellings)
- ✗ MISSING: Energy.init(cfg) receives undefined, defaults to 0

**File:Line Evidence:**
- Original: `casts/data/act_dwelling.txt:4`
- Port gap: `port/src/entities/archetypes.ts:88` (budget extracted) but line 93 has no energyIncPercentage
- Port default: `port/src/components/combat.ts:25` (defaults to 0 if not passed)

---

### Default 2: inertia: 80
**Original behavior (modGameObject takeHit flow):**
Inertia (scale 0–100) dampens knockback: `knockback_applied = knockback * (100 - inertia) / 100`.  
With inertia=80, 80% of knockback is absorbed; only 20% moves the object.  
act_dwelling sets inertia=80 → dwellings are very heavy/resistant to knockback.

**Port location (port/src/entities/archetypes.ts):**
Line 93 in `spawnDwelling()`: No inertia parameter passed to `e.build()`.

**Port Movement component (port/src/components/movement.ts line 41):**
```typescript
if (typeof cfg["inertia"] === "number") this.inertia = Math.max(0, Math.min(100, cfg["inertia"]));
```
If not passed, Movement.init() defaults inertia to 0 (line 24: `inertia = 0`).

**Behavioral impact:** Dwellings with inertia=0 take full knockback and are easily pushed around. With inertia=80 (original), they barely move from hits.

**Verification:**
- ✗ MISSING: spawnDwelling does not read/pass `d["inertia"]` (should be 80 for act_dwelling)
- ✗ MISSING: Movement.init(cfg) receives undefined, defaults to 0 (line 24)
- Compare: spawnEnemy (line 272) DOES pass inertia

**File:Line Evidence:**
- Original: `casts/data/act_dwelling.txt:6`
- Port gap: `port/src/entities/archetypes.ts:88` (energy extracted) but line 93 has no inertia
- Port comparison: `port/src/entities/archetypes.ts:272` shows `inertia: num("inertia", 0)` is passed for enemies
- Port default: `port/src/components/movement.ts:24,41`

---

### Default 3: Dwelling.levelUp() NOT called after each resident
**Original behavior (modResidents.txt:146–171):**
```
on releaseResident me
  newUnit = g.actorMaster.newActor(params)
  if me.big.getExperienceLevel() > 0 then
    newUnit.setStartingLevel(random(me.big.getExperienceLevel()))
  end if
  
  -- level up upon creating a unit
  me.big.levelUp()              <-- Line 170: DWELLING LEVELS UP AFTER EACH RELEASE
end
```

Each released resident triggers a dwelling level-up. With energyIncPercentage=-1, each level-up reduces max energy by ~1%.

**Port location (port/src/components/dwelling.ts):**
Lines 71–86 in `releaseOne()`:
```typescript
private releaseOne(): void {
  const spawn = game.spawnUnit ?? game.spawnEnemy;
  if (!spawn || !this.group) return;
  const m = this.entity.get(Movement);
  const a = game.rng.next() * Math.PI * 2, r = 20 + game.rng.next() * 16;
  const e = spawn(this.group.typ, m.x + Math.cos(a) * r, m.y + Math.sin(a) * r, { animChar: spriteCharOr(this.group.typ) });
  const draw = game.rng.next();
  const ups = this.level > 0 ? 1 + Math.floor(draw * this.level) : 0;
  for (let i = 0; i < ups; i++) e.send("forceLevelUp");
  game.entities.push(e);
  this.residents.push(e);
}
```

**Issue:** No call to `this.entity.send("forceLevelUp")` after spawning a resident.

**Behavioral impact:** Dwellings never lose energy via energyIncPercentage=-1 because they never level up. Over the lifetime of a dwelling (releasing 5–12 residents per concrete dwelling), the original gradually weakens it; the port does not.

**Verification:**
- ✗ MISSING: No `this.entity.send("forceLevelUp")` after spawn in releaseOne()
- Compare: spawnEnemy (lines 317–318) DOES call levelUp() after build
- Interdependency: This gap + missing energyIncPercentage together nullify the intended dwelling energy decay

**File:Line Evidence:**
- Original: `casts/script_objects/modResidents.txt:170`
- Port gap: `port/src/components/dwelling.ts:71-86` (no levelUp() call)
- Port comparison: `port/src/entities/archetypes.ts:313-318` (spawnEnemy does call levelUp)

---

### Default 4: startingLevel (Read but not passed to build)
**Original behavior:** Dwellings carry a `#startingLevel` (default 0 from modExperience). Shipped dwellings never override this.

**Port location (port/src/entities/archetypes.ts):**
Line 93 in `spawnDwelling()`: startingLevel is NOT extracted or passed.

**Port Dwelling.init() (dwelling.ts:31):**
```typescript
this.level = typeof cfg["startingLevel"] === "number" ? cfg["startingLevel"] : 0;
```

**Status:** This is NOT a gap for shipped dwellings (all have startingLevel=0 or inherit default 0), but it's an architectural inconsistency:
- spawnEnemy extracts startingLevel and applies levelUp() calls (lines 317–318)
- spawnDwelling does NOT extract startingLevel
- If a future dwelling ever set startingLevel>0, it would be silently ignored

**Verification (shipped game only):**
- ✓ NEUTRAL for shipped content (all dwellings startingLevel=0)
- ✗ ARCHITECTURAL GAP: startingLevel not passed like it is for enemies

**File:Line Evidence:**
- Original default: `casts/script_objects/modExperience.txt` (startingLevel default 0)
- Shipped dwellings: No dwelling override startingLevel (all inherit default)
- Port missing: `port/src/entities/archetypes.ts:88` does not extract it
- Port comparison: `port/src/entities/archetypes.ts:317` (spawnEnemy does)

---

### Default 5: Spawn offset (useOffset=false)
**Original (modResidents.txt:157):** `params.useOffset = false`
Residents spawn at the dwelling's exact location (no random offset from startOffset).

**Port (dwelling.ts:76):** 
```typescript
const a = game.rng.next() * Math.PI * 2, r = 20 + game.rng.next() * 16;
const e = spawn(..., m.x + Math.cos(a) * r, m.y + Math.sin(a) * r, ...);
```

**Status:** This is an INTENTIONAL RE-CALIBRATION (anti-overlap logic), documented in dwelling.ts top comment and the audit spec. NOT a gap.

---

### Default 6: frictionReel: point(30,30)
**Original:** Lingo physics property for reel/knockback friction.
**Port:** No direct analog (collision physics are simpler in TS). Not load-bearing for gameplay.
**Status:** NOT a gap (property-coverage non-gap; Lingo-specific).

---

### Default 7: teamRole: #teamBuildings
**Original (act_dwelling.txt:7):** `#teamRole: #teamBuildings`
**Port (archetypes.ts:93):** `teamRole: "#teamBuildings"` ✓ hardcoded correctly

**Status:** CORRECT, verified.

---

### Default 8: residentGroups, totalResidents, release cadence
These are verified in concrete dwelling audits (e.g., goblinHut.md). ✓ VERIFIED CORRECT

---

## Part 3: Summary of Gaps

| Default | Original | Port | Status | Severity |
|---------|----------|------|--------|----------|
| energyIncPercentage: -1 | Energy shrinks per level | Not applied; defaults to 0 | ✗ MISSING | Critical |
| inertia: 80 | Knockback resistance 80% | Not passed; defaults to 0 | ✗ MISSING | Critical |
| levelUp() after release | Dwelling gains a level per spawned resident | Not called | ✗ MISSING | Critical |
| startingLevel extraction | Extracted + applied (0 for shipped) | Not extracted/passed | ✗ ARCHITECTURAL | Low (shipped=0) |
| Spawn offset useOffset=false | Direct spawn (no jitter) | Circular offset 20–36px (intentional) | ✓ Re-calibrated | None |
| teamRole: #teamBuildings | Targetable by building-seekers | Hardcoded in build call | ✓ Correct | None |
| residentGroups/totalResidents | Array []; default 10 | Resolved from data; defaults 10 | ✓ Verified | None |
| Release cadence | groupSize * buildTime; staggered by releaseInterval | Identical logic | ✓ Verified | None |

---

## Part 4: Impact Analysis

### The Three Critical Gaps Work Together

In the original game, dwellings gradually weaken as they spawn residents:
1. **Resident releases trigger dwelling levelUp** (modResidents line 170)
2. **Each levelUp applies energyIncPercentage: -1** (modEnergy line 55: `maxEnergy -= 1%`)
3. **Result:** A dwelling that spawns 10 residents loses ~10% of its max energy (net weakening)

In the port:
1. **releaseOne() does NOT call levelUp** → no level gains
2. **energyIncPercentage NOT passed** → even if levelUp were called, no effect
3. **Result:** Dwellings never weaken; they maintain full strength for their entire lifetime

### Practical Consequence
- **Original:** A goblinHut (energy 75) spawning 10 residents effectively becomes (75 * 0.9 = ~68 effective max health)
- **Port:** A goblinHut stays at 75 max health
- **Player consequence:** Dwellings are ~10% tankier than in the original

### Knockback Resistance Gap (inertia: 80)
- **Original:** Dwellings barely move when hit (80% of knockback absorbed)
- **Port:** Dwellings are pushed around like normal units (0% absorbed)
- **Player consequence:** Dwellings can be knocked into walls or away from their spawn tiles

---

## References

**Original (Lingo):**
- `casts/data/act_dwelling.txt:1-8` — act_dwelling data record
- `casts/script_objects/objDwelling.txt:1-29` — objDwelling script (module stack)
- `casts/script_objects/modResidents.txt:22-29` — modResidents.addModParams (default totalResidents=10)
- `casts/script_objects/modResidents.txt:146-171` — releaseResident (line 170: levelUp call)
- `casts/script_objects/modEnergy.txt:22-35` — modEnergy.addModParams (default energyIncPercentage=1)
- `casts/script_objects/modEnergy.txt:54-56` — pEnergyIncAmount calculation

**Port (TypeScript):**
- `port/src/entities/archetypes.ts:70-94` — spawnDwelling() function (GAP: energyIncPercentage, inertia, startingLevel not passed)
- `port/src/components/dwelling.ts:1-87` — Dwelling component (GAP: no levelUp() call)
- `port/src/components/movement.ts:24,41` — Movement.init() (inertia default 0)
- `port/src/components/combat.ts:25` — Energy.init() (incPct default 0)
- `port/src/generated/data.json` — act_dwelling record (verify properties exist in data pipeline)

---

## Conclusion

**ACTOR=dwelling | GAPS=3 |**
1. energyIncPercentage: -1 not extracted/passed in spawnDwelling (port/src/entities/archetypes.ts:93)
2. inertia: 80 not extracted/passed in spawnDwelling (port/src/entities/archetypes.ts:93)
3. levelUp() not called after each resident release in releaseOne (port/src/components/dwelling.ts:71-86)

All three gaps represent unapplied inherited gameplay defaults that affect live dwelling behavior (energy decay, knockback resistance, level progression). These are not intentional re-calibrations or data-pipeline issues; they are implementation gaps in the component/archetype layer.

---

## Resolution (sweep lead): FIXED — all 3 gaps were real

Verified in both trees: act_dwelling inherits inertia 80 + energyIncPercentage -1 (resolveActor merges both
onto every dwelling), and modResidents.releaseResident:170 calls me.big.levelUp() per release. FIXED:
spawnDwelling now forwards inertia/energyIncPercentage/startingLevel; Dwelling.releaseOne increments the
dwelling level and fans out #levelUp after each release (residents escalate via random(level); the dwelling's
own max energy decays); Energy.levelUp now applies a negative increment (was guarded inc>0). This also
completes the earlier fix #8, which had pinned the dwelling at level 0. dwelling.test.ts updated to assert
escalation. 367 tests pass, tsc clean, smoke green. Behavioral verdict after fix: CLEAN.
