# Parity Audit: magicLimit1 (Region Magic-Limiter Actor)

## Summary
**Status:** CLEAN — No behavioral divergences detected. The magicLimit1 region marker exhibits 100% parity between the original Lingo game and TypeScript port.

---

## Original Implementation (casts/)

### Actor Definition
- **File:** `casts/data/act_magicLimit1.txt:1-6`
  ```
  [#name: "act_magicLimit1", #type: #field]
  [
  #inherit: #magicLimit,
  #name: "magicLimit1",
  #magicLimit: 1
  ]
  ```
  - Inherits from `#magicLimit`
  - Sets `#magicLimit: 1` (1% of normal mana capacity)

### Behavior: On Init (Room Entry)
- **File:** `casts/script_objects/objMagicLimit.txt:14-18`
  ```lingo
  on init me,params
    ancestor.init(params)
    g.magicLimitMaster.setMagicLimit(params.magicLimit)
  end
  ```
  - Calls `g.magicLimitMaster.setMagicLimit(params.magicLimit)` with params.magicLimit = **1**
  - Effect: Cap all limitMagic spells to 1% of their normal max charge

### Effect on Casting
- **File:** `casts/script_objects/modAttack.txt:94-100`
  ```lingo
  if pAttack.limitMagic then
    magicLimit = g.magicLimitMaster.getMagicLimit()
    chargeMax = chargeMax * magicLimit / 100
  end if
  ```
  - When casting a spell with `limitMagic: true`:
    - Line 96: `magicLimit = g.magicLimitMaster.getMagicLimit()` → reads pMagicLimit (**1**)
    - Line 98: `chargeMax = chargeMax * magicLimit / 100` → multiplies chargeMax by **0.01**
  - Result: All limitMagic spells charge to 1% of normal capacity (effectively nearly disabled)

### Room Scope: On Finish (Room Leave)
- **File:** `casts/script_objects/objMagicLimit.txt:20-24`
  ```lingo
  on finish me
    g.magicLimitMaster.setMagicLimitToDefault()
    ancestor.finish()
  end
  ```
  - Calls `g.magicLimitMaster.setMagicLimitToDefault()` on finish
  - **File:** `casts/master_objects/magicLimitMaster.txt:25-27`
    ```lingo
    on setMagicLimitToDefault me
      me.setMagicLimit(gMagicLimit)
    end
    ```
    - Resets pMagicLimit to gMagicLimit (the global default, 100)
  - Result: Effect does NOT leak to next room; restored on room entry

---

## TypeScript Port Implementation (port/src)

### Actor Definition
- **File:** `port/src/generated/data.json` (compiled from casts/data/act_magicLimit1.txt)
  ```json
  "act_magicLimit1": {
    "header": {"name": "act_magicLimit1", "type": "#field"},
    "data": {"inherit": "#magicLimit", "name": "magicLimit1", "magicLimit": 1}
  }
  ```
  - Key-value: `"magicLimit": 1` ✓ MATCHES original (1%)

### Spawn Routing
- **File:** `port/src/entities/actorSerial.ts:50`
  ```typescript
  if (objType === "#objMagicLimit") return spawnRegionMarker("magicLimit", num(rec, "magicLimit", 100), x, y, name);
  ```
  - Extracts `magicLimit` field from actor record via `num(rec, "magicLimit", 100)`
  - Default fallback: 100 (no limit)
  - For magicLimit1: passes value **1** to spawnRegionMarker ✓ MATCHES original

### Effect Applied on Spawn
- **File:** `port/src/components/regionMarker.ts:25-40`
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
  - Line 29: `this.apply()` called on init with value = 1
  - Line 40: `game.magicLimit.set(Number(this.value))` → calls `set(1)`

- **File:** `port/src/systems/magicLimit.ts:18`
  ```typescript
  set(n: number): void { this.limit = n; }  // alias used by objMagicLimit marker
  ```
  - Sets `this.limit = 1` ✓ MATCHES original behavior

### Effect on Casting
- **File:** `port/src/components/charge.ts:26-32`
  ```typescript
  export function chargeMaxOf(attack: AttackData, mana: ManaStats, rng?: Rng, gmgOn = false): number {
    if (gmgOn) return attack.gmgChargeMax;
    let cm = Math.min(attack.chargeMax, mana.capacity * attack.chargeMaxModifier + attack.chargeMaxBasic);
    if (attack.limitMagic) cm = cm * game.magicLimit.get() / 100;
    ...
  }
  ```
  - Line 32: When limitMagic is true, multiplies chargeMax by `game.magicLimit.get()` (returns 1) divided by 100
  - Result: `cm * 1 / 100` → caps to 1% of normal ✓ MATCHES original calculation

### Room Scope: Reset on Room Entry
- **File:** `port/src/world/rooms.ts:90-94`
  ```typescript
  // room-scoped region effects (I1/I3): reset the magic limiter + team override to their defaults
  // BEFORE this room's markers re-apply on spawn (mirrors objMagicLimit/objTeamOverride `on finish`
  // restoring the default on room-leave). A dimmed region or a gang-up override can't leak rooms (§g.5).
  game.magicLimit.setDefault();
  game.teamMaster.teamOverride = null;
  ```
  - Line 93: `game.magicLimit.setDefault()` called BEFORE markers re-spawn on room entry

- **File:** `port/src/systems/magicLimit.ts:19-20`
  ```typescript
  setMagicLimitToDefault(): void { this.limit = this.def; }
  setDefault(): void { this.limit = this.def; }  // room-leave reset
  ```
  - Resets `this.limit = this.def` (MAGIC_LIMIT_DEFAULT = 100, line 9)
  - Result: Effect does NOT leak to next room; restored on room entry ✓ MATCHES original behavior

---

## Verification Checklist

| Aspect | Original | Port | Match | Evidence |
|--------|----------|------|-------|----------|
| **Value set** | 1 (1%) | 1 (1%) | ✓ | casts/data/act_magicLimit1.txt:5 ↔ data.json |
| **Applied on init** | `setMagicLimit(1)` | `set(1)` | ✓ | casts/script_objects/objMagicLimit.txt:17 ↔ regionMarker.ts:40 |
| **Casting effect** | `chargeMax * 1 / 100` | `cm * 1 / 100` | ✓ | casts/script_objects/modAttack.txt:98 ↔ charge.ts:32 |
| **Room-scoped reset** | `on finish` → `setMagicLimitToDefault()` | `setDefault()` on room entry | ✓ | casts/script_objects/objMagicLimit.txt:21 ↔ rooms.ts:93 |
| **No leakage to next room** | Yes (finish handler) | Yes (room entry reset) | ✓ | Mirrored semantics confirmed |

---

## Conclusion

**magicLimit1 exhibits 100% behavioral parity:**
- Correct value (1%) injected from actor record in both implementations
- Identical calculation applied to limitMagic spell charge caps
- Room-scoped behavior prevents effect leakage (original's finish handler mirrored by port's room-entry reset)
- No cosmetic or functional gaps detected
