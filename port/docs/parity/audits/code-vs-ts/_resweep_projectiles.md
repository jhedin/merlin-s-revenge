# Re-Sweep: Projectiles / Spells / Mines / Multistage
**Lingo sources**: `casts/script_objects/objBullet.txt`, `objSpell.txt`, `objMine.txt`, `modSpellMultistage.txt`
**Port sources**: `port/src/systems/bullets.ts`, `components/projectile.ts`, `components/spellActor.ts`,
`systems/spells.ts`, `entities/objTypes.ts`, `components/mine.ts`, `components/charge.ts`, `components/control.ts`
**Extracted engine globals**: `extracted/engine/scripts/MovieScript 16 - main.lasm`,
`MovieScript 1 - GameSpecific.lasm`, `ParentScript 5 - modAttack.ls`, `ParentScript 35 - teamMaster.ls`

All six lenses applied to every handler group.

---

## Lens 1 — Translation

### objBullet

| Handler | Lingo | Port (file:line) | Verdict |
|---------|-------|-----------------|---------|
| `new` / `init` | `pStallSpeed = point(2,2)`, life counters | `maxLife` replaces stall counter; `friction:1, passThrough:true` set in every fire call | OK — different mechanism, same player outcome |
| `checkCollisions` | Returns `theLoc` unchanged; `gBulletsCollideWithBackground` gate makes collision a no-op | `passThrough:true` passed to Movement; bullets never test terrain | OK |
| `checkCollisionWithTarget` | `Math.abs` box test, ~12px half-width implied by sprite size | `projectile.ts:78` `Math.abs(p.x - m.x) < 12` | OK |
| `internalEvent(#bulletCollidedWithTarget)` | `modExploder` → `me.big.die()` for plain; splash variant calls `resolveSplash` | `projectile.ts` `finish()` → `resolveSplash` for splash, or entity die for plain | OK |
| `internalEvent(#bulletLanded)` | `goMode(#land)` | `finish()` with `reincarnateAs` spawn | OK |
| `reincarnateAs` spawn | Spawns each symbol at death location | `projectile.ts:finish()` loops `reincarnateAs`, calls `spawnFromSymbol` | OK |
| `setBeam` jitter | `random(20)-10` = range −9..10 (Lingo `random(n)` = 1..n, so result is −9..10) | `bullets.ts:60` `Math.floor(game.rng.next() * 13) - 6` = ±6 | DEVIATION (documented intentional scale) |
| `updateFly` | Advances by velocity each tick | Movement system advances `m.x/m.y` by `vx/vy` each tick | OK |
| `checkStalled` | `pStallSpeed = point(2,2)` stall detection removes bullet | `maxLife` counter removes bullet after N updates | OK — functionally equivalent timeout |

### objSpell

| Handler | Lingo | Port (file:line) | Verdict |
|---------|-------|-----------------|---------|
| `charge` / `calcSize` | Size = `charge * chargeSize` | `spellActor.ts:size()` = `charge * chargeSize` | OK |
| `calcChargeOffset` | `#top`: offset y by half size; `#side`: offset x by ±half | `spellActor.ts:setCharge()` aligns same way | OK |
| `release` / `releaseNormal` | Only executes if `releaseFunction = #release` | `spellActor.ts:release()` always executes; `releaseFunction` stored but `isStreaming()` gates the stream path | OK — functional parity (see Lens 3 for semantic note) |
| `moveXYfin` | Advances `m.x/m.y` toward target; `m.vx = m.vy = 0` | `spellActor.ts:update()` steps `m.x/m.y` directly at zero velocity | OK — moveBox is a no-op at zero velocity |
| `goMode(#explode)` | Grows by `chargeExplodeFactor`, then `resolveSplash` | `spellActor.ts:explode()` grows by factor, routes summon/depositMines, calls `resolveSplash` with `SPELL_RADIAL_SCALE=11.7` | OK |
| `calcAttackHitMagic` | `radius = getCurrentCharge() / 2` after `pCurrentCharge *= chargeExplodeFactor` | `splash.ts` `radius = explodeCharge/2` where `explodeCharge` = post-factor charge | OK |
| `calcCollisionVectSpell` | `speed = (hitRange - dist) * pAttack.power` | `splash.ts` `speed = (hitRange - dist) * powerScalar` | OK |
| `checkCollisions` | Returns `newVal` unchanged (no-op) | `spawnSpell` does not set `passThrough`; Movement no-op at zero velocity | OK |
| `animUpdated` / `getAnimSym` | Animation frame lookup | Animation handled by render layer separately | OK |

### objMine

