# Behavioral Audit: act_magicLimit75

**Region marker variant:** #objMagicLimit with magicLimit cap of 75%.

## Summary

Comprehensive audit of **magicLimit75** (act_magicLimit75) for 100% behavioral parity between the original Lingo implementation (casts/) and the TypeScript port (port/src/). Actor casts a REGION marker (#objMagicLimit) in placed actors that caps spell casting to 75% of normal power.

**Result: CLEAN — no divergences found.**

---

## 1. Original Lingo Implementation (casts/)

### Data Definition
**File:** casts/data/act_magicLimit75.txt (lines 1-6)
```lingo
[#name: "act_magicLimit75", #type: #field]
[
#inherit: #magicLimit,
#name: "magicLimit75",
#magicLimit: 75
]
```

- Inherits from base **#magicLimit** actor
- Sets **magicLimit property to 75** (percentage cap)
- Will be instantiated as a placed region marker on tile layers

### Object Script: objMagicLimit
**File:** casts/script_objects/objMagicLimit.txt (lines 1-24)

**Initialization (line 14-17):**
```lingo
on init me,params
  ancestor.init(params)
  g.magicLimitMaster.setMagicLimit(params.magicLimit)
end
```
- On actor spawn: calls `setMagicLimit(params.magicLimit)` → sets to **75**
- Magic limiter now active for all spells in this room

**Cleanup (line 20-24):**
```lingo
on finish me
  g.magicLimitMaster.setMagicLimitToDefault()
  ancestor.finish()
end
```
- On room-leave or actor removal: calls `setMagicLimitToDefault()` → resets to gMagicLimit (100)
- **Room-scoped:** effect is isolated to this room, doesn't leak to next room

### Magic Limit Master (objMagicLimit applies via)
**File:** casts/master_objects/magicLimitMaster.txt (lines 2-26)

```lingo
global gMagicLimit
property pMagicLimit

on setMagicLimit me, newLimit
  pMagicLimit = newLimit
end

on setMagicLimitToDefault me
  me.setMagicLimit(gMagicLimit)
end
```

- **Global gMagicLimit** = 100 (the default, no limiter)
- **Property pMagicLimit** = current active limit (initially gMagicLimit)
- Magic limiter starts at 100, set to 75 on marker init, reset to 100 on finish

### Spell Effect (modAttack)
**File:** casts/script_objects/modAttack.txt (lines 94-100)

```lingo
if pAttack.limitMagic then
  magicLimit = g.magicLimitMaster.getMagicLimit()
  chargeMax = chargeMax * magicLimit / 100
end if
```

- For spells tagged **#limitMagic** (energy blasts, freeze, etc.):
  - Read current magicLimit from master (75 in this marker's room)
  - Scale chargeMax down: `chargeMax *= 75 / 100 = chargeMax * 0.75`
  - Result: spell max power reduced to 75% of base (25% dimmed)

---

## 2. TypeScript Port Implementation (port/src/)

### Data Definition
**File:** port/src/generated/data.json → act_magicLimit75

```json
{
  "header": {
    "name": "act_magicLimit75",
    "type": "#field"
  },
  "data": {
    "inherit": "#magicLimit",
    "name": "magicLimit75",
    "magicLimit": 75
  }
}
```

✅ Identical to original: inherits #magicLimit, magicLimit = 75

### Marker Spawning
**File:** port/src/entities/actorSerial.ts (line 50)

```typescript
if (objType === "#objMagicLimit") return spawnRegionMarker("magicLimit", num(rec, "magicLimit", 100), x, y, name);
```

- On tile spawn: `spawnFromSymbol("#objMagicLimit", ...)` routes to `spawnRegionMarker`
- `num(rec, "magicLimit", 100)` extracts magicLimit value (75) from registry
- Default fallback: 100 if not specified

**Helper function (line 35):**
```typescript
const num = (d: Record<string, any> | undefined, k: string, dflt: number): number => 
  (typeof d?.[k] === "number" ? (d[k] as number) : dflt);
```

✅ Correctly coerces the value 75 from registry as a number

### Region Marker Entity
**File:** port/src/entities/objTypes.ts (lines 59-63)

```typescript
export function spawnRegionMarker(effect: RegionEffect, value: number | string, x: number, y: number, actorName: string): Entity {
  const e = MarkerArchetype.create(makeEntityId());
  e.type = "marker";
  return e.build({ x, y, walkSpeed: 0, box: 4, effect, value, actorType: actorName });
}
```

- Creates an Entity of type "marker"
- Passes `effect: "magicLimit"` and `value: 75` to RegionMarker component

### RegionMarker Component (Initialization)
**File:** port/src/components/regionMarker.ts (lines 19-30)

```typescript
export class RegionMarker extends Component {
  static handles = ["update", "isFinished"];
  private effect: RegionEffect = "magicLimit";
  private value: number | string = 0;
  private applied = false;

  override init(cfg: Record<string, any>): void {
    this.effect = (cfg["effect"] as RegionEffect) ?? "magicLimit";
    this.value = cfg["value"] ?? 0;
    this.applied = false;
    this.apply();
  }
```

- On init: captures effect="magicLimit", value=75
- Immediately calls `this.apply()`

**Apply method (lines 35-50):**
```typescript
private apply(): void {
  if (this.applied) return;
  this.applied = true;
  switch (this.effect) {
    case "magicLimit":
      game.magicLimit.set(Number(this.value));  // set to 75
      break;
    // ...
  }
}
```

✅ On init: calls `game.magicLimit.set(75)` — **magicLimit now 75**

### Magic Limit Master (Storage)
**File:** port/src/systems/magicLimit.ts (lines 1-23)

```typescript
export const MAGIC_LIMIT_DEFAULT = 100;

export class MagicLimitMaster {
  private limit = MAGIC_LIMIT_DEFAULT;       // pMagicLimit (current)
  private def = MAGIC_LIMIT_DEFAULT;         // gMagicLimit (default)

  get(): number { return this.limit; }
  setMagicLimit(n: number): void { this.limit = n; }
  set(n: number): void { this.limit = n; }   // alias
  setDefault(): void { this.limit = this.def; }
}
```

✅ Perfect API match:
- `limit`: holds current limiter (set to 75)
- `def`: holds default (100)
- `get()`: read current (75 in marker room)
- `set(n)`: write current
- `setDefault()`: reset to default (100)

### Spell Effect (Charge Scaling)
**File:** port/src/components/charge.ts (lines 31-32)

```typescript
if (attack.limitMagic) cm = cm * game.magicLimit.get() / 100;
```

✅ Identical to original:
- For spells tagged `limitMagic`
- Scale chargeMax (cm): `cm *= 75 / 100 = cm * 0.75`
- Result: 75% max power (25% reduction)

**Initialization verification (line 66):**
```typescript
game.magicLimit: new MagicLimitMaster()  // in port/src/game/context.ts line 63
```

✅ Initialized to default 100 at game start

---

## 3. Room Scope Verification

### Original: On Room Leave
**File:** casts/script_objects/objMagicLimit.txt (line 20-24)
- `on finish me`: actor removal calls `g.magicLimitMaster.setMagicLimitToDefault()`
- Resets to gMagicLimit (100) when room leaves

### Port: On Room Enter
**File:** port/src/world/rooms.ts (lines 90-94)

```typescript
// room-scoped region effects (I1/I3): reset the magic limiter + team override to their defaults
// BEFORE this room's markers re-apply on spawn (mirrors objMagicLimit/objTeamOverride `on finish`
// restoring the default on room-leave). A dimmed region or a gang-up override can't leak rooms (§g.5).
game.magicLimit.setDefault();
game.teamMaster.teamOverride = null;
```

**Critical order (lines 93, 119):**
1. Line 93: `game.magicLimit.setDefault()` → limiter reset to 100
2. Line 96-100: Load new room
3. Line 119: `this.spawnObjects(...)` → spawn all markers fresh

**Spawn Path (lines 335-336):**
```typescript
const e = spawnFromSymbol(sym, px, py);
if (e) game.entities.push(e);
```

✅ Reset happens BEFORE markers re-spawn:
- Entering magicLimit75 room: limiter 100 → reset to 100 (no-op) → marker sets to 75
- Exiting magicLimit75 room: limiter 75 → reset to 100 (before next room spawns)
- No leakage across rooms (matches original "on finish" semantics exactly)

---

## 4. Behavioral Flow Verification

### Scenario: Enter magicLimit75 Region

**Step 1: Enter Room**
```
game.magicLimit.limit = 100  (previous room or global default)
                    ↓
rooms.enter() called
                    ↓
game.magicLimit.setDefault()  → limit = 100 (reset)
                    ↓
spawnObjects() runs
                    ↓
spawnFromSymbol("#objMagicLimit", x, y) found
                    ↓
spawnRegionMarker("magicLimit", 75, x, y, "magicLimit75") called
                    ↓
MarkerArchetype.create() → RegionMarker component init
                    ↓
RegionMarker.init({effect: "magicLimit", value: 75})
                    ↓
this.apply() → game.magicLimit.set(75)
                    ↓
game.magicLimit.limit = 75
```

**Result:** Spells in room now have max charge × 0.75

### Step 2: Cast limitMagic Spell (e.g., energyBlast)
```
chargeMaxOf(attack, mana) called
                    ↓
cm = base_chargeMax (e.g., 12.5)
                    ↓
attack.limitMagic === true
                    ↓
cm = cm * game.magicLimit.get() / 100
                    ↓
cm = 12.5 * 75 / 100 = 9.375
                    ↓
return 9.375 (spell capped to 9.375 instead of 12.5)
```

**Result:** Spell 25% weaker ✅

### Step 3: Leave Room
```
rooms.enter(newRoomLoc) called
                    ↓
game.magicLimit.setDefault()  → limit = 100
                    ↓
Old magicLimit75 marker entity deleted
(no explicit cleanup needed; reset happens first)
                    ↓
New room objects spawned
                    ↓
No magicLimit marker in new room
                    ↓
game.magicLimit.limit remains 100
```

**Result:** Limiter resets before next room applies any marker ✅

---

## 5. Data Integrity Check

**Registry Lookup (port/src/generated/data.json):**
```
act_magicLimit75 → 
  objType: "#objMagicLimit" ✅
  magicLimit: 75 ✅
```

**Fallback Behavior:**
- `num(rec, "magicLimit", 100)` with default 100
- If magicLimit property missing: uses 100 (safe default, acts as "no limiter")
- magicLimit75 explicitly has value 75 (no fallback needed)

✅ No risk of wrong value or silent errors

---

## Test Case: energyBlast in magicLimit75 Room

**Original Lingo:**
```
structAttack.energyBlast:
  chargeMax = 12.5
  limitMagic = true

In magicLimit75 region:
  magicLimit = 75
  chargeMax = 12.5 * 75 / 100 = 9.375
```

**TypeScript Port:**
```
attack.energyBlast:
  chargeMax = 12.5
  limitMagic = true

In magicLimit75 region:
  game.magicLimit.get() = 75
  cm = 12.5 * 75 / 100 = 9.375
```

✅ **Identical calculation, identical result**

---

## Conclusion

✅ **CLEAN — 100% behavioral parity verified.**

### Evidence Summary

| Aspect | Original | Port | Status |
|--------|----------|------|--------|
| Data value | magicLimit: 75 | magicLimit: 75 | ✅ Match |
| Init behavior | setMagicLimit(75) on init | set(75) on init | ✅ Match |
| Room scope | setMagicLimitToDefault() on finish | setDefault() before spawn | ✅ Match |
| Spell scaling | chargeMax *= 75/100 | cm *= 75/100 | ✅ Match |
| Default | gMagicLimit = 100 | MAGIC_LIMIT_DEFAULT = 100 | ✅ Match |
| API | getMagicLimit(), setMagicLimit() | get(), set() | ✅ Aliased |
| Isolation | Per-room via finish/init | Per-room via reset/spawn | ✅ Match |

### Files Verified
- **casts/data/act_magicLimit75.txt** (line 5: magicLimit value)
- **casts/script_objects/objMagicLimit.txt** (lines 17, 21: init/finish behavior)
- **casts/master_objects/magicLimitMaster.txt** (lines 21, 26: API, default)
- **casts/script_objects/modAttack.txt** (lines 94-98: spell scaling)
- **port/src/generated/data.json** (magicLimit75 entry)
- **port/src/entities/actorSerial.ts** (line 50: spawn routing)
- **port/src/entities/objTypes.ts** (lines 59-63: region marker creation)
- **port/src/components/regionMarker.ts** (lines 26-40: init and apply)
- **port/src/systems/magicLimit.ts** (lines 11-22: API and default)
- **port/src/components/charge.ts** (line 32: spell scaling)
- **port/src/world/rooms.ts** (lines 93, 119: reset-before-spawn order)
- **port/src/game/context.ts** (line 63: global instance)

No divergences. No edge cases. Cosmetic differences (naming, language) do not impact behavior.
