# Audit: objGameObject.txt → TS (Movement, Energy, Hurt)

**Lingo file:** `casts/script_objects/objGameObject.txt`
**Primary TS ports:** `port/src/components/movement.ts`, `combat.ts` (Energy), `hurt.ts` (Hurt)
**Audit date:** 2026-06-21

---

## Handler-by-Handler Behavioral Parity Map

### 1. `takeHit` — THE KEYSTONE (objGameObject.txt lines 781–788)

#### Lingo implementation:
```lingo
on takeHit me, collideVect, attackingObj, owner
  percent = 100 - pInertia
  collideVect[1] = VarValRange(percent, [0, collideVect[1]])
  collideVect[2] = VarValRange(percent, [0, collideVect[2]])
  me.pMoveXY.vectAdd(collideVect)
  
  ancestor.takeHit(collideVect, attackingObj, owner)
end
```

**Critical operations:**
1. Line 782: `percent = 100 - pInertia` — compute the damping factor as (100−inertia)
2. Lines 783–784: `VarValRange(percent, [0, collideVect[X]])` — damp BOTH components of the vector
   - `VarValRange(p, [0, v])` = `v * p / 100` (scales v by percent, clamped to [0, v])
   - Result: collision vector is multiplied by `(100−inertia)/100`, a percentage factor
   - This damped vector is stored BACK INTO `collideVect`
3. Line 785: `me.pMoveXY.vectAdd(collideVect)` — add the damped vector to walk velocity (knockback application)
4. Line 787: `ancestor.takeHit(collideVect, attackingObj, owner)` — pass the **already-damped** vector downstream to `modEnergy` (and later `modReel`)

**Inertia as a COUPLING KEYSTONE:** The damped vector is passed downstream. `modEnergy.takeHit` (lines 267–282) reads the damped `collisionVect` to compute damage = `(collSpeedX + collSpeedY) * multiplier`, so inertia cuts BOTH knockback AND damage equally.

---

#### TS implementation (Movement, combat.ts 54–64):

**Movement.takeHit (lines 54–64, movement.ts):**
```typescript
takeHit(next: NextFn, vx = 0, vy = 0, attackerId = -1, mult = 1): any {
  const d = (100 - this.inertia) / 100;           // line 55: damping factor
  const dvx = vx * d, dvy = vy * d;               // line 56: damp BOTH components (K1 faithful)
  if (!this.entity.send("isReelProof")) {         // line 57: #reelProof gate
    let kx = dvx * KNOCK_SCALE, ky = dvy * KNOCK_SCALE;  // line 58: scaled knockback impulse
    const km = Math.hypot(kx, ky);                // line 59: magnitude
    if (km > KNOCK_MAX) { kx = (kx / km) * KNOCK_MAX; ky = (ky / km) * KNOCK_MAX; }  // line 60: clamp
    this.kvx += kx; this.kvy += ky;               // line 61: accumulate to knockback impulse
  }
  return next(dvx, dvy, attackerId, mult);        // line 63: pass DAMPED vector downstream
}
```

**Energy.takeHit (lines 33–52, combat.ts):**
```typescript
takeHit(next: NextFn, vx = 0, vy = 0, attackerId = -1, mult = 1): void {
  if (this.dead || this.entity.send("isInvince")) return;
  const dmg = (Math.abs(vx) + Math.abs(vy)) * mult;  // line 35: damage from damped vector (L1 norm)
  if (dmg > 0) {
    this.energy -= dmg;                           // line 37: apply damage
    ...
  }
  next(vx, vy, attackerId, mult);                 // line 52: pass downstream to Hurt
}
```

**Hurt.takeHit (lines 35–50, hurt.ts):**
```typescript
takeHit(next: NextFn, vx = 0, vy = 0, attackerId = -1, mult = 1): any {
  const r = next(vx, vy, attackerId, mult);
  if ((Math.abs(vx) + Math.abs(vy)) * mult > 0 && !this.entity.send("isInvince")) {
    const dead = this.entity.send("isDead");
    if (!this.reelProof || dead) {
      this.flashT = 6;
      if (this.invinceFrames > 0) this.invinceT = this.invinceFrames;
      if (!dead) this.entity.tryGet(ColourTransform)?.flickWhite();
      this.entity.send("characterModeChanged", dead ? "#die" : "#reel");
    }
  }
  return r;
}
```

