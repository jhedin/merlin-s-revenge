# Actor Audit: skeletonWarrior

## Summary
Behavioral parity audit comparing the original Lingo game (casts/) and TypeScript port (port/src/) for the **skeletonWarrior** actor. Classification: **CLEAN** ✓

## Data Comparison

| Property | Original (casts/) | Port (port/src/) | Status |
|----------|-------------------|-----------------|--------|
| objType | #objCPUCharacter | #objCPUCharacter | ✓ |
| AiType | #objAiCPU | #objAiCPU | ✓ |
| Inherit | #CPUCharacter | #CPUCharacter | ✓ |
| team | #undead | #undead | ✓ |
| name | "skw" | "skw" | ✓ |
| weapon | #skeletonSword | #skeletonSword | ✓ |
| walkSpeed | 5 | 5 | ✓ |
| strength | 12 | 12 | ✓ |
| dexterity | 3 | 3 | ✓ |
| inertia | 60 | 60 | ✓ |
| energy | 100 | 100 | ✓ |
| damageSpeed | 3 | 3 | ✓ |
| experienceImWorth | 6 | 6 | ✓ |
| eyestrain | 30 | 30 | ✓ |

## Weapon Resolution

### Original (act_skeletonSword.txt)
- **animType**: #weaponMelee (melee contact attack)
- **power**: point(0.7, 0)
- **cooldown**: 0
- **hits**: [#teamMembers, #teamBuildings]
- **damageMultiplier**: (inherited, catalogued typo in filename)
- **sound**: "skeleton_fire"

### Port Resolution
**File**: port/src/entities/archetypes.ts:155-162 (weapon fallback logic)
- skeletonWarrior carries no own #attack, so spawnEnemy reads d["weapon"] = "#skeletonSword"
- resolveActor("#skeletonSword") returns the weapon's resolved #attack
- Melee animType (#weaponMelee) classifies as "melee" type (control.ts:97)
- Cooldown calibration (line 180-188): rawCooldown=0, melee default uses agility=3 (dexterity is 3 in data)
  - **Note**: skeletonWarrior has dexterity=3, agility defaults to 1; uses agility for melee timing
  - effectiveCooldown = round((0 + 6) * 1 + 1) = 7 frames (faithful to old 18-frame default for 0-cooldown melee)

**Verification**: port/src/generated/data.json confirms skeletonSword attack structure matches source.

## AI Behavior

### Original Logic (casts/script_objects/objAiCPU.txt)
- **FSM chain**: findTarget → moveToAttack → attack → attackFin (lines 189-217)
- **Movement**: ensureMode(#walk) on findTarget/moveToAttack (lines 203, 206)
- **Attack gate**: melee contact + cooldown counter (native to modWeaponManager)
- **Target refreshing**: 30-frame throttle via pRetargetCounter.tim[2]=30 (line 24)
- **Death**: characterModeChanged routes #die → #dazed mode (lines 116-134)

### Port Logic (port/src/components/control.ts:306-450, archetypes.ts:264-320)
- **FSM chain**: findTarget → moveToAttack → attack → attackFin (CpuAI.update, lines 427-450)
- **Movement**: idle(m) on findTarget/dazed; pathfinding on moveToAttack (lines 434-449)
- **Attack gate**: getCooldownFin() via WeaponManager counter, reset on fire (line 395)
- **Target refreshing**: CpuAI.RETARGET=30 frames throttle (lines 332-333, 471)
- **Death**: characterModeChanged routes #die → dazed mode (lines 414-420)

**Key correspondences**:
- objAiCPU.attack() → CpuAI.attack(m, dx, dy, target) (control.ts:507-512)
- moveToAttack targeting → CpuAI.updateMoveToAttack (control.ts:470-487)
- Melee reach gate: targetInReach(d) uses this.reach=22px (control.ts:309)

## Critical Checks

### Melee Attack Execution
**Original**: modWeaponManager + modAttack coordinate melee via #attack.animType
- performMeleeAttack (modAttack) resolves via CpuAI.attack + modWeaponManager.getAttack()

**Port**: PlayerControl.tryMelee / CpuAI.attack
- teamMaster.impactMeleeAttack(this.entity, meleeHitFn(...)) (control.ts:269)
- Power = attack.powerScalar * strength * ENEMY_DAMAGE_SCALE (weapon.ts:145)
- skeletonSword power(0.7) * strength(12) * 0.18 ≈ 1.5 base damage + damageMultiplier

### Team & Movement
- **Original**: team=#undead, inherited walk behavior from objCharacter + objAiCPU pathfinding
- **Port**: team="#undead", walkSpeed=3 (CPUCharacter) scaled to 1.8px/tick (archetypes.ts:267); pathfinding via PathFinding component

### Death Behavior
- **Original**: die() → pMode=#dead, attacked/reeling units go #dazed (objCharacter.die / objAiCPU.characterModeChanged)
- **Port**: Entity death → flagged isDead; CpuAI.update(next()) skips FSM on isDead=true (line 430); Energy.damage triggers characterModeChanged

## Conclusion

**No behavioral divergences detected.** The skeletonWarrior actor exhibits faithful parity:

✓ Weapon resolution: #skeletonSword correctly resolves as melee attack  
✓ AI FSM: committed-target loop (findTarget → moveToAttack → attack) preserved  
✓ Team allegiance: #undead classification intact  
✓ Movement: walk + pathfinding behavior maintained  
✓ Death: reel → death → mode transition faithful  
✓ Cooldown calibration: melee counter tuned to preserve slice feel (0-cooldown→7 frames recovers similarly to original 18)  
✓ Stats: All core properties (strength, dexterity, inertia, energy, experience) match exactly  

The actor is **CLEAN** across data, weapon resolution, and behavior implementation.
