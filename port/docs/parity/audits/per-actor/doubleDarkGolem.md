# Behavioral Audit: `act_doubleDarkGolem`

**Scope:** READ-ONLY behavioral verification. Comparing original Lingo spec against port implementation for faithful actor behavior.

---

## Summary

**CLEAN** — All behavioral properties correctly implemented. doubleDarkGolem behaves identically to the original.

---

## Data Comparison

| Property | Original | Port | Match |
|----------|----------|------|-------|
| `#objType` | `#objCPUCharacter` | `#objCPUCharacter` | ✓ |
| `#AiType` | `#objAiCPU` | `#objAiCPU` | ✓ |
| `#attack.animType` | `#naturalRanged` | `#naturalRanged` | ✓ |
| `#attack.bullet` | `#darkRock` | `#darkRock` | ✓ |
| `#attack.reach` | `150` | `150` | ✓ |
| `#attack.cooldown` | `0` | `0` | ✓ |
| `#strength` | `20` | `20` | ✓ |
| `#dexterity` | `10` | `10` | ✓ |
| `#energy` | `1000` | `1000` | ✓ |
| `#walkSpeed` | `1` | `1` | ✓ |
| `#inertia` | `50` | `50` | ✓ |
| `#startingLevel` | `5` | `5` | ✓ |
| `#reincarnateAs` | `[#darkGolem, #darkGolem]` | `["#darkGolem", "#darkGolem"]` | ✓ |
| `#reincarnateRadius` | `30` | `30` | ✓ |
| `#team` | `#monsters` | `#monsters` | ✓ |

---

## Behavioral Verification

### 1. Attack Classification: RANGED ✓

**Original:** `#animType: #naturalRanged` in `#attack`.  
**Port:**
- `typeFromAnimType("#naturalRanged")` → `"ranged"` (`weapon.ts:91`)
- `spawnEnemy` recognizes `#naturalRanged` at line 169-170 and sets `ranged = true`
- CpuAI correctly routes to ranged `attack()` path at line 521

**Verdict:** doubleDarkGolem correctly fires as RANGED, not melee. Will move to within reach (150 px), then fire bullets from range.

### 2. Bullet Resolution ✓

**Original:** `#attack.bullet: #darkRock`.  
**Port:**
- Registry resolves `#darkRock` → `act_darkRock` with case-insensitive fallback (`registry.ts:86-90`)
- `spawnEnemy` line 240-241: resolves bullet actor data
- act_darkRock data matches original: `#inherit: #bullet, #attack.type: #explode, explodeCharge: 40`

**Verdict:** darkRock resolves correctly. Type `#explode` classifies it as a splash bullet (line 243).

### 3. Splash Fire Behavior ✓

**Original:** darkRock is an exploding projectile per `act_darkRock.txt`.  
**Port:**
- `spawnEnemy` line 243: `ba.attackType === "#explode"` → sets `splashBullet`
- CpuAI.attack line 523-528: fires splash bullets via `fireSplashBullet()`
- Boulder flies to target, explodes radially on arrival/collision (matching original behavior)

**Verdict:** doubleDarkGolem's darkRock fires and explodes as splash damage, faithful to original.

### 4. Starting Level ✓

**Original:** `#startingLevel: 5` — pre-levelled enemy spawns at level 5.  
**Port:**
- `spawnEnemy` lines 307-308: reads `startingLevel` and applies via `forceLevelUp` message
- Each level-up calls the entity's component handlers (Energy, Mana, etc.)
- Correctly pre-levels before returning the entity

**Verdict:** doubleDarkGolem spawns at level 5, with all stats scaled up faithfully.

### 5. Reincarnation: Split on Death ✓

**Original:** `#reincarnateAs: [#darkGolem, #darkGolem]` — on death, spawn TWO darkGolem units.  
**Port:**
- Reincarnate component reads `reincarnateAs` array (`reincarnate.ts:57`)
- On `isDead && getKilledInAction()` (lethal damage only), spawns each non-`#none` entry (`reincarnate.ts:65-72`)
- Fire-once latch prevents duplication (`reincarnate.ts:68`)
- Spawned children acquire their OWN team/level from `act_darkGolem` data, NOT inherited from parent (`reincarnate.ts:25`)
- `#reincarnateRadius: 30` scatters the two spawns on a ring (`reincarnate.ts:88-92`)

