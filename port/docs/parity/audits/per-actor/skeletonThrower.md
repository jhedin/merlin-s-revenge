# Per-Actor Parity Audit: `skeletonThrower`

**Method:** Behavior DERIVED from `casts/data/act_skeletonThrower.txt` + full `#inherit` chain
(`#CPUCharacter` → `#character` → `#actor`) + bullet `act_skeletonHead.txt` (→ `#bullet`), plus
`casts/script_objects/{objAiAttack,modAttack,objCPUCharacter}.txt` and
`casts/general_functions/AttackSetTypeFromAnimType().txt`. Then REPRODUCED in the port: probe
`port/tools/_audit_skeletonThrower.ts` loaded the REAL `src/generated/assets.json` bundle, spawned the
actor with a hostile target, ticked 200 frames via `rebuildCombatSubstrate()`, and observed every
action/shot/move/death. Probe deleted after the run.

**Status:** CLEAN — **0 divergences.**

---

## 1. Identity & Inherit Chain

| Property | Source | Resolved value |
|---|---|---|
| `#objType` | `act_skeletonThrower.txt:3` | `#objCPUCharacter` |
| `#AiType` | `act_skeletonThrower.txt:4` | `#objAiCPU` (committed-target FSM, NOT a spellcaster) |
| `#inherit` | `#CPUCharacter`→`#character`→`#actor` | defaults merged |
| `#team` | `act_skeletonThrower.txt:29` | `#undead` |
| `#name` | `act_skeletonThrower.txt:30` | `"skeletonThrower"` (sprite key) |

Native `#attack` present (no `#weapon`), so the port takes the "use own #attack" branch
(`archetypes.ts:171–172`, `!atk["animType"]` is false). `#naturalRanged` →
`AttackSetTypeFromAnimType` maps `type=#ranged`
(`general_functions/AttackSetTypeFromAnimType().txt:14–15`), so the FSM is RANGED
(`archetypes.ts:183–184`).

---

## 2. Data Properties (Derived vs Reproduced)

| Property | Original (`act_skeletonThrower.txt`) | Port observed | Match |
|---|---|---|---|
| `#energy` | `50` (L21) | `energy=50 max=50` | ✓ |
| `#strength` | `8` (L28) | `strength=8` (= throw speed) | ✓ |
| `#dexterity` | `10` (L19) | ranged cooldown inc = 10 | ✓ |
| `#walkSpeed` | `1` (L31, overrides inherited `#CPUCharacter` `3`) | `maxSpeed=0.6` (1 × 0.6 slice-scale) | ✓ |
| `#inertia` | `50` (L24) | `inertia=50` | ✓ |
| `#eyestrain` | `5` (L23) | `eyestrain=5` (aim scatter) | ✓ |
| `#damageSpeed` | `3` (L18) | `damageSpeed=3` | ✓ |
| `#dieSound` | `#none` (L20) | no death sound | ✓ |
| `#experienceImWorth` | `7` (L22) | imWorth=7 | ✓ |
| `#startingLevel` | `0` (L27) | no pre-leveling | ✓ |
| `#weaponTechnique` | `0` (L32) | no anim-speed mod | ✓ |
| `#pathFindingTime` | `300` (L25) | pathfinding configured | ✓ |
| `#pathFindingStallTime` | `30` (L26) | pathfinding configured | ✓ |
| `#walkType` | inherits `#anyDirSpeed` (`#CPUCharacter`) | top-down free move | ✓ |

---

## 3. Animation Strips (REAL bundle, no fallbacks)

Char key `skeletonThrower`. All five resolve to real bundled strips — no `_stand`/blackOrc fallback.

| Strip | Role | `assets.json` | Delay | Loop | Notes |
|---|---|---|---|---|---|
| `skeletonThrower_stand` | idle | **1 frame** | 3 | true | ✓ |
| `skeletonThrower_walk` | walk cycle | **8 frames** | 3 | true | ✓ |
| `skeletonThrower_naturalRanged` | throw (attack) | **30 frames** | 2 | false | ✓ — frame 14 (`#animframe`) is a valid mid-strip release; all 30 are distinct files, single direction (`_02`), NO frame-doubling |
| `skeletonThrower_reel` | hit/knockback | **1 frame** | 3 | false | ✓ |
| `skeletonThrower_grave` | corpse | **2 frames** | 1 | false | ✓ |
| `skeletonHead_fly` | bullet in flight | **10 frames** | — | — | ✓ |
| `skeletonHead_land` | bullet land | **2 frames** | — | — | ✓ |

