# Parity Audit: modReincarnate

**Repo root:** `/home/user/merlin-s-revenge`  
**Lingo source:** `casts/script_objects/modReincarnate.txt` (138 lines)  
**TS ports:**
- Main: `port/src/components/reincarnate.ts` (100 lines)
- Archetype wiring: `port/src/entities/archetypes.ts` (line 36, EnemyArchetype)
- Bullet reincarnate: `port/src/components/projectile.ts` (lines 30–87)

---

## Handler-by-Handler Analysis

### 1. `new` (Lingo line 13–16)
**Lingo:** Creates ancestor `modModule`, returns self.

**TS:** Class-based, no explicit module pattern.

**Status:** ✓ FAITHFUL (TS is idiomatic TypeScript equivalent)

---

### 2. `addModParams` (Lingo line 18–24)
**Lingo:**
```lingo
i[#reincarnateAs] = [#none, #none, #none]
```

**TS:** 
- `parseReincarnate()` (line 41–46) normalizes both `#reincarnateAs` and `#reincarnateInto` to `string[]`, filtering out `#none` entries into the list but keeping them as `"none"` strings.
- Default `reincarnateAs: string[] = []` (line 50)
- `EnemyArchetype` passes `reincarnateAs` and `reincarnateInto` from data (archetypes.ts:323–324)

**Status:** ✓ FAITHFUL (defaults are wired through act_ data, not hardcoded arrays)

---

### 3. `init` (Lingo line 26–31)
**Lingo:**
```lingo
pReincarnateAs = params.reincarnateAs
pReincarnatedMe = #none
```

**TS:** (reincarnate.ts line 55–61)
```typescript
this.reincarnateAs = parseReincarnate(cfg["reincarnateAs"] ?? cfg["reincarnateInto"]);
this.radius = typeof cfg["reincarnateRadius"] === "number" ? cfg["reincarnateRadius"] : 0;
this.depth = pendingDepth;
this.done = false;
```

**Status:** ✓ FAITHFUL
- TS parses both `reincarnateAs` AND `reincarnateInto` (both seen in shipped data, line 56)
- TS reads `reincarnateRadius` (Lingo ignores it; TS uses it for scatter, line 58)
- TS reads `depth` budget (port-only guard; see §5 below)

---

### 4. `getReincarnatedMe` (Lingo line 33–35)
**Lingo:**
```lingo
on getReincarnatedMe me
  return pReincarnatedMe
end
```

**TS:** NOT IMPLEMENTED

**Status:** ⚠ **GAP DETECTED**
- `pReincarnatedMe` in Lingo records the FIRST spawned child (reincarnate loop, line 62)
- Used by `modExperience.transferExperience()` (casts/script_objects/modExperience.txt:318–321) to transfer half the parent's XP to the child:
  ```lingo
  reincarnatedMe = me.big.getReincarnatedMe()
  reincarnatedMe.gainExperienceFromTransfer(pExperienceGained / 2)
  ```
- TS **has NO `getReincarnatedMe()` handler** (grep confirms: 0 matches in port/src)
- TS **does NOT send `#reincarnated` event** (reincarnate.ts missing line 66 of Lingo)
- TS **Experience component has NO `transferExperience()` handler** (experience.ts has no internalEvent handler at all)

**Impact:** On reincarnation, Lingo units transfer half their XP to each spawned child. TS units do NOT transfer XP. This affects all multi-stage enemies (hydra, skeleton lord cascade, etc.) — their descendants spawn fresh with 0 XP instead of inheriting half the parent's gains.

---

### 5. `internalEvent` (Lingo line 37–47)
**Lingo:**
```lingo
on internalEvent me, theEvent
  ancestor.internalEvent(theEvent)
  case theEvent of
    #leftTeam:
      if me.big.getKilledInAction() then
        me.reincarnate()
      end if
  end case
end
```

**TS:** (reincarnate.ts line 64–73)
```typescript
update(next: NextFn): void {
  if (!this.done && this.reincarnateAs.length > 0 && this.depth > 0) {
    if ((this.entity.send("isDead") as boolean) && 
        (this.entity.send("getKilledInAction") as boolean)) {
      this.done = true;
      this.reincarnate();
    }
  }
  next();
}
```

**Status:** ✓ FAITHFUL (with minor structural differences)
- **Gate:** Both check `getKilledInAction()` before spawning (Lingo line 42, TS line 67)
  - ✓ Correctly blocks reincarnation on retire, room-exit, screen-clear (not lethal takeHit)
  - ✓ Prevents monk (leaveWhenFinished=true) from splitting into parts
