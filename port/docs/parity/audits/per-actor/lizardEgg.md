# Parity Audit: lizardEgg

**Actor:** lizardEgg (#inherit #bullet)  
**Role:** Projectile thrown by lizardSoldier. Hatches into a #bug on death via #reincarnateAs.

---

## Property Enumeration & Verification

| Property | Original (Lingo) | Port (TS) | Type | Status | Evidence |
|----------|------------------|-----------|------|--------|----------|
| **#inherit** | `#bullet` | `#bullet` | Reference | ✓ Faithful | act_lizardEgg.txt:3 → data.json `.inherit` |
| **#attack.type** | `#bullet` | `#bullet` | String | ✓ Faithful | act_lizardEgg.txt:8 → data.json `.attack.type` |
| **#attack.power** | `0.5` | `0.5` | Number | ✓ Faithful | act_lizardEgg.txt:7 → data.json `.attack.power` |
| **#attack.damageMultiplier** | `5` | `5` | Number | ✓ Faithful | act_lizardEgg.txt:6 → data.json `.attack.damageMultiplier` |
| **#attack.hits** | Inherited from #bullet: `[#teamMembers]` | Inherited via act_bullet | Array | ✓ Faithful | act_bullet.txt:7 (not overridden in lizardEgg) |
| **#friction** | `point(2,2)` | `{"x": 2, "y": 2}` | Point | ✓ Faithful | act_lizardEgg.txt:12 → data.json `.friction` |
| **#weight** | `1` | `1` | Number | ✓ Faithful | act_lizardEgg.txt:16 → data.json `.weight` |
| **#recordInRoomState** | `false` | `false` | Boolean | ✓ Faithful | act_lizardEgg.txt:13 → data.json `.recordInRoomState` |
| **#rotational** | `true` | `true` | Boolean | ✓ Faithful | act_lizardEgg.txt:15 → data.json `.rotational` |
| **#reincarnateAs** | `[#bug, #bug, #bug]` | `["#bug", "#bug", "#bug"]` | Array | ✓ Faithful | act_lizardEgg.txt:14 → data.json `.reincarnateAs` |
| **#character** | `#bullet` | `#bullet` | String | ✓ Faithful | act_lizardEgg.txt:10 → data.json `.character` |
| **#name** | `"lizardEgg"` | `"lizardEgg"` | String | ✓ Faithful | act_lizardEgg.txt:11 → data.json `.name` |

---

## Reincarnate Logic Verification

### Original (Lingo)

**Data flow:** `act_lizardEgg.txt` line 14 sets `#reincarnateAs: [#bug, #bug, #bug]` (inherited by bullets via modReincarnate).

**Trigger:** When the bullet dies:
1. `objBullet.txt` line 282: `me.setDead(true)` then `me.big.reincarnate()` 
2. `modReincarnate.txt` lines 42–44: Fires on `#leftTeam` event when `getKilledInAction()` is true
3. `modReincarnate.txt` lines 49–71: Loops through `pReincarnateAs`, spawning each non-`#none` entry at the death location via `g.actorMaster.newActor()`

**Result:** Three `#bug` actors spawn at the egg's death location.

---

### Port (TypeScript)

**Data thread:**
1. `port/src/entities/archetypes.ts` lines 246–254: 
   - Resolves the bullet actor (e.g., `lizardEgg`) from the attacker's `#attack.bullet` symbol
   - Extracts `bulletReincarnate = parseReincarnateList(bulletActor?.["reincarnateAs"])` 
   - Parses `[#bug, #bug, #bug]` → `["bug", "bug", "bug"]` via `parseReincarnate()` (stripping `#` prefix)

2. `port/src/components/control.ts` line 559 & 618: 
   - Assigns `bulletReincarnate` to the fired bullet's `Projectile.reincarnateAs` field

3. **Hatching on death:**
   - `port/src/components/projectile.ts` lines 76–87 (`finish()` method):
     - Called when bullet dies (collision, maxLife expiry)
     - Loops through `this.reincarnateAs`, skips `#none` entries
     - Calls `spawnFromSymbol(typ, x, y)` for each non-none entry
     - Each spawn resolves via `spawnFromSymbol()` → `spawnUnit("bug", ...)` → creates an Entity
   - Spawned entities pushed to `game.entities` (line 85)

4. **spawnFromSymbol routing** (`port/src/entities/actorSerial.ts` lines 39–56):
   - Accepts bare symbol name (or `#`-prefixed)
   - Resolves actor registry entry for "bug"
   - Routes to `spawnUnit(name, x, y, {...})` for CPU characters
   - Returns a ready-to-use Entity

**Result:** Three `#bug` actors spawn at the egg's death location. ✓

---

## Friction & Stall Behavior

**Lingo:** `#friction: point(2,2)` causes the bullet to stall/land on terrain contact (via modMovement/updateLand).

**Port:** 
- Documented friction-to-maxLife translation (projectile.ts line 109 comment)
- Egg uses `maxLife` instead of friction-based stall detection
- This is a **faithfully omitted** property (documented in the codebase)
- **NOT a divergence** — the port explicitly replaces friction-land with a timeout

---

## Not Flagged (Per Scope)

The following properties/behaviors are explicitly excluded per the audit scope:
- `#attack.collisionLoc` — not listed in original data
- `#miniMapStatus` — inherited from #bullet (both omit custom override)
- `#eyestrain`, `#firingType`, `#explodeSound` — not applicable to eggs (plain bullets, no audio)
- Friction stall vs maxLife — documented replacement, not a divergence

---

## Hatching Verification (Critical Path)

**Chain of custody** for the egg → bug transformation:

1. **Egg fired** (control.ts line 618):
   - `Projectile.reincarnateAs = ["bug", "bug", "bug"]` ✓

2. **Egg dies** (projectile.ts lines 78–87):
   - `finish()` called (wall/maxLife/collision trigger)
   - `done` latch prevents double-spawn ✓
   - Loop iterates `reincarnateAs`, calls `spawnFromSymbol("bug", x, y)` three times ✓

3. **Bug spawned** (actorSerial.ts lines 39–56):
   - `spawnFromSymbol("bug", ...)` resolves `act_bug` from registry
   - Routes to `spawnUnit("bug", x, y, {...})` (line 54)
   - Returns a live Entity of type `"enemy"` with #bug's attack/stats ✓

4. **Bug enters game** (projectile.ts line 85):
   - Child entity pushed to `game.entities` ✓
   - Next frame: Update loop runs, bug has its own AI and normal behavior ✓

**Conclusion:** Hatching is **correct and complete**. The egg properly spawns three bugs on death.

---

## Summary

**All enumerated properties match** between original and port:
- Data values are identical (numeric, array, boolean)
- Inheritance chain is faithful
- Reincarnate threading is complete and correct
- Hatching mechanism (spawnFromSymbol → spawnUnit → push to entities) is functional

**No mishandling detected.**

---

**ACTOR=lizardEgg | CLEAN**

---

## RE-VERIFY (2026-06-23) — fresh reproduction
lizardEgg is `#inherit:#bullet` — a THROWN projectile (fired by lizardSoldier `#bullet:#lizardEgg`) that HATCHES on land-stall.
- **Thrower path (`tools/_audit_combat.ts lizardSoldier`):** lizardSoldier fires lizardEgg bullets that reach & damage a pinned hostile (6 damage events). A DIRECT target hit routes to `die()` (no hatch) — faithful (`projectile.ts:96`: only land-stall/explode hatches).
- **Land-stall hatch (`tools/_audit_egghatch.ts`):** fired a lizardEgg bullet (friction `point(2,2)`); it decayed and STALLED at t=128 → `finish()` spawned EXACTLY `[bug, bug, bug]` (#monsters) at the corpse loc, matching `#reincarnateAs`. Wired via `control.ts:1016` (lizardEgg→#bug) + `projectile.ts:102`. ✓
- **Verdict: CLEAN.**
