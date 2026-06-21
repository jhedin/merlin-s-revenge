# Actor Audit: lavaGolem

## Data Properties

| Property | Original | Port | Status |
|----------|----------|------|--------|
| name | lavaDarkGolem | lavaDarkGolem | ✓ |
| team | #scarlet | #scarlet | ✓ |
| objType | #objCPUCharacter | #objCPUCharacter | ✓ |
| AiType | #objAiCPU | #objAiCPU | ✓ |
| attack.name | #throwBoulder | #throwBoulder | ✓ |
| attack.animType | #naturalRanged | #naturalRanged | ✓ |
| attack.bullet | #flamingRock | #flamingRock | ✓ |
| attack.reach | 150 | 150 | ✓ |
| attack.cooldown | 0 | 0 (re-derived) | ✓ |
| attack.firingType | #fullstrength | #fullstrength | ✓ |
| attack.sound | "darkGolem_fire" | "darkGolem_fire" | ✓ |
| energy | 750 | 750 | ✓ |
| strength | 20 | 20 | ✓ |
| dexterity | 10 | 10 | ✓ |
| walkSpeed | 1 | 1 | ✓ |
| inertia | 50 | 50 | ✓ |
| frictionReel | (50,50) | (50,50) | ✓ |
| startingLevel | 0 | 0 | ✓ |
| experienceImWorth | 50 | 50 | ✓ |
| dieSound | "boulder_die" | "boulder_die" | ✓ |

## Behavioral Chain

### Ranged AI & Bullet Firing
- **Detection**: animType `#naturalRanged` correctly classified as ranged in `archetypes.ts:169-170` ✓
- **Attack reach**: 150px used for targetInReach distance at `control.ts:489` ✓
- **Dexterity cooldown**: dexterity=10 calibrates attack cooldown at `archetypes.ts:187` ✓

### Splash Bullet (flamingRock)
- **flamingRock resolved**: attack.bullet resolves to act_flamingRock via registry at `archetypes.ts:250` ✓
- **Splash detection**: flamingRock.attack.type = `#explode` detected at `archetypes.ts:252` ✓
- **splashBullet assignment**: Assigned to EnemyAI at `archetypes.ts:364` and used in firing at `control.ts:536-541` ✓
- **Firing path**: fireSplashBullet() called with flamingRock's attack at `control.ts:540` ✓

### Bullet Reincarnation (flamingRock → fire)
- **Reincarnate parsing**: flamingRock.reincarnateAs = `[#fire]` parsed by parseReincarnate at `archetypes.ts:254` ✓
- **Assignment to projectile**: bulletReincarnate list set on Projectile at `control.ts:542` ✓
- **Spawn on death**: Projectile.finish() spawns children from reincarnateAs at `projectile.ts:81-86` ✓
- **Trigger points**: finish() called on bullet expiry (line 110), collision (line 127), or splash detonate (line 73) ✓
- **Fire mine spawn**: spawnFromSymbol("fire") routes to spawnMine() at `actorSerial.ts:49` ✓
- **Fire team**: fire spawned with team = `#fire` from its own data at `objTypes.ts:8` ✓

### Team Allegiance
- **lavaGolem team**: `#scarlet` correctly set at spawn (archetypes.ts:270) ✓
- **tem_scarlet data**: Team registry includes tem_scarlet with hates=[#aldevar, #village, #monsterSummon, ...] ✓
- **Fire mine team**: Separate team `#fire` from its own data (act_fire.txt:25) ✓

### Original Script Behavior
- **objBullet.reincarnate()**: Called in updateLand (objBullet.txt:282) when bullet's land animation completes ✓
- **modReincarnate spawning**: On #leftTeam event, spawns all children from pReincarnateAs at (modReincarnate.txt:49-72) ✓
- **Port equivalent**: Projectile.finish() spawns all reincarnateAs children when bullet finishes (projectile.ts:78-87) ✓

## Conclusion

**CLEAN** — lavaGolem exhibits full behavioral parity. The ranged AI classification, splash bullet detection, flamingRock reincarnation threading, and fire mine spawn chain are all correctly wired in the port. All data properties match, and the three code paths (expiry, collision, splash detonate) that trigger finish() correctly spawn the fire leave-behind. Team allegiance is preserved for both lavaGolem (#scarlet) and the spawned fire mine (#fire).
