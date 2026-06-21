# Behavioral Audit: act_magicLimit50

## Audit Summary

Comprehensive parity audit of the **magicLimit50** region effect marker between the original Lingo game (casts/) and the TypeScript port (port/src/). This actor is a placed REGION marker (#objMagicLimit) that caps the player's magic to 50% in the region.

**Status: CLEAN** — No behavioral divergences found.

---

## Part 1: Data Definition & Initialization

### Original Lingo (casts/)

**Data Definition (casts/data/act_magicLimit50.txt:1-6):**
```lingo
[#name: "act_magicLimit50", #type: #field]
[
  #inherit: #magicLimit,
  #name: "magicLimit50",
  #magicLimit: 50
]
```

The actor inherits from the base `#magicLimit` actor (act_magicLimit.txt:3) and sets `magicLimit: 50`.

**Base Definition (casts/data/act_magicLimit.txt:3):**
```lingo
#objType: #objMagicLimit
```

This establishes that both the base and the variant spawn as a region marker of type `#objMagicLimit`.

**Init Handler (casts/script_objects/objMagicLimit.txt:14-18):**
```lingo
on init me, params
  ancestor.init(params)
  
  g.magicLimitMaster.setMagicLimit(params.magicLimit)
end
```

On initialization, the marker extracts `params.magicLimit` (which will be `50` for magicLimit50) and calls `g.magicLimitMaster.setMagicLimit(50)`.

**Cleanup Handler (casts/script_objects/objMagicLimit.txt:20-24):**
```lingo
on finish me
  g.magicLimitMaster.setMagicLimitToDefault()
  
  ancestor.finish()
end
```

On room-leave, the marker resets the limiter to the global default via `setMagicLimitToDefault()`.

### TypeScript Port (port/src/)

**Data Definition (port/src/generated/data.json):**
```json
{
  "name": "act_magicLimit50",
  "type": "#field"
}
{
  "inherit": "#magicLimit",
  "name": "magicLimit50",
  "magicLimit": 50
}
```

Correctly transcribed: variant inherits #magicLimit, sets magicLimit field to 50.

**Spawn Routing (port/src/entities/actorSerial.ts:50):**
```typescript
if (objType === "#objMagicLimit") return spawnRegionMarker("magicLimit", num(rec, "magicLimit", 100), x, y, name);
```

When an actor with `objType: #objMagicLimit` is spawned:
- Effect type: `"magicLimit"`
- Value: `num(rec, "magicLimit", 100)` — extracts the `magicLimit` field with default fallback of 100
- For magicLimit50: value = 50

**Apply on Spawn (port/src/components/regionMarker.ts:25-30, 35-50):**
```typescript
override init(cfg: Record<string, any>): void {
  this.effect = (cfg["effect"] as RegionEffect) ?? "magicLimit";
  this.value = cfg["value"] ?? 0;
  this.applied = false;
  this.apply();
}

private apply(): void {
  if (this.applied) return;
  this.applied = true;
  switch (this.effect) {
    case "magicLimit":
      game.magicLimit.set(Number(this.value));
      break;
    ...
  }
}
```

On component init (which fires on entity spawn):
1. Stores effect = "magicLimit", value = 50
2. Immediately calls `apply()` → `game.magicLimit.set(50)`

This mirrors the original's `on init me, params` → `setMagicLimit(params.magicLimit)`.

**Room-Scoped Reset (port/src/world/rooms.ts:93):**
```typescript
game.magicLimit.setDefault();
game.teamMaster.teamOverride = null;
```

On room entry (before markers are respawned), the RoomManager resets the magic limiter to its default. This mirrors the original's `on finish` → `setMagicLimitToDefault()`.

---

## Part 2: Magic Limiter System

### Original Lingo (casts/master_objects/magicLimitMaster.txt)

**Properties:**
```lingo
property pMagicLimit
global gMagicLimit
```
- `pMagicLimit`: current limit value
- `gMagicLimit`: global default (100, "no limit")

**Key Methods:**
```lingo
on getMagicLimit me
  return pMagicLimit
end

on setMagicLimit me, newLimit
  pMagicLimit = newLimit
end

on setMagicLimitToDefault me
  me.setMagicLimit(gMagicLimit)
end
```

The master holder stores and retrieves the current limiter percentage.

### TypeScript Port (port/src/systems/magicLimit.ts)

```typescript
export const MAGIC_LIMIT_DEFAULT = 100; // gMagicLimit

export class MagicLimitMaster {
  private limit = MAGIC_LIMIT_DEFAULT;       // pMagicLimit
  private def = MAGIC_LIMIT_DEFAULT;         // gMagicLimit

  get(): number { return this.limit; }
  set(n: number): void { this.limit = n; }
  setDefault(): void { this.limit = this.def; }
  getMagicLimit(): number { return this.limit; }
  setMagicLimit(n: number): void { this.limit = n; }
  setMagicLimitToDefault(): void { this.limit = this.def; }
}
```

Perfect structural match:
- `limit` ↔ `pMagicLimit`
- `def` ↔ `gMagicLimit`
- `get()` / `getMagicLimit()` return the current limit
- `set(n)` / `setMagicLimit(n)` set the current limit
- `setDefault()` / `setMagicLimitToDefault()` restore to default
- Default initialized to 100

---

## Part 3: Spell Charge Scaling (Effect Application)

This is where the magicLimit value actually affects gameplay: spells with `limitMagic` flag have their charge ceiling scaled down in regions with a lower limiter.

### Original Lingo (casts/script_objects/modAttack.txt:90-103)

```lingo
chargeMax = min(pChargeMax, characterMax)

-- magic limiter
if pAttack.limitMagic then
  magicLimit = g.magicLimitMaster.getMagicLimit()
  chargeMax = chargeMax * magicLimit / 100
end if
```

For a spell with `limitMagic: true`:
- Base chargeMax is calculated from attack data and mana stats
- If in a magicLimit50 region: `chargeMax = chargeMax * 50 / 100` (50% of base)
- Effect: the spell can only charge to half its normal maximum, effectively disabling 50% of its power

### TypeScript Port (port/src/components/charge.ts:26-32)

```typescript
export function chargeMaxOf(attack: AttackData, mana: ManaStats, rng?: Rng, gmgOn = false): number {
  if (gmgOn) return attack.gmgChargeMax;
  let cm = Math.min(attack.chargeMax, mana.capacity * attack.chargeMaxModifier + attack.chargeMaxBasic);
  
  // calcAttackChargeMax: a #limitMagic spell's ceiling is scaled by the live magic limiter (room-scoped).
  if (attack.limitMagic) cm = cm * game.magicLimit.get() / 100;
  // ...
}
```

Identical logic:
- Base charge max calculated
- If `limitMagic` flag: scale by `game.magicLimit.get() / 100`
- In magicLimit50 region: scaling factor = 50/100 = 0.5, result is 50% of base

### Game Context Initialization (port/src/game/context.ts:63)

Magic limiter is globally initialized as:
```typescript
magicLimit: new MagicLimitMaster(),
```

Default state: `limit = 100` (no reduction).

---

## Part 4: Room-Scoped Behavior

Both implementations ensure the magic limiter effect is **room-scoped** — it resets when the player leaves the region or enters a new room.

### Original Lingo

1. Room entry: Player unloads old room, loads new room
2. Old room's actors finish: `objMagicLimit.finish()` calls `setMagicLimitToDefault()`
3. New room's actors init: Any magicLimit markers call `setMagicLimit(N)` on spawn
4. Result: Clean transition, no bleed across rooms

### TypeScript Port

1. Room entry (port/src/world/rooms.ts:93):
   ```typescript
   game.magicLimit.setDefault();  // Reset to 100 first
   ```
2. Spawn markers: RegionMarker components call `game.magicLimit.set(50)` on init
3. Result: Same isolation; default reset BEFORE re-apply prevents cross-room leaks

**Plan Reference:** The port's regionMarker.ts (lines 8-12) explicitly documents this:
```typescript
// magicLimit / teamOverride effects are ROOM-SCOPED (the original's `on finish` restores the
// default on room-leave): the RoomManager resets game.magicLimit + teamMaster.teamOverride to their
// defaults at the start of each room entry, BEFORE this room's markers re-apply on spawn — so a dimmed
// region or a gang-up override can't leak into the next room (plan §g.5).
```

---

## Part 5: Verification Test Flow

**Scenario:** Player with energy blast spell (limitMagic: true) enters a room with magicLimit50.

### Original Lingo
1. Room loads, objMagicLimit50 spawns
2. `objMagicLimit.init(params)` → `g.magicLimitMaster.setMagicLimit(50)` → pMagicLimit = 50
3. Player casts energy blast
4. modAttack calculates: `chargeMax = chargeMax * 50 / 100` (50% of normal max)
5. Player leaves room
6. `objMagicLimit.finish()` → `setMagicLimitToDefault()` → pMagicLimit = 100 (restored)

### TypeScript Port
1. Room loads, magicLimit50 marker spawns
2. `RoomManager` resets: `game.magicLimit.setDefault()` → limit = 100
3. `RegionMarker.init()` → `apply()` → `game.magicLimit.set(50)` → limit = 50
4. Player casts energy blast
5. `chargeMaxOf()` calculates: `cm = cm * 50 / 100` (50% of normal max)
6. Player leaves room
7. `RoomManager` on next room entry: `game.magicLimit.setDefault()` → limit = 100 (restored)

**Result:** Identical behavior. The 50% cap is applied and removed correctly in both implementations.

---

## Part 6: Data Value Verification

All four variants (1, 25, 50, 75) are correctly transcribed and routed:

| Variant | Original Value | Port Value | Effect |
|---------|---|---|---|
| magicLimit1 | 1 | 1 | 1% charge max (near-total disable) |
| magicLimit25 | 25 | 25 | 25% charge max (75% reduction) |
| **magicLimit50** | **50** | **50** | **50% charge max (50% reduction)** |
| magicLimit75 | 75 | 75 | 75% charge max (25% reduction) |

All scale linearly: `chargeMax * value / 100`.

---

## Conclusion

✅ **CLEAN** — No behavioral divergences found.

**All aspects verified:**

| Aspect | Original | Port | Match |
|--------|----------|------|-------|
| Data structure (magicLimit: 50) | act_magicLimit50.txt:5 | data.json | ✅ |
| Spawn value extraction | objMagicLimit.txt:17 | actorSerial.ts:50 | ✅ |
| Apply effect on init | objMagicLimit.txt:17 → setMagicLimit | regionMarker.ts:40 → game.magicLimit.set | ✅ |
| Spell scaling by limitMagic | modAttack.txt:94-98 | charge.ts:31-32 | ✅ |
| Default limiter value | 100 (gMagicLimit) | 100 (MAGIC_LIMIT_DEFAULT) | ✅ |
| Room-scoped reset | objMagicLimit.finish | rooms.ts:93 setDefault | ✅ |
| No cross-room bleed | reset before room load | reset before marker re-apply | ✅ |

The magicLimit50 actor correctly caps magic spells to 50% effectiveness in the region, with proper room isolation on both sides.
