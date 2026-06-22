# Behavioral Audit: `act_bombMage`

**Scope:** REPRODUCED — behavior verified by running the port with the real `@/generated/assets.json` bundle.
**Method:** Live probe (`port/tools/_audit_bombMage.ts`, deleted after run) — harness `game.assets = {index: assets.json, …}`, `CollisionGrid(80,80,32)`, wired `spawnEnemy/spawnUnit/spawnAlly`, `unitMap.configure(32,0,0)`, `rebuildCombatSubstrate()` each tick. Spawned bombMage (`#magicalAlliance`) + a hostile high-HP `blackOrc` target ~60px away; ticked 250 frames; traced bomb spawn/travel/explosion, anim char, cadence, facing, target HP.

---

## Identity

| Field | Value |
|---|---|
| Cast file | `casts/data/act_bombMage.txt` |
| `#objType` | `#objCPUCharacter` |
| `#AiType` | `#objAiCPU` |
| `#inherit` | `#CPUCharacter` → `#character` → `#actor` |
| `#team` | `#magicalAlliance` |
| Sprite (data `#name`) | `bombMage` |

### Animations (from `assets.json`)

| Strip | Frames | Loop |
|---|---|---|
| `bombMage_stand` | 1 | — |
| `bombMage_walk` | 8 | true |
| `bombMage_reel` | 1 | — |
| `bombMage_naturalRanged` | 18 | false |
| `bombMage_grave` | 2 | false |
| `bomb_fly` | 1 | true |
| `bomb_explode` | 7 | true |

---

## Derived Correct Behavior (from original casts)

- **Attack type:** `#naturalRanged` thrower (`act_bombMage.txt:9`) → `typeFromAnimType` = `"ranged"`.
- **AI FSM:** standard `#objAiCPU` (findTarget → moveToAttack → attack). No `#runReload` key → does NOT kite.
- **Targeting:** `#reach: 80` (max attack range), `#eyestrain: 25` (aim jitter).
- **Bullet `#bomb`** (`act_bomb.txt`): `#inherit:#bullet`, `#attack.type:#explode`, `#explodeCharge:20`, `#power:0.5`. `#explodeEvents:[#bulletArrivedAtTargetLoc, #bulletCollidedWithTarget, #bulletLanded]`, `#explodeSound:"spell_explode"`. **`#friction: point(10,10)`**, `#weight: 0.4`, `#rotational: false`.
- **Attack frame:** `#animframe: 16` → fires on frame 16 of the 18-frame `naturalRanged` strip (1-based).
- **Firing type:** `#fullstrength` (`act_bombMage.txt:13`) → throw speed = attacker `#strength = 10`.
- **Spawn offset:** `#collisionLoc: point(0,-2)`.
- **Energy/stats:** energy 200, strength 10, dexterity 10, inertia 50, walkSpeed 4, experienceImWorth 20, weaponTechnique 0, startingLevel 0.
- **Death:** `#dieSound:#none`; no reincarnate.

### THE BOMB IS A SHORT-LOBBED GRENADE (the defining mechanic)

The bomb is **not** a long-range straight-line projectile. It is thrown at `#fullstrength` (speed = strength = 10) but carries `#friction: point(10,10)`. `objBullet.updateFly` (`objBullet.txt:302-342`) every frame calls `checkStalled()`; `objMoveXY.update` (`objMoveXY.txt:160-180`) decays the move-vector by `lostSpeed = clamp(pFriction, 0, speed)` via `PointTowardZero`. With initial speed 10 and per-axis friction 10, **the bomb loses its entire 10px/frame of speed in a single frame** → `checkStalled()` (`objBullet.txt:139-152`, `pStallSpeed point(2,2)`) returns `#stalled` on frame 1 → `internalEvent(#bulletLanded)` → `goMode(#land)`, and `modExploder.internalEvent` (`modExploder.txt:62-78`, `#bulletLanded ∈ explodeEvents`) → `explode()` → `goMode(#explode)`.