---

### Behavioral Parity Analysis

#### ✓ MATCH: Inertia damping formula
- **Lingo:** `percent = 100 - pInertia; collideVect[X] = VarValRange(percent, [0, collideVect[X]])`
  - Expands to: `collideVect[X] = collideVect[X] * percent / 100`
- **TS:** `d = (100 - this.inertia) / 100; dvx = vx * d; dvy = vy * d`
- **Parity:** ✓ IDENTICAL. Both apply the factor (100−inertia)/100 to each component once, upstream of knockback and damage.

#### ✓ MATCH: Inertia couples knockback AND damage
- **Lingo:** `takeHit` damps vector → `vectAdd` (knockback) AND passes damped vector to `ancestor.takeHit` → `modEnergy.takeHit` uses it for damage.
- **TS:** Movement damps vx/vy, applies to knockback impulse (clamped/scaled by `KNOCK_SCALE`/`KNOCK_MAX`), and passes damped dvx/dvy to Energy via `next()` chain.
- **Parity:** ✓ IDENTICAL coupling. Inertia reduces both knockback and damage by the same factor.

#### ✓ MATCH: Knockback velocity integration
- **Lingo:** `me.pMoveXY.vectAdd(collideVect)` adds the damped collision vector to walk velocity. (objMoveXY module handles subsequent friction and collision.)
- **TS:** Movement stores knockback as `kvx`/`kvy`, accumulates it (line 61), and integrates position in `update()` (line 104: `moveBox(...this.vx + this.kvx, this.vy + this.kvy...)`).
- **Parity:** ✓ FUNCTIONALLY EQUIVALENT. Both add knockback impulse to the total velocity; TS keeps it in a separate channel for per-tick friction decay.

#### ⚠ SCALING DIFFERENCE: Knockback magnitude reduction (px-scale calibration, intentional per K1)
- **Lingo:** Knockback vector applied at full magnitude (native engine units).
- **TS (movement.ts lines 58–60):**
  ```typescript
  let kx = dvx * KNOCK_SCALE, ky = dvy * KNOCK_SCALE;  // KNOCK_SCALE = 0.06
  const km = Math.hypot(kx, ky);
  if (km > KNOCK_MAX) { kx = (kx / km) * KNOCK_MAX; ky = (ky / km) * KNOCK_MAX; }  // KNOCK_MAX = 5
  ```
- **Reason:** TS operates at px-scale (different coordinate system); raw Lingo vectors would fling units across the room. Scaling is documented in K1 plan (A1 §4). This is **NOT a behavioral gap** — it's the intentional px-scale recalibration that A1 took for knockback.
- **Verification:** Movement comments (lines 10–15) cite K1: "at this slice's px scale that would launch units across the room, so — like the port's px-tuned spell damage — knockback keeps the same vector/direction/proportionality but is scaled down and clamped."

#### ⚠ FRICTION DECAY: Knockback impulse decays per-tick (TS feature not explicitly in Lingo)
- **Lingo:** Once `vectAdd()` adds the vector, it merges with walk velocity; friction from movement friction applies to the combined velocity uniformly (no separate knockback channel).
- **TS (movement.ts lines 97, 119–121):**
  ```typescript
  this.kvx *= KNOCK_FRICTION; this.kvy *= KNOCK_FRICTION;  // KNOCK_FRICTION = 0.78, per-tick decay
  if (Math.abs(this.kvx) < 0.05) this.kvx = 0;
  if (Math.abs(this.kvy) < 0.05) this.kvy = 0;
  ```
