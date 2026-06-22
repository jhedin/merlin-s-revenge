# Re-Sweep Audit: Player + Experience + Movement + Reincarnation

**Lingo sources:**
- `casts/script_objects/objPlayerMerlinCharacter.txt`
- `casts/script_objects/modExperience.txt`
- `casts/script_objects/modMoveToLoc.txt`
- `casts/script_objects/modReincarnate.txt`

**Bytecode references (authoritative constants):**
- `extracted/engine/scripts/ParentScript 15 - modExperience.ls`
- `extracted/engine/scripts/ParentScript 31 - modMoveToLoc.ls`
- `extracted/engine/scripts/ParentScript 38 - modReincarnate.ls`
- `extracted/engine/scripts/ParentScript 32 - modNavMode.ls`
- `extracted/engine/scripts/ParentScript 9 - modCharacterAttackProperties.ls`
- `extracted/engine/scripts/ParentScript 89 - objCharacter.ls`

**TS implementations:**
- `port/src/components/experience.ts`
- `port/src/components/reincarnate.ts`
- `port/src/components/movement.ts`
- `port/src/components/control.ts` (PlayerControl + CpuAI)
- `port/src/entities/archetypes.ts` (spawnPlayer + spawnEnemy)

**Prompt:** Six-lens re-sweep (translation / activation / global+initial state / player-POV / draw-order / missing-test).

