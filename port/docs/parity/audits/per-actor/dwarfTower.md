# Behavioral Audit: act_dwarfTower

**Actor:** dwarfTower | **Type:** #objCPUCharacter | **Team:** #aldevar (#teamBuildings) | **AiType:** #objAiCPU

Stationary ally turret. Throws #towerAxe (#explode splash) at very long reach (600), reelProof.

| Property | Value | Port handling | Status |
|----------|-------|---------------|--------|
| `attack.animType` | #naturalRanged | RANGED splash thrower | ✓ |
| `attack.bullet` | #towerAxe (#explode) | splashBullet path (fireSplashBullet) | ✓ |
| `attack.reach` | 600 | reachRanged=600 (long-range turret) | ✓ |
| `attack.firingType` | #proportional | **FIXED** — throw velocity = dist/10 (was fixed 5) | ✓ |
| `walkSpeed` | 0 | stationary (never moves) | ✓ |
| `reelProof` | true | immune to knockback/reel | ✓ |
| `team`/`teamRole` | #aldevar / #teamBuildings | ally turret, targets monsters | ✓ |
| `walkSpeedIncLevel` | 0 | catalogued minor (no walk growth) | ✓ |

## Gap found + FIXED
- **firingType #proportional ignored** — the port fired all bullets at a fixed speed (5 splash / 4.5 plain),
  so dwarfTower's axe crossed 600px in ~120 frames instead of the original's ~10 (throwVect=distXY/10).
  Now the port reads `#firingType` and derives the throw velocity (proportional → dist/10; fullstrength →
  strength). Travel time only; damage stays on the calibrated K1 reference. casts/script_objects/modAttack.txt:743 |
  port/src/components/control.ts (attack) + weapon.ts (AttackData.firingType).

**Status: FIXED (firingType — systemic, 42 actors).**
