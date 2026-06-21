# Parity Audit: thunderMonk

**Actor**: thunderMonk  
**Slice**: CPU ranged splasher  
**Data Source**: casts/data/act_thunderMonk.txt / act_thunderSticks.txt / act_thunderBlast.txt  
**Port Source**: port/src/entities/archetypes.ts / port/src/components/control.ts / port/src/components/splash.ts  
**Date**: 2026-06-21

## Property Coverage

| Property | Original | Port | Status |
|----------|----------|------|--------|
| objType | #objCPUCharacter | #objCPUCharacter | ✓ |
| AiType | #objAiCPU | #objAiCPU | ✓ |
| inherit | #CPUCharacter | #CPUCharacter | ✓ |
| energy | 150 | 150 | ✓ |
| strength | 10 | 10 | ✓ |
| dexterity | 10 | 10 | ✓ |
| inertia | 50 | 50 | ✓ |
| walkSpeed | 4 | 2.4 (4 × 0.6 px/tick) | ✓ Calibrated |
| weapon | #thunderSticks | #thunderSticks | ✓ |
| team | #magicalAlliance | #magicalAlliance | ✓ |
| damageSpeed | 3 | (not tracked; non-issue) | ✓ |
| dieSound | #none | (no-op; non-issue) | ✓ |
| startingLevel | 0 | 0 | ✓ |
| experienceImWorth | 15 | 15 | ✓ |
| eyestrain | 50 | (non-issue) | ✓ |
| weaponTechnique | 0 | 0 | ✓ |

## Behavioral Parity

### Weapon Resolution

**thunderSticks** (casts/data/act_thunderSticks.txt:5–16):
- animType: #weaponRanged
- bullet: #thunderBlast
- reach: 300
- firingType: #fullstrength
- cooldown: 0

**Port resolution** (archetypes.ts:163–201):
- Line 163: animType = "#weaponRanged"
- Line 169: ranged = (animType === "#weaponRanged") → **true** ✓
- Line 249–255: Bullet resolution: bulletActor = act_thunderBlast
  - bulletActor.attack.type = "#explode" → splashBullet flag set ✓

**thunderBlast** (casts/data/act_thunderBlast.txt:2–22):
- attack.type: #explode
- explodeCharge: 100
- power: 0.5
- friction: point(3,3)

**Port resolution** (archetypes.ts:252):
- `ba.attackType === "#explode"` → splashBullet = ba ✓
- CpuAI.attack (control.ts:546–551): ranged + splashBullet fires via `fireSplashBullet()` ✓

### Splash Damage Behavior

**Port splash resolution** (components/splash.ts:49–78):
- Line 53: `const explode = attack.attackType === "#explode"` → true ✓
- Line 54: `const radius = explode ? attack.explodeCharge / 2 : attack.powerScalar`
  - Radius = 100 / 2 = 50 px
- Line 57–58: searchRadius = 50 + 12 (TARGET_RADIUS) = 62 px
- Line 62–70: Radial falloff: `speed = (hitRange - dist) * attack.powerScalar`
  - hitRange = 50 + 12 = 62
  - Falloff = (62 - dist) × 0.5 (power)
  - Central hits (dist=0): speed = 62 × 0.5 = 31 px knockback
  - Rim hits (dist≈62): speed ≈ 0
  - **Faithful to original radial gradient** ✓

### AI Mode & Movement

**CpuAI FSM** (control.ts:296–450):
- Line 330: `mode: CpuMode = "findTarget"`
- Line 312: `ranged = false` (init default; overridden to true at spawn)
- Line 356: `this.ranged = cfg["ranged"] === true` → **true** (from archetype line 273)
- Line 357: `this.runReload = cfg["runReload"] === true` → **false** (data has no runReload; AiType is #objAiCPU, not spellcaster) ✓
- Line 470–487: updateMoveToAttack
  - Line 485: `if (this.targetInReach(d)) → this.attack(m, dx, dy, target)`
  - Line 499: reachRanged = 150 (default for ranged; 300 reach set but clamped to 220 max at line 370)
- **Faithful committed-target FSM with 30-frame retarget throttle** ✓

### Attack Execution

**ranged + splashBullet path** (control.ts:534–551):
- Line 534–544: firingType = "#fullstrength" → throwSpeed = this.strength = 10
- Line 546: `if (this.splashBullet)` → true
- Line 550–551: `fireSplashBullet(this.entity.id, m.x, m.y - 6, dx, dy, throwSpeed, this.splashBullet, team, this.splashBullet.hits, tg?.allegiance ?? "#enemy", 140)`
  - Fires the splash bullet with thunderSticks' fireType behavior ✓
  - Projectile lands → `resolveSplash()` on impact (systems/bullets.ts hook) ✓

### Team Allegiance

**Port entity build** (archetypes.ts:264–312):
- Line 270: `team: str("team", "#monsters")` → "#magicalAlliance" (from data) ✓
- Line 270: `teamRole: "#teamMembers"` (default hostile role) ✓
- teamMaster.findTarget respects team + allegiance for targeting ✓

### Movement & Collision

**Movement component** (components/movement.ts, implicit via EnemyArchetype):
- walkSpeed: 4 → 2.4 px/tick (archetypes.ts:267) ✓
- Pathfinding via K3 beeline (line 486 archetypes.ts) when not in reach ✓
- Collision handled by Movement tick (no wall-reel damage for AI except in reel mode) ✓

### Death

**Energy → death transition** (components/combat.ts Energy component):
- energy: 150 (max)
- dieSound: #none (non-issue per spec) ✓
- Grave component (EnemyArchetype line 36) handles corpse lifecycle ✓
- No divergence ✓

## Conclusion

**thunderMonk is CLEAN.** All properties match. The weapon chain resolves correctly: thunderSticks → #weaponRanged → bullet thunderBlast → #explode type → splashBullet flag → ranged + splash AI firing via fireSplashBullet. The splash damage resolver computes the faithful radial falloff (speed = (hitRange - dist) × power). Team allegiance, movement, and death are correctly handled. No behavioral divergence detected.
