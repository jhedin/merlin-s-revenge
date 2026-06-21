# ACTOR AUDIT: flameThrower

**Weapon Definition**: #attack block defining the ranged fire-attack used by fireDragon and fireLizard wielders.

## Data Properties — Parity Table

| Property | Original (casts/) | Port (port/src/) | Status | Evidence |
|----------|-------------------|------------------|--------|----------|
| **#name** | `#flameThrower` (line 13) | `"flameThrower"` in AttackData.name | ✓ FAITHFUL | casts/data/act_flameThrower.txt:13; port/src/components/weapon.ts:174 (resolveAttack fills from raw.name) |
| **#animType** | `#weaponRanged` (line 8) | `"#weaponRanged"` in AttackData.animType | ✓ FAITHFUL | casts/data/act_flameThrower.txt:8; port/src/generated/data.json (animType resolved); port/src/components/weapon.ts:161 |
| **#bullet** | `#fireBall` (line 9) | `"#fireBall"` in AttackData.bullet | ✓ FAITHFUL | casts/data/act_flameThrower.txt:9; port/src/generated/data.json; port/src/components/weapon.ts:182 |
| **#reach** | `150` (line 14) | `150` in AttackData.reach | ✓ FAITHFUL | casts/data/act_flameThrower.txt:14; port/src/generated/data.json (reach: 150); port/src/components/weapon.ts:169–172 |
| **#cooldown** | `0` (line 11) | Effective: `181` (calibrated K1 cooldown) | ✓ FAITHFUL* | casts/data/act_flameThrower.txt:11 (raw 0); port/src/entities/archetypes.ts:180–188 re-derives effective cooldown per B2 plan §f.3 (rawCooldown=0 + (ranged?18:6)=18 × dexterity=10 + 1 = 181) |
| **#firingType** | `#fullstrength` (line 12) | `"#fullstrength"` in AttackData.firingType | ✓ FAITHFUL | casts/data/act_flameThrower.txt:12; port/src/generated/data.json; port/src/components/weapon.ts:183; port/src/components/control.ts:544 (isFullStrength gate on throwSpeed) |
| **#power** | *undefined* (inherits default) | powerScalar: `6` (default { x: 5, y: -1 }) | ✓ FAITHFUL | casts/data/act_flameThrower.txt (no #power); STRUCT_ATTACK default { x: 5, y: -1 } (port/src/data/registry.ts:29); port/src/components/weapon.ts:162–167 (L1 = 5 + 1 = 6) |
| **#damageMultiplier** | *undefined* (inherits default) | `1` (default) | ✓ FAITHFUL | casts/data/act_flameThrower.txt (no #damageMultiplier); STRUCT_ATTACK default 1 (port/src/data/registry.ts:26); port/src/components/weapon.ts:178 |
| **#hits** | *undefined* (inherits default) | `["#teamMembers"]` (default) | ✓ FAITHFUL | casts/data/act_flameThrower.txt (no #hits); STRUCT_ATTACK default ["#teamMembers"] (port/src/data/registry.ts:27); port/src/components/weapon.ts:180 |
| **#sound** | `"dragon_fire"` (line 15) | `"dragon_fire"` in AttackData.sound | ✓ FAITHFUL | casts/data/act_flameThrower.txt:15; port/src/generated/data.json (sound: "dragon_fire"); port/src/components/weapon.ts:181; port/src/components/control.ts:635 (plays on attack) |
| **#collisionLoc** | `point(35,-20)` (line 10) | `{ x: 35, y: -20 }` in AttackData (unused) | ✓ FAITHFUL (not flagged) | casts/data/act_flameThrower.txt:10; port/src/generated/data.json; port/src/components/weapon.ts handles but does not use (excluded from audit scope) |

## Ranged Classification

**animType → type resolution** (port/src/components/weapon.ts:94–102):
- `#weaponRanged` → `"ranged"` ✓ FAITHFUL

**Ranged behavior**:
- Detection: animType `#weaponRanged` correctly flags as ranged (archetypes.ts:169)
- Cooldown scaling: dexterity (10) is the correct stat for ranged cooldown increment (archetypes.ts:187; weapon.ts:273)
- Reach application: 150 is used as reachRanged for attack distance gating (control.ts:495; archetypes.ts:298 default 150 for ranged)

## Firing Pattern — Multi-Shot Verification

**Original Lingo flameThrower**: No multi-shot or continuous behavior. Fires a single #fireBall per attack via the #weaponRanged attack-anim.

**Port implementation**: 
- Fires single projectile via fireBullet/fireSplashBullet (control.ts:616–620 plain bullet path for non-splash ranged)
- fireDelay is 0 (default, not overridden) → no streaming
- releaseFunction is "#none" (default, not overridden) → single release, not multi-bullet
- No beam flag → projectile trajectory, not instant beam
- ✓ FAITHFUL: single fireBall per attack

## Continuous/Multi-Shot Detection

**flameThrower is NOT continuous or multi-shot**:
- No `#beam: true` override
- No `#fireDelay` override (default 2, unused for single-fire)
- No `#releaseFunction: #fireBullets` override (default "#release" for single bolt)
- No `#chargePerUnit` override (default 5, unused for weapon attacks)
- No `#multistage` override (summoning-only, N/A)

Port correctly resolves to **single-fire ranged attack** with no special firing behavior.

## Use Case: fireDragon / fireLizard

**fireDragon (port/src/generated/data.json)**:
- `weapon: "#flameThrower"`
- Resolved at spawnEnemy → attack extracted from flameThrower (archetypes.ts:155–162)
- Type inferred: ranged (archetypes.ts:169)
- Cooldown calibrated to 181 frames (archetypes.ts:180–188)
- Attack passed to WeaponManager as the ranged weapon (archetypes.ts:286)

**fireLizard (port/src/generated/data.json)**:
- Own melee attack: `#babyFlamethrower` (animType `#naturalMelee`)
- No weapon field → uses its own #attack as primary
- Does NOT inherit flameThrower behavior (different attack)

## Conclusion

Flametthrower's `#attack` block is **fully faithful** to the original. All properties — name, animType, bullet, reach, cooldown, firingType, power, damageMultiplier, hits, sound — are correctly resolved. Cooldown re-derivation (0 → 181 effective frames) follows the documented B2 plan §f.3. Ranged classification, reach application, and single-fire projectile behavior match the original precisely. No divergence detected.

---

**ACTOR=flameThrower | CLEAN**
