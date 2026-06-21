# Actor Audit: skelitonFootSoldier

## Data Properties

| Property | Original (Lingo) | Port (TypeScript) | Status |
|----------|------------------|-------------------|--------|
| objType | #objCPUCharacter | EnemyArchetype | ✓ |
| AiType | #objAiCPU | EnemyAI (control.ts) | ✓ |
| inherit | #CPUCharacter | EnemyArchetype defaults | ✓ |
| energy | 90 | 90 | ✓ |
| strength | 3 | 3 | ✓ |
| dexterity | 10 | 10 | ✓ |
| walkSpeed | 4 | 4 (calibrated to px/tick) | ✓ |
| inertia | 85 | 85 | ✓ |
| team | #undead | "#undead" | ✓ |
| attack | #weaponMelee swordSwipe | resolved to #swordSwipe | ✓ |
| dieSound | #none | undefined (no sound) | ✓ |
| startingLevel | 0 | 0 (no pre-leveling) | ✓ |
| weaponTechnique | 0 | 0 (no animation speedup) | ✓ |
| experienceImWorth | 3 | 3 | ✓ |
| damageSpeed | 3 | (catalogued non-issue) | ✓ |
| eyestrain | 25 | (catalogued non-issue) | ✓ |
| graveOn | true | grave drawn via Grave component | ✓ |
| reincarnateAs | absent | absent (leaf node) | ✓ |
| reincarnateInto | absent | absent (leaf node) | ✓ |

## Attack (swordSwipe) Properties

| Property | Original | Port | Status |
|----------|----------|------|--------|
| animType | #weaponMelee | "#weaponMelee" | ✓ |
| power | point(3,0) | {x:3, y:0} powerScalar=3 | ✓ |
| cooldown | 0 | 0 (calibrated to ~25 effective) | ✓ |
| collisionLoc | point(20,0) | {x:20, y:0} (projectile only) | ✓ |
| hits | [#teamMembers, #teamBuildings] | same | ✓ |
| name | #swordSwipe | "#swordSwipe" | ✓ |
| sound | "skeleton_fire" | "skeleton_fire" | ✓ |
| damageMultiplier | 1 | 1 | ✓ |

## Behavioral Coverage

| Behavior | Status | Evidence |
|----------|--------|----------|
| **Melee AI FSM** | ✓ | animType "#weaponMelee" → ranged=false (archetypes.ts:169); triggers moveToAttack/attack loop |
| **Attack Resolution** | ✓ | animType="#weaponMelee" present; direct melee attack used (archetypes.ts:145) |
| **Weapon Reach** | ✓ | Default melee reach 22px used in targetInReach (control.ts:499) |
| **Team (#undead)** | ✓ | team="#undead" persists through EnemyArchetype.build (archetypes.ts:270) |
| **Melee Power Calc** | ✓ | power·strength·ENEMY_DAMAGE_SCALE (3·3·0.55 ≈ 4.95 base) (weapon.ts) |
| **Cooldown Calibration** | ✓ | rawCooldown=0 + melee offset 6 + dexterity(10)×agility(1) tuning → ~25 effective frames (archetypes.ts:180-188) |
| **Damage Application** | ✓ | Melee: impactMeleeAttack resolves via meleeHitFn vector + damageMultiplier (control.ts:609) |
| **Death** | ✓ | dieSound=#none, graveOn=true → grave drawn via Grave component (Energy.isDead) |
| **Movement** | ✓ | walkSpeed 4 → 2.4 px/tick (calibrated 0.6× factor), inertia 85 knockback damping |
| **No Reincarnation** | ✓ | No reincarnateAs/reincarnateInto in data; skelitonFootSoldier is a standalone enemy (not part of a cascade) |
| **No Multi-attack** | ✓ | Single melee weapon, multiAttack not set |
| **No Runreload** | ✓ | ranged=false; runReload=false (archetypes.ts:211) |

## Context

skelitonFootSoldier is a standalone melee enemy unit (not spawned via reincarnation):
- Basic foot soldier in the undead army
- Differs from skelitonArm (which spawns as part of skelitonLord cascade)
- Pure melee combatant with consistent attack profile
- Part of broader skeleton family but leaf node with no child spawns
- Commonly encountered enemy throughout gameplay

## Conclusion

**CLEAN**

skelitonFootSoldier exhibits complete behavioral parity between the original Lingo definition and the TypeScript port:
- All data properties correctly transferred and calibrated (energy, strength, dexterity, walkSpeed, inertia)
- Melee AI classification via #weaponMelee animType is accurate
- Cooldown calculation faithfully preserves original attack feel (atkCooldown + melee offset × dexterity)
- Direct melee attack routing (swordSwipe embedded in actor, not external weapon) matches original modWeaponManager logic
- Team allegiance (#undead) and targeting preserved
- Proper leaf-node behavior (no reincarnation cascade initiated on death)
- No blocking gaps detected

No gaps identified.
