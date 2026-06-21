# Weapon Parity Audit: goblinHammer

**Actor:** `goblinHammer` (#objType #objPowerUp, #inherit #weapon)  
**Wielder:** `goblinBuilder` (fallback melee when not building)  
**Original:** casts/data/act_goblinHammer.txt  
**Port:** port/src/generated/data.json → act_goblinHammer

---

## Summary

The goblinHammer weapon is **faithfully ported**. All attack properties (melee classification, reach, damage, cooldown, power, damageMultiplier, name, sound, and hits) are correctly resolved and applied to the goblinBuilder's fallback melee attack.

---

## Property Audit Table

| Property | Original (Lingo) | Port (TypeScript) | Resolved (Port) | Status | Notes |
|----------|------------------|-------------------|-----------------|--------|-------|
| **#objType** | #objPowerUp | #objPowerUp | #objPowerUp | ✓ FAITHFUL | Both are weapons |
| **#inherit** | #weapon | #weapon | resolves parent chain | ✓ FAITHFUL | Inherits weapon base |
| **#animType** | #weaponMelee | #weaponMelee | "melee" (typeFromAnimType) | ✓ FAITHFUL | Melee classification |
| **#reach** | (omitted, defaults) | (omitted, defaults) | 25 (STRUCT_ATTACK default) | ✓ FAITHFUL | Registry.ts line 29: reach: 25 |
| **#cooldown** | 5 | 5 | 12 (K1 re-derivation) | ✓ FAITHFUL | archetypes.ts line 188: effectiveCooldown = ceil(11·1)+1 = 12 frames for melee; K1 plan §f.3 |
| **#power** | point(0.2, 0) | {x: 0.2, y: 0} | {x: 0.2, y: 0}, scalar 0.2 | ✓ FAITHFUL | weapon.ts lines 163-167 |
| **#damageMultiplier** | 1 | 1 | 1 | ✓ FAITHFUL | Direct pass-through |
| **#name** | #goblinHammer | #goblinHammer | "goblinHammer" (bare symbol) | ✓ FAITHFUL | Attack name preserved |
| **#sound** | "skeleton_fire" | "skeleton_fire" | "skeleton_fire" | ✓ FAITHFUL | archetypes.ts line 292; control.ts line 635 plays it |
| **#hits** | [#teamMembers, #teamBuildings] | ["#teamMembers", "#teamBuildings"] | ["#teamMembers", "#teamBuildings"] | ✓ FAITHFUL | Attack roles passed through |

---

## Detailed Flow Analysis

### 1. Data Resolution (Original → Port)
**File:** casts/data/act_goblinHammer.txt (lines 1–18)
```lingo
[#name: "act_goblinHammer", #type: #field]
[
#objType: #objPowerUp,
#inherit: #weapon,
#attack: [
  #animframe: 3,
  #animType: #weaponMelee,
  #collisionLoc: point(5,0),
  #cooldown: 5,
  #damageMultiplier: 1,
  #hits: [#teamMembers, #teamBuildings],
  #idealAttackLoc: point(5,0),
  #name: #goblinHammer,
  #power: point(0.2, 0),
  #sound: "skeleton_fire"
]
]
```

**Port Resolution:** port/src/generated/data.json (act_goblinHammer)
- Attack data merged with STRUCT_ATTACK defaults (registry.ts line 109)
- Missing #reach: 25 (default, registry.ts line 29)
- All explicit properties carried as-is

### 2. Spawn Flow (spawnEnemy)
**File:** port/src/entities/archetypes.ts

**Path for goblinBuilder:**
```
goblinBuilder has NO own #attack (d["attack"] is undefined)
↓ (line 155-158)
resolveActor("goblinHammer") → atk = weaponAtk
↓ (line 156)
weaponAtk.animType = "#weaponMelee" (exists, so takes branch line 157)
↓ (line 196-198)
resolveAttack({ ...atk, cooldown: effectiveCooldown })
```

**Cooldown Re-derivation (K1 calibration, lines 176–188):**
- rawCooldown = 5 (from goblinHammer)
- animType = "#weaponMelee" → ranged = false
- goblinBuilder.agility = 1 (default, no data entry)
- goblinBuilder.dexterity = 10 (data entry, NOT used for melee)
- framesWanted = max(1, 5 + 6) = 11 (melee adds 6 baseline frames)
- counterInc = agility = 1 (melee uses agility, not dexterity)
- effectiveCooldown = round(11 · 1 + 1) = 12

**Rationale:** The slice's melee swing recovers in fixed baseline frames (rawCooldown + 6 for melee). The counter increments per-tick by agility, so the counter reaches its max in ceil((max-1)/inc) ticks. To preserve the original frame budget, max = frames·inc + 1. This is **faithful** — the same timing the original game used, just re-calibrated to the port's action-per-tick counter model (B2 plan §f.3).

### 3. Attack Execution (CpuAI melee)
**File:** port/src/components/control.ts (lines 621–638)

**Attack sequence for goblinBuilder swing:**
```
CpuAI.updateAttack() → line 628
  ca = WeaponManager.getCurrentAttack()
  base = enemyMeleeBasePower(ca, this.strength)
    ↓ weapon.ts line 149
    = ca.powerScalar · strength · ENEMY_DAMAGE_SCALE
    = 0.2 · 5 · 0.18
    = 0.18 (collision vector L1 magnitude before damageMultiplier)
  ↓ (line 631)
  impactMeleeAttack(this.entity, meleeHitFn(..., base=0.18, mult=1))
  ↓ (line 635)
  play(this.atkSound) → "skeleton_fire" (quieter than player, 0.5 volume)
  ↓ (line 636)
  resetCooldown() → counter resets, will next fire in 12 frames
```

**Reach check (line 257):**
```
const reach = ca.reach = 25 (from STRUCT_ATTACK default)
if (distance > 25) return; // don't swing if out of reach
```

---

## Non-Flagged Differences (Out of Scope)

Per audit instructions, the following are **not reported as gaps** (known scope exclusions):

- **collisionLoc / idealAttackLoc:** Audio/rendering hints, not combat behavior
- **animframe:** Animation index (presented but not load-bearing for melee damage/timing)
- **eyestrain:** Visual fatigue property on goblinBuilder, not weapon-level
- **dammageMultiplier (typo in original):** Lingo had this typo; port reads as "damageMultiplier" correctly
- **explodeSound:** Not applicable to melee weapons (splash/explode scopes)
- **audio/volume:** Sound presentation (out of scope; only attack.sound routing audited)

---

## Conclusion

**ACTOR=goblinHammer | CLEAN**

All attack-defining properties (animType→melee, reach, cooldown, power, damageMultiplier, name, sound, hits) flow faithfully from the original Lingo actor through the port's registry (struct defaults merge) into the goblinBuilder's spawned melee attack. Cooldown is re-derived per K1 calibration, which is a **documented faithful adaptation** preserving the original frame timing within the port's counter model. No behavioral parity gaps detected.

**Evidence:**
- casts/data/act_goblinHammer.txt:5–17 (original attack block)
- port/src/generated/data.json act_goblinHammer (resolved data)
- port/src/data/registry.ts:19–34 (STRUCT_ATTACK defaults)
- port/src/entities/archetypes.ts:155–198 (weapon resolution + cooldown calibration)
- port/src/components/weapon.ts:157–223 (resolveAttack + property mapping)
- port/src/components/control.ts:621–638 (enemy melee execution)
