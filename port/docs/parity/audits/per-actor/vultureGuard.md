# Per-Actor Parity Audit: `vultureGuard`

**Method:** Behavior DERIVED from `casts/data/act_vultureGuard.txt` + the `#inherit` chain
(`#CPUCharacter` → `#character` → `#actor`) + bullet `act_lightning.txt` (→ `#bullet`), plus
`casts/script_objects/{objAiCPU,objCPUCharacter,modCharacterAttackProperties}.txt` and
`casts/general_functions/AttackSetTypeFromAnimType().txt`. Then REPRODUCED in the port: throwaway probe
`port/tools/_audit_vultureGuard.ts` loaded the REAL `src/generated/assets.json` bundle, harness
`game.assets={index,images,img,ensureChar}` + `new CollisionGrid(80,80,32)` +
`game.teamMaster.unitMap.configure(32,0,0)`, spawned the actor with a hostile `#aldevar` target,
`rebuildCombatSubstrate()` + `update` each tick for 200 frames, observing strips/shots/throw-speed/
facing/kiting/death. Probe deleted after the run.

**Status:** 1 DIVERGENCE (a port-wide `runReload` kite-band adaptation, not vultureGuard-specific).

---

## 1. Identity & Inherit Chain

| Property | Source | Resolved value |
|---|---|---|
| `#objType` | `act_vultureGuard.txt:3` | `#objCPUCharacter` → `EnemyArchetype` |
| `#AiType` | `act_vultureGuard.txt:4` | `#objAiCPU` (committed-target FSM, NOT a spellcaster) |
| `#inherit` | `#CPUCharacter`→`#character`→`#actor` | defaults merged |
| `#team` | `act_vultureGuard.txt:32` | `#monsters` |
| `#name` | `act_vultureGuard.txt:33` | `"vultureGuard"` (sprite char key) |

Native `#attack` present (no `#weapon`), so the port takes the "use own #attack" branch
(`archetypes.ts:171`, `!atk["animType"]` is false). `#naturalRanged` →
`AttackSetTypeFromAnimType` maps `type=#ranged`
(`general_functions/AttackSetTypeFromAnimType().txt:15`), so the FSM is RANGED
(`archetypes.ts:183–184`). Probe confirmed `animType=#naturalRanged type=ranged`.

---

## 2. Data Properties (Derived vs Reproduced)

| Property | Original (`act_vultureGuard.txt`) | Port observed | Match |
|---|---|---|---|
| `#energy` | `1300` (L22) | `energy=1300 max=1300` | ✓ |
| `#strength` | `15` (L29) | throw speed = 15.00 (`#fullstrength`, §6) | ✓ |
| `#dexterity` | `1` (L20) | ranged cooldown inc = 1 (→ effectiveCooldown 48, §7) | ✓ |
| `#walkSpeed` | `12` (L34) | `maxSpeed = 12 × 0.6 = 7.2` px/tick | ✓ |
| `#inertia` | `50` (L25) | `inertia=50` (knockback damping) | ✓ |
| `#eyestrain` | `20` (L24) | `eyestrain=20` (aim scatter, `aimWithEyestrain`) | ✓ |
| `#damageSpeed` | `3` (L19) | `damageSpeed=3` | ✓ |
| `#stallSpeed` | `3` (L27) | platform stall (side-view; no top-down effect) | ✓ |
| `#dieSound` | `#none` (L21) | no death sound | ✓ |
| `#takeHitSound` | `"vulture_hit"` (L30) | hit sound forwarded | ✓ |
| `#takeHitVolume` | `15` (L31) | volume forwarded | ✓ |
| `#experienceImWorth` | `25` (L23) | imWorth=25 | ✓ |
| `#startingLevel` | `0` (L28) | no pre-leveling | ✓ |
| `#weaponTechnique` | `0` (L35) | no anim-speed mod | ✓ |
| `#runReload` | `true` (L26) | kite mode entered — but band-gated (see §6, **DIVERGENCE**) | ⚠ |

---

## 3. Animation Strips (REAL bundle, no fallbacks)

Char key `vultureGuard`. All five actor strips + two bullet strips resolve to real bundled strips — no
`_stand`/blackOrc fallback. `chars` registry: `vultureGuard=true`, `lightning=true`.

| Strip | Role | `assets.json` | Delay | Loop | Notes |
|---|---|---|---|---|---|
| `vultureGuard_stand` | idle | **1 frame** | 3 | true | ✓ |
| `vultureGuard_walk` | walk cycle | **8 frames** | 3 | true | ✓ |
| `vultureGuard_naturalRanged` | spit (attack) | **11 frames** | 1 | false | ✓ — `#animframe 7` is a valid mid-strip release (frame 7 of 11) |
| `vultureGuard_reel` | hit/knockback | **8 frames** | 1 | false | ✓ |
| `vultureGuard_grave` | corpse | **2 frames** | 1 | false | ✓ |
| `lightning_fly` | bullet in flight | **1 frame** | 3 | true | ✓ |
| `lightning_land` | bullet land | **2 frames** | 1 | true | ✓ |

