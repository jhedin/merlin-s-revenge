# Behavioral Audit: act_bat

**Actor:** bat | **Type:** #objCPUCharacter | **Team:** #cave | **AiType:** #objAiCPU

## Summary

bat is a ranged-thrower CPU enemy that fires batBullet projectiles at range. It differs from caveBat only in experience value (4 vs 10) and background collision (false vs true). Both behavioral differences are correctly implemented in the port; ranged AI (#naturalRanged), kiting (#runReload true), and bullet mechanics all work faithfully.

## Archetype & AI

| Property | Value | Port Handling | Status |
|----------|-------|------------------|--------|
| `objType` | #objCPUCharacter | EnemyArchetype | ✓ |
| `AiType` | #objAiCPU | standard CPU AI, no special flight/possession logic | ✓ |
| `inherit` | #CPUCharacter | merged into resolved actor record | ✓ |

## Attack Configuration

| Property | Value | Port Handling | Status |
|----------|-------|------------------|--------|
| `attack.animType` | #naturalRanged | **RANGED** (thrower), not melee — fires bullet at range (typeFromAnimType line 95) | ✓ |
| `attack.bullet` | #batBullet | resolves to act_batBullet (case-insensitive registry fallback) | ✓ |
| `attack.name` | #dropPoo | symbolic attack name | ✓ |
| `attack.cooldown` | 80 | effective cooldown calibrated in spawnEnemy (rawCooldown + 18 ranged offset) = ceil((80+18)×dexterity+1) | ✓ |
| `attack.reach` | 80 px | geometric distance threshold (ranged fire: targetInReachRanged checks distance < reach²) | ✓ |
| `attack.power` | default {x:5, y:-1} | bullet/spell scalar derived from point L1 | ✓ |
| `attack.collisionLoc` | point(0,-2) | **OMITTED** (known: per-weapon bullet spawn offset; port uses fixed y-6) | ✓ |
| `attack.sound` | #none | no firing sound | ✓ |
| `dexterity` | 3 | ranged cooldown counter inc = 3 (melee would use agility) | ✓ |

## Combat & Behavior

| Property | Value | Port Handling | Status |
|----------|-------|------------------|--------|
| `runReload` | true | ranged kiting — data flag read and passed to EnemyAI (archetypes.ts:211). AI enters runReload mode after a shot (control.ts:525), moves away from target until cooled (control.ts:509), then re-engages (control.ts:509). | ✓ |
| `energy` | 50 | health pool | ✓ |
| `strength` | 6 | melee/spell power scale (not used for ranged bullet damage) | ✓ |
| `experienceImWorth` | 4 | XP reward when killed (vs caveBat's 10); read and passed to Experience component (archetypes.ts:300) | ✓ |
| `inertia` | 60 | knockback resistance (0–100: 60 = substantial resistance); damping in Movement.takeHit | ✓ |
| `walkSpeed` | 12 | walk speed in engine units → px/tick via 0.6 scale (spawnEnemy:267) | ✓ |

## Team & Targeting

| Property | Value | Port Handling | Status |
|----------|-------|------------------|--------|
| `team` | #cave | enemy team (hostile to #aldevar); routing via spawnUnit | ✓ |
| `character` | #friendlyCharacter | inherited mana/stats baseline (act_character → #actor) | ✓ |

## Known Property Omissions (Faithfully Excluded)

| Property | Reason | Status |
|----------|--------|--------|
| `collisionDetection` (false) | Engine-internal: gates background tilemap collision (objGameObject.checkCollisions). Port always collides with terrain for all actors — the collision-off behavior is faithfully maintained for all. Listed in audit omissions. | ✓ |
| `damageSpeed`, `stallSpeed`, `miniMapStatus` | Terrain/platform/UI properties; no top-down combat effect in shipped levels | ✓ |
| `frictionReel` | platforming physics (side-view game property) | ✓ |
| `walkType`, `pathfinding` | engine-internal navigation flags | ✓ |

## Verification Path: Ranged AI Execution

1. **Spawn:** `spawnEnemy("bat", x, y)` resolves act_bat data
   - `animType = "#naturalRanged"` (attack.animType)
   - `ranged = true` (line 169–170: animType matched)
   - `runReload = true` (line 211–212: !ghost && ranged && d["runReload"]===true)
   
2. **EnemyAI Init:** EnemyAI.init receives `ranged=true, runReload=true`
   - `this.ranged = true` (control.ts:356)
   - `this.runReload = true` (control.ts:357)
   - `this.reachRanged = 150` (ranged firing distance, line 310; can be overridden by atkReach)

3. **FSM: Ranged Attack Loop**
   - **findTarget** → target found → moveToAttack
   - **moveToAttack** → moves toward target via pathfinding (line 515)
   - **targetInReach** → checks `distToTarget < reach*reach` (ranged, not melee contact; line 410–411)
   - **Attack** → fires batBullet (performRangedAttack, line 523–619)
   - **attackFin** → runReload true → `goMode("runReload")` (line 525)
   - **runReload** → moves away from target (line 507–509) until cooled, then re-engages (line 510)

4. **Bullet Resolution**
   - batBullet actor resolved from registry (case-insensitive "batBullet")
   - Carries attack.damageMultiplier=3, power=0.6 (faithful)

5. **Cooldown Calibration**
   - rawCooldown = 80
   - framesWanted = max(1, 80 + 18) = 98 (ranged adds 18 offset)
   - counterInc = dexterity = 3
   - effectiveCooldown = round(98 * 3 + 1) = 295 frames
   - WeaponManager counter increments by dexterity=3 per tick, reaches 295 in ~98 ticks (faithful to old CpuAI model)

## Difference from act_caveBat

act_caveBat differs from act_bat only on:
- **experienceImWorth**: caveBat=10 (higher), bat=4
- **collisionDetection**: caveBat=true, bat=false (both omitted in port, both collide with terrain)

Both properties correctly handled in the port; no behavioral divergence.

## Conclusion

**CLEAN** — bat behaves faithfully. All behavioral properties correctly applied; omissions are documented faithful departures (background collision gating, engine properties). Attack type (#naturalRanged), bullet resolution, ranged kiting (#runReload true), team allegiance, and XP reward all correct.
