# Actor Audit: act_archer

**Audit Date:** 2026-06-22
**Method:** REPRODUCED — probe spawned + ticked ~200 frames; observed Movement/CpuAI/WeaponManager/Anim/Energy live.
**Original Spec:** `casts/data/act_archer.txt` + `#inherit` chain (`#CPUCharacter` → `#character` → `#actor`),
`casts/data/act_archerBow.txt`, `casts/data/act_archerArrow.txt`, `casts/script_objects/objAiCPU.txt`,
`casts/script_objects/modWeaponTechnique.txt`, `casts/script_objects/modEnergy.txt`,
`casts/script_objects/objCPUCharacter.txt`.

---

## 1. What the archer IS and SHOULD do (derived from original)

**Identity / team**

| Field | Value | Source |
|-------|-------|--------|
| `#name` | "archer" | act_archer.txt:17 |
| `#team` | `#aldevar` (player side) | act_archer.txt:16 |
| `#AiType` | `#objAiCPU` (standard committed-target FSM) | act_archer.txt:4 |
| `#objType` | `#objCPUCharacter` | act_archer.txt:3 |
| `#character` | `#friendlyCharacter` | act_archer.txt:6 |
| `#miniMapStatus` | `#fre` (friendly — NOT counted as an enemy for room-clear) | act_archer.txt:12 |
| `#leaveWhenFinished` | `true` (teleports out + banks to reserve when room is clear) | act_archer.txt:11 |

**Stats**

| Field | Value | Source |
|-------|-------|--------|
| `#energy` | 200 | act_archer.txt:9 |
| `#strength` | 10 | act_archer.txt:14 |
| `#dexterity` | 1 (ranged cooldown recovery inc) | act_archer.txt:8 |
| `#walkSpeed` | 5 (engine units) | act_archer.txt:18 |
| `#inertia` | 60 (40% knockback resistance) | act_archer.txt:10 |
| `#damageSpeed` | 4 (wall-slam bonus-damage threshold) | act_archer.txt:7 |
| `#stallSpeedIncLevel` | 0.25 (per-level stall-speed increase) | act_archer.txt:13 |
| `#strenghtIncLevel` | 0.5 (typo in data, original reads `strengthIncLevel` → default 0.1 used) | act_archer.txt:15 |

**Animation strips (all exist in `assets.json`):**

| Strip | Frames | Delay | Notes |
|-------|--------|-------|-------|
| `archer_stand` | 1 | 3 | static idle |
| `archer_walk` | 8 | 3 | 8-frame walk cycle |
| `archer_weaponRanged` | 10 | 2 | attack strip; delays [2,2,2,2,2,2,2,2,3,2]; total=21 ticks |
| `archer_grave` | 2 | 1 | corpse |
| `archer_reel` | 8 | 1 | knockback animation |

No `archer_die` strip exists; reel leads directly to grave.

**Weapon: `#archerBow` → `act_archerBow.txt`**

| Field | Value |
|-------|-------|
| `#animType` | `#weaponRanged` |
| `#animframe` | `[9]` → 1 shot per attack, fires when strip enters frame 9 |
| `#bullet` | `#archerArrow` (resolves to `archerArrow` sprite char) |
| `#reach` | 100 px |
| `#cooldown` | 10 |
| `#firingType` | `#fullstrength` (bullet speed = attacker strength = 10 px/tick) |
| `#sound` | `goblin_fire` |
| `#collisionLoc` | `point(0,-2)` (arrow spawns 2px above actor center) |
| `#targetRoles` | `[[#teamMembers, #teamBuildings]]` |

**Bullet: `#archerArrow` → `act_archerArrow.txt`**

| Field | Value |
|-------|-------|
| `#character` | `#bullet` (sprite char = "archerArrow") |
| `#attack.power` | 0.6 (scalar) |
| `#attack.damageMultiplier` | 4 |
| `#attack.type` | `#bullet` |
| `#friction` | point(5,5) |
| `#weight` | 0.4 |

