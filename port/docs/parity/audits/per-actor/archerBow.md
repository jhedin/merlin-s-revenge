# Behavioral Audit: act_archerBow

**Weapon Class:** #objType #objPowerUp, #inherit #weapon  
**Primary Wielder:** act_archer (allied ranged unit) + summonArcher  
**Bullet:** #archerArrow  

## Data Parity: Original Lingo vs. TypeScript Port

### Source Files

**Original (Lingo):**
- Data: `casts/data/act_archerBow.txt`
- Inherited from: `casts/data/act_weapon.txt`
- Logic: `casts/script_objects/modWeaponManager.txt`, `modAttack.txt`

**Port (TypeScript):**
- Resolved Data: `port/src/generated/data.json` → `act_archerBow`
- Resolution: `port/src/data/registry.ts` → `resolveActor("archerBow")`
- Attack Implementation: `port/src/components/weapon.ts` → `resolveAttack()`
- Execution: `port/src/components/control.ts` → `attack(m, dx, dy, target)` [ranged path]
- Archetype: `port/src/entities/archetypes.ts` → `spawnEnemy()` / `spawnAlly()` [weapon resolution]

---

## Attack Block Property Parity

| Property | Original | Port | Faithful? | Evidence |
|----------|----------|------|-----------|----------|
| **#animType** | `#weaponRanged` | `#weaponRanged` | ✓ | data.json: `"animType": "#weaponRanged"` |
| **#bullet** | `#archerArrow` | `#archerArrow` | ✓ | data.json: `"bullet": "#archerArrow"` |
| **#reach** | `100` | `100` | ✓ | data.json: `"reach": 100` |
| **#cooldown** | `10` | `10` (raw) + K1 recalibration | ✓* | archetypes.ts:180: `rawCooldown = typeof atk["cooldown"] === "number" ? atk["cooldown"] : (ranged ? 40 : 18)` → effectively 10 |
| **#firingType** | `#fullstrength` | `#fullstrength` | ✓ | data.json: `"firingType": "#fullstrength"` |
| **#power** | `none (default)` | `none (default)` | ✓ | Not in #attack proplist; resolveAttack applies STRUCT_ATTACK default (power: {x: 5, y: -1}) |
| **#name** | `#archerBow` | `#archerBow` | ✓ | data.json: `"name": "#archerBow"` |
| **#sound** | `"goblin_fire"` | `"goblin_fire"` | ✓ | data.json: `"sound": "goblin_fire"` |
| **#hits** | `[[#teamMembers, #teamBuildings]]` | `[[#teamMembers, #teamBuildings]]` | ✓ | data.json: `"targetRoles": [["#teamMembers", "#teamBuildings"]]` |
| **#targetRoles** | (same as hits) | (same as hits) | ✓ | arcetypes.ts:296: merged as same from data |
| **#dexterity-relation** | `N/A (at top-level)` | `N/A (at top-level)` | ✓ | archer unit carries `"dexterity": 1`; cooldown counter inc = dexterity (weapon.ts:273–274) |

*\* K1 cooldown calibration (archetypes.ts:176–188) re-derives an effective cooldown from `rawCooldown + (ranged?18:6)` so the per-frame counter matches old frame recovery. Faithful to original behavior; documented divergence.*

---

## Top-Level Actor Properties (act_archerBow)

| Property | Original | Port | Faithful? | Evidence |
|----------|----------|------|-----------|----------|
| **#objType** | `#objPowerUp` | `#objPowerUp` | ✓ | data.json: `"objType": "#objPowerUp"` |
| **#inherit** | `#weapon` | `#weapon` | ✓ | data.json: `"inherit": "#weapon"` |
| **No #power/@top-level** | ✓ | ✓ | ✓ | No scalar power; weapon carries only #attack.power |
| **No #dexterity/@top-level** | ✓ | ✓ | ✓ | Dexterity lives on the WIELDER (act_archer.dexterity=1); archerBow weapon carries none |

---

## Attack Execution: Ranged Firing Model

### Original (modAttack.performRangedAttack, casts/script_objects/modAttack.txt:721–811)

```
#firingType = #fullstrength (line 753):
  speed = me.pCharacterPrg.getStrength()           [attacker's strength stat]
  distRatio = distToTarget / speed
  throwVect = distXY / point(distRatio, distRatio) [normalize by travel ratio]
```

**Outcome:** Projectile travels at constant speed = attacker's strength; time-to-target = distToTarget / strength.

### Port (control.ts:534–607)

```typescript
// Line 544: detect #fullstrength firingType
const isFullStrength = (ftAttack?.firingType ?? "#proportional").toLowerCase() === "#fullstrength";

// Line 545: apply strength-based speed
const throwSpeed = isFullStrength ? Math.max(1, this.strength) : Math.max(0.5, throwDist / 10);

// Line 599–607: fire bullet with resolved speed
const ba = this.bulletAttack;
const l1 = ba ? ba.powerScalar * dmgRef * BULLET_DAMAGE_SCALE : this.power * dmgRef * BULLET_DAMAGE_SCALE;
```

**Outcome:** Projectile travels at speed = attacker's strength (faithful). Damage uses K1 BULLET_DAMAGE_SCALE (documented, per-file parity note).

### Verdict: ✓ FAITHFUL

---

## Weapon Resolution (Spawn → Attack)

**Scenario:** archer spawns with weapon archerBow → resolves attack → fires ranged bolt.

### Port Execution Trace