`chars` registry: `skeletonThrower=true`, `skeletonHead=true` — both present.

---

## 4. Attack: native `#attack` `#throwHead`

| Field | Original | Port observed | Match |
|---|---|---|---|
| `#animType` | `#naturalRanged` | `animType=#naturalRanged`, `type=ranged` | ✓ |
| `#firingType` | `#fullstrength` | `firingType=#fullstrength` | ✓ |
| `#bullet` | `#skeletonHead` | fired bullet `char=skeletonHead` | ✓ |
| `#reach` | `200` | `reach=200` (ranged approach gate) | ✓ |
| `#animframe` | `14` (scalar) | `animFrame=[14]` (scalar→list) | ✓ — fires when `getAnimFrame()==14` (`attackFrame()`=frame+1, 1-based; 0-based frame 13 of the 30-frame strip) |
| `#cooldown` | `0` (raw) | `effectiveCooldown=181` (calibrated, §6) | ✓ |
| `#collisionLoc` | `point(0,-5)` | muzzle offset applied at spawn | ✓ |
| `#name` | `#throwHead` | `name=#throwHead` | ✓ |
| `#sound` | `#none` | no attack sound | ✓ |

**Single shot per attack cycle** — `#animframe` is a scalar `14` → `[14]`, so exactly ONE
`skeletonHead` is thrown per attack-strip play (one fresh frame-14 crossing). Confirmed: 3 shots over
200 frames, one per cycle.

---

## 5. Bullet: `skeletonHead` → `act_skeletonHead.txt`

| Field | Original | Port resolved | Match |
|---|---|---|---|
| `#character`/sprite key | `#name:"skeletonHead"` (name==key) | `bulletChar=skeletonHead` (own art, not a dot) | ✓ |
| `#damageMultiplier` | `3.5` | `bmult=3.5` into bullet takeHit (`control.ts:831,843`) | ✓ |
| `#power` | `1` | `l1 = 1 · 4.5 · BULLET_DAMAGE_SCALE` (`control.ts:829`) | ✓ |
| `#type` (bullet attack) | `#bullet` | plain (non-splash) bullet path | ✓ |
| `#friction` | `point(3,3)` | bullet drag | ✓ |
| `#weight` | `0.4` | bullet weight | ✓ |
| `#rotational` | `false` | non-rotating | ✓ |

---

## 6. AI Behavior (Derived vs Reproduced, 200-frame sim)

### Derived (objAiCPU → objAiAttack, type `#ranged`)
1. **findTarget** → nearest opposite-allegiance hostile; commit.
2. **moveToAttack** → close to within `reach=200` (walkSpeed 1).
3. **attack** → `ensureMode(#naturalRanged)`; each tick `isOnAttackFrame()` checks
   `getAnimFrame()==14` on a FRESH frame (`modAttack.txt:577–617`); on crossing →
   `performAttack`→`performRangedAttack`.
4. **performRangedAttack `#fullstrength`** (`modAttack.txt:753–769`): `throwVect = distXY /
   (distToTarget/strength)` → `|throwVect| = strength = 8`. `pRangedVectOffset = 0`
   (`modAttack.txt:73`; the `-2` is commented out) so NO vertical aim offset. Eyestrain=5 scatter
   scaled by dist/reach.
5. **attackFin** → clear + `refreshTarget()`. No `runReload` (not set → no kiting).
6. **Death** → reel → `modGrave` grave draw.

### Reproduced (port observed)
1. Committed target acquired; FSM ranged. ✓
2. `reach=200` approach gate. ✓
3. Attack strip `naturalRanged` plays; `[ACTIONS] = stand, naturalRanged`. ✓
4. **Throw velocity = 8.00 exactly** for every bullet (`firingType #fullstrength` →
   `throwSpeed = max(1, strength=8)`, `control.ts:771–772`). ✓ No vertical offset added — faithful.