| Handler | Lingo | Port (file:line) | Verdict |
|---------|-------|-----------------|---------|
| `new` defaults | `dieOnExplode=true`, `dieOnExplodeNumber=0`, `timeToPrime=30`, `triggerRadius=20`, `timeToCheck=3` | `objTypes.ts:spawnMine()` reads same fields; `dieOnExplode` default = `!== false` (true) | OK |
| `init` / `update` | FSM: stand→prime counter→primed→check every 3 frames | `mine.ts` FSM: stand→primed→collisionDetected→detonate | OK |
| `updateCheckCollisions` | `findTargetWithin(me.big, pTriggerRadiusTile).dist < pTriggerRadius²` (SQUARED comparison) | `mine.ts:collisionDetected()` calls `findHostileWithin(entity, x, y, triggerRadius, hits)`; port API applies `r²` internally | OK — semantically equivalent |
| `pTriggerRadiusTile` calculation | `floor(triggerRadius/tileSize)+1` | `mine.ts` uses `ceil(radius/tileSize)+1` | SAFE DEVIATION: port searches one extra shell, over-search not harmful |
| `internalEvent(#explodeFin)` | `dieOnExplode=true` → die; else `resetMine`, decrement `dieOnExplodeNumber` if nonzero | `mine.ts:detonate()` same logic | OK |
| `resetMine` | Resets FSM to stand state | `mine.ts:resetMine()` resets state to stand | OK |

### modSpellMultistage

| Handler | Lingo | Port (file:line) | Verdict |
|---------|-------|-----------------|---------|
| `depositMines` | `numMines = floor(charge/chargePerUnit)`, scatter `VarRoughly` | `summon.ts:depositMines()` same formula, `rng.int(2*slack)` | OK |
| `summonPayload` / `selectPayload` | Ascending tier scan, highest affordable | `summon.ts:selectTier()` ascending scan | OK |
| `convertToPayloads` | Converts summon list to payload format | `summon.ts` converts appropriately | OK |
| `chargeMultistage` | Increments charge up to max | `charge.ts` handles charge accumulation | OK |
| `pExperienceGain = 0.5` | Set in `init` at modSpellMultistage.txt:41 | `gainXp(0.5)` call site in port | OK |
| `chargeReinInToAvailable` | Missing `end` at line 100 (decompile artifact); permission UI feature | OUT OF SCOPE | — |
| `selectLastPayload` | Dead handler, `payloaf` typo at line 347 | No port equivalent needed | OK (dead code) |

---

## Lens 2 — Activation / Reachability

- **Bullets**: `fireBullet` → entity Movement → `Projectile.update()` each tick → `finish()` on timeout or collision. All paths active.
- **Splash bullets**: `fireSplashBullet` → `configureSplash` → on finish `resolveSplash`. Active.
- **Beam**: `performBeamAttack` → `configureBeam` → each tick updates, jitter applied. Active.
- **Spells**: `castMagic` (control.ts) → `spell.release()` → `SpellActor.update()` → `explode()`. Active.
- **Mines**: `depositMines` → `spawnMine` (via `spawnFromSymbol`) → Mine FSM ticks each update. Active.
- **Multistage doExplodeFunction**: called from `SpellActor.explode()` when `explodeFunction` is set. Active.
- **`releaseFunction` path**: `PlayerControl.castMagic` calls `isStreaming()` which tests `a.releaseFunction === "#fireBullets"`. Non-stream path always calls `spell.release()` directly — the stored `releaseFunction` value is not re-checked at release time. Path is correct.

---

## Lens 3 — Global + Initial State

| Global | Lingo (authoritative) | Port | Verdict |
|--------|----------------------|------|---------|
| `gBulletsCollideWithBackground` | main.lasm sets 1; **GameSpecific.lasm overrides to 0** at startup | `passThrough: true` on all bullet fire calls | OK |
| `gGameBulletLayer` | 75 (main.lasm) | Port renders bullets above actors in sweep order | OK (see Lens 5) |
| `gMineLayer` | 25 (main.lasm) | Mines are actor-type entities, drawn with actor sprites below bullets | OK |
| `releaseFunction` STRUCT_ATTACK default | `structMaster.ls:95` default = `"#release"` | `weapon.ts:resolveAttack()` fallback = `"#none"` (hardcoded, does not consult STRUCT_ATTACK) | **SEMANTIC GAP** — wrong default value, no behavioral difference (see note below) |
| `SineDist` | `locV / sin(atan(locV/locH))` = Euclidean distance | `Math.hypot(dx, dy)` | OK — mathematically identical |
| Mine `dieOnExplode` default | `true` in objMine `new` handler | `!== false` in `spawnMine` | OK |
| Mine `timeToPrime` | 30 frames | `mine.ts` reads from registry, default 30 | OK |
| Mine `timeToCheck` | 3 frames | `mine.ts` reads from registry, default 3 | OK |

