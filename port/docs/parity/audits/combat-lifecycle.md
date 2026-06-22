# Combat-Lifecycle Audit — attack trigger → animation → hit/fire → cooldown

Scope: the full lifecycle of one attack for the player (`PlayerControl`) and CPU units (`CpuAI`):
how an attack is *triggered*, how the attack *animation* plays, *when* the hit/fire actually
resolves, the *facing* held during the swing, and how *cadence* (re-swing/re-fire) is gated.
Compares the TypeScript port (`port/src/`) against the original Director/Lingo (`casts/`,
`extracted/engine/scripts/`). **No source files were edited by this audit.** Citations are
`file:line`.

Files in play:
- `port/src/components/control.ts` — `PlayerControl.tryMelee`/`castMagic`, `CpuAI.attack`/`updateMoveToAttack`.
- `port/src/components/anim.ts` — `Anim` (the animation strip player).
- `port/src/components/weapon.ts` — `WeaponManager`, `resolveAttack`/`AttackData`, cooldown counters.
- `port/src/data/registry.ts` — `STRUCT_ATTACK` defaults (carries `animFrame: 2`).
- `port/src/generated/assets.json` — built anim strips (per-frame `dela`, `loop`).
- `port/src/generated/data.json` — actor `#attack` records (carry `#animframe`).

---

## ANIMATION-DRIVEN ATTACK MODEL (root cause)

This is the single architectural mismatch that produces *most* of the symptoms below. It is
called out first because every individual bug downstream is a consequence of it.

### What the original actually does

In the original, **the animation strip is the clock / source-of-truth** for an attack. The
attack does not "fire" from a code timer — it fires when the *looping attack animation reaches a
frame listed in the weapon's `#animframe`*. Confirmed in the Lingo:

- **`#animframe` is a FRAME-EVENT specifier**, scalar or list, living on each weapon's `#attack`
  proplist. Default `2` (`casts/master_objects/structMaster.txt:60`). Examples from
  `port/src/generated/data.json` (preserved verbatim from the originals):
  - `act_player` (`#punch`): `animframe 3`
  - `act_crossBow`: `animframe [2, 4, 6]` — a 3-shot burst
  - `act_fangBunnyBaby`: `animframe [5, 6, 7]`
  - `act_darkGolem`: `animframe [7, 14]`; `act_flameThrower`: `[1, 3, 5, 7]`
  - `act_energyBlast` / all `#magic`: `animframe #none` (magic fires on charge/release, not a frame)

- **The hit/fire is dispatched WHEN the animation crosses one of those frames.**
  `objAiAttack.updateAttack` (`casts/script_objects/objAiAttack.txt:389-414`) runs every tick the
  unit is in `#attack` mode:
  ```lingo
  on updateAttack me
    if me.isOnAttackFrame() then
      me.ID.bigMe.performAttack()        -- fires the hit/shot HERE
    end if
    if me.pCharacterPrg.getAnimLooped() then
      me.ID.bigMe.attackFin(#completed)  -- swing/loop complete
    end if
  end
  ```

- **`isOnAttackFrame`** (`casts/script_objects/modAttack.txt:577-621`) reads the strip's *current*
  frame and compares it against `#animframe`, de-duped per fresh frame:
  ```lingo
  on isOnAttackFrame me
    if me.pCharacterPrg.getAnimFrameFresh() = false then return false  -- only once per frame advance
    attackFrame  = pAttack.animFrame
    currentFrame = me.pCharacterPrg.getAnimFrame()
    if ilk(attackFrame) = #list then
      return (attackFrame.getPos(currentFrame) > 0)   -- current frame is IN the list
    else
      return (currentFrame = attackFrame)             -- exact match
    end if
  end
  ```

- **`performAttack`** (`objAiAttack.txt:297-321`) is the callback: it branches on
  `#melee`/`#ranged`/`beam` → `performMeleeAttack` / `performRangedAttack` / `performBeamAttack`,
  plays the sound, and `resetCooldown`s. It is invoked **once per `#animframe` crossing**.

- **The animation supplies the frame index/freshness**: `objAnimStrip`
  (`extracted/engine/scripts/ParentScript 81 - objAnimStrip.ls`) exposes `getFrame` (current frame
  index), `getFrameFresh` (true on the tick the frame advanced), and `getLooped` (true on the tick
  the strip wraps). `modAnimSet.update` advances the strip each tick by `gGameSpeed`.

- **`attack()` itself does NOT fire.** `objAiAttack.attack`
  (`objAiAttack.txt:37-73`) only gates on cooldown and then `ensureMode(animType)` +
  `ensureMode(#attack)`. It *enters attack mode and hands off to the animation*. The cooldown
  gate controls **entry into attack mode**, not the moment of the hit.

