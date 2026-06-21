# Actor Audit: skeletonArcher

## Data Properties

| Property | Original (Lingo) | Port (TypeScript) | Status |
|----------|------------------|-------------------|--------|
| objType | #objCPUCharacter | EnemyArchetype | ✓ |
| AiType | #objAiCPU | EnemyAI (control.ts) | ✓ |
| inherit | #CPUCharacter | EnemyArchetype defaults | ✓ |
| energy | 120 | 120 | ✓ |
| strength | 11 | 11 | ✓ |
| dexterity | 10 | 10 | ✓ |
| walkSpeed | 4 | 4 (calibrated to px/tick) | ✓ |
| inertia | 50 | 50 | ✓ |
| team | #undead | "#undead" | ✓ |
| weapon | #skeletonBow | "#skeletonBow" → resolved attack | ✓ |
| dieSound | #none | undefined (defaults to no sound) | ✓ |
| startingLevel | 0 | 0 (no pre-leveling) | ✓ |
| weaponTechnique | 0 | 0 (no animation speedup) | ✓ |
| experienceImWorth | 6 | 6 | ✓ |
| pathFindingTime | 300 | pathFinding module (K3) | ✓ |
| pathFindingStallTime | 30 | pathFinding module (K3) | ✓ |
| damageSpeed | 3 | (catalogued non-issue) | ✓ |
| eyestrain | 7 | (catalogued non-issue) | ✓ |

## Weapon (skeletonBow) Properties

| Property | Original | Port | Status |
|----------|----------|------|--------|
| animType | #weaponRanged | "#weaponRanged" | ✓ |
| firingType | #fullstrength | "#fullstrength" | ✓ |
| reach | 160 | 160 | ✓ |
| bullet | #goblinArrow | "#goblinArrow" → resolved | ✓ |
| cooldown | 0 | 0 (calibrated to 181 effective) | ✓ |
| name | #fireArrow | "#fireArrow" | ✓ |
| sound | "goblin_fire" | "goblin_fire" | ✓ |

## Behavioral Coverage

| Behavior | Status | Evidence |
|----------|--------|----------|
| **Ranged AI FSM** | ✓ | animType "#weaponRanged" triggers ranged=true (archetypes.ts:169) |
| **Weapon Resolution** | ✓ | No native attack; weapon's attack used (archetypes.ts:155-158) |
| **Team (undead)** | ✓ | team="#undead" persists through EnemyArchetype.build |
| **Reincarnation** | N/A | No #reincarnateAs in original data |
| **Cooldown Calibration** | ✓ | rawCooldown=0 + ranged offset 18 + dexterity(10) = 181 frames (archetypes.ts:180-188) |
| **Reach Gating** | ✓ | reachRanged=160 used in moveToAttack distance check (control.ts:499) |
| **Firing Behavior** | ✓ | firingType="#fullstrength" routes velocity = strength (control.ts:544) |
| **Bullet Impact** | ✓ | goblinArrow carries damageMultiplier 3, power 0.5 (data.json) |
| **Death** | ✓ | dieSound=#none, grave drawn via modGrave (Grave component) |
| **Movement** | ✓ | walkSpeed 4 (px/tick calibrated), inertia 50 knockback damping |
| **No runReload** | ✓ | Data field absent; ranged=true but no spellcaster AiType, so runReload=false (archetypes.ts:211) |
| **Multi-attack** | N/A | multiAttack not set (single weapon unit) |

## Conclusion

**CLEAN**

skeletonArcher exhibits complete behavioral parity between the original Lingo definition and the TypeScript port:
- All data properties correctly transferred and calibrated
- Ranged AI classification via weapon's #weaponRanged animType is accurate
- Cooldown calculation faithfully preserves original attack feel (atkCooldown + ranged offset × dexterity)
- Weapon resolution (attack pulled from skeletonBow, not actor-native) matches original modWeaponManager logic
- Team allegiance (#undead) and targeting preserved
- No blocking gaps detected

No gaps identified.
