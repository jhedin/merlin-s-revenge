# Plant Actor Behavioral Parity Audit

## Original Data (casts/data/act_plant.txt)

| Property | Value | Purpose |
|----------|-------|---------|
| objType | #objCPUCharacter | Ranged CPU character archetype |
| AiType | #objAiCPU | Standard committed-target AI |
| inherit | #CPUCharacter | Base CPU (walkSpeed 3, pathfinding) |
| team | #swamp | Hostile to #aldevar |
| teamRole | #teamBuildings | Targetable by building-role hunters |
| walkSpeed | 0 | Overrides parent's 3 → STATIONARY |
| reelProof | true | Knockback immune |
| **Attack** | | |
| animType | #naturalRanged | Ranged thrower archetype |
| name | #needleShot | Attack identifier |
| bullet | #needle | Projectile actor |
| cooldown | 100 | Fire rate in frames |
| reach | 180 | Range threshold (px) |
| firingType | #fullstrength | Constant-speed projectile |
| dexterity | 1 | Cooldown counter increment |
| **Character Stats** | | |
| dexterity | 3 | (distinct from attack.dexterity) |
| strength | 15 | Melee/projectile power base |
| energy | 80 | Health |
| inertia | 40 | Knockback damping (but reelProof blocks it) |
| frictionReel | point(0,10) | Non-issue (catalogued) |

**Bullet (act_needle.txt):**
- damageMultiplier: 6
- power: 0.2 (scalar)
- friction: point(8,8), weight: 0.6 (non-issues: catalogued)

## Port Implementation (port/src/entities/archetypes.ts)

### Archetype & Loading
- **spawnEnemy("plant")** → EnemyArchetype.create() at line 137
- **Data resolution:** registry.resolveActor("plant") loads all inherited properties
- **Result:** ✓ Correct archetype selected

### Stationary Behavior (walkSpeed=0)
```
Line 267: walkSpeed = num("walkSpeed", 3) * 0.6 = 0 * 0.6 = 0
Movement.init (movement.ts:37): this.maxSpeed = cfg["walkSpeed"] = 0
Movement.update (movement.ts:80–89): intent multiplied by accel, capped to maxSpeed
```
- With maxSpeed=0, velocity never exceeds 0
- Control component sets intentX/intentY; Movement caps it to zero
- **Result:** ✓ Unit stationary in both systems

### Ranged AI Classification
```
Line 163: animType = "#naturalRanged" (resolved from attack)
Lines 169–170: ranged = opts.ranged ?? (animType === "#naturalRanged" || ...)
```
- typeFromAnimType("#naturalRanged") → "ranged" (weapon.ts:95)
- CpuAI.ranged set to true at init
- **Result:** ✓ Correctly classified as ranged

### Needle Bullet Resolution
```
Line 249–255:
  if (ranged && typeof atk["bullet"] === "string" && atk["bullet"] !== "#none") {
    const bulletActor = registry.resolveActor(atk["bullet"].replace(/^#/, ""));
    const ba = bulletActor ? resolveAttack(bulletActor["attack"], bulletActor) : undefined;
```
- Resolves act_needle actor record
- Calls resolveAttack() on needle's #attack
- **Needle attack resolved with:**
  - power: 0.2 → powerScalar=0.2
  - damageMultiplier: 6
- **Result:** ✓ Needle attack correctly loaded

### Fire Rate (Cooldown Calibration)
```
Line 180–188:
  rawCooldown = atk["cooldown"] = 100
  framesWanted = Math.max(1, 100 + 18) = 118  (ranged +18)
  counterInc = dexterity = 1  (plant's attack.dexterity)
  effectiveCooldown = Math.round(118 * 1 + 1) = 119
```
- Cooldown counter initialized with cooldown=119, inc=1 (weapon.ts:265–268)
- Recovery time: ceil((119-1)/1) = 118 frames (faithful to original)
- **Result:** ✓ Calibrated correctly

### Team & Role Configuration
```
Line 270: team = str("team", "#monsters") → "#swamp"
Line 270: teamRole = "#teamBuildings"
```
- **Result:** ✓ Correctly loaded

