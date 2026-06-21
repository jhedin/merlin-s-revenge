# Actor Parity Audit: kingStones

**Actor**: kingStones (trigger-stone, #objChatter, cutscene trigger)  
**Date**: 2026-06-21  
**Status**: **GAPS=1 identified** (Trigger reach hardcoded, not per-actor configurable)

---

## 1. Original Definition (casts/data/act_kingStones.txt)

| Property | Value | Notes |
|----------|-------|-------|
| #name | "kingStones" | |
| #type | #field | |
| #inherit | #chatter | Parent: objChatter (casts/script_objects/objChatter.txt:1) |
| #character | #king | |
| **#collisionRect** | **rect(-100, -50, 100, 50)** | **Trigger reach: ±100 X axis, ±50 Y axis** |
| #initFaceDir | -1 | Face left |
| #member | anm_kingStones_stand_03_01 | Sprite member |
| #miniMapStatus | #clr | Clear from minimap |
| #team | #collectables | Non-hostile team (immuneToAttack=true) |
| #scriptToPerform | #rescueKing | Story cutscene |
| #speechColor | rgb(100,100,255) | Blue dialogue text |
| #startOffset | point(-16, -16) | Sprite offset |
| #walkSpeed | 4 | Movement speed |

**Trigger Behavior Chain** (casts/script_objects/objChatter.txt):
- objChatter.collected() (line 43–61): On collision with player, latch pPerformed and play cutscene
- objAiChatter.update() (line 42–53): Check collision each frame
- objAiChatter.checkForCollisionWithPlayer() → objGameObject.checkForCollisionWithPlayer() (objGameObject.txt)
  - Uses: `CollisionCheck(me.big, g.actorMaster.getPlayer())` — me.big is the actor itself; CollisionCheck uses its #collisionRect
  - Result: Uses actor's actual collisionRect rect(-100, -50, 100, 50) for trigger reach

---

## 2. Port Definition (port/src/generated/data.json)

```json
{
  "act_kingStones": {
    "data": {
      "inherit": "#chatter",
      "character": "#king",
      "collisionRect": {
        "left": -100,
        "top": -50,
        "right": 100,
        "bottom": 50
      },
      "initFaceDir": -1,
      "member": {"$member": ["anm_kingStones_stand_03_01", "gfx"]},
      "miniMapStatus": "#clr",
      "name": "kingStones",
      "team": "#collectables",
      "scriptToPerform": "#rescueKing",
      "speechColor": {"r": 100, "g": 100, "b": 255},
      "startOffset": {"x": -16, "y": -16},
      "walkSpeed": 4
    }
  }
}
```

**Data Coverage**: ✓ All properties present and values faithful to original

---

## 3. Trigger Dispatch Implementation (port/src/components/chatter.ts)

### 3.1 Overview

| Aspect | Original | Port | Parity? |
|--------|----------|------|---------|
| Trigger condition | checkForCollisionWithPlayer() in AI loop | overlapsPlayer() each update tick | ✓ Functional equiv. |
| One-fire latch | pPerformed property gate | this.performed boolean | ✓ Match |
| Mode FSM | #waiting → #talking → #finishedTalking | "waiting" → "talking" → "finishedTalking" | ✓ Match |
| Script dispatch | g.cutSceneMaster.playCutScene(name) | game.scene?.playInGameCutScene(name) | ✓ Functional equiv. |
| **Collision reach** | **Uses per-actor #collisionRect** | **Hardcoded constant (320)** | **✗ GAP** |

### 3.2 The Trigger Reach Gap (HIGH SEVERITY)

**Original Behavior** (casts/data/act_kingStones.txt:5):
```
#collisionRect: rect(-100, -50, 100, 50)
```
- Trigger zone: ±100 pixels on X axis, ±50 pixels on Y axis from stone center
- Uses objGameObject.checkForCollisionWithPlayer() → CollisionCheck() with me.big
- Each actor has its own collision rect read from data

**Port Behavior** (port/src/components/chatter.ts:17, 57):
```typescript
const TRIGGER_REACH = 320;  // line 17

private overlapsPlayer(): boolean {
  const p = game.player; if (!p) return false;
  const pm = p.tryGet(Movement); const sm = this.entity.tryGet(Movement);
  if (!pm || !sm) return false;
  return Math.abs(pm.x - sm.x) <= TRIGGER_REACH && Math.abs(pm.y - sm.y) <= TRIGGER_REACH;
}
```
- Trigger zone: ±320 pixels on **BOTH axes** (ignores collisionRect from config)
- Same hardcoded constant for all chatter types

**Impact Analysis**:
- kingStones original rect: rect(-100, -50, 100, 50)
  - Half-width (X reach): 100 pixels
  - Half-height (Y reach): 50 pixels
- Port hardcoded reach: 320 pixels on both axes
- **Ratio**: 320 ÷ 100 (X) = **3.2x larger** on X axis; 320 ÷ 50 (Y) = **6.4x larger** on Y axis
- **Area ratio**: (320²) ÷ (100×50) ≈ **20.5x larger trigger zone**

**Gameplay Impact**: Player can trigger kingStones from much farther away than in the original, potentially triggering it unintentionally or from areas where the cutscene's context is wrong.

**Code Evidence**:
- Original rect: `/home/user/merlin-s-revenge/casts/data/act_kingStones.txt:5`
- Port constant: `/home/user/merlin-s-revenge/port/src/components/chatter.ts:17`
- Port overlap check: `/home/user/merlin-s-revenge/port/src/components/chatter.ts:57`

---

## 4. One-Fire Latch

**Original** (objChatter.txt:43-61):
```lingo
on collected me
  if pPerformed = false then  
    me.goMode(#talking)
    if pScriptToPerform <> #none then
      g.cutSceneMaster.playCutScene(pScriptToPerform)
    end if
    pPerformed = true
  else
    if me.pMode = #talking then
      me.goMode(#finishedTalking)
    end if
  end if
end
```

**Port** (chatter.ts:43-51):
```typescript
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

**Parity**: ✓ Functionally faithful
- Both latch pPerformed/performed on first trigger
- Both prevent re-trigger once latched
- Port adds isInGameCutscene() guard (graceful guard against double-trigger during active cutscene)

---

## 5. Mode FSM (Member Swap)

**Original** (objChatter.txt:75-89):
```lingo
on goMode me, newMode
  case newMode of
    #talking:
      if pTalkingMember <> #none then
        me.setMember(pTalkingMember)
      end if
    #finishedTalking:
      me.setMember(pWaitingMember)
  end case
  ancestor.goMode(newMode)
end
```

**Port** (chatter.ts:36-38):
```typescript
goMode(mode: string): void { this.mode = mode; }
```

**Port Note** (chatter.ts:36–37 comment):
> The port's stones ship a single stand strip (no separate talking/waiting art), so this tracks the FSM state only.

**Parity**: ✓ Functionally faithful
- Original swaps member on mode change; port tracks state without art swapping (port has single sprite per stone)
- K1 re-calibration (art-fold) is intentional and documented
- State machine itself is identical

---

## 6. Script Dispatch

**Original** (objChatter.txt:50-51):
```lingo
if pScriptToPerform <> #none then
  g.cutSceneMaster.playCutScene(pScriptToPerform)
end if
```

**Port** (chatter.ts:46-47):
```typescript
const script = this.scriptToPerform.replace(/^#/, "");
if (script && script !== "none") game.scene?.playInGameCutScene(script);
```

**Dispatch Behavior**: ✓ Faithful
- Both dispatch script by name
- Both honor #none / "" / "none" as no-op (play nothing)
- Port strips # prefix (Lingo uses # for symbols; JSON doesn't, so "#rescueKing" → "rescueKing")

---

## 7. Cutscene Asset (rescueKing)

**Original** (casts/):
- #rescueKing referenced in act_kingStones.txt:11
- NOT defined in casts/data/ or casts/script_objects/
- **Conclusion**: Content-scope gap (missing story asset, not dispatch mechanism)

**Port** (port/public/assets/cutscenes/):
- Only stones1.txt through stones10.txt present
- rescueKing NOT present

**Impact Assessment**:
- This is **NOT a dispatch gap** — the Chatter.update() code would correctly attempt `playInGameCutScene("rescueKing")`
- If the asset doesn't load, the port gracefully no-ops (no crash, cutscene simply doesn't play)
- This is **intentional K1 content narrowing** (port ships stones1-10 only; side-quest rescueKing omitted)

**File Evidence**:
- Original missing script: `casts/data/act_kingStones.txt:11` references #rescueKing
- Port asset list: `ls port/public/assets/cutscenes/` shows only stones1-10
- Port dispatch: `port/src/components/chatter.ts:47` would call playInGameCutScene("rescueKing") if triggered

---

## 8. Team & Gameplay State

**Original** (act_kingStones.txt:10):
```
#team: #collectables
```
- Team "collectables" defines non-hostile, non-interactive (immuneToAttack=true, tem_chatters.txt:7)
- #collectables team is distinct from #chatters base team (both are used)

**Port** (generated/data.json):
```json
"team": "#collectables"
```

**Gameplay State Changes**:
- Original: No state grants (pPerformed latch is dialogue-only gate)
- Port: No state changes in Chatter component (dialogue-only)
- **Parity**: ✓ Both are pure dialogue, no stat/inventory/quest changes

---

## Summary

### ✓ CORRECT (Faithful Implementation)

1. **Data structure** (generated/data.json): All properties (rect, team, scriptToPerform, character, etc.) correctly stored
2. **One-fire latch**: Performed boolean correctly gates trigger (pPerformed equivalence)
3. **Mode FSM**: State progression (waiting → talking → finishedTalking) faithful; art-fold intentional K1 narrowing
4. **Script dispatch**: Correctly calls playInGameCutScene(name) with stripped # prefix
5. **Team assignment**: #collectables correctly assigned
6. **No gameplay grants**: Faithful to original (dialogue-only, no stat/inventory/quest changes)

### ✗ GAP=1: Collision Reach Hardcoded (HIGH SEVERITY)

**Issue**: port/src/components/chatter.ts hardcodes TRIGGER_REACH = 320 for all chatters, ignoring per-actor collisionRect from data

**Details**:
- **Original**: Uses each actor's #collisionRect via CollisionCheck(me.big, player)
- **Port**: Uses hardcoded 320 for all chatter types
- **kingStones specifics**:
  - Original rect: rect(-100, -50, 100, 50) → ±100 X, ±50 Y
  - Port reach: ±320 both axes
  - **Result**: 3.2x–6.4x larger trigger zone; ~20.5x larger area
- **Affected**: ALL chatter actors (stones1-10, armySummonStones, goblinRunner, kingStones), but kingStones is most divergent due to smaller rect

**Fix Location**: port/src/components/chatter.ts:17, 53–58
- Read collisionRect from config: `const rect = cfg["collisionRect"]`
- Use per-actor half-width/half-height instead of hardcoded 320
- Maintain backward compat for undefined rect (default to 320 for existing stones)

### ⊘ CONTENT-SCOPE (Not a Gap)

- **rescueKing asset**: Missing from both original and port (intentional K1 narrowing; port ships stones1-10 only)
- **Port dispatch mechanism**: Would work IF asset existed; graceful no-op if missing

---

## Verification Checklist

- [x] Original act_kingStones.txt read and parsed
- [x] Port generated/data.json entry verified for all properties
- [x] Chatter trigger logic reviewed (update() at line 43–51)
- [x] Overlap detection code examined (overlapsPlayer() at line 53–58)
- [x] Hardcoded TRIGGER_REACH constant identified and compared to rect values
- [x] collisionRect rect(-100, -50, 100, 50) confirmed in both sources
- [x] rescueKing cutscene searched in casts/ and port/public/assets/ (not found)
- [x] One-fire latch mechanism verified (performed gate logic)
- [x] Mode FSM progression traced (waiting/talking/finishedTalking)
- [x] Team assignment and gameplay state changes confirmed
- [x] Impact analysis completed (trigger zone area ratio)

---

## Resolution (sweep lead): FIXED — gap was real, now data-driven

The flagged hardcoded ±320 reach was a genuine behavioral gap. Verified the original mechanism:
objChatter.checkForCollisionWithPlayer → CollisionCheck(me.big, player) (objGameObject.txt:271) tests the
player against the chatter's OWN #collisionRect, not a constant. kingStones rect(-100,-50,100,50) is a far
smaller trigger zone than the stones' ±320. FIXED in port/src/components/chatter.ts: the trigger reach is now
derived per-axis from the actor's #collisionRect half-extent + the player edge (12) — kingStones ⇒ ±112 x /
±62 y, armySummonStones ⇒ ±28, stones ⇒ ±332. collisionRect threaded through spawnChatter (objTypes.ts).
Regression test added (phase_k_shell.test.ts: a player inside a stone's box but outside kingStones' box does
NOT trip kingStones; moving into its real zone fires). 366 tests pass, tsc clean, room-1 smoke green.

**Behavioral verdict after fix: CLEAN.**