**Not re-flagged (already fixed or documented adaptation):**
- Nav-mode speed (movement.ts:20 NAV_SPEED_MULT=3 — fixed)
- Level-up stars (experience.ts:68-70 spawnLevelUpStar — fixed)
- Walk-speed-per-level (movement.ts:63-65 levelUp handler, 0.075 player / 0.045 enemy — documented adaptation of the original's push-accel model)
- Reincarnation XP transfer (reincarnate.ts:87,103 xfer = xp/2 per child — fixed)
- Reel-input-freeze (control.ts:159-163 isHurt gate — fixed)

---

## Handler-by-Handler Analysis

### objPlayerMerlinCharacter

#### `on new` / `on init` (lines 22–71)
**LENS 1 (TRANSLATION):** TS `spawnPlayer` (archetypes.ts:106-146) reads from `registry.resolveActor("player")` (act_player.txt) and `registry.resolveActor("merlin")` (act_merlin.txt). Key initial stats from data:
- energy: 200 ✓ (act_player.txt #energy:200)
- walkSpeed: 4 ✓ (act_merlin.txt #walkSpeed:4)
- strength: 8 ✓ (act_player.txt #strength:8)
- experienceAmountForNextLevel: 10 ✓ (act_player.txt, passed at archetypes.ts:134)
- walkSpeedIncLevel: 0.075 (archetypes.ts:120; adapted from 0.05 modNavMode acceleration model — documented adaptation, not reflagged)
- mana_regeneration: 30 ✓ (act_player.txt #mana_regeneration:30, flows to Mana.regeneration for cooldown divisor)

**LENS 2 (ACTIVATION):** PlayerControl fires each tick via PlayerArchetype chain. ✓

**LENS 3 (GLOBAL+INITIAL):** `i.energy = 100` in `on new` is superseded by `i.energy = me.pEnergy` in `on init`. Bytecode-authoritative value is 200 from act_player.txt. TS reads this correctly. ✓

**LENS 4 (PLAYER-POV):** Player spawns with correct initial stats. ✓

#### `on goMode` (lines 121–137) — reel override
**LENS 1:** Lingo overrides `#reel` → keeps current mode. TS implements this via `isHurt` gate in PlayerControl.update (control.ts:159-163): when hurt, intent=0 and input is skipped. ✓

**LENS 2 (ACTIVATION):** `isHurt` is sent through the Hurt component (combat.ts). PlayerControl checks it at the top of update. ✓

#### `on update` — leaveRoom / navMode (lines 249–281)
**LENS 1:** When leaving a room (`#leaveRoom` mode), Lingo exits navMode, fires `moveRoom()`, repositions the player. TS room transition is handled by RoomManager (not in scope here). The navMode exit (`leaveNavMode`) is documented in `_resweep_TRIAGE.md` coupling #5. ✓

#### `on takeHit` (lines 228–247) — reel prevention
**LENS 1:** Lingo's `ancestor.takeHit()` then `goMode(#walk)` overrides reel → no reel animation for player. TS uses `isHurt` (i-frames gate) and `goMode(#reel)` is blocked in PlayerControl. ✓

**LENS 4 (PLAYER-POV):** Player does NOT reel when hit; enemy does. This asymmetry is preserved. ✓

#### `on potionCollected` — `incWalkAcceleration(#potion)` (lines 183–203)
**LENS 1:** Lingo: `me.incWalkAcceleration(#potion)` → `modNavMode.incWalkAcceleration(#potion)` → `pNavModeNormalAcceleration += 0.3` (bytecode: `pPotionAccelerationInc = 0.29999...`). In TS: no walkAcceleration potion handler exists (the #walkSpeed potion effect goes through pickup.ts / Medikit). This is the documented PARTIAL GAP 2 from objPlayerCharacter.md. Acceleration vs maxSpeed model — already-known divergence, not reflagged here. ✓

#### `on stretchDeathFin` / `on updateDie` / `on energyChanged` / `on respawn`
**LENS 2 (ACTIVATION):** All route through ExtraLives / Hurt / Energy in the port. Death finalization fires via Grave → leaveGame path. ✓

---

### modExperience

#### `on addModParams` (lines 25–35) — default `experienceAmountForNextLevel = 0`
**LENS 3 (GLOBAL+INITIAL STATE): GAP-1 FOUND**

Bytecode (`ParentScript 15`, `addModParams`):
```
i[#experienceAmountForNextLevel] = 0
```
Default for any unit that doesn't supply its own value is **0** — meaning threshold for first level is 0 (any XP gain immediately triggers level-up since `pExperienceGained >= 0` after the first kill).

TS `Experience.init` (experience.ts:23):
```typescript
this.initThreshold = typeof cfg["experienceAmountForNextLevel"] === "number"
  ? cfg["experienceAmountForNextLevel"] : 10;
```
Default falls back to **10**.

`spawnEnemy` (archetypes.ts:276-336) **never passes** `experienceAmountForNextLevel` to the build call, so:
- `blackOrc` → Lingo threshold=0, TS threshold=10 (WRONG)
- `goblinMage` → data has 3, but not forwarded → TS threshold=10 (WRONG, should be 3)
- `monk` → data has 50, but not forwarded → TS threshold=10 (WRONG, should be 50)
- `darkMage` → data has 5, but not forwarded → TS threshold=10 (WRONG, should be 5)

All 9 actors with explicit `experienceAmountForNextLevel` values in generated `data.json` (act_darkMage:5, act_druid:50, act_friendlyGoblinMage:3, act_goblinMage:3, act_monk:50, act_monkGhost:50, act_ochreInGame:500, act_prestotolinInGame:50, act_scarletInGame:500) receive incorrect thresholds in TS. All other enemies also use the wrong default (10 vs 0).

**Effect on XP curve:** First-level threshold is wrong; and because `initThreshold` seeds the cubic formula, the entire level progression diverges from the original for every affected enemy.

**Player is CORRECT:** `spawnPlayer` passes `experienceAmountForNextLevel: num(d, "experienceAmountForNextLevel", 10)` (archetypes.ts:134), and act_player.txt has 10, so player threshold starts at 10 correctly. ✓

**Fix needed:** Add `experienceAmountForNextLevel: num("experienceAmountForNextLevel", 0) || undefined` to `spawnEnemy`'s build call. The `|| undefined` ensures 0-valued actors (most enemies) fall through to `Experience.init`'s `typeof` check — but actually `typeof 0 === "number"` is true, so it would correctly set threshold=0. Pass `num("experienceAmountForNextLevel", 0)` directly.

#### `on attemptToLevelUp` (lines 82–97) — threshold formula
**LENS 1:** Both Lingo and TS implement:
```
threshold = (L³ + L² + prevThreshold/(L+1)) + 5 + initThreshold
```
Bytecode-confirmed (ParentScript 15). TS experience.ts:52,62. ✓

#### `on levelUp` (lines 201–225)
**LENS 1:** `me.big.incWalkAcceleration()` (no arg) → dispatches to `modNavMode` for player (acceleration += 0.05, bytecode-confirmed: `pWalkAccelerationInc = 0.05`). Then `me.big.internalEvent(#levelUp)` fans out to all modules:
- `modMoveToLoc.internalEvent(#levelUp)` → `incWalkSpeedLevel()` → walkSpeed += 0.075
- For player: walkSpeed path is moot (player uses acceleration model, not walkSpeed)
- For enemies: walkSpeed += 0.075 (enemy movement model)

TS `Movement.levelUp` (movement.ts:63-65): `maxSpeed += walkSpeedIncLevel`. Player gets 0.075, enemies get 0.075*0.6=0.045. These represent the port's unified adaptation — documented and not reflagged.

**LENS 1 — Star release:** `me.big.releaseStar()` (pReleaseStarOnLevel default true). TS: `game.effects?.spawnLevelUpStar(pos.x, pos.y)` (experience.ts:68-70). Fixed and present. ✓

**LENS 1 — Sound:** `me.big.playSound("level_up", 100)`. TS: `game.audio?.play("level_up")` for player-type entities (experience.ts:65). ✓

#### `on transferExperience` (line 318–321) — reincarnation XP hand-off
**LENS 1:** `reincarnatedMe.gainExperienceFromTransfer(pExperienceGained / 2)`. TS: `child.send("gainXp", xfer)` where `xfer = xp/2` (reincarnate.ts:87,103). Fixed. ✓

**LENS 2 (ACTIVATION):** The Lingo fires `me.big.internalEvent(#reincarnated)` per spawn inside the reincarnate loop. TS directly calls `child.send("gainXp", xfer)` inside its `reincarnate()` function. Different trigger mechanism, same per-child XP transfer. ✓

#### `on gainExperience` / multi-level loop (lines 136–150)
**LENS 1:** Both loop: `while (attemptLevelUp())`. ✓

#### `on attributeExperience` — bullet exclusion (lines 99–118)
**LENS 1:** Lingo gate: `if lastAttacker.getType() <> #objBullet then gainExperience(...)`. TS: Experience.takeHit (experience.ts:29-32) records `attackerId` from any hit; Energy.levelUp (combat.ts) calls `entity.send("getReward")` to compute the XP, then credits the attacker. The bullet-exclusion (`getType() <> #objBullet`) is approximated because bullets in TS have `entity.type = "bullet"` and the killer attribution flows through the direct `attackerId`. The XP is credited to the last attacker regardless of bullet-or-not in TS — a minor divergence, but the practical effect is small since bullets rarely have an entity-level "killer" (the spawning unit is the killer, not the bullet itself). Out of scope for this re-sweep, and present in existing audit.

---

### modMoveToLoc

#### `on addModParams` — `pWalkAcceleration = 0.5`, `pWalkSpeedIncLevel = 0.075`
**LENS 3 (GLOBAL+INITIAL):** Bytecode-confirmed:
- `pWalkAcceleration = 0.5` (default for enemies; player gets 2 from act_player.txt)
- `pWalkSpeedIncLevel = 0.075`

TS: enemies get `walkSpeed * 0.6` as maxSpeed, `walkSpeedIncLevel = 0.075 * 0.6`. Player gets walkSpeed=4, walkSpeedIncLevel=0.075. All values confirmed correct per documented adaptation. ✓

#### `on moveHoriz` / `on moveVert` — acceleration model (lines 317–323, 481–487)
**LENS 1:** `pMoveXY.vectAdd(point(pWalkAcceleration * dir, 0))` — push vector each frame, physics integrates. Player `pWalkAcceleration = 2` (act_player.txt). TS: `intentX * accel` → `vx += intentX * accel` (movement.ts:109) where `accel = 1.4`. Constants differ due to port adaptation of the push-friction model. ✓ (documented adaptation)

#### `on incWalkSpeedLevel` → `on internalEvent(#levelUp)` (lines 255–259, 287–289)
**LENS 2 (ACTIVATION):** `modMoveToLoc.internalEvent(#levelUp)` → `incWalkSpeedLevel()`. Bytecode-confirmed firing chain. TS: `Movement.levelUp` is in `static handles` and called via `entity.send("levelUp")` from `Experience.attemptLevelUp`. ✓

---

### modReincarnate

#### `on reincarnate` — `j=1` counter bug (lines 49–72)
**LENS 1:** `j` is initialized to 1 **inside** the repeat loop, reset on every iteration:
```lingo
repeat with i in pReincarnateAs
  j=1        -- ALWAYS reset; j can never be >1 when the useOffset check runs
  if i <> #none then
    ...
    if j=1 then params.useOffset = false
    else params.useOffset = true
    ...
    j = j + 1  -- incremented but reset next iteration
  end if
end repeat
```
Bytecode (`ParentScript 38`) confirms: `j = 1` is the first instruction inside the loop body. All children always spawn at `useOffset = false` (exact corpse location, overlapping).

TS: `spawned > 0` check correctly detects "not first child" and applies circular scatter (reincarnate.ts:89-99). This **intentionally fixes** the Lingo bug. Documented as justified divergence in modReincarnate.md. NOT a gap; original data ships `reincarnateRadius` values that prove designer intent was scatter. ✓

#### `on internalEvent(#leftTeam)` → `me.reincarnate()` (lines 37–47)
**LENS 2 (ACTIVATION):** Lingo fires on `#leftTeam` internalEvent (unit leaves team on death). TS fires in `Reincarnate.update()` on the `isDead && getKilledInAction` edge (reincarnate.ts:68-76). Different trigger, same gate (`getKilledInAction()`). Both prevent reincarnation on retire/room-exit. ✓

#### `on getReincarnatedMe` (lines 33–35)
**LENS 1:** TS does NOT expose this as a message handler. In Lingo, `modExperience.transferExperience` calls `me.big.getReincarnatedMe()` to get the most-recently-spawned child, then transfers XP. TS bypasses this entirely by keeping a local `child` reference in `reincarnate()` and calling `child.send("gainXp", xfer)` directly. The handler is not needed; the XP transfer is correct. ✓

---

### CpuAI — enemy strength on level-up

#### `modCharacterAttackProperties.internalEvent(#levelUp)` — `levelUpCharacterAttackProperties`
**LENS 1: GAP-2 FOUND**

Bytecode (`ParentScript 9 - modCharacterAttackProperties.ls`, `internalEvent`):
```lingo
#levelUp:
  me.levelUpCharacterAttackProperties()
```
where `levelUpCharacterAttackProperties()` calls `incStrengthLevel()`:
```lingo
on incStrengthLevel me
  me.incStrength(pStrengthIncLevel)
end
```
Default `pStrengthIncLevel = 0.1` (bytecode-confirmed). This fires for ALL units including CPU enemies (every character has `modCharacterAttackProperties` via `objCharacter`).

TS: `PlayerControl.levelUp` (control.ts:139) grows `this.strength += this.strengthInc`. `CpuAI.static handles` (control.ts:378) does NOT include `"levelUp"`. So `entity.send("levelUp")` never reaches CpuAI.strength for enemies.

**Effect:** Enemy melee damage does not scale with level in TS. In the original, an enemy that levels up (e.g., a monk that kills several units) deals progressively more melee damage. In TS it does not.

**Severity:** LOW-MEDIUM. Most enemies in normal gameplay do not accumulate enough kills to level up (especially given GAP-1 sets their threshold too high at 10 instead of 0). But allied wizards/monks that survive long encounters should grow stronger — a feelable late-game difference.

**Fix:** Add `levelUp(next: NextFn): void { this.strength += this.strengthInc; next(); }` to `CpuAI`, add `"levelUp"` to `static handles`, and pass `strengthIncLevel: num("strengthIncLevel", 0.1)` through `spawnEnemy`'s build call.

---

## Summary of Confirmed Gaps

### GAP-1 (MEDIUM): `experienceAmountForNextLevel` not forwarded for enemies

| | Lingo | TypeScript |
|---|---|---|
| Default (addModParams) | 0 | 10 |
| goblinMage | 3 | 10 (not forwarded) |
| monk / druid / monkGhost | 50 | 10 (not forwarded) |
| ochreInGame / scarletInGame | 500 | 10 (not forwarded) |
| blackOrc / most enemies | 0 | 10 (no field in data) |

**Code path:** `spawnEnemy` (archetypes.ts:276-336) omits `experienceAmountForNextLevel` from the build call. `Experience.init` (experience.ts:23) falls back to 10.

**Activation:** Any enemy that kills something. With threshold=0 (Lingo default) an enemy levels up on its FIRST kill; with threshold=10 (TS default) it needs several.

**Level curve divergence:** `initThreshold` seeds the cubic formula at line 52/62 of experience.ts. Wrong `initThreshold` → wrong curve for ALL subsequent levels of that unit.

**Fix:** In `spawnEnemy`, add `experienceAmountForNextLevel: num("experienceAmountForNextLevel", 0)` to the build call. Note: value 0 passes as a number, so `typeof cfg["experienceAmountForNextLevel"] === "number"` will be true and `initThreshold` will correctly be 0 for most enemies.

### GAP-2 (LOW): Enemy strength does not grow on level-up

**Code path:** `entity.send("levelUp")` → `Movement.levelUp` (maxSpeed) ✓, `Mana.levelUp` (random mana stat) ✓, `Energy.levelUp` (maxEnergy) ✓, `PlayerControl.levelUp` (player strength) ✓ — but CpuAI has no `levelUp` handler, so enemy `this.strength` never grows.

**Lingo path:** `modCharacterAttackProperties.internalEvent(#levelUp)` → `levelUpCharacterAttackProperties()` → `incStrengthLevel()` → `pStrength += 0.1`. Fires for every character.

**Symptom:** A leveled enemy does not hit harder (melee only; ranged is unaffected since bullet power is data-fixed). Allied wizards that survive long fights don't grow in melee power.

**Fix:** Add `levelUp` handler to `CpuAI` and `"levelUp"` to `static handles`. Also add `strengthIncLevel: num("strengthIncLevel", 0.1)` to `spawnEnemy`'s build call.

---

## Confirmed CLEAN / Already-Fixed / Documented Adaptations

| Area | Status | Evidence |
|------|--------|----------|
| XP threshold formula `(L³+L²+prev/(L+1))+5+init` | ✓ CLEAN | experience.ts:52,62 = bytecode |
| Multi-level per kill loop | ✓ CLEAN | experience.ts:36 |
| XP reward formula `imWorth + xp/2` | ✓ CLEAN | experience.ts:40 |
| Reincarnation XP transfer (all children) | ✓ FIXED | reincarnate.ts:87,103 |
| Level-up stars | ✓ FIXED | experience.ts:68-70 |
| Level-up sound | ✓ FIXED | experience.ts:65 |
| Nav-mode speed (cleared room 3×) | ✓ FIXED | movement.ts:20,130 NAV_SPEED_MULT=3 |
| Walk-speed per level (player 0.075, enemy 0.045) | ✓ ADAPTATION | movement.ts:63-65; documented in _resweep_TRIAGE |
| Reel-input freeze | ✓ FIXED | control.ts:159-163 isHurt gate |
| Player initial stats (energy/strength/mana) | ✓ CLEAN | archetypes.ts:106-146 from act_player.txt |
| Mana random-stat levelUp (one-of-four) | ✓ CLEAN | mana.ts:33-40 `switch(1+floor(rng*4))` |
| Reincarnate `j=1` bug → all-at-same-loc | ✓ INTENTIONAL | scatter fix in reincarnate.ts:89-99, documented |
| Reincarnate lethal-death gate (`getKilledInAction`) | ✓ CLEAN | reincarnate.ts:71 |
| Reincarnate fire-once latch | ✓ CLEAN | reincarnate.ts:57,73 `done=true` |
| Player mana_regeneration=30 (cooldown divisor) | ✓ CLEAN | act_player.txt → Mana.regeneration:30 |

---

FILE=_resweep_playerXp | GAPS=2 | GAP-1: `experienceAmountForNextLevel` not forwarded in `spawnEnemy` — enemies default to threshold=10 instead of Lingo default 0, breaking first-level gate and full XP curve for all enemies (archetypes.ts spawnEnemy build call, experience.ts:23). GAP-2: `CpuAI` has no `levelUp` handler — enemy melee strength never grows on level-up (control.ts CpuAI.static handles, vs bytecode modCharacterAttackProperties.internalEvent #levelUp → incStrengthLevel).
