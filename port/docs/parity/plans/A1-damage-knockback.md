# Plan A1 — `damage == knockback` (the combat keystone)

Backlog item **A1** (see `../README.md`). Three audits + `PORTING_PLAN.md` agree this is the root fix.

## The original chain (verified in Lingo)
- `modEnergy.takeHit(collisionVect, attackingObj, owner)`:
  `damage = (|vx| + |vy|) * attackingObj.getAttack().damageMultiplier`; `if damage>0: loseEnergy(damage)`.
- `objGameObject.takeHit`: `knock = collisionVect * (100 - inertia)/100`; `moveXY.vectAdd(knock)`; then passes
  the **damped** vector onward — so inertia cuts knockback *and* damage together. (`VarPositive` = abs.)
- `modReel.takeHit`: `goDamageMode()` (reel) unless `reelProof`.
- The collision vector is built per attack type (`modAttack.calcCollisionVect*`): melee = aimed `power`
  point (×strength); bullet = velocity×power; magic = `CollisionCalcVect` small per-frame steps.

## The port today (the gap)
`takeHit(dmg, attackerId)` is a **scalar**; damage is pre-baked at the call site (`dmgPerUnit*charge`,
`power*2`); there is **no knockback**. So relative lethality is a guess and reel/recoil/freeze/splash have
nothing to read.

## Design

### 1. Vector `takeHit` through the whole chain
`takeHit(vx, vy, attackerId, mult=1)`. Handler order (unchanged intent):
1. **Movement** (NEW, ordered FIRST — the `objGameObject` role): damp by inertia
   `d = (100-inertia)/100`; add `(vx*d, vy*d)` to a **separate knockback impulse** (see §3); call
   `next(vx*d, vy*d, attackerId, mult)` so everyone downstream reads the damped vector.
2. **Experience**: records attacker (unchanged; ignores the vector).
3. **Energy**: `damage = (|vx|+|vy|) * mult`; apply (honoring i-frames/invince/dead as now); death→XP as now.
4. **Hurt**: flash + i-frames + reel (unchanged).

### 2. Attacks carry a real `#attack` (power point + damageMultiplier)
Each attacker builds a **collision vector aimed at the victim**, with the *L1 magnitude calibrated to the
current balance* (so no regression) and `mult` from `#attack.damageMultiplier` (default 1):
- **Melee** (punch/sword/enemy): `vect = (sign·power, 0)` where `power` = today's melee damage → `damage =
  power` unchanged; knockback shoves along facing.
- **Spell bullet** (energyBlast) & **enemy bullet**: at impact, `vect = unit(bulletVelocity)·dmg` → `damage
  = dmg` unchanged; knockback along travel.
This keeps every current damage number identical while routing it through the faithful formula.

### 3. Knockback at the port's px scale (the one deliberate adaptation)
Literal "knockback velocity = damage" overshoots at this scale (a 40-dmg hit = 40px/frame). So — exactly as
the port already px-tunes spell damage vs the engine's 9999 units — knockback uses the **same vector and
direction** but a tuning factor: `kvx += vx*d*KNOCK_SCALE`. The *semantic* (knockback ∝ damage, same
vector, inertia-damped) is faithful; only the px magnitude is scaled. `KNOCK_SCALE` tuned so a solid hit
gives a short, readable shove. Knockback is a **separate decaying impulse** (`kvx/kvy`, friction-decayed,
NOT subject to the walk speed-cap) added on top of intent velocity in `Movement.update` — so walking stays
capped while knockback can briefly launch and settle.

### 4. Inertia
`Movement` reads `cfg.inertia` (0 default; heavier actors resist more, per data). **Scoping decision:** the
original damps inertia into the vector modEnergy reads, so it cuts *damage* too — but those attack powers
are calibrated for that coupling. A1 preserves the port's current (uncoupled) damage numbers, so inertia
damps **knockback only**; the vector passes through to Energy undamped. Faithful damage-damping arrives
with the real data attack powers (backlog B2).

> **B2 update (still deferred — with the reason it can't land yet).** B2 shipped the real data-driven
> `#attack` powers (weapon→char→bullet→victim) and now flows `damageMultiplier` from each weapon's
> `#attack` into `takeHit`'s `mult` — but it **kept A1's knockback-only damping** and did *not* recouple
> inertia to damage. Why: the port's attack powers are still *slice-tuned* to the px-scale, not the
> engine's native units, and only the **player's** melee was calibrated to today's numbers
> (`#punch`=48 exactly, `merlinSword`≈one-shots the room-1 band). Enemy melee deliberately keeps the
> slice's tuned scalar (routing enemy `power·strength·mult` would inflate enemy lethality 5–25× and kill
> the player in room 1). Until a **holistic power-rescale** moves every actor's power into the engine's
> native units (where the original numbers are calibrated *for* the inertia-damage coupling), turning the
> coupling on would silently de-rate hits against high-`inertia` actors with no faithfulness payoff. So
> inertia→damage stays a **C-phase item**, landing *with* that rescale. Room-1 orcs have `inertia:0`, so
> the coupling is a no-op there but a landmine elsewhere — exactly why it waits for the rescale.

