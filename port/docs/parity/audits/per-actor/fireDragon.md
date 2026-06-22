# Per-Actor Parity Audit: `act_fireDragon`

Method: behavior DERIVED from the original cast/data, then REPRODUCED in the port via a headless
harness (`tools/_audit_fireDragon.ts`, since deleted) that loaded the real `src/generated/assets.json`
bundle, spawned the actor with a live target, and ticked 250 frames observing strip resolution,
shot count, bullet creation, cadence, team, targeting, and AI mode.

**Original spec:** `casts/data/act_fireDragon.txt` (+ `act_flameThrower.txt`, `act_fireBall.txt`)
**Port:** `port/src/entities/archetypes.ts`, `port/src/components/anim.ts`, `port/src/components/control.ts`

---

## SECTION 1 — Derived-correct behavior (from the ORIGINAL)

`act_fireDragon` (`casts/data/act_fireDragon.txt`):
- `#objType #objCPUCharacter`, `#AiType #objAiCPU`, `#inherit #CPUCharacter` (committed-target FSM).
- `#team #scarlet` (NOTE: `act_dragon` is `#monsters`; this is the only stat difference between them).
- **`#name "dragon"`** — the actor's display/anim name. `modAnimSet.init` passes `params.name` to
  `objAnimSet.init(name, ...)`, which calls `g.animStripMaster.getStripDefs(name)`
  (`casts/script_objects/modAnimSet.txt:22`, `casts/script_objects/objAnimSet.txt:12-14`). So the
  sprite strips are keyed by **`dragon`**, NOT `fireDragon`. fireDragon and dragon SHARE the `dragon_*`
  strip set and render identically (a dragon).
- `#energy 500`, `#strength 8`, `#dexterity 10`, `#walkSpeed 7`, `#inertia 70`, `#experienceImWorth 50`,
  `#damageSpeed 3`, `#stallSpeed 3`, `#eyestrain 50`, `#startingLevel 0`.
- `#dieSound #none`, `#takeHitSound "dragon_hit"` (vol 100).
- No inline `#attack` → attack comes from **`#weapon #flameThrower`**.

`act_flameThrower` (`casts/data/act_flameThrower.txt`):
- `#attack.animType #weaponRanged` (RANGED), `#bullet #fireBall`, `#collisionLoc point(35,-20)`,
  `#cooldown 0`, `#firingType #fullstrength`, `#reach 150`, `#sound "dragon_fire"`,
  **`#animframe [1,3,5,7]`** — the strip frames on which it FIRES (4 shot frames per attack).

`act_fireBall` (`casts/data/act_fireBall.txt`): `#inherit #bullet`, `#name "fireBall"`,
`#attack [#damageMultiplier 6, #power 0.2, #type #bullet]`, `#weight 0.4`, `#friction point(4,4)`.

