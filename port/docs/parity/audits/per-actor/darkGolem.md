# Behavioral Audit: act_darkGolem

**Actor:** darkGolem | **Type:** #objCPUCharacter | **Team:** #monsters | **AiType:** #objAiCPU

## Summary
darkGolem is a ranged splash-thrower: fires #darkRock (an #explode bullet) at 150px reach. All
behavioral properties verified faithful in the port.

| Property | Value | Port handling | Status |
|----------|-------|---------------|--------|
| `objType` | #objCPUCharacter | EnemyArchetype (spawnEnemy) | ✓ |
| `AiType` | #objAiCPU | standard CPU FSM (findTarget→moveToAttack→attack→runReload) | ✓ |
| `attack.animType` | #naturalRanged | RANGED (archetypes.ts:169, weapon.ts typeFromAnimType) — not melee | ✓ |
| `attack.bullet` | #darkRock | resolves; darkRock #type:#explode → splashBullet path (fireSplashBullet) | ✓ |
| `attack.reach` | 150 | reachRanged=150 (targetInReach uses reachRanged) | ✓ |
| `team` | #monsters | enemy team; targetAllegiance #enemy → hunts #aldevar | ✓ |
| `walkSpeed` | 1 | ×0.6 = 0.6 px/tick (spawnEnemy:257) | ✓ |
| `dexterity` | 10 | ranged cooldown counter inc (port re-derives cooldown by design) | ✓ |
| `energy`/`strength`/`inertia` | data | health / power scale / knockback damping | ✓ |
| `damageSpeed`, `eyestrain`, `frictionReel`, `attack.animframe`, audio | — | catalogued faithful omissions (data-coverage.md) | ✓ |

## Conclusion
**CLEAN** — darkGolem spawns as a #naturalRanged CPU on #monsters, moves at 0.6 px/tick, fires
#darkRock splash bullets at 150px via the splash path, cooldown scaled by dexterity, correctly
hunts #aldevar. No behavioral divergence. (Audit completed; agent did not self-write — recorded by orchestrator.)
