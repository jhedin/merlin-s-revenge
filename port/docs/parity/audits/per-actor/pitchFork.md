# Behavioral Audit: act_pitchFork

**Weapon Class:** #objType #objPowerUp, #inherit #weapon  
**Primary Wielder:** act_farmer (allied melee unit)  
**Damage Model:** Melee contact, ENEMY-side K1 scaling  

## Data Parity: Original Lingo vs. TypeScript Port

### Source Files

**Original (Lingo):**
- Data: `casts/data/act_pitchFork.txt`
- Inherited from: `casts/data/act_weapon.txt`
- Logic: `casts/script_objects/modWeaponManager.txt`, `modAttack.txt`, `modGameObject.pKnockback`

**Port (TypeScript):**
- Resolved Data: `port/src/generated/data.json` → `act_pitchFork`
- Resolution: `port/src/data/registry.ts` → `resolveActor("pitchFork")` + `deepModify(STRUCT_ATTACK, ...)`
- Attack Implementation: `port/src/components/weapon.ts` → `resolveAttack()`
- Execution: `port/src/components/control.ts` → `attackMelee()` [enemy melee path]
- Archetype: `port/src/entities/archetypes.ts` → `spawnEnemy()` [weapon resolution]

---

## Attack Block Property Parity

### Original (act_pitchFork.txt lines 5–17)

```
#attack:[
  #animframe: 3,
  #animType: #weaponMelee,
  #collisionLoc: point(12,2),
  #cooldown: 30,
  #damageMultiplier: 5,
  #hits: [#teamMembers, #teamBuildings],
  #idealAttackLoc: point(12,2),
  #name: #pitchFork,
  #power: point(.3, .3),
  #sound: "skeleton_fire"
]
```

### Resolved (port/src/generated/data.json)

```json
{
  "act_pitchFork": {
    "data": {
      "attack": {
        "animframe": 3,
        "animType": "#weaponMelee",
        "collisionLoc": {"x": 12, "y": 2},
        "cooldown": 30,
        "damageMultiplier": 5,
        "hits": ["#teamMembers", "#teamBuildings"],
        "idealAttackLoc": {"x": 12, "y": 2},
        "name": "#pitchFork",
        "power": {"x": 0.3, "y": 0.3},
        "sound": "skeleton_fire"
      }
    }
  }
}
```

---

## Property-by-Property Audit

| Property | Original | Port | Faithful? | Evidence | Notes |
|----------|----------|------|-----------|----------|-------|
| **#animType** | `#weaponMelee` | `#weaponMelee` | ✓ | data.json: `"animType": "#weaponMelee"` | Melee classification correct (weapon.ts:101) |
| **#power** | `point(0.3, 0.3)` | `{x: 0.3, y: 0.3}` | ✓ | data.json: `"power": {"x": 0.3, "y": 0.3}` | Resolved as powerX=0.3, powerY=0.3, powerScalar=0.6 (weapon.ts:165) |
| **#reach** | *not specified* (inherit) | `25` | ✓ | STRUCT_ATTACK default (data/registry.ts:29) | Both use default reach=25 |
| **#cooldown** | `30` | `30` (raw) + K1 recalibration | ✓* | data.json: `"cooldown": 30`; archetypes.ts:180–188 re-derives effective cooldown | K1: farmer.agility=1, framesWanted=max(1, 30+6)=36, effective=36*1+1=37 |
| **#damageMultiplier** | `5` | `5` | ✓ | data.json: `"damageMultiplier": 5` | Carries as-is; applied as mult in melee L1 calc (weapon.ts:141–150) |
| **#name** | `#pitchFork` | `#pitchFork` | ✓ | data.json: `"name": "#pitchFork"` | Weapon identity preserved |
| **#sound** | `"skeleton_fire"` | `"skeleton_fire"` | ✓ | data.json: `"sound": "skeleton_fire"` | Audio faithfully passed (control.ts on attack fire) |
| **#hits** | `[#teamMembers, #teamBuildings]` | `["#teamMembers", "#teamBuildings"]` | ✓ | data.json: `"hits": ["#teamMembers", "#teamBuildings"]` | Target set preserved; used in melee impact (teams.ts meleeHitFn) |
| **#collisionLoc** | `point(12, 2)` | `{x: 12, y: 2}` | ✓ | data.json: `"collisionLoc": {"x": 12, "y": 2}` | NOT flagged (per guidelines): used for anim calc, not behavioral change |
| **#idealAttackLoc** | `point(12, 2)` | `{x: 12, "y": 2}` | ✓ | data.json: `"idealAttackLoc": {"x": 12, "y": 2}` | Resolved; used in anim offset (not flagged) |
| **#animframe** | `3` | `3` | ✓ | data.json: `"animframe": 3` | NOT flagged (per guidelines): animation frame timing, port unified dispatch |

