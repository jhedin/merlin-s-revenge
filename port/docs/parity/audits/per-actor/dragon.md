# Actor Audit: `act_dragon`

**Audit Date:** 2026-06-23
**Method:** REPRODUCED — probe spawned the dragon + an inert player target via the real `@/generated/assets.json`
bundle, ticked ~250 frames, and observed the live EnemyAI/WeaponManager/Anim/Projectile/Energy behaviour
(shot count per #animframe, the decelerating fireBall bullet, cadence, facing, death→grave). Probe deleted.
**Original Spec:** `casts/data/act_dragon.txt` + `#inherit` chain (`#CPUCharacter` → `#character` → `#actor`),
`casts/data/act_flameThrower.txt` (the dragon's `#weapon`), `casts/data/act_fireBall.txt` (the fired bullet),
`casts/master_objects/weaponMaster.txt`.

> NOTE: this overwrites a prior (stale) code-read audit that claimed "1 shot every 181 ticks". That was wrong
> on two counts: (a) it described the old flat-+18 cooldown formula the port no longer uses, and (b) it missed
> that `#flameThrower`'s `#animframe: [1,3,5,7]` fires **4 shots per attack cycle**. Both are corrected here by
> direct reproduction.

---

## 1. What the dragon IS and SHOULD do (derived from the original)

**Identity / team**

| Field | Value | Source |
|-------|-------|--------|
| record key | `act_dragon` → actor `"dragon"` | act_dragon.txt:1 |
| `#name` (sprite char) | **"dragon"** | act_dragon.txt:20 |
| `#team` | `#monsters` (hostile to the player) | act_dragon.txt:19 |
| `#AiType` | `#objAiCPU` (standard committed-target FSM, no kite) | act_dragon.txt:4 |
| `#objType` | `#objCPUCharacter` | act_dragon.txt:3 |

`fireDragon` (act_fireDragon.txt) is the SAME stat block on team `#scarlet`; `undeadDragon`
(act_undeadDragon.txt) is a SEPARATE actor (team `#undead`, its OWN inline `#attack` firing `#blueFlame`
on `#animframe [3]`). The audited `dragon` and `fireDragon` both share `#name: "dragon"` → both render off
the `dragon_*` sprite strips.

**Stats**

| Field | Value | Source |
|-------|-------|--------|
| `#energy` | 500 | act_dragon.txt:9 |
| `#strength` | 8 | act_dragon.txt:16 |
| `#walkSpeed` | 7 (engine units → 4.2 px/tick) | act_dragon.txt:21 |
| `#dexterity` | 10 (ranged cooldown-counter inc) | act_dragon.txt:7 |
| `#inertia` | 70 (knockback resistance) | act_dragon.txt:13 |
| `#damageSpeed` | 3 (wall-slam bonus-damage threshold) | act_dragon.txt:6 |
| `#frictionReel` | point(20,20) (knockback-slide friction) | act_dragon.txt:12 |
| `#eyestrain` | 50 (ranged aim scatter) | act_dragon.txt:11 |
| `#experienceImWorth` | 50 | act_dragon.txt:10 |
| `#startingLevel` | 0 | act_dragon.txt:14 |
| `#stallSpeed` | 3 | act_dragon.txt:15 |
| `#takeHitSound` | "dragon_hit" @ vol 100 | act_dragon.txt:17–18 |
| `#dieSound` | `#none` (NO death sound) | act_dragon.txt:8 |

**Weapon → attack (the dragon carries NO inline `#attack`; it fights with `#weapon: #flameThrower`):**

The dragon has only `#weapon: #flameThrower` (act_dragon.txt:22) and no `#attack` block, so its firing attack
IS the flameThrower's attack (`act_flameThrower.txt`):

| Field | Value | Source |
|-------|-------|--------|
| `#animType` | `#weaponRanged` (→ RANGED FSM) | act_flameThrower.txt:8 |
| `#animframe` | **`[1,3,5,7]`** → 4 shots per attack cycle | act_flameThrower.txt:7 |
| `#bullet` | `#fireBall` | act_flameThrower.txt:9 |
| `#firingType` | `#fullstrength` → bullet speed = attacker strength (8 px/tick) | act_flameThrower.txt:12 |
| `#reach` | 150 px | act_flameThrower.txt:14 |
| `#cooldown` | 0 | act_flameThrower.txt:11 |
| `#collisionLoc` | point(35,-20) (muzzle offset) | act_flameThrower.txt:10 |
| `#sound` | "dragon_fire" | act_flameThrower.txt:15 |

**Bullet: `#fireBall` → `act_fireBall.txt` (a DECELERATING bullet):**

| Field | Value | Source |
|-------|-------|--------|
| `#inherit` | `#bullet`; `#character: #bullet` (sprite char "fireBall") | act_fireBall.txt:3,10 |
| `#attack.power` | 0.2 (scalar) | act_fireBall.txt:7 |
| `#attack.damageMultiplier` | 6 | act_fireBall.txt:6 |
| `#attack.type` | `#bullet` (single-target, NOT `#explode`/splash) | act_fireBall.txt:8 |
| `#friction` | **point(4,4)** → loses 4%/frame, decelerating (objMoveXY) | act_fireBall.txt:12 |
| `#weight` | 0.4 | act_fireBall.txt:14 |
| `#recordInRoomState` | false | act_fireBall.txt:13 |

**Animation strips (all present in `assets.json`):** `dragon_stand` (1f), `dragon_walk` (8f loop),
`dragon_weaponRanged` (20f one-shot; delays `[2×8,1,1,1,2×9]`, total 37t), `dragon_grave` (2f).
Bullet: `fireBall_fly` (1f), `fireBall_land` (2f).

**Behaviour:** `#objAiCPU` committed-target FSM, RANGED. Approaches to within reach 150, faces the target,
plays the 20-frame `weaponRanged` strip, and fires a `fireBall` on each `#animframe` crossing (frames
1,3,5,7 → a 4-shot fan per cycle). fireBalls fly at strength speed (8 px/tick) and decelerate by 4%/frame.
Does NOT kite (no `#runReload`, not a spellcaster). On death: grave (no `#graveOn:false`), no reincarnation,
no death sound (`#dieSound: #none`).

---

## 2. Derived-correct vs. REPRODUCED (every row OBSERVED live in the port)

| Property | Expected (original) | REPRODUCED (port) | Match? |
|----------|---------------------|-------------------|--------|
| `anim.char` | "dragon" | **"dragon"** (resolves to the real strip, NOT blackOrc) | ✓ |
| `dragon_stand/walk/weaponRanged/grave` strips | exist | all found in assets.json | ✓ |
| `team` | `#monsters` | `#monsters` | ✓ |
| `energy` | 500 | 500 / 500 | ✓ |
| `strength` | 8 | 8 | ✓ |
| `maxSpeed` (walkSpeed×0.6) | 4.2 px/tick | 4.2 | ✓ |
| `inertia` | 70 | 70 | ✓ |
| `damageSpeed` | 3 | 3 (forwarded) | ✓ |
| `frictionReel.x` | 20 | 20 | ✓ |
| `eyestrain` | 50 | 50 | ✓ |
| `AiType` FSM | `#objAiCPU` committed-target | committed-target; `committedTarget` set | ✓ |
| `ranged` | true (`#weaponRanged`) | true | ✓ |
| `reachRanged` | 150 | 150 | ✓ |
| `runReload` (kite) | false | false | ✓ |
| `dodgesBullets` | false | false | ✓ |
| firing attack source | the `#weapon` flameThrower (no inline `#attack`) | currentAttack name `#flameThrower`, type ranged | ✓ |
| `#animframe` | `[1,3,5,7]` | `[1,3,5,7]` | ✓ |
| **shots per attack cycle** | **4** (one per firing frame) | **4** (burst sizes all `[4,4,4,…]` over 7 cycles) | ✓ |
| `firingType` | `#fullstrength` | `#fullstrength` | ✓ |
| bullet launch speed | 8 px/tick (= strength; +eyestrain scatter) | ~8.4–9.6 (strength + diagonal/scatter) | ✓ |
| `bullet` | `#fireBall` | bulletChar "fireBall" | ✓ |
| bullet `#attack.power` | 0.2 | 0.2 | ✓ |
| bullet `#attack.damageMultiplier` | 6 | 6 | ✓ |
| bullet `#attack.type` | `#bullet` (no splash) | plain bullet (splashBullet = none) | ✓ |
| bullet `#friction` decel | point(4,4) (4%/frame) | speed decays 8.4 → 0.19 then stalls | ✓ |
| bullet reaches target | yes (reach 150 > 100px gap) | reached target & `finished(done)=true` (hit fired) | ✓ |
| bullet damages target | yes | 64 hits over 300t, target 200→55 energy | ✓ |
| muzzle (`#collisionLoc`) | point(35,-20) | bullet spawns at x≈243 (200+~43 facing-right) | ✓ |
| `#sound` | "dragon_fire" | atkSound "dragon_fire" | ✓ |
| faces target | yes | facingLeft=false with target to the right | ✓ |
| `takeHitSound` | "dragon_hit" | "dragon_hit" forwarded (Hurt) | ✓ |
| `takeHitVolume` | 100/255 → 0.39 | mapped via /255 | ✓ |
| `dieSound` `#none` | no sound on death | passed as "#none", filtered at `audio.play` (audio.ts:149) | ✓ |
| death → grave | grave (no graveOn:false) | lethal takeHit → isDead, anim action "grave", grave strip present | ✓ |
| reincarnation | none | none | ✓ |
| `experienceImWorth` | 50 | 50 | ✓ |
| `startingLevel` | 0 | 0 (no level-up loop) | ✓ |

---

## 3. DIVERGENCES

**None.** Every derived property reproduced faithfully in the running port.

Items that COULD have been divergences but were verified clean:

- **`#dieSound: #none`** — archetypes.ts forwards the literal string `"#none"` to the Energy component, but
  `game.audio.play` filters `name === "#none"` to a no-op (`port/src/systems/audio.ts:149`). No bogus sound
  plays. NOT a divergence.
- **`#damageSpeed: 3`** — forwarded correctly (`damageSpeed: num("damageSpeed", 5)` in archetypes.ts; the
  data value 3 wins). Observed `m.damageSpeed = 3`. (The older archer audit's DIV-1 predates this fix.)
- **4-shot fan from `#animframe [1,3,5,7]`** — reproduced exactly (the original fires one shot per fresh
  `#animframe` crossing of the `weaponRanged` strip; the port's `updateAttack`/`performAttack`
  (`control.ts:769–806`) does the same, observed burst size 4 every cycle).
- **Decelerating fireBall** — `#friction: point(4,4)` is threaded through `bulletAttack.friction` to
  `Projectile.friction` (`control.ts:903`, `projectile.ts:123–134`); the bullet visibly decelerated
  (8.4→0.19) and still crossed the 100px gap to hit the target, then stalled. NOT a divergence.

### FAITHFUL original-game characteristics (documented, NOT bugs)

- **`fireDragon` shares `#name: "dragon"`** — both `dragon` (#monsters) and `fireDragon` (#scarlet) render off
  the `dragon_*` strips by design (sprite keying is by `#name`, not record key). Faithful.
- **Bullet damage decoupled from travel speed** — the port computes fireBall damage off the calibrated K1
  reference (`dmgRef = 4.5`, control.ts:887) rather than the original's live `|getVect()|·power·mult`. This is
  a documented deliberate abstraction (the comment at control.ts:813–818), shared by every ranged CPU, so the
  decelerating bullet's *damage* doesn't fade with its speed. Stable-by-design, not a dragon-specific issue.

---

## Summary

`act_dragon` is reproduced with **ZERO divergences**. The dragon spawns as a `#monsters` `#objAiCPU` enemy with
energy 500 / strength 8 / walkSpeed 4.2 / inertia 70 / damageSpeed 3 / eyestrain 50; renders off its real
`dragon` sprite strips (no blackOrc fallback); fights at RANGE (reach 150) by firing its `#weapon: #flameThrower`
(no inline `#attack`); fans **4 fireBall shots** per attack cycle (`#animframe [1,3,5,7]`) at `#fullstrength`
speed 8; each fireBall **decelerates** (friction 4) yet reaches and damages the target; faces its target;
plays `dragon_hit` when struck; and dies to a grave with no death sound (`#dieSound: #none` filtered) and no
reincarnation.

**Status: CLEAN — No behavioral divergences detected (reproduced, not just code-read).**