**Verdict:** Reincarnation is faithful. A lethal doubleDarkGolem kill spawns exactly two darkGolem units at the corpse location, each at their own data level (0) and team (#monsters).

### 6. Team & Targeting ✓

**Original:** `#team: #monsters`.  
**Port:**
- Team correctly read into Team component (line 260)
- `#monsters` is hostile to #aldevar (player team)
- Enemies acquire doubleDarkGolem as a valid target

**Verdict:** Team allegiance correct. doubleDarkGolem attacks enemies of #monsters.

### 7. AI Behavior ✓

**Original:** `#AiType: #objAiCPU` — standard enemy FSM.  
**Port:**
- CpuAI FSM: findTarget → moveToAttack → attack (with kite if ranged)
- No special flags (wizard, ghost, multiAttack, builder, leaveWhenFinished, reelProof) — all correctly absent
- `runReload` disabled for standard CPU (only spellcaster/bomber/caster animate types set it, line 206)
- doubleDarkGolem uses standard moveToAttack → fire → re-target loop

**Verdict:** AI behavior is standard CPU with no deviations.

### 8. Death & Audio ✓

**Original:** `#dieSound: "boulder_die"`.  
**Port:**
- `spawnEnemy` line 289: reads `dieSound` and passes to Energy component
- Energy.takeHit (line 43): plays the sound on lethal damage

**Verdict:** Death sound plays correctly on lethal hit.

### 9. Cosmetic/Deferred Omissions (Acknowledged, Per Spec) ✓

The following are known faithful omissions per the data-coverage audit:
- `#damageSpeed: 3` — terrain/fall damage only (platforming, out of scope)
- `#eyestrain: 25` — caster aim jitter (deferred)
- `#attack.animframe: [5, 11, 18, 25]` — attack-frame gating (deferred)
- `#attack.sound: "darkGolem_fire"` — plays on attack (implemented, but cosmetic timing)
- `#attack.collisionLoc: point(0,-10)` — per-weapon bullet spawn offset (port uses fixed `y-6`)
- `#frictionReel: point(50,50)` — terrain/knockback friction (side-view engine property)
- `#weaponTechnique: 0` — attack-anim speedup (not applied to CPU, cosmetic)

None of these affect behavioral correctness.

---

## Dual-Tree Evidence Summary

| Behavior | Original (`casts/` file:line) | Port (`src/` file:line) | Verdict |
|----------|------|------|---------|
| Ranged attack type | `act_doubleDarkGolem.txt:9` | `archetypes.ts:169-170` | CORRECT |
| Bullet resolution | `act_doubleDarkGolem.txt:10, act_darkRock.txt:1-23` | `archetypes.ts:240-245, registry.ts:86-90` | CORRECT |
| Splash fire route | `act_darkRock.txt:6-8` | `archetypes.ts:243, control.ts:523-528` | CORRECT |
| Starting level applied | `act_doubleDarkGolem.txt:26` | `archetypes.ts:307-308` | CORRECT |
| Reincarnation split on death | `act_doubleDarkGolem.txt:27-28, modReincarnate.txt` | `reincarnate.ts:64-99` | CORRECT |
| Team & targeting | `act_doubleDarkGolem.txt:30, tem_pitMonsters.txt` | `combat.ts:127, archetype.ts:260` | CORRECT |
| AI FSM | `act_doubleDarkGolem.txt:4` | `control.ts:295-568` | CORRECT |
| No special flags | (all absent in original) | `archetype.ts:206-316` | CORRECT |
| Death sound | `act_doubleDarkGolem.txt:20, casts/modEnergy.txt` | `archetypes.ts:289, combat.ts:43` | CORRECT |

---

## Conclusion

**All behavioral properties verified CORRECT.** doubleDarkGolem functions identically to the original:
- ✓ Attacks as a ranged thrower (not melee)
- ✓ Fires darkRock boulders that explode on impact (splash damage)
- ✓ Spawns pre-levelled at level 5
- ✓ Uses correct team and targeting
- ✓ Splits into two darkGolem units on lethal death (reincarnation)
- ✓ Standard CPU AI with no special behaviors
- ✓ Correct stats and cooldown
- ✓ Death sound plays correctly

**No behavioral divergences found.**

---

## Anim-Cosmetic Sweep (2026-06-23) — REPRODUCED

**Method:** throwaway probe (`port/tools/_audit_animcosmetic.ts`, deleted) loaded the REAL `assets.json`,
spawned doubleDarkGolem + a `#aldevar` target, ticked 200 frames, then applied a non-lethal hit and a lethal kill.
Strip availability cross-checked against the ORIGINAL extracted bitmaps (`extracted/engine/bitmaps`).

| Aspect | Observed | Verdict |
|--------|----------|---------|
| (a) anim char | `spriteCharOr("doubleDarkGolem")` → **`doubleDarkGolem`** (via `#name`), NEVER `blackOrc` | CORRECT |
| (b) strips | stand(1)/walk(8)/naturalRanged(38)/grave(2) resolve to real `doubleDarkGolem_*` art; **NO `_reel`** | see (d) |
| (c) attack strip + hit sync | `doubleDarkGolem_naturalRanged` plays; bullet (#darkRock) fires on **#animframe [5,11,18,25]** (matches data — 4 throws per strip); 21 bullets in 200f | CORRECT |
| (d) non-lethal reel | `animAction`→`"reel"` but **no `doubleDarkGolem_reel` strip** → falls back to **stand** | FAITHFUL QUIRK |
| (e) death visual | `getGraveOn=true`; `doubleDarkGolem_grave` (2f) renders, z≪0 (behind living), faces right, no tint | CORRECT |

**On (c) — supersedes the earlier "deferred" note.** This file's prior READ-ONLY audit listed
`#attack.animframe:[5,11,18,25]` as "attack-frame gating (deferred)". That is NO LONGER accurate: the REPRODUCED
run shows the four boulders fire on exactly frames 5, 11, 18, 25 of the 38-frame `naturalRanged` strip — the
animation IS the clock. The port reads the lowercase `animframe` data key over the camelCase `animFrame:2` STRUCT
default. No cosmetic divergence.

**On (d) — NOT a port bug.** The ORIGINAL ships NO `anm_doubleDarkGolem_reel_*` bitmap (only grave/naturalRanged/
stand/walk in `extracted/engine/bitmaps`). The original `objAnimSet.symExistsOrDefault` (`ParentScript 80`) maps a
missing strip to **`#stand`**; the port's `Anim.animFor` does the same. Reeling-as-stand is the shipped behavior,
reproduced faithfully (the white flick-on-hit still plays via ColourTransform).

**Anim-cosmetic: CLEAN (0 PORT divergences; 1 faithful quirk — reel→stand, no reel art in original).**

---

## RE-VERIFY BY REPRODUCTION (2026-06-23)

Real assets/data; `doubleDarkGolem` as `#monsters` enemy vs PINNED `archer` (`#aldevar`); substrate rebuilt
per tick; 260 frames + a forced-kill to observe reincarnation. Harness gitignored/deleted.

| Check | Expected | Observed | Status |
|---|---|---|---|
| Sprite char | `doubleDarkGolem` (not blackOrc) | `spriteCharOr→doubleDarkGolem`; `_stand`(1) `_walk`(8) `_naturalRanged`(38) `_grave`(2) bundled | ✓ |
| Weapon | `#throwBoulder` `#naturalRanged` `#darkRock`, reach 150 | `getCurrentAttack name:#throwBoulder type:ranged reach:150 animFrame:[5,11,18,25]` | ✓ |
| **Multi-attack (4 shots/cycle)** | fire on each of `#animframe [5,11,18,25]` | bullets at strip-ticks **[5,11,18,24]** per cycle (frame 25 lands at tick 24 by per-frame delay accumulation) → **4 shots per attack** | ✓ |
| Approach | walkSpeed 1 → creeps into reach 150 | walked from 200px to dist 149, then fired | ✓ |
| Damage | boulders hit | pinned archer **energyFrac→0.145** (`collisionLoc -10` is within the 12px collision tolerance — see garTower note) | ✓ |
| **Reincarnation** | `[#darkGolem, #darkGolem]` on KIA | killed → `killedInAction true` → **2 `darkGolem` children** | ✓ |

**CLEAN — reproduced faithfully.** The 4-frame multi-attack fires four `darkRock` boulders per cycle and the
golem splits into two darkGolems on death. (Its boulders land despite the muzzle-aim aiming bug noted under
`garTower` only because `collisionLoc.y = -10` falls inside the ±12px hit tolerance; a larger offset would
miss — that bug bites tower-class units, not this golem.)