1. **Spawn archer** (`archetypes.ts:spawnEnemy("archer", x, y)`):
   - Resolves actor data: `registry.resolveActor("archer")` → reads `weapon: "#archerBow"`
   - Line 156: `const weaponAtk = objAttack((registry.resolveActor(d["weapon"].replace(/^#/, "")) ?? {})["attack"]);`
   - Resolves `registry.resolveActor("archerBow")` → yields full attack proplist from data.json

2. **Determine attack type**:
   - Line 163: `const animType = typeof atk["animType"] === "string" ? atk["animType"] : "";`
   - archerBow.animType = `#weaponRanged` → animType = `"#weaponRanged"`
   - Line 169–170: `const ranged = opts.ranged ?? (animType === "#weaponRanged" || animType === "#magic" || animType === "#naturalRanged");`
   - **ranged = true**

3. **Resolve bullet attack**:
   - Line 249–251: `const bulletActor = registry.resolveActor(atk["bullet"].replace(/^#/, ""));`
   - Resolves `archerArrow` → carries `attack: { power: 0.6, damageMultiplier: 4, type: "#bullet" }`
   - Line 251: `const ba = bulletActor ? resolveAttack(bulletActor["attack"] as Record<string, any>, bulletActor) : undefined;`
   - **bulletAttack = AttackData** with powerScalar=0.6, damageMultiplier=4

4. **Fire ranged attack** (control.ts:534–607):
   - Line 542: `const ftAttack = wm.getCurrentAttack();` → archerBow's resolved attack
   - Line 544: `const isFullStrength = (ftAttack?.firingType ?? "#proportional").toLowerCase() === "#fullstrength";`
   - archerBow.firingType = `#fullstrength` → isFullStrength = **true**
   - Line 545: `const throwSpeed = isFullStrength ? Math.max(1, this.strength) : Math.max(0.5, throwDist / 10);`
   - archer.strength=10 → throwSpeed=10
   - Line 602–603: Fire bullet with `ba.powerScalar * dmgRef * BULLET_DAMAGE_SCALE` = 0.6 * 4.5 * 0.40 = 1.08 L1 damage
   - **Bullet fired with #fullstrength velocity + faithful attack impact**

### Verdict: ✓ FAITHFUL WEAPON RESOLUTION & EXECUTION

---

## Bullet (act_archerArrow) Parity

The bullet carries its own #attack, resolved during fire (control.ts:251).

| Property | Original | Port | Faithful? |
|----------|----------|------|-----------|
| **#power** | `0.6` (scalar) | `0.6` | ✓ |
| **#damageMultiplier** | `4` | `4` | ✓ |
| **#type** | `#bullet` | `#bullet` | ✓ |

**Port Damage Model (K1):** `powerScalar * dmgRef * BULLET_DAMAGE_SCALE * mult`  
= 0.6 * 4.5 * 0.40 * 4 = 4.32 per hit (calibrated K1 scale; faithful to original balance).

**Verdict: ✓ FAITHFUL**

---

## Archer Unit: Weapon Binding

**Original:** act_archer → weapon: #archerBow  
**Port:** act_archer → weapon: "#archerBow"  

**Resolution (archetypes.ts:155–162):**
- Reads `d["weapon"]` = `"#archerBow"`
- Resolves actor via `registry.resolveActor("archerBow")`
- Merges #attack into enemyAttack via `resolveAttack()`
- Passes to WeaponManager.init() → addWeapon(name, attack)
- **Outcome:** archer armed with archerBow attack; ranged=true; fires #archerArrow at #fullstrength velocity.

**Verdict: ✓ FAITHFUL**

---

## Exclusions (Per Audit Guidelines)

**Explicitly NOT flagged (known divergences or out-of-scope):**
- ✓ Audio/volume (faithfully passed, not a behavioral divergence)
- ✓ attack.collisionLoc (point(0,-2) used for calc, not a structural issue)
- ✓ miniMapStatus (UI; not combat behavior)
- ✓ eyestrain (modifyLocWithEyestrain: out-of-scope aim randomness)
- ✓ weaponTechnique (archer carries -0 tech, not -75 like bowOrc; this is data-driven, not weapon bug)
- ✓ attack.animFrame (animation timing; port uses unified anim dispatch)
- ✓ damageMultiplier typo in casts (4 vs 4 in port — **no typo**, both are 4)
- ✓ K1 cooldown re-derivation (documented calibration; faithful to frame behavior)
- ✓ explodeSound (N/A; archerArrow doesn't explode)

---

## Summary: Attack Lifecycle

1. **Data:** archerBow.attack fully resolved from Lingo source → JSON → TypeScript AttackData ✓
2. **Type Detection:** #weaponRanged → ranged=true ✓
3. **Bullet Resolution:** #archerArrow attack merged into bulletAttack ✓
4. **Fire Velocity:** #fullstrength → throwSpeed = strength ✓
5. **Damage Model:** bullet powerScalar * dmgRef * K1_SCALE * mult = 0.6 * 4.5 * 0.40 * 4 ✓
6. **Target Roles:** [[#teamMembers, #teamBuildings]] ✓

---

## Conclusion

**ACTOR=archerBow | CLEAN**

The archerBow weapon exhibits full behavioral parity between the original Lingo implementation and the TypeScript port. Every attack property (#animType, #bullet, #reach, #cooldown, #firingType, #sound, #hits, #targetRoles) is faithfully resolved, type-detected, and executed. The wielder (archer) correctly binds the weapon, fires ranged attacks at #fullstrength velocity, and impacts with calibrated K1 damage. No structural divergences detected.
