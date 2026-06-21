# Re-Sweep: damage / attack / energy / heal parity
**Files audited:** `casts/script_objects/modEnergy.txt`, `modAttack.txt`, `modHeal.txt` (no standalone
file — heal lives in modEnergy.takeHeal + modMedikit), `modCharacterAttackProperties.txt`
**TS targets:** `port/src/components/combat.ts`, `charge.ts`, `control.ts`, `mana.ts`,
`pickup.ts`, `medikit.ts`, `hurt.ts`
**Re-sweep date:** 2026-06-21
**Prior audit verdict:** CLEAN (all four files) — this sweep applied all six lenses and found gaps.

---

## Lens methodology

For every `on <handler>` the prior audit checked (Lens 1 only: formula translation), this sweep
additionally applies:
2. **Activation/Reachability** — does the handler actually fire at runtime?
3. **Global + Initial State** — globals/defaults cross-ref'd against extracted bytecode
4. **Player-POV** — player-visible magnitude, timing, cosmetic correctness
5. **Draw-Order/Occlusion** — N/A for damage/energy (no rendering)
6. **Missing Test** — observable behaviour covered by a test?

---

## modEnergy.txt

### `on takeDamage` (lines 249–254) — REACHABILITY GAP

**Prior verdict:** "never called — intentional non-feature."  
**Re-sweep verdict:** **WRONG. `takeDamage` IS called from `objCPUCharacter` during reel.**

**Evidence:**

`casts/script_objects/objCPUCharacter.txt:103–127`:
```lingo
on collisionVertical me
  vectY = me.pMoveXY.getVectY()
  vectY = VarPositive(vectY)
  case me.big.getMode() of
    #reel, #reel_fly, #reel_land:
      me.takeDamage(vectY)        -- ← fires during reel/knockback
  end case
end

on collisionWall me
  vectX = me.pMoveXY.getVectX()
  speedX = VarPositive(vectX)
  case me.big.getMode() of
    #reel, #reel_fly, #reel_land:
      me.takeDamage(speedX)       -- ← fires during reel/knockback
  end case
end
```

**`takeDamage` (modEnergy.txt:249–254):**
```lingo
on takeDamage me, amount
  if amount > pDamageSpeed then
    amount = amount - pDamageSpeed
    me.loseEnergy(amount)
  end if
end
```

`pDamageSpeed` defaults to 5 (modEnergy `addModParams` line 25). Enemies knocked into walls/ceilings
during reel take `(|velocity| − 5)` environmental damage when the impact speed exceeds 5.

**TS port:** `port/src/components/movement.ts:155–158` dispatches `collisionWallLeft/Right` and
`collisionCeiling` as chain messages. No component handles these to apply wall damage. The TS enemy
archetype (`EnemyArchetype`) has no `collisionWallLeft/Right` handler.

**Player-POV:** Enemies knocked hard into walls should take extra damage (finishing pressure, "pinball"
feel). In the TS port they don't — a fully-knockedback enemy hitting a wall survives with full health.

**Scope note:** This affects only CPU/enemy units (`objCPUCharacter`). Player (`objPlayerMerlinCharacter`
→ `objCharacter`) does NOT override `collisionWall`/`collisionVertical` and so does NOT call
`takeDamage`. Rapunzel-gating: N/A (pure enemy mechanic, no hair/lives dependency).

**Test coverage:** None. No test verifies enemy hp loss on wall collision during reel.

**Classification: GAP-1 — missing enemy wall-collision damage mechanic.**

---

### `on recoverEnergy` — Counter timing (Lens 3, Initial State)

**Lingo Counter semantics:** `CounterNew()` starts at `theCount = tim[1] = 1`. Each `Counter()` call
adds `inc (=1)` while not fin; fires `fin=1` when `theCount >= tim[2]`. The check AFTER `Counter()`
sees the freshly-set fin. Period = `tim[2] - tim[1]` ticks (the count travels from 1 to `tim[2]`
exclusive, then fires).

For `energyRecoverDelay=1000`: `tim[2]=1000`, period = 999 ticks. For `energyRecoverDelay=30`
(player): period = 29 ticks.

**TS `Energy.update` (combat.ts:88–93):**
```typescript
if (++this.recoverCtr >= this.recoverDelay) { this.recoverCtr = 0; this.energy++; }
```