**Therefore fireDragon SHOULD:** render as a **dragon** (shared `dragon_*` strips), commit to a hated
target (#scarlet hates aldevar/village/monsters/etc.), close to within reach 150, play its 20-frame
`dragon_weaponRanged` attack strip, and breathe fire — firing a `#fireBall` on each animframe crossing
([1,3,5,7]) at constant `#fullstrength` velocity (= strength 8), then recover and repeat.

---

## SECTION 2 — Reproduced in the PORT (observed)

The harness spawned fireDragon three ways and ticked 250 frames against a stationary player target:

| Path | how spawned | resolved anim char | attack strip | shots / attack-burst |
|------|-------------|--------------------|--------------|----------------------|
| **A** | `spawnEnemy("fireDragon")` (default `animChar = actorName`) | **`fireDragon`** | `fireDragon_weaponRanged` → **MISSING** | **1** (×14 bursts) |
| **B** | `spawnUnit("fireDragon",{animChar: spriteCharOr("fireDragon")})` — the **production** path used by `spawnFromSymbol` | **`blackOrc`** | `blackOrc_weaponRanged` → **MISSING** | **1** (×14 bursts) |
| **C** | control: `animChar:"dragon"` (original-correct) | `dragon` | `dragon_weaponRanged` → **20 frames** | **3** (×7 bursts) |

`spriteCharOr("fireDragon")` returns **`blackOrc`**; `spriteCharOr("dragon")` returns `dragon`.

Correctly resolved (all paths): team `#scarlet`; weapon `#flameThrower`; attack
`{animType:#weaponRanged, animFrame:[1,3,5,7], bullet:#fireBall, firingType:#fullstrength, reach:150,
cooldown:181, type:ranged}`; AI commits and enters `moveToAttack`; `dragon_hit`/`dragon_fire` sounds and
`dragon_grave` are bundled; `fireBall_fly`/`fireBall_land` bundled.

---

## SECTION 3 — Divergences

### DIVERGENCE 1 (PORT BUG) — fireDragon renders as a black orc and fires 1 shot, not a 4-shot fire-breath

**Derived-correct:** anim name = `#name` = `"dragon"` → `dragon_*` strips; 20-frame `dragon_weaponRanged`
attack strip; fire-breath fires per-`#animframe` crossing of `[1,3,5,7]`.

**Observed (production Path B):** anim char resolves to **`blackOrc`** (the generic fallback). blackOrc
ships NO `weaponRanged` strip, so the attack strip lookup MISSES → `attackAnimates = false` → the
controller falls through to the non-animating safety path and fires **exactly ONE** bullet per attack.
The unit also LOOKS like a black orc instead of a dragon.

**Dual-tree evidence:**
- Original keys the sprite by `#name`: `casts/script_objects/modAnimSet.txt:22`
  (`pAnimSet.init(params.name, params.character)`) → `casts/script_objects/objAnimSet.txt:13`
  (`getStripDefs(name)`). fireDragon's `#name: "dragon"` is at `casts/data/act_fireDragon.txt:18`.
- Port keys the sprite by the actor KEY, never `#name`:
  - `port/src/entities/archetypes.ts:324` — `animChar: opts.animChar ?? actorName` (uses `"fireDragon"`,
    not the actor's `#name "dragon"`).
  - `port/src/entities/actorSerial.ts:54` — production spawn passes
    `{ animChar: spriteCharOr(name) }`.
  - `port/src/components/anim.ts:29-33` — `spriteCharOr` checks `${name}_stand`, then a `CHAR_ALIAS`
    table (which has NO `fireDragon`/`dragon` entry, lines 16-26), else returns `"blackOrc"`.
- Consequence in the attack driver: `port/src/components/control.ts:741-742` sets
  `attackAnimates = !!strip && strip.frames.length > 1` from `anims["blackOrc_weaponRanged"]` (undefined)
  → false. `control.ts:760-762` then fires once on the safety countdown.
- **Note the port already knows the rule** — `port/src/entities/archetypes.ts:279-282` resolves a
  BULLET's sprite off its `#name` ("modAnimSet keys the sprite by the actor's #name, NOT its key"), but
  this is applied ONLY to bullets, never to the spawned actor itself.

**Severity:** HIGH. Wrong sprite (orc, not dragon) AND a 4× drop in fire-breath shot count
(1 vs the original 4) — both visual and combat (DPS) divergence.

**Suggested fix direction (not applied):** resolve the actor's anim char from its data `#name` when
present (mirroring the bullet-char logic at archetypes.ts:279-282), or add a `CHAR_ALIAS["fireDragon"] =
"dragon"` (and `["dragon"]`) entry. `dragon_*` strips ARE bundled, so the art exists.

> This same root cause affects `act_dragon` (also `#name "dragon"`, also spawned as `dragon`/fallback).
> The existing `dragon.md` audit was code-reading-only and did not detect it. Fixing the char resolution
> fixes both.

---

### DIVERGENCE 2 (PORT BUG, secondary — only visible once DIV-1 is fixed) — fire-breath fires 3 shots, not 4 (frame-1 crossing dropped)

**Derived-correct:** `#animframe [1,3,5,7]` = 4 shots. The original's `isOnAttackFrame`
(`casts/script_objects/modAttack.txt:577-617`) fires when `getAnimFrameFresh()` is true AND the current
frame is in the list; `getFrameFresh = pDelay.fin` (`casts/script_objects/objAnimStrip.txt:77-78`) is
true on the tick the strip's per-frame delay completes for the CURRENT frame — including frame 1 (the
strip dwells on frame 1 for its `dela`, finning before advancing). So frame 1 fires.

**Observed (control Path C, char forced to "dragon"):** shots-per-attack-burst = **3** (frames 3, 5, 7),
not 4. The port restarts the strip to frame 0 (= frame 1) without ever marking it "fresh"; `justAdvanced`
becomes true only on a real frame ADVANCE (`port/src/components/anim.ts:147-150`). Since frame 1 is the
start frame and is never advanced INTO, `frameFresh()` is never true while on frame 1, so the
`attackFrames.includes(1)` crossing at `port/src/components/control.ts:754` never matches. The first shot
lands on frame 3.

**Dual-tree evidence:**
- Original: `casts/script_objects/objAnimStrip.txt:77` `getFrameFresh me → return pDelay.fin`;
  `casts/script_objects/modAttack.txt:600-611` gates on `getAnimFrameFresh()` then list membership.
- Port: `port/src/components/anim.ts:130-131` resets `frame=0` on a new action;
  `anim.ts:147-150` sets `justAdvanced` only when `this.frame !== prev`;
  `port/src/components/control.ts:754` `if (an.frameFresh() && this.attackFrames.includes(an.attackFrame()))`.

**Severity:** LOW–MEDIUM. A 1-shot-per-attack undercount (3 vs 4, ~25% DPS loss) that is masked entirely
by DIVERGENCE 1 today (which already caps it at 1). It is a GENERAL animation-driven-attack off-by-one
(any actor whose `#animframe` list includes frame 1), not a fireDragon-specific behavior. Flagged here
because it surfaces in the reproduction.

---

## FAITHFUL quirks (NOT bugs — do not "fix")

- **fireDragon == dragon, except team.** They share `#name "dragon"`, all stats, the `#flameThrower`
  weapon, sounds, and grave; only `#team` differs (`#scarlet` vs `#monsters`). The port reads team
  correctly (`#scarlet`). This is faithful.
- **No `reel` strip for `dragon`.** The bundle has `dragon_grave/stand/walk/weaponRanged` but no
  `dragon_reel` (unlike `undeadDragon`, which has one). This matches the original strip set for the
  `dragon` anim name — a take-hit on a dragon shows no recoil animation. Faithful (original-game art
  set), not a port bug.
- **`#cooldown 0` → effective 181 ticks/shot.** The port's per-type ranged cooldown calibration
  (`(0+18)·dexterity10 + 1 = 181`) is the project's deliberate, documented tuning model, applied
  uniformly. Faithful to the port's calibration contract; correctly computed here.
- **`#firingType #fullstrength` → constant velocity = strength (8).** Correctly read and applied
  (`port/src/components/control.ts`). Faithful.

---

## Probe correctness

The harness used the documented APIs (`game.assets={index,images,img,ensureChar}`, real `CollisionGrid`,
`teamMaster.unitMap.configure(32,0,0)`, `rebuildCombatSubstrate()` per tick, `spawnEnemy/spawnUnit`,
`sweepBullets`). The target was a `spawnPlayer` (aldevar — hated by #scarlet) with a stubbed
stationary `game.input`. Bullets are counted from `game.entities` (where `fireBullet` pushes them).
No probe-API artifacts: the firing chain, targeting, cadence (181-tick gate) and AI mode all resolved
correctly; only the char resolution and frame-1 crossing diverged — both confirmed in BOTH the
empirical run and the source. Path C (forcing `animChar:"dragon"`) isolates that the ONLY thing standing
between the port and correct behavior is the char-name resolution.

---

## Summary

| # | Type | Property | Derived-correct | Observed (port) |
|---|------|----------|-----------------|-----------------|
| 1 | PORT BUG (HIGH) | sprite + shot count | dragon sprite, 20-frame strip, 4-shot breath | **blackOrc** sprite, no ranged strip, **1 shot** |
| 2 | PORT BUG (LOW, masked) | shots/attack | 4 (frames 1,3,5,7) | **3** (frame-1 crossing dropped) |

Everything else (team #scarlet, weapon/bullet resolution, fullstrength velocity, reach 150, cooldown,
sounds, grave, AI commit/target/face) is FAITHFUL and correctly reproduced.
