# Behavioral Audit: act_kingSword

**Class:** weapon (`#objType: #objPowerUp`, `#inherit: #weapon`). Defines the `#kingSword` attack wielded by `kingInGame` (ally).

**Status:** CLEAN — All attack properties faithfully resolved and applied.

---

## Property Audit

| # | Property | Original (casts/) | Resolved (port/src/) | Handling | ✓/✗ |
|---|----------|-------------------|----------------------|----------|-----|
| 1 | `#animType` | `#weaponMelee` (act_kingSword.txt:8) | `#weaponMelee` (data.json) | Classification → `typeFromAnimType()` maps to `type: "melee"` | ✓ |
| 2 | `#cooldown` | `5` (act_kingSword.txt:10) | `5` (data.json) | Counter with cooldown 5; effective cooldown re-derived for enemies via K1 formula: `ceil((rawCooldown + 6) · counterInc + 1)` = `ceil((5 + 6) · 1 + 1)` = 12 frames (counterInc=agility=1 for melee, kingInGame dexterity=3 unused here) | ✓ |
| 3 | `#damageMultiplier` | `3` (act_kingSword.txt:11) | `3` (data.json) | Passed to `meleeHitFn()` as `mult`; applied as `dmg = (|vx|+|vy|)·mult` in Energy.takeHit (weapon.ts:178, control.ts:269, combat.ts:35) | ✓ |
| 4 | `#hits` | `[#teamMembers, #teamBuildings]` (act_kingSword.txt:12) | `["#teamMembers", "#teamBuildings"]` (data.json) | Target role filter; melee swing filters victims by this list (control.ts:269, teams.ts impactMeleeAttack) | ✓ |
| 5 | `#name` | `#kingSword` (act_kingSword.txt:14) | `#kingSword` (data.json) | Weapon registry key; used in WeaponManager.addWeapon(name, attack); enemies track current weapon by name | ✓ |
| 6 | `#power` | `point(0.5, 0)` (act_kingSword.txt:15) | `{x: 0.5, y: 0}` (data.json) | `resolveAttack()` extracts powerScalar = 0.5; melee base power = `powerScalar · strength · ENEMY_DAMAGE_SCALE` = 0.5 · 15 · 0.18 = 1.35 (weapon.ts:165, 149) | ✓ |
| 7 | `#reach` | *not in source* (inherits default) | *not in data.json* (defaults during resolveAttack) | Default from `STRUCT_ATTACK.reach = 25` (weapon.ts:172, registry.ts:29) | ✓ |
| 8 | `#sound` | `"skeleton_fire"` (act_kingSword.txt:16) | `"skeleton_fire"` (data.json) | Played on melee hit via CpuAI.executeAttack() → control.ts line 632 (atkSound forwarded to PlaySound gate) | ✓ |

---

## Resolution Trace

### Registry Resolution (spawnEnemy → kingInGame)

```
registry.resolveActor("kingInGame")
  └─ kingInGame has no own #attack
  └─ kingInGame declares #weapon: #kingSword
  └─ resolveActor("kingSword") returns attack data
     └─ Merged with STRUCT_ATTACK (deepModify, weapon.ts:109)
```

**Result (data.json):**
```json
{
  "act_kingSword": {
    "data": {
      "objType": "#objPowerUp",
      "inherit": "#weapon",
      "attack": {
        "animType": "#weaponMelee",
        "cooldown": 5,
        "damageMultiplier": 3,
        "hits": ["#teamMembers", "#teamBuildings"],
        "idealAttackLoc": { "x": 12, "y": 0 },
        "name": "#kingSword",
        "power": { "x": 0.5, "y": 0 },
        "sound": "skeleton_fire"
      }
    }
  }
}
```

### Port Melee Damage Application (archetypes.ts → control.ts → weapon.ts)

