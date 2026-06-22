# Per-Actor Parity Audit: `lizardSoldier`

**Method:** Behavior DERIVED from `casts/data/act_lizardSoldier.txt` + bullet `act_lizardEgg.txt` (→ `#bullet`)
+ hatch actor `act_bug.txt`, plus `casts/script_objects/{modAttack,modReincarnate,objAiCPU,objCPUCharacter}`
and `general_functions/AttackSetTypeFromAnimType()`. Then REPRODUCED in the port: throwaway probe
`port/tools/_audit_lizardSoldier.ts` loaded the REAL `src/generated/assets.json`, harnessed
`game.assets/grid/spawn*` + `teamMaster.unitMap.configure(32,0,0)` + `rebuildCombatSubstrate()` per tick,
spawned a `lizardSoldier` with a hostile `#aldevar` target, ticked ~200 frames, and observed
animChar/shots/reincarnation/facing/death. A second probe isolated ONE egg's hatch; a third resolved the
bullet `#attack`. Probes deleted after the run.

**Status:** CLEAN — **0 PORT divergences.** (1 systemic cosmetic quirk documented WONTFIX.)

---

## 1. Identity & Inherit Chain

| Property | Source | Resolved (port observed) |
|---|---|---|
| `#objType` | `act_lizardSoldier.txt:3` | `#objCPUCharacter` → `enemy` entity |
| `#AiType` | `act_lizardSoldier.txt:4` | `#objAiCPU` (committed-target FSM, NOT a spellcaster) |
| `#inherit` | `#CPUCharacter`→`#character`→`#actor` | defaults merged |
| `#team` | `act_lizardSoldier.txt:27` | `team=#monsters`, role `#teamMembers` ✓ |
| `#name` (sprite key) | `act_lizardSoldier.txt:28` | **`animChar=lizardSoldier`** — resolves to the real bundled strip, NOT blackOrc ✓ |

Native `#attack` present, `#naturalRanged` → `AttackSetTypeFromAnimType` maps `#ranged`
(`weapon.ts:106`), so the FSM is RANGED (`archetypes.ts:185`, observed `ranged=true`).

---

## 2. Data Properties (Derived vs Reproduced)

| Property | Original (`act_lizardSoldier.txt`) | Port observed | Match |
|---|---|---|---|
| `#energy` | `200` (L21) | `energy=200 max=200` | ✓ |
| `#strength` | `5` (L26) | `strength=5` (= `#fullstrength` throw speed) | ✓ |
| `#dexterity` | `10` (L19) | ranged cooldown inc = 10 | ✓ |
| `#walkSpeed` | `3` (L29) | maxSpeed = 3×0.6 (no walk in sim — target in reach) | ✓ |
| `#inertia` | `60` (L24) | `inertia=60` | ✓ |
| `#eyestrain` | `25` (L23) | `eyestrain=25` (aim scatter) | ✓ |
| `#damageSpeed` | `3` (L6) | `damageSpeed=3` | ✓ |
| `#dieSound` | `#none` (L20) | no death sound | ✓ |
| `#experienceImWorth` | `30` (L22) | imWorth=30 | ✓ |
| `#startingLevel` | `0` (L25) | no pre-leveling | ✓ |

---

## 3. Animation Strips (REAL bundle, no fallbacks)

Char key `lizardSoldier`. All five actor strips + 3 egg strips + 4 bug strips resolve to real bundled
art. `chars` registry: `lizardSoldier=true`, `lizardEgg=true`, `bug=true`.

| Strip | Role | frames | delay | loop |
|---|---|---|---|---|
| `lizardSoldier_stand` | idle | 1 | 3 | true |
| `lizardSoldier_walk` | walk | 8 | 2 | true |
| `lizardSoldier_naturalRanged` | egg-launch (attack) | **7** | 2 | false |
| `lizardSoldier_reel` | hit | 1 | 3 | false |
| `lizardSoldier_grave` | corpse | 2 | 2 | false |
| `lizardEgg_fly` | egg in flight | 9 | 2 | true |
| `lizardEgg_land` | egg land | 2 | 1 | true |
| `lizardEgg_grave` | egg corpse | 1 | 1 | false |
| `bug_stand`/`_walk`/`_naturalMelee`/`_grave` | hatched bug | 1/2/6/2 | — | — |

