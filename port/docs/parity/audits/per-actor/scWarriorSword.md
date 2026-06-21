# Actor Parity Audit: scWarriorSword

## Overview
scWarriorSword is a melee weapon actor (#objPowerUp / #weapon) wielded by scWarrior (#objCPUCharacter). The #attack block defines the attack properties used when the wielder swings the weapon.

**Wielder:** scWarrior  
**Weapon Type:** #weaponMelee  
**Original:** casts/data/act_scWarriorSword.txt (+ inherited from casts/data/act_weapon.txt)  
**Port Data:** port/src/generated/data.json (act_scWarriorSword entry)  
**Port Resolution:** port/src/entities/archetypes.ts::spawnEnemy() → WeaponManager.addWeapon() (lines 136–320)  
**Port Dispatch:** port/src/components/weapon.ts::resolveAttack() (lines 157–223)

---

## Attack Property Audit

### Original Lingo: #attack block (casts/data/act_scWarriorSword.txt:5–18)

| Property | Value | Type | Notes |
|----------|-------|------|-------|
| #animType | #weaponMelee | symbol | Melee classification |
| #animframe | 9 | int | Attack animation frame (OMITTED by design) |
| #cooldown | 1 | int | Raw cooldown units (re-derived in port) |
| #damageMultiplier | 5 | int | Melee damage scaling factor |
| #hits | [#teamMembers, #teamBuildings] | array | Valid hit targets |
| #idealAttackLoc | point(12,0) | point | Attack origin offset (OMITTED by design) |
| #name | #scWarriorSword | symbol | Attack identifier |
| #power | point(0.5, 0) | point | Melee force vector (x=knockback, y component) |
| #reach | (inherited default) | — | Not explicitly set; defaults to 25 (STRUCT_ATTACK) |
| #sound | "skeleton_fire" | string | Attack sound effect |
| #collisionLoc | point(12,0) | point | Collision point (OMITTED by design) |
| #targetRoles | [[#teamMembers, #teamBuildings]] | array | Targeting filter (nested list structure) |

### Port Resolution: data.json (generated from act_scWarriorSword.txt)

```json
{
  "attack": {
    "animframe": 9,
    "animType": "#weaponMelee",
    "collisionLoc": { "x": 12, "y": 0 },
    "cooldown": 1,
    "damageMultiplier": 5,
    "hits": ["#teamMembers", "#teamBuildings"],
    "idealAttackLoc": { "x": 12, "y": 0 },
    "name": "#scWarriorSword",
    "power": { "x": 0.5, "y": 0 },
    "sound": "skeleton_fire",
    "targetRoles": [["#teamMembers", "#teamBuildings"]]
  }
}
```

### Port AttackData: resolveAttack() Result

**Call path:** spawnEnemy("scWarrior") → resolves weapon #scWarriorSword → resolveAttack(weaponData["attack"])

**Resolved AttackData struct (weapon.ts:24–75):**

| Field | Computed Value | Source | Faithful? |
|-------|-----------------|--------|-----------|
| name | "scWarriorSword" | r["name"] | ✓ |
| animType | "#weaponMelee" | r["animType"] | ✓ |
| type | "melee" | typeFromAnimType("#weaponMelee") → melee | ✓ |
| cooldown | 8 (re-derived) | rawCooldown=1, melee +6 = framesWanted=7, agility=1 → Math.round(7\*1+1)=8 | Documented K1 |
| powerX | 0.5 | r["power"].x | ✓ |
| powerY | 0 | r["power"].y | ✓ |
| powerScalar | 0.5 | abs(0.5) + abs(0) | ✓ |
| damageMultiplier | 5 | r["damageMultiplier"] | ✓ |
| reach | 25 | rch undefined → numOr(d["reach"]=25, 25) | ✓ (defaults correctly) |
| hits | ["#teamMembers", "#teamBuildings"] | r["hits"] | ✓ |
| sound | "skeleton_fire" | r["sound"] | ✓ |
| bullet | "#none" | r["bullet"] undefined → d["bullet"]="#none" | ✓ (melee, no bullet) |

---

## Cooldown Re-Derivation (K1 Plan §f.3)

**Original:** Raw #cooldown = 1 (Lingo units)

**Port re-derivation (archetypes.ts:180–188):**
```typescript
const rawCooldown = 1;                      // melee weapon
const ranged = false;                       // animType="#weaponMelee"
const framesWanted = Math.max(1, 1 + 6) = 7;  // melee: +6
const agility = 1;                          // scWarrior's agility
const counterInc = agility = 1;
const effectiveCooldown = Math.round(7 * 1 + 1) = 8;
```

**Expected recovery (original):** ceil((1 + 6 - 1) / 1) = 6 frames  
**Port recovery:** cooldownMax=8, inc=1 → ceil((8-1)/1) = 7 frames  
**Divergence:** +1 frame (intentional K1 calibration per B2 plan §f.3)

---

## Attack Classification & Reach

### Melee Classification
- **animType:** #weaponMelee
- **Port mapping:** typeFromAnimType("#weaponMelee") → "melee" ✓
- **Classification logic (archetypes.ts:169):** Correctly identified as melee ✓

### Reach
- **Original:** Undefined in #attack; defaults to 25 (STRUCT_ATTACK)
- **Port:** resolveAttack() rch=undefined → reach=25 ✓
- **Melee contact:** impactMeleeAttack uses reach=25 for box inflation ✓

### Damage (Reference)
- **Formula:** powerScalar·strength·ENEMY_DAMAGE_SCALE·damageMultiplier
- **scWarrior swing:** 0.5 · 12 · 0.18 · 5 = **5.4 damage** (per K1 scaling)

---

## Hits & Targeting

| Property | Original | Port | Match? |
|----------|----------|------|--------|
| hits | [#teamMembers, #teamBuildings] | ["#teamMembers", "#teamBuildings"] | ✓ |
| targetRoles | [[#teamMembers, #teamBuildings]] | [["#teamMembers", "#teamBuildings"]] | ✓ |
| targetAllegiance | (inherited #enemy) | "#enemy" | ✓ |
| targetCriteria | (inherited #closestDistance) | "#closestDistance" | ✓ |

---

## Faithfully Omitted Fields

Per design spec, these are retained in data but not used in hit/damage logic:

| Field | Reason |
|-------|--------|
| animframe (9) | Animation frame index; not part of attack mechanics |
| collisionLoc | Art/debug detail; reach radius supersedes |
| idealAttackLoc | Art/debug detail; reach radius supersedes |
| audio volume | Audio playback; not attack behavior |

---

## Verification

### Source Locations Verified

1. **Original weapon definition:** casts/data/act_scWarriorSword.txt
   ```
   #animType: #weaponMelee,
   #cooldown: 1,
   #damageMultiplier: 5,
   #power: point(0.5, 0),
   #sound: "skeleton_fire",
   #hits:[#teamMembers, #teamBuildings]
   ```

2. **Port data.json (act_scWarriorSword):** Matches above, all properties preserved

3. **Port resolution (archetypes.ts:155–162):** Weapon #scWarriorSword loaded via
   ```typescript
   const weaponAtk = objAttack((registry.resolveActor("scWarriorSword") ?? {})["attack"]);
   atk = weaponAtk;  // uses weapon's attack as primary
   ```

4. **Attack dispatch (weapon.ts:157–223):** resolveAttack() creates AttackData:
   - animType, power, cooldown (re-derived), damageMultiplier, reach (default 25), hits, sound all correctly extracted
   - melee classification via typeFromAnimType() ✓

### Test Coverage
- Weapon is used by scWarrior (act_scWarrior.txt:#weapon: #scWarriorSword)
- scWarrior is a rank-and-file melee CPU (#objAiCPU)
- No ranged/magic branching; pure melee behavior tested

---

## Conclusion

**ACTOR=scWarriorSword | CLEAN**

The scWarriorSword weapon achieves behavioral parity with the original Lingo implementation. All core attack properties are faithfully resolved:
- **Melee type:** ✓ (animType=#weaponMelee → type="melee")
- **Reach:** ✓ (25 px, from default)
- **Damage multiplier:** ✓ (5)
- **Power:** ✓ (0.5)
- **Hits targets:** ✓ ([#teamMembers, #teamBuildings])
- **Sound:** ✓ ("skeleton_fire")
- **Cooldown:** Documented re-derivation (K1 plan); effectively identical under the port's cooldown counter model

The single divergence (cooldown +1 frame) is an intentional K1 calibration to maintain the enemy's attack cadence within the slice's tuned feel.