So the loop is:
```
cooldown ready ──► attack()  ──► ensureMode(#attack)   [enter attack mode; pick attack strip]
                                       │
   every tick while in #attack: animation advances one strip; on each FRESH frame that
   equals/∈ #animframe ──► performAttack()  (one hit/shot per crossing)
                                       │
   when the strip LOOPS (getAnimLooped) ──► attackFin(#completed)  ──► leave/re-evaluate
```
Cadence = the attack-strip's loop length; a burst (`[2,4,6]`) fires 3× because the strip crosses
frames 2, 4 and 6 during one play; facing is set once at `attack()` entry and held for the whole
strip because the animation, not a re-firing timer, owns the window.

### What the port does instead (the mismatch)

The port **decouples the hit from the animation** and drives both off independent code timers:

1. **The hit fires ONCE, inline, in the trigger.** `CpuAI.attack`
   (`control.ts:658-771`) resolves the whole hit/shot immediately in one call, then sets a window
   timer. `PlayerControl.tryMelee` (`control.ts:336-360`) does the same: one
   `impactMeleeAttack`, then `meleeT = swingTicks(...)`.

2. **`Anim` never exposes the current frame and is never read by the attack code.**
   `anim.ts` tracks `private frame` but provides no `getFrame`/`frameFresh`/`looped` accessor;
   `control.ts` imports `Anim` only to call `restart()`. The attack code never asks "what frame
   is the swing on?" — it can't, the data isn't there.

3. **`#animframe` is dropped from the data path.** `STRUCT_ATTACK` has `animFrame: 2`
   (`registry.ts:20`) but `resolveAttack` (`weapon.ts:resolveAttack`) **never copies `animFrame`
   into `AttackData`** — so no driver could read it even if it wanted to. The asset strips
   (`assets.json`) carry only `dela`/`loop`, no per-frame event marker (none is needed — the
   original keys off the *frame index*, which the strip already has).

4. **The window timer is a stand-in for the loop, set from the strip length but not synced to it.**
   `CpuAI.attackT` / `PlayerControl.meleeT` are pre-computed as the *sum of frame delays*
   (`attackAnimTicks` / `swingTicks`) and counted down independently. The actual `Anim` strip is
   restarted (`restart()`) but advances on its *own* counter (`game.gameSpeed` vs the timer's
   `--` per `update`), so the two clocks can drift — the timer can expire while the strip is mid-
   frame, or the strip can finish while the timer still blocks (the symptoms below).

### Why this is the root cause of the reported symptoms

