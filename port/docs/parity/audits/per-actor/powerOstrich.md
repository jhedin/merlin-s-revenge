# Parity Audit: powerOstrich

Method: behavior DERIVED from `casts/data/act_powerOstrich.txt`, `act_ostrichEgg.txt`, `act_babyOstrich.txt`
+ `casts/script_objects/{objBullet,modExploder,modReincarnate,objCPUCharacter,modCharacterAttackProperties}.txt`,
then REPRODUCED in the port via a throwaway headless harness (`tools/_audit_powerOstrich.ts`, deleted)
loading the real `src/generated/assets.json`.

## Actor summary (derived from cast/data)

| Property | Value (original) | Notes |
|---|---|---|
| #objType / #AiType | #objCPUCharacter / #objAiCPU | ground ranged CPU |
| #inherit | #CPUCharacter | walkType #anyDirSpeed |
| #team | #monsters | hostile to #aldevar/player |
| #energy | 500 | tanky |
| #strength | 7 | firingType #fullstrength -> egg throw speed = 7 |
| #walkSpeed | 15 | |
| #startingLevel | 2 | |
| #attack.animType | #naturalRanged | ranged FSM (moveToAttack to reach, fire, kite) |
| #attack.bullet | #ostrichEgg | thrown egg |
| #attack.animframe | 14 | gating frame; strip `powerOstrich_naturalRanged` is 18 frames -> 1 shot/cycle |
| #attack.cooldown | 30 | gates next attack ENTRY |
| #attack.reach | 230 | |
| #attack.firingType | #fullstrength | constant throw speed = strength, not dist/10 |
| #attack.collisionLoc | point(46,35) | muzzle offset |
| data #name | "powerOstrich" | sprite char -> `powerOstrich_*` strips (NOT blackOrc) |