\* **K1 cooldown calibration** (archetypes.ts:176–188): Re-derives effective cooldown from `rawCooldown + (ranged?18:6)` so the per-frame counter recovery matches the old frame-based timing. **Faithful to original behavior; documented divergence per B2 plan §f.3.**

---

## Top-Level Actor Properties (act_pitchFork)

| Property | Original | Port | Faithful? | Evidence |
|----------|----------|------|-----------|----------|
| **#objType** | `#objPowerUp` | `#objPowerUp` | ✓ | data.json: `"objType": "#objPowerUp"` |
| **#inherit** | `#weapon` | `#weapon` (resolved) | ✓ | data.json: `"inherit": "#weapon"` → merged with act_weapon.txt base |
| **No #power/@top-level** | ✓ | ✓ | ✓ | Weapon carries only #attack.power; no scalar top-level property |
| **No #reach/@top-level** | ✓ | ✓ | ✓ | Reach lives in #attack; no top-level override |

---

## Melee Attack Execution: Farmer Swing Model

### Original (modAttack.damageKnockback, modGameObject.pKnockback)

```
#animType = #weaponMelee (line ~700–750):
  meleeL1 = power·strength·SCALE·mult
  knockback = meleeL1 (vector L1 magnitude = damage)
  
Example: farmer (strength 3, inertia 30):
  pitchFork (power 0.3+0.3=0.6, mult 5)
  L1 = 0.6 · 3 · SLICE_SCALE · 5 = 9.0 (pre-B2 + pre-port baseline)
```

### Port (control.ts:258–280; weapon.ts:148–150)

```typescript
// weapon.ts:148–150 — enemyMeleeBasePower (K1 enemy-side damage):
export function enemyMeleeBasePower(attack: AttackData, strength: number): number {
  return attack.powerScalar * strength * ENEMY_DAMAGE_SCALE;
}
// K1: ENEMY_DAMAGE_SCALE = 0.18 (calibrated for enemy rank-and-file: warrior/swordOrc ~4 dmg/hit)

// control.ts:258–280 — CpuAI.attackMelee():
// Line 260: const l1 = enemyMeleeBasePower(a, this.strength) * (a.damageMultiplier ?? 1);
// farmer (strength 3):
//   L1 = 0.6 · 3 · 0.18 · 5 = 1.62 (K1 scaled enemy hit)
```

**Outcome:**  
- **Original baseline:** ~9.0 L1 per swing (pre-B2 slice)  
- **Port (K1):** 1.62 L1 per swing (0.18× calibration for enemy melee fairness)  
- **Verdict:** ✓ Faithful K1 calibration; documented divergence per docs/parity/plans/K1-faithful-damage.md §b  

---

## Weapon Resolution: Farmer Spawn → Attack

**Scenario:** farmer spawns with weapon pitchFork → resolves attack → swings melee.

### Port Execution Trace

1. **Spawn farmer** (`archetypes.ts:spawnEnemy("farmer", x, y)`):
   - Resolves actor data: `registry.resolveActor("farmer")` (line 138)
   - Farmer data includes: `weapon: "#pitchFork"`, `strength: 3`, `agility: 1`
   - Line 155–162: Extract weapon attack:
     ```typescript
     const weaponAtk = objAttack((registry.resolveActor(d["weapon"].replace(/^#/, "")) ?? {})["attack"]);
     if (!atk["animType"]) atk = weaponAtk;  // farmer has no own #attack, uses weapon's
     ```
   - Resolves `registry.resolveActor("pitchFork")` → yields full #attack proplist from data.json
   - **atk = pitchFork's attack block**

2. **Determine attack type**:
   - Line 163: `const animType = typeof atk["animType"] === "string" ? atk["animType"] : "";`
   - pitchFork.animType = `"#weaponMelee"` → animType = `"#weaponMelee"`
   - Line 169–170: `const ranged = opts.ranged ?? (animType === "#weaponRanged" || animType === "#magic" || animType === "#naturalRanged");`
   - **ranged = false** (weaponMelee is NOT ranged)