Net: **the bomb travels ~10px from the muzzle, stalls, lands, and explodes almost immediately** — a point-blank / self-adjacent area-denial blast. It also explodes on a direct `#bulletCollidedWithTarget` if a target is in its path. So a bombMage with `#reach:80` walks to within ~80px, then lobs a bomb that detonates right in front of itself (the target must be standing in that near blast disc to be hit).

---

## Derive-vs-Reproduced Table

| Property | Original (file:line) | Observed in Port | Match |
|---|---|---|---|
| `#team` | `#magicalAlliance` (`act_bombMage.txt:27`) | `getTeam()="#magicalAlliance"` | ✓ |
| `#energy` | 200 (`act_bombMage.txt:21`) | `Energy.max = 200` | ✓ |
| `#strength` | 10 (`act_bombMage.txt:18`) | throw speed 10 (`vx≈9.96`) | ✓ |
| `#walkSpeed` | 4 (`act_bombMage.txt:29`) | `maxSpeed = 2.4` (×0.6 conv) | ✓ |
| `#dexterity` | 10 (`act_bombMage.txt:19`) | counter inc=10 | ✓ |
| `#eyestrain` | 25 (`act_bombMage.txt:23`) | `CpuAI.eyestrain=25` | ✓ |
| `#inertia` | 50 (`act_bombMage.txt:24`) | `Movement.inertia=50` | ✓ |
| `#experienceImWorth` | 20 (`act_bombMage.txt:22`) | forwarded | ✓ |
| `#AiType` | `#objAiCPU` (`act_bombMage.txt:4`) | `CpuAI` FSM, no kite | ✓ |
| `#animType` | `#naturalRanged` (`act_bombMage.txt:9`) | `ranged=true`, strip `naturalRanged` | ✓ |
| `reach` | 80 (`act_bombMage.txt:15`) | `reachRanged=80` | ✓ |
| `bullet` | `#bomb` (`act_bombMage.txt:10`) | splash bullet from `act_bomb`, char `bomb` | ✓ |
| `attack.animframe` | 16 (`act_bombMage.txt:8`) | fires on frame 16 crossing | ✓ |
| `attack.firingType` | `#fullstrength` (`act_bombMage.txt:13`) | speed=strength=10 | ✓ |
| `act_bomb.type` | `#explode` (`act_bomb.txt:8`) | resolves as splash/explode, `resolveSplash` on detonate | ✓ |
| `act_bomb.explodeCharge` | 20 (`act_bomb.txt:6`) | `splashBullet.explodeCharge=20` | ✓ |
| **Anim char** | `bombMage` (own bundled strips) | `Anim.char="bombMage"` (NOT blackOrc) | ✓ |
| Bomb count per attack | 1 per `#animframe`=[16] | 1 bomb per fire (11 fires / 250t) | ✓ |
| Facing | toward target | `facingLeft=false` (target to the right) | ✓ |
| Cadence | animation-gated (cooldown 0) | 18-tick cadence, animation-gated | ✓ |
| **Bomb travel/land** | **friction 10 → stalls & explodes ~10px out (lob)** | **constant speed 10, no friction, flies straight; explodes only on target-collide or maxLife(140) expiry** | ✗ |

---

## Live observations (probe)

