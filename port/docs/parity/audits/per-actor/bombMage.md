# Behavioral Audit: `act_bombMage`

**Scope:** REPRODUCED — behavior verified by running the port with the real asset bundle.
**Method:** Live probe (`port/tools/_audit_bombMage.ts`) ran 400 ticks with CollisionGrid, reset masters, spawned player + bombMage, called `rebuildCombatSubstrate()` each tick, observed EnemyAI / Anim / WeaponManager / Movement outputs directly.

---

## Identity

| Field | Value |
|---|---|
| Cast file | `casts/data/act_bombMage.txt` |
| `#objType` | `#objCPUCharacter` |
| `#AiType` | `#objAiCPU` |
| `#inherit` | `#CPUCharacter` |
| `#team` | `#magicalAlliance` |
| Sprite | `bombMage` |

### Animations (from `assets.json`)

| Strip | Frames | Loop | Dela |
|---|---|---|---|
| `bombMage_stand` | 1 | — | — |
| `bombMage_walk` | 8 | true | all 1 |
| `bombMage_reel` | 1 | — | — |
| `bombMage_naturalRanged` | 18 | false | all 1 |
| `bombMage_grave` | 2 | — | — |
| `bomb_fly` | 1 | — | — |
| `bomb_explode` | 7 | — | — |

---

## Derived Correct Behavior (from original casts)

- **Attack type:** `#naturalRanged` (thrower) — `typeFromAnimType` returns `"ranged"`.
- **AI FSM:** standard `#objAiCPU` — findTarget → moveToAttack → attack loop; no special modes.
- **Targeting:** `#eyestrain: 25` — acquisition jitter radius; `reach: 80` — max attack range (ranged reaches via `targetInReachRanged`, dist < reach).
- **Bullet:** `#bomb` → `act_bomb` with `#attack.type: #explode`, `explodeCharge: 20`, `power: 0.5`; triggers `resolveSplash()` on arrive/collide/land.
- **Attack frame:** frame 16 of 18-frame `naturalRanged` strip (1-based, `act_bombMage.txt:8`).
- **Firing type:** `#fullstrength` — bullet speed = attacker `strength = 10` (`act_bombMage.txt:13,18`).
- **Spawn offset:** `collisionLoc: point(0,-2)` — bullet spawns at dy=-2 (`act_bombMage.txt:11`).
- **Cadence:** `cooldown: 0` in original → fires on first counter increment → animation-gated (one shot per 18-frame strip) (`act_bombMage.txt:12`).
- **Movement:** `walkSpeed: 4` → port `maxSpeed = 4 × 0.6 = 2.4`; `inertia: 50`.
- **No runReload:** `#runReload` key absent → stays in place while throwing (does NOT back away after firing).
- **Death:** `dieSound: #none`; no `reincarnateAs`/`reincarnateInto`.
- **Experience:** `experienceImWorth: 20`.

---

## Derive-vs-Reproduced Table