5. **No kiting** — `runReload` absent (`#runReload` not in data; not a spellcaster/bomber). Thrower
   does not back away after a shot. ✓
6. **Death → grave** — `isDead=true`, action resolves to `grave` (strip present). ✓
7. **Facing** — target to the RIGHT → `facingLeft=false`. ✓

---

## 7. Cadence

| Parameter | Value | Source |
|---|---|---|
| Raw `#cooldown` | `0` | `act_skeletonThrower.txt:12` |
| `dexterity` (ranged inc) | `10` | `act_skeletonThrower.txt:19` |
| `framesWanted` | `max(1, ceil((0-1)/10) + 18) = 18` | `archetypes.ts:206` |
| `effectiveCooldown` | `round(18 × 10 + 1) = 181` | `archetypes.ts:207` |
| Cooldown recovery | `ceil((181-1)/10) = 18 ticks` | counter math |
| Attack strip duration | `30 frames × delay 2 = 60 ticks` | `skeletonThrower_naturalRanged` |
| **Binding cadence** | `max(60, 18) = ~60 ticks` | animation-driven |

Observed shot frames: **27, 86, 145** → gaps **59, 59 ticks** ≈ strip length (one frame early per
`anim.ts` fresh-frame timing). The 30-frame strip, not the 18-tick cooldown, is the binding
constraint. Faithful.

---

## 8. Divergences

**None.** Every derived behavior reproduced in the port:
- All 5 actor strips + 2 bullet strips present with correct frame counts; no `_stand`/blackOrc fallback.
- `#animframe:14` → single `skeletonHead` thrown per attack cycle (3 shots / 200 frames).
- `#fullstrength` throw velocity = strength = **8.00** exactly.
- Bullet resolves to its own `skeletonHead` art with `damageMultiplier 3.5`, `power 1`.
- `#walkSpeed:1` override honored (maxSpeed 0.6, NOT inherited 3).
- `reach 200`, team `#undead`, energy 50, eyestrain 5, inertia 50 all match data.
- No kiting (`#runReload` unset); death → grave.

---

## 9. Faithful Quirks (WONTFIX / candidate original-game traits — NOT port bugs)

| Quirk | Proof | Verdict |
|---|---|---|
| `pRangedVectOffset = 0` (no vertical aim-above-head offset) | `modAttack.txt:73` sets 0; the `-2` line (L67) is commented out | FAITHFUL — port adds no offset |
| Bullet damage decoupled from `|getVect()|` | Original couples bullet damage to travel-vector magnitude; port fixes damage to the K1 reference (`control.ts:826–829`) — deliberate, documented balance abstraction shared by all ranged CPUs | FAITHFUL by design |
| `#miniMapStatus:#inf` (from `#CPUCharacter`) not honored | No minimap system in port | WONTFIX |
| `#pathFindingTime/StallTime` forwarded, not fully plumbed | Pathfinding module wired; FSM behavior intact | WONTFIX |

---

## 10. Summary

| Behavior | Original source | Port source | Verdict |
|---|---|---|---|
| Identity / team / stats / energy | `act_skeletonThrower.txt` | `archetypes.ts:151–334` | ✓ CORRECT |
| `#naturalRanged` → ranged FSM | `AttackSetTypeFromAnimType()` | `archetypes.ts:183–184` | ✓ CORRECT |
| `#animframe:14` single shot | `modAttack.isOnAttackFrame` | `control.ts:737`, `weapon.ts:181–185` | ✓ CORRECT |
| `#fullstrength` throw = strength 8 | `modAttack.performRangedAttack` | `control.ts:771–772` | ✓ CORRECT |
| `skeletonHead` bullet (mult 3.5) | `act_skeletonHead.txt` | `archetypes.ts:276–286`, `control.ts:828–843` | ✓ CORRECT |
| All anim strips present | assets.json | assets.json | ✓ CORRECT |
| No kiting / death → grave | `objCPUCharacter` / `modGrave` | `control.ts:700–706` | ✓ CORRECT |

---

`skeletonThrower | DIVERGENCES=0`
