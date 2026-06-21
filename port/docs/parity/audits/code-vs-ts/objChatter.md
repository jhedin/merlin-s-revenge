# Behavioral Parity Audit: objChatter vs TypeScript Port

**Date:** 2026-06-21  
**File:** `casts/script_objects/objChatter.txt` + `objAiChatter.txt`  
**Port Files:** `port/src/components/chatter.ts` + `port/src/scenes/sceneManager.ts` + `port/src/main.ts`

---

## Executive Summary

The TypeScript port **REMOVES the navMode gating** that guards chatter triggers in the original Lingo code. The original **requires the player to be in nav mode** (non-combat) before a talking stone can trigger; the port has **NO equivalent check**. This is a **serious behavioral divergence** for a narrative feature.

---

## Handler -> TypeScript Mapping

### Lingo: objChatter (talking stone object)

| Handler | Lingo File | Lingo Line | TS File | TS Line | Purpose |
|---------|-----------|-----------|---------|---------|---------|
| `new` | objChatter.txt | 11-26 | chatter.ts | 24-46 | Init: defaults + config merge |
| `init` | objChatter.txt | 28-37 | chatter.ts | 35-46 | Load config: scriptToPerform, performed latch, reach calc |
| `collected` | objChatter.txt | 43-61 | chatter.ts | 60-68 | **ONE-FIRE trigger logic** (MAIN FSM) |
| `goMode` | objChatter.txt | 75-89 | chatter.ts | 55 | Mode state transition |
| `getTalkOnlyOnNavMode` | objChatter.txt | 71-73 | chatter.ts | (missing) | **Query: nav-mode gate enabled?** |

### Lingo: objAiChatter (chatter AI handler)

| Handler | Lingo File | Lingo Line | TS File | TS Line | Purpose |
|---------|-----------|-----------|---------|---------|---------|
| `new` | objAiChatter.txt | 8-11 | (integrated) | - | Ancestor init |
| `init` | objAiChatter.txt | 13-18 | (integrated) | - | Fetch player, set mode |
| `checkNavModeActive` | objAiChatter.txt | 20-25 | (none) | **NOT PORTED** | **Player in nav mode check** |
| `checkPossibleToTalk` | objAiChatter.txt | 27-40 | (none) | **NOT PORTED** | **NAV MODE GATE LOGIC** |
| `update` | objAiChatter.txt | 42-53 | chatter.ts | 60-68 | Overlap FSM tick |

### Lingo: SceneManager (cutscene routing)

| Component | Lingo | TS File | TS Line | Purpose |
|-----------|-------|---------|---------|---------|
| cutSceneMaster.playCutScene | movieMaster | sceneManager.ts | 26, 123-128 | Dispatch #scriptToPerform |
| (in-game chatter) | movieMaster K12 | sceneManager.ts | 34-36, 123-128 | playInGameCutScene action |

---

## Detailed Comparison: Trigger Flow

### Lingo Behavior (Original)

**Trigger Chain:** Player overlaps stone → AI asks "may I talk?" → if YES, call `collected()`

```
objAiChatter.update (line 42-53):
  if mode == #waitingToTalk:
    if checkPossibleToTalk() then
      if checkForCollisionWithPlayer() then
        pCharacterPrg.collected()
        mode = #active
```

**navMode Gating** (objAiChatter.checkPossibleToTalk, line 27-40):
```lingo
on checkPossibleToTalk me
  possible = false
  talkOnlyOnNavMode = me.pCharacterPrg.getTalkOnlyOnNavMode()
  
  if talkOnlyOnNavMode and me.checkNavModeActive() then
    possible = true
  end if
  
  if talkOnlyOnNavMode = false then
    possible = true
  end if
  
  return possible
end
```

**Logic:**
- If `talkOnlyOnNavMode` is TRUE (default, line 20) AND player is NOT in nav mode → do NOT trigger
- If `talkOnlyOnNavMode` is FALSE → trigger regardless of player mode
- `checkNavModeActive()` returns `player.getNavModeActive()` (player not in combat)

### TypeScript Behavior (Port)

**Trigger Chain:** Player overlaps stone → IMMEDIATELY call `collected()`

```typescript
// chatter.ts, line 60-68
update(next: NextFn): void {
  if (!this.performed && this.overlapsPlayer() && !game.scene?.isInGameCutscene()) {
    this.goMode("talking");
    const script = this.scriptToPerform.replace(/^#/, "");
    if (script && script !== "none") game.scene?.playInGameCutScene(script);
    this.performed = true;
  }
  next();
}
```

