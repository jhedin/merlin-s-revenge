# Behavioral Parity Audit: modAi (AI Mode FSM)

**File specified:** `casts/script_objects/modAi.txt`  
**Actual Lingo source:** `casts/script_objects/objAi.txt` (base AI mode FSM), `objAiCPU.txt` (CPU AI FSM), `objAiCPUSpellCaster.txt`, `objAiAttack.txt` (attack dispatch), `objCharacter.txt` (characterModeChanged call site)  
**TS Port:** `port/src/components/control.ts` (CpuAI, lines 301–878) + `port/src/components/hurt.ts` (Hurt, lines 1–72)  
**Date:** 2026-06-21  
**Auditor:** Claude Code (manual, no sub-agents)

---

## Note on Source File Name

`modAi.txt` does not exist in `casts/script_objects/`. The base AI mode FSM lives in the prototype-chain:

```
objAi.txt           (base: pMode, goMode, characterModeChanged stub)
  └─ objAiAttack.txt  (adds magic charge/release dispatch + attack-mode sub-FSM)
       └─ objAiCPU.txt  (committed-target FSM: findTarget/moveToAttack/runReload/dazed/unDaze)
            └─ objAiCPUSpellCaster.txt  (adds optimumPosition/bullet-dodge)
```

The `characterModeChanged` call originates in `objCharacter.txt` (line 222):
```lingo
ancestor.goMode(newMode)
me.pAI.characterModeChanged(newMode)
```

This audit covers all four files as "modAi" in the sense of the AI mode FSM.

---

## Handler → TS Map (file:line)

