# Audit: `act_babyOstrich` (REPRODUCED)

Per-actor parity audit by RUNNING the actor in the port (`tools/_audit_babyOstrich.ts`, throwaway) and
comparing against behaviour DERIVED from `casts/data/act_babyOstrich.txt` + `casts/script_objects/*`.

`babyOstrich` is the **terminal hatchling** of the ostrich chain: `powerOstrich` (`act_powerOstrich.txt`)
spits `ostrichEgg` bullets (`#bullet: #ostrichEgg`); each egg carries `#reincarnateAs: [#babyOstrich]`
(`act_ostrichEgg.txt:14`), so when an egg lands/expires it reincarnates into a babyOstrich. babyOstrich
itself has **no** `#reincarnateAs`/`#reincarnateInto` — it does **NOT** grow into a powerOstrich.

---

## DERIVED (from original data + scripts)

| Field | Value (act_babyOstrich.txt) | Meaning |
|-------|------------------------------|---------|
| objType / AiType / inherit | `#objCPUCharacter` / `#objAiCPU` / `#CPUCharacter` | standard hunt-and-fire CPU enemy |
| team | `#monsters` | hostile to player side (`#aldevar`/village); targets them |
| energy | `100` | hitpoints |
| walkSpeed | `1` | very slow (CPUCharacter `#anyDirSpeed`, pathfinding) |
| inertia | `30` | 30% knockback/impact damping |
| damageSpeed | `3` | **wall/floor-slam threshold** during `#reel` only (see DERIVATION below) |
| strength | `10` | melee strength AND `#fullstrength` bullet throw speed |
| dexterity | `10` | ranged cooldown-counter `inc` (recovery rate, NOT frame count) |
| eyestrain | `25` | ranged aim scatter (±25px at max range, scaled by dist/reach) |
| experienceImWorth | `4` | XP awarded on kill |
| startingLevel | `0` | no pre-levelling |
| takeHitSound / Vol | `"dragon_hit"` / `50` | sound played on each non-lethal hit |
| dieSound | `#none` | silent on death |
| **attack** | — | — |
| attack.name | `#babyLaser` | weapon identity |
| attack.animType | `#naturalRanged` | **RANGED** FSM: approach to reach, then fire `#bullet` |
| attack.bullet | `#laser` | fires `act_laser` (`damageMultiplier 10`, `power 0.3`) |
| attack.animframe | `3` (lowercase override) | **fires once per strip play**, on frame 3 |
| attack.reach | `100` | fires when target within 100px |
| attack.cooldown | `100` | counter ceiling; recovery = ceil((100-1)/dexterity 10) ≈ **10 ticks**, NOT 100 frames |
| attack.firingType | `#fullstrength` | throw speed = caster `strength` (=10), constant regardless of distance |
| attack.collisionLoc | `point(5,-9)` | muzzle offset for the laser spawn |
| attack.sound / volume | `"quadranid_fire"` / `10` | fire sound |
| **sprite #name** | `"babyOstrich"` | resolves to bundled `babyOstrich_*` strips |
| death/grave | grave on (no `#graveOn:false`, not a ghost) → `babyOstrich_grave` | leaves a permanent grave; no reincarnation |

### DERIVATION — `damageSpeed` is a reel-slam threshold, not general armor
`casts/script_objects/modEnergy.txt:249` `on takeDamage me, amount: if amount > pDamageSpeed then amount -= pDamageSpeed; me.loseEnergy(amount)`.
The ONLY callers of `takeDamage` are `objCPUCharacter.txt:111,124` inside `collisionVertical`/`collisionWall`,
each gated `case me.big.getMode() of #reel,#reel_fly,#reel_land:` — i.e. damageSpeed mitigates ONLY the
bonus damage taken when a knocked-back unit slams into a wall/floor. Normal weapon hits (`loseEnergy`/
`takeHit`) are NOT routed through it. (The prior version of this doc wrongly called it general armor.)

### DERIVATION — cooldown 100 is a counter ceiling, not a frame gap
`modWeaponManager.txt:163-201` builds `pCooldownCounters[weapon] = CounterNew()` with `tim[2] = cooldown`
(=100) and `inc = dexterity` (=10, for `#ranged`). The `Counter()` general function adds `inc` per tick
from `tim[1]=1` until `>= tim[2]`, so recovery = ceil((100-1)/10) ≈ 10 ticks, NOT 100 frames. A faithful
port must NOT treat cooldown as a literal frame gap.

### DERIVATION — `#fullstrength` throw velocity
`modAttack.txt:743-775`: `#fullstrength` → `speed = me.getStrength()` (=10); the bullet velocity vector is
`distXY / (distToTarget/speed)`, i.e. constant speed `strength` toward the target (vs `#proportional` =
`distXY/10`). So babyOstrich's laser flies at ~10 px/tick regardless of range.

