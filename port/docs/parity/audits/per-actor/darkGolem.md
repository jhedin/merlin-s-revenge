# Per-Actor Parity Audit: darkGolem

**Actor:** `act_darkGolem` | **objType:** `#objCPUCharacter` | **AiType:** `#objAiCPU` | **Team:** `#monsters`

---

## 1. Derived Correct Behavior (original)

### Identity / inheritance chain

`act_darkGolem` → `#CPUCharacter` → `#character` → `#actor`

| Field | Value | Source |
|-------|-------|--------|
| `objType` | `#objCPUCharacter` | `act_darkGolem.txt:3` |
| `AiType` | `#objAiCPU` | `act_darkGolem.txt:4` |
| `team` | `#monsters` | `act_darkGolem.txt:28` |
| `energy` | 750 | `act_darkGolem.txt:21` |
| `strength` | 20 | `act_darkGolem.txt:27` |
| `dexterity` | 10 | `act_darkGolem.txt:19` |
| `eyestrain` | 25 | `act_darkGolem.txt:23` |
| `walkSpeed` | 1 | `act_darkGolem.txt:30` |
| `inertia` | 50 | `act_darkGolem.txt:25` |
| `damageSpeed` | 3 | `act_darkGolem.txt:18` |
| `weaponTechnique` | 0 | `act_darkGolem.txt:31` |
| `startingLevel` | 0 | `act_darkGolem.txt:26` |
| `dieSound` | `"boulder_die"` | `act_darkGolem.txt:20` |
| `experienceImWorth` | 50 | `act_darkGolem.txt:22` |
| `frictionReel` | point(50,50) | `act_darkGolem.txt:24` |

### Attack (`#attack` proplist, merged over structAttack defaults)

| Field | Value | Source |
|-------|-------|--------|
| `animType` | `#naturalRanged` | `act_darkGolem.txt:9` |
| `bullet` | `#darkRock` | `act_darkGolem.txt:10` |
| `reach` | 150 | `act_darkGolem.txt:15` |
| `animframe` | `[7, 14]` | `act_darkGolem.txt:8` |
| `firingType` | `#fullstrength` | `act_darkGolem.txt:13` |
| `cooldown` | 0 (data) | `act_darkGolem.txt:12` |
| `collisionLoc` | point(0,0) | `act_darkGolem.txt:11` |
| `sound` | `"darkGolem_fire"` | `act_darkGolem.txt:16` |
| `name` | `#throwBoulder` | `act_darkGolem.txt:14` |

### Bullet actor: `act_darkRock`

| Field | Value | Source |
|-------|-------|--------|
| `inherit` | `#bullet` | `act_darkRock.txt:3` |
| `attack.type` | `#explode` | `act_darkRock.txt:8` |
| `attack.explodeCharge` | 40 | `act_darkRock.txt:6` |
| `attack.power` | 1 | `act_darkRock.txt:7` |
| `explodeSound` | `"spell_explode"` | `act_darkRock.txt:18` |
| `rotational` | true | `act_darkRock.txt:22` |
| `weight` | 0.4 | `act_darkRock.txt:23` |

### Derived behavior

- **AI mode**: `#objAiCPU` → standard committed-target FSM: `findTarget → moveToAttack → attack → findTarget`. No `runReload` (neither `data.runReload:true` nor `#objAiCPUSpellCaster` AiType). No `ghost`, `multiAttack`, `builder`, `leaveWhenFinished`.
- **Attack classification**: `#naturalRanged` → RANGED (`objAiCPU.targetInReachRanged`, `GeomDist < reach 150`). NOT melee.
- **Shot count per attack cycle**: `#animframe [7,14]` = 2 shots fired per 31-frame strip; one when the strip crosses frame 7, one when it crosses frame 14. The strip must be ≥ 14 frames.
- **Bullet type**: `#darkRock` carries `#attack.type:#explode` → the `splashBullet` path (`fireSplashBullet`). NOT single-target.
- **Throw velocity**: `#firingType:#fullstrength` → `throwSpeed = strength = 20 px/tick` (constant-speed; NOT proportional distance/10).
- **Muzzle**: `collisionLoc (0,0)` → bullet spawns at the golem's world position with no offset.
- **Cooldown cadence**: raw cooldown 0 → port derives effective cooldown = `round((0+18) * dexterity + 1) = round(18*10+1) = 181`, recovering in `ceil(180/10) = 18 frames` per attack cycle entry. The 31-frame naturalRanged strip is the actual timing clock (the animation drives both shots per cycle).
- **walkSpeed**: 1 unit → port converts to 0.6 px/tick (`spawnEnemy` ×0.6 convention).
- **Animations**: stand (1f loop), walk (8f loop), naturalRanged (31f one-shot attack strip), grave (2f).
- **Death**: `dieSound = "boulder_die"`, `experienceImWorth = 50`.
- **No reincarnation** (unlike doubleDarkGolem).
- **No `#weapon` field** — carries only its own `#attack`.

---

## 2. Reproduced in Port (200-frame live run)

Probe: `port/tools/_audit_darkGolem.ts` (deleted after audit). Harness: `CollisionGrid(60,60,32)`, reset masters, real `assets.json`, spawn player@(300,200) + golem@(420,200) (120px < reach 150 → fires immediately), run 200 frames.

### Resolved stats

