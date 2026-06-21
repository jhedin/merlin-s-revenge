# summonGolem Behavioral Parity Audit

## Summary
**Status: CLEAN** — summonGolem exhibits faithful behavioral parity between the original Lingo game (casts/) and the TypeScript port (port/src/).

## Data Property Coverage

| Property | Original (casts/) | Port (port/src/) | Mapping | Status |
|----------|-------------------|------------------|---------|--------|
| #name | "fourArmGolem" | "fourArmGolem" | Identity.name | ✓ |
| #objType | #objCPUCharacter | #objCPUCharacter | EnemyArchetype | ✓ |
| #AiType | #objAiCPU | #objAiCPU | CpuAI behavior | ✓ |
| #inherit | #CPUCharacter | via registry resolve | Movement/Control chain | ✓ |
| #attack.animType | #naturalRanged | #naturalRanged | ranged=true (line 169) | ✓ |
| #attack.bullet | #darkRock | #darkRock | resolveAttack → splashBullet (line 252) | ✓ |
| #attack.animframe | [7, 14, 20, 27] | [7, 14, 20, 27] | attack.animframe | ✓ |
| #attack.cooldown | 0 | 0 | effective cooldown 19 (line 181) | ✓ |
| #attack.firingType | #fullstrength | #fullstrength | resolveAttack; throw speed (line 544) | ✓ |
| #attack.name | #throwBoulder | #throwBoulder | attack.name | ✓ |
| #attack.reach | 150 | 150 | attack.reach | ✓ |
| #attack.sound | "darkGolem_fire" | "darkGolem_fire" | attack.sound | ✓ |
| #attack.collisionLoc | point(0,-8) | {x:0, y:-8} | resolveAttack → collisionLoc | ✓ |
| #attack.power | (implicit, inherited) | (bullet's 1) | K1 bullet damage (line 580) | ✓ |
| #damageSpeed | 1 | 1 | damageSpeed | ✓ |
| #dexterity | 10 | 10 | dexterity (ranged cooldown inc) | ✓ |
| #miniMapStatus | #clr | #clr | miniMapStatus | ✓ |
| #dieSound | "boulder_die" | "boulder_die" | dieSound | ✓ |
| #reelProof | true | true | reelProof | ✓ |
| #collisionDetection | false | false | collisionDetection | ✓ |
| #energy | 1200 | 1200 | energy | ✓ |
| #experienceImWorth | 65 | 65 | experienceImWorth | ✓ |
| #eyestrain | 25 | 25 | eyestrain | ✓ |
| #frictionReel | point(50,50) | {x:50, y:50} | frictionReel | ✓ |
| #inertia | 65 | 65 | inertia | ✓ |
| #startingLevel | 0 | 0 | startingLevel (line 317) | ✓ |
| #strength | 20 | 20 | strength | ✓ |
| #team | #monsterSummon | #monsterSummon | team | ✓ |
| #walkSpeed | 3 | 3 × 0.6 = 1.8 px/tick | walkSpeed conversion (line 267) | ✓ |
| #weaponTechnique | 4 | 4 | weaponTechnique | ✓ |

## Behavioral Correctness

### Ranged AI (Splash Bullet)
- **Original**: #naturalRanged + #darkRock bullet (explode type) fires at range via objAiCPU FSM.
  - Reach threshold: 150 px (GeomDist) for moveToAttack → attack transition.
  - Fires when target ≤ 150 px away via performRangedAttack + modAttack.
  - #firingType #fullstrength: projectile speed = attacker strength (20).
  
- **Port**:
  - animType #naturalRanged → `ranged=true` (archetypes.ts:169).
  - CpuAI.targetInReach: d ≤ reachRanged (150, line 499).
  - CpuAI.attack (line 531–598):
    - darkRock's attack has type "#explode" (data.json).
    - splashBullet = ba where ba.attackType === "#explode" (line 252).
    - CpuAI fires via fireSplashBullet (line 550).
    - Throw velocity: firingType "#fullstrength" → throwSpeed = max(1, strength=20) (line 545).
  - ✓ FAITHFUL: splash bullet fired at range with correct speed and reach.

### Bullet Resolution (#darkRock → Splash Damage)
- **Original**: darkRock has #attack [#type: #explode, #explodeCharge: 40, #power: 1].
  - Lands on terrain/target, resolves area hit via modExploder (radius = explodeCharge/2 = 20 px).
  
- **Port**:
  - darkRock.attack = {type: "#explode", explodeCharge: 40, power: 1} (data.json).
  - fireSplashBullet → Projectile.configureSplash (bullets.ts:61).
  - Splash resolves on land/collide via SplashDamage system (explodeCharge → radius).
  - ✓ FAITHFUL: splash damage applied as area effect.

### Team Allegiance (#monsterSummon)
- **Original**: summonGolem carries #team: #monsterSummon.
  - Hunts enemies via team-driven allegiance (tem_monsterSummon.hates includes #aldevar, #village, etc.).
  
- **Port**:
  - team = "#monsterSummon" (spawnEnemy line 270).
  - Allegiance resolved per attack via Targeting.allegiance (default "#enemy" for this ranged AI).
  - TeamMaster.findTarget uses calcTargetTeams(#monsterSummon, "#enemy") → hates list.
  - ✓ FAITHFUL: player-summoned ally hunts via data-driven allegiance.

### Reincarnation
- **Original**: No #reincarnateAs / #reincarnateInto property → does not split on death.
- **Port**: No reincarnateAs in data.json → Reincarnate.reincarnateAs = [] → no spawn on death.
- ✓ FAITHFUL: no split behavior.

### Movement & Death
- **Original**:
  - Walks at walkSpeed 3 (tuned units).
  - Dies when energy ≤ 0; plays dieSound "boulder_die".
  
- **Port**:
  - walkSpeed: 3 × 0.6 = 1.8 px/tick (faithful to engine scale, line 267).
  - Energy system dies on ≤ 0 (faithful).
  - dieSound "boulder_die" queued on death.
  - ✓ FAITHFUL: movement and death behavior match.

### Comparison (Related Actors)
- **act_darkGolem** (non-summoned variant):
  - Same #attack (#naturalRanged, #darkRock, reach 150).
  - Differs: #team #monsters (not #monsterSummon), damageSpeed 3 (vs 1), energy 750 (vs 1200), lower stats.
  - Both fire splash; only team allegiance differs.
  
- **act_summonOrc** (ally archer):
  - #team #monsterSummon (same).
  - Uses #weapon #crossBow (ranged, single-target).
  - summonGolem's native #attack vs. summonOrc's weapon-routed attack—both functionally ranged.

---

## Conclusion
**CLEAN** — summonGolem has complete behavioral parity. Property coverage is 100% faithful; ranged splash AI resolves correctly through CpuAI→fireSplashBullet; team allegiance is data-driven; movement and death are authentic. No behavioral gaps detected.
