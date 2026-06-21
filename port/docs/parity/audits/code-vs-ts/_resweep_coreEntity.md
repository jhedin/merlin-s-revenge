# Re-sweep: Core Entity / Knockback / Reel — Six-Lens Audit

**Target Lingo files:** `objGameObject.txt`, `objCharacter.txt`, `modReel.txt`  
**Authoritative globals:** `extracted/engine/scripts/MovieScript 1 - GameSpecific.ls`  
**TS impl files:** `port/src/components/movement.ts`, `port/src/world/collision.ts`,
`port/src/components/hurt.ts`, `port/src/components/control.ts`, `port/src/components/anim.ts`  
**Prior audits consulted:** `objGameObject.md`, `objCharacter.md`, `modReel.md`  
**Date:** 2026-06-21

---

## Purpose

This re-sweep applies all SIX lenses to every handler in the three target files, specifically
hunting "present-but-wrong" bugs missed by the earlier single-lens translation audit:

1. **TRANSLATION** — formula/constants/ordering/branch-logic match
2. **ACTIVATION** — trigger actually fires at runtime (call-path trace)
3. **GLOBAL/INITIAL STATE** — globals/defaults match extracted bytecode
4. **PLAYER-POV** — observable signal correct in magnitude/timing/direction (not just "present")
5. **DRAW-ORDER/OCCLUSION** — rendered content at right z-order / not hidden
6. **MISSING-TEST** — player-visible behavior has observable coverage

---

## objGameObject.txt — Handler-by-Handler

### `takeHit` (lines 781–788)

Lingo applies inertia to ALL units unconditionally, then passes the damped vector to
`pMoveXY.vectAdd()`. **No reelProof check at this level** — reelProof only gates reel
MODE in `modReel.takeHit`.

```lingo
on takeHit me, collideVect, attacker
  percent = 100 - pInertia
  collideVect[1] = VarValRange(percent, [0, collideVect[1]])
  collideVect[2] = VarValRange(percent, [0, collideVect[2]])
  me.pMoveXY.vectAdd(collideVect)   -- knockback applied to ALL units
  me.ancestor.takeHit(collideVect, attacker)
end
```

1. **TRANSLATION** — Formula match: `VarValRange(100-i,[0,v]) = v*(100-i)/100` matches TS
   `d=(100-i)/100; dvx=vx*d` at `movement.ts:82`. ✓  
   **BUT** `movement.ts:84` wraps the knockback application in
   `if (!this.entity.send("isReelProof"))` — which has no counterpart in the Lingo path.  
   **GAP-1: reelProof incorrectly suppresses knockback impulse.**

2. **ACTIVATION** — `takeHit` is called from combat resolvers (TeamMaster, spell impact). Call
   path is active. The bug fires every time a reelProof unit is hit. ✓ (fires, wrong branch)

3. **GLOBAL/INITIAL STATE** — `pInertia` defaults 0 (objGameObject init), matching `inertia=0`
   in `movement.ts:28`. Passed per-actor via cfg. ✓

4. **PLAYER-POV** — ReelProof units (skelitonHead, summonBoulder, dwarfTower, garTower, plant,
   etc.) should be visibly shoved backwards on hit but never stagger. In TS they receive ZERO
   knockback — they sit completely still. **Wrong** — towers and inert enemies that should absorb
   hits and visibly recoil do not move. Observable.

5. **DRAW-ORDER** — N/A (positional, not rendered)

6. **MISSING-TEST** — No test covers reelProof-unit position-after-hit.

---

### `calcNewRect` (lines 227–245)

Lingo shaves 4 px off the top of the collision rect when `gPlayerHair = 1`. Authoritative
global from `GameSpecific.ls`: `gPlayerHair = 0`. Effect is dead code in both trees. TS uses
a symmetric box (`movement.ts:28`: `box=12`). Non-gap.

1. **TRANSLATION** — Dead code path confirmed by global. ✓
2–6. Dead code, no observable effect. ✓

---

### `frictionXOff` / friction values