Probe `[ACTIONS] seen = stand, naturalRanged` — both resolve to real strips, no fallback.

---

## 4. Attack: native `#attack` `#spitBullet`

| Field | Original | Port observed | Match |
|---|---|---|---|
| `#name` | `#spitBullet` | `name=#spitBullet` | ✓ |
| `#animType` | `#naturalRanged` | `animType=#naturalRanged`, `type=ranged` | ✓ |
| `#firingType` | `#fullstrength` | `firingType=#fullstrength` → speed = strength 15 (§6) | ✓ |
| `#bullet` | `#lightning` | fired bullet `char=lightning` (own art, not a dot) | ✓ |
| `#reach` | `180` | `reach=180` (ranged approach gate; `reachRanged=180`) | ✓ |
| `#animframe` | `7` (scalar) | `animFrame=[7]` (scalar→list); fires when `attackFrame()==7` | ✓ |
| `#cooldown` | `30` (raw) | `effectiveCooldown=48` (calibrated, §7) | ✓ |
| `#collisionLoc` | `point(50,-5)` | muzzle offset applied at bullet spawn (`muzzle()`) | ✓ |
| `#sound` | `"vulture_fire"` | attack sound (`atkSound`, played at 0.5 vol) | ✓ |
| `#volume` | `25` | attack volume | ✓ |
| shot model | single shot/cycle | **5 shots / 200 frames, gaps 48** — one `lightning` per cycle | ✓ |

**Single shot per attack cycle** — `#animframe` is scalar `7` → `[7]`, so exactly ONE `lightning` is
spat per attack-strip play (one fresh frame-7 crossing). Probe: shots at frames 4,52,100,148,196.

---

## 5. Bullet: `lightning` → `act_lightning.txt`

| Field | Original | Port resolved | Match |
|---|---|---|---|
| `#character`/sprite key | `#name:"lightning"` (name==key) | `bulletChar=lightning` (own `lightning_fly`/`_land` art) | ✓ |
| `#inherit` | `#bullet` | bullet defaults merged | ✓ |
| `#damageMultiplier` | `1` | `bmult=1` into bullet takeHit | ✓ |
| `#power` | `3.5` | `powerScalar=3.5` → `l1 = 3.5 · 4.5 · BULLET_DAMAGE_SCALE` (`control.ts:837`) | ✓ |
| `#attack.type` | `#bullet` | plain (non-splash) bullet path (`splashDamageOn=false`) | ✓ |
| `#friction` | `point(3,3)` | bullet drag | ✓ |
| `#weight` | `0.4` | bullet weight | ✓ |
| `#recordInRoomState` | `false` | not persisted in room state (engine-internal) | ✓ |

---

## 6. AI Behavior (Derived vs Reproduced, 200-frame sim)

### Derived (objAiCPU → objAiAttack, type `#ranged`, `#runReload:true`)
1. **findTarget** → nearest opposite-allegiance hostile; commit.
2. **moveToAttack** → close to within `reach=180` (`targetInReachRanged`, GeomDist < reach).
3. **attack** → `ensureMode(#naturalRanged)`; fire on the fresh `#animframe 7` crossing →
   `performRangedAttack`.
4. **`#fullstrength`** (`modAttack.performRangedAttack`): `|throwVect| = strength = 15` — constant-speed
   projectile.
5. **attackFin** → clear + `refreshTarget()`; **`#runReload:true`** → `goMode(#runReload)`.
6. **runReload** (`objAiCPU.updateRunReload`, L555–572): `moveAwayFromLoc(targetLoc)` **UNCONDITIONALLY**
   every frame until `getCooldownFin()`, then back to `moveToAttack`.
7. **Death** → reel → `modGrave` grave draw.

### Reproduced (port observed)
1. Committed target acquired; FSM ranged. ✓
2. `reach=180` approach gate; AI modes seen: `moveToAttack`, `runReload`. ✓
3. Attack strip `naturalRanged` plays; one `lightning` spat per cycle. ✓
4. **Throw speed = 15.00 exactly** for every bullet (`#fullstrength` → `max(1, strength=15)`,
   `control.ts:779–780`). ✓
5. **Facing** — target to the RIGHT → `facingLeft=false` (tally `{right:200}`). ✓
6. **Death → grave** — `isDead=true`, action resolves to `grave` (strip present). ✓
7. **runReload kiting — ⚠ DIVERGENCE** (see §8): enters `runReload`, but only backs away when
   `dist < reachRanged·0.7` (= 126 px). Probe: at target dist 100 it kited to 139; at dist 160 (within
   126–180, i.e. in-range but inside the dead band) it stood STILL while reloading. The original kites
   away unconditionally on every reload frame regardless of distance.

---

## 7. Cadence

