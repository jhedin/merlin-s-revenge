# Actor Audit: act_goblinHero

**VERDICT: CLEAN — 0 divergences.** The goblinHero is the goblins' pre-levelled elite ARCHER (despite
the "Hero" name it is a ranged unit — identical loadout to `goblinArcher`, but `#startingLevel: 20` and
`#experienceImWorth: 100`). Reproduced live in the port: it resolves to its REAL "gar" sprite (NOT
blackOrc), fires exactly ONE `gobarrow` per attack cycle at strip frame 21, reach 100, `#fullstrength`
throw, hits + damages the player target, faces it, walks to close when out of reach, and dies to a grave.

**Audit Date:** 2026-06-23
**Method:** REPRODUCED — throwaway Node probe (`tools/_audit_goblinHero.ts`, since deleted) loaded the
REAL `@/generated/assets.json` bundle (`game.assets = { index, images:new Map(), img:()=>null,
ensureChar:async()=>{} }`, `game.grid = new CollisionGrid(80,80,32)`,
`game.teamMaster.unitMap.configure(32,0,0)`), spawned the actor via `spawnEnemy` with a pinned
`spawnPlayer` target, `rebuildCombatSubstrate()` + ticked every entity (including bullets) ~220 frames,
and observed Movement / EnemyAI(CpuAI) / WeaponManager / Anim / Projectile / Energy live (shots counted
off fired Projectiles, bullet path + damage tracked, death/grave forced).
**Original Spec:** `casts/data/act_goblinHero.txt` + `#inherit` chain (`#CPUCharacter`),
`casts/data/act_goblinBow.txt`, `casts/data/act_goblinArrow.txt`, `casts/data/tem_goblins.txt`,
`casts/script_objects/modWeaponManager.txt`, `casts/script_objects/modCharacterAttackProperties.txt`.

---

## 1. What the goblinHero IS and SHOULD do (derived from original)

**Identity / team** (`act_goblinHero.txt`)