**No navMode Gating:**
- Line 61: NO check for player being in nav mode
- Line 61: NO call to getTalkOnlyOnNavMode()
- Line 61: NO equivalent to checkPossibleToTalk()
- Only gates: `!this.performed` (one-fire latch) + `this.overlapsPlayer()` + `!game.scene?.isInGameCutscene()` (existing cutscene block)

---

## Verified Behavioral Gaps

### GAP #1: Missing Player Nav Mode Gate

**Severity:** HIGH — affects all chatter stone triggers

| Aspect | Lingo (objChatter/objAiChatter) | TypeScript | Status |
|--------|---------|-----------|--------|
| **Default gate** | `pTalkOnlyOnNavMode = true` (line 20) | No equivalent | MISSING |
| **Query method** | `getTalkOnlyOnNavMode()` returns bool | Not implemented | REMOVED |
| **Nav mode check** | `checkNavModeActive()` → `player.getNavModeActive()` | Not implemented | REMOVED |
| **Gating logic** | `checkPossibleToTalk()` AND overlap → trigger | No gate, just overlap | **CHANGED** |
| **Combat block** | Indirectly via nav mode | Only `!isInGameCutscene()` | NARROWER |

**Evidence:**

**Lingo (objAiChatter.txt:27-40):**
```
if talkOnlyOnNavMode and me.checkNavModeActive() then
  possible = true
end if
```

**TS (chatter.ts:60-68):** No equivalent condition.

**Impact:** A stone will now trigger EVEN IF the player is in combat mode. In the original, combat (non-nav mode) blocks the trigger.

---

### GAP #2: Missing getTalkOnlyOnNavMode Query Method

| Aspect | Lingo | TS | Status |
|--------|-------|----|----|
| **Method** | `getTalkOnlyOnNavMode()` (objChatter.txt:71-73) | N/A | NOT PORTED |
| **Purpose** | Query: "does this stone gate on nav mode?" | (none) | REMOVED |
| **Return** | `pTalkOnlyOnNavMode` property | (N/A) | N/A |
| **Used by** | objAiChatter.checkPossibleToTalk() | (nobody) | ORPHANED |

The port never queries this property; it's not even stored as a component field (Chatter.ts has no talkOnlyOnNavMode member).

---

### GAP #3: Removed checkNavModeActive / checkPossibleToTalk FSM Gates

| Aspect | Lingo | TS | Status |
|--------|-------|----|----|
| **Lingo handlers** | objAiChatter (lines 20-40) | chatter.ts | FULLY REMOVED |
| **Gate location** | objAiChatter.update() queries before calling .collected() | chatter.ts.update() has no gate | **MOVED OUT** |
| **Result** | Must pass 2 checks: navMode + overlap | Only 1 check: overlap | **CHANGED** |

**Lingo (objAiChatter.txt:42-53):**
```lingo
if me.checkPossibleToTalk() then    <-- GATE #1 (nav mode)
  if me.pCharacterPrg.checkForCollisionWithPlayer() then
    me.pCharacterPrg.collected()
```

**TS (chatter.ts:60-68):**
```typescript
if (!this.performed && this.overlapsPlayer() && !game.scene?.isInGameCutscene()) {
  // NO checkPossibleToTalk() call above
```

---

### GAP #4: Missing Re-Trigger Guard (Second Touch → #finishedTalking)

| Aspect | Lingo | TS | Status |
|--------|-------|----|----|
| **Lingo (objChatter:54-59)** | `if me.pMode = #talking then me.goMode(#finishedTalking)` | N/A | NOT PORTED |
| **Purpose** | Second touch while #talking → revert to waiting | (none) | MISSING |
| **TS behavior** | N/A | After first overlap, `performed=true` latches forever | **CHANGED** |

**Lingo (objChatter.txt:54-59):**
```lingo
else
  if me.pMode = #talking then
    me.goMode(#finishedTalking)
  end if
end if
```

This allows a SECOND interaction (re-touch) to switch the sprite back to the waiting member. The port latches `performed=true` forever on first touch, blocking any re-trigger.

---

### NON-GAP: Per-CollisionRect Trigger Reach (VERIFIED PARITY)

| Aspect | Lingo | TS | Status |
|--------|-------|----|----|
| **Collision reach** | PLAYER_EDGE=12, rect half-extents per stone | PLAYER_EDGE=12, rect parse, reach calc | ✓ PARITY |
| **Evidence** | objGameObject.txt (implicit in CollisionCheck) | chatter.ts:19-22, 39-45 | ✓ CONFIRMED |
| **Fix tracker** | Issue #12 (per-actor rect + player edge) | port/src/components/chatter.ts | ✓ SHIPPED |

The reach calculation **matches exactly**: `reachX = abs(r.right - r.left) / 2 + PLAYER_EDGE`.

---

### NON-GAP: One-Fire Latch (VERIFIED PARITY)

