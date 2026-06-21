# Audit: modGhost.txt vs TS Port

**File:** `casts/script_objects/modGhost.txt`
**Scope:** Ghost module — initialization, collision detection, ghost flag queries, possess team tracking.
**Date:** 2026-06-21

---

## Lingo Original: modGhost.txt (Lines 1-47)

The ghost module is minimal and focused:

1. **Properties:**
   - `pGhost`: boolean flag for whether actor is a ghost
   - `pTeamWhenAlive`: the team this ghost belonged to when alive

2. **addModParams() (lines 11-18):**
   - Sets `#ghost = false` (default)
   - Sets `#teamWhenAlive = #ghosts`

3. **init() (lines 20-29):**
   - Captures params `ghost` and `teamWhenAlive` into properties
   - **If ghost is true, calls `me.initGhost()`**

4. **initGhost() (lines 31-33):**
   - **Single line: `me.big.collisionDetectionOff()`**
   - This disables collision detection so ghosts drift through terrain/objects

5. **Query handlers (lines 35-46):**
   - `amGhost()` / `isGhost()`: both return `pGhost`
   - `getTeamWhenAlive()`: return `pTeamWhenAlive`

---

## TS Port: Mapping

### 1. Ghost Flag & Initialization

**Location:** `port/src/entities/archetypes.ts:213 (spawnEnemy)`

```typescript
const ghost = aiType === "#objAiCPUGhost";
```

Ghost flag is derived from the enemy's AiType. Set on the build config:

```typescript
// Line 287
ghost,
```

Passed to CpuAI init at line 363 in `control.ts`:

```typescript
this.ghost = cfg["ghost"] === true;
```

✅ **PARITY:** Ghost flag set and passed correctly.

### 2. Ghost Team When Alive

**Location:** `port/src/entities/archetypes.ts:294 (spawnEnemy)`

```typescript
teamWhenAlive: typeof d["teamWhenAlive"] === "string" ? (d["teamWhenAlive"] as string) : str("team", "#monsters"),
```

Passed to CpuAI init at line 368:

```typescript
this.teamWhenAlive = typeof cfg["teamWhenAlive"] === "string" ? cfg["teamWhenAlive"] : "";
```

✅ **PARITY:** Team tracking preserved.

### 3. Collision Detection Off (initGhost)

**Location:** `port/src/entities/archetypes.ts:277-281 (spawnEnemy)`

```typescript
// #collisionDetection:false (bat/greyGhost/summonArcher/Warrior/Orc/Golem/Boulder/skelitonSword) and the
// #objAiCPUGhost (monkGhost, via modGhost.initGhost -> collisionDetectionOff) DRIFT THROUGH terrain —
// objGameObject.checkCollisions only runs when pCollisionDetection. Map to passThrough (no moveBox).
passThrough: d["collisionDetection"] === false || ghost,
constrainToArea: d["collisionDetection"] === false || ghost, // autoConstrainToPlayArea: ghosts stay on-map
```

**Verdict:** `initGhost()` → `collisionDetectionOff()` is mapped to:
- `passThrough: true` (entity skips physical collision + moveBox)
- `constrainToArea: true` (entity stays within map bounds, unlike flying out)

This is part of the **fixed #16** (passThrough support). See `port/src/components/movement.ts` which respects `passThrough` flag.

✅ **PARITY:** Collision behavior correctly ported.

### 4. Ghost Possession Mechanic

**Location:** `port/src/components/control.ts:714-775 (CpuAI.updateGhost & friends)`

The possession FSM is present:

- **ghostFindTarget()** (lines 729-746): Search for a `#monk` on the possess team (`teamWhenAlive`); drift if none found.
- **ghostGoToLoc()** (lines 748-755): Path toward the monk's live location or random drift point.
- **ghostAttemptPossess()** (lines 757-775): On arrival within `POSSESS_DIST` (10px), transfer full XP + `glowPink()` + kill the ghost via `takeHit(999999, ...)`.

**Lingo:** The original's possession logic is defined in `objAiCPUGhost`, not in modGhost itself. modGhost only sets the flag and disables collisions. **Possession is out of scope for modGhost — it's an AI subsystem (K5 in the port audit trail).**

✅ **PARITY:** Possession logic exists in TS port; documented as out-of-scope for modGhost.

### 5. Ghost Damage Immunity

**Lingo Original (objCPUCharacter.txt:7-9):**
```
on takeHit me, collisionVect, attackingObj, owner
  -- if we are a ghost don't get hit.
  if me.amGhost() then
    return
  end if
```

**TS Port:** Ghost damage immunity is **NOT implemented**.

**Evidence:**
- `port/src/components/combat.ts:33-53 (Energy.takeHit)`: No ghost check. Damage applies unconditionally.
- `port/src/components/hurt.ts:35-51 (Hurt.takeHit)`: No ghost check. Reel/feedback plays.
- **No getGhost() or amGhost() query dispatch** in the port.

