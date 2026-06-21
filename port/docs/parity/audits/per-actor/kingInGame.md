# Actor Audit: kingInGame

## Summary

The `kingInGame` actor exhibits **behavioral parity** between the original Lingo casts and the TypeScript port. All key properties and behaviors are correctly implemented.

## Property Coverage

| Property | Original | Port | Status |
|----------|----------|------|--------|
| `#objType` | `#objCPUCharacter` | `#objCPUCharacter` | ✓ Correct |
| `#AiType` | `#objAiCPU` | `#objAiCPU` (EnemyArchetype/CpuAI) | ✓ Correct |
| `#team` | `#aldevar` | `#aldevar` | ✓ Correct |
| `#character` | `#friendlyCharacter` | `#friendlyCharacter` | ✓ Correct |
| `#weapon` | `#kingSword` | `#kingSword` (resolved) | ✓ Correct |
| `#leaveWhenFinished` | `true` | `true` (passed to CpuAI init) | ✓ Correct |
| `#strength` | `15` | `15` | ✓ Correct |
| `#dexterity` | `3` | `3` (enemy default 0.2, override 3) | ✓ Correct |
| `#energy` | `300` | `300` | ✓ Correct |
| `#walkSpeed` | `4.5` | `4.5 × 0.6 = 2.7 px/tick` (engine conversion) | ✓ Correct |
| `#weaponTechniqueInc` | `3.5` | `3.5` (hardcoded by design, catalogued) | ✓ Correct |
| `#damageSpeed` | `2.5` | `2.5` (catalogued non-issue) | ✓ Catalogued |
| `#inertia` | `60` | `60` | ✓ Correct |
| `#stallSpeed` | `1` | `1` | ✓ Correct |
| `#stallSpeedIncLevel` | `1` | `1` | ✓ Correct |
| `#strengthIncLevel` | `1` | `1` | ✓ Correct |

## Weapon Resolution

The `#kingSword` weapon is correctly resolved at spawn time:

- **Original**: `act_kingInGame` declares `#weapon: #kingSword`; the modWeaponManager resolves the attack from the weapon actor.
- **Port**: `spawnEnemy()` line 155–162 resolves the weapon's #attack:
  - If the character has no own #attack, use the weapon's #attack (kingInGame has no own #attack, so uses kingSword's)
  - `#kingSword` resolves to `animType: #weaponMelee`, `damageMultiplier: 3`, `cooldown: 5`, `power: point(0.5, 0)`
  - The attack is melee (`ranged=false`), so the CpuAI uses the normal moveToAttack FSM (not ranged/magic).

## Behavioral Verification

### Melee AI (CpuAI, objAiCPU)
- **Original**: objAiCPU drives the committed-target FSM: findTarget → moveToAttack → attack → attackFin
- **Port**: CpuAI.update() (line 414–438) implements the same FSM:
  - `findTarget`: acquire via teamMaster.findTarget (line 423–431)
  - `moveToAttack`: path to target, attack in reach (line 433, 457–474)
  - `attack`: execute melee via teamMaster.impactMeleeAttack (line 591)
  - Post-attack: re-acquire target and continue (line 508–514)
- **Status**: ✓ Correct, faithful implementation

### Team Allegiance (#aldevar ally)
- **Original**: act_kingInGame declares `#team: #aldevar`, the player's team
- **Port**: 
  - spawnEnemy() reads `team` from registry (line 138, 266)
  - spawnUnit() marks it as an ally if `isPlayerSide(team)` (line 58, archetypes.ts)
  - TeamMaster.register() joins the `#aldevar` team (Energy/Team components, archetypes.ts line 260–266)
  - Attack targeting resolves via team's `#hates` list (teams.ts line 86–96)
- **Status**: ✓ Correct, hunts enemies via data-driven allegiance

### leaveWhenFinished Retirement
- **Original**: objAiCPU.internalEvent(#noTargetFound) at line 308–310; if `getLeaveWhenFinished()` true, call armyTeleportOut()
- **Port**: CpuAI.update() (line 427–430):
  - Counter `noTargetCtr` tracks frames with no target (initialized 0, incremented on idle findTarget)
  - When `leaveWhenFinished && noTargetCtr >= LEAVE_GRACE (60 frames)`, call leaveGame()
  - leaveGame() calls `game.armyMaster.teleportOut()` and flags "left" for cleanup
  - Grace period (~2s) allows room spawns to register before retiring
- **Status**: ✓ Correct, faithful grace-period behavior

### Death & Grave
- **Original**: On death, modGrave records the grave sprite at the death loc, persisting in pGraves
- **Port**: Grave component (grave.ts line 14–24) controls whether a grave is left:
  - `graveOn = true` by default (kingInGame is not a ghost, so graveOn is set)
  - On death, the entity is reused as the grave sprite, persisting via room state snapshot
  - Render order (Anim sprite layer) keeps graves behind live units
  - No grave is left if `ghost===true`, which does not apply to kingInGame
- **Status**: ✓ Correct, grave behavior faithful

### Movement & Speed
- **Original**: walkSpeed 4.5 (Director units)
- **Port**: 
  - Reads walkSpeed 4.5 from data (line 139, 263)
  - Converts to px/tick: 4.5 × 0.6 = 2.7 px/tick (line 263, faithful engine scaling)
  - Movement intent set by CpuAI each tick, Movement component updates position
- **Status**: ✓ Correct, speed conversion is consistent with engine calibration

## Conclusion

All critical behaviors (melee AI, weapon resolution, team allegiance, leaveWhenFinished retirement, grave) are correctly implemented in the port. The kingInGame actor exhibits **full parity** with the original Lingo casts. No gaps detected.

**Audit Result**: **CLEAN**
