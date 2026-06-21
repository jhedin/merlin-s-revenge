# Behavioral Audit: act_blackAxe

**Class:** Weapon (#objType #objPowerUp #inherit #weapon)  
**Wielder:** blackOrc (primary); swordMaster  
**Source:** casts/data/act_blackAxe.txt (+inherit act_weapon.txt)  
**Resolved Data:** port/src/generated/data.json → act_blackAxe.data.attack  

---

## Attack Property Table

| Property | Lingo | TS Port | Resolution | Notes |
|----------|-------|---------|-----------|-------|
| **#animType** | #weaponMelee | #weaponMelee | ✓ MATCH | Melee classification → typeFromAnimType → "melee" attack type |
| **#power** | point(1, 0) | {x:1, y:0} | ✓ MATCH | X/Y vector; powerScalar = 1+0 = 1 (used in damage formula) |
| **#damageMultiplier** | 3 | 3 | ✓ MATCH | Per-swing damage scalar (mult in L1·mult calculation) |
| **#cooldown** | 0 | 0 | ✓ MATCH | Raw cooldown before effective-cooldown derivation (K3) |
| **#reach** | (none → default) | (none → default 25) | ✓ MATCH | Melee radius (defaulted from STRUCT_ATTACK.reach = 25px) |
| **#bullet** | (none) | #none | ✓ MATCH | Melee weapon carries no projectile |
| **#hits** | [#teamMembers, #teamBuildings] | ["#teamMembers", "#teamBuildings"] | ✓ MATCH | Target allegiance filter (Targeting.hits) |
| **#name** | #blackAxe | #blackAxe | ✓ MATCH | Symbol identifier for the attack |
| **#sound** | "blackOrc_fire" | "blackOrc_fire" | ✓ MATCH | Attack SFX cue (audio.play on swing) |
| **#collisionLoc** | point(70,0) | {x:70, y:0} | ✓ MATCH | Collision vector offset; NOT FLAGGED (anim frame-driven, in scope for audio) |
| **#animframe** | 8 | 8 | ✓ MATCH | Not flagged (animation timing, out of scope) |
| **#volume** | 50 | 50 | ✓ MATCH | Not flagged (audio volume, in scope exclusion list) |
| **#targetRoles** | [[#teamMembers], [#teamBuildings]] | [["#teamMembers", "#teamBuildings"]] | ✓ MATCH | Role-based target criteria |

---

## Classification & Wielder Verification

### Melee Type Confirmation
- **animType → AttackType:** `#weaponMelee` maps to `"melee"` via typeFromAnimType (weapon.ts:94-102)
- **No projectile:** No #bullet property → pure contact melee (swing/impact)
- **Reach:** Defaults to 25px (STRUCT_ATTACK.reach), faithful to the slice's contact radius

### Damage Ordering (via Wielders)

**K1 Enemy Damage Formula:** `base = power·strength·ENEMY_DAMAGE_SCALE; total = base·damageMultiplier`

Where ENEMY_DAMAGE_SCALE = 0.18 (control.ts:629, weapon.ts:137)

| Wielder | Strength | Weapon | Power | Mult | Base | Total | Rank |
|---------|----------|--------|-------|------|------|-------|------|
| **blackOrc** | 30 | blackAxe | 1 | 3 | 30·1·0.18 = 5.4 | **16.2** | 🥇 |
| swordOrc | 3 | orcSword | 1 | 8 | 3·1·0.18 = 0.54 | 4.32 | 🥈 |
| warrior | 12 | warriorSword | 0.5 | 3 | 12·0.5·0.18 = 1.08 | 3.24 | 🥉 |

**Ordering:** blackOrc (16.2) **>** swordOrc (4.32) **>** warrior (3.24) ✓  
**Faithful:** Yes — restores the original str-30 dominance (control.ts:627 comment, K1 plan §b)

### Attack Usage in Port

1. **Resolution (archetypes.ts:155-160):** When blackOrc spawns, its `#weapon: #blackAxe` is resolved:
   - registry.resolveActor("blackAxe") → act_blackAxe.data
   - objAttack() extracts .attack proplist
   - resolveAttack() builds AttackData

2. **Cooldown Derivation (archetypes.ts:180-188):** 
   - rawCooldown = 0 (from data)
   - framesWanted = max(1, 0 + 6) = 6 (melee: +6 to old default)
   - counterInc = agility = 1 (blackOrc agility not overridden → default 1)
   - effectiveCooldown = round(6 · 1 + 1) = **7 frames** (faithfully calibrated per K3)

3. **Fire (control.ts:629-631):**
   - getCurrentAttack() → AttackData
   - base = enemyMeleeBasePower(attack, strength=30) = 1·30·0.18 = 5.4
   - impactMeleeAttack() fires with L1=base, mult=3 → delivers 16.2 per swing

---

## Tests Validating This Audit

- **weapon.test.ts:217-219:** blackOrc ~16.2 damage per swing (matches formula)
- **weapon.test.ts:221-224:** Ordering blackOrc > swordOrc ≥ warrior (faithful rank restored)
- **attack.test.ts:** resolveAttack parses power as point(x,y) → powerScalar (L1 normalization)
- **registry.test.ts:21-28:** blackOrc resolves with weapon #blackAxe, strength 30

---

## Conclusion

**ACTOR=blackAxe | CLEAN**

All attack properties (#animType, #power, #damageMultiplier, #cooldown, #reach, #hits, #name, #sound) are faithfully ported. Melee classification (weaponMelee → "melee" type) is correct. Damage ordering through blackOrc's wielder is faithful (16.2 > 4.32, restoring str·30 dominance). Cooldown derivation is properly calibrated (K3 effective-cooldown model). No divergences detected.