ostrichEgg (`#inherit #bullet`): `#attack {damageMultiplier:6, power:0.3, type:#bullet}`, `#friction point(5,5)`,
`#reincarnateAs [#babyOstrich]`, `#rotational true`, `#weight 1.2`. Because `#type:#bullet` (not #explode)
and `act_ostrichEgg` declares NO `#explodeEvents`, the egg is a plain bullet that decelerates by friction.

babyOstrich: `#objCPUCharacter/#objAiCPU`, `#team #monsters`, energy 100, `#bullet #laser`, animframe 3,
`#startingLevel 0`. (The hatchling.)

## Egg life-cycle DERIVED from the original (the load-bearing detail)

`objBullet` adds `modExploder` (objBullet.txt:29). On each `objBullet.updateFly`:
- **stalls** (friction decay) -> `#bulletLanded` -> objBullet.internalEvent goMode(`#land`) -> `updateLand`
  plays `ostrichEgg_land`; when it loops, `objBullet.update` `#land` branch calls **`me.big.reincarnate()`**
  -> hatches **babyOstrich** at the landing loc (objBullet.txt:278-283, modReincarnate.txt:49-72).
- **hits a wall/ceiling** -> `collisionWall*` goMode(`#land`) -> same hatch path.
- **collides with its target character** -> `updateFly` stat `#hitCharacter` -> `#bulletCollidedWithTarget`
  -> **modExploder.internalEvent** routes it to **`me.big.die()`** (modExploder.txt:70-71) -> `setDead(true)`.
  The bullet is removed in `#fly` mode; it NEVER enters `#land`, so **`reincarnate()` is NOT called** —
  **no babyOstrich hatches on a direct target hit.** Only a friction-LAND (open-ground or wall) hatches.

## Observed in the port (harness reproduction)

- `powerOstrich` anim.char resolves to **`powerOstrich`** (real bundled strips: `_naturalRanged` 18f,
  `_stand`, `_walk`, `_reel`, `_grave`). NOT blackOrc. ✓
- `ostrichEgg_fly` (10f) / `ostrichEgg_land` (13f) and `babyOstrich_*` strips are bundled. ✓
- Shot COUNT: one egg per attack cycle (animframe 14 crossed once per 18-frame strip). 16 eggs over 250
  ticks against a target at the edge of reach. ✓ cadence faithful (cooldown-gated entry).
- Egg DECELERATES by friction 5: speed 7.72 -> ... -> 0.2 (stall). ✓
- Egg HATCHES babyOstrich on stall-land: 3 hatchlings spawned (`enemy:babyOstrich`, team #monsters). ✓
- Direct-hit probe (`tools/_audit_powerOstrich2.ts`): an egg fired straight into a close target finished at
  (232,200) on the target's collision box and **STILL hatched 1 babyOstrich**.
- powerOstrich survives; target took damage (200 -> 178). Death/grave path is the shared CPUCharacter
  flasher -> `drawGrave` (`powerOstrich_grave` bundled) — not exercised to completion here.

## DIVERGENCES

### D1 — egg hatches a babyOstrich on a DIRECT TARGET HIT (port) vs only on a LAND-stall (original)

**FAITHFUL behavior (original):**
```
objBullet.updateFly: target collided -> stat = #hitCharacter
  -> internalEvent(#bulletCollidedWithTarget)
       -> modExploder.internalEvent: case #bulletCollidedWithTarget: me.big.die()  (modExploder.txt:70-71)
            -> setDead(true), bullet removed while STILL in #fly mode
            -> #land branch never runs -> reincarnate() NOT called -> NO babyOstrich
  (only a friction STALL -> #bulletLanded -> goMode(#land) -> updateLand loop -> reincarnate() hatches)
```

**PORT behavior:**
```
Projectile.update (projectile.ts): plain bullet collides with target
  -> e.send("takeHit", ...)
  -> this.finish(m.x, m.y)                          (projectile.ts:152)
       -> finish() spawns every reincarnateAs child  (projectile.ts:87-96)
            -> spawnFromSymbol("babyOstrich") -> a babyOstrich hatches AT THE TARGET
finish() is the single death choke-point for BOTH stall-land AND target-hit, so the port hatches in
both cases. Verified: a close-range egg that hit the target spawned 1 babyOstrich.
```

**Classification: PORT-BUG.** The port's `Projectile.finish()` unconditionally spawns `reincarnateAs`,
collapsing the original's two distinct death routes. In the original, modExploder's `die()` on
`#bulletCollidedWithTarget` is the WHOLE point of routing a hit egg around the `#land`/`reincarnate` path:
a powerOstrich that lands an egg ON the player/ally deals damage but does NOT spawn a free reinforcement;
it only breeds babyOstrich when an egg MISSES and lands on open ground (or a wall). The port turns every
on-target hit into a damage hit PLUS a spawned babyOstrich — extra enemies the original never produces,
making powerOstrich materially harder. (Splash/explode bullets are unaffected — they legitimately
detonate-then-finish in both engines; this bug is specific to a PLAIN `#type:#bullet` that ALSO carries
`#reincarnateAs`, i.e. ostrichEgg and lizardEgg.)

Fix sketch: only spawn `reincarnateAs` on the natural-LAND finish path (stall / lifetime / wall), not on
the target-collision branch — mirror modExploder routing the hit case to a plain `die()` (no reincarnate).

## Faithful quirks confirmed (no action)
- #fullstrength throw: constant egg speed = strength (≈7), independent of distance. ✓ (observed start 7.72)
- friction 5 deceleration + stall-land hatch. ✓
- 1 egg per attack cycle (animframe 14 / 18-frame strip), cooldown-30 gated entry. ✓
- sprite char resolves to the real `powerOstrich`/`babyOstrich`/`ostrichEgg` strips. ✓

powerOstrich | DIVERGENCES=1
- D1 PORT-BUG: egg hatches babyOstrich on a DIRECT target hit (port finish() spawns reincarnateAs on every death route); original modExploder routes #bulletCollidedWithTarget to die() with NO reincarnate — only a friction land-stall hatches.