Lingo: `frictionReel = point(10,10)`, `friction = point(50,50)`, `frictionXOff` sets X to 5.
TS replaces the friction-mode system with a separate `kvx/kvy` knockback channel decayed by
`KNOCK_FRICTION=0.78`. Prior audit (`objGameObject.md`) confirmed this is an intentional
architectural replacement, not a gap.

1. **TRANSLATION** — Replaced; documented in prior audit. ✓
2. **ACTIVATION** — KNOCK channel fires and decays correctly. ✓
3. **GLOBAL/INITIAL STATE** — TS `friction=0.6` (walk deceleration) and `KNOCK_FRICTION=0.78`
   calibrated for px-scale. Reasonable approximation. ✓
4. **PLAYER-POV** — Knockback feel approximated; see GAP-1 (wrong for reelProof units). For
   normal units the channel works correctly.
5–6. N/A. ✓

---

### `exitedPlayArea`

Lingo fires when actor leaves the play area. TS handles this via `maxLife` expiry and
`constrainToArea` flag. Prior audit confirmed non-gap for actors in scope.

---

## objCharacter.txt — Handler-by-Handler

### `goMode` (lines 188–223)

Lingo: mode FSM. `#die` plays dieSound. `#reel`/`#recoil`/`#reelFly` etc. set friction.

1. **TRANSLATION** — TS Hurt.takeHit sends `characterModeChanged("#die")` on lethal hit,
   which plays dieSound via Energy.takeHit (`combat.ts:43`). Mode changes route correctly
   through CpuAI.characterModeChanged (`control.ts:486`). ✓
   `#reelFly` / `#fall` / `#jump` / `#charge` path: confirmed dead code (`gGameView=#topDown`,
   sideOn-only paths commented out in modReel). Non-gap.

2. **ACTIVATION** — characterModeChanged fires on each hit. ✓

3. **GLOBAL/INITIAL STATE** — `gGameView = #topDown` (GameSpecific.ls) kills sideOn-gated
   branches. TS never implements them. ✓

4. **PLAYER-POV** — Enemy stagger (reel strip) shows on non-reelProof units. ✓ (except
   GAP-1 prevents visible shove on reelProof units)

5. **DRAW-ORDER** — Reel anim strip: `Hurt.animAction` returns "reel" when `flashT>0`; anim
   system renders correct strip. ✓

6. **MISSING-TEST** — No test verifies characterModeChanged("#reel") triggers correctly after
   hit. Present in prior tests as implicit pass.

---

### `collisionPlatform` (lines 130–141)

Lingo: transitions mode from `#reelFly` → `#reelLanded` on platform contact. Dead code
(`gGameView=#topDown`). TS does dispatch `collisionPlatform` events (movement.ts:158) but
no component handles the `#reelFly→#reelLanded` transition because the sideOn FSM states
are unused. Non-gap.

---

### `update` (lines 299–335): attack / die / release state machines

1. **TRANSLATION** — Attack tick: CpuAI.update (`control.ts`) drives findTarget → attack
   state machine. Die/release handled by EntityManager. ✓

2. **ACTIVATION** — update fires every tick. ✓

3. **GLOBAL/INITIAL STATE** — N/A

4. **PLAYER-POV** — Enemies correctly stop moving while reeling (`isHurt` gates intent at
   `control.ts:160`). ✓

5–6. ✓

---

### `collisionWall` / `collisionVertical` (objCPUCharacter.txt lines 103–137)

**This is the second gap.** Lingo applies wall-impact damage during reel mode:

```lingo
on collisionWall me
  vectX = me.pMoveXY.getVectX()
  vectX = VarPositive(vectX)   -- absolute value
  case me.big.getMode() of
    #reel, #reel_fly, #reel_land:
      me.takeDamage(vectX)     -- only fires if vectX > pDamageSpeed (default 5)
  end case
  me.ancestor.collisionWall()
end

on collisionVertical me
  vectY = me.pMoveXY.getVectY()
  vectY = VarPositive(vectY)
  case me.big.getMode() of
    #reel, #reel_fly, #reel_land:
      me.takeDamage(vectY)
  end case
end
```

