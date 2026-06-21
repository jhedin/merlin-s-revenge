# Actor Audit: summonBoulder

## Summary
Behavioral parity audit comparing the original Lingo actor `summonBoulder` (casts/) against the TypeScript port (port/src/).

## Data Verification

| Property | Original (casts/) | Port (port/src/generated/data.json) | Match |
|----------|---|---|---|
| **objType** | #objCPUCharacter | #objCPUCharacter | ✓ |
| **AiType** | #objAiCPU | #objAiCPU | ✓ |
| **inherit** | #CPUCharacter | #CPUCharacter | ✓ |
| **attack.animframe** | 19 | 19 | ✓ |
| **attack.animType** | #naturalRanged | #naturalRanged | ✓ |
| **attack.bullet** | #boulder | #boulder | ✓ |
| **attack.collisionLoc** | point(0,0) | {x:0, y:0} | ✓ |
| **attack.cooldown** | 0 | 0 | ✓ |
| **attack.firingType** | #fullstrength | #fullstrength | ✓ |
| **attack.name** | #throwBoulder | #throwBoulder | ✓ |
| **attack.reach** | 220 | 220 | ✓ |
| **attack.sound** | "boulder_fire" | "boulder_fire" | ✓ |
| **damageSpeed** | 1 | 1 | ✓ |
| **miniMapStatus** | #clr | #clr | ✓ |
| **dexterity** | 10 | 10 | ✓ |
| **dieSound** | "boulder_die" | "boulder_die" | ✓ |
| **reelProof** | true | true | ✓ |
| **collisionDetection** | false | false | ✓ |
| **energy** | 400 | 400 | ✓ |
| **experienceImWorth** | 50 | 50 | ✓ |
| **eyestrain** | 25 | 25 | ✓ |
| **frictionReel** | point(40,40) | {x:40, y:40} | ✓ |
| **inertia** | 50 | 50 | ✓ |
| **startingLevel** | 0 | 0 | ✓ |
| **strength** | 12 | 12 | ✓ |
| **team** | #monsterSummon | #monsterSummon | ✓ |
| **name** | "boulderMonster" | "boulderMonster" | ✓ |
| **walkSpeed** | 3 | 3 | ✓ |
| **weaponTechnique** | 4 | 4 | ✓ |

## Behavioral Analysis

### 1. Ranged AI Classification
- **Original**: #naturalRanged animType drives ranged attack behavior.
- **Port**: animType→typeFromAnimType() (weapon.ts:91–98) maps #naturalRanged → "ranged", setting up `ranged=true` in EnemyAI init (archetypes.ts:169–170).
- **Verification**: spawnEnemy() correctly classifies summonBoulder as ranged; CpuAI.init() reads ranged=true and sets reachRanged=150 (default), gating moveToAttack/attack phases to fire at range. ✓

### 2. #fullstrength Firing Model
- **Original**: firingType=#fullstrength → throwVect = distXY / (distRatio, distRatio), where speed = strength (12) (modAttack.txt:753–771).
- **Port**: resolveAttack() (weapon.ts:179) preserves firingType="#fullstrength" in AttackData. CpuAI.updateMoveToAttack() → attack() → CpuAI.updateRanged() (control.ts:554–576) fires the bullet via fireSplashBullet(…, attack.spellSpeed/3, …). The port does NOT implement firingType modulation; it always uses attack.spellSpeed as the constant velocity.
- **Issue Assessment**: This is a known divergence (B2 plan §f.4). The port's bullet speed is tuned by attack.spellSpeed rather than the attacker's strength. For summonBoulder (strength 12), the original uses strength as the speed coefficient; the port uses a fixed spellSpeed. **However**, summonBoulder's #attack does NOT carry a #spellSpeed field (it's a ranged attack, not a magic spell), so resolveAttack() defaults it to 0 (weapon.ts:180). This causes the bullet to spawn with speed=0/3=0 — effectively frozen.
- **Verdict**: BEHAVIORAL GAP — bullet does not move.

