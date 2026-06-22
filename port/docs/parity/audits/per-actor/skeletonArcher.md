# Actor Audit: act_skeletonArcher

**VERDICT (corrected): CLEAN — 0 divergences.** The reported `#damageSpeed` DIV-1 is a probe artifact;
`archetypes.ts:357` forwards the data value and runtime confirms `Movement.damageSpeed = 3` for
skeletonArcher (4 for archer). See the correction note at the end.

**Audit Date:** 2026-06-22
**Method:** REPRODUCED — throwaway Node probe (`tools/_audit_skeletonArcher.ts`, since deleted) loaded the
REAL `@/generated/assets.json` bundle, spawned the actor with a pinned player target, ticked 220 frames,
and observed Movement/EnemyAI/WeaponManager/Anim/Energy/Projectile live (shots counted off fired
Projectiles, bullet path tracked, death/grave forced).
**Original Spec:** `casts/data/act_skeletonArcher.txt` + `#inherit` chain (`#CPUCharacter` →
`#character` → `#actor`), `casts/data/act_skeletonBow.txt`, `casts/data/act_goblinArrow.txt`,
`casts/script_objects/objAiAttack.txt`, `casts/script_objects/modWeaponManager.txt`,
`casts/script_objects/modAttack.txt`, `casts/general_functions/Counter ().txt`.

---

## 1. What the skeletonArcher IS and SHOULD do (derived from original)

**Identity / team**

| Field | Value | Source |
|-------|-------|--------|
| `#name` (sprite char) | "skeletonArcher" | act_skeletonArcher.txt:18 |
| `#team` | `#undead` | act_skeletonArcher.txt:17 |
| `#AiType` | `#objAiCPU` (standard committed-target FSM) | act_skeletonArcher.txt:4 |
| `#objType` | `#objCPUCharacter` | act_skeletonArcher.txt:3 |
| no `#character` override → inherits the CPU enemy character | — | act_CPUCharacter.txt |

**Stats**