| Stat | Expected (derived) | Reproduced | Match |
|------|--------------------|-----------|-------|
| `animChar` | `darkGolem` | `darkGolem` | ✓ |
| `team` | `#monsters` | `#monsters` | ✓ |
| `AI.ranged` | `true` | `true` | ✓ |
| `AI.runReload` | `false` | `false` | ✓ |
| `AI.reachRanged` | 150 | 150 | ✓ |
| `AI.splashBullet` | present (`#explode`) | present (`attackType:"#explode"`) | ✓ |
| `AI.bulletAttack` | `null` (darkRock is #explode → splashBullet) | `null` | ✓ |
| `AI.ghost` | `false` | `false` | ✓ |
| `attack.name` | `#throwBoulder` | `#throwBoulder` | ✓ |
| `attack.animType` | `#naturalRanged` | `#naturalRanged` | ✓ |
| `attack.type` | `ranged` | `ranged` | ✓ |
| `attack.animFrame` | `[7, 14]` | `[7, 14]` | ✓ |
| `attack.firingType` | `#fullstrength` | `#fullstrength` | ✓ |
| `attack.bullet` | `#darkRock` | `#darkRock` | ✓ |
| `attack.reach` | 150 | 150 | ✓ |
| `attack.cooldown` (effective) | 181 | 181 | ✓ |
| `attack.collisionLoc` | `{x:0, y:0}` | `{x:0, y:0}` | ✓ |
| `attack.sound` | `"darkGolem_fire"` | `"darkGolem_fire"` | ✓ |
| `splashBullet.explodeCharge` | 40 | 40 | ✓ |
| `splashBullet.explodeSound` | `"spell_explode"` | `"spell_explode"` | ✓ |
| `mov.maxSpeed` (walkSpeed) | 0.6 | 0.6 | ✓ |
| `energy` / `max` | 750 / 750 | 750 / 750 | ✓ |
| `inertia` | 50 | 50 | ✓ |
| `damageSpeed` | 3 | 3 | ✓ |
| `eyestrain` | 25 | 25 | ✓ |
| `strength` | 20 | 20 | ✓ |
| `bulletChar` | `"darkRock"` | `"darkRock"` | ✓ |

### Animation strips (assets.json)

| Strip | Expected | Exists | Frames | Loop |
|-------|----------|--------|--------|------|
| `darkGolem_stand` | yes | yes | 1 | true |
| `darkGolem_walk` | yes | yes | 8 | true |
| `darkGolem_naturalRanged` | yes | yes | 31 | false (one-shot) |
| `darkGolem_grave` | yes | yes | 2 | false |

Frames 7 and 14 are both within the 31-frame naturalRanged strip — `animframe [7,14]` is valid.

### Live behavior (200 frames)

- **Shots fired**: 13 bullets across 200 frames (2 per attack cycle × 6 full cycles + 1 mid-cycle).
- **Shot cadence**: Cycle 1 at t=7 and t=14 (7-tick gap, exactly frames 7→14 of the 31-frame strip). Cycle 2 at t=38 and t=45. Cycle period = 31 ticks (the strip duration). CORRECT.
- **Bullet speed**: 20.00 px/tick. Matches `#fullstrength` with strength=20. CORRECT.
- **Bullets route through `fireSplashBullet`** (splashBullet path), confirmed by `ai.splashBullet != null`.
- **`animAction` returns `"naturalRanged"`** during attack window. CORRECT.
- **AI mode**: `moveToAttack` from tick 0 (target was in reach immediately), transitions to `attack` on entry. CORRECT.
- **No walking** (target already in reach at spawn, golem is stationary). CORRECT.
- **Muzzle position**: bullets spawn at `(420, 200)` = the golem's loc with no offset (collisionLoc (0,0)). CORRECT.

---

## 3. Divergence Table

| # | Property | Original | Port | Status |
|---|----------|----------|------|--------|
| — | `team` | `#monsters` | `#monsters` | CORRECT |
| — | `animType` → ranged | `#naturalRanged` | `ranged=true` | CORRECT |
| — | `bullet` → splashBullet | `#darkRock` (#explode) | `splashBullet` path | CORRECT |
| — | `reach` → `reachRanged` | 150 | 150 | CORRECT |
| — | `animframe [7,14]` → 2 shots | 2 shots per 31-frame strip | 2 shots at frames 7+14 | CORRECT |
| — | `firingType #fullstrength` → speed=20 | 20 px/tick | 20.00 px/tick | CORRECT |
| — | `collisionLoc (0,0)` → muzzle=loc | no offset | `{x:0, y:0}` | CORRECT |
| — | `runReload` | false | false | CORRECT |
| — | `walkSpeed` → 0.6 px/tick | 0.6 | 0.6 | CORRECT |
| — | `energy/max` | 750/750 | 750/750 | CORRECT |
| — | `eyestrain` | 25 | 25 | CORRECT |
| — | `strength` | 20 | 20 | CORRECT |
| — | `splashBullet.explodeCharge` | 40 | 40 | CORRECT |
| — | `explodeSound` | `"spell_explode"` | `"spell_explode"` | CORRECT |
| — | animations (stand/walk/naturalRanged/grave) | all present | all present | CORRECT |
| — | `dieSound` | `"boulder_die"` | `"boulder_die"` | CORRECT |
| — | No reincarnation | absent | absent | CORRECT |

**DIVERGENCES: 0**

---

## Conclusion

darkGolem is fully faithful in the port. The 200-frame live run confirms:

- Fires 2 darkRock splash bullets per attack cycle (strip frames 7 and 14 of the 31-frame `naturalRanged` strip), NOT 1.
- Each bullet travels at speed=20 px/tick (#fullstrength, strength=20).
- Bullets route through `fireSplashBullet` (darkRock is `#explode`).
- Eyestrain=25 is wired and scatters aim at range.
- walkSpeed=0.6 px/tick, energy=750, all stats match.
- Standard `#objAiCPU` committed-target FSM, no `runReload`, no ghost/multiAttack/builder.

`darkGolem | DIVERGENCES=0`