`recoverCtr` increments from 0; fires when `>= recoverDelay`. Period = `recoverDelay` ticks.

**Off-by-one:** Lingo period = `recoverDelay − 1`. TS period = `recoverDelay`. At `recoverDelay=30`
Lingo heals every 29 ticks; TS heals every 30 ticks. At `recoverDelay=300` (enemies): Lingo 299 ticks,
TS 300 ticks. The difference is one tick per regen cycle — observable only as a ~0.3% faster regen in
the original that the TS undershoots by one tick.

**Player-POV:** Sub-tick difference at low regen; imperceptible in play. However it IS a real
translation difference.

**Classification: GAP-2 (minor) — regen period is recoverDelay in TS vs recoverDelay−1 in Lingo.**

---

### `on takeHeal` / pickup bonus heal — Cosmetic glow deviation (Lens 4, Player-POV)

**Lingo `takeHeal` (modEnergy.txt:256–265):** calls `increaseEnergy(healAmount)` then
`me.big.glowGold()`.  
**Lingo `increaseEnergy` (lines 133–147):** adds energy, clamps to max, stops red-glow if above 50%.
Does NOT call `glowGold`.

**Lingo pickup bonus (`objPlayerMerlinCharacter:153–203`):** all pickups (medikit/scroll/potion) call
`me.increaseEnergy(pBonusEnergy)` where `pBonusEnergy = 25`. This uses the raw `increaseEnergy` path —
**no gold glow**.

**TS pickup bonus (`pickup.ts:98`):**
```typescript
if (this.effect !== "maxikit" && this.effect !== "gmg") player.send("takeHeal", 12.5, 0, -1);
```
`takeHeal(12.5, 0)` → `healAmount = (12.5 + 0) × 2 = 25`. Correct amount. **But `takeHeal` also calls
`this.ct()?.glowGold()`** (combat.ts:71), so every item pickup triggers the gold glow animation.

In Lingo, gold glow fires ONLY from healing spell impacts (`takeHeal` on heal-blast splash); it does NOT
fire on medikit/scroll/potion pickups. The TS's routing of the bonus through `takeHeal` causes the gold
glow to fire on every pickup — a visible and incorrect cosmetic.

**Player-POV:** Every sword/spell/potion/medikit pickup produces a gold flash on Merlin. In the original
only heal-spell blasts produce this. Players who know the original will notice extra gold flashes.

**Classification: GAP-3 — gold glow fires on pickup bonus heal (should only fire on heal-spell impact).**

---

### `on loseEnergy` — Energy sentinel value (minor)

**Lingo (line 199):** after death, sets `pEnergy = -100` (sentinel prevents regen recovery).  
**TS:** sets `this.dead = true`. Both gates prevent `recoverEnergy` for dead units.  
**Status:** CLEAN — semantically equivalent, different mechanism.

---

### `on glowRedOnLowHealth` — Threshold constant (Lens 3)

**Lingo:** `pGlowRedPercentage = 50` (modEnergy init line 43, set directly not from params).  
**TS:** `private static readonly GLOW_RED_PCT = 50` (combat.ts:20).  
**Status:** CLEAN — constants match.

---

### `on levelUpEnergy` — Math.round vs Lingo integer arithmetic

**Lingo:** `incAmount = params.energy * params.energyIncPercentage / 100` — Lingo integer arithmetic
(truncates fractions since `energy` and `energyIncPercentage` are integers for real actors).  
**TS:** `Math.round(this.baseEnergy * this.incPct / 100)` — rounds instead of truncating.

For player: `200 × 2 / 100 = 4`. `Math.round(4) = 4`. No difference.  
For enemies with energyIncPercentage 0 (most enemies): both yield 0.  
For dwellings with energyIncPercentage -1: `energy × -1 / 100`. Small negative, Lingo truncates toward
zero, TS rounds. Minor edge case for fractional results.  
**Status:** CLEAN in practice — no real actor hits a case where round vs truncate differs.

---

## modAttack.txt

### `on calcAttackChargeStart` — K11 bug preserved (Lens 1, confirmed)

