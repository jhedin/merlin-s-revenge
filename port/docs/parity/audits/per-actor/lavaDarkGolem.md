# Behavioral Audit: act_lavaDarkGolem

**Actor:** lavaDarkGolem | **Type:** #objCPUCharacter | **Team:** #scarlet | **AiType:** #objAiCPU

Ranged splash thrower of #flamingRock. The flaming rock EXPLODES and leaves a lingering #fire mine.

| Property | Value | Port handling | Status |
|----------|-------|---------------|--------|
| `attack.animType` | #naturalRanged | RANGED splash thrower | ✓ |
| `attack.bullet` | #flamingRock (#explode) | splashBullet path (fireSplashBullet) | ✓ |
| `attack.reach` | 150 | reachRanged=150 | ✓ |
| `flamingRock.reincarnateAs` | [#fire] | **FIXED** — bullet now hatches a #fire mine on death (was dropped) | ✓ |
| `team` | #scarlet | enemy | ✓ |

## Gap found + FIXED
- **bullet #reincarnateAs dropped** — the port's pooled BulletArchetype was [Movement, Projectile] with no
  reincarnation, so flamingRock exploded but left NO fire (and eggs never hatched). Now the bullet carries
  its #reincarnateAs and the Projectile death choke-point spawns each child via spawnFromSymbol
  (flamingRock→#fire mine, lizardEgg→#bug, ostrichEgg→#babyOstrich). casts/data/act_flamingRock.txt:23 +
  casts/script_objects/objBullet.txt:282 | port/src/components/projectile.ts (finish) + control.ts + archetypes.ts.

**Status: FIXED (bullet reincarnation — systemic: flamingRock + lizardEgg + ostrichEgg).**
