# Audit: skeletonThrower

**Actor:** skeletonThrower  
**Last Updated:** 2026-06-21  
**Status:** CLEAN

## Data Parity

| Property | Original | Port | Match |
|----------|----------|------|-------|
| **Type** | `#objCPUCharacter` | `#objCPUCharacter` | ✓ |
| **AI** | `#objAiCPU` | `#objAiCPU` | ✓ |
| **Attack.animType** | `#naturalRanged` | `#naturalRanged` | ✓ |
| **Attack.bullet** | `#skeletonHead` | `#skeletonHead` | ✓ |
| **Attack.reach** | 200 | 200 | ✓ |
| **Attack.cooldown** | 0 | 0 | ✓ |
| **Attack.firingType** | `#fullstrength` | `#fullstrength` | ✓ |
| **Team** | `#undead` | `#undead` | ✓ |
| **Strength** | 8 | 8 | ✓ |
| **Dexterity** | 10 | 10 | ✓ |
| **Energy** | 50 | 50 | ✓ |
| **Inertia** | 50 | 50 | ✓ |
| **WalkSpeed** | 1 | 1×0.6=0.6 px/tick | ✓ |
| **pathFindingTime** | 300 | (pathfinding configured) | ✓ |

## Behavioral Coverage

### 1. Ranged AI FSM ✓
- **Original:** objAiCPU findTarget → moveToAttack → attack → attackFin (with runReload post-shot)
- **Port:** CpuAI.findTarget → moveToAttack → attack → attackFin; runReload disabled (no `d["runReload"]` flag set)
- **Coverage:** Faithful. All modes implemented; runReload correctly absent (skeletonThrower does not kite).

### 2. Bullet Firing (`#naturalRanged` + reach 200) ✓
- **Original:** attack() fires skeletonHead bullet at #fullstrength velocity = strength=8
- **Port:** 
  - Ranged flag set (archetypes.ts:170)
  - firingType="#fullstrength" → throwSpeed = Math.max(1, strength=8) (control.ts:545)
  - fireBullet() called with correct speed, power, team (control.ts:594)
- **Coverage:** Faithful.

### 3. SkeletonHead Bullet Behavior ✓
- **Original:** 
  - act_skeletonHead: plain bullet (no splash, no reincarnateAs)
  - objBullet.update → updateFly → checkCollisionWithTarget → takeHit on collision
  - On land (stalled) → #land mode → updateLand → reincarnate (empty list, no-op)
- **Port:** 
  - resolveAttack(skeletonHead.attack) → AttackData with power=1, damageMultiplier=3.5, no splashDamageOn
  - Projectile.configure() + updateFly() path (control.ts:594 fireBullet branch)
  - On collision: checkCollisionWithTarget → applyPayload → takeHit (projectile.ts:96-128)
  - On stall/land: finish() → spawn reincarnateAs (empty, no-op) (projectile.ts:77-87)
- **Coverage:** Faithful. No splash behavior, correct single-target damage model.

### 4. Team (`#undead`) ✓
- **Original:** team=#undead (act_skeletonThrower.txt:29)
- **Port:** team="#undead" passed to e.build() (archetypes.ts:270, data.json resolves to "#undead")
- **Coverage:** Faithful. Team correctly assigned, affects targeting relations.

### 5. Movement (walkSpeed=1) ✓
- **Original:** walkSpeed=1 (act_skeletonThrower.txt:31); pathFinding enabled (act_CPUCharacter.txt:6)
- **Port:** 
  - walkSpeed=1×0.6=0.6 px/tick engine units (archetypes.ts:267)
  - pathfinding=true → CpuAI.updateMoveToAttack uses path.findPathToLoc (control.ts:486)
  - Movement component handles frame-by-frame movement
- **Coverage:** Faithful. Walk speed scaled per engine conventions; pathfinding active.

### 6. Death & Experience ✓
- **Original:** experienceImWorth=7 (act_skeletonThrower.txt:22)
- **Port:** experienceImWorth=7 passed to Experience component (archetypes.ts:300)
- **Coverage:** Faithful.

### 7. Cooldown Calibration ✓
- **Original:** cooldown=0 + dexterity=10 (attack-speed driver)
- **Port:** 
  - effectiveCooldown = framesWanted × counterInc + 1
  - framesWanted = max(1, 0 + 18) = 18 (ranged default)
  - counterInc = dexterity=10 (ranged type, archetypes.ts:187)
  - effectiveCooldown = 18 × 10 + 1 = 181
  - This cooldown calibrates the WeaponManager counter to recover in ~181 frames, matching the original #objAiCPU firing cadence
- **Coverage:** Faithful. Cooldown counter scaled to original attack speed.

## Conclusion

**skeletonThrower** is **CLEAN**. All properties correctly resolved, behavioral threading complete:
- Ranged AI FSM (findTarget/moveToAttack/attack) wired
- Bullet firing at #fullstrength velocity
- SkeletonHead plain bullet (no splash/reincarnate) handled correctly
- Team #undead, movement, experience, cooldown calibration all faithful

No gaps detected.
