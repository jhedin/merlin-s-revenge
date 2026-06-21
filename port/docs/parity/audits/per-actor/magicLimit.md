# ACTOR: magicLimit

## Audit Summary

Behavioral parity audit of the **magicLimit** region marker (#objMagicLimit) between the original Lingo codebase (casts/) and the TypeScript port (port/src/).

## Data Definitions

**Original Lingo (casts/data/):**
- `act_magicLimit.txt`: Base region marker (objType: #objMagicLimit, no magicLimit value)
- `act_magicLimit1/25/50/75.txt`: Variants inheriting from #magicLimit with fixed values (1, 25, 50, 75)

**TS Port (port/src/generated/data.json):**
- `act_magicLimit`: objType: #objMagicLimit, no magicLimit field
- `act_magicLimit1/25/50/75`: objType: #objMagicLimit, magicLimit: 1/25/50/75

All variants correctly transcribed.

## Initialization & Room Scope

**Original (casts/script_objects/objMagicLimit.txt):**
- `on init me, params`: calls `g.magicLimitMaster.setMagicLimit(params.magicLimit)`
- `on finish me`: calls `g.magicLimitMaster.setMagicLimitToDefault()` (resets to global default gMagicLimit=100)

**TS Port (port/src/entities/objTypes.ts line 4, port/src/entities/actorSerial.ts line 50):**
- `spawnRegionMarker("magicLimit", num(rec, "magicLimit", 100), x, y, name)` — extracts magicLimit value with default 100
- `RegionMarker.apply()` (port/src/components/regionMarker.ts line 40) calls `game.magicLimit.set(Number(this.value))`
- Room-leave reset (port/src/world/rooms.ts line 93): `game.magicLimit.setDefault()` before markers re-apply

Both match: marker sets limit on spawn, resets to default on room-leave. Room-scoped correctly.

## Magic Limiter Implementation

**Original (casts/master_objects/magicLimitMaster.txt):**
- `pMagicLimit`: property storing the current limit
- `getMagicLimit()`: returns pMagicLimit
- `setMagicLimit(n)`: sets pMagicLimit = n
- `setMagicLimitToDefault()`: restores to global default (gMagicLimit = 100)

**TS Port (port/src/systems/magicLimit.ts):**
- `MagicLimitMaster` class with `limit` (current), `def` (default)
- `get()` / `getMagicLimit()`: return this.limit
- `set(n)` / `setMagicLimit(n)`: set this.limit = n
- `setDefault()` / `setMagicLimitToDefault()`: this.limit = this.def
- Default initialized to 100 (MAGIC_LIMIT_DEFAULT)

Perfect match of API and semantics.

## Spell Charge Scaling

**Original (casts/script_objects/modAttack.txt lines 94-98):**
```lingo
if pAttack.limitMagic then
  magicLimit = g.magicLimitMaster.getMagicLimit()
  chargeMax = chargeMax * magicLimit / 100
end if
```

**TS Port (port/src/components/charge.ts lines 31-32):**
```typescript
if (attack.limitMagic) cm = cm * game.magicLimit.get() / 100;
```

Both scale the charge maximum (chargeMax / cm) by the live limiter percentage. A limitMagic spell in a magicLimit25 region will have its charge ceiling multiplied by 0.25, effectively disabling 75% of the spell's power.

Verified: `game.magicLimit` is initialized to `new MagicLimitMaster()` (port/src/game/context.ts line 63), default = 100.

## Variants: 1/25/50/75

All four variants correctly route through `spawnRegionMarker` with their respective values (verified in data.json):
- act_magicLimit1 → set to 1 (near-total disable)
- act_magicLimit25 → set to 25 (75% reduction)
- act_magicLimit50 → set to 50 (50% reduction)
- act_magicLimit75 → set to 75 (25% reduction)

Scaling is linear: `chargeMax * value / 100`, so 75 = full power, 1 = 1% power, as intended.

## Test Case: Flow

1. Game start: game.magicLimit.limit = 100 (no limit)
2. Enter room with magicLimit25 marker:
   - RoomManager resets to default (100)
   - RegionMarker applies: game.magicLimit.set(25)
3. Cast energyBlast (limitMagic spell):
   - chargeMaxOf scales by 25/100, so max charge = base * 0.25
4. Leave room:
   - RoomManager resets: game.magicLimit.setDefault() → limit = 100
5. Re-enter different room without marker:
   - Default reset re-applied
   - No marker applies, remains 100
   - No limiter bleed across rooms

All transitions correct.

## Conclusion

✅ **CLEAN** — no behavioral divergences found.

All aspects match:
- Data structures transcribed correctly (variants 1/25/50/75, base fallback 100)
- Initialization & cleanup mirror original (set on spawn, reset on room-leave)
- Spell scaling logic identical (cm *= limiter / 100)
- Room-scoped isolation verified (reset before marker re-apply prevents leak)
- API compatibility confirmed (getMagicLimit, setMagicLimit, setDefault aliases)