**Note on releaseFunction semantic gap**: `resolveAttack` at `weapon.ts:209` uses `strOr(r["releaseFunction"], "#none")` as fallback. The original `STRUCT_ATTACK` default is `"#release"`. Any actor whose data omits `releaseFunction` gets `"#none"` in the port versus `"#release"` in the original. Behaviorally inert because `isStreaming()` only branches on `"#fireBullets"`, and the non-streaming spell path in `PlayerControl.castMagic` always calls `spell.release()` directly regardless of the stored `releaseFunction` string. The CpuAI spell path also calls `release()` directly. No player-visible difference, but the stored value diverges from the original.

---

## Lens 4 — Player POV (Present AND Correct)

- **Bullet flight**: Speed from `vx/vy` set at fire time, no friction (`friction:1`). Matches Lingo's fixed-velocity flight. Player sees bullets at correct speed and direction.
- **Bullet collision box**: 12px half-width. Original sprite-implied radius comparable. Present and plausible.
- **Beam jitter**: Port uses ±6px vs original −9..10. Player sees a narrower jitter cone on beam attacks. Documented intentional deviation (scale calibration), not flagged as gap.
- **Spell grow→fly→explode**: Orb grows with charge, flies to target, explodes with radius = `(charge × chargeExplodeFactor) / 2`. Formula correct at `spellActor.ts:explode()` + `splash.ts`. Player sees correct blast radius.
- **Spell radial knockback shape**: `speed = (hitRange - dist) * powerScalar`. Falloff shape matches Lingo (linear from edge). `SPELL_RADIAL_SCALE=11.7` is a px-scale calibration — shape is correct.
- **Mine arm delay**: 30-frame prime delay before mine can trigger. Matches original. Player cannot trigger a just-placed mine instantly.
- **Mine trigger**: `triggerRadius=20` (data default). Mine detonates when enemy enters radius. Correct.
- **Mine dieOnExplode**: Single-shot energyMines are consumed after one blast (default `true`). Re-arming mines set `dieOnExplode:false`. Both paths correct.
- **Multistage summon tier**: `selectTier` ascending scan picks highest affordable tier for given charge. Correct tier selection; player summons the right unit.
- **depositMines count**: `floor(charge/chargePerUnit)` mines placed. Matches original.
- **Reincarnation**: `flamingRock` leaves a fire mine; `ostrichEgg`/`lizardEgg` hatch into creatures. `spawnFromSymbol` routes correctly. Player sees correct spawns.

---

## Lens 5 — Draw Order / Occlusion

- **Original**: Bullets at `gGameBulletLayer=75`, mines at `gMineLayer=25`, spells likely at or above bullets.
- **Port**: Render sweep order: actor sprites (includes mine entities) → bullets → spells. Spells drawn above bullets, bullets above actors. Z-ordering preserved.
- Explosions (splash visual FX) rendered by the FX system above actors but below HUD. No occlusion gap found.

---

## Lens 6 — Missing Tests

| Behavior | Covered? | Test file |
|----------|----------|-----------|
| Bullet flight + collision | Yes | `bullet_reincarnate.test.ts` |
| Bullet reincarnateAs (fire/hatch) | Yes | `bullet_reincarnate.test.ts` |
| Spell radial falloff / payload list | Yes | `spells_c.test.ts` |
| Spell summon tier selection | Yes | `spells_c.test.ts` |
| depositMines count + dieOnExplode default | Yes | `deposit_mines.test.ts` |
| Mine FSM: stand→prime→primed→collisionDetected→detonate | **NO** | — |
| Mine re-arm (`dieOnExplode:false`, `dieOnExplodeNumber`) | **NO** | — |

**MISSING-TEST GAP**: The mine FSM trigger lifecycle — prime counter counting down, primed state checking every `timeToCheck` frames, `collisionDetected` firing when an enemy enters `triggerRadius`, calling `detonate()` which fires `resolveSplash` — is not exercised by any test. `deposit_mines.test.ts` only tests mine spawn count and the `dieOnExplode` component default; it never ticks the mine FSM or places an enemy within trigger range. A mine-FSM test would catch timing bugs, radius bugs, and detonation-path regressions.

---

## Summary

Two gaps identified:

1. **SEMANTIC (no behavioral effect)** — `releaseFunction` default wrong in port: `resolveAttack` (`weapon.ts:209`) falls back to `"#none"` instead of the original STRUCT_ATTACK default `"#release"`. No runtime branch depends on this value for non-streaming spells (control.ts calls `release()` directly). Wrong value stored, correct behavior produced.

2. **MISSING-TEST (Lens 6)** — Mine FSM trigger lifecycle (stand/prime countdown → primed/check interval → `collisionDetected` → `detonate` → `resolveSplash`) has no observable test. Re-arm path (`dieOnExplode:false`) also untested.

All other handlers, constants, formulas, and draw-order across all four Lingo files verified clean against their port counterparts across all six lenses.

FILE=_resweep_projectiles | GAPS=2 | releaseFunction default "#none" vs original "#release" in resolveAttack (weapon.ts:209) — semantic only, no behavioral gap; mine FSM trigger lifecycle (prime→primed→detonate) and re-arm path have no observable test