| Reported symptom | Direct consequence of the mismatch |
| --- | --- |
| **Burst weapons fire once** (crossBow `[2,4,6]`, flameThrower `[1,3,5,7]`, fangBunnyBaby `[5,6,7]`, darkGolem `[7,14]`, 4-arm golems) | The port fires exactly once in `attack()` and ignores `#animframe` entirely. A list of N frames should yield N shots per loop; the port yields 1. |
| **Attack cadence "free-runs / re-triggers before the animation locks in"** | Two unsynced clocks (the `meleeT`/`attackT` countdown vs the `Anim` strip's own `gameSpeed` counter). The re-trigger gate is the *timer*, not "the strip looped" (`getAnimLooped`), so a swing can re-arm while the visible strip is mid-frame, or visibly finish before the gate clears. The original re-triggers exactly on `attackFin(#completed)` = strip loop. |
| **Swing facing flips mid-swing** | Facing is re-evaluated *per code-fire* (`m.facingLeft = dx < 0` / `= this.aimLeft` at each `attack`/`tryMelee`). In the original, facing is set once when `#attack` mode is entered and the animation holds it for the whole strip (no per-shot re-aim for melee). The port re-aims whenever its timer lets it fire again, which during a moving target re-points the existing swing. |
| **Allied/enemy attack anims get cut** | `attackT`/`meleeT` are derived from strip length but counted on a *different* clock than `Anim`. When the window timer expires first, `update()` leaves the `attackT>0` "stationary + attacking" branch (`control.ts:554`) and `animAction` stops returning the attack strip — cutting the visible animation before it finishes. With the animation as the clock, the window ends exactly when the strip loops, so it can never be cut early. |

---

## Recommended refactor: make `Anim` the driver

Center the fix on restoring the original's "animation is the clock" model. Three layers change:
the data path (carry `#animframe`), `Anim` (expose frame state), and the two drivers
(`CpuAI.attack` / `PlayerControl.tryMelee`) (fire per-crossing instead of once-inline).

### 1. Data path — carry `#animframe` into `AttackData`

`weapon.ts`:
- Add `animFrame: number[]` to `AttackData` (normalize scalar → `[n]`, `#none`/`[]` → empty list
  meaning "no frame events; fire on release" for magic).
- In `resolveAttack`, populate it from `r["animFrame"] ?? r["animframe"] ?? STRUCT_ATTACK.animFrame`
  (the raw key appears as both `animFrame` and `animframe` across actors — see `data.json`; the
  resolver must accept both casings). Default `[2]` to match `structMaster`.

No assets-pipeline change is required: the original keys off the strip's **frame index**, which
`assets.json` strips already implicitly have (frame `i` in `frames[]`). `#animframe` values are
**1-based** in the Lingo (`getPos`/exact-match on a 1-based member list); the port's `frame` is
0-based — so compare against `(frame + 1)`, or store `#animframe` decremented at resolve time.
Pick one and assert it in a unit test (crossBow → 3 crossings).

### 2. `Anim` — expose the strip's frame state

`anim.ts` currently hides `frame`. Add three accessors mirroring `objAnimStrip`:

```ts
/** objAnimStrip.getFrame: current 0-based frame index of the active strip. */
attackFrame(): number { return this.frame; }
/** objAnimStrip.getFrameFresh: true only on the tick the strip just advanced a frame
 *  (so a #animframe crossing fires once, not every tick it sits on that frame). */
frameFresh(): boolean { return this.justAdvanced; }
/** objAnimStrip.getLooped: true on the tick the strip wrapped back to frame 0
 *  (one-shot strips: true on the tick they reach+hold the last frame). */
looped(): boolean { return this.justLooped; }
```

To support these, `Anim.update` must set two per-tick latches when it advances the frame counter
(it already has the advance logic at the `if (this.timer >= frameDelay)` block):
- `justAdvanced = true` on the tick `frame` changes (clear it at the top of each `update`).
- `justLooped = true` on the tick the wrap `frame = (frame + 1) % len` returns to 0 (looped strips)
  or the one-shot clamp first reaches `len - 1`.

The attack strip should be made to **loop while in attack mode** (the original loops the attack
strip and exits via `attackFin` on `getAnimLooped`). Today melee strips are classified one-shot
(`ONE_SHOT_FALLBACK` / `anim.loop=false`). Reconcile this: either (a) treat the attack action as
looped *while the driver holds attack mode* and let the driver decide when to leave on `looped()`,
or (b) keep one-shot semantics and treat `looped()` (= reached-last-frame) as the single
"completed" event for non-burst weapons — but burst weapons then need the strip to actually cycle
across all listed frames within one play, which only works if those frames all fall *before* the
hold point. Option (a) is the faithful one and the burst weapons require it.

### 3. The drivers — fire per `#animframe` crossing, not once inline

Replace the "compute the full hit immediately, then run a window timer" shape with an
"enter attack mode, then each tick emit one hit per fresh listed-frame crossing, leave on loop"
shape. The per-`#animframe` firing hook lives in the **per-tick update while in attack mode**, not
in the entry call.

**`CpuAI`:**
- `attack(m, dx, dy, target)` becomes `enterAttack()`: gate on `getCooldownFin`, set facing
  **once**, `ensureMode(#attack)` (set a `mode = "attack"` / keep `attackT` only as a "are we in
  attack mode" flag, not a countdown clock), `Anim.restart()`, reset cooldown, remember the
  committed aim `(dx,dy)` and target. It does **not** call `impactMeleeAttack`/`fireBullet` here.
- Add `updateAttack()` run each tick while `mode === "attack"` (the existing `attackT>0` branch in
  `update`, `control.ts:554`, is where this hook goes):
  ```ts
  const anim = this.entity.get(Anim);
  if (anim.frameFresh() && this.animFrames.includes(anim.attackFrame() + 1) /*1-based*/) {
    this.performAttack(m, this.committedDx, this.committedDy, this.target); // the body now in attack()
  }
  if (anim.looped()) this.attackFin(m);   // leave attack mode exactly when the strip wraps
  ```
- `performAttack` holds today's per-shot body (the whole `if (this.ranged) {…} else {…}` block
  from `control.ts:661-762`), **minus** `attackT = …`, `restart()`, `resetCooldown` and
  `attackFin` (those move to enter/leave). **Re-aim per shot for ranged** here: recompute
  `dx,dy` (+ eyestrain) from the live target loc at the moment of the crossing, so a 3-shot burst
  tracks a moving target — faithful to `performRangedAttack` reading the target each call. **Do
  not re-aim melee** (facing was locked at entry).
- Magic stays as-is: `#animframe #none` ⇒ `animFrames` empty ⇒ `updateAttack` fires nothing on
  frames; the existing charge/release path already models magic correctly (`#animframe` does not
  drive magic in the original either).

**`PlayerControl`:**
- `tryMelee` (`control.ts:336-360`) splits the same way. The entry (on held-fire + cooldown)
  sets facing once, `restart()`s the swing, resets the cooldown, and enters a melee-attack
  substate. The hit (`impactMeleeAttack` at `control.ts:354`) moves into a per-tick
  `updateMeleeSwing()` that fires once per fresh `#animframe` crossing of the swing strip
  (`#punch` → frame 3; a future multi-hit melee → its list) and ends the substate on `looped()`.
- `meleeT` / `swingTicks` (`control.ts:329-334,356`) are retired as the cadence clock; the swing
  substate is held by the **strip**, and `animAction` (`control.ts:363-370`) keys off "in melee
  substate" instead of `meleeT > 0`. This removes the dual-clock drift for the player too.

### Net effect

- Burst weapons fire once per listed `#animframe` per loop (crossBow → 3, flameThrower → 4, …).
- Cadence is the strip loop length; re-arm happens on `looped()`, never before the strip locks in.
- Facing is set at entry and held by the strip (melee); ranged re-aims per shot, faithfully.
- Attack animations always play to their loop boundary and can never be cut by an out-of-sync
  timer (no second clock exists).

---

## Other combat-lifecycle findings (independent of the model)

### F-A — `#animframe` is silently discarded at resolve (data-loss, enables the above)
`STRUCT_ATTACK.animFrame` (`registry.ts:20`) is read into the struct defaults but `resolveAttack`
(`weapon.ts`) never threads it onto `AttackData`. Even before the full refactor, this is a
straight data-loss bug: every per-weapon `#animframe` in `data.json` (including all the burst
lists) is parsed and thrown away. Fixing F-A is the prerequisite for the refactor and is a safe,
isolated change on its own.

### F-B — two clocks for one window (drift)
`CpuAI.attackT` (`control.ts:425,554,766`) and `PlayerControl.meleeT` (`control.ts:53,145,337,356`)
count down on the `update()` cadence, while the `Anim` strip advances on `game.gameSpeed`
(`anim.ts` `this.timer += game.gameSpeed`). Under any `gGameSpeed != 1` the window and the visible
strip diverge — the "cut animation" / "free-run cadence" reports are the two clocks disagreeing.
The refactor collapses them to one (the strip); short of that, derive `attackT`/`meleeT` from the
strip on the *same* counter.

### F-C — melee facing re-evaluated per fire, not held
`tryMelee` sets `m.facingLeft = this.aimLeft` (`control.ts:343`) and `CpuAI.attack` sets
`m.facingLeft = dx < 0` (`control.ts:763`) at the moment of *firing*. Because the port can re-fire
on its timer, a moving target re-points an in-progress swing. The original sets facing once on
`#attack`-mode entry. Fixed by moving the facing assignment into the enter step (above).

### F-D — ranged burst can't track a moving target (consequence of single-shot)
Because the port fires ranged once per `attack()`, there is no per-shot re-aim. The original's
`performRangedAttack` runs once per `#animframe` crossing and reads the target each time, so a
burst spreads/tracks. Restored by the per-crossing `performAttack` re-aim (re-read target loc +
eyestrain) for ranged only.

### F-E — magic correctly excluded (no regression)
Worth recording so the refactor doesn't over-reach: all `#magic` actors carry `#animframe #none`
(`data.json`), and the original drives magic off charge/release (`attackMagic`), not frame events.
The port's existing charge/`castMagic` path (`control.ts:219-323`) already matches this; the
`#animframe`-driven hook must be a **no-op for an empty `animFrames`** so magic is untouched.

---

## Verification plan for the fix
- Unit: crossBow (`#animframe [2,4,6]`) fires exactly 3 `fireBullet`s across one attack loop;
  `#punch` (`animframe 3`) fires exactly once per swing; an `#magic` weapon fires 0 frame-events.
- Unit: 1-based vs 0-based — assert the crossing set matches the strip's frame indices (guard the
  off-by-one).
- Unit: facing is stable across a multi-frame swing while the committed target moves (melee);
  ranged re-aims (the 3 bullets diverge toward a moving target).
- Behavioral (existing harness): `test/cpuai.test.ts`, `test/attack.test.ts`, `test/weapon.test.ts`
  should be extended; the `attackT`/`meleeT` assertions there will need updating to the
  loop-driven model.

---

COMBAT-LIFECYCLE | FINDINGS=6
