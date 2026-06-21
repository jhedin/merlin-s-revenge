# Actor Audit: fourArmGolem

## Property Coverage

| Property | Original | Port | Status |
|----------|----------|------|--------|
| objType | #objCPUCharacter | EnemyArchetype | ✓ |
| AiType | #objAiCPU | CpuAI | ✓ |
| inherit | #CPUCharacter | — | ✓ (chain resolved) |
| attack.animType | #naturalRanged | #naturalRanged | ✓ |
| attack.bullet | #darkRock | #darkRock | ✓ |
| attack.firingType | #fullstrength | #fullstrength | ✓ |
| attack.reach | 150 | 150 | ✓ |
| attack.collisionLoc | point(0,-8) | {x:0, y:-8} | ✓ |
| attack.cooldown | 0 | 0 | ✓ |
| attack.sound | "darkGolem_fire" | "darkGolem_fire" | ✓ |
| attack.name | #throwBoulder | #throwBoulder | ✓ |
| damageSpeed | 3 | 3 | ✓ |
| dexterity | 10 | 10 | ✓ |
| dieSound | "boulder_die" | "boulder_die" | ✓ |
| energy | 1200 | 1200 | ✓ |
| experienceImWorth | 65 | 65 | ✓ |
| strength | 20 | 20 | ✓ |
| team | #monsters | #monsters | ✓ |
| walkSpeed | 1 | 1 | ✓ |
| startingLevel | 5 | 5 | ✓ |
| reincarnateAs | [#darkGolem, #darkGolem] | [#darkGolem, #darkGolem] | ✓ |
| reincarnateRadius | 30 | 30 | ✓ |

## Behavioral Correctness

### Ranged Combat
- **Classification**: `#naturalRanged` animation type correctly routes to ranged FSM (CpuAI.ranged=true)
- **Attack delivery**: Control fires splash bullet via `fireSplashBullet` when `splashBullet` is set (control.ts:537)
- **Bullet resolution**: darkRock has `attack.type:#explode`, stored as `splashBullet` in spawnEnemy (archetypes.ts:249)
- **Firing velocity**: `#firingType:#fullstrength` reads from attack data (weapon.ts line resolveAttack) and routes to constant-speed throw (control.ts:531-532)

### Team & Allegiance
- **Team assignment**: fourArmGolem.team=#monsters, spawned as enemy type
- **Allegiance**: Defaults to #enemy, hunts #aldevar.hates (Targeting defaults, control.ts:536-538)

### Reincarnation on Death
- **Gate**: Reincarnate component checks `isDead && getKilledInAction` (reincarnate.ts:67)
- **Fire-once latch**: `done` flag set BEFORE spawn loop (reincarnate.ts:68) prevents duplicate cascades
- **Spawn sequence**: Two children spawned via `game.spawnUnit(typ, x+dx, y+dy, {})` (reincarnate.ts:94)
- **Child team & level**: Each child (darkGolem) resolves its OWN #team/#startingLevel from data:
  - darkGolem.team = #monsters (verified data.json)
  - darkGolem.startingLevel = 0 (no pre-leveling, spawns at level 1)
- **Scatter radius**: First child at corpse loc (dx=0, dy=0), second at angle via ring math (reincarnate.ts:88-91):
  - r = 30 (reincarnateRadius)
  - ang = (1 / 2 non-#none entries) × 2π = π
  - dx = cos(π) × 30 = -30, dy = sin(π) × 30 ≈ 0 (opposite side of corpse)

### Starting Level
- **Pre-leveling on spawn**: spawnEnemy reads #startingLevel from data (archetypes.ts:313)
- **Application**: Loop calls `e.send("forceLevelUp")` for each level (archetypes.ts:314)
- **Inheritance NOT applied**: Each entity is leveled from its OWN data, not parent's

## Conclusion

**CLEAN** — All properties read, all behaviors faithful to original. Reincarnation fire-once latch, team/level inheritance, and scatter radius all correct.