| Field | Value | Source |
|-------|-------|--------|
| `#name` (sprite char) | **"gar"** (shared with goblinArcher) | act_goblinHero.txt:16 |
| `#team` | `#goblins` (category #enemies; friends orcs; **hates #aldevar/#village/#undead/…**) | act_goblinHero.txt:15, tem_goblins.txt:7 |
| `#AiType` | `#objAiCPU` (standard committed-target FSM) | act_goblinHero.txt:4 |
| `#objType` | `#objCPUCharacter` | act_goblinHero.txt:3 |
| `#inherit` | `#CPUCharacter` (no `#character` override → CPU enemy character) | act_goblinHero.txt:5 |

**Stats**

| Field | Value | Source |
|-------|-------|--------|
| `#energy` | 50 | act_goblinHero.txt:9 |
| `#strength` | 8 (→ ~10 after startingLevel 20 ×0.1/lvl; bullet speed under #fullstrength) | act_goblinHero.txt:14 |
| `#dexterity` | 10 (ranged cooldown-counter inc) | act_goblinHero.txt:7 |
| `#walkSpeed` | 4 (→ 2.4 px/tick at ×0.6) | act_goblinHero.txt:17 |
| `#inertia` | 50 (knockback resistance) | act_goblinHero.txt:12 |
| `#damageSpeed` | 3 (wall-slam bonus-damage threshold) | act_goblinHero.txt:6 |
| `#eyestrain` | 5 (ranged aim scatter) | act_goblinHero.txt:11 |
| `#experienceImWorth` | **100** (vs goblinArcher's 3 — the only XP difference) | act_goblinHero.txt:10 |
| `#startingLevel` | **20** (pre-levelled; vs goblinArcher's 0) | act_goblinHero.txt:13 |
| `#weaponTechnique` | -75 (attack-anim speedup rating, negative → slower) | act_goblinHero.txt:19 |
| `#dieSound` | `#none` | act_goblinHero.txt:8 |
| `#graveOn` | *not set* → modGrave default true (leaves a grave) | act_goblinHero.txt (absent) |
| `#weapon` | `#goblinBow` (RANGED — this is an archer, not melee) | act_goblinHero.txt:18 |

**Context — the goblin melee siblings:** `goblinWarrior` (`act_goblinWarrior.txt`, #name "goblinWarrior",
`#weapon: #goblinSword`, energy default, exp 2) is the cheap melee goblin; `goblinHammer`
(`act_goblinHammer.txt`) is NOT a character — it is a `#objPowerUp` WEAPON (a `#weaponMelee` attack,
`#animframe: 3`, power `point(0.2,0)`). The goblinHero / goblinArcher carry the ranged `#goblinBow`
instead. `friendlyGoblinHero` (`act_friendlyGoblinHero.txt`) is the identical archer on `#team: #village`
(`#minimapStatus: #clr`) — the allied counterpart.

**Animation strips (all exist in `assets.json`, keyed by #name "gar"):**

| Strip | Frames | Loop | Notes |
|-------|--------|------|-------|
| `gar_stand` | 1 | true | static idle |
| `gar_walk` | 6 | true | walk cycle (approach when out of reach) |
| `gar_weaponRanged` | **21** | false | attack strip; gates the shot at frame 21 (the LAST frame) |
| `gar_grave` | 2 | false | corpse |
| `gar_reel` | 4 | false | knockback flinch |

No `gar_die` strip → reel/death leads straight to grave (faithful; the archer has no death anim).

**Weapon: `#goblinBow` → `act_goblinBow.txt`**

| Field | Value | Source |
|-------|-------|--------|
| `#animType` | `#weaponRanged` (→ ranged FSM) | act_goblinBow.txt:8 |
| `#animframe` | **21** (single int → fires once/cycle at strip frame 21) | act_goblinBow.txt:7 |
| `#bullet` | `#goblinArrow` (sprite char "gobarrow") | act_goblinBow.txt:9 |
| `#reach` | **100 px** | act_goblinBow.txt:14 |
| `#cooldown` | **200** | act_goblinBow.txt:13 |
| `#dexterity` | 1 (weapon's own, overridden by character dexterity 10 as counter inc) | act_goblinBow.txt:11 |
| `#firingType` | `#fullstrength` (bullet speed = attacker strength ~10 px/tick) | act_goblinBow.txt:12 |
| `#collisionLoc` | `point(0,-2)` (arrow spawn offset) | act_goblinBow.txt:10 |
| `#sound` | "goblin_fire" | act_goblinBow.txt:16 |
| `#name` | `#goblinBow` | act_goblinBow.txt:15 |

**Bullet: `#goblinArrow` → `act_goblinArrow.txt`**

| Field | Value | Source |
|-------|-------|--------|
| `#character` / `#name` | `#bullet` / "gobarrow" (→ `gobarrow_fly` / `gobarrow_land`) | act_goblinArrow.txt:9,12 |
| `#attack.power` | 0.5 | act_goblinArrow.txt:8 |
| `#attack.damageMultiplier` | 3 | act_goblinArrow.txt:7 |
| `#friction` | `point(5,5)` | act_goblinArrow.txt:13 |
| `#weight` | 0.4 | act_goblinArrow.txt:15 |
| `#recordInRoomState` | false | act_goblinArrow.txt:14 |

**Cadence model (derived):** counter `tim[2] = cooldown = 200`, `inc = dexterity = 10`
(modWeaponManager.txt:171,193) → recovery ≈ 200/10 = 20 ticks. The original resets the cooldown at the
FIRING frame (animframe 21, ~20 ticks into the 21-frame delay-1 strip), so cadence = max(strip replay,
recovery + fire-frame offset) ≈ 40 ticks. Shot fires exactly once per cycle at strip frame 21
(`#animframe: 21`).

**Pre-level growth (derived):** `#startingLevel: 20` runs `repeat 1 to 20: levelUp`. `levelUpCharacter
AttackProperties` deterministically calls `incStrengthLevel` each level (`pStrengthIncLevel` default 0.1,
modCharacterAttackProperties.txt:72) → strength 8 + 20×0.1 = **10**. The random mana-stat bump per level is
irrelevant for a non-magic archer. `#experienceImWorth` is NOT raised by levelling (faithful note).

**AI behavior (`#objAiCPU`):** committed-target FSM (findTarget → moveToAttack to within reach 100 → face
→ fire at frame 21 → attackFin). Does NOT kite (`#runReload` not set), does NOT dodge bullets (not a
spellcaster). `#enemy` allegiance hunts the #goblins team's #hates (the #aldevar player).

---

## 2. Derive vs. REPRODUCED table

Each row verified by spawning the goblinHero and observing live port behavior.

| Property | Expected (original) | REPRODUCED (port) | Match? |
|----------|---------------------|-------------------|--------|
| `team` | `#goblins` | `#goblins` | ✓ |
| `type` | enemy CPU | enemy | ✓ |
| `energy` | 50 | 50 | ✓ |
| `strength` (post-level-20) | ~10 (8 + 20×0.1) | **~10** | ✓ |
| `maxSpeed` (walkSpeed×0.6) | 2.4 px/tick | 2.4 px/tick | ✓ |
| `dexterity` | 10 (ranged counter inc) | 10 (forwarded) | ✓ |
| `inertia` | 50 | 50 | ✓ |
| `damageSpeed` | 3 | **3** (forwarded — NOT the 5 default) | ✓ |
| `anim.char` (#name sprite) | "gar" | **"gar"** (NOT blackOrc) | ✓ |
| `gar_stand` / `gar_walk` strips | exist (1f / 6f) | found in assets | ✓ |
| `gar_weaponRanged` strip | exists (21f) | found in assets | ✓ |
| `gar_grave` / `gar_reel` strips | exist (2f / 4f) | found in assets | ✓ |
| `_die` strip | none (→ grave) | none | ✓ |
| `ranged` | true (#weaponRanged) | **true** | ✓ |
| `reachRanged` | 100 (goblinBow #reach) | **100** | ✓ |
| `runReload` | false | false | ✓ |
| `animFrame` | 21 (scalar) | **[21]** | ✓ |
| firing frame reached | 21 | maxFrameSeen = **21** | ✓ |
| **shots per attack cycle** | 1 (single firing frame 21) | **1** (5 shots / 220t, no dropped/extra) | ✓ |
| cadence (cd 200, dex 10, late frame 21) | ≈ 40t (recovery 20 + ~20 fire-frame offset) | **40t** (constant modal gap) | ✓ |
| `attackName` | `#goblinBow` | `#goblinBow` | ✓ |
| `firingType` | `#fullstrength` | `#fullstrength` | ✓ |
| throw speed | attacker strength (~10 px/tick) | strength-driven; bullet reaches target | ✓ |
| `bullet` | `#goblinArrow` | `#goblinArrow` | ✓ |
| `bulletChar` (#name) | "gobarrow" | **"gobarrow"** (NOT a flat dot) | ✓ |
| bullet reaches target (reach 100) | yes | yes (minDist **0.2px**) | ✓ |
| bullet damages target | yes (power 0.5 × mult 3) | yes (**54 dmg** over the burst) | ✓ |
| approach when out of reach (dist 140) | walk in to 100 | "walk" action observed; closes | ✓ |
| facing target | yes (target to the right) | facingLeft=false | ✓ |
| death → grave | grave (graveOn default true) | **grave** (anim.action="grave", graveOn=true) | ✓ |
| `dieSound` | `#none` | none | ✓ |
| `startingLevel` | 20 (deterministic strength growth) | 20× forceLevelUp applied post-build | ✓ |
| `experienceImWorth` | 100 (NOT raised by levelling) | 100 | ✓ |

---

## 3. DIVERGENCES

**NONE.** Every derived behavior reproduced faithfully in the live port.

> Note on the sibling cross-reference: the `skeletonArcher.md` / `archer.md` audits flag a port-wide
> `#damageSpeed` forwarding gap (they observed the 5 default instead of the data value). For goblinHero the
> probe observed `Movement.damageSpeed = 3` — the data value IS forwarded here (archetypes.ts:384
> `num("damageSpeed", 5)` reads the actor's `#damageSpeed: 3`). So that gap does NOT manifest for this actor.

---

## Candidate ORIGINAL-GAME quirks (FAITHFUL — do NOT "fix")

- **"Hero" is a ranged ARCHER, not a melee champion:** `goblinHero` carries `#goblinBow` (`#weaponRanged`),
  identical to `goblinArcher` except `#startingLevel: 20` + `#experienceImWorth: 100`. A faithful authoring
  choice (the "hero" is just a pre-levelled, higher-value elite archer). The port reproduces it as a ranged
  unit exactly.
- **`#animframe: 21` on a 21-frame strip:** the shot fires on the LAST frame of the attack strip. Combined
  with `#cooldown: 200` + `#dexterity: 10` this yields the slow ~40t cadence. Faithful; the port lands the
  single shot at frame 21.
- **`#weaponTechnique: -75`:** a NEGATIVE anim-speedup rating (slows the attack animation). Forwarded to
  WeaponTechnique (archetypes.ts:398); a faithful tuning value, not a bug.
- **`#startingLevel: 20` does NOT raise `#experienceImWorth`:** a pre-levelled hero is worth the same XP
  (100) as if fresh. Faithful per the original property note; port applies levels post-build without
  touching the XP reward.
- **No `#graveOn` in data:** relies on the modGrave default (true) → leaves a grave. Faithful.
- **Bow `#dexterity: 1`:** the weapon ships its own dexterity, but the cooldown-counter inc uses the
  CHARACTER's `#dexterity` (10), per modWeaponManager.txt:193. Faithful dead data; the port uses 10.

---

## Summary

| # | Property | Original | Port | Severity |
|---|----------|----------|------|----------|
| — | — | — | — | **No divergences** |

The goblinHero is reproduced **faithfully end-to-end**: #goblins team (hunts #aldevar), energy 50, strength
8→~10 via the deterministic `#startingLevel 20` growth, walkSpeed→2.4, dexterity 10, inertia 50, damageSpeed
3 (correctly forwarded), eyestrain 5, weaponTechnique -75; the "gar" sprite resolves to its REAL bundled
strips (stand/walk/weaponRanged/grave/reel — **no blackOrc fallback**); the ranged FSM with reach 100;
`#animframe 21` → **exactly 1 goblinArrow per cycle** at the last strip frame (no dropped/extra shots);
~40t cadence faithful to the cooldown-200 + dexterity-10 + late-fire-frame model; `#fullstrength` goblinArrow
fired as the "gobarrow" sprite that REACHES (minDist 0.2px) and DAMAGES (54 dmg) the target; walks in when out
of reach; faces the target; dies to a grave (graveOn default); experienceImWorth 100 unchanged by levelling.
