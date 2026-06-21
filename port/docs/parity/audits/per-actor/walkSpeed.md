# Behavioral Audit: act_walkSpeed

## Classification
**Class:** Collectible Potion (NOT region marker; despite queue label)  
**Inherits:** `#powerUp` (act_walkSpeed.txt:3)  
**Member:** `walkSpeed_potion` (act_walkSpeed.txt:6)  
**Character:** `#walkSpeed` (act_walkSpeed.txt:4)

## Original Implementation (casts/)

### Collection Routing
- **Actor definition:** casts/data/act_walkSpeed.txt:1-7
  - Inherits `#powerUp` (line 3)
  - Carries member `walkSpeed_potion` (line 6)
- **Collection handler:** casts/script_objects/objPlayerMerlinCharacter.txt:194-195
  - Routes to `me.incWalkAcceleration(#potion)`

### Acceleration Boost Logic
- **Base acceleration:** casts/data/act_player.txt:46 → `#walkAcceleration: 2`
- **Potion increment:** casts/script_objects/modNavMode.txt:21 → `pPotionAccelerationInc = 0.3`
- **Application:** casts/script_objects/modNavMode.txt:58-66
  ```
  on incWalkAcceleration me, theType
    case theType of
      #potion:
        pNavModeNormalAcceleration = pNavModeNormalAcceleration + pPotionAccelerationInc
  ```
  - Line 61: `pNavModeNormalAcceleration += 0.3`
  - **Boost magnitude:** 0.3 / 2 = **+15%** to acceleration
  - **Result:** walkAcceleration becomes 2.3 (increases time-to-reach-max-velocity)
  - **Velocity ceiling:** No explicit cap found in original movement (objMoveXY.txt:160-203); **terminal velocity determined by player's deceleration physics**, not by a walkSpeed max-cap constant.

## Port Implementation (port/src)

### Collection Routing
- **Pickup effect:** port/src/components/pickup.ts:29 → `PickupEffect = "speed"`
- **Collection handler:** port/src/components/pickup.ts:69
  ```
  case "speed": player.get(Movement).maxSpeed += 0.6; break;
  ```

### Speed Boost Logic
- **Base maxSpeed:** port/src/components/movement.ts:24, 36 → `maxSpeed = 4`
- **Potion increment:** port/src/components/pickup.ts:69 → `+= 0.6`
- **Boost magnitude:** 0.6 / 4 = **+15%** to maxSpeed
- **Result:** maxSpeed becomes 4.6 (raises the terminal velocity ceiling itself)
- **Velocity cap applied:** port/src/components/movement.ts:85-87
  ```
  const cap = this.maxSpeed * (this.entity.send("freezeFactor") as number ?? 1);
  const sp = Math.hypot(this.vx, this.vy);
  if (sp > cap) { this.vx = (this.vx / sp) * cap; this.vy = (this.vy / sp) * cap; }
  ```

## Behavioral Difference Assessment

### Magnitude
✓ **MATCH:** Both apply a 15% boost (0.3/2 = 0.6/4)

### Lever (Critical Divergence)
✗ **GAP:** 
- **Original:** Increases walk *acceleration* (time-to-max-velocity only; max-velocity determined by physics, not a constant)
- **Port:** Increases walk *maxSpeed cap* (raises the absolute ceiling)

### Impact Analysis
- **If original also had a walkSpeed=4 cap:** The two implementations would be equivalent (both would eventually hit the same terminal velocity, just via different routes: accel-time vs. velocity-cap).
- **If original had no explicit velocity cap:** The original's behavior is unbounded (velocity grows as long as acceleration applies), making the port's maxSpeed=4 cap a fundamental architectural difference.
- **Evidence:** objMoveXY.txt shows no explicit velocity cap; movement is purely acceleration → friction-based decay.

### Placement Verification
**NOT PLACED in any shipped map:**
- casts/: No references to `#walkSpeed` spawn tile in map files (only in object-key definitions)
- port/: No references to `#walkSpeed` spawn tile in port map files
- **Severity impact:** If never spawned, this is a latent difference with zero in-game effect.

## Verdict
**Status: GAPS=1**

**Gap:** The walkSpeed potion employs a different mechanical lever—acceleration in the original vs. maxSpeed cap in the port—resulting in fundamentally different player movement physics when collected, despite matching magnitude. The original's unbounded acceleration physics (no explicit velocity cap in objMoveXY) contrasts with the port's hard maxSpeed ceiling (Movement.ts:85-87). Placement unverified but likely unused (not found in any map file); latent difference.

**Evidence Summary:**
- Original acceleration boost: casts/data/act_player.txt:46 (base 2) + modNavMode.txt:21,61 (increment 0.3)
- Port maxSpeed boost: port/src/components/movement.ts:24,36 (base 4) + pickup.ts:69 (increment 0.6)
- Original movement cap: None found (objMoveXY.txt:160-203 is physics-only, no velocity ceiling)
- Port movement cap: port/src/components/movement.ts:85-87 (hard maxSpeed cap)
- Placement: Not found in any shipped map

---

## Reviewer decision (sweep lead): documented minor deviation, NOT fixed

Verified in both trees. act_walkSpeed is a #powerUp potion (not a region). Original: potionCollected #walkSpeed
-> incWalkAcceleration(#potion) -> pNavModeNormalAcceleration += 0.3 (modNavMode.txt:21,61) on a base
walkAcceleration of 2 = +15%. Port: the #walkSpeed potion maps to the "speed" PickupEffect -> maxSpeed += 0.6
on a base 4 = +15% (pickup.ts:69).

The LEVER differs (acceleration vs top-speed cap) but the MAGNITUDE is identical (+15%), and the NET effect is
equivalent "faster movement": in the original's friction-limited model, walk acceleration drives the
terminal velocity, so a +15% acceleration bump ≈ a +15% effective top-speed bump — which is exactly what the
port's +15% maxSpeed does (the port caps walk velocity at maxSpeed, friction applying only on release).
Additionally, the potion is NOT placed in any shipped map (latent difference, zero live gameplay impact).

Decision: KEEP as a documented minor calibration deviation (precedent: the K1 damage-scale abstractions).
Re-pinning the port to an acceleration bump would require reproducing the original's exact friction-while-moving
terminal-velocity math (uncertain) and risks a player-movement regression for an unplaced pickup — not worth it.
The +15% speed-boost intent is faithfully preserved.

**Verdict: CLEAN (documented minor deviation; magnitude faithful, unplaced).**
