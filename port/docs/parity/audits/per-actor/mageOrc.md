# Behavioral Audit: act_mageOrc

**Actor:** mageOrc  
**Source:** `casts/data/act_mageOrc.txt`  
**Inheritance:** `act_mageOrc → #CPUCharacter → #character → #actor`  
**AiType:** `#objAiCPUSpellCaster` (→ `objAiAttack` → `objAiCPU`)  
**Team:** `#orcs`  

Summon-caster. Uses `#goblinSummon` — a multistage magic spell that spawns goblin-type units via `#explodeFunction: #summonUnit`. The tier summoned depends on how much charge the caster accumulates before releasing.

---

## 1. Derived Correct Behavior (Original)

### Identity

| Property            | Value             |
|---------------------|-------------------|
| team                | #orcs             |
| energy              | 300               |
| strength            | 1                 |
| walkSpeed           | 4 (→ 2.4 px/tick in port: ×0.6) |
| inertia             | 65                |
| dexterity           | 1                 |
| mana_capacity       | 31                |
| mana_flow           | 1.5               |
| mana_capacityIncLevel | 1.5             |
| damageSpeed         | 4                 |
| stallSpeed          | 0.5               |
| experienceImWorth   | 30                |
| chargeOffsetSide    | #top              |
| chargeLoc           | point(0,-16)      |

### Weapon: #goblinSummon

| Property           | Value                                          |
|--------------------|------------------------------------------------|
| #animType          | #magic                                         |
| #animframe         | #none (no discrete firing frame)               |
| #explodeFunction   | #summonUnit                                    |
| #randomSummon      | true (tier wobbles per cast via rng)           |
| #chargeMax         | 37                                             |
| #chargeStart       | 0                                              |
| #chargeSpeed       | 0.4                                            |
| #cooldown          | 15 (weapon cooldown; full cadence is longer)   |
| #reach             | 9999                                           |
| #hits              | [#teamMembers]                                 |
| #residentTeamCategory | #enemies                                  |
| #multistage tiers  | goblinWarrior:15, goblinArcher:17, goblinMage:20, bowOrc:25, swordOrc:30, mageOrc:34, blackOrc:36 |

**Effective tier with mana_capacity=31:**  
`chargeMaxOf` formula: `min(chargeMax=37, mana_capacity×1 + 0) = min(37, 31) = 31`  
→ charge ceiling = 31 → tier = **swordOrc** (threshold 30, below mageOrc=34).

With `#randomSummon: true` the tier wobbles: the rng can pull the ceiling down, so casts may produce bowOrc (25) or goblinMage (20), etc.

### Attack sequence (original: `objAiCPUSpellCaster`)

1. When cooled and in optimum position, call `chargeMagic()`.
2. `ensureSpell()` creates a live spell object over the caster's head; `chargeSpell()` charges it each tick.
3. When charge ≥ some threshold, `#spellCharged` event → `releaseMagic()`.
4. Spell flies from caster, explodes, `#summonUnit` spawns the tier unit.
5. Because `#animframe: #none`, there is no discrete "firing frame"; the summon fires on release.

### Animations (from `assets.json`)

| Action       | Strip key            | Frames | Loop  | Present |
|--------------|----------------------|--------|-------|---------|
| stand        | mageOrc_stand        | 1      | —     | yes     |
| walk         | mageOrc_walk         | 8      | true  | yes     |
| charge       | mageOrc_charge       | 4      | true  | yes     |
| chargeWalk   | mageOrc_chargeWalk   | 8      | true  | yes     |
| release      | mageOrc_release      | 3      | false | yes     |
| releaseWalk  | mageOrc_releaseWalk  | 7      | true  | yes     |
| grave        | mageOrc_grave        | 2      | —     | yes     |
| die/death/reel | (none expected)    | —      | —     | absent (correct) |

`mageOrc_release` frame delays: [2, 3, 3] = 8 game ticks total.

### AI mode (original: `objAiCPUSpellCaster.updateMoveToOptimumPosition`)

- Prioritise dodging incoming bullets (tangent flee).
- If too close to enemy, flee to `pEnemySafeDistance=100`.
- If target in reach (9999) and cooled: attack (cast).
- Otherwise: approach target.

### Death / grave

Standard `#CPUCharacter` death: holds grave strip at last energy=0; no reincarnation.

---

## 2. Reproduced in Port (Observed)

Probe: `port/tools/_audit_mageOrc.ts` — spawned mageOrc + player target, ticked 300 frames with real assets loaded, instrumented per-tick.

### Data resolution

