# Re-Sweep Audit: AI FSM + CPU Character (Six-Lens, Second Pass)

**Target files:** `casts/script_objects/objAiAttack.txt`, `objAiCPUSpellCaster.txt`, `objAiCPU.txt` (reference), `objCPUCharacter.txt`  
**TS port:** `port/src/components/control.ts` (CpuAI, PlayerControl), `movement.ts`, `combat.ts`, `hurt.ts`  
**Date:** 2026-06-21  
**Prompt:** Six-lens re-audit. Focus: objAiAttack magic charge/release dispatch, objAiCPUSpellCaster optimumPosition/bullet-dodge, objCPUCharacter collision/mode handlers, constants/timing/branch mistranslations. Excludes: wall-collision damage (already known/deferred), Rapunzel, dev tooling.

---

## Scope Recap: What Was Already Covered

The first-pass audits (`modAi.md`, `objAiCPU.md`, `objAiAttack.md`, `objAiCPUSpellCaster.md`, `objCPUCharacter.md`) covered:
- Core FSM transitions (findTarget/moveToAttack/runReload/dazed/optimumPosition)
- Retarget cadence (30 frames) — confirmed correct
- Reel-freeze / recovery paths — confirmed correct after GAP fix
- optimumPosition priority chain (bullet-dodge → flee → approach → idle) — confirmed correct
- Safe-distance constants (BULLET_SAFE=100, ENEMY_SAFE=100, buffer=20) — confirmed correct
- runReload retarget counter fix — FIXED
- wall-collision damage — known deferred gap, OUT OF SCOPE here
- heal-spell target filter (GAP #3 in modAi.md) — noted

This pass applies lenses #2–#6 which the first pass skipped, and rechecks constants and branch conditions that could be "present but wrong."

---

## Six-Lens Analysis per Handler

### A. `objAiAttack.txt`

---

#### A1. `on attack` (line 37–54)

**Lens 1 — Translation:** Cooldown gate → type dispatch (#magic → attackMagic → chargeMagic; #melee → attackMelee; #ranged → attackRanged). TS: `CpuAI.attack()` (control.ts:605–712) gates on `wm.getCooldownFin()`, then branches on `this.ranged`. Magic is handled by `spawnSpell+release` path (line 655–666). Melee at line 695–706. Ranged at line 608–694. **Translation: correct** (confirmed by existing audit).

**Lens 2 — Activation:** Called from `updateMoveToAttack` when `targetInReach()` and cooldown ok. In TS, called from `updateMoveToAttack` (line 556) and `updateMoveToOptimumPosition` (lines 730, 735). Reachable in all modes that can reach a target. **Activation: correct.**

**Lens 3 — Global/Initial State:** `pChargeCounter` initialized in `objAiAttack.init` (Lingo line 21). TS: no charge counter for CPU (instant release). Correct for CPU path.

**Lens 4 — Player POV:** Melee enemy hits accurately; ranged enemy fires with perfect accuracy. SEE GAP-1 (eyestrain missing).

**Lens 5 — N/A (logic only).**

**Lens 6 — Missing test:** No test for eyestrain randomization.

---

#### A2. `on attackMagic` / `on chargeMagic` / `on chargeSpell` / `on ensureSpell` (lines 61–188)

**Lens 1 — Translation:** Lingo CPU path: `ensureSpell` creates spell actor → `chargeSpell` increments `pChargeCounter` each tick → when fin, fires `#spellCharged` → `releaseMagic`. TS CPU path: `spawnSpell + setCharge(chargeMaxOf) + release` all in one call. Functionally equivalent (spell released at full charge ceiling). Confirmed by `objAiCPUSpellCaster.md`.

**Lens 2 — Activation:** Lingo's chargeMagic runs every AI tick while in `#attack` mode (via `objAiAttack.update` → `updateAttack` → `bigMe.performAttack` checks attack frame). TS `attack()` fires once per `updateMoveToAttack` when in reach + cooled. The per-frame accumulation in Lingo vs. single-shot in TS is a documented architectural difference with equivalent outcome.

**Lens 3 — Counter init:** `pChargeCounter.tim[1] = calcAttackChargeStart()`, `tim[2] = calcAttackChargeMax()`, `inc = calcAttackChargeSpeed()`. TS uses `chargeStartOf`, `chargeMaxOf`, `chargeSpeedOf` from `charge.ts`. Verified identical formulas. No discrepancy.

**Lens 4 — Player POV:** CPU casters release at full ceiling (both trees). Spell grows to full size instantly in TS vs gradually in Lingo; landing damage identical. No visible enemy-AI parity gap here (the visual of gradual grow is the only difference).

---

#### A3. `on releaseMagic` / `on releaseSpell` (lines 337–359)

**Lens 1:** Lingo sets `ensureMode(#release)`, calls `releaseSpell(targetLoc)`, calls `big.goMode(#release)`, then `resetCooldown()`. TS: `spellActor.release(aim, speed)` + `wm.resetCooldownFor(attack.name)`. `#release` anim mode is equivalent to TS's `releaseT` in PlayerControl.animAction. For CPU enemies, there is no release animation — they fire and go to `attackFin` directly. **Confirmed not a gap (CPU path only).**

**Lens 2 — Activation:** `releaseMagic` is called from `objAiCPU.internalEvent(#spellCharged)` (Lingo line 246). In TS, the single-shot `attack()` replaces the whole charge/release cycle. Activation is equivalent.

---

#### A4. `on cancelAttack` (line 107–114)

**Lens 1:** Lingo: if a current spell exists, finish it and call `attackCancelled()`. Called on: `characterModeChanged(#dead)` (line 121), and `internalEvent(#targetLeft)` if target becomes #none.

**Lens 2 — Activation:** 
- `#dead` path: TS `PlayerControl.update` (control.ts:148–154) checks `isDead()` → if `this.spell`, calls `spell.get(SpellActor).discard()`. Equivalent.
- `#targetLeft` path: Lingo `objAiAttack.internalEvent(#targetLeft)` (line 243–245): if target is gone, cancel the charging spell. TS for CPU: no in-flight spell to cancel (fires immediately). For player `PlayerControl`: on target leaving (handled by `CpuAI.eventLeaveGame`), no `cancelAttack` fires on `PlayerControl`. But since the player's target is used for AIM only (the player fires toward the cursor/auto-target, not a committed target), a target leaving doesn't interrupt charging. **Architecture divergence; not a functional gap for CPU enemies.**

---

#### A5. `on goMode(#freeze)` (line 211–223)

**Lens 1:** Lingo: if entering `#freeze` mode (Thespian/cutscene), and attack type is #melee, ensure character is in #walk mode.

**Lens 2 — Activation:** `#freeze` mode is entered via `goThespianMode()` (objAi.txt:78–81), called for cutscene dialogues. Rapunzel is out of scope. No CPU enemy in-scope uses `#freeze` mode.  **Not applicable to CPU enemies in scope; non-gap.**

---

#### A6. `on internalEvent(#attackFrameSkipped, #manaCapacityIncreased, #manaFlowIncreased, #targetLeft, #updateReel)` (lines 225–256)

**Lens 2 — Activation:**
- `#attackFrameSkipped`: fires when the attack animation frame is skipped (rendering). Not relevant to CPU enemies (attack fires independently of anim frame in TS).
- `#manaCapacityIncreased` / `#manaFlowIncreased`: update the charge counter bounds when mana stat changes. CPU enemies don't level up mid-combat (no mana capacity events fire on enemies in practice). Non-gap.
- `#targetLeft`: see A4 above.
- `#updateReel`: Lingo lines 249–254: aligns a held charging spell with the caster's current position while reeling. TS: no in-flight spell for CPU; for player, the spell orb follows the player via `SpellActor.setCharge(charge, m.x, m.y-6)` each tick in PlayerControl (line 232). **Equivalent.**

---

#### A7. `on update` (lines 376–387) — Attack/Release sub-mode

**Lens 1:** Lingo: while in AI `#attack` mode, ticks `updateAttack()` which waits for `isOnAttackFrame()` then calls `performAttack()`; waits for `getAnimLooped()` then calls `attackFin(#completed)`. Separate `#release` mode runs `updateRelease()` awaiting `getAnimLooped()`. 

TS: No `#attack`/`#release` sub-modes. `CpuAI.attack()` fires damage IMMEDIATELY, then calls `attackFin()` in the same tick. `attackT = ATTACK_FRAMES = 6` is a cosmetic window (drives `attackActive()` query for `modWeaponTechnique`), not a damage-gate.

**Lens 2 — Activation:** The per-frame anim-gated strike and the `#release` sub-mode are never entered in TS; all attack resolution happens in one `attack()` call.

**Lens 4 — Player POV:** Player sees enemies attack instantly rather than waiting for the animation's strike frame. For melee: the hit registers on the same frame the approach reaches range, not on the dedicated attack-frame. For multi-hit melee animations this could mean slightly different cadence. However, for enemies the cooldown is the effective rhythm gate; the anim-frame hit detection was the Lingo mechanism for the same gate. **Documented architectural divergence (attack.ts audit confirmed). Non-gap.**

---

#### A8. `on modifyLocWithEyestrain` (lines 268–288) — **GAP-1**

See dedicated GAP-1 section below.

---

### B. `objAiCPUSpellCaster.txt`

---

#### B1. `on init` (lines 25–36) — Constants

**Lens 3 — Constants:**
- `pBulletSafeDistance = 100` → TS `BULLET_SAFE = 100` (control.ts:419). **Correct.**
- `pEnemySafeDistance = 100` → TS `ENEMY_SAFE = 100` (control.ts:420). **Correct.**
- `pBufferDistance = 20` → TS hardcoded `20 * 20` in condition (control.ts:728): `distSq - ENEMY_SAFE * ENEMY_SAFE > 20 * 20`. **Correct.**
- `pEnemyGoodShootingDistance = params.enemyGoodShootingDistance` (set to 150 in `new`). This property is initialized but **never used** in `updateMoveToOptimumPosition`. It's dead data in the Lingo source. TS has no equivalent. **Non-gap (dead field).**
- `pRefreshDestinationCounter = CounterNew(); tim[2] = 1`. This counter is also **never referenced** in `updateMoveToOptimumPosition` or anywhere in the spell-caster update path — it's dead code in the Lingo source. TS has no equivalent. **Non-gap (dead code).**
- `pSpellCasterMode = #moveToOptimumPosition`. See B4 below.

---

#### B2. `on attackFin` (lines 38–44)

**Lens 1:** Lingo SpellCaster override: calls `me.setTarget(#none)` (which resolves to `clearTarget()` since argument is `#none`) then `ancestor.attackFin()` (which also calls `clearTarget()` then `refreshTarget()`). Net: double-clear + refresh.

TS `CpuAI.attackFin` (control.ts:595–601): `this.target = null; this.refreshTarget()`. Same net effect: clear + refresh.

**Lens 2 — Activation:** `attackFin` is called from `CpuAI.attack()` at line 711 (after every attack). `dodgesBullets` spellcasters enter `"optimumPosition"` mode at line 599. **Activation correct.**

---

#### B3. `on eventNotification(#chargeLimited)` (lines 60–74)

**Lens 1:** SpellCaster override: when `#chargeLimited` fires from the charging spell, immediately call `internalEvent(#spellCharged)` — i.e., release now (the spell hit a cap early). The base `objAiAttack.eventNotification(#chargeLimited)` instead updates the counter position to the clamped charge.

**Lens 2 — Activation:** In TS, CPU enemies release spells instantly at `chargeMaxOf` — there's no per-frame charging counter, no `#chargeLimited` event pathway. This handler is irrelevant for TS CPU casters. **Non-gap (architecture).**

---

#### B4. `on characterModeChanged` (lines 46–58) — **GAP-2**

**Lens 1:** Lingo SpellCaster adds logic on top of ancestor:
- `#dead` or `#reel` → `pSpellCasterMode = #none` (stop positioning)
- `#walk` → `pSpellCasterMode = #moveToOptimumPosition` (resume positioning)

TS `CpuAI.characterModeChanged` (control.ts:485–491):
- `#reel`/`#dead` → `mode = "dazed"` (intent frozen, optimumPosition not entered — equivalent to `pSpellCasterMode = #none`)
- `#walk` (or any non-dazing mode when currently dazed) → `mode = "findTarget"` (NOT directly to optimumPosition)

The key difference: in Lingo, `#walk` after reel restores `pSpellCasterMode = #moveToOptimumPosition` **while the ancestor FSM mode is still `#moveToAttack` or wherever it was** — so the spellcaster resumes concurrent repositioning immediately. In TS, `"findTarget"` is entered → `refreshTarget()` → if target found → `"moveToAttack"` → when in reach → fire → `attackFin()` → `"optimumPosition"`. 

For a spellcaster whose reach is `9999` (always in reach), `updateMoveToAttack` fires `attack()` on the very next tick after finding a target. So the path `findTarget → moveToAttack (1 tick) → attack → attackFin → optimumPosition` is effectively only 2 ticks longer than the Lingo path. The target is also never lost (it's retained unless dead). This is a **2-tick delay** before repositioning resumes after a reel. Not a meaningful behavioral gap; player-visible as a very brief hesitation.

**Verdict: MINOR — 2-frame delay entering optimumPosition after reel recovery for spellcasters. Functionally imperceptible.**

---

#### B5. `on runToFromObjects` (lines 90–156) — buffer distance check

**Lens 1:** The `runTowardsObject` variant (lines 158–169) uses:
```lingo
dist = geomDistSqr(me.getLoc(), runDestination)
if dist - pEnemySafeDistance*pEnemySafeDistance > pBufferDistance*pBufferDistance then
  -- run toward
```
This is `dist² > 100² + 20²` = `dist² > 10400` → `dist > ~102`.

TS (`updateMoveToOptimumPosition` line 727–728):
```typescript
const distSq = (tp.x - m.x) ** 2 + (tp.y - m.y) ** 2;
if (distSq - CpuAI.ENEMY_SAFE * CpuAI.ENEMY_SAFE > 20 * 20) {
```
`distSq > 10000 + 400` = `distSq > 10400` → same threshold. **Correct.**

---

#### B6. `on runTangentToObjects` (lines 171–259) — geometric blend

**Lens 1:** The blend is `PointValRange(25 + random(50), [tangentPoint, mirrorPoint])`. `PointValRange(t, [a,b])` = `a + (b-a) × t/100`. So `t = 25..75` → 25%–75% tangent, 75%–25% mirror.

TS (control.ts:763): `const t = 0.25 + game.rng.next() * 0.5;` → t in [0.25, 0.75]. Used as `tangentX * t + mirrorX * (1 - t)`. At `t=0.25`: 25% tangent + 75% mirror. At `t=0.75`: 75% tangent + 25% mirror. **Matches Lingo range exactly.**

**Lens 3 — Global:** `CpuAI.BULLET_SAFE = 100` matches `pBulletSafeDistance = 100`. Confirmed.

---

#### B7. `on update` (lines 261–273) — concurrent vs mode dispatch

**Lens 1:** Lingo: `ancestor.update()` first (runs the normal FSM), then if `pSpellCasterMode = #moveToOptimumPosition` AND `reach = 9999`, runs `updateMoveToOptimumPosition()`. This means positioning logic ADDS ON TOP of the FSM — both run each tick.

TS: The `"optimumPosition"` case in `update()` is INSTEAD of the other modes (mutually exclusive). The TS attack-within-optimumPosition (lines 730, 735) compensates: the caster fires when cooled+in range from within the repositioning code.

**Lens 2 — Activation:** In Lingo, when in `#moveToAttack` with reach=9999, BOTH `updateMoveToAttack` (which immediately fins and calls `attack()`) and `updateMoveToOptimumPosition` (which also repositions) run each tick. In TS, only `optimumPosition` runs (which includes both positioning and attacking). Net behavior: both trees position and attack every tick. **Functionally equivalent.**

---

### C. `objCPUCharacter.txt`

---

#### C1. `on collisionCeiling` / `on collisionPlatform` / `on collisionVertical` / `on collisionWall` (lines 91–137)

**Status:** OUT OF SCOPE per brief. Wall-impact damage is the known deferred gap (`_resweep_TRIAGE.md`). Not re-flagged here.

---

#### C2. `on goMode` (lines 166–192) — frictionNormal / vectY=0

**Lens 1:** Lingo: on entering `#recoil`, restores frictionX/Y. On entering `#landed`, `#reelLanded`, `#walk`, sets `vectY = 0` and `frictionNormal()`.

TS: Movement component applies `vx *= friction`, `vy *= friction` every tick passively. `frictionNormal()` / `frictionXOn()` etc. are not called. The `setVectY(0)` on `#walk` (zeroing vertical velocity on landing/recovery) has no direct equivalent.

**Lens 4 — Player POV:** In Lingo, a reeled unit whose feet touch the ground gets its Y velocity zeroed when entering `#walk` — it stops vertical drift immediately. In TS, the knockback `kvy` decays by `KNOCK_FRICTION = 0.78` per tick. After 6 ticks (reel window), `kvy` has decayed to `initial × 0.78^6 ≈ 0.23×initial`. This could cause a brief vertical drift after reel recovery vs Lingo's hard stop.

**Lens 2 — Activation:** Affects every enemy that takes a hit that triggers a reel. The residual `kvy` at reel end is `hit_kvy × 0.78^6`. For a typical hit generating `kvy = KNOCK_MAX = 5`, after 6 ticks: `5 × 0.23 ≈ 1.15 px/tick`. After reel, intentX/Y is zero, so `vy` (walk velocity) also decays, but `kvy` continues decaying. Total residual drift: `1.15 × (1/(1-0.78))` ≈ `5.2 px` additional travel before stopping. **Minor positional drift (~5px) vs hard Lingo stop.**

**Verdict: MINOR — Not a behavioral gap in the gameplay-meaningful sense; friction decay achieves the same stop within a few ticks. Noted for completeness.**

---

#### C3. `on updateLook` (lines 249–274)

**Lens 1:** Lingo: `#look` mode plays a "look around" animation (toggle fliph 4 times over 4×10=40 frames). Entered from `modReel.updateReelSit()` → `goMode(#look)`.

**Lens 2 — Activation:** In the TS port, the reel sequence is: hit → `flashT = 6` → 6 ticks → `characterModeChanged("#walk")`. There is no `#reelSit` and no `#look` transition. The enemy simply idles during `flashT`, then returns to hunting. The Lingo post-reel sequence was: reel → reelFly → reelLanded → reelSit → **look (40 frames)** → walk. So in Lingo, a reeled enemy spends ~40 extra frames in the look-around state; in TS it returns to hunting after 6 frames.

**Lens 4 — Player POV:** Enemies recover from being knocked back much faster in TS (~6 frames) than in Lingo (~40+ frames total for the full reel sequence including reelSit+look). This is a significant behavioral difference from the player's perspective: Lingo enemies are stunned longer after being hit hard.

**Lens 6 — Missing test:** No test for post-reel recovery timing.

**However**, this was already documented in `modReel.md` and `modAi.md` as an intentional architectural simplification (reel duration = fixed `flashT=6` vs Lingo's stall-based multi-phase reel). The `#look` phase specifically is documented as "out-of-scope (K2 deferred)" in `objCPUCharacter.md`. **Pre-existing documented gap. Not a new finding.**

---

#### C4. `on update` / `on updateDead` — `#dead` mode guard (line 214–247)

**Lens 1:** Lingo: `#dead` mode calls `updateDead()` → if grave is off, `fin = true` → `goMode(#finish)`. With grave, waits for `getAnimLooped()`. TS: Energy.dead flag drives the death/finalize path via `Hurt.takeHit` → grave component. Equivalent.

**Lens 2 — Activation:** `isDead()` check at start of `CpuAI.update()` (control.ts:501) calls `idle(m)` and returns. The equivalent of the Lingo `#dead` update loop. **Correct.**

---

#### C5. `on takeHit` (lines 198–212) — ghost gate + sound

**Lens 1:** Lingo: `if me.amGhost() then return` (line 200) — ghosts take no damage. `pTakenHit = true` is set unconditionally after the hit logic (line 211). 

TS: Ghost gate in `Movement.takeHit` (movement.ts:81): `if (this.ghost && attackerId !== this.entity.id) return`. `pTakenHit` has no equivalent — it was a flag checked by something (possibly `objAttachingEnemyCharacter`) that's not in scope.

**Lens 2 — Activation:** Ghost gate fires for `monkGhost` units. TS correctly implements it. `pTakenHit` appears unused in objCPUCharacter itself (no handler reads it); likely consumed by a subclass (`objAttachingEnemyCharacter`). Non-gap for in-scope enemies.

---

#### C6. `on energyChanged` (line 144–148)

**Lens 1:** Updates the HUD energy bar. TS: `Energy.update` ticks `goldGlow`, `energyFrac()` query used by renderer. Energy bar pooling is removed (per `objCPUCharacter.md`). **Non-gap.**

---

#### C7. Friction restore in `goMode(#recoil)` (line 169–173)

**Lens 1:** Lingo: when LEAVING `#recoil` mode (case on `me.pMode`), calls `frictionXOn()` + `frictionYOn()`. This restores normal friction after a recoil event (enemies with `pRecoil = true` use this path).

TS: No equivalent. The `Hurt` component doesn't handle `#recoil` mode specially for friction. Movement's friction is always applied passively.

**Lens 2 — Activation:** `#recoil` mode is set for enemies with `pRecoil = true` (`recoil: true` in data). From the Lingo source, `modReel.txt` handles recoil. `pRecoilCounter` runs in TS `Hurt` indirectly (the reel flashT is the equivalent).

Actually, examining more carefully: `#recoil` is listed as a dazing mode in both Lingo and TS (`characterModeChanged` lists). The recoil in Lingo exits when `pRecoilCounter.fin` (via `modReel.updateRecoil`). In TS, it's absorbed into the 6-frame `flashT` window. The friction restoration is redundant with the passive friction model. **Non-gap (passive friction is equivalent).**

---

## Confirmed New Gap

### GAP-1: `eyestrain` Accuracy Scatter — Missing in TS

**Lingo source:** `casts/script_objects/modAttack.txt:733–735` (call site), `casts/script_objects/objAiAttack.txt:268–288` (implementation)

```lingo
-- in performRangedAttack:
targetLoc = me.modifyLocWithEyestrain(targetLoc)
```

```lingo
on modifyLocWithEyestrain me, theLoc
  eyestrain = me.pCharacterPrg.getEyestrain()        -- per-actor data value (e.g. swordOrc: 70)
  myReach = me.getAttack().reach                      -- ranged reach
  dist = SineDist(myLoc, theLoc)
  percentOfRange = VarPercent(dist, [0, myreach])    -- 0-100% of max reach
  eyestrain = VarValRange(percentOfRange, [0, eyestrain])  -- scale: 0 at close, full at max range
  eyestrain = integer(eyestrain)
  theLoc = theLoc + point(VarRoughly(0,eyestrain), VarRoughly(0,eyestrain))  -- ±eyestrain px scatter
  return theLoc
end
```

**Applied to:** All CPU ranged attackers (every `#ranged` type enemy). Data values from `casts/data/act_*.txt`:
- `swordOrc`: eyestrain 70
- `bowOrc`: eyestrain 50
- `goblinArcher`: eyestrain 5
- `skeletonArcher`: eyestrain 7
- `shrouder`: eyestrain 50
- `thunderMonk`: eyestrain 50
- `fangBunny`/`fangBunnyBaby`: eyestrain 25/40
- `dragon`/`fireDragon`: eyestrain 50
- `townWatch`: eyestrain 60
- `ninja`: eyestrain 30
- (and ~30 others)

**TS port:** `CpuAI.attack()` (control.ts:608–694) computes `dx = tp.x - m.x`, `dy = tp.y - m.y` and fires directly. No eyestrain field is loaded from the actor data, no scatter is applied. `game.rng.next()` is only used for pathfinding (K3 scenic detours).

**Lens 2 — Activation:** Fires every time a ranged enemy fires a projectile at a target.

**Lens 3 — Data:** `#eyestrain` is in `casts/data/act_*.txt` for all ranged enemies. It is not present in `port/src` anywhere (grep confirmed zero hits).

**Lens 4 — Player POV:** In Lingo, far-away archers and orcs frequently miss; at close range they're accurate. An orc at max reach (150px) with eyestrain 70 scatters ±70px in each axis — effectively a 50%+ miss rate at range. In TS, every enemy projectile hits exactly on the target-line; no dodging is possible. Enemy ranged units are significantly more dangerous at range in the port.

**Lens 6 — Missing test:** No test for scatter behavior.

**Impact: HIGH.** Nearly all ranged enemies have non-zero eyestrain. The scatter is the primary mechanic that lets the player dodge ranged fire by moving. Without it, enemies effectively have a "hitscan" accuracy that the original design never intended.

**Fix path:** Load `eyestrain` from actor data into a new `CpuAI.eyestrain` field. In `CpuAI.attack()`, before computing `throwSpeed`, scatter the target by `±rng.range(-e, e)` on both axes where `e = Math.round(eyestrain × d / reachRanged)` (linear scale by distance fraction). Apply only when `this.ranged` and attack type is not beam/splash-only (beams are point-targeted; the scatter changes the origin, not the destination for a beam). Existing TS callers of `fireBullet`/`fireSplashBullet` take `(dx, dy)` — just perturb `dx`/`dy` before the call.

---

## Pre-Existing Gaps (Confirmed, Not New)

### modAi.md GAP-2 (FIXED): runReload retarget counter
Fixed in prior pass. Confirmed still correct in current code (control.ts:573–576 now ticks retargetCtr in updateRunReload).

### modAi.md GAP-3: Heal-spell target filter
`objAiCPU.refreshTarget` skips a full-health target for `#healBlast`. TS `refreshTarget()` (control.ts:586–591) uses `findTarget()` which has a `#lowestHealth` branch that skips `energyFrac >= 1` targets (teams.ts:138–148). **Confirmed already covered by teamMaster; non-gap as of the last modAi.md update.**

### `#daze` mode missing from TS characterModeChanged list

**Lingo `objAiCPU.characterModeChanged` (line 122):** includes `#dazed` in the dazing list.  
**TS (control.ts:486):** does NOT include `"#dazed"` in the dazing string set.  
`#dazed` as a character mode (vs the AI mode `"dazed"`) is only sent from `objAiEnemyTargetSeek` (for weapon-pickup AI) — none of the in-scope enemies use it. **Confirmed inert for in-scope enemies. Non-gap.**

### Post-reel `#look` phase duration
Documented in `modReel.md` and `objCPUCharacter.md` as intentional simplification. Out of scope.

### Wall-collision damage
`_resweep_TRIAGE.md` — deferred known gap. Out of scope.

---

## Verified Non-Gaps (New This Pass)

| Item | Status |
|---|---|
| `pBulletSafeDistance = 100` → `BULLET_SAFE = 100` | Correct |
| `pEnemySafeDistance = 100` → `ENEMY_SAFE = 100` | Correct |
| `pBufferDistance = 20` → hardcoded `20 * 20` threshold | Correct |
| `pRefreshDestinationCounter` — dead code in Lingo | No TS equivalent needed |
| `pEnemyGoodShootingDistance = 150` — unused in Lingo | No TS equivalent needed |
| runTangentToObjects blend range 25–75% | TS `0.25 + rng.next() * 0.5` matches exactly |
| attackFin clear+refresh order | Both trees: clear then refresh |
| `#chargeLimited` event → instant release in spellcaster | TS instant-release architecture makes this a no-op |
| SpellCaster concurrent update vs TS exclusive mode | TS `optimumPosition` shoots when cooled+in range — equivalent |
| `goMode(#freeze)` — Thespian mode | Only player in cutscenes; not applicable to CPU enemies |
| `#dazed` char mode missing from TS daze list | Only used by objAiEnemyTargetSeek; inert for in-scope enemies |
| Residual `kvy` drift after reel (<5px) | Decays within 2–3 ticks; cosmetically imperceptible |

---

## Summary

| Finding | Severity | Status |
|---|---|---|
| GAP-1: Eyestrain scatter missing from all ranged enemy attacks | HIGH | New — needs fix |
| B4: 2-tick delay entering optimumPosition after reel (spellcaster) | MINOR | Imperceptible; not flagged |
| modAi.md GAP-2 (runReload retarget) | — | FIXED (prior pass) |
| modAi.md GAP-3 (heal-spell filter) | — | Non-gap (covered by teamMaster) |
| Wall-collision damage | HIGH | Deferred (out of scope) |
| `#look` phase (post-reel stun duration) | MED | Pre-existing, documented |

---

FILE=_resweep_aiFsm | GAPS=1 | GAP-1: eyestrain scatter absent — all ranged CPU enemies fire with perfect accuracy in TS; original applies per-actor px scatter (0 at close range, full eyestrain at max reach) that is the core mechanic for player bullet-dodging