`takeDamage(amount)` in `modEnergy`: fires `loseEnergy(amount - pDamageSpeed)` only if
`amount > pDamageSpeed` (default 5). At px-scale the walk vx cap is 4 px/tick, so the
threshold is never reached from normal walking — this is *specifically* a reel-mode feature
(knocked units moving fast enough to slam walls take extra damage).

1. **TRANSLATION** — Movement.update (`movement.ts:155–156`) dispatches `collisionWallLeft`
   and `collisionWallRight` events. No component listens for these to apply wall-impact
   damage. **GAP-2: wall-impact damage during #reel is missing entirely.**

2. **ACTIVATION** — Events dispatch correctly but reach no handler. Dead call path for
   damage purpose.

3. **GLOBAL/INITIAL STATE** — `pDamageSpeed` default 5 not reproduced (no threshold system
   at all in TS).

4. **PLAYER-POV** — In the original, hard-reeled enemies that slam a wall take extra damage.
   This is the "throw them at the wall" feel of the knockback system. In TS, wall-slams
   during reel deal zero extra damage. The effect is absent for both CPU and player.

5. **DRAW-ORDER** — N/A

6. **MISSING-TEST** — No test for wall-slam extra damage.

---

## modReel.txt — Handler-by-Handler

### `addModParams` (lines 37–48)

Defaults: `recoil=false`, `recoilDuration=0`, `reelFinishSpeed=0.3`, `reelProof=false`,
`sitTime=30`.

1. **TRANSLATION** — `Hurt.init`: `reelProof` from cfg ✓; `flashT=6` hardcoded at
   `hurt.ts:45` (equivalent to sitTime-capped reel timer). `reelFinishSpeed=0.3` is replaced
   by the KNOCK_FRICTION decay model. ✓ (architectural replacement)

2. **ACTIVATION** — N/A (init-time).

3. **GLOBAL/INITIAL STATE** — `reelProof=false` default: `Hurt.reelProof=false` at
   `hurt.ts:11`. ✓

4–6. ✓

---

### `goDamageMode` (lines 50–61)