**Analysis:** Ghosts in the original take NO damage from attacks. In the port, ghosts take damage normally. This is a **gameplay divergence**. However:
1. **Ghost possession (K5)** brings ghosts to the target monk, then kills them via explicit `takeHit(999999, ...)`. The possession kill works.
2. **Drifting ghosts** (no monk found) in samii may be unkillable in the original too, but samii is not in the port's scope.
3. **The fix does not break tested gameplay**, but it is technically incomplete.

⚠️ **GAP:** Ghost damage immunity missing (objCPUCharacter.takeHit gate). Ghosts CAN take damage in the port; original ghosts cannot.

### 6. Ghost Rendering / Transparency

**Lingo Original:** No explicit transparency/alpha code in modGhost.txt. Ghost rendering is handled by modGrave (leaves no grave) and animation rendering (respects no grave).

**TS Port:**
- `port/src/components/grave.ts:19`: Ghost sets `graveOn=false` so no grave persists.
- `port/src/components/anim.ts:104-105`: Dead ghost with `graveOn=false` returns null sprite → vanishes.
- **No transparency/fade for living ghosts.** Ghosts render fully opaque.

**Analysis:** The original does not define transparency/fade for ghosts in modGhost. If ghosts were semi-transparent, that logic would be in a separate module (e.g., modColourTransform or the render pipeline). No evidence in the audit of ghost-specific alpha/transparency in the original.

✅ **PARITY:** No ghost transparency/fade requirements found in modGhost; both render fully opaque while alive, vanish on death.

### 7. Ghost-Specific Death Behavior

**Lingo Original (modGrave.txt):**
```
if params[#ghost] = true then
  pGraveOn = false
end if
```

Ghost does not leave a grave; just vanishes.

**TS Port (grave.ts:19, anim.ts:104-105):**
- Ghost sets `graveOn=false`
- Dead ghost sprite is suppressed → vanishes

✅ **PARITY:** Ghost death/grave behavior preserved.

---

## Summary: Verified Gaps

### ✅ CLEAN (PARITY MET)

1. **Ghost flag initialization** (modGhost.init → CpuAI.ghost) — lines 363, 287.
2. **Collision detection off** (initGhost → passThrough + constrainToArea) — lines 280-281 (fixed #16).
3. **Team tracking** (pTeamWhenAlive) — lines 294, 368.
4. **Ghost possession FSM** (findTarget/goToLoc/attemptPossess) — lines 729-775.
5. **Ghost vanishes on death** (graveOn=false, sprite suppressed) — grave.ts:19, anim.ts:104-105.
6. **No transparency/fade requirement** — no ghost-alpha in original modGhost.

### ⚠️ VERIFIED GAP

1. **Ghost damage immunity (objCPUCharacter.takeHit gate, lines 7-9 Lingo):**
   - **Lingo:** Ghosts take NO damage (`if me.amGhost() then return`).
   - **TS Port:** Ghosts take damage normally (no gate in Energy.takeHit / Hurt.takeHit).
   - **Severity:** Gameplay divergence. Ghosts can die from random attacks in port; original ghosts cannot.
   - **Scope Note:** This is technically an objCPUCharacter behavior, not modGhost. However, the possession kill (`takeHit(999999)`) still works, so possessed ghosts die correctly. Drifting ghosts (no monk) are rare/out-of-scope.
   - **Status:** Not a blocker for K5 possession; documented gap in ghost immunity.

---

## File:Line Evidence

| Behavior | Lingo | TS | Status |
|----------|-------|----|----|
| Ghost flag | modGhost.txt:26 | archetypes.ts:287, control.ts:363 | ✅ |
| Collision off | modGhost.txt:32 | archetypes.ts:280 | ✅ |
| Team tracking | modGhost.txt:24 | archetypes.ts:294 | ✅ |
| Possession FSM | objAiCPUGhost (K5 scope) | control.ts:729-775 | ✅ |
| No grave | modGrave.txt:7-9 | grave.ts:19 | ✅ |
| Damage immunity | objCPUCharacter.txt:7-9 | (missing) | ⚠️ GAP |

---

## Conclusion

**modGhost.txt core function (collision off, ghost flag, team) is PORTED and CLEAN.**

The ghost possession mechanic (K5) is implemented in the TS port at `control.ts:729-775` and functions correctly. Ghosts drift, find monks, and merge XP on possession, leaving the ghost dead.

**One documented gap:** Ghost damage immunity (objCPUCharacter.takeHit gate) is not implemented. This is a gameplay divergence but does not block the primary possession mechanic (explicit possession kill via `takeHit(999999)` works). The gap is noted in the K5 scope and can be addressed separately if drifting ghosts need bullet immunity.