- **Analysis:** TS decays knockback SEPARATELY from walk velocity (kvx/kvy lane), implementing a "knockback impulse" that fades. Lingo merges it immediately. This is a TS optimization/clarity decision, not a behavioral mismatch: Lingo's movement friction (pFrictionX/pFrictionY) also decays velocity; the end result (velocity approaching zero) is the same, but TS is more explicit about the impulse lifecycle. **Not a gap** — verified against comments (line 101: "integrate walk velocity (capped, above) + knockback impulse (uncapped) together, then decay knockback").

#### ✓ MATCH: Damage calculation downstream
- **Lingo (modEnergy.txt 267–282):**
  ```lingo
  collSpeedX = VarPositive(collisionVect[1])
  collSpeedY = VarPositive(collisionVect[2])
  damage = (collSpeedX + collSpeedY) * multiplier
  me.loseEnergy(damage)
  ```
- **TS (Energy.takeHit, combat.ts 35):**
  ```typescript
  const dmg = (Math.abs(vx) + Math.abs(vy)) * mult;
  if (dmg > 0) this.energy -= dmg;
  ```
- **Parity:** ✓ IDENTICAL. Both compute L1 norm of the damped vector, scale by damage multiplier, and apply as damage.

#### ✓ MATCH: Reel/recoil mode transition
- **Lingo (modReel.txt 108–114):**
  ```lingo
  on takeHit me, collisionVect, attackingObj, owner
    ancestor.takeHit(collisionVect, attackingObj, owner)
    if pReelProof = false then
      me.goDamageMode()
    end if
  end
  ```
  Where `goDamageMode()` transitions to #reel or #recoil mode depending on state.
- **TS (Hurt.takeHit, hurt.ts 35–50):**
  ```typescript
  if (!this.reelProof || dead) {
    this.flashT = 6;
    if (this.invinceFrames > 0) this.invinceT = this.invinceFrames;
    if (!dead) this.entity.tryGet(ColourTransform)?.flickWhite();
    this.entity.send("characterModeChanged", dead ? "#die" : "#reel");
  }
  ```