---

## OBSERVED (port, `tools/_audit_babyOstrich.ts`, 200 ticks, target = `knight` ally @70px)

- **animChar = `babyOstrich`** — resolves to real bundled strips (`babyOstrich_stand/walk/naturalRanged/grave` all present). **NOT a blackOrc fallback.** ✓
- AI mode: `moveToAttack` (ranged FSM) the whole run — approaches and fires. ✓
- **Fires `laser` bullets**, char = `laser` (real `laser_fly`/`laser_land` strips bundled). ✓
- **1 shot per attack** (resolved `animFrame:[3]`); max bullets alive observed = 3, one per cast. ✓
- Bullet velocity vx ≈ **9.7** (≈ strength 10) — `#fullstrength` honored. ✓
- Bullet vy ≈ -0.8/1.7/1.8 — small per-axis scatter consistent with **eyestrain** modelled. ✓
- reach: resolved attack `reach: 100`; fired at a target 70px away (within reach). ✓
- Cadence: shots at t=13,35,79 (gaps 22,44) — far shorter than raw 100; consistent with the ~10-tick
  counter recovery + strip/reposition overhead (resolved internal `cooldown:221` is the back-solved counter
  hi that recovers in ~`framesWanted` ticks at inc=dexterity, NOT a literal gap). ✓
- takeHitSound `"dragon_hit"`/vol handled by `Hurt.takeHit` (`hurt.ts:22,58`). ✓
- Death: `loseEnergy(9999)` → `isDead()=true`; no extra entities spawned (no growth/reincarnation). ✓
- Grave: `Grave.graveOn` defaults true → dead actor holds the `babyOstrich_grave` member. ✓

(Note: an initial probe using `send("takeDamage",…)` failed to kill — that is the wrong port API, NOT a
port divergence; the lethal path is `loseEnergy`/`takeHit`. Re-probed with `loseEnergy`.)

---

## DIVERGENCES

### DIVERGENCE 1 — bullet damage decoupled from velocity (FAITHFUL-by-design, port-wide)
- **Original** (`modAttack.txt` performRangedAttack + `objBullet` takeHit): the laser's damage is the L1
  magnitude of its live collision vector `|getVect()|` × `damageMultiplier` (10). Since `#fullstrength`
  fires it at speed=strength (10), damage scales with that velocity.
  ```
  laser.damageMultiplier 10 · |bulletVect| (=strength 10 at full speed)  ── original
  ```
- **Port** (`control.ts:813-817` comment; `bullets.ts:fireBullet` + `weapon.ts:151 BULLET_DAMAGE_SCALE`):
  velocity governs **travel time only**; bullet damage uses a calibrated fixed reference (`BULLET_DAMAGE_SCALE
  0.40` on speed·power·mult), deliberately stable so balance/tests don't shift with throw speed.
  ```
  power · mult · BULLET_DAMAGE_SCALE at a fixed reference speed  ── port
  ```
- **Verdict: FAITHFUL-quirk (deliberate abstraction).** This is a documented, intentional port-wide
  enemy/spell-bullet damage model (the "K1 reference"), not a babyOstrich-specific bug. Velocity, reach,
  cadence, sound, bullet identity, eyestrain, firingType and the shot count all reproduce faithfully; only
  the damage-vs-speed coupling is abstracted, identically for every ranged enemy.

---

## NON-DIVERGENCES (previously-suspected gaps now CONFIRMED FAITHFUL)
- **damageSpeed**: port models it correctly as the wall/floor reel-slam threshold (`movement.ts:47,197-201`,
  forwarded `archetypes.ts:384`), matching the original's `takeDamage`-only usage. NOT general armor.
- **eyestrain**: modelled (`control.ts:496,823`; `math.ts:aimWithEyestrain`) with the same dist/reach
  scaling + per-axis VarRoughly scatter as `objAiAttack.modifyLocWithEyestrain`.
- **takeHitSound/Volume**: handled by `Hurt` (`hurt.ts:22-23,58`), played on non-lethal hits.
- **cooldown 100**: correctly calibrated to the ~10-tick counter recovery (inc=dexterity), not a 100-frame gap.
- **sprite / grave**: real `babyOstrich_*` strips bundled; no blackOrc fallback; `babyOstrich_grave` on death.
- **no growth**: babyOstrich is terminal (no `#reincarnateAs`); only `ostrichEgg` reincarnates INTO it.

babyOstrich | DIVERGENCES=1
- bullet damage decoupled from throw velocity (FAITHFUL-by-design: port-wide K1 fixed-reference bullet-damage abstraction, not a babyOstrich bug)