| Parameter | Value | Source |
|---|---|---|
| Raw `#cooldown` | `30` | `act_vultureGuard.txt:12` |
| `dexterity` (ranged inc) | `1` | `act_vultureGuard.txt:20` |
| `framesWanted` | `max(1, ceil((30-1)/1) + 18) = 47` | `archetypes.ts:206` |
| `effectiveCooldown` | `round(47 × 1 + 1) = 48` | `archetypes.ts:207` |
| Cooldown recovery | `ceil((48-1)/1) = 47 ticks` | counter math |
| Attack strip duration | `11 frames × delay 1 = 11 ticks` | `vultureGuard_naturalRanged` |
| **Binding cadence** | `max(48, 11) = ~48 ticks` | cooldown-bound |

Observed shot frames **4, 52, 100, 148, 196 → gaps 48, 48, 48, 48** ticks — exactly the cooldown
period (the 48-tick cooldown, not the 11-tick strip, is the binding constraint). The `+18` ranged
buffer is the port-wide calibration convention (same as bat/skeletonThrower). Faithful.

---

## 8. Divergences

### D1 — `runReload` kiting is distance-band-gated; the original kites unconditionally (PORT adaptation)

| | Original | Port |
|---|---|---|
| Source | `casts/script_objects/objAiCPU.txt:565–569` | `port/src/components/control.ts:694` |
| Logic | `if myTarget <> #none then me.moveAwayFromLoc(targetLoc)` — **no distance test** | `if (d < this.reachRanged * 0.7) { intent = away } else this.idle(m)` |
| Effect | vultureGuard backs away from the target on EVERY reload frame while cooling | vultureGuard only backs away when within 70% of reach (126 px); in the 126–180 px in-range band it stands still while reloading |

**Evidence (probe):** target at dist 100 → kited out to 139 (`d<126`, kites); target at dist 160 →
max dist stayed 160 (in band, no kite). Original would have moved away in both cases.

**Verdict:** Real behavioral divergence, but it is a **port-WIDE `updateRunReload` adaptation shared by
ALL kiters** (the 4 data-driven `#runReload` actors — bat / caveBat / evilTv / vultureGuard — plus the
spellcaster/bomber AI kinds the port approximates via `runReload`). It is NOT a vultureGuard-specific
bug, and the OR-gating that turns vultureGuard's `#runReload:true` into kite mode is faithful
(`archetypes.ts:237`, vultureGuard named at `archetypes.ts:233`). The cosmetic consequence is that an
in-range-but-not-close vulture reloads in place instead of edging back. Flagged here for the kite-model
owner; not fixed in this per-actor pass (a fix belongs in the shared `updateRunReload`, not this actor).

---

## 9. Faithful Quirks / WONTFIX (NOT port bugs)

| Quirk | Proof | Verdict |
|---|---|---|
| Bullet damage decoupled from `|getVect()|` | Original couples bullet damage to travel-vector magnitude; port fixes damage to the K1 reference (`control.ts:835–837`) at `#fullstrength` speed 15 — deliberate, documented balance abstraction shared by all ranged CPUs | FAITHFUL by design |
| `#collisionLoc point(50,-5)` muzzle exactness | Port applies a `muzzle()` offset from `#collisionLoc`; pixel-exact spawn loc is cosmetic | FAITHFUL |
| `#stallSpeed`/`#damageSpeed`/`#miniMapStatus` (from `#CPUCharacter`) | Platform/wall-slam/minimap props; no top-down combat effect in shipped levels | WONTFIX |
| `+18` ranged cooldown buffer (raw 30 → 48) | Port-wide ranged calibration (B2 plan §f.3) so the per-weapon counter recovers in the slice's `#frames` | FAITHFUL convention |

---

## 10. Summary

| Behavior | Original source | Port source | Verdict |
|---|---|---|---|
| Identity / team `#monsters` / stats / energy 1300 | `act_vultureGuard.txt` | `archetypes.ts:151–350` | ✓ CORRECT |
| `#naturalRanged` → ranged FSM | `AttackSetTypeFromAnimType()` | `archetypes.ts:183–184` | ✓ CORRECT |
| `#animframe:7` single shot/cycle | `modAttack.isOnAttackFrame` | `control.ts:745`, `weapon.ts:181–185` | ✓ CORRECT |
| `#fullstrength` throw = strength 15 | `modAttack.performRangedAttack` | `control.ts:779–780` | ✓ CORRECT |
| `lightning` bullet (power 3.5, mult 1) | `act_lightning.txt` | `archetypes.ts:276–286`, `control.ts:836–851` | ✓ CORRECT |
| All 5 actor + 2 bullet strips present | assets.json | assets.json | ✓ CORRECT |
| Cooldown cadence 48 ticks | `#cooldown 30` + dexterity 1 | `archetypes.ts:206–207` | ✓ CORRECT |
| Death → grave; faces target | `objCPUCharacter`/`modGrave` | `control.ts:712`, `anim.ts:110` | ✓ CORRECT |
| **`#runReload` kiting band-gated** | `objAiCPU.txt:565–569` (unconditional) | `control.ts:694` (`d < reach·0.7`) | ⚠ **D1 DIVERGENCE** (port-wide, shared) |

---

`vultureGuard | DIVERGENCES=1`