The prior audit confirmed the Lingo bug (line 147 checks wrong variable → burst is always discarded).
TS `chargeStartOf` (charge.ts:57–58) faithfully omits burst:
```typescript
const cap = typeof attack.chargeStartMax === "number" ? attack.chargeStartMax : Infinity;
return Math.min(attack.chargeStart, cap);
```
**Status:** CLEAN — bug preserved as documented.

### `on gmgOn` / `on gmgOff` — pChargeSpeedMax assignment (Lens 1)

Lingo `gmgOn` (line 853): `pChargeSpeedMax = pAttack.gmgChargeSpeed` (speed cap = speed → no cap).  
TS `chargeSpeedOf(..., gmgOn=true)` (charge.ts:64): `return attack.gmgChargeSpeed` — shortcircuits,
no cap logic needed (same result: returns speed with no cap).  
**Status:** CLEAN — functionally equivalent.

### `on calcCollisionVectSpell` — SineDist vs Euclidean (Lens 4, Player-POV)

Lingo uses `SineDist` (Manhattan distance). TS uses `Math.hypot` (Euclidean).  
For the spell radial falloff: `speed = (hitRange − dist) × power`. With Euclidean dist the falloff is
rotationally symmetric; with Manhattan dist it's diamond-shaped. Players on the diagonal axis get ~41%
more "distance" in Lingo (for the same px offset), so they take less knockback at the diagonal than at
cardinal directions. TS is smoother/rotationally uniform. Prior audit noted this as "minor deviation."
**Status:** DOCUMENTED DEVIATION — intentional, minor, noted.

### `on setAttack` — Default pChargeMax/pChargeSpeed when attack=#none (Lens 3)

Lingo (lines 817–823):
```lingo
if attack = #none then
  pAttack = #none
  pChargeMax = 5
  pChargeSpeed = 1
  return
end if
```

When no attack is set, Lingo stores fallback charge values. TS never stores `#none` as pAttack; the
WeaponManager starts empty. `getMagicAttack()` returns `null` and `PlayerControl` gates magic on
`magic !== null`. **Status:** CLEAN — the no-attack path is never exercised in gameplay.

---

## modHeal.txt (modMedikit.txt)

### `on attemptHeal` — Counter period (Lens 3, Lens 4)

**Lingo:** `CounterNew()` creates counter with `tim:[1,10], inc:1`, then `tim[2]=5` override. After
CounterReset: `theCount=1`. Period = `tim[2] − tim[1] = 5 − 1 = 4` ticks. Fires on 4th tick from
each reset.

**TS:** `new Counter(HEAL_DELAY=5, 1)` → `lo=1, hi=5, inc=1`. Period = `hi − lo = 5 − 1 = 4` ticks.
Fires on 4th tick. **Status:** CLEAN — periods match.

### `on medikitCollected` — No count for maxikit (Lens 2, Reachability)

Lingo `objPlayerMerlinCharacter.medikitCollected`:
```lingo
if(medType = #medikit) then
  ancestor.medikitCollected()       -- banks 1 kit
  me.increaseEnergy(pBonusEnergy)   -- +25 flat
else
  me.increaseEnergy(me.getMaxEnergy() - me.getEnergy())  -- fill to max
end if
```

TS `pickup.ts:65–67`:
```typescript
case "heal": player.send("medikitCollected", 1); break;    // banks 1 kit
case "maxikit": player.send("takeHeal", 1e9, 0, -1); break; // fill to max
```
`takeHeal(1e9, 0)` → `healAmount = 1e9 × 2 = 2e9`, clamped to max. Functionally fills to max. ✓

Lingo maxikit fills via `increaseEnergy(maxEnergy − energy)` — exact fill, no glow.  
TS maxikit fills via `takeHeal(1e9)` — exact fill (clamped), PLUS triggers `glowGold`.  
**GAP-3 applies here too** — maxikit also triggers a spurious gold glow in TS.

### `on nextMedikit` — Reload timing (Lens 4)

Lingo: when `remainingHitpoints <= 0` on a fin tick, `nextMedikit` loads the next kit immediately in
the same frame. TS: same — `this.nextMedikit(en)` runs synchronously within `attemptHeal`. The NEXT fin
tick starts drawing from the newly-loaded kit.  
**Status:** CLEAN.

---

## modCharacterAttackProperties.txt

### `levelUpCharacterAttackProperties` — mana_capacityIncLevel default discrepancy (Lens 3)