- **Trigger:** Lingo uses `#leftTeam` internalEvent; TS uses `update()` on `isDead && killedInAction` edge
  - Both fire during the death frame; TS is actually SAFER (synchronous check on the death-finalize tick, not async event)
- **Latch:** TS sets `done=true` BEFORE spawning loop (fire-once guard); Lingo doesn't have explicit latch
  - ✓ TS prevents double-spawn if update runs twice on same death frame (plan §f.1a)

---

### 6. `reincarnate` (Lingo line 49–72)

**Lingo:**
```lingo
on reincarnate me
  repeat with i in pReincarnateAs
    j=1
    if i <> #none then
      params = g.actorMaster.getParams(#newActor)
      params.typ = i
      params.startLoc = me.big.getLoc()      
      if j=1 then
        params.useOffset = false
      else
        params.useOffset = true
      end if
      pReincarnatedMe = g.actorMaster.newActor(params)
      j = j + 1
      if pReincarnatedMe <> #none then
        me.big.internalEvent(#reincarnated)
      end if
    end if
  end repeat
end
```

**TS:** (reincarnate.ts line 77–99)
```typescript
private reincarnate(): void {
  const pos = this.entity.send("getPos") as { x: number; y: number };
  if (!game.spawnUnit) return;
  const childDepth = this.depth - 1;
  let spawned = 0;
  for (let i = 0; i < this.reincarnateAs.length; i++) {
    const typ = this.reincarnateAs[i]!;
    if (typ === "none" || typ === "") continue;
    let dx = 0, dy = 0;
    if (spawned > 0) {
      const r = this.radius > 0 ? this.radius : 20;
      const ang = (spawned / Math.max(1, this.reincarnateAs.length)) * Math.PI * 2;
      dx = Math.cos(ang) * r; dy = Math.sin(ang) * r;
    }
    pendingDepth = childDepth;
    const child = game.spawnUnit(typ, pos.x + dx, pos.y + dy, {});
    pendingDepth = DEFAULT_DEPTH;
    game.entities.push(child);
    spawned++;
  }
}
```

#### **6a. Loop Structure & Counter Bug**
**Lingo bug (lines 52–53):**
```lingo
repeat with i in pReincarnateAs
  j=1  // <-- SET to 1 at START of loop
  ...
  j = j + 1  // <-- INCREMENTED, but never used correctly
```
- `j` is RESET to 1 on EVERY loop iteration
- `j = j + 1` increments it to 2, but only runs if spawn succeeds
- Next iteration: `j=1` again
- Result: `useOffset` is ALWAYS `false` (first condition `if j=1` always true) **except possibly the last spawn**
- **This is a bug in the original code.** All children spawn at the corpse loc with no scatter.

**TS fix (lines 82–97):**
```typescript
let spawned = 0;
for (let i = 0; i < this.reincarnateAs.length; i++) {
  ...
  if (spawned > 0) {  // <-- first (spawned=0) no offset; rest scatter
    const r = this.radius > 0 ? this.radius : 20;
    const ang = (spawned / Math.max(1, this.reincarnateAs.length)) * Math.PI * 2;
    dx = Math.cos(ang) * r; dy = Math.sin(ang) * r;
  }
  ...
  spawned++;  // <-- incremented after each valid spawn
}
```

**Status:** ⚠ **INTENTIONAL BEHAVIORAL DIVERGENCE (justified)**
- TS implements the Lingo INTENT (first spawn centered, rest scattered) correctly
- Lingo's `j` counter bug means all spawns landed at the same corpse location in the original
- TS adds deterministic circular scatter via `reincarnateRadius` (data-driven, e.g., skeleton lord radius=40)
- The shipped data HAS `reincarnateRadius` values, so the TS fix is SHIPPING-FAITHFUL (matches the designer intent, not the buggy code)
- Example: `act_skelitonLord.txt` has `#reincarnateRadius: 40`, which is **only usable by TS** because Lingo's code never implements the scatter

**Verdict:** ✓ CORRECT (fixes a latent Lingo bug that was never noticed because the buggy counter still spawned multiple children at the corpse, just all overlapped)

---

#### **6b. Spawn Parameters & Team/Level Inheritance**
**Lingo (line 54–56):**
```lingo
params = g.actorMaster.getParams(#newActor)
params.typ = i
params.startLoc = me.big.getLoc()
```
- Only `typ` and `startLoc` passed; no team/level inheritance from parent
- Child's team/level come from **child's own act_ data** (newActor resolves via registry)

**TS (line 94):**
```typescript
const child = game.spawnUnit(typ, pos.x + dx, pos.y + dy, {});
```
- Calls `spawnUnit()` with only `typ`, `x`, `y`, empty opts
- `spawnUnit()` resolves team from **child's own data** (archetypes.ts:54–59)
- Level from **child's own data** (no inheritance)

