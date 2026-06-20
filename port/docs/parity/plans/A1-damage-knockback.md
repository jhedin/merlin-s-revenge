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
