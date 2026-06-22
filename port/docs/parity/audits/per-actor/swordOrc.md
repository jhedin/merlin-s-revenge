# Behavioral Audit: act_swordOrc

**Audit Date**: 2026-06-22
**Method**: Derive from original cast files, then spawn + tick 200 frames in port, observe all components.
**Result**: 1 REAL DIVERGENCE found (`#damageSpeed` not forwarded).

---

## 1. Derived Correct Behavior (Original)

### Identity
- Name: `swordOrc` (acts as enemy, #objCPUCharacter, #objAiCPU FSM)
- Team: `#orcs` (hunts `#aldevar`, `#monsterSummon`, `#karate`, `#magicalAlliance`, `#ninja`, `#undead`, `#scarlet`, `#village`; friends with `#goblins`)
- Character: `#friendlyCharacter` (override of objCPUCharacter's default `#enemyCharacter` — controls internal display only, not targeting)

### Stats (full inheritance chain: actor → character → CPUCharacter → swordOrc)
| Property | Effective Value | Source |
|----------|----------------|--------|
| energy | 300 | act_swordOrc.txt:9 |
| strength | 3 | act_swordOrc.txt:15 |
| walkSpeed | 8 | act_swordOrc.txt:18 |
| inertia | 70 | act_swordOrc.txt:10 |
| dexterity | 4 | act_swordOrc.txt:8 (ranged cooldown; irrelevant for melee) |
| agility | 1 | act_character.txt default |
| eyestrain | 70 | act_swordOrc.txt:11 (ranged aim scatter; irrelevant for melee) |
| damageSpeed | 2 | act_swordOrc.txt:7 (wall-slam damage threshold) |
| stallSpeed | 3 | act_swordOrc.txt:14 (velocity decay on hit; out-of-scope in port) |
| experienceImWorth | 20 | act_swordOrc.txt:12 |
| pathfinding | true | act_CPUCharacter.txt:6 |

### Weapon: #orcSword (act_orcSword.txt)
- animType: `#weaponMelee` → melee unit (NOT ranged)
- power: `point(1, 0)` → powerScalar = 1
- damageMultiplier: 8
- cooldown: 0 (raw; becomes 7 after port calibration agility=1)
- sound: `skeleton_fire`
- hits: `[#teamMembers, #teamBuildings]` (area melee, both unit roles)
- targetRoles: `[[#teamMembers, #teamBuildings]]`
- `#animframe: [6, 10, 12]` → **3 hits per swing** (three firing frames, 1-based)
- collisionLoc: `point(10, 6)` → original melee strike point 10px to the side
- No `reach` key → structAttack default `25`

### Sprite / Animations (all from `swordOrc_<action>` strips in assets.json)
| Strip | Exists | Frames | Total Ticks |
|-------|--------|--------|-------------|
| swordOrc_stand | YES | 1 | 2 |
| swordOrc_walk | YES | 8 | 16 |
| swordOrc_weaponMelee | YES | 16 | 29 |
| swordOrc_grave | YES | 2 | 4 |

No `swordOrc_dead` or `swordOrc_die` strip — death uses the grave strip (objCPUCharacter path).

**Attack strip timing**: Firing frames 6, 10, 12 fire at ticks 7, 15, 19 respectively into the 29-tick animation.  
All three frames are well within the 29-tick strip — no out-of-bounds.

### AI/Movement (objAiCPU committed-target FSM)
- findTarget → moveToAttack (approach) → attack (3-hit swing) → attackFin (retarget)
- Retarget throttle: 30 frames before forced re-eval
- No runReload, no ghost, no spellcaster, no builder, no multiAttack
- Pathfinding: true (K3 scenic pathfinding in port)

### Death / Grave
- No reincarnation
- No dieSound
- Leaves grave (modGrave: pGraveOn=true; ghost=false)
- swordOrc_grave strip exists (2 frames)

---

## 2. Port Reproduction (Observed via Probe)

Probe: `tools/_audit_swordOrc.ts` (deleted after use).  
Setup: CollisionGrid 40×40 (32px tiles), player at (300,200), swordOrc at (320,200), 200 ticks.

### Animation strips — all resolve to `swordOrc_*` (no fallback)
```
swordOrc_stand   OK  1 frame, delay=2
swordOrc_walk    OK  8 frames, delay=2, totalTicks=16
swordOrc_weaponMelee  OK  16 frames, totalTicks=29
swordOrc_grave   OK  2 frames, delay=2
```
No fallback to blackOrc or any other char. Anim.char = "swordOrc" confirmed.

### Components observed at spawn
| Component | Observed | Expected | Match |
|-----------|----------|----------|-------|
| EnemyAI.ranged | false | false (weaponMelee → melee) | ✓ |
| EnemyAI.runReload | false | false | ✓ |
| EnemyAI.ghost | false | false | ✓ |
| EnemyAI.reach | 25 | 25 (structAttack default, no orcSword.reach override) | ✓ |
| EnemyAI.atkSound | "skeleton_fire" | "skeleton_fire" | ✓ |
| WeaponManager.name | "#orcSword" | "#orcSword" | ✓ |
| WeaponManager.animType | "#weaponMelee" | "#weaponMelee" | ✓ |
| WeaponManager.type | "melee" | "melee" | ✓ |
| WeaponManager.cooldown | 7 | 7 (rawCooldown=0 + 6 melee corr; agility=1 → round(6×1+1)=7) | ✓ |
| WeaponManager.damageMultiplier | 8 | 8 | ✓ |
| WeaponManager.powerScalar | 1 | 1 | ✓ |
| WeaponManager.animFrame | [6,10,12] | [6,10,12] | ✓ |
| WeaponManager.sound | "skeleton_fire" | "skeleton_fire" | ✓ |
| WeaponManager.hits | ["#teamMembers","#teamBuildings"] | ["#teamMembers","#teamBuildings"] | ✓ |
| Movement.maxSpeed (walkSpeed) | 4.8 | 4.8 (8×0.6 conv) | ✓ |
| Movement.inertia | 70 | 70 | ✓ |
| **Movement.damageSpeed** | **5** | **2** | **✗ DIVERGENCE** |
| Energy.energy | 300 | 300 | ✓ |
| Energy.max | 300 | 300 | ✓ |
| Team.team | "#orcs" | "#orcs" | ✓ |
| Anim.char | "swordOrc" | "swordOrc" | ✓ |
| Grave.getGraveOn() | true | true | ✓ |

### Live tick observations (200 frames)
- **Target acquisition**: YES — AI targeted player on tick 0 (mode "moveToAttack" immediately at tick 0 because orc starts within reach 25)
- **Facing/facing-lock**: orc at x=320 faces left toward player at x=300 (facingLeft=true on attack)
- **Attack fired**: YES — attack cycle entered immediately (orc starts within reach)
- **animAction observed**: "weaponMelee" (the attack strip plays; only "weaponMelee" seen)
- **Hits per attack cycle**: [3, 3, 3, 3, 3, 3, 3] — exactly **3 hits per swing** (frames 6, 10, 12 all fire)
- **Damage per hit**: 4.32 (power=1 × strength=3 × ENEMY_DAMAGE_SCALE=0.18 × damageMultiplier=8)
- **Player HP**: 200 → 109.28 after 200 frames (21 hits total across 7-8 attack cycles + cooldowns)
- **Mode distribution**: 200/200 frames in "moveToAttack" (no findTarget needed — player always in reach)
- **Death/grave**: after forced kill, isDead=true, Anim.action="grave", getGraveOn()=true ✓

---

## 3. Derive-vs-Reproduced Table

| Aspect | Derived (Original) | Reproduced (Port) | Status |
|--------|--------------------|-------------------|--------|
| Identity / team | `#orcs`, enemy | `#orcs`, entity.type="enemy" | ✓ |
| Sprite char | swordOrc | swordOrc (Anim.char) | ✓ |
| stand strip | swordOrc_stand (1 frame) | EXISTS, 1 frame | ✓ |
| walk strip | swordOrc_walk (8 frames) | EXISTS, 8 frames | ✓ |
| attack strip | swordOrc_weaponMelee (16 frames) | EXISTS, 16 frames | ✓ |
| grave strip | swordOrc_grave (2 frames) | EXISTS, 2 frames | ✓ |
| AI type | #objAiCPU (committed-target) | CpuAI (findTarget→moveToAttack→attack) | ✓ |
| Ranged | No (weaponMelee) | ranged=false | ✓ |
| runReload | No | runReload=false | ✓ |
| walkSpeed | 8 engine → 4.8 px/tick | 4.8 (Movement.maxSpeed) | ✓ |
| inertia | 70 | 70 (Movement.inertia) | ✓ |
| energy | 300 | 300 (Energy.energy/max) | ✓ |
| strength | 3 | 3 (EnemyAI.strength) | ✓ |
| Cooldown | rawCooldown=0 → 7 frames | 7 (WeaponManager.cooldown) | ✓ |
| animFrame | [6,10,12] | [6,10,12] (WeaponManager.animFrame) | ✓ |
| Hits per swing | 3 (animframes 6,10,12 each fire once) | 3 (confirmed via probe) | ✓ |
| damageMultiplier | 8 | 8 | ✓ |
| power (melee) | point(1,0) → scalar 1 | powerScalar=1 | ✓ |
| Damage per hit | power·str·scale·mult = 4.32 | 4.32 observed | ✓ |
| sound | skeleton_fire | skeleton_fire | ✓ |
| hits | [#teamMembers, #teamBuildings] | ["#teamMembers","#teamBuildings"] | ✓ |
| experienceImWorth | 20 | 20 (Experience component) | ✓ |
| grave | leaves swordOrc_grave on death | getGraveOn()=true, action="grave" after death | ✓ |
| reincarnation | none | none | ✓ |
| dieSound | none | none | ✓ |
| **damageSpeed** | **2** (act_swordOrc.txt:7) | **5** (port default, not forwarded) | **✗ DIVERGENCE** |
| stallSpeed | 3 | not implemented (out-of-scope) | — (known omission) |
| eyestrain | 70 (irrelevant for melee) | 70 in data; ignored for melee path | ✓ (no melee effect) |
| miniMapStatus | #inf (room has enemies) | used at room-scan level only | ✓ |

---

## DIVERGENCES

### D-1: `#damageSpeed` not forwarded in `spawnEnemy()`

**Severity**: Low (only affects the wall-slam bonus damage path, not normal melee hits)

**Original** (`casts/data/act_swordOrc.txt:7`):
```
#damageSpeed: 2,
```
In `objCPUCharacter.collisionWall/collisionVertical` (and port's `movement.ts:184-192`), when a unit is knocked into a wall during reel/knockback, it takes bonus damage equal to `|impact| − damageSpeed`. A **lower** `damageSpeed` threshold means the unit is MORE sensitive to wall-slam bonus damage (hurt on any knockback > 2), while a **higher** value means it needs a bigger hit before wall slams hurt it extra.

**Port** (`port/src/components/movement.ts:47,67`):
```ts
damageSpeed = 5;  // default
// in init:
this.damageSpeed = typeof cfg["damageSpeed"] === "number" ? cfg["damageSpeed"] : 5;
```
`spawnEnemy()` in `port/src/entities/archetypes.ts` (lines ~284–348) builds the entity but **never passes `damageSpeed`** in the `e.build({…})` call. So `Movement.damageSpeed` always stays `5` for all CPU units.

**Observed**: `Movement.damageSpeed = 5` (probe); **expected `2`**.

**Effect**: The port swordOrc is harder to wall-slam for bonus damage (needs knockback > 5 instead of > 2). This understates wall-collision punishment for this unit.

**Fix sketch**: In `spawnEnemy()` (`archetypes.ts`), add `damageSpeed` to the build payload:
```ts
// inside the e.build({...}) call:
damageSpeed: num("damageSpeed", 5),
```
This is a cross-cutting fix that would also fix the same omission for all other CPU actors that set `#damageSpeed` (97 actors in the data set; all currently default to `5`).

**Reference**:
- Original: `casts/data/act_swordOrc.txt:7`
- Port component: `port/src/components/movement.ts:47,67`
- Port spawn: `port/src/entities/archetypes.ts` (build call ~line 284; no `damageSpeed` key present)

---

## Notes on Non-Divergences

- **`#eyestrain: 70`**: Only consumed by `aimWithEyestrain()` (ranged/magic attacks). swordOrc is melee (`ranged=false`), so eyestrain has zero effect — port faithfully ignores it in the melee path.
- **`#stallSpeed: 3`**: `stallSpeed` is a known out-of-scope property (controls velocity-decay rate post-knockback in `objMoveXY.setStallSpeed`). Not implemented in the port; this is a global omission, not a swordOrc bug.
- **`#character: #friendlyCharacter`**: Internal classification in the original engine controlling energy-bar color / flash behavior. Has no separate component in the port; behavior is equivalent through the existing Hurt/Energy/Grave stack.
- **`#dexterity: 4`**: Dexterity drives ranged cooldown recovery. Since swordOrc has `#weaponMelee`, melee uses `agility` (=1 default) for cooldown recovery. Dexterity=4 has no effect on this actor's attack cadence — correct.
- **Melee reach (structAttack default 25 vs collisionLoc point(10,6))**: The port uses scalar radial distance 25 for `targetInReach`; the original uses a strike-point inside-rect check anchored at collisionLoc x=10. The port's reach is slightly wider. This is a known/documented port approximation (all melee units), not a swordOrc-specific bug.