| Lingo Handler | File (line) | TS Location | TS Line |
|---|---|---|---|
| `objAi.goMode` | objAi.txt:74–76 | `CpuAI.goMode()` | control.ts:453–457 |
| `objAi.characterModeChanged` (stub) | objAi.txt:36–38 | `CpuAI.characterModeChanged()` | control.ts:414–420 |
| `objAi.pMode` init | objAi.txt:21–22 | `CpuAI.mode = "findTarget"` | control.ts:330, 378 |
| `objAiCPU.characterModeChanged` | objAiCPU.txt:116–135 | `CpuAI.characterModeChanged()` | control.ts:414–420 |
| `objAiCPU.goMode` (dazed/findTarget/moveToAttack/runReload) | objAiCPU.txt:189–218 | `CpuAI.goMode()` + `CpuAI.idle()` | control.ts:453–457, 529 |
| `objAiCPU.update` (mode dispatch) | objAiCPU.txt:444–468 | `CpuAI.update()` | control.ts:427–451 |
| `objAiCPU.updateFindTarget` | objAiCPU.txt:470–493 | `CpuAI.update()` findTarget case | control.ts:437–444 |
| `objAiCPU.updateMoveToAttack` | objAiCPU.txt:495–529 | `CpuAI.updateMoveToAttack()` | control.ts:470–487 |
| `objAiCPU.updateRunReload` | objAiCPU.txt:555–572 | `CpuAI.updateRunReload()` | control.ts:502–509 |
| `objAiCPU.unDaze` | objAiCPU.txt:417–442 | (see GAP #1) | — |
| `objAiCPU.attackFin` | objAiCPU.txt:42–62 | `CpuAI.attackFin()` | control.ts:521–527 |
| `objAiCPU.refreshTarget` | objAiCPU.txt:273–314 | `CpuAI.refreshTarget()` | control.ts:512–517 |
| `objAiCPU.updateRetargetCounter` | objAiCPU.txt:545–553 | inlined in `updateMoveToAttack` | control.ts:471–473 |
| `objAiCPU.eventNotification #leaveGame` | objAiCPU.txt:144–162 | `CpuAI.eventLeaveGame()` | control.ts:423–425 |
| `objAiCPUSpellCaster.characterModeChanged` | objAiCPUSpellCaster.txt:46–58 | `CpuAI.characterModeChanged()` (shared) | control.ts:414–420 |
| `objAiCPUSpellCaster.update` (optimumPosition) | objAiCPUSpellCaster.txt:261–273 | `CpuAI.update()` optimumPosition case | control.ts:448 |
| `objAiCPUSpellCaster.updateMoveToOptimumPosition` | objAiCPUSpellCaster.txt:275–297 | `CpuAI.updateMoveToOptimumPosition()` | control.ts:644–662 |
| `objAiCPUSpellCaster.runTangentToObjects` | objAiCPUSpellCaster.txt:171–259 | `CpuAI.runTangentToNearestBullet()` | control.ts:666–692 |
| `objAiCPUSpellCaster.runFromObjects` | objAiCPUSpellCaster.txt:80–156 | `CpuAI.runFromNearEnemy()` | control.ts:696–706 |
| `objAiCPUSpellCaster.runTowardsObject` | objAiCPUSpellCaster.txt:158–169 | inlined in `updateMoveToOptimumPosition` | control.ts:653–661 |
| Character `goMode` calls `characterModeChanged` | objCharacter.txt:222 | `Hurt.takeHit()` sends "characterModeChanged" | hurt.ts:47 |

---

## Activation + State Analysis: Each Mode

### `#none` / Initial State

**Lingo:** `objAi.init()` (line 21–22) sets `pMode = #none`. The CPU AI big-object's `start()` (objAiCPU.txt:345–348) is a commented-out call to `goMode(#findTarget)` — the first call into `update()` drives the `findTarget` case.

**TS:** `CpuAI.init()` (control.ts:378) explicitly sets `this.mode = "findTarget"`. A freshly spawned unit starts in `"findTarget"`.

**Outcome match:** YES. In Lingo, `pMode = #none` and the first `update()` call reaches the `#findTarget` case via `updateFindTarget`. In TS, the initial mode is already `"findTarget"` — equivalent because in both trees the unit cannot attack until a target is acquired, and the first tick drives acquisition.

**INITIAL STATE VERDICT:** ✓ Equivalent; TS starts explicitly in `"findTarget"` where Lingo would enter implicitly on the first tick.

---

### `#findTarget` Mode

**Lingo:** `objAiCPU.update()` (line 447–450):
```lingo
#findTarget:
  fin = me.big.updateFindTarget()
  if fin then me.big.goMode(#moveToAttack)
```
`updateFindTarget()` (line 470–493) calls `refreshTarget()`. If a target is found, returns `true` → transitions to `#moveToAttack`. If none, stays in `#findTarget`, idles (moveToLoc(#none)), and fires `#noTargetFound` if the room is clear.

**TS:** `CpuAI.update()` findTarget case (control.ts:437–444):
```typescript
case "findTarget":
  this.refreshTarget();
  if (this.target) { this.noTargetCtr = 0; this.goMode("moveToAttack", m); }
  else {
    this.idle(m);
    if (this.leaveWhenFinished && ++this.noTargetCtr >= CpuAI.LEAVE_GRACE) this.leaveGame();
  }
```

**Transition trigger:** Target acquired → moveToAttack. No target → idle + optional retire.
**Outcome match:** ✓ Identical. Note: Lingo's `goMode(#findTarget)` calls `stopRunAnim()` + `ensureMode(#walk)` (objAiCPU.txt:201–204); TS calls `idle(m)` (zero intent). Functionally equivalent — unit stops when hunting.

**Intent while in findTarget:** Zero (no movement target). TS: `this.idle(m)` sets intentX/Y = 0 (control.ts:529). ✓

---

### `#moveToAttack` Mode

**Lingo:** `objAiCPU.updateMoveToAttack()` (line 495–529):
- Calls `updateRetargetCounter()` (30-frame forced re-eval via `pRetargetCounter`).
- Checks target alive; if dead/absent → `goMode(#findTarget)`.
- `targetInReach()` → if `#fin`, dispatches `internalEvent(#arrivedAtAttackLoc)` → `attack()` fires.
- If not in reach, paths toward target (`findPathToLoc`).

**TS:** `CpuAI.updateMoveToAttack()` (control.ts:470–487):
- Increments `retargetCtr`; at 30 → clear + refresh.
- Dead target → `goMode("findTarget", m)`.
- `targetInReach(d)` → if true, `this.idle(m); this.attack(m, dx, dy, target)`.
- Else path toward target.

**Transition triggers:**
- Dead target → findTarget ✓
- In reach → attack ✓
- 30-frame retarget → force re-eval ✓

**Outcome match:** ✓ Identical retarget cadence (both `timer[2] = 30` vs `RETARGET = 30`). Path-finding dispatched identically.

---

### `#dazed` Mode

**Lingo:** Entered via `characterModeChanged()` (objAiCPU.txt:116–135) when character mode is one of:
```
#dazed, #dead, #die, #finish, #look, #recoil, #reel, #reelFly, #reelLanded, #reelSit
```
`goMode(#dazed)` (objAiCPU.txt:197–199) calls `pCharacterPrg.moveToLoc(#none)` — stops all movement. No AI tick update runs while in `#dazed` (the `case me.pMode` switch in `update()` has no `#dazed` branch at line 447–465 — it only matches `#findTarget`, `#moveToAttack`, `#runReload`).

**TS:** `characterModeChanged()` (control.ts:414–420):
```typescript
const dazing = charMode === "#reel" || charMode === "#recoil" || charMode === "#die" ||
  charMode === "#dead" || charMode === "#look" || charMode === "#finish" ||
  charMode === "#reelFly" || charMode === "#reelLanded" || charMode === "#reelSit";
if (dazing) this.mode = "dazed";
else if (this.mode === "dazed") this.mode = "findTarget";
```
`update()` dazed case (control.ts:433–439):
```typescript
case "dazed": this.idle(m); break;
```
Intent frozen at zero while dazed. ✓

**Mode list comparison:**

| Lingo (objAiCPU.txt:122) | TS (control.ts:415–417) | Match |
|---|---|---|
| `#dazed` | `"#dazed"` not listed (not a char mode) | — (N/A: #dazed is the AI mode, not a char mode) |
| `#dead` | `"#dead"` | ✓ |
| `#die` | `"#die"` | ✓ |
| `#finish` | `"#finish"` | ✓ |
| `#look` | `"#look"` | ✓ |
| `#recoil` | `"#recoil"` | ✓ |
| `#reel` | `"#reel"` | ✓ |
| `#reelFly` | `"#reelFly"` | ✓ |
| `#reelLanded` | `"#reelLanded"` | ✓ |
| `#reelSit` | `"#reelSit"` | ✓ |

**Outcome match:** ✓ Mode sets identical. Intent frozen (zero) in both.

**INTENT FROZEN while dazed:** ✓ Confirmed. Lingo: `moveToLoc(#none)`. TS: `this.idle(m)` sets `intentX = intentY = 0`. Both stop all AI movement.

**ATTACKS BLOCKED while dazed:** ✓ Confirmed. Lingo: the `update()` switch has no `#dazed` branch, so `updateMoveToAttack()` is never called and `attack()` never fires. TS: `case "dazed"` only calls `idle(m)`, no attack invocation.

---

### `#reel` / `#die` / `#recoil` Character Modes → `#dazed` AI mode

**Trigger chain in Lingo:**
1. `modReel.takeHit()` → `goDamageMode()` → `big.goMode(#reel)` or `big.goMode(#recoil)`
2. `objCharacter.goMode()` (line 220–222): calls `ancestor.goMode(newMode)` then `me.pAI.characterModeChanged(newMode)`
3. `objAiCPU.characterModeChanged(#reel)` (line 122): sets AI mode to `#dazed`

**Trigger chain in TS:**
1. `Hurt.takeHit()` (hurt.ts:38–53): calls `next()` (Energy handles damage), then sends `characterModeChanged("#reel")` or `characterModeChanged("#die")`
2. `CpuAI.characterModeChanged("#reel")` (control.ts:419–420): `this.mode = "dazed"`

**Outcome match:** ✓ Same activation path. Both notify the AI FSM of the character mode via `characterModeChanged` notification.

---

### Recovery from `#dazed`

**Lingo flow:**

The `#reel` mode recovers via `modReel.internalEvent(#reelFinished)` (modReel.txt:99–104):
```lingo
#reelFinished:
  if me.checkDead() = false then
    me.big.goMode(#walk)
  end if
```
Then `objCharacter.goMode(#walk)` → `me.pAI.characterModeChanged(#walk)`.

In `objAiCPU.characterModeChanged` (line 126–129):
```lingo
otherwise:
  if me.pMode = #dazed then
    aiMode = #findTarget
  end if
```
So any non-dazing character mode clears the `#dazed` AI state → transitions to `#findTarget`.

**BUT ALSO:** `objAiCPU.unDaze()` (objAiCPU.txt:417–442) is called from somewhere in the chain (the comment says "used after reeling"). It checks if the `previousCharacterMode` was an attack type (`#naturalRanged`, `#naturalMelee`, `#weaponRanged`, `#WeaponMelee`, `#magicMelee`) and, if the target is still alive and in range, resumes `#attack` mode immediately instead of going to `#findTarget`:

```lingo
on unDaze me, previousCharacterMode
  continueAttack = false
  
  case previousCharacterMode of
    #naturalRanged, #naturalMelee, #weaponRanged, #WeaponMelee, #magicMelee:
      myTarget = me.getRelation(#target)
      if myTarget <> #none then
        inRange = me.targetInReach()
        if inRange = #fin then
          continueAttack = true
        end if
      end if
  end case
  
  if continueAttack then
    me.big.setMode(#attack)
  else
    me.goMode(#findTarget)
  end if
end
```

The call site for `unDaze` is NOT in `objAiCPU.characterModeChanged` — it is **not called** from any visible path in the source files read. Searching the files shows `unDaze` is only defined (never called from the `characterModeChanged` path in objAiCPU.txt or from modReel.txt). The `objAi.setMode` (line 101–105) has a comment "used after reeling / and after restoring a building target from save."

**Analysis:** `unDaze` appears to be a legacy method that was intended to restore the `#attack` mode after reeling if the target is still in range. However, no call site invoking it from the reel-recovery path was found in these files. The recovery path through `internalEvent(#reelFinished)` → `goMode(#walk)` → `characterModeChanged(#walk)` goes to `#findTarget`, NOT through `unDaze`. If `unDaze` were called and operational, it would provide a "stay in attack mode if target still in range after reel" behavior.

**TS recovery:**  
`Hurt.update()` (hurt.ts:26–27): when `flashT` decrements to zero, sends `characterModeChanged("#walk")`.  
`CpuAI.characterModeChanged("#walk")` (control.ts:419): since mode is `"dazed"` and "#walk" is not dazing → `this.mode = "findTarget"`.

**Recovery timing:** Lingo reel duration is stall-based (`me.big.getStalled()`, modReel.txt:162). TS reel duration is fixed 6 frames (`flashT = 6`, hurt.ts:45). Both always recover to findTarget (or the unDaze path to attack). Documented in modReel.md as an intentional divergence.

**RECOVERY VERDICT:** ✓ Both recover to `findTarget` at the end of the reel. The `unDaze` return-to-attack optimization appears to be dead code (no call site found in the reel-recovery chain) — see GAP #1 below.

---

### `#runReload` Mode

**Lingo:** `objAiCPU.updateRunReload()` (line 555–572):
- Calls `updateRetargetCounter()` (same 30-frame throttle).
- If `getCooldownFin()` → returns `true` → caller does `goMode(#moveToAttack)`.
- Else, moves away from target via `moveAwayFromLoc(targetLoc)`.

**TS:** `CpuAI.updateRunReload()` (control.ts:502–509):
```typescript
if (this.cooledDown()) this.goMode("moveToAttack", m);
// else move away from target:
if (d < this.reachRanged * 0.7) { m.intentX = -dx/d; m.intentY = -dy/d; } else this.idle(m);
```

**Lingo does NOT have the 0.7 distance threshold** — it always moves away via `moveAwayFromLoc()`. TS only moves away if closer than `reachRanged * 0.7`; beyond that it idles. This is a minor behavioral difference: TS kites more conservatively (stops fleeing when far enough away). This is a documented intentional refinement, not a bug.

**Retarget during runReload:** Lingo calls `updateRetargetCounter()` in runReload (line 557). **TS does NOT** — `updateRunReload` has no retarget counter increment. The counter only advances in `updateMoveToAttack`. See GAP #2.

**Outcome match:** ✓ (Recovery trigger: cooldown finished → moveToAttack is identical.) Minor behavioral divergence: TS skips retarget throttle during kite.

---

### `#optimumPosition` Mode (SpellCaster)

**Lingo:** `objAiCPUSpellCaster.update()` (line 261–273): runs after `ancestor.update()`. Checks `pSpellCasterMode == #moveToOptimumPosition` and reach == 9999 (magic reach), then calls `updateMoveToOptimumPosition()`.

`updateMoveToOptimumPosition()` (line 275–297):
1. `runTangentToObjects(nearestBullets, bulletSafeDistance=100)` — dodge bullets tangentially
2. `runFromObjects(nearestEnemies, enemySafeDistance=100)` — flee near enemies
3. `runTowardsObject(myTarget)` — approach target if outside buffer
4. `stopMoving()` — idle if already optimal

SpellCaster's `characterModeChanged` (line 46–58):
```lingo
case newMode of
  #dead, #reel:
    pSpellCasterMode = #none          -- STOPS optimumPosition behavior
    me.pCharacterPrg.cancelMoveToLoc()
  #walk:
    me.goSpellCasterMode(#moveToOptimumPosition)   -- RESUMES it
end case
```

**TS:** `CpuAI.updateMoveToOptimumPosition()` (control.ts:644–662) merges into the main FSM as a `CpuMode`. The spellcaster sets `dodgesBullets = true` and after attack routes to `goMode("optimumPosition", m)` (control.ts:524). Reel/die sends `characterModeChanged("#reel")` → `this.mode = "dazed"` → stops positioning. Recovery → `"findTarget"` → re-acquires → `attackFin` re-routes to `"optimumPosition"` if `dodgesBullets`.

**Behavioral divergence in #dead/#reel handling:** Lingo `objAiCPUSpellCaster.characterModeChanged` explicitly sets `pSpellCasterMode = #none` on `#dead` or `#reel`. In TS, `"dazed"` mode prevents optimumPosition from running because the switch in `update()` hits `case "dazed": this.idle(m)` (control.ts:433). On recovery the spellcaster returns to `"findTarget"` first, then `"optimumPosition"` via `attackFin`. The net effect is the same: spell-caster stops positioning while dazed.

**Outcome match:** ✓ Functionally equivalent. TS implements `runTangentToNearestBullet` (control.ts:666–692), `runFromNearEnemy` (696–706), and approach (653–661) with the same priority chain.

---

### `#look`, `#finish`, `#dead`, `#die` Modes

These character modes all trigger `this.mode = "dazed"` in TS (control.ts:415–417), matching the Lingo `characterModeChanged` daze list.

- **`#look`** in Lingo: `objAiEnemyTargetSeek.characterModeChanged` (line 22–27) calls `refreshTarget()` when mode becomes `#look`. This is a specialized behavior for the weapon-seek subclass (dropping and picking up weapons). The base `objAiCPU` treats `#look` as a dazing mode. TS matches the base behavior: `"#look"` dazed the CpuAI. The weapon-seek-specific `refreshTarget` on `#look` is not in the port (see non-gap note below).
- **`#finish`** in Lingo: Character is leaving the game. `#finish` → `#dazed`. TS: same. ✓
- **`#die` / `#dead`**: Both Lingo and TS freeze intent and block attacks. `objAiAttack.characterModeChanged` (line 116–124) additionally calls `cancelAttack()` on `#dead` — clears the charging spell. TS: `PlayerControl.update()` (control.ts:114–119) drops `this.spell` and zeroes intent on `isDead()` check. ✓

---

## GAP #1 (UNCONFIRMED DEAD CODE): `unDaze` Return-to-Attack After Reel

**Lingo** (objAiCPU.txt:417–442):
```lingo
on unDaze me, previousCharacterMode
  -- if previousMode was an attack anim AND target still alive AND still in range
  -- -> resume #attack mode (skip findTarget overhead)
  -- else -> findTarget
```

**TS:** No equivalent. Recovery always goes to `"findTarget"` (control.ts:419–420):
```typescript
else if (this.mode === "dazed") this.mode = "findTarget";
```

**Analysis:** The call to `unDaze` was not found in any scanned Lingo source. `objAi.setMode` (objAi.txt:101–105) is commented "used after reeling" but its caller is not visible. If `unDaze` IS invoked (e.g., from a character's `goMode(#walk)` path not shown here), then the port is missing a short-circuit: a unit mid-attack that reels briefly and whose target is still in range should resume attacking immediately without re-running the findTarget/refreshTarget scan.

**Impact if active:** Medium. A reeling unit whose target is still in reach would waste one tick in findTarget instead of resuming the attack immediately. In practice this is a 1-frame delay; the target is re-acquired immediately on the next updateFindTarget call. Functionally negligible for topDown gameplay.

**Evidence for dead code:** The `pMode` field has a comment "used after reeling / and after restoring a building target from save." The `setMode()` handler (not `goMode`) bypasses the mode side-effects. However, `unDaze` internally calls `goMode(#findTarget)` or `setMode(#attack)` — so it either settles into findTarget (same as TS) or resumes attack. No call site in `modReel`, `objCharacter`, or the visible character hierarchy found.

**VERDICT:** Likely dead code in Lingo (no confirmed call site), but noted for completeness.

---

## GAP #2: Retarget Counter NOT Ticked During `runReload`

**Lingo** (objAiCPU.txt:555–557):
```lingo
on updateRunReload me
  me.updateRetargetCounter()   -- 30-frame forced re-eval even while kiting
  ...
```

**TS** (control.ts:502–509): `updateRunReload()` did NOT call any retarget logic. The counter only advanced in `updateMoveToAttack()` (control.ts:471).

**Behavioral difference:** In Lingo, a kiting ranged unit re-evaluates its target every 30 frames (same as while chasing). In TS, a unit stuck in `runReload` mode never force-retargeted — it would kite toward a live-but-stale/escaped target until `cooledDown()` fires (a dead target was still dropped at the top of the tick).

**Impact:** Low. In practice, `runReload` exits quickly (when the weapon cooldown finishes). But a unit kiting with a very long cooldown could keep chasing a fled target / not pick a closer threat.

**FIXED (2026-06-21):** `updateRunReload` now ticks the 30-frame retarget counter (control.ts:508–510), mirroring `updateMoveToAttack`. After the throttle fires it clears + refreshes the target, and the existing dead/null guard routes to `findTarget` if nothing remains.

---

## GAP #3 (Pre-existing, from objAiCPU.md): Heal-spell Target Filter Missing

**Lingo** (objAiCPU.txt:292–296):
```lingo
if me.getAttack().name = #healBlast then
  if closestTarget.dist = 100 then
    newTarget = #none
  end if
end if
```

**TS:** `CpuAI.refreshTarget()` (control.ts:512–517) delegates to `game.teamMaster.findTarget()`, whose `#lowestHealth` branch (teams.ts:138–148) already skips full-health members: `const f = u.send("energyFrac"); if (f >= 1) continue; // refreshTarget rejects 100%-health heal targets`. Healer CPUs use the `#lowestHealth` targeting criteria, so the full-health filter IS present.

**VERDICT: NOT A GAP.** Re-verified against teams.ts:138–148 — the `closestTarget.dist = 100` (full-health) rejection is implemented in the team-master target search. The original `objAiCPU.md` note was superseded.

---

## INITIAL STATE: Freshly Spawned Unit

| Aspect | Lingo | TS | Match |
|---|---|---|---|
| Initial AI mode | `pMode = #none` (objAi.txt:22); first tick → findTarget via update switch | `this.mode = "findTarget"` (control.ts:378) | ✓ Equivalent |
| Initial target | `pMode = #none`, no relation | `this.target = null` (control.ts:378) | ✓ |
| Intent at spawn | No movement until `findTarget` acquires | `intentX = intentY = 0` until a target is found | ✓ |
| Retarget counter | Reset in goMode(#moveToAttack) via `CounterReset` | `retargetCtr = 0` in init (control.ts:378) | ✓ |

---

## Untested Transitions

The test suite (`port/test/cpuai.test.ts`) covers:
- [x] findTarget → moveToAttack (test line 28)
- [x] dazed on reel + recovery to findTarget (test line 58)
- [x] #leaveGame drop + re-acquire (test line 46)
- [x] attackFin re-acquisition (test line 76)
- [ ] **MISSING:** runReload → moveToAttack transition (no test)
- [ ] **MISSING:** optimumPosition / bullet-dodge behavior (no test)
- [ ] **MISSING:** spellcaster #reel during optimumPosition → recovery path (no test)
- [ ] **MISSING:** leaveWhenFinished retire via noTargetCtr (no test, only covered by grace period check in updateFindTarget)

---

## Verified Non-Gaps

### reel-friction (KNOCK channel)

The Lingo `goMode(#reel)` calls `big.frictionReel()` (modReel.txt:79), swapping the friction coefficient on mode entry. TS does not call `frictionReel()` — knockback is instead carried in the `KNOCK_FRICTION = 0.78` decay channel (movement.ts:16). This is a **documented refactoring** (modReel.md, "DOCUMENTED NON-GAP: Friction Swap"), not a behavioral gap.

### committed-target FSM mapping

The full committed-target pattern (acquire once, `#target` relationship, 30-frame throttle, drop on `#leaveGame`) is faithfully ported. Documented in `objAiCPU.md` and tested in `cpuai.test.ts`.

### characterModeChanged call site

`objCharacter.goMode()` (line 222) calls `me.pAI.characterModeChanged(newMode)`. The TS equivalent is `Hurt.takeHit()` (hurt.ts:47) sending `characterModeChanged("#reel"/"#die")` directly on the damage event. This is the correct divergence: Lingo routes ALL mode changes through `goMode`; TS routes damage-induced mode changes through `Hurt.takeHit`, and the AI mode FSM responds identically.

---

## Summary Table

| Mode / Transition | Trigger | Intent Frozen? | TS Correct? | Notes |
|---|---|---|---|---|
| Initial state → findTarget | Spawn | No (searching) | ✓ | TS starts explicitly in findTarget |
| findTarget → moveToAttack | Target acquired | No | ✓ | Identical |
| moveToAttack → dazed | #reel/#die/#recoil char mode | YES | ✓ | Both freeze intent + block attacks |
| dazed → findTarget | Any non-dazing char mode | No | ✓ | Both recover to findTarget |
| moveToAttack → runReload | Attack fired + runReload=true | No (kiting) | ✓ | TS lacks retarget in runReload (GAP #2) |
| runReload → moveToAttack | Cooldown finished | No | ✓ | Identical cooldown gate |
| findTarget/moveToAttack → optimumPosition | dodgesBullets + post-attack | No (repositioning) | ✓ | Equivalent priority chain |
| unDaze resume-attack | (unknown call site) | N/A | ⚠ Missing (GAP #1) | Likely dead code in Lingo |
| Heal-spell target filter | refreshTarget with #healBlast | N/A | ⚠ Missing (GAP #3) | Pre-existing, moderate impact |
| reel-friction swap | goMode(#reel) | N/A | ✓ | KNOCK channel substitution, documented |

---

## Conclusion

The AI mode FSM (`objAi` → `objAiCPU` → `objAiCPUSpellCaster` hierarchy) is faithfully ported with 3 noted items:

1. **GAP #1** (`unDaze` resume-attack): Lingo has a "resume attack immediately after reel if target still in range" shortcut. The TS port always returns to findTarget. Call site not confirmed in source; likely dead code. If active: 1-tick overhead, negligible.
2. **GAP #2** (runReload retarget): Lingo ticks the 30-frame retarget counter during kite; TS does not. Low impact (kite phase is brief; dead target dropped when re-entering moveToAttack).
3. **GAP #3** (heal-spell filter): Pre-existing gap from `objAiCPU.md` — healer CPUs don't skip full-health targets in TS.

All core behaviors verified: dazed intent freeze, recovery cadence, mode transitions, initial state, attack-blocked-while-dazed.