**Status:** ✓ FAITHFUL (team & level from child's act_ data, not parent)

---

#### **6c. Corpse Location (Still-Valid Loc)**
**Lingo (line 56):**
```lingo
params.startLoc = me.big.getLoc()
```

**TS (line 78):**
```typescript
const pos = this.entity.send("getPos") as { x: number; y: number };
...
const child = game.spawnUnit(typ, pos.x + dx, pos.y + dy, {});
```

**Status:** ✓ FAITHFUL
- Both read the dying entity's position at spawn time
- In TS, dead actors persist as graves (Grave component), so `getPos()` stays valid
- In Lingo, sprite is freed after `#leftTeam`, so this must execute during the event (before sprite cleanup)
- TS reads synchronously in `update()` on the death-finalize edge (same timing window)

---

#### **6d. pReincarnatedMe Assignment & #reincarnated Event**
**Lingo (line 62–67):**
```lingo
pReincarnatedMe = g.actorMaster.newActor(params)  // <-- each loop, overwrite with latest spawn
...
if pReincarnatedMe <> #none then
  me.big.internalEvent(#reincarnated)  // <-- send to parent
end if
```
- Stores the spawned child in `pReincarnatedMe` (overwritten on each loop iteration, so ends up holding the LAST spawned child, not the first)
- Sends `#reincarnated` event to parent after each spawn

**TS:** Does NOT send event, does NOT store spawned children

**Status:** ⚠ **GAP DETECTED** (combined with #4 above)
- Missing: `#reincarnated` internalEvent → blocks `modExperience.transferExperience()`
- Missing: `pReincarnatedMe` storage → blocks `getReincarnatedMe()` handler

**Secondary bug note:** Lingo's `pReincarnatedMe` actually ends up holding the LAST child (due to loop overwrites), not the first. The Lingo code comment says "a reference to the object that we have 'become'" but the loop logic makes it the last spawn. TS doesn't track this at all.

---

#### **6e. Infinite-Reincarnate Guard (Depth Budget)**
**Lingo:** No guard. Assumes data is acyclic (safe assumption: shipped data has no cycles).

**TS (lines 52, 59, 65, 80):**
```typescript
private depth = DEFAULT_DEPTH;  // line 52
this.depth = pendingDepth;      // line 59 (handed from parent)
if (!this.done && this.reincarnateAs.length > 0 && this.depth > 0) {  // line 65
  const childDepth = this.depth - 1;  // line 80
  pendingDepth = childDepth;  // line 93
```
- Each spawned child gets `depth - 1` (decremented by 1 tier per generation)
- Default 12 (deeper than any shipped chain, which is max 4 deep: skelitonLord → Upper → TorsoTank → Head)
- At depth 0, cascade stops

**Status:** ✓ FAITHFUL + PORT-ONLY SAFETY
- Lingo: no guard (safe, data is acyclic)
- TS: guard at depth=0 (never fires on shipped data, protects against data typos like A→A)

---

## Cascade Verification (Skeleton Family)

**Data chain (shipped):**
```
act_skelitonLord.txt:
  #reincarnateAs: [#skelitonUpper, #skelitonLowerLeg, #skelitonSword]
  #reincarnateRadius: 40

act_skelitonUpper.txt:
  #reincarnateAs: [#skelitonTorsoTank, #skelitonArm, #skelitonArm]
  #reincarnateRadius: 30

act_skelitonTorsoTank.txt:
  (no reincarnateAs → cascade stops)
```

**Depth:**
- skelitonLord dies (lethal takeHit) → spawns 3 children at depth 3
- Each Upper dies → spawns 3 children at depth 2
- Each TorsoTank dies → spawns 0 children (no reincarnateAs) OR other branches
- Total max 4-tier cascade (counting the lord as tier 1)

**Expected spawns on full cascade death:** 1 + 3 + 9 + ? = 13+ units

**Both Lingo and TS:** Will spawn the full cascade if all reincarnation stages are reached.

**Status:** ✓ CASCADE DEPTH FAITHFUL

---

## Bullet Reincarnate Path (Separate Implementation)

**Lingo:** No bullet reincarnate in modReincarnate.txt (that's a separate module, objBullet)

**TS:**
- `projectile.ts` lines 30–87: Bullet reincarnate on death (`finish()` method)
- `finish()` latch (line 80, `done=true`) prevents double-spawn
- Spawns via `spawnFromSymbol()` (line 84, separate from `spawnUnit`)
- No cascade (bullets don't have Reincarnate component; they just spawn their #reincarnateAs actors as one-off)

**Status:** ✓ CORRECT (separate from modReincarnate; both are independent latched spawn paths)

---

## Experience Transfer (Separate System, Not Implemented in TS)

**Lingo modExperience.txt (line 192–193):**
```lingo
#reincarnated:
  me.transferExperience()
```

**Lingo modExperience.transferExperience (line 318–321):**
```lingo
reincarnatedMe = me.big.getReincarnatedMe()
reincarnatedMe.gainExperienceFromTransfer(pExperienceGained / 2)
```

**TS:** NO HANDLER
- Experience component has NO internalEvent at all
- Reincarnate component does NOT send `#reincarnated` internalEvent
- No `getReincarnatedMe()` message handler exists
- No XP transfer happens on reincarnation

**Status:** ⚠ **CRITICAL GAP**
- Feature: Multi-stage enemies that die and reincarnate transfer half their XP to their spawned children (making them progressively stronger)
- TS: Does NOT transfer XP
- Shipped examples affected: hydra, skeleton lord, 4-arm golem, ice rock, double dark golem, gargoyle tower, etc.

---

## Summary of Gaps

| Gap ID | Severity | Category | Lingo Handler | TS Missing | Impact |
|--------|----------|----------|---|---|---|
| GAP-1  | CRITICAL | Experience | `modExperience.internalEvent(#reincarnated)` → `transferExperience()` → `getReincarnatedMe()` | No `#reincarnated` event sent; no XP transfer handler; no `getReincarnatedMe()` message | Multi-stage enemies spawn with 0 XP instead of inheriting half the parent's gains. Hydra, skeleton lord, etc. are weaker than original. |
| GAP-2  | MINOR | Storage | `pReincarnatedMe` stored on each spawn (last one wins) | No `getReincarnatedMe()` getter | Only blocks XP transfer (see GAP-1). |

---

## Behavioral Divergences (Not Gaps — Justified or Benign)

| Issue | Lingo | TS | Verdict |
|-------|-------|----|----|
| **Offset counter bug** | `j=1` reset every loop → no scatter ever works | `spawned++` incremented correctly → scatter works | ✓ TS FIXES latent bug; shipping data has `reincarnateRadius` values that prove intent |
| **Depth budget guard** | None (data assumed acyclic) | Stops at depth=0 (safety, never fires on shipped data) | ✓ TS adds port-only safety |
| **Fire-once latch** | None explicit | `done=true` before loop | ✓ TS safer against double-spawn on frame duplication |

---

## Files & Line Evidence

| File | Lines | Handler | Status |
|------|-------|---------|--------|
| `casts/script_objects/modReincarnate.txt` | 13–16 | `new` | ✓ |
| | 18–24 | `addModParams` | ✓ |
| | 26–31 | `init` | ✓ |
| | 33–35 | `getReincarnatedMe` | ⚠ NOT IMPLEMENTED IN TS |
| | 37–47 | `internalEvent(#leftTeam)` | ✓ (different trigger, same gate) |
| | 49–72 | `reincarnate` | ✓ (with noted bugs fixed) |
| `port/src/components/reincarnate.ts` | 40–46 | `parseReincarnate()` | ✓ |
| | 48–100 | `class Reincarnate` | ✓ (missing #reincarnated event) |
| | 55–61 | `init()` | ✓ |
| | 64–73 | `update()` | ✓ |
| | 77–99 | `reincarnate()` | ✓ (fixes bug, adds scatter) |
| `port/src/components/experience.ts` | 1–78 | Experience class | ✗ NO internalEvent handler; no #reincarnated case |
| `port/src/entities/archetypes.ts` | 36 | EnemyArchetype wiring | ✓ (includes Reincarnate) |
| | 54–60 | `spawnUnit()` | ✓ |
| | 321–325 | reincarnateAs/reincarnateInto/reincarnateRadius data wiring | ✓ |
| `port/src/components/projectile.ts` | 30–87 | Bullet reincarnate | ✓ (separate, correct) |
| `casts/script_objects/modExperience.txt` | 192–193 | `internalEvent(#reincarnated)` | ✓ (source behavior) |
| | 318–321 | `transferExperience()` | ✗ (NOT IN TS Experience) |

---

## Conclusion

**CLEAN on core reincarnation spawn logic** (lethal death gate, corpse loc, child spawning, cascade depth).

**CRITICAL GAP on experience transfer:** Lingo sends `#reincarnated` internalEvent → Experience component transfers half the parent's XP to the first spawned child. TS does NOT implement this pathway. Multi-stage enemies (hydra, skeleton lord, etc.) spawn weaker descendants than the original.

**Justifiable divergence on scatter:** TS fixes the latent Lingo counter bug and implements the `reincarnateRadius` scatter that the original code never supported (data fields exist but weren't used).
