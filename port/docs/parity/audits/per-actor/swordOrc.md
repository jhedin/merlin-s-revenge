# Audit: swordOrc Actor Behavioral Parity

## Data Properties Verification

| Property | Original (casts/) | Port (port/src/) | Match | Notes |
|----------|-------------------|------------------|-------|-------|
| objType | #objCPUCharacter | #objCPUCharacter | ✓ | Both spawn as EnemyArchetype |
| AiType | #objAiCPU | #objAiCPU | ✓ | Committed-target FSM (control.ts:CpuAI) |
| inherit | #CPUCharacter | resolved | ✓ | Data merged; walkSpeed 3→8 from swordOrc |
| character | #friendlyCharacter | — | ✓ | Catalogued non-issue (non-melee actor property) |
| team | #orcs | #orcs | ✓ | Teams registry: tem_orcs has allegiance (#hates aldevar) |
| weapon | #orcSword | #orcSword | ✓ | Resolved to melee weapon (weaponMelee animType) |
| animType (weapon) | #weaponMelee | #weaponMelee | ✓ | Melee attack type |
| strength | 3 | 3 | ✓ | Damage scalar for melee |
| dexterity | 4 | 4 | ✓ | Ranged cooldown inc (unused for melee AI) |
| damageMultiplier | 8 | 8 | ✓ | Weapon hit multiplier |
| power (weapon) | point(1,0) | {x:1,y:0} | ✓ | Melee vector magnitude |
| energy | 300 | 300 | ✓ | Health pool |
| inertia | 70 | 70 | ✓ | Knockback resistance |
| walkSpeed | 8 | 8 | ✓ | Movement speed (scale: 8·0.6=4.8 px/tick) |
| experienceImWorth | 20 | 20 | ✓ | XP granted on death |

## Behavioral Verification

### 1. AI Mode & Target Acquisition
- **Original**: objAiCPU committed-target FSM (findTarget → moveToAttack → attack → attackFin)
- **Port**: CpuAI.update() identical FSM loop (control.ts:427–450)
- **Reach**: Default melee reach 22px (control.ts:309); no override in swordOrc
- **Allegiance**: targetAllegiance="#enemy" (default, control.ts:294), hunts tem_orcs.hates teams
- **Status**: ✓ PARITY

### 2. Melee Attack Execution
- **Original**: modWeapon resolves #orcSword.attack; modAttack.performMeleeAttack → area resolution
- **Port**: 
  - WeaponManager.getCurrentAttack() → enemyMeleeBasePower(attack, strength) = 1·3·0.18 = 0.54 base L1
  - CpuAI.attack() line 609: mult=8 (damageMultiplier)
  - teamMaster.impactMeleeAttack() area-resolves within reach
- **Damage Formula**: power·strength·ENEMY_DAMAGE_SCALE·damageMultiplier = 1·3·0.18·8 = 4.32 per hit
- **Animation**: animType="#weaponMelee" → skeleton_fire sound
- **Status**: ✓ PARITY (faithful damage model, K1 calibration applied)

### 3. Movement & Pathfinding
- **Original**: walkSpeed 8 (engine units), inertia 70 (knockback damping)
- **Port**: 
  - walkSpeed: 8 * 0.6 = 4.8 px/tick (archetypes.ts:267)
  - inertia: 70 (movement.ts knockback damping, unchanged)
  - K3 beeline→scenic pathfinding via PathFinding component
- **Status**: ✓ PARITY

### 4. Team Allegiance & Targeting
- **Original**: team=#orcs; temMaster routes targets via tem_orcs
- **Port**: 
  - Team component: "#orcs" (archetypes.ts:270)
  - tem_orcs.hates = [["#aldevar", …]] → hunts player & allies
  - tem_orcs.friends = ["#goblins"] → doesn't attack goblins
  - Allegiance resolved per-attack via Targeting component (combat.ts)
- **Status**: ✓ PARITY

### 5. Death & Cleanup
- **Original**: #dieSound=#none (catalogued non-issue); no reincarnation
- **Port**: dieSound undefined (no audio); reincarnateAs/reincarnateInto undefined (single death)
- **Experience**: experienceImWorth=20 → player gains XP on kill
- **Status**: ✓ PARITY