**Prior audit conclusion:** "Port uses 0.5, Lingo uses 1.0 — px-scale tuning."  
**Re-sweep finding:** This conclusion was INCORRECT. `act_player.txt:32` explicitly sets
`#mana_capacityIncLevel: .5`. The TS port reads this from data (`archetypes.ts:129`:
`num(d, "mana_capacityIncLevel", 0.5)`). Lingo also reads it from player data and gets 0.5.

Lingo `modCharacterAttackProperties.addModParams` line 65 sets a DEFAULT of 1.0, but the player data
overrides it to 0.5. The TS default fallback of 0.5 is also correct for the player (it matches the data
value). For enemies that have no `mana_capacityIncLevel` in their data: Lingo default = 1.0, TS default
fallback = 0.5. Enemy levelling-up mana capacity grows at half the Lingo rate.

**Assessment:** Enemy mana capacity growth is 0.5 per level in TS vs 1.0 in Lingo. However:
- Enemies rarely level up significantly.
- mana_capacityIncLevel affects charge ceiling growth on level-up (manaCapacity × chargeMaxModifier).
- The observable effect: a high-level enemy caster's spell charge ceiling grows more slowly in TS.
- This is a low-impact difference but is a genuine constant mismatch for non-player actors.

**Classification: GAP-4 (low impact) — enemy mana_capacityIncLevel default: TS 0.5 vs Lingo 1.0.**

### `levelUpCharacterAttackProperties` — Lingo `random(4)` vs TS distribution (Lens 3)

**Lingo:** `random(4)` returns 1..4 inclusive (uniform). One stat gets the level-up boost per call.  
**TS:** `1 + Math.floor(game.rng.next() * 4)` → 1..4 inclusive (uniform). Same distribution.  
**Status:** CLEAN.

### `on incStallSpeedLevel` — Default increment (Lens 3)