- **Anim char:** resolves to `bombMage` — its own bundled strips, NOT the `blackOrc` fallback. `bombMage_stand` exists, so `spriteCharOr` returns `"bombMage"`. ✓
- **Bomb count / cadence:** 11 bombs over 250 ticks; fire ticks `[58,76,94,…]`, cadence a clean **18** ticks each, **1 bomb per fire** (matches `#animframe:[16]`). ✓
- **Bomb is splash/explode:** projectile char `"bomb"` (→ `bomb_fly`/`bomb_explode`), splash `attackType:#explode`, `explodeCharge:20`, `payloadFunction:[takeHit]`. On a direct target collision (within 12px) it `detonate()`s via `resolveSplash` and damages the target (traced: target HP dropped on the frame the bomb reached it). ✓
- **Bomb travel (DIVERGENCE):** the bomb flies in a **straight line at constant speed 10px/tick with no deceleration** (traced `vx≈9.96` and ~10px/frame advance unchanged across its whole life). `fireSplashBullet` builds it with `friction:1` (no decay) and the projectile updates a fixed `vx/vy` (`bullets.ts:57-61`, `projectile.ts:97-133`). It explodes only on (a) a direct target collision or (b) `maxLife` (140 ticks ≈ 1400px) expiry. There is **no friction/stall/land** path. ✗

> Probe artifact note: a first probe reported absurd "maxDist 1910" for bombs. That was because the throwaway harness never called `sweepBullets()`, so already-`done` bullets kept being measured as they coasted. The corrected trace shows each bomb correctly latches `done=true` at the target (~t=65, life=7) and applies splash damage — the explosion itself is fine; only the **travel model** (constant-speed straight line vs friction-stall lob) diverges.

---

## Divergences

### DIVERGENCE 1 — bomb does not stall/land; it flies straight at constant speed (PORT BUG)

- **Original:** the `#bomb` carries `#friction: point(10,10)` (`act_bomb.txt:19`). At the `#fullstrength` throw speed of `strength=10`, `objMoveXY.update` (`casts/script_objects/objMoveXY.txt:172-177`) zeroes the move-vector in a single frame, `objBullet.updateFly` (`casts/script_objects/objBullet.txt:305-306`, `checkStalled`) returns `#stalled`, firing `#bulletLanded` → `modExploder.explode()` (`casts/script_objects/modExploder.txt:65-66`). The bomb therefore detonates ~10px from the muzzle — a point-blank lobbed grenade.
- **Port:** `fireSplashBullet` (`port/src/systems/bullets.ts:51-64`) spawns the bomb with `friction: 1` and writes a constant `m.vx/m.vy = (dir)·speed`; `Projectile.update` (`port/src/components/projectile.ts:97-133`) never applies friction and has no stall/land branch — the bomb travels in a straight line until it directly collides with a target (within 12px) or `maxLife` (140) expires.
- **Effect:** a bombMage in the port is a **long-range straight-line bomb shooter** (the bomb crosses the full `reach:80` gap to the target and explodes on contact). The original is a **short-lob area-denial caster** whose bomb explodes right in front of it and only hits a target close enough to be inside that near blast. A bomb that misses (eyestrain scatter) in the original lands & explodes nearby (area denial); in the port it sails off-screen and only "detonates" 140 ticks later far away. Damage-per-hit is similar (same `#explode` splash + `explodeCharge:20`), so the slice is not broken — but the weapon's *character* (point-blank grenade vs ranged projectile) is wrong.
- **Faithful vs bug:** PORT BUG (the friction-stall-land model is a real, modeled original mechanic — `objBullet`/`objMoveXY`/`modExploder` — that the port's straight-line splash-bullet path drops). NOT a faithful original quirk.
- **Fix sketch (not applied):** give a splash bullet whose actor data carries `#friction`/`#stallSpeed` a deceleration + stall→detonate path in `Projectile.update` (or a dedicated lobbed-bullet config in `fireSplashBullet`): decay `vx/vy` toward zero by the per-axis friction each tick; when speed < stallSpeed, `detonate()` at the current loc. This restores the lob for `#bomb` (and any other friction-carrying thrown bullet) without changing zero-friction bolts (arrows/axes).

Everything else (team, energy, strength, walk, dexterity/cadence, eyestrain, reach, attack frame, fire count, anim char, splash explode, facing, death) reproduces faithfully.

---

`bombMage | DIVERGENCES=1` — bomb flies straight at constant speed instead of the original's friction-stall short lob (no land/stall path in the port's splash-bullet model).