> **RESOLVED by K1 (Iter — faithful damage coupling).** The §4 deferral is closed. `Movement.takeHit` now
> damps the collision vector by `(100−inertia)/100` ONCE and passes the **damped** vector downstream to
> Energy/Freeze/Heal — so inertia cuts **damage** too, exactly like `objGameObject.takeHit`. This landed
> together with the enemy-side faithful `power·strength·mult` (the holistic power-rescale this note flagged
> as the precondition): enemy melee = `power·strength·mult·ENEMY_DAMAGE_SCALE` (0.18) and enemy bullets =
> `speed·power·mult·BULLET_DAMAGE_SCALE` (0.40), with the player melee unchanged on its own scale (2.5).
> Player `inertia:0` keeps the player's attacking undamped; heavy orcs (inertia 60–80) now take ~20–40% —
> tanky, with the sword the faithful answer. Room-1 still clears (gate verified). See
> [`K1-faithful-damage.md`](K1-faithful-damage.md).

## Files
- `components/movement.ts`: `inertia`, `kvx/kvy`, `KNOCK_SCALE`, `knockFriction`; `takeHit` handler
  (damp+impulse, ordered first); integrate `kvx/kvy` (uncapped) in `update`; save/restore knock state.
- `components/combat.ts` (Energy): vector `takeHit`, `damage = (|vx|+|vy|)*mult`.
- `components/hurt.ts`, `components/experience.ts`: vector `takeHit` signature passthrough.
- `components/control.ts`: melee + spell build aimed collision vectors (helper `aimedVect(dx,dy,dmg)`),
  pass `mult`. Keep current damage numbers.
- `components/projectile.ts`: on impact build `unit(velocity)·power` vector + pass `mult`/attacker.
- `systems/bullets.ts` / `entities/archetypes.ts`: bullets carry `mult` (from `#attack.damageMultiplier`)
  and `inertia` where relevant.
- Tests: update scalar-damage assertions to the vector signature; ADD knockback tests (a hit pushes the
  victim along the hit direction; inertia reduces it) and a damage-formula test
  (`(|vx|+|vy|)*mult`).

## Verification
`tsc` clean; full vitest; in-browser smoke: room 1 still clears by melee, the spell still fells a
rank-and-file enemy, AND enemies now visibly recoil from hits. Confirm no damage regression (same kills).

## Out of scope (later backlog items)
Real `teamMaster`/`findTarget` (B1), weapon manager (B2), splash/freeze formulas (C2), reelFly/recoil
state machine depth (modReel beyond the flash-reel we have). A1 only makes the resolution *vector-correct*
and adds knockback.