### Knockback Immunity (reelProof)
```
Line 311: reelProof: d["reelProof"] === true
Movement.takeHit (movement.ts:57):
  if (!this.entity.send("isReelProof")) {
    // apply knockback impulse
  }
```
- Entity carries reelProof flag in build config
- Movement checks before applying impulse
- **Result:** ✓ Knockback blocked as intended

### Attack Execution & Movement
```
CpuAI.updateMoveToAttack (control.ts:470–487):
  targetInReach(d) → d <= this.reachRanged (180)
  If in reach → attack()
  Else → path.findPathToLoc() (K3 pathfinding)

With walkSpeed=0:
  Movement.update() caps all velocity to 0
  Even if pathfinding sets intent, Movement cannot execute it
```
- Plant shoots at targets in reach (180)
- Cannot move to pursue (walkSpeed=0)
- **Result:** ✓ Stationary ranged defender behavior preserved

### Fire Mechanism (firingType:#fullstrength)
```
Line 544–545:
  isFullStrength = (ftAttack?.firingType ?? "#proportional").toLowerCase() === "#fullstrength"
  throwSpeed = isFullStrength ? Math.max(1, this.strength) : Math.max(0.5, throwDist/10)
  throwSpeed = Math.max(1, 15) = 15
```
- fireBullet() at line 594 spawns projectile with correct speed
- Bullet damage = powerScalar·dmgRef·BULLET_DAMAGE_SCALE = 0.2·4.5·0.40 ≈ 0.36 (calibrated K1)
- damageMultiplier applied as mult=6
- **Result:** ✓ Projectile fired with correct speed and damage scaling

## Comparison Table

| Aspect | Original (casts/) | Port (port/src) | Status | Citation |
|--------|-------------------|-----------------|--------|----------|
| **Archetype** | #objCPUCharacter | EnemyArchetype | ✓ | archetypes.ts:137 |
| **AI FSM** | #objAiCPU | CpuAI component | ✓ | control.ts:306 |
| **Team** | #swamp | "#swamp" | ✓ | archetypes.ts:270 |
| **Team Role** | #teamBuildings | "#teamBuildings" | ✓ | archetypes.ts:270 |
| **walkSpeed** | 0 (override) | 0·0.6 = 0 | ✓ | archetypes.ts:267 |
| **Movement Capability** | Stationary | Stationary (maxSpeed=0) | ✓ | movement.ts:37 |
| **Attack Type** | #naturalRanged | ranged=true | ✓ | archetypes.ts:169 |
| **Range** | 180 | 180 (loaded) | ✓ | archetypes.ts:290; control.ts:499 |
| **Bullet** | #needle | needle resolved | ✓ | archetypes.ts:249–254 |
| **Bullet Power** | 0.2 | 0.2 (scalar) | ✓ | weapon.ts:resolveAttack |
| **Bullet Multiplier** | 6 | 6 | ✓ | weapon.ts:resolveAttack |
| **Cooldown (raw)** | 100 | 119 (calibrated) | ✓ | archetypes.ts:180–188 |
| **Firing Speed** | #fullstrength | constant (strength=15) | ✓ | control.ts:544–545 |
| **reelProof** | true | true in cfg | ✓ | archetypes.ts:311; movement.ts:57 |
| **Strength** | 15 | 15 (loaded) | ✓ | archetypes.ts:269 |
| **Energy** | 80 | 80 (loaded) | ✓ | archetypes.ts:268 |
| **Attack Behavior** | In-range fire + idle | In-range fire + idle (no move) | ✓ | control.ts:534–616 |

## Conclusion

**CLEAN** — Plant actor exhibits behavioral parity across both implementations:

1. **Stationary ranged defender** correctly implemented: walkSpeed=0 prevents movement in both trees
2. **Needle projectile** correctly resolved from act_needle.txt with faithful power (0.2) and damageMultiplier (6)
3. **Fire rate** calibrated via dexterity (1) and original cooldown (100 frames)
4. **Team and role** correctly loaded (#swamp, #teamBuildings)
5. **Knockback immunity** (reelProof:true) correctly blocks impulse in Movement.takeHit()
6. **AI behavior** follows ranged attack loop: find target → move/path to range → fire at in-reach targets

No behavioral divergences. The port faithfully reproduces the original's stationary needle-thrower archetype.
