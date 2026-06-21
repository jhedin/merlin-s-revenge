# garTower Behavioral Parity Audit

## Actor Profile
- **Original**: casts/data/act_garTower.txt (inherits #CPUCharacter)
- **Port data**: port/src/generated/data.json → `act_garTower`
- **Port logic**: port/src/entities/archetypes.ts (spawnEnemy), components/control.ts (CpuAI), components/movement.ts, components/hurt.ts

## Property Coverage & Behavioral Verification

| Property | Original (Lingo) | Port (TypeScript) | Status | Notes |
|----------|------------------|------------------|--------|-------|
| **objType** | #objCPUCharacter | EnemyArchetype | ✓ | Correct archetype routed |
| **AiType** | #objAiCPU | CpuAI component | ✓ | Committed-target FSM (findTarget→moveToAttack→attack) |
| **animType** | #weaponRanged | resolveAttack from data | ✓ | Ranged classification drives reachRanged gating (line 358 control.ts) |
| **walkSpeed** | 0 | 0 * 0.6 = 0 | ✓ | Movement.maxSpeed=0 caps vx/vy at 0; stationary enforced (movement.ts:37,86-87) |
| **reach** | 180 (attack.reach) | 180 | ✓ | CpuAI.reachRanged = min(220, max(60, 180)) = 180 (control.ts:358) |
| **bullet** | #scArcherArrow | #scArcherArrow | ✓ | Resolved at attack-fire; archerArrow power/mult carried (control.ts:562-576) |
| **firingType** | #fullstrength | #fullstrength | ✓ | CpuAI.attack reads firingType; throwSpeed = strength (control.ts:531-532) |
| **reelProof** | true | true | ✓ | Hurt.reelProof=true skips knockback impulse (hurt.ts:17,41; movement.ts:57) |
| **team** | #goblins | #goblins | ✓ | Team component set at build (archetypes.ts:266) |
| **teamRole** | #teamBuildings | #teamBuildings | ✓ | TeamRole set at build; targets targetable by hunting units (archetypes.ts:266) |
| **inertia** | 85 | 85 | ✓ | Knockback damping ratio (movement.ts:41,55) |
| **energy** | 100 | 100 | ✓ | Energy.init from data (archetypes.ts:264) |
| **strength** | 15 | 15 | ✓ | Enemy melee/power scalar (archetypes.ts:265) |
| **dexterity** | 3 (attack.dexterity: 1) | 1 (attack.dexterity) | ✓ | Attack cooldown counter inc for ranged (archetypes.ts:174,187) |
| **reincarnateAs** | [#goblinArcher] | [#goblinArcher] | ✓ | Reincarnate component on lethal death (archetypes.ts:301) |
| **modGrave** | inherited | Grave component | ✓ | Death/grave anim on lethal hit (EnemyArchetype line 36) |

## Behavioral Checklist

### Stationary Tower
- ✓ **Never moves**: walkSpeed 0 enforced via Movement.maxSpeed=0 cap in update loop
- ✓ **Idle intent**: CpuAI.idle(m) zeroes intentX/intentY when in range (control.ts:516)
- ✓ **Always fires from one loc**: Position held throughout combat

### Ranged AI (objAiCPU)
- ✓ **FindTarget mode**: Acquires target via teamMaster.findTarget (control.ts:501)
- ✓ **MoveToAttack**: N/A (stationary), but targetInReach uses reachRanged band (control.ts:486)
- ✓ **Ranged classification**: animType #weaponRanged → ranged=true (archetypes.ts:169)
- ✓ **Reach 180**: Fires at targets within 180px (CpuAI.reachRanged=180)
- ✓ **Attack firing**: CpuAI.attack ranged branch fires scArcherArrow (control.ts:521-579)

### Knockback Immunity (reelProof)
- ✓ **No knockback impulse**: Movement.takeHit checks isReelProof, skips kvx/kvy add (movement.ts:57)
- ✓ **Still takes damage**: takeHit passes inertia-damped vector to next (movement.ts:63)
- ✓ **No reel animation**: Hurt.takeHit skips flashT/reel if reelProof (hurt.ts:41)
- ✓ **Lethal hit triggers #die**: Dead flag gates reel skip (hurt.ts:41 `!reelProof || dead`)

### Bullet Behavior
- ✓ **Bullet resolution**: #scArcherArrow data-driven power (0.9) and damageMultiplier (5) (data.json, control.ts:562-576)
- ✓ **#fullstrength firing**: throwSpeed = strength = 15 (not distance-proportional) (control.ts:531-532)
- ✓ **Bullet carries attack**: Resolved once at fire; damage = powerScalar * dmgRef * BULLET_DAMAGE_SCALE * mult (control.ts:563-565)

### Team & Allegiance
- ✓ **Team #goblins**: Set at spawn; hunted by #aldevar units (spawnEnemy line 266)
- ✓ **TeamRole #teamBuildings**: Targetable by units with building-role targeting criteria (archetypes.ts:266)
- ✓ **Enemy type**: Routed to "enemy" in spawnUnit/spawnEnemy logic (archetypes.ts:58)

### Death
- ✓ **Grave on death**: Grave component plays death anim (EnemyArchetype, hurt.ts:47)
- ✓ **Reincarnate**: Lethal hit triggers Reincarnate → splits into [#goblinArcher] at corpse (archetypes.ts:301)
- ✓ **Finishes**: characterModeChanged #die → CpuAI dazed → leaveGame or persist as corpse

## Comparison: garTower vs dwarfTower

Both towers diverge intentionally on:
- **Team**: garTower #goblins, dwarfTower #aldevar (allies)
- **Bullet**: garTower #scArcherArrow (power 0.9, mult 5), dwarfTower #towerAxe (splash/explode)
- **Reach**: garTower 180, dwarfTower 600 (much longer)
- **animType**: garTower #weaponRanged, dwarfTower #naturalRanged (both ranged)
- **Both**: walkSpeed 0, reelProof true, teamRole #teamBuildings ✓

## Conclusion
**CLEAN** — garTower is fully ported with faithful property coverage and correct behavioral implementation. Stationary firing, ranged AI, bullet resolution, reelProof, and team allegiance all verified in the port's EnemyArchetype + CpuAI + Movement + Hurt chain.