| Property | Original (cast file:line) | Reproduced in Port | Match |
|---|---|---|---|
| `#team` | `#magicalAlliance` (`act_bombMage.txt:27`) | `CpuAI.team = "#magicalAlliance"` | ✓ |
| `#energy` | 200 (`act_bombMage.txt:21`) | `Energy.max = 200` | ✓ |
| `#walkSpeed` | 4 (`act_bombMage.txt:29`) | `Movement.maxSpeed = 2.4` (×0.6 px conv) | ✓ |
| `#strength` | 10 (`act_bombMage.txt:18`) | `CpuAI.strength = 10` | ✓ |
| `#dexterity` | 10 (`act_bombMage.txt:19`) | `WM.dexterity = 10`; counter inc=10 | ✓ |
| `#eyestrain` | 25 (`act_bombMage.txt:24`) | `CpuAI.eyestrain = 25` | ✓ |
| `#inertia` | 50 (`act_bombMage.txt:25`) | `Movement.inertia = 50` | ✓ |
| `#experienceImWorth` | 20 (`act_bombMage.txt:20`) | `Experience.imWorth = 20` | ✓ |
| `#weaponTechnique` | 0 (`act_bombMage.txt:30`) | `WeaponTechnique` with value 0 | ✓ |
| `#startingLevel` | 0 (`act_bombMage.txt:26`) | no forceLevelUp applied | ✓ |
| `#AiType` | `#objAiCPU` (`act_bombMage.txt:3`) | `CpuAI` FSM | ✓ |
| `#animType` | `#naturalRanged` (`act_bombMage.txt:9`) | `ranged = true`; attack strip = `naturalRanged` | ✓ |
| `#runReload` | absent in data | `runReload = false` | ✓ |
| `reach` | 80 (`act_bombMage.txt:16`) | `CpuAI.reachRanged = 80` | ✓ |
| `bullet` | `#bomb` (`act_bombMage.txt:10`) | `splashBullet` resolved from `act_bomb` | ✓ |
| `attack.animframe` | 16 (`act_bombMage.txt:8`) | fires at frame 16 (live-traced at t=16) | ✓ |
| `attack.firingType` | `#fullstrength` (`act_bombMage.txt:13`) | bullet speed = strength = 10.0 | ✓ |
| `attack.collisionLoc` | `point(0,-2)` (`act_bombMage.txt:11`) | bullet spawn dy = -2 | ✓ |
| `act_bomb.explodeCharge` | 20 (`act_bomb.txt:6`) | `splashBullet.explodeCharge = 20` | ✓ |
| `act_bomb.explodeSound` | `spell_explode` (`act_bomb.txt:17`) | played on detonate | ✓ |
| Animations (actor) | stand/walk/reel/naturalRanged/grave | all 5 present in `assets.json` | ✓ |
| Animations (bomb) | bomb_fly/bomb_explode | both present in `assets.json` | ✓ |
| Cadence | animation-gated (cooldown=0 → 1st-tick ready) | animation-gated (cd recovers 18t < 20t strip window) | ✓ |

---

## Live Tick Trace (probe, first 22 ticks)

```
t=0:  shot=---- attackT=0  animFrame=1  animAction=null          ctr.fin=true  → findTarget/moveToAttack
t=1:  shot=---- attackT=20 animFrame=2  animAction=naturalRanged ctr.count=11  → attack() entered, cooldown reset
t=2:  shot=---- attackT=19 animFrame=3  animAction=naturalRanged ctr.count=21
...
t=16: shot=FIRE attackT=5  animFrame=17 animAction=naturalRanged ctr.count=161 → bullet spawned
t=18: shot=---- attackT=0  animFrame=1  animAction=null          ctr.fin=true  → strip ended, attackFin()
t=19: shot=---- attackT=20 animFrame=2  animAction=naturalRanged ctr.count=11  → next attack starts
```

**Note on animFrame=17 at fire time:** `EnemyAI` runs before `Anim` in the component chain. The check inside `CpuAI.updateAttack` correctly sees `attackFrame()=16` and `justAdvanced=true` at the moment of firing; by the time the probe reads back `an.attackFrame()` after `send("update")`, `Anim.update` has already advanced to frame 17.

**Cadence math:** effectiveCooldown = round(18 × 10 + 1) = 181 (framesWanted = max(1, 0+18) = 18, dex=10). Counter recovers in ceil((181−1)/10) = 18 ticks. Attack strip is 18 frames → window ≈ 20 ticks. Since 18 < 20, cooldown is ready before the strip ends — cadence is **animation-gated**, matching original `#cooldown:0` behavior (which also makes the cooldown always ready before the strip ends).

---

## Divergences

None found.

The previous read-only audit listed `#attack.animframe:16`, `#eyestrain:25`, and `#attack.collisionLoc:point(0,-2)` as "deferred cosmetic omissions." The live probe confirms all three are **fully implemented and working**: animframe drives the fire-on-frame-16 check; eyestrain is forwarded to `CpuAI.eyestrain`; collisionLoc sets bullet spawn dy=-2. No fix sketches required.

---

`bombMage | DIVERGENCES=0` — all behavioral properties verified correct by live reproduction; no divergences.
