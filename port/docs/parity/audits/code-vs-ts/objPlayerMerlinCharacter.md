# Audit: objPlayerMerlinCharacter.txt vs TypeScript Port

**File**: `casts/script_objects/objPlayerMerlinCharacter.txt`  
**Date**: 2026-06-21  
**Scope**: Handler-by-handler behavioral parity for player pickups, respawn, and collectible effects.

---

## Handler Mapping: Lingo → TypeScript

| Lingo Handler | Lingo Location | TS Component | TS Location | Status |
|---|---|---|---|---|
| `medikitCollected` | 152–160 | `Pickup.apply` (heal branch) | pickup.ts:65 | PARTIAL |
| `newScrollCollected` | 163–172 | `Pickup.apply` (scroll branches) | pickup.ts:70,77,85,88 | PARTIAL |
| `potionCollected` | 183–203 | `Pickup.apply` (mana branches) | pickup.ts:90–92 | PARTIAL |
| `respawn` | 205–212 | `ExtraLives.respawn` | extraLives.ts:37–42 | OK |
| `startTempInvince` call | 152,170,199 | (seeking target) | — | MISSING |

---

## Detailed Analysis

### 1. medikitCollected Handler (Lingo 152–160)

**Lingo code:**
```lingo
on medikitCollected me, medType
  me.startTempInvince()
  if(medType = #medikit) then
    ancestor.medikitCollected()
    me.increaseEnergy(pBonusEnergy)
  else
    me.increaseEnergy(me.getMaxEnergy() - me.getenergy())
  end if
end
```

**TS mapping: Pickup.apply, case "heal" (pickup.ts:65–68)**
```typescript
case "heal": player.send("medikitCollected", 1); break;
// ...
if (this.effect !== "maxikit" && this.effect !== "gmg") player.send("takeHeal", 12.5, 0, -1);
```

**Comparison:**
- **#medikit branch** (line 154–156):
  - Lingo: calls `ancestor.medikitCollected()` + `increaseEnergy(pBonusEnergy=25)` ✓
  - TS: calls `player.send("medikitCollected", 1)` + `player.send("takeHeal", 12.5, 0, -1)` (= +25 via 12.5×2) ✓
  - Medikit component (medikit.ts:28) banks the kit; Hurt component provides i-frames on next hit
  - **FIXED #8 (documented)**: TS bypasses per-frame heal drip, banks instead; heal-per-use equivalent ✓

- **#maxikit branch** (line 157–159):
  - Lingo: `increaseEnergy(getMaxEnergy() - getEnergy())` = instant full heal ✓
  - TS: `player.send("takeHeal", 1e9, 0, -1)` (= instant full heal via huge value) ✓
  - **Note**: TS maxikit does NOT get +25 bonus (line 98 excludes "maxikit") ✓

- **Invincibility (line 153)**:
  - Lingo: `me.startTempInvince()` ✓
  - TS: **NOT called** ✗

**Gap Severity**: **CRITICAL** — collecting heal/maxikit does NOT grant temporary invincibility frames in the port.

---

### 2. newScrollCollected Handler (Lingo 163–172)

**Lingo code:**
```lingo
on newScrollCollected me, scrollType, theAttack
  if scrollType <> #gmg then
    me.addWeapon(scrollType, theAttack)
    me.increaseEnergy(pBonusEnergy)
  else
    me.gmgCollected()
  end if
  me.startTempInvince()
end
```

**TS mapping: Pickup.apply, scroll/spell/gmg branches (pickup.ts:70–88)**
```typescript
case "sword": player.get(PlayerControl).equipSword(scrollAttack("sword")); break;
// ... other spells ...
case "gmg": player.get(PlayerControl).gmgCollected(); break;
// ...
if (this.effect !== "maxikit" && this.effect !== "gmg") player.send("takeHeal", 12.5, 0, -1);
```

**Comparison:**
- **Non-#gmg scrolls** (line 164–166):
  - Lingo: `addWeapon(scrollType, theAttack)` + `increaseEnergy(pBonusEnergy=25)` ✓
  - TS: `equipSword()` or `grantSpell()` (adds to WeaponManager) + `takeHeal(12.5, 0, -1)` ✓
  - Both award +25 health on pickup ✓