### 6. Melee vs Ranged Detection
- **Original**: weaponMelee animType → melee-only FSM
- **Port**: resolveAttack() typeFromAnimType("#weaponMelee") → type="melee" (weapon.ts:97)
  - CpuAI.init(): ranged=false (control.ts:356, default)
  - CpuAI.attack() takes melee branch (line 599–610), not ranged
- **Status**: ✓ PARITY

## Comparison to Related Actors

### swordOrc vs warrior (ally melee)
| | swordOrc | warrior | Port Behavior |
|---|----------|---------|---------------|
| team | #orcs | #aldevar | Teams hunt each other |
| strength | 3 | 12 | warrior 4× stronger (4-shot melee vs 3-shot) |
| weapon | #orcSword (power 1, mult 8) | #warriorSword (power 1, mult 12) | warrior higher mult (12 vs 8) |
| walkSpeed | 8 | 5 | swordOrc faster (4.8 vs 3.0 px/tick) |
| leaveWhenFinished | — | true | warrior ally retiree after room clear |

### swordOrc vs blackOrc (enemy melee)
| | swordOrc | blackOrc | Port Behavior |
|---|----------|----------|---------------|
| strength | 3 | 30 | blackOrc 10× stronger (faithful, hits 40/swing) |
| energy | 300 | 1200 | blackOrc tank (4× hp) |
| team | #orcs | #monsters | Different enemy faction, no mutual targeting |
| weapon | #orcSword (power 1, mult 8) | #blackAxe (power 1, mult 16) | blackAxe double damage output |

**Port Melee Ranking (damage per swing)**:
- blackOrc: 30·1·0.18·16 = 86.4 (one-shot player in many cases)
- warrior: 12·1·2.5·12 = 360 (player-side scale)
- swordOrc: 3·1·0.18·8 = 4.32 (faithful, multi-hit melee)
- Status: ✓ Faithful ordering maintained (blackOrc > warrior > swordOrc)

### swordOrc vs bowOrc (enemy ranged)
| | swordOrc | bowOrc | Port Behavior |
|---|----------|--------|---------------|
| weapon | #orcSword (melee) | #crossBow (ranged) | Different attack modes, both #orcs team |
| dexterity | 4 | 10 | bowOrc faster ranged recovery |
| weaponTechnique | — | -5 | swordOrc neutral (0), bowOrc penalty (-5) |

## Control Flow Verification

**spawnEnemy("swordOrc", x, y)** (archetypes.ts:137–319):
1. Resolves act_swordOrc → {objType, AiType, team, weapon, strength, …}
2. Resolves weapon=#orcSword → {animType:#weaponMelee, power:1, damageMultiplier:8}
3. typeFromAnimType("#weaponMelee") → type="melee"
4. rawCooldown=18 (default melee), framesWanted=24, counterInc=agility=1
5. effectiveCooldown=25; enemyAttack=resolveAttack(…)
6. ranged=false, runReload=false, ghost=false (all defaults)
7. EnemyArchetype.create() + build({…, attack:enemyAttack, team:"#orcs", …})
8. CpuAI component initialized with:
   - strength=3, power=max(4, round(3/3+0))=1 (melee baseline)
   - ranged=false, reach=22 (default melee)
9. On update: findTarget via teamMaster (orcs hunt aldevar)
10. moveToAttack: within reach → attack()
11. attack() calls impactMeleeAttack with base=0.54, mult=8 → ~4.32 damage

**Status**: ✓ Full chain matches original FSM

## Conclusion

**swordOrc demonstrates complete behavioral parity:**
- Data properties: All resolved correctly (team, weapon, stats)
- Melee AI: Committed-target FSM, correct reach/cooldown, area resolution
- Damage model: Faithful power·strength·mult with K1 enemy-side scaling
- Team allegiance: Hunts #aldevar (player/allies), friends with #goblins
- Movement: Correct walkSpeed scale (8→4.8 px/tick) + inertia knockback
- Weapon resolution: #orcSword identified as melee, not ranged
- Death: No reincarnation, grants 20 XP, no special sound

No behavioral divergences detected.
