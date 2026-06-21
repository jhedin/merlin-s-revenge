# Behavioral Audit: act_boulderMonster

**Audit Date:** 2026-06-21  
**Focus:** Behavioral correctness vs. original Lingo implementation

---

## Summary

**Status:** 1 BEHAVIORAL DIVERGENCE FOUND

boulderMonster's core archetype, team, attack type, and projectile all resolve correctly. However, the port's cooldown calculation for zero-cooldown attacks diverges from the original behavior.

---

## Verified Correctness

### Archetype & AI Type
- ✓ `objType: #objCPUCharacter` → `EnemyArchetype` (correct)
- ✓ `AiType: #objAiCPU` → `CpuAI` component with standard committed-target FSM (correct)

### Attack Classification
- ✓ `animType: #naturalRanged` → correctly identified as `ranged = true` (line 169-170, archetypes.ts)
- ✓ Ranges from melee (reach=22 default) to ranged (`reachRanged=150` default), then capped at line 356: `this.reachRanged = Math.min(220, Math.max(60, cfg["atkReach"]))`
- ✓ Attack reach from data: 220 → correctly applied
- ✓ Firing behavior: ranged CPU will `moveToAttack` to within reach, then fire the projectile (CpuAI.updateMoveToAttack, line 454-455)

### Projectile Resolution
- ✓ `bullet: #boulder` → resolves to `act_boulder` (verified in generated/data.json)
- ✓ Boulder actor exists with valid attack data (damageMultiplier: 1, power: 2)
- ✓ Bullet is fired via CpuAI.attack → attackRanged branch (control.ts line 70)

### Team & Targeting
- ✓ `team: #monsters` → correctly set (archetypes.ts line 260)
- ✓ Default targeting allegiance: `#enemy` (archetypes.ts line 284)
- ✓ Default target roles: `["#teamMembers", "#teamBuildings"]` (archetypes.ts line 286)

### Stats
- ✓ `energy: 400` → passed through (archetypes.ts line 258)
- ✓ `strength: 12` → used for power calculation (archetypes.ts line 339-341)
- ✓ `inertia: 50` → knockback resistance (archetypes.ts line 262)
- ✓ `dexterity: 10` → used for ranged cooldown counter inc (archetypes.ts line 174)
- ✓ `walkSpeed: 1` → converted to px/tick via `* 0.6` multiplier (archetypes.ts line 257)
- ✓ `experienceImWorth: 50` → XP on death (archetypes.ts line 290)

### Death & Reincarnation
- ✓ No `reincarnateAs` or `reincarnateInto` in data → correctly omitted (archetypes.ts line 295-296)
- ✓ `dieSound: "boulder_die"` → passed through (archetypes.ts line 289)
- ✓ No `minEnergy` → standard death at 0 energy

### Special Flags
- ✓ `wizard: false` (not present in data) → no wizard behavior
- ✓ `ghost: false` → no ghost possession FSM
- ✓ `multiAttack: false` → single weapon, standard attack
- ✓ `builder: false` → no builder/dwelling logic
- ✓ `leaveWhenFinished: false` → no special exit
- ✓ `reelProof: false` → knockback reel feedback enabled

---

## DIVERGENCE: Attack Cooldown for Zero-Cooldown Ranged Attack

### Issue
The original attack has `cooldown: 0`, meaning it can fire EVERY frame (always ready). The port's cooldown calculation converts this to a non-zero effective cooldown, delaying the attack.

### Original Behavior
**Source:** `casts/data/act_boulderMonster.txt` line 12: `#cooldown: 0`

In the original, modWeaponManager.addCooldownCounter (casts/script_objects/modWeaponManager.txt):
```lingo
c.tim[2] = theAttack.cooldown        -- c.tim[2] = 0
c.inc = me.big.getDexterity()        -- c.inc = 10
Counter logic (casts/general_functions/Counter.txt lines 5-7):
  if theC.tim[1] = theC.tim[2] then
    theC.fin = true                  -- Immediate: fin = true when both = 0
```

**Result:** Counter.fin is true immediately, weapon is always ready. boulderMonster fires every frame.

### Port Behavior
**Source:** `port/src/entities/archetypes.ts` lines 180-188:
```typescript
const rawCooldown = 0;  // from data
const framesWanted = Math.max(1, rawCooldown + 18) = 18;  // ranged: +18
const counterInc = dexterity = 10;
const effectiveCooldown = Math.round(18 * 10 + 1) = 181;
```

**Result:** effectiveCooldown = 181 frames. WeaponManager creates a cooldown counter with `max = 181`, so the weapon needs 181 frames (at inc=10) to recover. boulderMonster fires every ~18 frames (181 / 10), not every frame.

### Consequence
**Attack rate is ~10x slower in the port** (181 frame cooldown vs. 0 frame original).

The formula on archetypes.ts:177-179 comments states it's calibrating to match original recovery **only for non-zero atkCooldown values**. When `rawCooldown = 0`, the `Math.max(1, 0 + 18)` forces a baseline 18-frame window, which the port then scales by dexterity. This was likely a design choice to avoid instant-attack loops, but it diverges from the original's zero-cooldown semantics.

---

## Files Referenced

- **Original spec:**
  - `casts/data/act_boulderMonster.txt` (lines 1-32)
  - `casts/script_objects/modWeaponManager.txt` (lines 157-203)
  - `casts/general_functions/Counter ().txt` (lines 2-29)

- **Port implementation:**
  - `port/src/entities/archetypes.ts` (lines 136-310, esp. 180-188)
  - `port/src/components/control.ts` (lines 295-478, esp. 456-468)
  - `port/src/generated/data.json` (boulderMonster & boulder entries)

---

## Recommendation

The zero-cooldown attack divergence is a known design trade-off in the port's cooldown calibration. It prioritizes avoiding frame-perfect attack loops while attempting to preserve the "feel" of fast attackers via the effective cooldown formula. Whether to fix this by:
1. Special-casing rawCooldown=0 to remain always-ready
2. Accepting the slower attack rate as a port limitation
3. Adjusting dexterity or the formula baseline

...should be determined by gameplay testing against original reference footage.