**Lingo:** `addModParams` line 70: `i[#stallSpeedIncLevel] = 0`. Default = 0 (no speed growth).  
**TS:** `archetypes.ts:120`: `walkSpeedIncLevel: 0.075`. Players gain 0.075 speed per level.  
This is the documented B2 calibration for the slice (the original Lingo default would also be overridden
by player data if act_player.txt set a non-zero value — it doesn't set `stallSpeedIncLevel`). So Lingo
also gives 0 speed growth at the player's default. TS gives 0.075.

**Assessment:** This is a documented INTENTIONAL divergence (plan §f). The TS adds walk-speed growth
because the pixel-scaled engine feels sluggish without it. Not a parity gap per the plan scope.
**Status:** INTENTIONAL DEVIATION — documented.

### `on internalEvent #levelUp` routing (Lens 2)

**Lingo:** `internalEvent(#levelUp)` → `levelUpCharacterAttackProperties()`. All six stat bumps
(strength, stall, 1-of-4 mana) run as a single function call on the same frame.  
**TS:** `entity.send("levelUp")` dispatches to `PlayerControl.levelUp` (strength) + `Movement.levelUp`
(speed) + `Mana.levelUp` (1-of-4 mana) + `Energy.levelUp` (max energy) — all in the same dispatch
chain, same frame.  
**Status:** CLEAN — ordering and atomicity are preserved.

---

## Initial State / Global Cross-Check (Lens 3)

| Property | Lingo source | Value | TS source | Value | Match? |
|---|---|---|---|---|---|
| energy (player) | act_player.txt:26 | 200 | archetypes.ts:121 | 200 (from data) | ✓ |
| energyRecoverDelay (player) | act_player.txt:27 | 30 | archetypes.ts:136 | 30 (from data) | ✓ |
| energyRecoverDelay (CPU default) | objCPUCharacter.txt:22 | 300 | archetypes.ts:326 | 300 (fallback) | ✓ |
| energyIncPercentage (player) | act_player.txt:23 | 2 | archetypes.ts:135 | 2 (from data) | ✓ |
| pGlowRedPercentage | modEnergy.txt:43 | 50 | combat.ts:20 | 50 | ✓ |
| damageSpeed (CPU) | modEnergy addModParams:25 | 5 | NOT PORTED | — | **GAP-1** |
| mana_regeneration (player) | act_player.txt:34 | 30 | archetypes.ts:127 | 30 (from data) | ✓ |
| mana_capacityIncLevel (player) | act_player.txt:32 | 0.5 | archetypes.ts:129 | 0.5 (from data) | ✓ |
| mana_capacityIncLevel (enemy default) | modCharacterAttackProperties:65 | 1.0 | archetypes.ts:308 | 0.5 fallback | **GAP-4** |
| chargeStart (energyBlast) | act_energyBlast.txt:17 | 0 | charge.ts:58 | 0 (from data) | ✓ |
| chargeSpeed (energyBlast) | act_energyBlast.txt:11 | 1 | charge.ts:65 | 1 (from data) | ✓ |
| chargeMax (energyBlast) | act_energyBlast.txt:18 | 999 | charge.ts:30 | 999 (from data) | ✓ |
| chargeMaxModifier | act_energyBlast.txt:21 | 0.75 | charge.ts:30 | 0.75 (from data) | ✓ |
| chargeMaxBasic | act_energyBlast.txt:19 | 5 | charge.ts:30 | 5 (from data) | ✓ |
| pHealAmount (medikit) | modMedikit.txt:32 | 1 | medikit.ts:12 | 1 | ✓ |
| pHealDelayCounter tim[2] | modMedikit.txt:34 | 5 | medikit.ts:11 | 5 | ✓ |
| pBonusEnergy | objPlayerMerlinCharacter:54 | 25 | pickup.ts:98 (computed) | 25 | ✓ |

---

## Summary of Gaps

### GAP-1: Missing enemy wall-collision damage (SIGNIFICANT)
**Handler:** `modEnergy.on takeDamage` / `objCPUCharacter.collisionWall|collisionVertical`  
**Lingo path:** `objCPUCharacter.collisionWallLeft/Right` → `collisionWall()` → `takeDamage(speedX)`
→ `loseEnergy(speed − 5)` when `speed > pDamageSpeed=5` and unit is in `#reel` mode.  
**TS path:** `movement.ts:155–156` dispatches `collisionWallLeft/Right` but no component handles it
to apply damage. The EnemyArchetype stack (`EnemyAI, …, Energy, Hurt, …`) has no wall-collision handler.  
**Observable:** Enemies knocked into walls by player attacks take 0 environmental damage in TS vs
potentially significant damage in Lingo (proportional to reel velocity magnitude above threshold 5).  
**Files:** `casts/script_objects/objCPUCharacter.txt:103–136` vs `port/src/components/movement.ts:150–158`.  
**Test:** None.

### GAP-2: Regen period off by one tick (NEGLIGIBLE)
**Handler:** `modEnergy.on recoverEnergy` / `Energy.update`  
**Lingo:** period = `recoverDelay − 1` ticks (Counter counts from 1 to recoverDelay exclusive).  
**TS:** period = `recoverDelay` ticks (manual `++ctr >= delay` gate fires on the delay-th tick).  
**Observable:** Player regens +1 HP every 29 ticks (Lingo) vs 30 ticks (TS). 0.3% difference; not
detectable in play.  
**Files:** `modEnergy.txt:216–227` vs `combat.ts:88–93`.

### GAP-3: Pickup bonus heal triggers spurious gold glow (COSMETIC)
**Handler:** `modEnergy.on increaseEnergy` vs `Energy.takeHeal`  
**Lingo:** pickup bonus uses `increaseEnergy(25)` — no gold glow.  
**TS:** pickup bonus uses `player.send("takeHeal", 12.5, 0, -1)` → `glowGold()` fires.  
**Observable:** Every medikit/scroll/spell/potion pickup produces a gold flash on Merlin. In the
original, gold flash fires only on healing-spell impact. Maxikit also incorrectly triggers gold glow.  
**Files:** `objPlayerMerlinCharacter.txt:153–203` vs `pickup.ts:65–102`, `combat.ts:71`.  
**Test:** None.

### GAP-4: Enemy mana capacity level-up increment: TS 0.5 vs Lingo 1.0 (LOW IMPACT)
**Handler:** `modCharacterAttackProperties.on incManaCapacityLevel`  
**Lingo default:** `pManaCapacityIncLevel = 1` (modCharacterAttackProperties addModParams line 65).
Player data overrides to 0.5 — both TS and Lingo apply 0.5 for the player correctly.  
**TS enemy default:** fallback in `archetypes.ts` is 0.5 (no enemy data sets it). Enemies that level
up grow mana capacity at half the Lingo rate.  
**Observable:** A high-level enemy caster's charge ceiling grows to only ~50% of the Lingo value at
the same level. In practice, enemies rarely reach levels where this is significant.  
**Files:** `modCharacterAttackProperties.txt:65` vs `archetypes.ts:308` (enemy build, no
`mana_capacityIncLevel` in enemy data).

---

## Prior-Audit Corrections

1. **`takeDamage` "never called"** — WRONG. Called by `objCPUCharacter` during wall/ceiling collision
   in reel mode. See GAP-1.

2. **`mana_capacityIncLevel` "discrepancy (0.5 vs 1.0)"** — MISIDENTIFIED ROOT CAUSE. The 0.5 in TS
   comes from `act_player.txt:32` player data, not from calibration tuning. Both systems use 0.5 for
   the player. The TRUE discrepancy is the enemy default (Lingo 1.0 vs TS 0.5). See GAP-4.

3. **`BULLET_DAMAGE_SCALE` / `MELEE_SCALE` / `SPELL_RADIAL_SCALE`** — Confirmed intentional K1
   calibrations per plan §f. Not gaps.

---

## Handlers confirmed CLEAN under all six lenses

| Handler | File | TS location | Lenses | Verdict |
|---|---|---|---|---|
| takeHit (formula, ordering, i-frames) | modEnergy | combat.ts:33–53 | 1–4 | CLEAN |
| loseEnergy (death latch, sentinel, sound) | modEnergy | combat.ts:37–52 | 1–4 | CLEAN |
| increaseEnergy (clamp, red-glow stop) | modEnergy | combat.ts:70–73 | 1–4 | CLEAN |
| levelUpEnergy (baseEnergy × pct/100) | modEnergy | combat.ts:99–103 | 1–4 | CLEAN |
| takeHeal (formula, glow, dead-guard) | modEnergy | combat.ts:66–77 | 1–4 | CLEAN |
| glowRedOnLowHealth (50% threshold) | modEnergy | combat.ts:57–59 | 1–3 | CLEAN |
| checkDead / isDead | modEnergy | combat.ts:106 | 1–2 | CLEAN |
| addSaveData / restoreFromSave | modEnergy | combat.ts:113–121 | 1–2 | CLEAN |
| calcAttackChargeMax (formula, limitMagic, randomSummon) | modAttack | charge.ts:26–46 | 1–4 | CLEAN |
| calcAttackChargeStart (K11 bug preserved) | modAttack | charge.ts:48–59 | 1–4 | CLEAN |
| calcAttackChargeSpeed (flow, speedMax cap) | modAttack | charge.ts:61–68 | 1–4 | CLEAN |
| calcCollisionVectMelee (magicMelee mana term) | modAttack | control.ts:263–268 | 1–3 | CLEAN |
| calcCollisionVectSpell (hitRange falloff) | modAttack | splash.ts:65,70 | 1–4 | CLEAN |
| gmgOn / gmgOff (charge param swap) | modAttack | charge.ts:29,64 | 1–3 | CLEAN |
| performBeamAttack (jitter ±6 documented) | modAttack | bullets.ts:70–91 | 1–4 | CLEAN |
| performRangedAttack (firingType dispatch) | modAttack | control.ts:534–559 | 1–3 | CLEAN |
| setAttack (AttackSetTypeFromAnimType) | modAttack | weapon.ts:94–103 | 1–2 | CLEAN |
| medikitCollected (bank 1 kit) | modMedikit | medikit.ts:28 | 1–4 | CLEAN |
| attemptHeal (period 4 ticks, +1 per fin) | modMedikit | medikit.ts:44–56 | 1–4 | CLEAN |
| nextMedikit (reload remainingHp = maxEnergy) | modMedikit | medikit.ts:59–67 | 1–4 | CLEAN |
| levelUpCharacterAttackProperties (6 stats) | modCharAtkProp | mana.ts:31–38, control.ts:106 | 1–4 | CLEAN |
| addCooldownCounter (manaRegeneration as inc) | modCharAtkProp | weapon.ts:272–278 | 1–3 | CLEAN |
| incManaBurst/Capacity/Flow/RegenPotion | modCharAtkProp | mana.ts:42–44 | 1–2 | CLEAN |