Lingo: if dead → goReelMode; if pRecoil → goMode(#recoil); else → goReelMode().

1. **TRANSLATION** — Mapped to Hurt.takeHit: `characterModeChanged(dead ? "#die" : "#reel")`.
   Recoil branch: no actors set `recoil:true` in archetypes (confirmed by grep); dead code
   in both trees. ✓

2. **ACTIVATION** — Fires on every non-reelProof hit. ✓

3–6. ✓

---

### `goReelMode` (lines 63–69)

Lingo: `if gGameView = #topDown then goMode(#reel)` (sideOn path commented out).

1. **TRANSLATION** — TS: `characterModeChanged("#reel")` at `hurt.ts:50`. ✓

2. **ACTIVATION** — Fires correctly. ✓

3. **GLOBAL/INITIAL STATE** — `gGameView=#topDown` confirmed. ✓

4–6. ✓

---

### `takeHit` in modReel (lines 108–114)

```lingo
on takeHit me, collideVect, attacker
  if pReelProof = false then
    me.goDamageMode()
  end if
  me.ancestor.takeHit(collideVect, attacker)
end
```

This gates ONLY mode-change on reelProof. Knockback (`vectAdd`) is applied upstream in
`objGameObject.takeHit` regardless. This confirms GAP-1 is a genuine bug.

1. **TRANSLATION** — TS Hurt.takeHit:44 gates both flash AND mode-change on `!reelProof`.
   This is correct for Hurt's role. But Movement.takeHit:84 also gates knockback on
   `isReelProof()` — that is incorrect and has no Lingo counterpart. **GAP-1 confirmed.**

2–6. See GAP-1 above.

---

### `updateReel` (lines 161–168)

Lingo: checks `me.big.getStalled()` — unit stops reeling when velocity drops below
`reelFinishSpeed=0.3`.

1. **TRANSLATION** — TS: reel ends when `Hurt.flashT` ticks down to 0 (6 ticks).
   No stall-check. Architectural difference: TS uses a fixed-duration reel rather than
   velocity-stall. For top-down with small KNOCK_SCALE the unit always slows within 6 ticks
   (KNOCK_FRICTION=0.78; after 6 ticks kvx ≈ original × 0.78^6 ≈ 23%). Practically
   equivalent. Non-gap.

2. **ACTIVATION** — flashT countdown in Hurt.update fires every tick. ✓

3–6. ✓

---

### `pSitCounter` / `sitTime=30`

Lingo: `CounterNew()` with `tim[2]=30`, gates the post-reel "sit" idle. TS uses `flashT=6`
hardcoded (no extra sit period). SitTime 30 > flashT 6 discrepancy: in Lingo the counter
ticks at `gGameSpeed` increments; `flashT` in TS is 6 game-ticks. The reel duration is
shorter in TS but the difference is slight and the enemy resumes intent correctly once
`flashT=0`. Noted minor calibration difference, not a functional gap.

---

## Confirmed Non-Gaps (summary)

| Signal | Reason |
|---|---|
| Inertia damping formula | `VarValRange(100-i,[0,v])` = TS `d=(100-i)/100` — exact match |
| `gNavMode=1` global | Feature-enabled flag; TS per-room activation is correct |
| calcNewRect top-shave | `gPlayerHair=0` makes dead code in both trees |
| `kvx/kvy` not saved | Saves occur between rooms (not mid-reel); low severity |
| Recoil mode | No actors use `recoil:true`; dead code in both trees |
| `#reelFly`/`#fall`/`#jump` FSM | `gGameView=#topDown`; sideOn-only path is dead in both trees |
| Stall-check vs fixed flashT | KNOCK_FRICTION means unit stops within 6 ticks; equivalent feel |
| frictionReel / frictionStrong swap | Replaced by KNOCK channel; confirmed in prior audit |
| `pDamageSpeed` threshold (non-reel) | Threshold only matters when speed > 5 px/tick; only relevant during reel (GAP-2) |

---

## GAPS

### GAP-1 — `movement.ts:84` reelProof incorrectly gates knockback impulse

**Severity:** Medium. Affects 11 live actor types (skelitonHead, summonBoulder, summonOrc,
summonWarrior, summonGolem, summonArcher, plant, garTower, dwarfTower, undeadInvasion,
orcInvasion).

**Lingo behavior:** `objGameObject.takeHit` applies knockback (vectAdd) to ALL units; only
`modReel.takeHit` gates mode-change on `pReelProof`.

**TS behavior:** `movement.ts:84` — `if (!this.entity.send("isReelProof"))` suppresses the
entire `kvx/kvy` impulse block. ReelProof units receive zero physical shove.

**Fix:** Remove the `isReelProof` guard from `Movement.takeHit`. Apply knockback always.
Keep `Hurt.takeHit:44` as-is (correctly gates only flash + mode-change). The comment at
`hurt.ts:68` ("Movement reads this to skip the knockback impulse") is wrong and should be
removed when fixing.

---

### GAP-2 — Wall-impact damage during #reel mode missing

**Severity:** Low–Medium. Affects all non-reelProof CPU units.

**Lingo behavior:** `objCPUCharacter.collisionWall/collisionVertical` apply
`takeDamage(speed)` when mode is `#reel`. `takeDamage` deducts `speed - pDamageSpeed` HP
(only fires if speed > default 5). Fast-reeling units slammed into walls take extra damage —
the "throw them at the wall" mechanic.

**TS behavior:** `movement.ts:155–158` dispatches `collisionWallLeft/Right/Ceiling/Platform`
events but no component listens for these to apply damage. The mechanic is entirely absent.

**Fix:** Add handlers in `Hurt` (or a new thin component) for `collisionWallLeft`,
`collisionWallRight`, and `collisionCeiling` that: check `this.entity.send("isHurt")` to
confirm reel-mode; compute `speed = Math.hypot(this.entity.tryGet(Movement)?.kvx, kvy)`;
if speed exceeds a threshold (px-scaled equivalent of 5), call `this.entity.send("takeHit")`
or directly invoke `Energy.takeHit` with the excess as damage.

---

## Summary

Two genuine "present-but-wrong" gaps found. Neither was caught by the prior single-lens
translation audit because in both cases the TS signal/event exists but the value (GAP-1:
zero instead of nonzero knockback) or handler (GAP-2: event dispatched, never consumed)
is wrong.