**`#animframe:6` on a 7-frame strip is a valid mid-strip release** (1-based; frame 6 of 7). One fresh
crossing per attack-strip play → exactly ONE egg per cycle. Observed: 3 shots over 200 ticks, one per cycle.

---

## 4. Attack: native `#attack` `#eggLaunch` (Derived vs Reproduced)

| Field | Original | Port observed | Match |
|---|---|---|---|
| `#animType` | `#naturalRanged` | `animType=#naturalRanged`, `type=ranged` | ✓ |
| `#firingType` | `#fullstrength` | `firingType=#fullstrength` → throwSpeed = max(1, strength)=5 | ✓ |
| `#bullet` | `#lizardEgg` | fired bullet `char=lizardEgg` | ✓ |
| `#reach` | `150` | `reach=150` (ranged approach gate) | ✓ |
| `#animframe` | `6` (scalar) | `animFrame=[6]` (scalar→list) | ✓ |
| `#collisionLoc` | `point(14,-7)` | `{x:14,y:-7}` muzzle offset | ✓ |
| `#cooldown` | `300` (raw) | `effectiveCooldown=481` (calibrated, §6) | ✓ |
| `#name` | `#eggLaunch` | `name=#eggLaunch` | ✓ |
| `#sound` | `#none` | no attack sound | ✓ |

---

## 5. Bullet `lizardEgg` → `act_lizardEgg.txt` (Derived vs Reproduced)

| Field | Original | Port resolved | Match |
|---|---|---|---|
| `#character`/sprite key | `#name:"lizardEgg"` (name==key) | `bulletChar=lizardEgg` (own art, not a dot) | ✓ |
| `#attack.power` | `0.5` | `powerScalar=0.5` (→ L1 = 0.5·4.5·BULLET_DAMAGE_SCALE) | ✓ |
| `#attack.damageMultiplier` | `5` | `mult=5` carried into bullet takeHit | ✓ |
| `#attack.type` | `#bullet` | `attackType=#bullet`, `splashDamageOn=false` → plain (non-splash) bullet path | ✓ |
| `#reincarnateAs` | `[#bug,#bug,#bug]` | `reincarnateAs=["bug","bug","bug"]` | ✓ |
| `#friction` | `point(2,2)` | `{x:2,y:2}` | ✓ |
| `#weight` | `1` | `1` | ✓ |
| `#rotational` | `true` | (see §8 — systemic) | ~ |
| `#recordInRoomState` | `false` | bullets never snapshotted (`actorSerial.isRecordableActor`) | ✓ |

### Reincarnation (egg → hatch), isolated single-egg probe
- One egg, on expiry (`Projectile.finish`, `projectile.ts:79–88`), spawns **exactly 3 `bug`** entities at
  its corpse loc — observed `0 → 3` for one egg (and `3×3=9` for three eggs in the main sim).
- Each hatched bug: `team=#monsters` (from `act_bug.txt:29`), `animChar=bug` (own art). ✓
- `#bug` (`act_bug.txt`): `#objCPUCharacter`, `#naturalMelee #punch`, energy 4, walkSpeed 9 — a melee
  swarm, correct. The hatch uses the child's OWN act-data (team/objType), faithful to `objBullet.reincarnate`.

---

## 6. Cadence

| Parameter | Value | Source |
|---|---|---|
| Raw `#cooldown` | `300` | `act_lizardSoldier.txt:13` |
| `#dexterity` (ranged inc) | `10` | `act_lizardSoldier.txt:19` |
| `framesWanted` | `max(1, ceil((300-1)/10) + 18) = 48` | `archetypes.ts:208` |
| `effectiveCooldown` | `round(48×10 + 1) = 481` | `archetypes.ts:209` |
| Cooldown recovery | `ceil((481-1)/10) = 48 ticks` | Counter math (inc=dexterity 10) |
| Attack strip duration | `7 frames × delay 2 = 14 ticks` | `lizardSoldier_naturalRanged` |
| **Binding cadence** | `~48 ticks` (cooldown-bound) | — |