- **#gmg scroll** (line 167–168):
  - Lingo: `me.gmgCollected()` (no +25 bonus implied in the control.txt #gmg branch) ✓
  - TS: `player.get(PlayerControl).gmgCollected()` + NO `takeHeal` (excluded line 98) ✓

- **Invincibility (line 170)**:
  - Lingo: `me.startTempInvince()` ✓
  - TS: **NOT called** ✗

**Gap Severity**: **CRITICAL** — collecting scrolls/spells/GMG does NOT grant temporary invincibility frames.

---

### 3. potionCollected Handler (Lingo 183–203)

**Lingo code:**
```lingo
on potionCollected me, character, thePotion
  case character of
    #manaBurst:
      me.incManaBurstPotion()
    #manaCapacity:
      me.incManaCapacityPotion()
    #manaFlow:
      me.incManaFlowPotion()
    #walkSpeed:
      me.incWalkAcceleration(#potion)
  end case
  
  me.startTempInvince()
  me.increaseEnergy(pBonusEnergy)
  g.potionMaster.potionCollected(thePotion)
end
```

**TS mapping: Pickup.apply, potion/speed branches (pickup.ts:69,90–92)**
```typescript
case "speed": player.get(Movement).maxSpeed += 0.6; break;
case "manaCapacity": player.get(Mana).incCapacity(); break;
case "manaFlow": player.get(Mana).incFlow(); break;
case "manaBurst": player.get(Mana).incBurst(); break;
```

**Comparison:**
- **#manaBurst** (line 185–186):
  - Lingo: `me.incManaBurstPotion()` ✓
  - TS: `player.get(Mana).incBurst()` ✓
  - Both increment by 0.75 (mana.ts:44) ✓

- **#manaCapacity** (line 188–189):
  - Lingo: `me.incManaCapacityPotion()` ✓
  - TS: `player.get(Mana).incCapacity()` ✓
  - Both increment by 0.75 (mana.ts:42) ✓

- **#manaFlow** (line 191–192):
  - Lingo: `me.incManaFlowPotion()` ✓
  - TS: `player.get(Mana).incFlow()` ✓
  - Both increment by 0.5 (mana.ts:43) ✓

- **#walkSpeed** (line 194–195):
  - Lingo: `me.incWalkAcceleration(#potion)` (documented as minor deviation in PLAN_REVIEW §g.6)
  - TS: `player.get(Movement).maxSpeed += 0.6` ✓
  - **DOCUMENTED DEVIATION**: +0.6 is a fixed lever instead of engine scaling; accepted difference ✓

- **Invincibility (line 199)**:
  - Lingo: `me.startTempInvince()` ✓
  - TS: **NOT called** ✗

- **+25 bonus (line 200)**:
  - Lingo: `me.increaseEnergy(pBonusEnergy)` ✓
  - TS: `player.send("takeHeal", 12.5, 0, -1)` (line 98) ✓

- **potionMaster tally (line 202)**:
  - Lingo: `g.potionMaster.potionCollected(thePotion)` ✓
  - TS: `game.potionMaster?.potionCollected(this.effect)` (line 62) ✓

**Gap Severity**: **CRITICAL** — collecting potions does NOT grant temporary invincibility frames.

---

### 4. respawn Handler (Lingo 205–212)

**Lingo code:**
```lingo
on respawn me
  -- called by modExtraLives
  me.setWeight(pAliveWeight)
  me.goMode(#fall)
  me.pAI.restorePlayerControl()
  
  ancestor.respawn()
end
```

**TS mapping: ExtraLives.respawn + Movement (extraLives.ts:37–42)**
```typescript
respawn(next: NextFn): void {
  const m = this.entity.get(Movement);
  m.x = this.respawnX; m.y = this.respawnY; m.vx = m.vy = 0; m.kvx = m.kvy = 0;
  this.entity.send("reviveFull"); // clear the dead latch + refill energy
  this.lives--;
  next();
}
```

**Comparison:**
- **setWeight(pAliveWeight)** (line 207):
  - Lingo: restore alive weight (gravity normal)
  - TS: No explicit call; gravity is managed by objCharacter hierarchy
  - TS relies on Movement's live state; functionally equivalent ✓

- **goMode(#fall)** (line 208):
  - Lingo: enter fall mode (gravity active)
  - TS: No explicit call; reviveFull sets dead=false, so next update respects gravity
  - Functionally equivalent (gravity resumes) ✓

- **pAI.restorePlayerControl()** (line 209):
  - Lingo: enable player input
  - TS: No explicit call; PlayerControl is always active post-reviveFull
  - Functionally equivalent ✓

- **ancestor.respawn()** (line 211):
  - TS: `reviveFull()` (clear dead flag + reset energy) ✓

- **setLoc(respawnX/Y)** (line 208 implicit, extraLives):
  - TS: `m.x = this.respawnX; m.y = this.respawnY` ✓

- **Velocity reset**:
  - Lingo: implicit via mode change
  - TS: `m.vx = m.vy = 0; m.kvx = m.kvy = 0` (explicit) ✓

- **lives--** (line 206 implicit):
  - TS: `this.lives--` ✓

**Status**: ✓ **OK** — respawn behavior is equivalent.

---

## Identified Gaps Summary

### Gap 1: Missing Temporary Invincibility on Pickup Collection (CRITICAL)

**Affected handlers**: `medikitCollected`, `newScrollCollected`, `potionCollected`

**Evidence**:
- **Lingo**: All three handlers call `me.startTempInvince()` immediately upon collection
  - Line 153 (medikit)
  - Line 170 (scroll)
  - Line 199 (potion)

- **TS**: No invincibility triggered on pickup collection
  - `Pickup.apply()` calls `player.send("medikitCollected", ...)` / `takeHeal(...)` / equipment methods
  - None of these messages trigger a temporary invincibility frame window
  - Hurt component has `invinceFrames=18` (archetypes.ts) but is only set on `takeHit`, not on `medikitCollected`/scroll/potion

**Behavioral consequence**:
- In the original, collecting a potion/scroll grants ~0.3s (18 frames @ 60fps) of invincibility, preventing overlapping enemies from chain-killing the player on collection.
- In the port, collecting a potion/scroll provides **NO i-frames**, leaving the player vulnerable to immediate re-hit.

**Severity**: **CRITICAL** — this is a tangible gameability regression. Players can be instantly killed on pickup collection in dense enemy clusters.

---

### Non-Gaps Verified (Correct)

1. **+25 bonus on medikit/scroll/potion collection** (Lingo 54, 156, 166, 200)
   - TS: `player.send("takeHeal", 12.5, 0, -1)` = +25 ✓

2. **Maxikit instant full heal** (Lingo 158)
   - TS: `player.send("takeHeal", 1e9, 0, -1)` ✓
   - Exclusion from +25 bonus (TS line 98) ✓

3. **Mana potion increments** (Lingo 186, 189, 192, 195)
   - TS: `incCapacity()/incFlow()/incBurst()` with correct deltas (0.75/0.5/0.75) ✓

4. **Respawn restoration** (Lingo 205–212)
   - TS: Energy/location/velocity reset via `reviveFull()`/Movement ✓

5. **GMG mode acquisition** (Lingo 168)
   - TS: `PlayerControl.gmgCollected()` + excluded from +25 bonus ✓

6. **potionMaster tally** (Lingo 202)
   - TS: `game.potionMaster?.potionCollected(this.effect)` ✓

---

## Recommendation

**Implement temporary invincibility on pickup collection:**

The fix requires modifying `Pickup.apply()` in `port/src/components/pickup.ts` to call invincibility-setting logic after collection. Options:

1. **Route through takeHit**: Call `player.send("takeHit", 0, 0, -1)` to arm i-frames without damage.
2. **Direct Hurt message**: Implement a `startTempInvince()` message handler in Hurt that sets `invinceT = invinceFrames`.
3. **Pickup-specific flag**: Add a `justCollected` flag that Hurt checks on the next frame.

**Recommended approach**: Option 2 (direct message) — cleanest, mirrors the Lingo design.

---

## Summary

**FILE=objPlayerMerlinCharacter | GAPS=1 | Missing temporary invincibility on ALL pickup collection (medikit/scroll/potion)**