3. **Resolve attack via resolveAttack()**:
   - Line 196–198: Build enemyAttack with K1 cooldown calibration:
     ```typescript
     const rawCooldown = 30;  // from pitchFork.cooldown
     const framesWanted = Math.max(1, 30 + 6) = 36;  // melee: +6
     const counterInc = agility = 1;  // farmer.agility
     const effectiveCooldown = Math.round(36 * 1 + 1) = 37;
     const enemyAttack = resolveAttack({ ...atk, cooldown: effectiveCooldown });
     ```
   - Line 171–223 in weapon.ts: `resolveAttack()` fills all properties:
     - powerScalar = 0.6 (from power.x=0.3 + power.y=0.3)
     - reach = 25 (default, since pitchFork has no #reach)
     - damageMultiplier = 5
     - hits = ["#teamMembers", "#teamBuildings"]
     - type = "melee" (via typeFromAnimType("#weaponMelee"))

4. **Fire melee attack** (control.ts:258–280):
   - Line 260: `const l1 = enemyMeleeBasePower(a, this.strength) * (a.damageMultiplier ?? 1);`
   - farmer.strength = 3
   - L1 = 0.6 · 3 · 0.18 · 5 = **1.62** (K1 scaled impact L1)
   - Line 270–271: Carries L1 as collision vector to impactMeleeAttack()
   - Line 275–279: Applies knockback via inertia damping (farmer.inertia=30)
   - **Melee swing connects on reach=25 radius; target hit with 1.62 L1 + inertia resistance**

### Verdict: ✓ FAITHFUL WEAPON RESOLUTION & EXECUTION

---

## Farmer Unit: Weapon Binding

**Original:**  
```
act_farmer: #weapon: #pitchFork, #strength: 3, #agility: 1
```

**Port (data.json):**  
```json
"act_farmer": {
  "data": {
    "weapon": "#pitchFork",
    "strength": 3,
    "agility": 1
  }
}
```

**Resolution (archetypes.ts:155–162):**
- Reads `d["weapon"]` = `"#pitchFork"`
- Resolves actor via `registry.resolveActor("pitchFork")`
- Farmer has no own #attack, so `weaponAtk` (pitchFork's attack) becomes atk
- Merges into enemyAttack via `resolveAttack()` + K1 cooldown calibration
- Passes to WeaponManager.init() → addWeapon("pitchFork", attack)
- **Outcome:** farmer armed with pitchFork melee attack; ranged=false; swings at reach=25 with L1=1.62 per hit (K1 scaled).

**Verdict: ✓ FAITHFUL**

---

## Inherited Base (act_weapon.txt)

**Original (casts/data/act_weapon.txt lines 1–6):**
```
[#name: "act_weapon", #type: #field]
[
  #objType: #objWeapon,
  #inherit: #actor,
  #character: #weapon,
  #minCollisionSpeed: 4
]
```

**Port Resolution:**
- Registry merges `pitchFork` (child) over `weapon` (parent via `#inherit: #weapon`)
- `weapon` inherits from `actor` (chain flattened: pitchFork → weapon → actor)
- Top-level #minCollisionSpeed, #character NOT in pitchFork proplist → inherited from act_weapon
- **Port:** `registry.resolveActor("pitchFork")` yields merged record with inherited properties available, but NOT carried into attack resolution (out of scope for attack parity)

**Verdict: ✓ Inheritance chain faithful; attack properties isolated correctly**

---

## Exclusions (Per Audit Guidelines)

**Explicitly NOT flagged (known divergences or out-of-scope):**
- ✓ Audio/volume (faithfully passed; not a behavioral divergence)
- ✓ attack.collisionLoc (point(12,2) used for anim calc; not structural issue)
- ✓ miniMapStatus (UI; not combat behavior)
- ✓ eyestrain (farmer.eyestrain=30; modifyLocWithEyestrain: aim randomness, out-of-scope)
- ✓ weaponTechnique (farmer carries 0 by default; data-driven, not weapon bug)
- ✓ attack.animFrame (animation timing; port unified dispatch)
- ✓ damageMultiplier typo check: original=5, port=5 (NO typo; both match)
- ✓ K1 cooldown re-derivation (documented calibration per B2 plan §f.3; faithful to frame behavior)
- ✓ explodeSound (N/A; pitchFork is melee, not explosion)

---

## Summary: Attack Lifecycle

1. **Data:** pitchFork.attack fully resolved from Lingo source → JSON → TypeScript AttackData ✓
   - power point(0.3, 0.3) → powerScalar=0.6 ✓
   - #weaponMelee → type="melee" ✓
   - cooldown 30 → effective 37 (K1 calibrated) ✓

2. **Type Detection:** #weaponMelee → ranged=false, melee contact ✓

3. **Reach:** Default 25 (no override) → melee sweep radius 25px ✓

4. **Damage Model:** 
   - L1 = powerScalar · strength · ENEMY_DAMAGE_SCALE · mult
   - L1 = 0.6 · 3 · 0.18 · 5 = 1.62 (K1 scaled, faithful) ✓

5. **Target Roles:** [#teamMembers, #teamBuildings] ✓

6. **Wielder:** farmer (strength 3, agility 1) correctly binds weapon, swings at reach=25 ✓

---

## Conclusion

**ACTOR=pitchFork | CLEAN**

The pitchFork weapon exhibits full behavioral parity between the original Lingo implementation and the TypeScript port. Every attack property (#animType, #power, #reach, #cooldown, #damageMultiplier, #name, #sound, #hits) is faithfully resolved, type-detected, and executed. The wielder (farmer) correctly binds the weapon, swings melee attacks at reach=25, and impacts with calibrated K1 damage (1.62 L1 per hit = 0.6 power · 3 strength · 0.18 K1_SCALE · 5 multiplier). No structural divergences detected. All property values match exactly; K1 cooldown calibration is documented and faithful to original frame timing.
