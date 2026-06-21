# Behavioral Parity Audit: townWatch

**Actor**: townWatch  
**Type**: objCPUCharacter (CPU melee fighter)  
**Team**: #village (friendly to #aldevar, #monsterSummon)  
**Weapon**: #townMace (#weaponMelee, melee attack)  
**AI**: #objAiCPU (committed-target FSM)

---

## Property Coverage

| Property | Casts | Port | Mapped | Notes |
|----------|-------|------|--------|-------|
| objType | #objCPUCharacter | #objCPUCharacter | ✓ | → EnemyArchetype |
| AiType | #objAiCPU | #objAiCPU | ✓ | → CpuAI component |
| inherit | #CPUCharacter | #CPUCharacter | ✓ | Resolved via registry |
| team | #village | #village | ✓ | Team allegiance set in Team component |
| strength | 8 | 8 | ✓ | Melee damage base |
| dexterity | 6 | 6 | ✓ | Ranged cooldown inc (not used for melee) |
| energy | 75 | 75 | ✓ | Initial energy |
| walkSpeed | 2 | 2 → 1.2 px/tick | ✓ | Converted: *0.6 scaling |
| weapon | #townMace | #townMace | ✓ | Resolves to melee attack |
| inertia | 90 | 90 | ✓ | Knockback resistance |
| damageSpeed | 2 | 2 | ✓ | Not flagged for omission (non-issue) |
| experienceImWorth | 10 | 10 | ✓ | XP granted on death |
| eyestrain | 60 | 60 | ✓ | Not flagged for omission (non-issue) |
| miniMapStatus | #clr | #clr | ✓ | Minimap display mode |

---

## Weapon Resolution: #townMace

The townWatch #weapon property references the `act_townMace` actor, which carries a `#weaponMelee` attack.

| Property | Casts | Port | Status |
|----------|-------|------|--------|
| attack.name | #townMace | #townMace | ✓ |
| attack.animType | #weaponMelee | #weaponMelee | ✓ |
| attack.power | point(2, 0) | {x: 2, y: 0} | ✓ |
| attack.damageMultiplier | 5 | 5 | ✓ |
| attack.cooldown | 0 | 0 | ✓ |
| attack.sound | "skeleton_fire" | "skeleton_fire" | ✓ |
| attack.hits | [#teamMembers, #teamBuildings] | ["#teamMembers", "#teamBuildings"] | ✓ |
| attack.targetRoles | [[#teamMembers, #teamBuildings]] | [["#teamMembers", "#teamBuildings"]] | ✓ |

**Weapon flow**: spawnEnemy reads #weapon → resolves act_townMace → extracts #weaponMelee attack → sets as current weapon in WeaponManager.

---

## Team Allegiance: #village

Team #village (tem_village.txt) defines the townWatch's friend/foe rules.

| Property | Casts | Port | Status |
|----------|-------|------|--------|
| teamName | #village | #village | ✓ |
| friends | [#aldevar, #monsterSummon] | ["#aldevar", "#monsterSummon"] | ✓ |
| hates[0] | [[#blackSorcerer, #goblins, #karate, #magicalAlliance, #monsters, #swamp, #ninja, #pitMonsters, #undead, #ice, #scarlet, #orcs]] | Same (array of tier arrays) | ✓ |

**Targeting logic** (teamMaster.ts):
1. townWatch queries: `calcTargetTeams(#village, #enemy)`
2. Returns: village.hates[0] = 12 hostile teams
3. findTarget searches: nearest non-dead member of those teams within range
4. Hits applied via: impactMeleeAttack with hits=[#teamMembers, #teamBuildings]

---

## Behavioral Verification

### AI Classification (spawnEnemy @ archetypes.ts:164–170)
- Attack animType: **#weaponMelee** → type = "melee"
- Ranged detection: `animType !== "#weaponRanged" && animType !== "#naturalRanged" && animType !== "#magic"` → **false**
- Result: **Melee AI** (not ranged; uses reach=22px, not reachRanged=150px)

### Attack Cooldown Calibration (archetypes.ts:180–188)
- Raw cooldown: 0 (from townMace)
- Frames wanted: 0 + 6 = 6 (melee base)
- Counter inc: agility (6) — melee uses agility, not dexterity
- Effective cooldown: ⌈6 × 6 + 1⌉ = **37 frames**
- Result: Cooldown counter runs 0→37, resets on fire; matches slice's melee pacing

### Melee Damage & Power (control.ts:252–274, weapon.ts:144–146)
- Base: `enemyMeleeBasePower(attack, strength)` = power.x × strength × ENEMY_DAMAGE_SCALE
  - = 2 × 8 × 0.18 = **2.88**
- Final: base × damageMultiplier = 2.88 × 5 = **14.4 per swing**
- Multiplier applies *multiplicatively* (not additive; faithful to original)
- Status: ✓ Correct (K1 enemy scaling; no regression)

### Movement & Death
- **Movement**: walkSpeed=2 → 2 × 0.6 = 1.2 px/tick (uniform scaling for all actors; tuned to slice pacing)
- **Death**: Energy component triggers at energy ≤ 0 (standard)
- **Status**: ✓ Standard behavior

### FSM & Commitment (control.ts:296–451)
- Mode loop: `findTarget` → (target found) → `moveToAttack` → (in reach) → `attack` → `attackFin` → refresh target
- Target commitment: once acquired via findTarget, re-held for 30 frames (RETARGET throttle) before forced refresh
- Dazed on reel/recoil/die, idle on no target
- Status: ✓ Faithful to objAiCPU logic

---

## Catalog Check (Non-Issues per Audit Scope)

The following properties are listed as "already-implemented (don't flag)":
- damageSpeed, maxEnergy, collideWithTarget, weight/gravity, jumpPower, walkAcceleration, stretchDeath, frictionReel, stallSpeed, walkType, initLoc/initVect/masterPrg/createOnSolid/collisionRect, strength/damageMultiplier (typos), collisionDetection, miniMapStatus, speechColor, counterColour, startOffset, layerZ, initFaceDir, rotational, splashGraveOn, audio/volume, eyestrain, attack.animFrame, weaponTechnique, attack.collisionLoc

All encountered in townWatch data are **correctly ignored**:
- eyestrain (60): ignored ✓
- damageSpeed (2): ignored ✓
- miniMapStatus (#clr): ignored ✓

---

## Conclusion

✅ **CLEAN**

- All properties present in data are resolved and applied correctly.
- Weapon #townMace resolves to melee attack with correct power/damage/hits.
- Team #village allegiance configured: friends=[#aldevar, #monsterSummon], hates=12 teams.
- Melee AI flow (findTarget→moveToAttack→attack) operates faithfully.
- Cooldown calibration preserves slice pacing (37 frames effective).
- Damage scaling (power × strength × ENEMY_DAMAGE_SCALE × damageMultiplier) is correct and K1-compliant.
- Movement and death are standard (no divergence).
- No gaps in behavioral correctness.
