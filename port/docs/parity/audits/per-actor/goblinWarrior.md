# Audit: goblinWarrior

## Data Properties

| Property | Original (casts/) | Port (port/src/) | Status |
|----------|---|---|---|
| `#name` | `"goblinWarrior"` | `"goblinWarrior"` | ✓ |
| `#objType` | `#objCPUCharacter` | `#objCPUCharacter` | ✓ |
| `#AiType` | `#objAiCPU` | `#objAiCPU` → EnemyAI | ✓ |
| `#inherit` | `#CPUCharacter` | `#CPUCharacter` | ✓ |
| `#damageSpeed` | `3` | Not used (catalogued) | — |
| `#dexterity` | `3` | `3` (in generated data.json) | ✓ |
| `#experienceImWorth` | `2` | `2` (in generated data.json) | ✓ |
| `#eyestrain` | `30` | Not used (catalogued) | — |
| `#inertia` | `30` | `30` (in generated data.json) | ✓ |
| `#strength` | `4` | `4` (in generated data.json) | ✓ |
| `#team` | `#goblins` | `#goblins` (in generated data.json) | ✓ |
| `#walkSpeed` | `4` | `4` (in generated data.json, * 0.6 px conversion) | ✓ |
| `#weapon` | `#goblinSword` | `#goblinSword` (in generated data.json) | ✓ |

## Behavioral Properties

### AI Mode (objAiCPU)
| Property | Original | Port | Status |
|----------|----------|------|--------|
| FSM (findTarget/moveToAttack/runReload/dazed) | objAiCPU.txt L189-218 | control.ts:EnemyAI.update L414-438 | ✓ |
| Target acquisition (refreshTarget) | objAiCPU.txt L273-314 | control.ts:EnemyAI.refreshTarget L499-504 | ✓ |
| Movement to target | objAiCPU.txt L495-529 (updateMoveToAttack) | control.ts:EnemyAI.updateMoveToAttack L457-474 | ✓ |
| Melee attack check | objAiCPU.txt L379-394 (targetInReachMelee) | control.ts:EnemyAI.targetInReach L486 | ✓ |
| Attack execution | objAiCPU.txt L33-40 (attack) | control.ts:EnemyAI.attack L518-597 | ✓ |
| Dazed state handling | objAiCPU.txt L116-135 (characterModeChanged) | control.ts:EnemyAI.characterModeChanged L401-407 | ✓ |
| Retarget throttle (30 frames) | objAiCPU.txt L24, L545-552 (RETARGET) | control.ts:EnemyAI.RETARGET L321 | ✓ |

### Weapon Resolution
| Property | Original | Port | Status |
|----------|----------|------|--------|
| Weapon lookup (#goblinSword) | casts/data/act_goblinSword.txt | port/src/generated/data.json → WeaponManager.getCurrentAttack() | ✓ |
| Attack type (weaponMelee) | act_goblinSword.txt L8 `#animType: #weaponMelee` | resolveAttack() → typeFromAnimType("#weaponMelee") → "melee" | ✓ |
| Power vector | act_goblinSword.txt L15 `point(0.7, 0)` | resolveAttack() → powerScalar = 0.7 | ✓ |
| Damage multiplier | act_goblinSword.txt L11 `#damageMultiplier:2` | resolveAttack() → damageMultiplier = 2 | ✓ |
| Melee damage formula | (str 4 × power 0.7 × mult 2) × MELEE_SCALE | (str 4 × power 0.7 × mult 2) × ENEMY_DAMAGE_SCALE (0.18) | ✓ faithful |
| Attack sound | act_goblinSword.txt L16 `#sound: "skeleton_fire"` | atkSound passed to EnemyAI | ✓ |

### Team & Allegiance
| Property | Original | Port | Status |
|----------|----------|------|--------|
| Team (#goblins) | act_goblinWarrior.txt L12 | generated data.json → spawnEnemy → Team.register(team:"#goblins") | ✓ |
| Allegiance (#enemy) | Default via objAiCPU refreshTarget → teamMaster.findTarget | EnemyAI.refreshTarget → teamMaster.findTarget(targetAllegiance:"#enemy") | ✓ |
| Target rules (via #goblins team) | tem_goblins.txt (#hates=[...]) | teams.ts:TeamMaster.calcTargetTeams(allegiance:"#enemy") → team("#goblins").hates | ✓ |
| Hostile role filter (#hits) | act_goblinSword.txt L12 `#hits:[#teamMembers, #teamBuildings]` | attack.hits passed to impactMeleeAttack | ✓ |

### Movement & Speed
| Property | Original | Port | Status |
|----------|----------|------|--------|
| Walk speed (4 units) | act_goblinWarrior.txt L14 | walkSpeed: 4 * 0.6 px/tick (slice-native conversion) | ✓ |
| Pathfinding enabled | act_CPUCharacter.txt L6 `#pathfinding: true` | EnemyAI.path (PathFinding object), K3 scenic pathfinding | ✓ |
| Friction on platform | act_CPUCharacter.txt L4 `#frictionReel: point(10,10)` | Not used (catalogued) | — |
| Walk type | act_CPUCharacter.txt L7 `#walkType: #anyDirSpeed` | Not used (catalogued) | — |

### Death & Grave
| Property | Original | Port | Status |
|----------|----------|------|--------|
| Death animation | objCPUCharacter.txt L217-247 (updateDead) | objCPUCharacter.ts (not ported; anim handled by Anim component) | ✓ framework |
| Grave spawning | objCPUCharacter.txt L152-156 (flasherFinished → drawGrave) | EnemyArchetype includes Grave component; drawGrave on death | ✓ |
| Dead flag | objCPUCharacter.txt L151 `me.pDead = true` | Energy.isDead / Movement.isDead | ✓ |

### Friendly Variant (act_friendlyGoblinWarrior)
| Difference | Original | Port | Status |
|-----------|----------|------|--------|
| Team only difference | `#team: #village` vs `#goblins` | team:"#village" resolves via allegiance, allied behavior | ✓ |
| MiniMap status | friendlyGoblinWarrior adds `#minimapStatus: #clr` | Port minimapStatus not essential for parity | — |

## Conclusion

**✓ CLEAN**

All critical behavioral properties are faithfully implemented:
- **AI FSM**: findTarget/moveToAttack/runReload/dazed states correctly routed through EnemyAI
- **Weapon resolution**: #goblinSword melee attack resolved with correct power/mult/reach
- **Team allegiance**: #goblins team resolved, targeting via data-driven allegiance rules
- **Melee attack**: targetInReachMelee logic preserved; damage = (power × strength × mult) × ENEMY_DAMAGE_SCALE
- **Death/grave**: Grave component on EnemyArchetype; dead flag set on energy exhaustion
- **Movement**: Walk speed and pathfinding enabled via inherited #CPUCharacter properties

All non-catalogued properties match or are functionally equivalent. The port's use of ENEMY_DAMAGE_SCALE is a documented, deliberate px-scale abstraction (ref: docs/parity/plans/K1-faithful-damage.md) that preserves enemy threat ordering and balancing.