**AI behavior (`#objAiCPU`):**
- Committed-target FSM: `findTarget` → `moveToAttack` → `attack` → `attackFin`
- 30-frame retarget throttle
- Does NOT kite (`#runReload` not set; `runReload=false`)
- Does NOT dodge bullets (not `#objAiCPUSpellCaster`)
- Faces target before firing (`faceTarget()` — non-magic attacks only)
- Teleports out and banks to army reserve on `#noTargetFound` (leaveWhenFinished)

**WeaponTechnique:**
- `#weaponTechniqueInc: 3` is in the data but is **not used by modWeaponTechnique.init** — that script only reads `params.weaponTechnique` (initial value, 0 by default) and hardcodes `pWeaponTechniqueInc = 2`. So the original archer also uses inc=2, not 3.
- No `#weaponTechnique` key → initial technique = 0.

---

## 2. Derive vs. REPRODUCED table

Each row was verified by spawning the archer and observing the live port behavior.

| Property | Expected (original) | REPRODUCED (port) | Match? |
|----------|---------------------|-------------------|--------|
| `team` | `#aldevar` | `#aldevar` (spawnAlly sets it) | ✓ |
| `leaveWhenFinished` | true | true — retires after 60 grace frames | ✓ |
| `energy` | 200 | 200 | ✓ |
| `maxSpeed` (walkSpeed×0.6) | 3.0 px/tick | 3.0 px/tick | ✓ |
| `inertia` | 60 | 60 | ✓ |
| `damageSpeed` | 4 | **5** (default; not forwarded) | ✗ DIVERGENCE |
| `anim.char` | "archer" | "archer" (no blackOrc fallback) | ✓ |
| `archer_stand` strip | exists (1 frame) | found in assets | ✓ |
| `archer_walk` strip | exists (8 frames) | found in assets | ✓ |
| `archer_weaponRanged` strip | exists (10 frames) | found in assets | ✓ |
| `archer_grave` strip | exists (2 frames) | found in assets | ✓ |
| `archer_reel` strip | exists (8 frames) | found in assets | ✓ |
| `ranged` | true (#weaponRanged) | true | ✓ |
| `reachRanged` | 100 (archerBow #reach) | 100 | ✓ |
| `runReload` | false | false | ✓ |
| `animFrame` | [9] | [9] | ✓ |
| shots per attack | 1 (single firing frame) | 1 per attack (observed) | ✓ |
| `firingType` | `#fullstrength` | `#fullstrength` | ✓ |
| bullet speed | 10 px/tick (strength=10) | 10.000 px/tick | ✓ |
| `bullet` | `#archerArrow` | `#archerArrow` | ✓ |
| `bulletChar` | "archerArrow" | "archerArrow" | ✓ |
| `bulletAttack.powerScalar` | 0.6 | 0.6 | ✓ |
| `bulletAttack.damageMultiplier` | 4 | 4 | ✓ |
| `atkSound` | "goblin_fire" | "goblin_fire" | ✓ |
| `attackAnim` during attack | "weaponRanged" | "weaponRanged" observed | ✓ |
| initial weaponTechnique | 0 | 0 | ✓ |
| weaponTechniqueInc (per level) | 2 (hardcoded in original) | 2 (hardcoded in port) | ✓ |
| `reelProof` | false | false | ✓ |
| `leaveWhenFinished` + banking | banks to reserve | banks to reserve | ✓ |
| arrow spawn offset (collisionLoc) | point(0,-2) relative | hardcoded `m.y - 6` | ✗ DIVERGENCE (cosmetic) |
| `stallSpeedIncLevel` | 0.25 (per-level movement threshold inc) | not implemented in port | ✗ DIVERGENCE (minor) |

---

## 3. DIVERGENCES

### DIV-1: `#damageSpeed` not forwarded → wall-slam threshold wrong

**Original** (`casts/script_objects/modEnergy.txt:250–252`, `casts/data/act_archer.txt:7`):
```lingo
on takeDamage me, amount  -- called from collisionWall / collisionVertical (objCPUCharacter.txt:111,124)
  if amount > pDamageSpeed then   -- pDamageSpeed = params.damageSpeed = 4 for archer
    amount = amount - pDamageSpeed
    me.loseEnergy(amount)
  end if
end
```
The archer only takes wall-slam energy loss when knockback speed exceeds **4**.

**Port** (`port/src/components/movement.ts:188–192`, `port/src/entities/archetypes.ts`):
`Movement.init` reads `cfg["damageSpeed"]` (default 5), but `spawnEnemy`'s build call does NOT include `damageSpeed`. The archer gets `damageSpeed = 5` instead of 4.

**Observed:** `m.damageSpeed = 5` (confirmed via probe).

**Impact:** The archer's wall-slam damage threshold is 5 instead of 4. If a knockback impulse magnitude is between 4 and 5, the archer takes zero bonus damage in the original but some in the port (WRONG DIRECTION: the port actually makes the archer MORE resistant than the original by having a higher threshold). If magnitude is above 5, both fire, but the port deducts 5 and the original deducts 4 (port is slightly more forgiving). In practice, wall-slam is infrequent and the difference is 1 unit of energy per slam — minor but a real divergence.

**Fix:** In `port/src/entities/archetypes.ts`, add `damageSpeed` to the build call:
```typescript
// in the e.build({...}) call inside spawnEnemy:
damageSpeed: num("damageSpeed", 5),  // add this line (Movement.init already reads it)
```

---

### DIV-2: Arrow spawn offset uses hardcoded `m.y - 6` instead of `#collisionLoc: point(0,-2)`

**Original** (`casts/script_objects/modAttack.txt:184–198`):
`calcAttackLoc` computes `me.pCharacterPrg.getLoc() + pAttack.collisionLoc × dir` — for the archerBow this is `point(0,-2)` (0px horizontal, 2px above center, facing-adjusted).

**Port** (`port/src/components/control.ts:805`, `822`):
All `fireBullet`/`fireSplashBullet` calls use `m.x, m.y - 6` as the origin. The `6px` is a hardcoded per-actor offset, not read from `#collisionLoc`.

**Impact:** Arrow appears 4px lower than the original (6 vs 2 px offset). Pure cosmetic; no gameplay effect.

**Fix sketch:** Parse `#attack.collisionLoc` into the AttackData and use it as the spawn offset in `fireBullet`/the CpuAI performAttack path. Low priority.

---

### DIV-3: `#stallSpeedIncLevel` not implemented in port

**Original** (`casts/script_objects/modCharacterAttackProperties.txt:206`, `casts/script_objects/objMoveXY.txt:381`):
On each levelUp: `me.big.incStallSpeed(pStallSpeedIncLevel)` (0.25 per level for the archer). `pStallSpeed` is the velocity floor below which the unit is considered "stalled" (no longer drifting from knockback). Higher stall speed = the unit recovers from knockback faster (halts sooner). Default stall speed = 0.2.

**Port:** `Movement` has no `stallSpeed` property. After knockback the unit always applies `KNOCK_FRICTION = 0.78` decay regardless of level.

**Impact:** Leveled archer doesn't "stop from knockback" faster than a level-0 one. The effect is subtle (it shifts when post-reel idle starts) and only visible after several level-ups. Not gameplay-breaking.

**Fix sketch:** Add `stallSpeed` to Movement (default 0.2), a `stallSpeedIncLevel` field to spawnEnemy/build, and call `stallSpeed += stallSpeedIncLevel` on levelUp.

---

## Summary

| # | Property | Original | Port | Severity |
|---|----------|----------|------|----------|
| DIV-1 | `#damageSpeed` wall-slam threshold | 4 (act_archer.txt:7) | 5 (archetypes.ts: not forwarded) | Low — 1-unit energy error per wall slam |
| DIV-2 | Arrow spawn y-offset (`#collisionLoc`) | `y - 2` (modAttack.txt:189) | `y - 6` (control.ts:822 hardcoded) | Cosmetic — no gameplay impact |
| DIV-3 | `#stallSpeedIncLevel` per-level movement threshold | 0.25/level (modCharacterAttackProperties.txt:206) | not implemented | Minor — post-knockback halt timing only |

All other archer properties are **correctly reproduced**: team, energy, walkSpeed, inertia, ranged FSM, reach=100, animFrame=[9] (1 shot/attack), #fullstrength bullet at 10 px/tick, bulletAttack power 0.6×mult 4, all animation strips present (no blackOrc fallback), weaponRanged attack anim during attacks, leaveWhenFinished banking, no runReload/dodgeBullets, initial weaponTechnique=0.