| Property          | Expected       | Observed                     | OK? |
|-------------------|----------------|------------------------------|-----|
| energy            | 300            | 300                          | yes |
| maxSpeed (walk)   | 2.4            | 2.4 (mv.maxSpeed)            | yes |
| inertia           | 65             | 65                           | yes |
| mana capacity     | 31             | 31                           | yes |
| mana flow         | 1.5            | 1.5                          | yes |
| team              | orcs (enemy)   | enemy                        | yes |
| dodgesBullets     | true           | true                         | yes |
| ranged            | true           | true                         | yes |
| runReload         | true           | true                         | yes |
| weapon reach      | 9999           | 9999                         | yes |
| cooldown          | 15+release     | ~34 ticks                    | yes |
| attackFrames      | [] (#none)     | []                           | yes |
| chargeMaxOf(31)   | 31 → swordOrc  | 31 → swordOrc                | yes |

### Animation strips

All required strips resolve to real bundled assets (`mageOrc_<action>`). No fallback to blackOrc or missing strip for the caster itself.

### Attack behavior (300-tick simulation)

Per-tick trace of first attack cycle:
```
[t=2]  attackT=10 attackFired=false  animAction=release frame=0 justLooped=false
[t=3]  attackT=9  attackFired=false  animAction=release frame=1 justLooped=false
[t=4]  attackT=8  attackFired=false  animAction=release frame=1 justLooped=false
[t=5]  attackT=7  attackFired=false  animAction=release frame=1 justLooped=false
[t=6]  attackT=6  attackFired=false  animAction=release frame=2 justLooped=true
       → updateAttack: an.looped()=true → attackFin() called, RETURN
       → performAttack() was NEVER called → no summon fired
```

Entity count after 300 ticks: **unchanged** (zero summons).

Direct call `summonUnit(ca, 31, 430, 200, mage.id)` outside the attack path: **works** — spawns a swordOrc. The summon infrastructure is correct; only the dispatch is broken.

### Summon tier wobble

`chargeMaxOf(ca, mana, game.rng)` with `#randomSummon=true` uses `game.rng` to wobble the tier. The wiring is present in `performAttack` (line 776 in control.ts). However, since `performAttack` is never reached (see DIVERGENCE-1), this is moot in practice.

### goblinArcher sprite (summon tier)

`goblinArcher` is multistage tier at charge=17. It has **zero** bundled animation strips. `spriteCharOr("goblinArcher")` resolves via `CHAR_ALIAS["goblinArcher"] = "archer"` → renders as "archer". Cosmetic fallback, not a crash. Unobservable in practice while DIVERGENCE-1 prevents any summons.

---

## 3. Divergences

### DIVERGENCE-1: mageOrc never summons (critical)

**Original behavior** (`casts/script_objects/objAiAttack.txt`):  
Magic casters use the `chargeMagic` → live spell object → `releaseMagic` pathway. The summon fires when the spell explodes, independent of any `#animframe` crossing. `isOnAttackFrame()` explicitly returns false for `#animframe: #none`; the summon is never gated on a frame event.

**Port behavior** (`port/src/components/control.ts`, `updateAttack`, line 716–727):  
All CPU attackers share `updateAttack`, which is animation-driven:
- `attackFrames = []` (from `#animframe: #none`, `weapon.ts` line 181).
- `attackAnimates = true` (release strip has 3 frames > 1).
- The loop: if `an.frameFresh() && attackFrames.includes(frame)` → never fires (empty array).
- If `an.looped()` → `attackFin()` is called immediately and the function returns (line 721).
- The `attackT <= 0` fallback (line 723) is never reached.

Result: `performAttack` is never called. No `summonUnit` call. No unit is ever spawned. The mageOrc attacks on cooldown (release animation plays), but the summon does not happen.

**Evidence:**  
- `casts/data/act_goblinSummon.txt`: `#animframe: #none`  
- `port/src/components/weapon.ts` line 181: `typeof afRaw === "string" ? []` → `animFrame = []`  
- `port/src/components/control.ts` line 720: frame-hit check never fires (empty attackFrames)  
- `port/src/components/control.ts` line 721: `an.looped()` fires at release frame 2 (tick 6 of 10-tick window), exits before `attackT <= 0`  
- Observed: entity count unchanged after 300 ticks; direct `summonUnit()` call works

**Fix sketch:**  
In `updateAttack` (control.ts line 721), fire `performAttack` before `attackFin` when the animation completes and no shot was fired yet:

```typescript
// BEFORE:
if (an.looped()) { this.attackT = 0; this.attackFin(m); return; }

// AFTER:
if (an.looped()) {
  if (!this.attackFired) this.performAttack(m);  // fire on strip-end for #animframe:#none
  this.attackT = 0; this.attackFin(m); return;
}
```

This preserves existing behavior for all other weapon types (melee/ranged with explicit animFrames fire on the correct frame and set `attackFired=true` before `looped()` is seen).

---

### DIVERGENCE-2: goblinArcher summon tier has no art (cosmetic)

**Original:** `goblinArcher` is a valid summon tier (charge threshold 17). In the original engine it has its own sprite sheet.

**Port:** `goblinArcher` has zero entries in `port/src/generated/assets.json`. `spriteCharOr("goblinArcher")` falls back through `CHAR_ALIAS` to `"archer"` (not `"blackOrc"` as initially suspected). The archer sprite exists and is used, so it does not crash. However, it is not the correct art for a `goblinArcher`.

**Evidence:**  
- `port/src/generated/assets.json`: no `goblinArcher_*` keys  
- `CHAR_ALIAS["goblinArcher"] = "archer"` (archetypes.ts or assets resolution)

**Fix sketch:** Add goblinArcher sprite strips to the asset bundle, or confirm the archer alias is an intentional shared-art decision.

**Note:** DIVERGENCE-2 is unobservable while DIVERGENCE-1 prevents all summons.

---

## Summary

| # | Divergence | Severity |
|---|------------|----------|
| 1 | `updateAttack` exits via `an.looped()` before `performAttack` for `#animframe:#none` weapons — mageOrc (and any other CPU summon/magic caster with a one-shot release strip and no explicit animframe) **never fires** | critical |
| 2 | `goblinArcher` summon tier uses fallback "archer" art instead of its own sprite sheet | cosmetic |
