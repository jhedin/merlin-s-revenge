# Behavioral Audit: act_necromancer

**Method:** Full derive-from-source + reproduce-in-port (300-frame probe run).  
**Date:** 2026-06-22

---

## 1. Identity

| Property | Value | Source |
|---|---|---|
| Name | necromancer | act_necromancer.txt:23 |
| objType | #objCPUCharacter | :3 |
| AiType | #objAiCPUSpellCaster | :4 |
| Inherit chain | #CPUCharacter → #character → #actor | :5 |
| Team | #undead | :22 |
| Weapon | #undeadSummon | :25 |
| animChar | necromancer | (derived from #name) |

---

## 2. Derived Correct Behavior (from originals)

### Stats (act_necromancer.txt + inherit chain)
| Property | Original value | Source line |
|---|---|---|
| energy | 50 | :12 |
| walkSpeed | 4 | :24 |
| inertia | 75 | :11 |
| damageSpeed | 4 | :10 |
| dexterity | 1 | :11 |
| strength | 1 | :21 |
| mana_capacity | 26 | :15 |
| mana_flow | 4 | :16 |
| mana_capacityIncLevel | 1.75 | :17 |
| mana_regeneration | 0.75 | :18 |
| stallSpeed | 0.5 | :20 |
| experienceImWorth | 25 | :13 |

### AI Behavior (objAiCPUSpellCaster)
- **Range**: infinite (reach 9999, `targetInReachRanged` → true from the start).
- **FSM**: findTarget → moveToAttack (immediately enters attack since reach is met) → attack → attackFin → optimumPosition (dodgesBullets=true).
- **Kite/dodge**: runs tangent to incoming bullets + flees enemies within 100px (pEnemySafeDistance=100, pBulletSafeDistance=100). Approaches its target when safe (runTowardsObject).
- **runReload**: runs kite mode after each shot (spellcaster always does).

### Weapon / Attack (act_undeadSummon.txt)
| Property | Value | act_undeadSummon:line |
|---|---|---|
| animType | #magic | 9 |
| bullet | #energyBlastBullet | 10 |
| chargeColour | rgb(9,113,255) | 11 |
| chargeExplodeFactor | 1 | 12 |
| chargeSize | 2 | 13 |
| chargeSpeed | 0.6 (capped at 0.8) | 14-17 |
| chargeStart | 0 | 15 |
| chargeMax | 36 (effective: min(36, 26×1+0) = 26) | 16 |
| chargeSpeedMax | 0.8 | 17 |
| cooldown | 25 | 19 |
| explodeFunction | #summonUnit | 21 |
| explodeSound | spell_explode | 22 |
| hits | [#teamMembers] | 23 |
| limitMagic | false | 24 |
| randomSummon | true | 25 |
| reach | 9999 | 41 |
| releaseSound | spell_release | 42 |
| residentTeamCategory | #enemies | 43 |
| spellSpeed | 25 | 44 |
| targetAllegiance | #enemy | 45 |
| targetTileWhenNotBlank | true | 46 |

### Multistage Summon Tiers (act_undeadSummon.txt:27-36)
With mana_capacity=26: effective chargeMax = min(36, 26) = 26. chargeSpeed = min(0.6×4, 0.8) = 0.8/frame.

| Tier | Unit | chargeRequired | Affordable at cap=26? |
|---|---|---|---|
| 1 | skeletonWarrior | 15 | YES |
| 2 | skeletonArcher | 17 | YES |
| 3 | skeletonThrower | 20 | YES |
| 4 | greyGhost | 25 | YES |
| 5 | undeadDragon | 29 | NO (>26) |
| 6 | necromancer | 33 | NO |
| 7 | darkMage | 35 | NO |
| 8 | skelitonLord | 38 | NO |

Deterministic top tier: **greyGhost** (requires 25 of 26 available). `randomSummon:true` wobbles the effective chargeMax per cast, so lower tiers (down to skeletonWarrior) occur too.

### Expected Animation Strips
The necromancer uses `#magic` animType. In modAnimSet.getAnimSym (script_objects/modAnimSet.txt:130-133), `#release` maps to `#releaseWalk` when moving.

| Action | Strip name | Should exist? |
|---|---|---|
| Stand | necromancer_stand | YES |
| Walk | necromancer_walk | YES |
| Charge (building spell) | necromancer_charge | YES |
| Charge+walk | necromancer_chargeWalk | YES |
| **Attack (release)** | **necromancer_release** | **YES — original game uses it** |
| **Attack+walk** | **necromancer_releaseWalk** | YES |
| Grave/death | necromancer_grave | YES |

---

## 3. Reproduced Behavior (300-frame probe, real bundle)

**Setup**: CollisionGrid 60×60×32, player at (400,400), necromancer at (540,400). Real assets.json. `game.spawnUnit/spawnEnemy/spawnAlly` wired. 300 frames.

### Confirmed Working
- **Summoning works**: entity count grew from 2→9 in 300 frames. Units spawned: greyGhost (×5), skeletonThrower (×2). All on team `#undead`, type `enemy`. `randomSummon` tier wobble working correctly.
- **Team correct**: spawned units are `#undead`, targeting the player enemy correctly.
- **dodgesBullets**: AI entered `optimumPosition` mode post-attack (t=50: `aiMode=optimumPosition`). Kite behavior live.
- **runReload**: correctly set, enters kite/reload after each cast.
- **Spell path**: `explodeFunction=#summonUnit` → `summonUnit()` called → `spawnUnit()` used correctly. No `#armySummon` reservation gate (correct — only `#armySummon` requires a reserve; `#undeadSummon` spawns fresh).
- **Stats resolution**: mana_capacity=26, mana_flow=4, mana_regeneration=0.75, chargeMax=36 (raw; effective=26), chargeSpeed capped at 0.8, team=#undead all correct.
- **AI type flags**: `ranged=true`, `runReload=true`, `dodgesBullets=true`, `reachRanged=220` (capped from 9999).
- **Energy=50**: forwarded correctly to build.
- **Inertia=75**: forwarded correctly.
- **walkSpeed**: 4×0.6=2.4 px/tick forwarded correctly.

### DIVERGENCE 1 — MISSING `necromancer_release` ANIMATION STRIP (REAL)

**What the probe showed**: `attackAnimsPlayed = ['release']` — the port's `CpuAI.attackAction()` correctly returns `"release"` for a `#magic` caster. However, `game.assets.index.anims["necromancer_release"]` does **not exist**.

The Anim component's `animFor(action)` falls back to `<char>_stand` when the action strip is absent (anim.ts:160-162). So during every attack window, the necromancer shows its **stand** frames instead of a casting animation.

- **Cast file reference**: modAnimSet.txt:130-133 — `#release` is a valid mode; necromancer must have a release strip. The original game runs this strip.
- **Assets**: `necromancer_release` and `necromancer_releaseWalk` strips are absent from `assets.json`. Both `mageOrc` and `goblinMage` have these strips.
- **Functional impact**: purely visual — the summon still fires on strip completion (the `an.looped()` fallback in `updateAttack` fires `performAttack` when `!attackFired`). But the necromancer **silently casts** (stand anim plays) instead of showing a release animation.
- **Fix sketch**: Source and add `necromancer_release` (and optionally `necromancer_releaseWalk`) sprite strips to the assets bundle via `build_assets.ts`. The port code is correct; only the art asset is missing.

### DIVERGENCE 2 — `mana_capacityIncLevel` not forwarded for enemies (MINOR / LOW IMPACT)

**What the probe showed**: Mana's `capInc` defaults to `1.0` for all enemies. The necromancer's data sets `mana_capacityIncLevel: 1.75` (act_necromancer.txt:17), giving it a faster charge-ceiling growth per level than a generic CPU caster.

- **Cast file reference**: act_necromancer.txt:17 — `#mana_capacityIncLevel: 1.75`
- **Port reference**: `spawnEnemy` in archetypes.ts:326-328 passes `mana_capacity/flow/burst/regeneration` but NOT `mana_capacityIncLevel`, `mana_flowIncLevel`, etc.
- **Functional impact**: Low — enemies only level up after kills, and in a typical playthrough a necromancer rarely gets many kills before dying. A levelled necromancer would have a lower-than-intended charge ceiling growth (1.0 instead of 1.75 per level), meaning it stays weaker at higher levels than the original.
- **Fix sketch**: In `spawnEnemy`, add `mana_capacityIncLevel: num("mana_capacityIncLevel", 1)` to the build config (and optionally the other `*IncLevel` mana stats for completeness). The Mana component already reads `mana_capacityIncLevel` in `init` (mana.ts:26).

### DIVERGENCE 3 — `stallSpeed` not implemented (COSMETIC / OUT-OF-SCOPE)

**What the probe showed**: `stallSpeed: 0.5` exists in the original (act_necromancer.txt:20) but is not read or used anywhere in the port's Movement, EnemyAI, or CpuAI.

- **Cast reference**: act_necromancer.txt:20 — `#stallSpeed: 0.5`
- **Original meaning**: The minimum speed below which a character's walk animation stalls (plays slower or freezes). A cosmetic animation-timing parameter.
- **Functional impact**: None — the necromancer moves and animates correctly without it. This is an art-quality tweak.
- **Fix sketch**: Out of scope per plan. Could be added to Movement as a min-speed clamp on animation timing if needed later.

---

## 4. Derive-vs-Reproduced Table

| Property | Expected | Reproduced | Status |
|---|---|---|---|
| Team | #undead | #undead | PASS |
| animChar | necromancer | necromancer | PASS |
| AI type | spellcaster+dodge+kite | ranged=true, runReload=true, dodgesBullets=true | PASS |
| Summons undead | yes, via #undeadSummon multistage | yes, greyGhost+skeletonThrower seen at t<55 | PASS |
| Summon tiers (within cap=26) | skeletonWarrior..greyGhost | greyGhost, skeletonThrower observed | PASS |
| randomSummon wobble | yes, tier varies | yes, varied between greyGhost and skeletonThrower | PASS |
| Summoned team | #undead | #undead | PASS |
| Summoned entity type | enemy | enemy | PASS |
| energy | 50 | 50 | PASS |
| walkSpeed | 4 (×0.6=2.4 px/tick) | 2.4 | PASS |
| inertia | 75 | 75 | PASS |
| mana_capacity | 26 | 26 | PASS |
| mana_flow | 4 | 4 | PASS |
| mana_regeneration | 0.75 | 0.75 | PASS |
| chargeSpeed (capped) | 0.8 | 0.8 (computed at cast time) | PASS |
| chargeMax (raw data) | 36 | 36 | PASS |
| chargeMax (effective) | 26 | 26 | PASS |
| cooldown (effective) | 33 frames | 33 | PASS |
| Release strip during attack | necromancer_release | MISSING → falls back to stand | **FAIL** |
| mana_capacityIncLevel | 1.75 | defaults to 1.0 | **FAIL (minor)** |
| stallSpeed | 0.5 | not implemented | **FAIL (cosmetic/OOS)** |
| kite post-attack | optimumPosition mode | aiMode=optimumPosition at t=50 | PASS |
| dodgesBullets | true | true | PASS |
| experienceImWorth | 25 | 25 | PASS |

---

## 5. Divergences

### D1 — Missing `necromancer_release` animation strip (REAL BUG — visual)
- **Cast**: modAnimSet.txt:130-133 (release mode), act_necromancer.txt (animType: #magic via #undeadSummon)
- **Port**: `CpuAI.attackAction()` returns `"release"` → `Anim.animFor("release")` → looks up `necromancer_release` → NOT FOUND → falls back to `necromancer_stand`.
- **Effect**: Necromancer shows its **stand** sprite during every cast instead of a casting animation. Summon still fires correctly (functional fallback in `updateAttack:an.looped()`).
- **Fix**: Add `necromancer_release` (and `necromancer_releaseWalk`) art strips to the asset bundle. The port control/animation code is already correct — the art is simply missing from `assets.json`.

### D2 — `mana_capacityIncLevel` not forwarded to enemy Mana (MINOR — low gameplay impact)
- **Cast**: act_necromancer.txt:17 `#mana_capacityIncLevel: 1.75`
- **Port**: `spawnEnemy` (archetypes.ts:326-328) doesn't pass `mana_capacityIncLevel` to build; Mana.init defaults to `1.0`.
- **Effect**: A levelled necromancer gains mana capacity at 1.0/level instead of 1.75/level, so its summon tier ceiling grows more slowly with level. Low impact in normal play.
- **Fix**: Add `mana_capacityIncLevel: num("mana_capacityIncLevel", 1)` to the `spawnEnemy` build config.

### D3 — `stallSpeed` not implemented (COSMETIC / OOS)
- **Cast**: act_necromancer.txt:20 `#stallSpeed: 0.5`
- **Port**: Not read or used anywhere.
- **Effect**: Walk animation does not stall at slow speed. Pure cosmetic difference.
- **Fix**: Out of scope per plan. Low priority.

---

necromancer | DIVERGENCES=3  
D1: missing `necromancer_release` art strip (stand plays instead of casting anim — visual); D2: `mana_capacityIncLevel` not forwarded to enemy Mana (1.0 vs 1.75, low impact); D3: `stallSpeed` unimplemented (cosmetic/OOS).
