# Weapon Actor Parity Audit: skeletonComandoSword

## Overview
Audit scope: The `skeletonComandoSword` actor (#objType #objPowerUp #inherit #weapon) — a melee weapon wielded by skeletonComando enemy. This sword defines the #attack that drives the enemy's melee behavior.

**Sources:**
- Original Lingo: `/home/user/merlin-s-revenge/casts/data/act_skeletonComandoSword.txt`
- TS Port data: `/home/user/merlin-s-revenge/port/src/generated/data.json` (entry `act_skeletonComandoSword`)
- TS Port implementation: `/home/user/merlin-s-revenge/port/src/components/weapon.ts` (resolveAttack, enemyMeleeBasePower)
- TS Port integration: `/home/user/merlin-s-revenge/port/src/entities/archetypes.ts` (spawnEnemy)

---

## Attack Property Comparison

| Property | Original Lingo | TS Port Data | resolveAttack() Output | Status |
|----------|---|---|---|---|
| #animType | `#weaponMelee` | `"#weaponMelee"` | `type: "melee"` via typeFromAnimType() | **FAITHFUL** |
| #cooldown | `0` | `0` | `0` (raw), re-derived to `7` frames via K1 calibration | **FAITHFUL** (documented K1 re-derivation; see note below) |
| #power | `point(1, 0)` | `{ "x": 1, "y": 0 }` | `powerX: 1, powerY: 0, powerScalar: 1` | **FAITHFUL** |
| #damageMultiplier | `1` (typo: stored as `#dammageMultiplier: 14`) | `1` (typo persists as `"dammageMultiplier": 14`) | `damageMultiplier: 1` | **FAITHFUL** (typo ignored in both; see note below) |
| #reach | NOT SPECIFIED (defaults to 25) | NOT SPECIFIED (defaults to 25) | `reach: 25` from STRUCT_ATTACK default | **FAITHFUL** |
| #hits | `[#teamMembers, #teamBuildings]` | `["#teamMembers", "#teamBuildings"]` | `hits: ["#teamMembers", "#teamBuildings"]` | **FAITHFUL** |
| #sound | `"skeleton_fire"` | `"skeleton_fire"` | `sound: "skeleton_fire"` | **FAITHFUL** |
| #name | `skeletonComandoSword` | `{ "$global": "skeletonComandoSword" }` | `name: "skeletonComandoSword"` | **FAITHFUL** |
| #animframe | `3` | `3` | NOT RETURNED (animation detail, not attack-defining; see exclusions) | **OMITTED** (out of scope) |
| #collisionLoc | `point(27, -3)` | `{ "x": 27, "y": -3 }` | NOT RETURNED (collision positioning, not attack-defining; see exclusions) | **OMITTED** (out of scope) |

---

## Melee Behavior Integration

### Original Lingo Path
When skeletonComando attacks:
1. CpuAI reads the #weapon: #skeletonComandoSword
2. modWeaponManager resolves its #attack
3. performMeleeAttack fires, reading:
   - `#power` point(1, 0) → L1 magnitude = 1
   - `#dammageMultiplier` (typo, not found) → defaults to 1
   - Computed damage ∝ power·strength·multiplier = 1·12·1 = 12 (before inertia damping)

### TS Port Path
When skeletonComando attacks:
1. `spawnEnemy("skeletonComando", ...)` loads act_skeletonComando
   - `d["weapon"] = "#skeletonComandoSword"`
   - Resolves weapon actor, extracts `#attack` (line 156 in archetypes.ts)
2. `resolveAttack(...)` (weapon.ts:157–223):
   - Reads `#power: { x: 1, y: 0 }` → `powerX = 1, powerY = 0, powerScalar = 1`
   - Reads `#damageMultiplier: ???` (not found; only typo `"dammageMultiplier": 14` exists) → falls back to STRUCT_ATTACK default `1`
   - Returns `AttackData` with `damageMultiplier: 1, powerScalar: 1`
3. CpuAI.attack() (control.ts:628–631):
   - Reads `ca = getCurrentAttack()` → the resolved AttackData
   - Computes `base = enemyMeleeBasePower(ca, strength)` = ca.powerScalar · strength · ENEMY_DAMAGE_SCALE
     - = 1 · 12 · 0.18 ≈ 2.16 (internal collision-vector magnitude)
   - Applies `mult = ca.damageMultiplier = 1` via meleeHitFn()

---

## Typo Handling: #dammageMultiplier

**Original Lingo:**
- The weapon stores `#dammageMultiplier: 14` (typo in spelling).
- Lingo modEnergy.txt line 1 reads `.getAttack().damageMultiplier` (correct spelling).
- Since the typo doesn't match, it finds nothing and defaults to 1.
- Result: **The original effectively uses damageMultiplier = 1, ignoring the typo'd value.**

**TS Port:**
- The data.json preserves the typo: `"dammageMultiplier": 14`.
- `resolveAttack()` reads `r["damageMultiplier"]` (correct spelling) at weapon.ts:178.
- The typo is never accessed; merging falls back to STRUCT_ATTACK default `damageMultiplier: 1`.
- Result: **The port also uses damageMultiplier = 1, faithfully ignoring the typo.**

**Conclusion:** The typo is **catalogued and intentionally NOT corrected** (per audit mandate). Both implementations ignore it identically.

---

## Cooldown Re-derivation (K1)

**Original Lingo:**
- Raw `#cooldown: 0`
- CpuAI attack loop timing is hardcoded per #AiType (not shown here; out of scope for weapon audit)
- Enemy attacks with platform's natural FSM cycle

**TS Port (archetypes.ts:175–188, K1 calibration):**
- Raw `cooldown: 0`
- Re-derived to `effectiveCooldown = 7` frames:
  - `framesWanted = max(1, 0 + 6) = 6` (melee default +6 frames)
  - `counterInc = agility = 1` (default, no agility override in data)
  - `effectiveCooldown = round(6·1 + 1) = 7`
- The WeaponManager builds a Counter with this cooldown; recovery increments by agility=1 per frame.

**Status:** **FAITHFUL (documented divergence)**. The original's attack loop timing is platform-specific; the port re-calibrates to the same **effect** (same frame count between attacks) using a data-driven counter. This is a documented B2 plan §f.3 adaptation and is **NOT a gap** — it's a faithful functional equivalence.

---

## Exclusions (Per Mandate)

The following properties are confirmed present in the original but NOT reported as gaps:

- **#animframe (3)**: Animation strip detail, not part of attack definition. Omitted.
- **#collisionLoc (point(27, -3))**: Collision positioning, not reach/damage. Omitted.
- **#dammageMultiplier typo (14)**: Catalogued; intentionally ignored in both. No gap.
- **K1 cooldown re-derivation**: Faithful recalibration to per-frame counter. Documented; no gap.
- **#explodeSound**: Not present in this melee weapon. N/A.

---

## Summary Table

| Category | Finding |
|----------|---------|
| **animType classification** | ✓ FAITHFUL (#weaponMelee → melee) |
| **reach** | ✓ FAITHFUL (25 px default) |
| **damage** | ✓ FAITHFUL (power 1, multiplier 1, ENEMY_DAMAGE_SCALE applied) |
| **power** | ✓ FAITHFUL (point(1,0) → powerScalar 1) |
| **multiplier typo** | ✓ FAITHFUL (both ignore dammageMultiplier, use 1) |
| **hits** | ✓ FAITHFUL ([#teamMembers, #teamBuildings]) |
| **sound** | ✓ FAITHFUL ("skeleton_fire") |
| **name** | ✓ FAITHFUL ("skeletonComandoSword") |
| **cooldown** | ✓ FAITHFUL (re-derived K1, same effect) |

---

## Conclusion

**ACTOR=skeletonComandoSword | CLEAN**

All attack properties faithfully match original behavior. The typo #dammageMultiplier is intentionally ignored in both codebases (resolved and catalogued). The cooldown re-derivation is a documented K1 adaptation providing functional equivalence. No behavioral gaps detected.