| Aspect | Lingo | TS | Status |
|--------|-------|----|----|
| **Latch field** | `pPerformed` (false on init) | `performed` (false on init) | ✓ PARITY |
| **Trigger only once** | `if pPerformed = false then` (line 47) | `if (!this.performed ...)` (line 61) | ✓ PARITY |
| **Set after trigger** | `pPerformed = true` (line 54) | `this.performed = true` (line 65) | ✓ PARITY |

---

### NON-GAP: Script Dispatch (VERIFIED PARITY)

| Aspect | Lingo | TS | Status |
|--------|-------|----|----|
| **Dispatch target** | `g.cutSceneMaster.playCutScene(pScriptToPerform)` | `game.scene?.playInGameCutScene(script)` | ✓ PARITY |
| **Script parsing** | Direct symbol (e.g., `#stones1`) | Strip leading `#`, pass name string | ✓ PARITY |
| **No-op on #none** | `if pScriptToPerform <> #none` (line 50) | `if (script && script !== "none")` (line 64) | ✓ PARITY |
| **Evidence** | sceneManager.ts line 123-128 (playInGameCutScene gates to ingame env) | sceneManager.ts line 26, main.ts line 234 | ✓ CONFIRMED |

The scripts (stones1-10) are bundled and played correctly in both versions.

---

### NON-GAP: Cutscene Blocking (isInGameCutscene)

| Aspect | Lingo | TS | Status |
|--------|-------|----|----|
| **Field** | (implicit in movieMaster state) | `SceneManager.inGameCut` (line 48) | ✓ PARITY |
| **Block re-trigger** | Gating in movieMaster.cutSceneFinished default | `!game.scene?.isInGameCutscene()` (chatter.ts:61) | ✓ PARITY |
| **Rationale** | Don't fire a second script while one plays | Same | ✓ CONFIRMED |

---

## Summary Table: All Handlers

| Handler | Lingo Line | TS Location | Parity | Gap |
|---------|-----------|-----------|--------|-----|
| **objChatter.new** | 11-26 | chatter.ts:24-46 | ✓ | - |
| **objChatter.init** | 28-37 | chatter.ts:35-46 | ✓ (no talkOnlyOnNavMode stored) | #4 |
| **objChatter.collected** | 43-61 | chatter.ts:60-68 | ✗ (missing navMode gate) | #1, #2, #3 |
| **objChatter.goMode** | 75-89 | chatter.ts:55 | ~ (mode set only, no member swap in port) | - |
| **objChatter.getTalkOnlyOnNavMode** | 71-73 | (none) | ✗ | #2 |
| **objAiChatter.init** | 13-18 | (integrated into chatter.ts) | ✓ | - |
| **objAiChatter.checkNavModeActive** | 20-25 | (none) | ✗ | #1, #3 |
| **objAiChatter.checkPossibleToTalk** | 27-40 | (none) | ✗ | #1, #3 |
| **objAiChatter.update** | 42-53 | chatter.ts:60-68 | ✗ (no gate check) | #1, #3 |

---

## Impact Analysis

### Who This Affects

1. **All talking stones** (scr_stones1-10): Lose nav-mode gating
2. **NPC interactions during combat:** Will now trigger even if player is under attack
3. **Narrative pacing:** Combat sequences can be interrupted by chatter stones

### Severity

- **HIGH** — The default behavior (pTalkOnlyOnNavMode=true) is coded into every chatter in both versions; removing the gate changes semantics for ALL talking stones
- **FIDELITY** — The original Lingo uses a TWO-LEVEL guard (AI checks + overlap); the port uses only ONE (overlap)

### Restoration Path

To restore parity:

1. Add `talkOnlyOnNavMode: boolean = true` field to Chatter.init()
2. Implement `getNavModeActive()` query on Player (true if no active combat)
3. Add gate in Chatter.update():
   ```typescript
   if (!this.performed && this.overlapsPlayer() && !game.scene?.isInGameCutscene() &&
       this.canTalk()) { // <- call getNavModeActive if talkOnlyOnNavMode
   ```
4. Re-implement second-touch re-trigger (#finishedTalking mode swap)

---

## Audit Conclusion

**GAPS FOUND: 4 CRITICAL BEHAVIORAL DIVERGENCES**

1. **Missing nav mode gate** — stones trigger in combat (should block)
2. **Missing getTalkOnlyOnNavMode query** — property never read
3. **Removed checkPossibleToTalk FSM gates** — two-level guard collapsed to one
4. **No second-touch re-trigger** — performed latch is forever (minor)

The port **silently removes the player-state guard** that the original code puts in place to prevent chatter interruptions during active combat. This is a real narrative bug, not a cosmetic divergence.

