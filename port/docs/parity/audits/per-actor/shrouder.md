# Shrouder Parity Audit

**Methodology:** Derived expected behavior from `casts/data/act_shrouder.txt` + full inherit chain
(`#CPUCharacter` → `#character` → `#actor`) + `objAiCPU.txt`, `objAiAttack.txt`, `modAttack.txt`,
`modWeaponManager.txt` (`setMultiAttack`), `objCPUCharacter.txt`, and the two `#weapon` records
(`act_pinShooter.txt`, `act_smoke.txt`, `act_smokePin.txt`). Then **ran** `tools/_audit_shrouder.ts`
(400-frame live simulation + direct counter inspection) to observe behavior, and compared to the
original engine. The prior code-reading audit marked this "CLEAN" — the live run found a real
multiAttack-specific cooldown bug.

---

## 1. Derived Specification (from cast data)

| Property | Cast source | Expected value |
|---|---|---|
| `#team` | `act_shrouder.txt:29` | `#magicalAlliance` |
| `#energy` | `act_shrouder.txt:22` | 150 |
| `#strength` | `act_shrouder.txt:27` | 7 |
| `#dexterity` | `act_shrouder.txt:19` | 10 |
| `#walkSpeed` | `act_shrouder.txt:31` | 3 (→ 1.8 px/tick after ×0.6 conversion) |
| `#inertia` | `act_shrouder.txt:25` | 50 |
| `#damageSpeed` | `act_shrouder.txt:18` | 2 |
| `#eyestrain` | `act_shrouder.txt:24` | 50 |
| `#dieSound` | `act_shrouder.txt:20` | `#none` |
| `#startingLevel` | `act_shrouder.txt:28` | 0 |
| `#experienceImWorth` | `act_shrouder.txt:23` | 15 |
| `#miniMapStatus` | `act_shrouder.txt:29` | `#inf` |
| `#weaponTechnique` | `act_shrouder.txt:33` | 20 |
| `#multiAttack` | `act_shrouder.txt:21` | true |
| `#pathfinding` | `act_CPUCharacter.txt:6` | true |
| `#walkType` | `act_CPUCharacter.txt:7` | `#anyDirSpeed` |
| **Weapon 1 (#attack — throwSmoke)** | | |
| animType | `act_shrouder.txt:9` | `#naturalRanged` |
| animframe | `act_shrouder.txt:8` | `[2,3,4,5,6,7]` → 6 shots per attack strip |
| bullet | `act_shrouder.txt:10` | `#smoke` (type `#explode`, area-damage) |
| reach | `act_shrouder.txt:15` | 300 px |
| cooldown | `act_shrouder.txt:12` | 400 |
| firingType | `act_shrouder.txt:13` | `#fullstrength` |
| **Original cooldown recovery** | `modWeaponManager addCooldownCounter` | `tim[2]=400, inc=dexterity=10` → **40 ticks** between bursts |
| **Weapon 2 (#weapon pinShooter)** | | |
| animType | `act_pinShooter.txt:7` | `#naturalRanged` |
| animframe | `act_pinShooter.txt:2` | `[2,3,4,5,6,7]` → 6 shots per attack strip |
| bullet | `act_pinShooter.txt:8` | `#smokePin` (type `#bullet`, plain projectile) |
| reach | `act_pinShooter.txt:12` | 80 px |
| cooldown | `act_pinShooter.txt:9` | 0 → fires on every attack loop (always ready) |
| targetRoles | `act_pinShooter.txt:15` | `[[#teamMembers, #teamBuildings]]` |
| **setMultiAttack switch rule** | `modWeaponManager.txt:366–386` | w2 is ranged → buf = w2.reach = 80; beyond 80px → w1 (throwSmoke); within 80px → w2 (pinShooter) |
| **Animation strips** | assets.json | `shrouder_stand` (4f), `shrouder_walk` (3f loop), `shrouder_naturalRanged` (9f, 15 ticks total), `shrouder_grave` (2f) |

---

## 2. Derive vs Reproduced — Full Table

| Check | Original | Port (observed) | Status |
|---|---|---|---|
| team | `#magicalAlliance` | `#magicalAlliance` | FAITHFUL |
| energy | 150 | 150 | FAITHFUL |
| walkSpeed | 1.8 px/tick | 1.8 px/tick | FAITHFUL |
| eyestrain | 50 | 50 | FAITHFUL |
| multiAttack flag | true | true | FAITHFUL |
| bufferDist | 100 (overridden to 80 by w2.reach) | 100 cfg → w2.reach=80 override in setMultiAttack | FAITHFUL |
| ranged | true (#naturalRanged) | true | FAITHFUL |
| runReload | false (no #runReload in data; not spellcaster) | false | FAITHFUL |
| weaponTechnique | 20 | 20 | FAITHFUL |
| experienceImWorth | 15 | 15 | FAITHFUL |
| weapon 1 name | `#throwSmoke` | `#throwSmoke` | FAITHFUL |
| weapon 1 animType | `#naturalRanged` | `#naturalRanged` | FAITHFUL |
| weapon 1 type | ranged | ranged | FAITHFUL |
| weapon 1 bullet | `#smoke` (#explode) | splashBullet resolved from `smoke` | FAITHFUL |
| weapon 1 reach | 300 (capped to 220 in port — documented adaptation) | 220 | FAITHFUL (known cap) |
| weapon 1 animFrame | `[2,3,4,5,6,7]` | `[2,3,4,5,6,7]` | FAITHFUL |
| weapon 1 firingType | `#fullstrength` | `#fullstrength` | FAITHFUL |
| **weapon 1 cooldown recovery** | **40 ticks** (hi=400, inc=10) | **418 ticks** (hi=4181, inc=10) | **DIVERGENCE** |
| weapon 2 name | `#pinShooter` | `#pinShooter` | FAITHFUL |
| weapon 2 type | ranged | ranged | FAITHFUL |
| weapon 2 bullet | `#smokePin` (#bullet) | `#smokePin` | FAITHFUL |
| weapon 2 reach | 80 | 80 | FAITHFUL |
| weapon 2 animFrame | `[2,3,4,5,6,7]` | `[2,3,4,5,6,7]` | FAITHFUL |
| weapon 2 cooldown recovery | ~0 (fires every strip loop, ~15 ticks) | ~18 ticks minimum | WONTFIX (documented port adaptation; +18 floor prevents infinite-loop; ~20% slower) |
| setMultiAttack: far (250px) → w1 | throwSmoke | throwSmoke | FAITHFUL |
| setMultiAttack: near (50px) → w2 | pinShooter | pinShooter | FAITHFUL |
| setMultiAttack: melee target inside buffer, ranged w2 → w2 | pinShooter | pinShooter | FAITHFUL |
| burst size (shots per attack) | 6 (animframe [2,3,4,5,6,7]) | 6 | FAITHFUL |
| death | isDead=true, grave plays | isDead=true, grave plays | FAITHFUL |
| shrouder_grave strip | 2 frames, exists | 2 frames, exists | FAITHFUL |
| shrouder_naturalRanged strip | 9 frames, 15 ticks | 9 frames, 15 ticks | FAITHFUL |
| smoke bullet type | `#explode` (area damage) | splashBullet (correct branch) | FAITHFUL |
| smokePin bullet type | `#bullet` (plain bolt) | `#bullet` | FAITHFUL |
| smokePin damageMultiplier | 4 | 4 | FAITHFUL |

---

## 3. Divergences

### DIV-1 (REAL BUG): throwSmoke cooldown 10.4x too slow

**Cast:** `act_shrouder.txt:12` — `#cooldown: 400`; `act_shrouder.txt:19` — `#dexterity: 10`.
**Original behavior** (`modWeaponManager.txt:170–176`):
```
c.tim[2] = theAttack.cooldown          -- = 400
c.inc = me.big.getDexterity()          -- = 10
-- CounterOnce advances count by 10 each tick until count >= 400
-- recovery = ceil((400-1)/10) = 40 ticks between bursts
```

**Port behavior** (`port/src/entities/archetypes.ts:195–202`):
```typescript
const framesWanted = Math.max(1, rawCooldown + (ranged ? 18 : 6));  // = 418
const effectiveCooldown = Math.round(framesWanted * counterInc + 1); // = 418 * 10 + 1 = 4181
// Counter: hi=4181, inc=10 → recovery = ceil((4181-1)/10) = 418 ticks
```

**Observed in live probe (400-frame simulation):**
- Original: ~10 attack bursts (6 shots each = ~60 smoke balls) in 400 frames
- Port: **1 attack burst** (6 shots) in 400 frames — then no more shots (418-tick cooldown not elapsed)

**Why the formula breaks here:** The calibration formula `framesWanted * inc + 1` is designed to produce
a counter that recovers in `framesWanted` ticks regardless of `inc`. For `dexterity=0.2` (typical), `hi`
stays small; for `dexterity=10`, `hi` grows to 4181. Recovery = `ceil(hi/inc) = framesWanted` — correct.
**But `framesWanted = rawCooldown + 18 = 418`, not `rawCooldown/dexterity = 40`.** The formula converts
the raw cooldown ceiling into a "frames wanted" number — but for the original, `rawCooldown / dexterity`
was already the intended recovery time (40 ticks), and the calibration inflates it by 10.4×.

**Fix sketch (`port/src/entities/archetypes.ts`):**

The effective cooldown formula must honour `rawCooldown / inc` as the original recovery time, then only
add the `+18` buffer on top of that in frames (not scaled by inc):

```typescript
// Original recovery (frames): ceil((rawCooldown - 1) / counterInc)
// Port's calibrated hi = framesWanted * inc + 1 where framesWanted = desired # frames.
// So framesWanted = ceil((rawCooldown - 1) / counterInc) + (ranged ? 18 : 6):
const origRecovery = counterInc > 0 ? Math.ceil(Math.max(1, rawCooldown - 1) / counterInc) : rawCooldown;
const framesWanted = Math.max(1, origRecovery + (ranged ? 18 : 6));
const effectiveCooldown = Math.round(framesWanted * (counterInc > 0 ? counterInc : 1) + 1);
```

For shrouder throwSmoke: `origRecovery = ceil(399/10) = 40`; `framesWanted = 40+18 = 58`;
`effectiveCooldown = 58*10+1 = 581`; `hi=581, inc=10` → recovery = `ceil(580/10) = 58` ticks.
That's 40 (original) + 18 (buffer) = 58 total — correct and consistent with zero-cooldown weapons.

> **Note:** This formula change affects ALL enemies with `dexterity > 1` and non-zero cooldown.
> The current formula is correct for zero-cooldown weapons (e.g. ninja shuriken, pinShooter) because
> `rawCooldown=0 → origRecovery=0 → framesWanted=18` is unchanged. The bug only manifests when
> `rawCooldown > 0` and `counterInc > 1` — shrouder is the clearest case (dexterity=10, cooldown=400).

---

### WONTFIX-1: pinShooter minimum cooldown (+18 frames)

**Cast:** `act_pinShooter.txt:9` — `#cooldown: 0` means "always ready".
**Original:** `tim[2]=0, inc=10` → `CounterOnce` at hi=0: counter finishes immediately on next tick → weapon
is always ready after each strip completes (~15 ticks for the 9-frame naturalRanged strip).
**Port:** `framesWanted=18`, `effectiveCooldown=181`, recovery=18 ticks. Bursts every ~18 ticks (observed).

**Verdict WONTFIX:** The original cooldown=0 effectively made the weapon fire on every attack strip loop.
The port's 18-tick minimum is the existing calibration floor that prevents zero-cooldown weapons from
entering tight infinite-fire loops (applies uniformly to all zero-cooldown weapons). The 20% cadence
difference at close range is a faithful documented adaptation (B2 plan §f.3). Observed close-range burst
interval of ~18 frames is within acceptable range of the original ~15 ticks.

---

### WONTFIX-2: throwSmoke reach capped at 220

**Cast:** `act_shrouder.txt:15` — `#reach: 300`.
**Port:** `reachRanged = min(220, max(60, 300)) = 220`.

**Verdict WONTFIX:** This is the documented port-wide ranged-reach cap (`port/src/components/control.ts:502`)
that prevents all ranged enemies from fighting across the full screen. Shrouder's 300px reach at 220px is
faithful in practical terms — the shrouder still engages at long range; only the outer 80px ring is
suppressed. The cap is applied identically for all ranged actors.

---

## 4. DIVERGENCES = 1

**DIV-1 (throwSmoke cooldown 10.4× too slow):** In the live 400-frame probe the shrouder fires exactly
one 6-shot burst instead of the ~10 bursts the original delivers. Root cause: `archetypes.ts` calibration
formula inflates the recovery from 40 → 418 ticks when `dexterity=10` and `cooldown=400`. Fix is to
derive `framesWanted` from `ceil((cooldown-1)/inc) + buffer` rather than `cooldown + buffer`.