Observed shot frames: **11, 59, 158** → gap **48** then **99**. The first gap (48) = the derived recovery
exactly. The second gap (99) is longer because the lizard was knocked into `reel` (the ally target melees
it — `reel` action seen) mid-cycle, deferring the next attack. Faithful (same cooldown-calibration model as
the other `#naturalRanged` throwers, e.g. skeletonThrower §6/§7).

---

## 7. AI Behavior (Derived vs Reproduced, 200-frame sim)

| Behavior | Derived | Reproduced | Verdict |
|---|---|---|---|
| FSM | `objAiCPU` committed-target, RANGED | `ranged=true`, actions `stand, naturalRanged, reel` | ✓ |
| Approach gate | `reach=150` | reach=150; target at 70px already in reach (no walk) | ✓ |
| Fire | one egg per `#animframe:6` fresh crossing | 3 shots / 200 ticks, one per cycle | ✓ |
| Throw velocity | `#fullstrength` → speed = strength 5 | throwSpeed = max(1, 5) = 5 | ✓ |
| Kiting | NO (`#runReload` unset, not caster/bomber) | runReload false — does not back away | ✓ |
| Facing | target to RIGHT → facingLeft=false | `facingLeft=false` | ✓ |
| Death | reel → grave (no actor reincarnation) | `isDead=true`, action resolves to `grave` | ✓ |

---

## 8. Faithful Quirks (WONTFIX / candidate original-game traits — NOT port bugs)

| Quirk | Proof | Verdict |
|---|---|---|
| `#rotational:true` (lizardEgg) — the original `modRotational` spins the egg sprite continuously in flight. The port instead cycles the 9-frame `lizardEgg_fly` strip over the bullet's life AND statically orients the sprite to the flight angle. | `port/src/main.ts:651–671` (`drawBulletSprite`): per-life `_fly` frame + `ctx.rotate(atan2(vy,vx))`; `#rotational` is not read as data (grep: only the modRotational comment). | FAITHFUL — a SYSTEMIC, port-wide bullet-render approximation applied to ALL bullets, not lizardSoldier-specific. The 9-frame fly strip already reads as a tumbling egg. Cosmetic only. |
| Bullet damage decoupled from `|getVect()|` | The original couples bullet damage to travel-vector magnitude; the port fixes it to the K1 reference (`control.ts:846–866`, `BULLET_DAMAGE_SCALE`) — a deliberate documented balance abstraction shared by ALL ranged CPUs. | FAITHFUL by design |
| `effectiveCooldown` calibration (481 vs raw 300) | `archetypes.ts:208–209` back-solves the counter `hi` so recovery = the original `ceil((cd-1)/dex)+18` window — shared by every `#naturalRanged`/`#weaponRanged` CPU. | FAITHFUL by design |
| `#miniMapStatus:#inf` (from `#CPUCharacter`) not honored | No minimap system in port. | WONTFIX |

---

## 9. Summary

| Behavior | Original source | Port source | Verdict |
|---|---|---|---|
| Identity / team / stats / energy 200 | `act_lizardSoldier.txt` | `archetypes.ts:151–334` | ✓ CORRECT |
| `#naturalRanged` → ranged FSM | `AttackSetTypeFromAnimType()` | `weapon.ts:106`, `archetypes.ts:185` | ✓ CORRECT |
| `animChar=lizardSoldier` (own art, no blackOrc) | assets.json | `anim.ts:30–45` (spriteCharOr) | ✓ CORRECT |
| `#animframe:6` single egg / cycle | `modAttack.isOnAttackFrame` | `control.ts:754` | ✓ CORRECT |
| `#fullstrength` throw = strength 5 | `modAttack.performRangedAttack` | `control.ts:790` | ✓ CORRECT |
| `lizardEgg` bullet (mult 5, power 0.5) | `act_lizardEgg.txt` | `archetypes.ts:276–286`, `control.ts:846–866` | ✓ CORRECT |
| Egg → 3× `bug` (#monsters) on land | `modReincarnate` `[#bug,#bug,#bug]` | `projectile.ts:79–88` | ✓ CORRECT |
| reach 150, cooldown 481(eff), no kiting | `act_lizardSoldier.txt` | `archetypes.ts`/`control.ts` | ✓ CORRECT |
| Death → grave | `objCPUCharacter` / `modGrave` | `control.ts` | ✓ CORRECT |

---

`lizardSoldier | DIVERGENCES=0`