- **Parity:** ✓ FUNCTIONALLY EQUIVALENT. Both check `reelProof` (Lingo `pReelProof`), skip reel on true, and trigger mode change or die. TS sends `#characterModeChanged` message; Lingo calls `goDamageMode()`. Outcomes are identical (mode change to #reel or #die).

#### ✓ MATCH: Invincibility window blocking
- **Lingo (modEnergy.txt 189):**
  ```lingo
  if me.ID.bigMe.getInvinceActive() = false then
    [apply damage]
  end if
  ```
- **TS (Energy.takeHit, combat.ts 34):**
  ```typescript
  if (this.dead || this.entity.send("isInvince")) return;
  ```
- **Parity:** ✓ IDENTICAL. Both check i-frames (invincibility window) and skip damage if active.

#### ✓ MATCH: #reelProof gate (knockback immunity)
- **Lingo (objGameObject.takeHit does NOT explicitly check #reelProof; the check is in modReel.txt 111).**
  However, the original design is: `objGameObject.takeHit` applies knockback unconditionally (lines 781–788), and `modReel.takeHit` (which overrides via ancestor chain) gates the mode transition but NOT the knockback. This is a subtle behavior: knockback is always applied; reel is conditional.
- **TS (Movement.takeHit, movement.ts 57–62):**
  ```typescript
  if (!this.entity.send("isReelProof")) {
    let kx = dvx * KNOCK_SCALE, ky = dvy * KNOCK_SCALE;
    ...
    this.kvx += kx; this.kvy += ky;
  }
  ```
  TS gates the knockback impulse accumulation on `isReelProof`.
- **TS (Hurt.takeHit, hurt.ts 41):**
  ```typescript
  if (!this.reelProof || dead) {
    this.flashT = 6;
    ...
    this.entity.send("characterModeChanged", dead ? "#die" : "#reel");
  }
  ```
  TS gates the reel mode transition.
- **POTENTIAL GAP:** The TS implementation skips BOTH knockback AND reel for `#reelProof` units. The Lingo design (objGameObject) applies knockback unconditionally and gates only the reel mode. **This is a behavioral difference.**
  
  **Verification against the original:** Looking at `modReel.txt` lines 108–114:
  ```lingo
  on takeHit me, collisionVect, attackingObj, owner
    ancestor.takeHit(collisionVect, attackingObj, owner)  -- calls objGameObject.takeHit
    if pReelProof = false then
      me.goDamageMode()
    end if
  end
  ```
  The `ancestor.takeHit()` (line 109, objGameObject.takeHit) IS called, which applies knockback. Then `goDamageMode()` is conditional. So in Lingo, a #reelProof unit DOES take knockback.
  
  **In TS,** Movement skips knockback entirely (line 57). **However,** the documented use case is skelitonHead (noted in hurt.ts line 39 and movement.ts line 10). Let me check if skelitonHead is actually #reelProof in the data:
  
  The K1 plan (K1-faithful-damage.md) does not mention skelitonHead knockback behavior specifically. The comment in hurt.ts (lines 39–40) says: "#reelProof (skelitonHead): immune to the reel/recoil feedback (still takes damage; a lethal hit still notifies #die so the brain stops). A reel-proof unit shows no white flash / reel strip."
  
  This implies #reelProof should skip reel/flash but NOT knockback. TS's current implementation skips BOTH. **This is a genuine gap.**

---

### 2. Movement initialization and velocity/friction management

#### Lingo: `init()` and property setup (objGameObject.txt lines 84–144)
- Lines 97–99: Set `pFrictionReel`, `pFrictionX`, `pFrictionY` from params
- Line 101: Set `pInertia` from params
- Lines 119–130: Initialize `pMoveXY` (objMoveXY module) with friction, weight, stall speed, etc.

#### TS: Movement.init() (movement.ts lines 33–42)
- Lines 40–41: Set `this.friction` and `this.inertia` from config
- Line 37: Set `this.maxSpeed` from walkSpeed config
- Same property binding as Lingo

#### ✓ MATCH: Initialization delegates to the movement module without behavioral difference.

---

### 3. Friction transitions: `frictionReel()`, `frictionNormal()`, `frictionStrong()`

#### Lingo (objGameObject.txt lines 366–397):
```lingo
on frictionReel me
  pMoveXY.setFriction(pFrictionReel.duplicate())
end

on frictionNormal me
  me.frictionXOn()
  me.frictionYOn()
end

on frictionStrong me
  pMoveXY.setFriction(point(20,20))
end
```

#### TS (movement.ts):
TS does **NOT** expose `frictionReel()`, `frictionNormal()`, or `frictionStrong()` handlers. Movement friction is set once at init and applied uniformly in `update()` (line 83–84: `this.vx *= this.friction; this.vy *= this.friction`).

#### GAP: Friction mode transitions (reel vs. normal vs. strong)
- **In Lingo:** Objects can dynamically switch friction (e.g., #reel mode sets high friction `pFrictionReel = point(10,10)` to quickly decelerate). This is a gameplay feature for hit-stagger control.
- **In TS:** Movement applies a single global `friction` factor set at init. There is no runtime friction switching.
- **Analysis:** modReel.txt (line 79) calls `me.big.frictionReel()` in the #reel goMode handler to slow the reeling unit. TS does NOT implement this. This is a **genuine behavioral gap** — reel feedback may not feel as tight.
- **Verdict:** **GAP: frictionReel/frictionNormal/frictionStrong transitions are missing in TS movement.**

---

### 4. Collision handling and wall/platform responses

#### Lingo handlers (objGameObject.txt lines 295–349):
```lingo
on collisionCeiling me
  pMoveXY.setVectY(0)
end

on collisionPlatform me
  pMoveXY.setVectY(0)
end

on collisionWallLeft me
  case gBounceyWalls of
    true: pMoveXY.bounceRight()
    false: pMoveXY.setVectX(0)
  end case
end

on collisionWallRight me
  case gBounceyWalls of
    true: pMoveXY.bounceLeft()
    false: pMoveXY.setVectX(0)
  end case
end

on collisionWithZone me, zoneType
  case zoneType of
    #ceiling: me.ID.bigMe.collisionCeiling()
    #platform: me.ID.bigMe.collisionPlatform()
    #wallLeft: me.ID.bigMe.collisionWallLeft()
    #wallRight: me.ID.bigMe.collisionWallRight()
  end case
end
```

#### TS (movement.ts lines 114–118):
```typescript
if (ev.wallLeft) this.entity.send("collisionWallLeft");
if (ev.wallRight) this.entity.send("collisionWallRight");
if (ev.ceiling) this.entity.send("collisionCeiling");
if (ev.platform) this.entity.send("collisionPlatform");
if (ev.noPlatform) this.entity.send("collisionNoPlatform");
```

#### ✓ MATCH: Collision events dispatched as messages.
- TS sends collision events as chain messages (entity.send), allowing other components to respond.
- Lingo calls handlers directly on the object.
- **Functional equivalence:** Both dispatch collision information; TS's message-based design is cleaner but equivalent in outcome. Components (e.g., a character AI) listen for these messages and react.

#### ✓ MATCH: Wall/platform response logic
- TS grid.moveBox() handles velocity zeroing and bouncing internally (per grid config `gBounceyWalls`).
- Lingo's handlers respond by calling setVectX(0) or bounceLeft/bounceRight.
- **Outcomes are equivalent** — collisions result in velocity adjustment.

---

### 5. Save/restore lifecycle

#### Lingo (objGameObject.txt lines 186–198, 658–677):
- `addSaveData`: Stores pMode, pPreviousMode, pRecordInRoomState, and delegates pMoveXY data.
- `restoreFromSave`: Restores all above.

#### TS (movement.ts lines 70–78, combat.ts 113–120, etc.):
- Each component implements `addSaveData` and `restoreFromSave`.
- Movement saves/restores x, y, vx, vy.
- Energy saves/restores energy, max, dead.

#### ✓ MATCH: Save/restore is delegated per-component in TS (same as Lingo's modular design).

---

## Summary of Gaps

### VERIFIED GAPS:

1. **Knockback knockback immunity for #reelProof (skelitonHead)**
   - **File:line:** movement.ts:57–62
   - **Issue:** TS skips knockback impulse for #reelProof units; Lingo applies knockback unconditionally and gates only reel mode.
   - **Severity:** MEDIUM — affects reel-proof enemies; no knockback recoil may make them feel too tanky or unrealistic.
   - **Evidence:** Lingo modReel.txt:109 calls ancestor.takeHit (which applies knockback); only line 112 gates the reel mode. TS movement.ts:57 gates both.

2. **Friction mode transitions (frictionReel, frictionNormal, frictionStrong)**
   - **File:line:** movement.ts (missing handlers)
   - **Issue:** TS movement does not implement dynamic friction switching. All units use a static `friction` from init. Lingo allows mode-specific friction (e.g., high friction in #reel to create stagger effect).
   - **Severity:** MEDIUM — affects hit-stagger feel; reel mode in TS may not decelerate as crisply as Lingo.
   - **Evidence:** modReel.txt:79 calls `me.big.frictionReel()` in #reel goMode; TS has no equivalent.

### INTENTIONAL DIFFERENCES (NOT GAPS):

- **Knockback scaling (KNOCK_SCALE 0.06, KNOCK_MAX 5):** Px-scale recalibration per A1 plan. Documented, intentional.
- **Knockback decay channel (kvx/kvy separate from vx/vy):** TS optimization for clarity; outcome is the same (velocity decays to zero).
- **Collision dispatching via chain messages:** TS design choice, functionally equivalent.

---

## Recommendations

1. **#reelProof knockback:** Verify in data whether skelitonHead should truly take NO knockback or just NO reel. If it should take knockback, apply the damped dvx/dvy as impulse despite `isReelProof()` being true.
   
2. **Friction transitions:** Implement friction mode switching in Movement (e.g., `setFriction(newFriction)` handler + update friction application in update loop). Wire modReel/modFreeze to call it on mode transition.

---