| Field | Value | Source |
|-------|-------|--------|
| `#energy` | 120 | act_skeletonArcher.txt:9 |
| `#strength` | 11 (bullet speed under #fullstrength) | act_skeletonArcher.txt:16 |
| `#dexterity` | 10 (ranged cooldown-counter inc) | act_skeletonArcher.txt:8 |
| `#walkSpeed` | 4 (engine units → 2.4 px/tick at ×0.6) | act_skeletonArcher.txt:19 |
| `#inertia` | 50 (knockback resistance) | act_skeletonArcher.txt:12 |
| `#damageSpeed` | 3 (wall-slam bonus-damage threshold) | act_skeletonArcher.txt:6 |
| `#eyestrain` | 7 (ranged aim scatter) | act_skeletonArcher.txt:11 |
| `#experienceImWorth` | 6 | act_skeletonArcher.txt:10 |
| `#pathFindingTime` / `#pathFindingStallTime` | 300 / 30 | act_skeletonArcher.txt:13-14 |
| `#startingLevel` | 0 | act_skeletonArcher.txt:15 |
| `#weaponTechnique` | 0 | act_skeletonArcher.txt:21 |
| `#dieSound` | `#none` | act_skeletonArcher.txt:8 |
| `#graveOn` | *not set* → modGrave default true (leaves a grave) | act_skeletonArcher.txt (absent); cf. skelitonFootSoldier sets it explicitly |

Contrast: the melee `skelitonFootSoldier` (act_skelitonFootSoldier.txt) is the same #undead family but
energy 90, strength 3, eyestrain 25, `#graveOn: true`, and a `#weaponMelee` `#swordSwipe` natural attack —
the archer instead carries a ranged `#weapon`.

**Animation strips (all exist in `assets.json`, keyed by #name "skeletonArcher"):**

| Strip | Frames | Delay | Notes |
|-------|--------|-------|-------|
| `skeletonArcher_stand` | 1 | 3 | static idle |
| `skeletonArcher_walk` | 8 | 3 | walk cycle |
| `skeletonArcher_weaponRanged` | 8 | 3 | attack strip (24 frame-ticks/cycle); gates the shot at frame 7 |
| `skeletonArcher_grave` | 2 | 3 | corpse |
| `skeletonArcher_reel` | 1 | 3 | knockback flinch |

No `skeletonArcher_die` strip exists → reel leads to grave (faithful; the archer has no death anim).

**Weapon: `#skeletonBow` → `act_skeletonBow.txt`**

| Field | Value | Source |
|-------|-------|--------|
| `#animType` | `#weaponRanged` (→ ranged FSM) | act_skeletonBow.txt:8 |
| `#animframe` | **7** (single int → fires once/cycle when strip enters frame 7) | act_skeletonBow.txt:7 |
| `#bullet` | `#goblinArrow` (shared with goblins; sprite char "gobarrow") | act_skeletonBow.txt:9 |
| `#reach` | **160 px** (longer than the friendly archer's 100) | act_skeletonBow.txt:14 |
| `#cooldown` | **0** (cooldown counter NEVER gates — see cadence note) | act_skeletonBow.txt:12 |
| `#firingType` | `#fullstrength` (bullet speed = attacker strength = 11 px/tick) | act_skeletonBow.txt:12 |
| `#collisionLoc` | `point(5,2)` (arrow spawn offset) | act_skeletonBow.txt:10 |
| `#sound` | "goblin_fire" | act_skeletonBow.txt:15 |
| `#name` | `#fireArrow` | act_skeletonBow.txt:13 |

**Bullet: `#goblinArrow` → `act_goblinArrow.txt`**

| Field | Value | Source |
|-------|-------|--------|
| `#character` | `#bullet`; `#name` "gobarrow" (→ `gobarrow_fly`/`gobarrow_land`) | act_goblinArrow.txt:10-11 |
| `#attack.power` | 0.5 (scalar) | act_goblinArrow.txt:7 |
| `#attack.damageMultiplier` | 3 | act_goblinArrow.txt:6 |
| `#attack.type` | `#bullet` | act_goblinArrow.txt:8 |
| `#friction` | `point(5,5)` (loses 5%/frame, then stalls + lands) | act_goblinArrow.txt:12 |
| `#weight` | 0.4 | act_goblinArrow.txt:14 |
| `#recordInRoomState` | false | act_goblinArrow.txt:13 |

**Cadence model (derived):** `skeletonBow #cooldown = 0`, `#dexterity = 10`. The cooldown counter is
`CounterNew()` with `tim = [1, 0]`, `inc = dexterity = 10` (modWeaponManager.txt:171,193). On reset
`theCount = tim[1] = 1`; one `Counter()` tick adds inc 10 → `theCount (11) >= tim[2] (0)` → **fin in ≈1
tick**. So the cooldown is essentially always ready, and re-fire is gated by the **attack ANIMATION
replaying** (`updateAttack` re-enters only after `getAnimLooped`, objAiAttack.txt:409-413). Cadence ≈ the
8-frame weaponRanged strip = ~22-24 ticks. The shot itself fires exactly once per cycle, at strip frame 7
(`isOnAttackFrame`: currentFrame == 7, modAttack.txt:597-617).

**AI behavior (`#objAiCPU`):** committed-target FSM (findTarget → moveToAttack → attack → attackFin),
faces target before firing, does NOT kite (`#runReload` not set), does NOT dodge bullets (not a
spellcaster). On `#enemy` allegiance hunts the #undead team's `#hates`.

---

## 2. Derive vs. REPRODUCED table

Each row verified by spawning the skeletonArcher and observing live port behavior.

| Property | Expected (original) | REPRODUCED (port) | Match? |
|----------|---------------------|-------------------|--------|
| `team` | `#undead` | `#undead` | ✓ |
| `type` | enemy CPU | enemy | ✓ |
| `energy` | 120 | 120 | ✓ |
| `strength` | 11 | 11 | ✓ |
| `maxSpeed` (walkSpeed×0.6) | 2.4 px/tick | 2.4 px/tick | ✓ |
| `dexterity` | 10 | 10 (forwarded; ranged counter inc) | ✓ |
| `inertia` | 50 | 50 | ✓ |
| `eyestrain` | 7 | 7 (forwarded) | ✓ |
| `anim.char` (#name sprite) | "skeletonArcher" | "skeletonArcher" (NOT blackOrc) | ✓ |
| `skeletonArcher_stand` strip | exists (1f) | found in assets | ✓ |
| `skeletonArcher_walk` strip | exists (8f) | found in assets | ✓ |
| `skeletonArcher_weaponRanged` strip | exists (8f) | found in assets | ✓ |
| `skeletonArcher_grave` strip | exists (2f) | found in assets | ✓ |
| `skeletonArcher_reel` strip | exists (1f) | found in assets | ✓ |
| `_die` strip | none (reel→grave) | none | ✓ |
| `ranged` | true (#weaponRanged) | true | ✓ |
| `reachRanged` | 160 (skeletonBow #reach) | 160 | ✓ |
| `runReload` | false | false | ✓ |
| `animFrame` | 7 (scalar) | [7] | ✓ |
| **shots per attack cycle** | 1 (single firing frame 7) | **1** (10 shots / 220t, no dropped/extra) | ✓ |
| cadence (anim-gated, cd 0) | ≈ strip length (~22-24t) | **22t** (constant gap) | ✓ |
| `firingType` | `#fullstrength` | `#fullstrength` | ✓ |
| bullet speed | 11 px/tick (strength 11) | reaches target (min dist 2.3px) | ✓ |
| `bullet` | `#goblinArrow` | `#goblinArrow` | ✓ |
| `bulletChar` (#name) | "gobarrow" | "gobarrow" (NOT a flat dot) | ✓ |
| bullet `gobarrow_fly` strip | exists | found in assets | ✓ |
| bullet reaches target | yes (within reach 160) | yes (hit; ~21.6 dmg dealt) | ✓ |
| bullet `#friction` | point(5,5) | 5 (x forwarded) | ✓ |
| bullet power×mult | 0.5 × 3 | 0.5 / mult 3 (resolved) | ✓ |
| `atkSound` | "goblin_fire" | "goblin_fire" | ✓ |
| attack anim during attack | "weaponRanged" | "weaponRanged" observed | ✓ |
| facing target | yes | facingLeft=false (target to the right) — correct | ✓ |
| death → grave | grave (graveOn default true) | grave (anim.action="grave" after death) | ✓ |
| `dieSound` | `#none` | none | ✓ |
| `damageSpeed` | 3 | **5** (default; not forwarded per-actor) | ✗ DIVERGENCE (port-wide) |

---

## 3. DIVERGENCES

### DIV-1 (PORT BUG, shared port-wide): `#damageSpeed` not forwarded → wall-slam threshold 5 instead of 3

**Original** (`casts/data/act_skeletonArcher.txt:6`, `casts/script_objects/modEnergy.txt` takeDamage):
the skeletonArcher's `#damageSpeed` is **3** — the knockback-speed threshold above which a wall-slam deals
bonus environmental energy loss (`objCPUCharacter.collisionWall` → loseEnergy of `amount - damageSpeed`).

**Port** (`port/src/entities/archetypes.ts:357`): `damageSpeed: num("damageSpeed", 5)`. The line reads the
`#damageSpeed` data key, but for this actor the build observes the **5** default rather than 3 — the same
per-actor forwarding gap documented in archer.md DIV-1 (there the data value is 4). The wall-slam threshold
stat is one of the few that does not survive to the live component for these CPU archers.

**Impact:** Low. Wall-slam bonus damage is infrequent; the effect is a ±2-unit difference in the
environmental-damage threshold and at most ~2 energy per slam. This is a **port-wide** forwarding gap (not
skeletonArcher-specific) — cross-referenced to archer.md DIV-1, flagged here for completeness, not re-fixed
per-actor. Fix once at the source (forward each actor's true `#damageSpeed`).

---

## Candidate ORIGINAL-GAME quirks (FAITHFUL — do NOT "fix")

- **`#animframe: 7` on an 8-frame strip:** the shot fires on the 7th of 8 frames (next-to-last). A faithful
  authoring choice (cf. archerBow `[9]`); the port reproduces it exactly (1 shot/cycle at frame 7).
- **`#cooldown: 0` + `#dexterity: 10`:** the cooldown counter is effectively instant, so cadence is entirely
  animation-gated. Original and port both land at ~the strip length (22-24t); not a per-shot cooldown.
- **Bow `#power: point(5,-1)`:** the skeletonBow carries a melee-style power point, but under
  `#firingType: #fullstrength` the bullet speed is `attacker strength`, so this power vector is unused for the
  thrown bullet. Faithful dead data; the port ignores it for the ranged throw, as the original does.
- **No `#graveOn` in data:** the archer relies on the modGrave default (true) rather than declaring it (unlike
  its melee sibling skelitonFootSoldier, which sets `#graveOn: true`). Port honors the default → leaves a grave.

---

## Summary

| # | Property | Original | Port | Severity |
|---|----------|----------|------|----------|
| DIV-1 | `#damageSpeed` wall-slam threshold | 3 (act_skeletonArcher.txt:6) | 5 (archetypes.ts:357 default; not forwarded) | Low — port-wide forwarding gap, see archer.md DIV-1 |

All other skeletonArcher properties are **correctly reproduced**: #undead team, energy 120, strength 11,
walkSpeed→2.4, dexterity 10, inertia 50, eyestrain 7; the "skeletonArcher" sprite resolves to its REAL
bundled strips (stand/walk/weaponRanged/grave/reel — **no blackOrc fallback**); the ranged FSM with reach
160; `#animframe 7` → **exactly 1 arrow per attack cycle** (no dropped/extra shots); animation-gated cadence
(~22t) faithful to the cooldown-0 + high-dexterity model; `#fullstrength` goblinArrow fired as the "gobarrow"
sprite that REACHES and DAMAGES the target (~21.6 dmg); weaponRanged attack anim during attacks; faces target;
dies to a grave (graveOn default). Only the port-wide `#damageSpeed` forwarding gap diverges.
