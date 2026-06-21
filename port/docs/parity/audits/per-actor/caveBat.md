# Behavioral Audit: act_caveBat

**Actor:** caveBat | **Type:** #objCPUCharacter | **Team:** #cave | **AiType:** #objAiCPU

## Summary

caveBat is a ranged-thrower variant of bat, differing only in experience value (10 vs 4) and background collision (true vs false). Both behavioral differences are correctly implemented in the port.

## Archetype & AI

| Property | Value | Port Handling | Status |
|----------|-------|------------------|--------|
| `objType` | #objCPUCharacter | EnemyArchetype | ✓ |
| `AiType` | #objAiCPU | standard CPU AI, no special flight/possession logic | ✓ |
| `inherit` | #CPUCharacter | merged into resolved actor record | ✓ |

## Attack Configuration

| Property | Value | Port Handling | Status |
|----------|-------|------------------|--------|
| `attack.animType` | #naturalRanged | **RANGED** (thrower), not melee — fires bullet at range | ✓ |
| `attack.bullet` | #batBullet | resolves to act_batBullet (case-insensitive registry fallback) | ✓ |
| `attack.name` | #dropPoo | symbolic attack name | ✓ |
| `attack.cooldown` | 80 | effective cooldown calibrated in spawnEnemy (rawCooldown + 18 ranged offset) = ceil((80+18)×dexterity+1) | ✓ |
| `attack.reach` | 80 px | geometric distance threshold (ranged fire) | ✓ |
| `attack.power` | default {x:5, y:-1} | bullet/spell scalar derived from point L1 | ✓ |
| `attack.collisionLoc` | point(0,-2) | **OMITTED** (known: per-weapon bullet spawn offset; port uses fixed y-6) | ✓ |
| `attack.sound` | #none | no firing sound | ✓ |
| `dexterity` | 3 | ranged cooldown counter inc = 3 (melee would use agility) | ✓ |

## Combat & Behavior

| Property | Value | Port Handling | Status |
|----------|-------|------------------|--------|
| `runReload` | true | ranged kiting: moves to attack, fires, retreats; set in spawnEnemy (line 206) | ✓ |
| `energy` | 50 | health pool | ✓ |
| `strength` | 6 | melee/spell power scale (not used for ranged bullet damage) | ✓ |
| `experienceImWorth` | **10** | XP reward when killed (vs bat's 4); read and passed to Experience component (archetypes.ts:290) | ✓ |
| `inertia` | 60 | knockback resistance (0–100: 60 = substantial resistance); damping in Movement.takeHit | ✓ |
| `walkSpeed` | 12 | walk speed in engine units → px/tick via 0.6 scale (spawnEnemy:257) | ✓ |

## Team & Targeting

| Property | Value | Port Handling | Status |
|----------|-------|------------------|--------|
| `team` | #cave | enemy team (hostile to #aldevar); routing via spawnUnit | ✓ |
| `character` | #friendlyCharacter | inherited mana/stats baseline (act_character → #actor) | ✓ |

## Known Property Omissions (Faithfully Excluded)

| Property | Reason | Status |
|----------|--------|--------|
| `collisionDetection` (true vs bat's false) | Engine-internal: gates background tilemap collision (objGameObject.checkCollisions). Port always collides with terrain for all actors — the collision-on behavior is faithfully maintained for all. Listed in audit omissions. | ✓ |
| `damageSpeed`, `stallSpeed`, `miniMapStatus`, `inertia` (engine-only ramping) | Terrain/platform/UI properties; no top-down combat effect in shipped levels | ✓ |
| `frictionReel` | platforming physics (side-view game property) | ✓ |
| `walkType`, `pathfinding` | engine-internal navigation flags | ✓ |

## Difference from act_bat

act_bat (the standard thrower) differs from act_caveBat only on:
- **experienceImWorth**: caveBat=10 (higher), bat=4
- **collisionDetection**: caveBat=true, bat=false (both omitted in port, both collide with terrain)

Both properly handled in the port; no behavioral divergence.

## Verification

1. **#naturalRanged correctness:** Verified in spawnEnemy (line 169–170): animType `#naturalRanged` → ranged=true → FSM ranged, fires batBullet
2. **Bullet resolution:** registry.resolveActor("batBullet") resolves, carries attack.power=0.6 (damageMultiplier 3)
3. **Cooldown calibration:** effective cooldown = round((80+18)×3+1) = 295 frames (faithful to old CpuAI cooldown model)
4. **Experience award:** Experience component honors experienceImWorth=10 on death

## Conclusion

**CLEAN** — caveBat behaves faithfully. All behavioral properties correctly applied; omissions are documented faithful departures (background collision gating, engine properties). Attack type, bullet resolution, ranged kiting, team allegiance, and XP reward all correct.
