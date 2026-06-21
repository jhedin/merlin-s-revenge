# Audit: lizardSoldier

## Property Coverage

| Property | Original | Port | Status |
|----------|----------|------|--------|
| objType | #objCPUCharacter | #objCPUCharacter | ✓ |
| AiType | #objAiCPU | #objAiCPU | ✓ |
| inherit | #CPUCharacter | #CPUCharacter | ✓ |
| damageSpeed | 3 | 3 | ✓ |
| strength | 5 | 5 | ✓ |
| dexterity | 10 | 10 | ✓ |
| energy | 200 | 200 | ✓ |
| walkSpeed | 3 | 3 | ✓ |
| team | #monsters | #monsters | ✓ |
| experienceImWorth | 30 | 30 | ✓ |
| eyestrain | 25 | 25 | ✓ |
| inertia | 60 | 60 | ✓ |
| startingLevel | 0 | 0 | ✓ |
| dieSound | #none | #none | ✓ |
| attack.animType | #naturalRanged | #naturalRanged | ✓ |
| attack.animframe | 6 | 6 | ✓ |
| attack.bullet | #lizardEgg | #lizardEgg | ✓ |
| attack.collisionLoc | point(14,-7) | {x:14, y:-7} | ✓ |
| attack.cooldown | 300 | 300 | ✓ |
| attack.firingType | #fullstrength | #fullstrength | ✓ |
| attack.name | #eggLaunch | #eggLaunch | ✓ |
| attack.reach | 150 | 150 | ✓ |
| attack.sound | #none | #none | ✓ |

## Bullet Data: lizardEgg

| Property | Original | Port | Status |
|----------|----------|------|--------|
| inherit | #bullet | #bullet | ✓ |
| attack.damageMultiplier | 5 | 5 | ✓ |
| attack.power | 0.5 | 0.5 | ✓ |
| attack.type | #bullet | #bullet | ✓ |
| character | #bullet | #bullet | ✓ |
| name | lizardEgg | lizardEgg | ✓ |
| friction | point(2,2) | {x:2, y:2} | ✓ |
| recordInRoomState | false | false | ✓ |
| reincarnateAs | [#bug, #bug, #bug] | [#bug, #bug, #bug] | ✓ |
| rotational | true | true | ✓ |
| weight | 1 | 1 | ✓ |

## Behavioral Verification

### 1. Ranged AI Classification
**Original (casts/):** `#naturalRanged` in attack.animType → objAiCPU reads as ranged AI  
**Port (port/src/):** 
- weapon.ts:95 classifies `#naturalRanged` → `"ranged"` type
- archetypes.ts:169-170 identifies `animType === "#naturalRanged"` → sets `ranged=true`
- control.ts:346 initializes `this.ranged` from config
- control.ts:489 uses `this.ranged` to determine reach band
- ✓ VERIFIED: Ranged AI behaves identically

### 2. Bullet Firing (Ranged Attack)
**Original (casts/):** modAttack.performRangedAttack fires #lizardEgg at #fullstrength velocity  
**Port (port/src/):** 
- control.ts:524-585 implements ranged attack dispatch
- Line 534: reads `firingType` property (defaulting to `#proportional`, else `#fullstrength`)
- Line 535: `#fullstrength` uses `this.strength` (5) as throw speed
- Line 581: fires bullet via `fireBullet()`, passing speed/power/mult/team
- ✓ VERIFIED: Firing velocity and properties match

### 3. Bullet Reincarnation Thread (Egg Hatching)
**Original (casts/):** 
- modReincarnate: lizardEgg.reincarnateAs = [#bug, #bug, #bug]
- objBullet.updateLand → setDead → me.big.reincarnate() (on land, not hit)
- reincarnate() spawns each non-#none entry at corpse location

**Port (port/src/):**
- archetypes.ts:249-254: Resolves bullet actor, extracts `reincarnateAs` via `parseReincarnateList()`
- archetypes.ts:273: Passes `bulletReincarnate` to EnemyAI config
- control.ts:366: CpuAI.init() stores `this.bulletReincarnate = cfg["bulletReincarnate"] ?? []`
- control.ts:583: On fire, threads to Projectile: `pb.get(Projectile).reincarnateAs = this.bulletReincarnate`
- projectile.ts:76-87 (finish method): Iterates reincarnateAs, spawns non-"none" entries at bullet death location
  - Calls `spawnFromSymbol(typ, x, y)` for each entry
  - Pushes child to game.entities
- ✓ VERIFIED: Egg hatches [#bug, #bug, #bug] at death location, children inherit own team (#monsters)

### 4. Movement & Pathfinding
**Original:** CPUCharacter carries pathfinding:true, walkType:#anyDirSpeed  
**Port:** archetypes.ts inherits from #CPUCharacter (pathfinding, walkType in data)  
**✓ VERIFIED**

### 5. Team & Allegiance
**Original:** team:#monsters → objects/enemies hunt #aldevar (player team)  
**Port:** 
- team:#monsters in data
- control.ts:525 reads team on attack
- EnemyAI.findTarget uses teamMaster via Targeting component
- ✓ VERIFIED: Same allegiance chain

### 6. Cooldown Calibration
**Original:** cooldown:300 + objAiCPU rate (dexterity:10)  
**Port:**
- archetypes.ts:180-188 derives effective cooldown from raw 300 + ranged overhead (18 frames) × dexterity (10)
- WeaponManager applies counter increment per tick
- ✓ VERIFIED: Cooldown is data-faithful (timings derived, not hard-coded)

## Conclusion

**CLEAN.** All properties match in resolution and type. All behavioral paths (ranged AI, bullet firing with full-strength velocity, egg reincarnation into 3× bug at death location, team/allegiance, cooldown) are correctly implemented and thread through the port's entity/component model. No divergences detected.