**Spawn (archetypes.ts:136–320):**
1. `spawnEnemy("kingInGame", x, y)` reads registry
2. kingInGame has no own #attack → uses #weapon's attack
3. `atk = resolveActor("kingSword")["attack"]`
4. `enemyAttack = resolveAttack({ ...atk, cooldown: 12 })` — K1 effective cooldown re-derived per enemy skill stats (from 5 → 12 via agility 1 formula)

**Attack Execution (control.ts:623–631):**
```typescript
const ca = this.entity.get(WeaponManager).getCurrentAttack();  // kingSword
const base = enemyMeleeBasePower(ca, 15);  // powerScalar 0.5 · strength 15 · ENEMY_DAMAGE_SCALE 0.18 = 1.35
const mult = ca.damageMultiplier;  // 3
game.teamMaster.impactMeleeAttack(this.entity, meleeHitFn(this.entity, id, base, mult));
```

**Damage Resolution (teams.ts:286–292, combat.ts:31–52):**
```typescript
// meleeHitFn callback per victim:
v.send("takeHit", vec.x, vec.y, attackerId, mult);  // mult = 3

// Energy.takeHit (combat.ts:35):
const dmg = (Math.abs(vx) + Math.abs(vy)) * mult;  // = 1.35 · 3 = 4.05
this.energy -= dmg;
```

---

## Melee Classification & Mechanics Verification

| Aspect | Original | Port | Evidence |
|--------|----------|------|----------|
| **Classification** | `#animType: #weaponMelee` | Maps to `type: "melee"` | `typeFromAnimType("#weaponMelee") → "melee"` (weapon.ts:94–102) |
| **Reach** | Default 25 (not in source) | Default 25 (not in JSON, computed at resolveAttack) | `STRUCT_ATTACK.reach = 25` (registry.ts:29); `numOr(r["reach"], 25)` (weapon.ts:172) |
| **Cooldown Re-derivation** | 5 frames raw; scaled by enemy agility for effective frames | Effective cooldown = round((rawCooldown + 6) · agility + 1) | K1 plan: framesWanted = 5 + 6 = 11; counterInc = agility = 1 (melee default); effectiveCooldown = round(11 · 1 + 1) = 12 frames (kingInGame dexterity=3 is only for ranged, not used here) (archetypes.ts:176–188) |
| **Damage Formula** | `power · strength · scale · mult` → L1 of vector | `(powerScalar · strength · ENEMY_DAMAGE_SCALE) · damageMultiplier` | 0.5 · 15 · 0.18 · 3 = 4.05 per hit (weapon.ts:149, combat.ts:35) |
| **Sound** | `#sound: "skeleton_fire"` on swing | Played via CpuAI or PlaySound component | `atkSound = "skeleton_fire"` forwarded to execution |

---

## Excluded (Per Audit Scope)

The following are NOT flagged per instructions:
- ✓ `#animframe: 7` — animation frame index (out of scope)
- ✓ `#collisionLoc: point(12,0)` — collision geometry (out of scope)
- ✓ `#idealAttackLoc: point(12,0)` — attack placement hint (out of scope)
- ✓ `weaponTechnique` — attack animation speedup (out of scope)
- ✓ `dammageMultiplier` typo — recognized as a data-file artifact (out of scope)
- ✓ K1 cooldown re-derivation — documented divergence (enemy-side scaling, out of scope)

---

## Conclusion

**All audit-scope attack properties for `#kingSword` are faithfully resolved and applied:**
- ✓ `#animType: #weaponMelee` → correctly classified as melee
- ✓ `#cooldown: 5` → correctly stored and effective-scaled for enemies
- ✓ `#damageMultiplier: 3` → faithfully applied to damage vector
- ✓ `#power: point(0.5, 0)` → powerScalar correctly extracted and used in melee base power
- ✓ `#reach: 25` (default) → correctly defaulted during resolveAttack
- ✓ `#hits: [#teamMembers, #teamBuildings]` → correctly target-filtered during melee impact
- ✓ `#sound: "skeleton_fire"` → correctly forwarded to sound system

**No divergences detected.**

---

**ACTOR=kingSword | CLEAN**