### 3. Boulder Bullet Resolution
- **Bullet Type**: act_boulder inherits #bullet, carries #attack with type:#bullet and power:2, damageMultiplier:1. No #explode or #splashDamageOn.
- **Original Behavior**: objBullet treats type:#bullet as a plain single-target hit on collision (modExploder enforces the collision model).
- **Port Behavior**: Projectile.configureSplash/configure checks splashDamageOn/attackType==="#explode" to decide splash vs. single-target (projectile.ts:50–52). act_boulder's #attack.type is "#bullet" (not "#explode"), and splashDamageOn is absent (defaults false). spawnEnemy() does NOT flag it as splashBullet (archetypes.ts:252 checks attackType==="#explode" OR splashDamageOn).
- **Verdict**: Boulder resolves as single-target, not splash. The original also treats it as single-target (no data says otherwise). ✓

### 4. Team Allegiance & Movement
- **Team**: #monsterSummon — player-summoned monster ally on the player's side.
- **Port**: spawnUnit() (archetypes.ts:54–60) routes team by isPlayerSide(team) — #monsterSummon is NOT #aldevar, so it checks if #aldevar.friends includes it. tem_aldevar.txt friends=[...#monsterSummon...] (confirmed). So summonBoulder joins the ally roster on the player's side.
- **Allegiance**: Team's #hates chains target selection (systems/teams.ts:86–97). #monsterSummon.hates includes #monsters (its primary prey), so a summoned boulder hunts enemy teams correctly.
- **Movement**: walkSpeed=3 (same as EnemyArchetype default) × 0.6 scale (archetypes.ts:267) = 1.8 px/tick. Original #walkSpeed is left as-is by the port's registry (no re-scaling there), faithful to act_summonBoulder.walkSpeed=3.
- **Verdict**: Team routing and movement setup correct. ✓

### 5. Death & Cleanup
- **dieSound**: "boulder_die" carried in the actor data; Hurt component plays it on death (faithful).
- **leaveWhenFinished**: Not set in summonBoulder (defaults to false). The CpuAI.LEAVE_GRACE (control.ts:335, 443) only applies if leaveWhenFinished=true, so this boulder persists after room clear unless manually destroyed. Original behavior matches (no leaveWhenFinished flag).
- **Verdict**: ✓

### 6. Attack Resolution & Cooldown
- **firingType**: #fullstrength resolved and preserved; but see issue #2 (spellSpeed bug).
- **Cooldown**: cooldown=0 in data; effective cooldown = Math.round(frames(0+18)*dexterity(10)+1) = Math.round(18*10+1) = 181 frames. This is the ranged calibration (archetypes.ts:180–188).
- **Reach**: attack.reach=220 → CpuAI.reachRanged=220 (init 150, then overridden by atkReach if present, control.ts:370). summonBoulder carries atkReach implicitly via attack.reach=220, so CpuAI re-reads it in syncWeaponMode() (control.ts:495) if a multi-weapon actor; for single-attack, the initial reachRanged=Math.min(220, Math.max(60, 220))=220 is set in init (control.ts:370).
- **Verdict**: Attack fire-gating works; issue #2 prevents bullet flight.

## Conclusion
**GAPS=1**

1. **spellSpeed=0 causes bullet freeze**: The summonBoulder's #attack lacks a #spellSpeed field (it's a ranged naturalRanged attack, not a magic spell). resolveAttack() defaults spellSpeed to 0 (weapon.ts:180: `d["spellSpeed"] as number`). When CpuAI fires via fireSplashBullet(..., attack.spellSpeed/3, ...), the bullet spawns with vx/vy=0 (bullets.ts:21–22). The original assigns speed=strength(12) via #fullstrength, so the boulder flies at constant 12 px/frame. The port's boulder does not move. **Fix**: Add #spellSpeed to #throwBoulder attack or map #fullstrength firingType to a default spellSpeed in resolveAttack().

All other properties, team routing, AI classification, and death handling are correct.

---

**Audit Date**: 2026-06-21  
**Auditor**: Claude Code  
**Actor**: summonBoulder (player-summoned boulder monster ally)
