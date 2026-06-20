# Plan C — Spell roster (charged blasts · splash/explode/status · summons)

Backlog items **C1/C2/C3** (see [`../README.md`](../README.md) Phase C; audit
[`../03-spells-weapons.md`](../03-spells-weapons.md)). Rides on the now-faithful combat/AI/weapon
engine: **A1** (`takeHit(vx,vy,attackerId,mult)` collision vector + inertia-damped knockback —
[`plans/A1-damage-knockback.md`](A1-damage-knockback.md)), **B1** (`TeamMaster`/`findTarget`/
`impactMeleeAttack`/`CpuAI`), **B2** (`WeaponManager` + `charge.ts` data-driven charge/cooldown —
[`plans/B2-weapon-manager.md`](B2-weapon-manager.md)). This plan adds the *spell content* B2 built the
engine for: it does **not** rebuild the charge/weapon substrate, it plugs spells into it.

**The C-phase thesis (proven against the data below):** the **charged blasts (C1) are essentially
FREE** — they are `#magic` weapons that differ from `energyBlast` only in their `#attack` numbers, so
the B2 engine fires them with *zero new mechanics* (data wiring + a pickup row). The **real new engine
work is C2** — `modSplashDamage` / the `#explode` attack type (radius damage hitting all targets in a
charge-derived radius), and the two status payloads `#takeFreeze` / `#takeHeal` with their real
vector-derived formulas and **payload-*lists*** (a single hit running two functions). **C3 (summons)**
is a thin mechanic over B1's existing spawn path + B2's charge tiers, deferring the army-reserve
persistence (G2) and the spell-icon/permission UI.

> **F1 dependency for in-game testing.** Every C spell is **unreachable in the room-1 slice**
> (`descent_into_darkness` places only `#energyBlast`/`#merlinSword`/`#maxikit` + a skipped
> `#energyPulseSpell`). The maps that place C content (§reachability) only become loadable once **F1**
> (asset pipeline) ships all 47 maps. So C's **unit tests** stand alone, but its **in-browser /
> reachability smoke** is gated on F1. C can be *built and unit-proven* before F1; it can only be
> *played* after. Build order is therefore: unit-test each mechanic against cited data now; wire the
> in-game smoke behind F1.

---

## (a) Original mechanics, grounded in cited data/handlers

### A.0 The one shared model (recap from B2, with the C-relevant deltas)

A spell scroll is an `#objScroll` carrying an `#attack` prop-list; picking it up calls
`addWeapon(sym, attack)` (B2). On cast the character charges (`charge.ts`: `chargeMax/Start/Speed`
from `#attack` × mana) and on release fires `#bullet` at `#spellSpeed`. **C touches three seams the
B2 engine left as data-only:** (1) the `#attack.type === #explode` branch of `calcAttackHit` /
`calcCollisionVect`; (2) the `#payloadFunction` dispatch in `teamMaster.impactMeleeAttack`
(`CallPayloadFunction` → `takeHit`/`takeFreeze`/`takeHeal`/`armyTeleportOut`); (3) the
`#explodeFunction`/`#multistage` summon path (`modSpellMultistage` → `armyMaster.createUnit`).

### A.1 — Charged blasts (C1): `cBlast`, `cBlastAi`, `darkBlast` (+ the audit's `energyBlast`/`arcticBlast` neighbours)

All are `#objScroll`, `#animType:#magic`, `#bullet:#energyBlastBullet`, `#power` scalar, `#cooldown`,
`#spellSpeed:20`. They differ **only** in their charge numbers — i.e. exactly the fields `charge.ts`
already reads from `#attack`:

| Spell | source | chargeSpeed | chargeStart | chargeMax | Basic | Modifier | cooldown | power | limitMagic | gmg |
|---|---|---|---|---|---|---|---|---|---|---|
| `energyBlast` (ref) | `act_cBlast`?no — `act_energyBlast` (B2) | 1 | 0 | 999 | 5 | .75 | 30 | .75 | **true** | 15/5/5 autofire |
| `cBlast` | `act_cBlast.txt` 6–34 | **.1** | 0 | 999 | **999** | **0** | 30 | .5 | false | 999/1/1 autofire |
| `cBlastAi` | `act_cBlastAi.txt` 6–30 | **.2** | 0 | 999 | **18** | **3** | 30 | .5 | false | (none) |
| `darkBlast` | `act_darkBlast.txt` 6–30 | 1 | **5** | 999 | **10** | **.5** | **15** | **3** | false | (none) |
| `arcticBlast` | `act_arcticBlast.txt` 6–35 | .25 | 0 | 999 | 5 | .75 | 30 | .75 | **true** | 18/1/6 autofire |

Read directly off the data: `cBlast` has `chargeMaxBasic:999` + `chargeMaxModifier:0` ⇒
`chargeMax = min(999, capacity*0 + 999) = 999` always — the audit's "effectively always huge", and
`chargeSpeed .1` makes it a slow-but-devastating charge. `cBlastAi` (`Modifier 3`/`Basic 18`) scales
its ceiling steeply with `manaCapacity` — an **AI-caster tuning** of the same bolt. `darkBlast` is the
**fast cheap** blast: `chargeStart 5` (fires meaningful damage instantly), `cooldown 15` (half),
`power 3` (high). None of these needs a new branch — `charge.ts.chargeMax/Start/Speed` + B2's magic
dispatch already produce the correct per-cast charge from these numbers. **`arcticBlast` is a C1 bolt
*plus* a C2 status payload** (`payloadFunction:[#takeFreeze,#takeHit]`, `glowTeal`,
`freezeMultiplier` on its bullet) — its charge/fire half is C1-free, its freeze half is C2.

### A.2 — Splash + `#explode` + status (C2): the real engine work

**Two distinct radius mechanisms** (don't conflate them — the data splits them by `#type`):

**(i) `#type:#explode` bullets** — `energyPulse`, `thunderBlast`, `freezeBlast`, `energyMine`.
On a trigger event they call `modExploder.explode` → `g.teamMaster.impactAttack(me.big)` then
`goMode(#explode)` (`modExploder.txt` 41–47). The hit/vector use the **magic** path because
`calcAttackHit`/`calcCollisionVect` route `#explode` → `calcAttackHitMagic` / `calcCollisionVectSpell`
(`modAttack.txt` 231–233, 421–423). The radius comes from **`getCurrentCharge()`**, which for a bullet
is overridden by `modExploder.getCurrentCharge → pExplodeCharge = attack.explodeCharge`
(`modExploder.txt` 38, 49–51). So:
- `myRadius = explodeCharge / 2` (`calcAttackHitMagic` 269; `calcCollisionVectSpell` 529).
- **hit test** (`calcAttackHitMagic` 271–277): `GeomDistSqr(self, target) < (myRadius + targetRadius)²`
  — **all** units in the disc are hit.
- **vector** (`calcCollisionVectSpell` 539–555): `speed = (hitRange − dist) · power`; if `speed>0`,
  `collisionVect = GeomMoveVector(self→target, speed)` — **radial falloff**: full at the centre,
  zero at the rim. Damage = `(|vx|+|vy|)·damageMultiplier` via `modEnergy.takeHit` (277).
- explode-charge values: `energyPulse explodeCharge:10` (`damageMultiplier:5`, `power:1`),
  `thunderBlast explodeCharge:100` (`power:.5`), `freezeBlast explodeCharge:100` (`power:.25`,
  `freezeMultiplier:3`), `energyMine explodeCharge:50` (`damageMultiplier:5`, `power:1.5`). Trigger
  events: `#explodeEvents:[#bulletArrivedAtTargetLoc,#bulletCollidedWithTarget,#bulletLanded]`
  (pulse/thunder/freeze) — explode on landing; `energyMine #explodeEvents:[#mineTriggered]` — explode
  on proximity trigger.

**(ii) `#type:#bullet` + `#splashDamageOn` bullets** — `towerAxe` only (`act_towerAxe.txt`:
`type:#bullet`, `power:50`, `damageMultiplier:10`, `splashDamageOn:true`, `splashGraveOn:true`).
Here `calcAttackHit`/`Vect` route `#bullet` → the **splash** handlers in `modSplashDamage`
(`modAttack.txt` 210–212, 445–447):
- **radius** = `calcAttackDistSplash = pAttack.power` (`modSplashDamage.txt` 61–63) ⇒ `50` px.
- **hit test** (`calcAttackHitSplash` 65–83): `GeomDistSqr(target, self) < power²`.
- **vector** (`calcCollisionVectSplash` 87–105): `CollisionCalcVect(targetLoc, attackLoc, power)`
  (`CollisionCalcVect().txt`): `outputPower = power − dist`; if `>0`, the per-frame step
  `initialFrameMove = (target−self) / (dist/outputPower)` — again radial falloff. On
  `#land`/`#mineTriggered` it also `drawSplashGrave` (`pSplashGraveOn` → `drawGrave`) — a cracks
  decal (cosmetic; deferrable).

**Both** paths converge on `teamMaster.impactAttack → impactMeleeAttack(obj)` (`teamMaster.txt`
1037–1123), which already (B1) does the team-scoped area search and per-victim
`calcAttackHit`/`calcCollisionVect`. **The new bit C2 adds is the `payloadFunction` dispatch at the
end of that loop** (1116–1120): `CallPayloadFunction(payloadFunctions, nObj, collisionVect, obj,
owner)`.

**`CallPayloadFunction`** (`CallPayloadFunction ().txt`): the key insight is `payloadFunction` is
**either a symbol or a LIST**; a list runs *each* function on the same hit. Functions:
`#takeHit`, `#takeFreeze`, `#takeHeal`, `#armyTeleportOut`. B2's `Projectile` only ever sends
`#takeHit` — C2 must dispatch the real (possibly-list) payload.

- **`#takeHit`** = `modEnergy.takeHit` (the B2 path): `damage = (|vx|+|vy|)·damageMultiplier`.
- **`#takeFreeze`** = `modFreeze.takeFreeze(collisionVect, attackingObj, owner)` (`modFreeze.txt`
  70–88): first hit only (`pFrozen=false`) sets `pFrozen`, halves speed (`setSpeed(0.5×prev)`), and if
  `attack.glowTeal` glows teal. Then **`freezeTime = (|vx|+|vy|) · attack.freezeMultiplier · 4`** is
  *subtracted from the freeze counter's count* (the counter counts up to 1000; subtracting extends the
  thaw time). `defrost` (31–42) restores `2·curr − speedChange` to undo the halving and accounts for
  level-ups/potions gained while frozen, and stops the teal glow.
- **`#takeHeal`** = `modEnergy.takeHeal(collisionVect, healingObj)` (`modEnergy.txt` 256–265):
  **`healAmount = (|vx|+|vy|) · 2`**, `increaseEnergy(healAmount)`, `glowGold()`. (Same L1-of-vector
  shape as damage, ×2.) `healBlast` (`act_healBlast.txt`) targets `#friendly` /
  `#targetCriteria:#lowestHealth`, `hits:[#teamMembers]`, `power:1`, `cooldown:50`,
  `payloadFunction:#takeHeal`, `spellSpeed:30`.
- **`#armyTeleportOut`** = C3 (army-reserve persistence, G2) — out of scope here.

**`arcticBlast`/`freezeBlast`** use the **list** `[#takeFreeze, #takeHit]` — a single hit both freezes
**and** damages; the order matters (freeze reads the vector, then takeHit applies damage off the same
vector). `energyMines` uses `payloadFunction:#takeHit` (the mine scatter is the explode-function, see
below); `healBlast` uses `#takeHeal`.

**Towers as ranged CPUs** (`act_dwarfTower.txt`): `objType:#objCPUCharacter`, `walkSpeed:0`,
`#attack` `animType:#naturalRanged`, `bullet:#towerAxe`, `firingType:#proportional`, `reach:600`,
`cooldown:10`, `reelProof:true`, `inertia:95`. A tower is **just a static ranged CpuAI** that fires a
splash bullet — B1/B2's CpuAI ranged path already does everything except (a) being stationary
(walkSpeed 0, already a stat) and (b) the bullet being a splash bullet (the new C2 mechanic).
`garTower` is the same with `#scArcherArrow` `#fullstrength` + a reincarnate (E).

**`energyMines` deposit** (`act_energyMines.txt`: `explodeFunction:#depositMines`,
`chargePerUnit:10`, `payloadFunction:#takeHit`). On release, `modSpellMultistage.depositMines`
(`modSpellMultistage.txt` 124–149): `numMines = charge / chargePerUnit`;
`possibleDistance = charge/2`; spawn `numMines` `energyMine` actors at
`VarRoughly(loc, possibleDistance)` random offsets, each `setOwner(owner)`. Each mine then explodes
(per (i)) on `#mineTriggered`. (`energyMines` is itself a multistage `explodeFunction` spell but with
no `#multistage` tiers — it's the deposit variant, not a summon.)

### A.3 — Summons (C3): `armySummon`, `monsterSummon`, (+ dead: `skelitonSummon`/`undeadSummon`/`goblinSummon`/`scSummon`)

A summon scroll is a `#magic` spell with `#explodeFunction:#summonUnit` and a `#multistage` prop-list
mapping **charge thresholds → unit type**:

| Spell | source | multistage tiers (chargeRequired → type) | team / allegiance | randomSummon | reserve? |
|---|---|---|---|---|---|
| `armySummon` | `act_armySummon.txt` | warrior 10, archer 15, monk 20, dwarf 25, kingInGame 32 | `#aldevar` friendly | false | **yes** (reservationsMaster) |
| `monsterSummon` | `act_monsterSummon.txt` | summonArcher 12, summonWarrior 15, summonOrc 20, summonBoulder 25, summonGolem 31 | `#monsterSummon` enemy | false | yes |
| `skelitonSummon` | `act_skelitonSummon.txt` | footSoldier 10 … skelitonLord 35 (8 tiers) | `#enemies` enemy | **true** | yes |
| `undeadSummon` | `act_undeadSummon.txt` | skeletonWarrior 15 … skelitonLord 38, power 2 | enemy | true | yes |
| `goblinSummon` | `act_goblinSummon.txt` | goblinWarrior 15 … blackOrc 36 | enemy | true | yes |
| `scSummon` | `act_scSummon.txt` | scWarrior 16, scArcher 17, scMonk 20 | enemy | true | yes |

**The spawn path** (`modSpellMultistage.txt`): on `#charge` → `selectPayload` (316–341) walks the
tiers and sets `pCurrentPayload` to the **highest tier whose `chargeRequired <= charge`** (and sets
`payloadFunction = [pPayloadFunctionNonBlank]` so the bolt still does its `#takeHit`). On `#explode`
→ `doExplodeFunction` → `summonPayload` (372–393) → `g.armyMaster.createUnitFromSummonSpell(me.big)`.
**`createUnitFromSummonSpell`** (`armyMaster.txt` 140–149): `team = spell.getTeam()`,
`typ = spell.getPayload()`, `startLoc = spell.getLoc()`, then `createUnit(team, typ, startLoc,
spellName)`. **`createUnit`** (80–108): `g.actorMaster.newActor({typ, startLoc, useOffset:false})` —
**this is exactly the port's `spawnEnemy`/`spawnAlly` archetype call.** If `armyDetails <> #none`
(a reserved, previously-summoned unit at a saved level) it `restoreArmyDetails` + `armyTeleportIn` +
`restoreUnitToCombat` (the **reserve persistence = G2**); for a fresh summon `armyDetails = #none`
and it just spawns the default-level unit. Owner gains `pExperienceGain:0.5` (391).

**`randomSummon` charge wobble** (`modAttack.calcAttackChargeMax` 106–112): when `randomSummon` and
the 2nd tier exceeds the deterministic `chargeMax`, the ceiling is randomised:
`tempMax = chargeMax·random(20)/17 + random(multistage[1])`; `chargeMax = min(chargeMax, tempMax)`;
`chargeMax += random(2)−1`. So skeleton/goblin/undead/sc summons produce a **random tier within the
affordable band each cast** (you can't reliably pick the top unit) — a deliberate flavour difference
from the deterministic army/monster summons.

**`reservationsMaster` permission** (`obtainPermissionOrHalt` 236–267, `chargeReinIn` 84–90): while
charging, an `#aldevar`/army summon asks the reservations master for permission to release a unit; if
denied, the charge is **reined in** below the first tier (you can't over-summon your headcount). This
is the **army-reserve / headcount system = G2**, explicitly out of scope (§g). For C3 the summon
**ignores reservations** (always permitted) and spawns a fresh default-level unit — faithful to the
"no reserve yet" slice, exactly as B1's spawn does today.

---

## (b) Gap vs the port today

| Mechanic | Engine status (A1/B1/B2) | C work |
|---|---|---|
| Charged `#magic` bolt (charge/cooldown/fire) | **FAITHFUL** — `charge.ts` + `WeaponManager` + `castMagic`/`fireBullet` | **C1: data wiring only** — add `cBlast`/`darkBlast`/`arcticBlast`(bolt half) as `addWeapon` rows; no code |
| `damageMultiplier` from `#attack` into `takeHit.mult` | **FAITHFUL** (B2) | reused by every splash bullet |
| `#type:#explode` radius hit (`explodeCharge/2`, hit-all-in-disc, radial-falloff vector) | **MISSING** | **C2: new** — `SplashDamage` resolution + an `#explode`-on-trigger path in `Projectile` |
| `#splashDamageOn` bullet (`power`-radius, grave) | **MISSING** | **C2: new** — same `SplashDamage` resolver, `power`-radius variant; grave decal deferrable |
| `payloadFunction` dispatch (incl. **lists**) at impact | **PARTIAL** — `Projectile` hardwires `#takeHit` | **C2: new** — `CallPayloadFunction`-equivalent dispatch over a (sym \| list) payload |
| `#takeFreeze` vector formula | **PARTIAL** — `Freeze.takeFreeze(ticks)` is a scalar | **C2: new** — `(|vx|+|vy|)·freezeMultiplier·4`, 0.5× speed + teal lifecycle, first-hit-only latch |
| `#takeHeal` | **MISSING** — pickups heal instantly; no payload | **C2: new** — `Energy.takeHeal(vx,vy)` = `(|vx|+|vy|)·2` + `increaseEnergy` + gold glow |
| friendly-target / `#lowestHealth` cast (healBlast) | **MISSING** | **C2: new (small)** — cast aims at friendly lowest-health via `TeamMaster.findTarget` allegiance=friendly |
| summon spell (`explodeFunction:#summonUnit` + `multistage`) | **PARTIAL** — ad-hoc `E`-key `spawnAlly("warrior")` | **C3: new** — charge-tier → type → `spawnAlly`/`spawnEnemy` (the existing `createUnit` shape) |
| `randomSummon` charge wobble | **MISSING** | **C3: new (small)** — wobble in `charge.ts.chargeMax` for `randomSummon` attacks |
| reservations / army-reserve persistence / spell icons | **MISSING** | **OUT (G2 / §g)** — C3 summons a fresh default-level unit, always permitted |
| `energyMines` deposit (`#depositMines`) | **MISSING** | **C2 (optional, reachable)** — scatter N `energyMine` actors at random offsets |
| `modFireBullets` streaming release (`energyPulseSpell`/`energyBeamSpell`) | **MISSING** | **deferred (§g)** — energyPulseSpell IS placed (19 maps) but its streaming-release is large; the `energyPulse` *bullet* splash is C2 |
| GMG toggle / magic limiter master | **MISSING** | **OUT (§g)** — `gmg*` fields parse into `AttackData` (B2); the on/off swap + limiter master are deferred |

**What's genuinely free vs new (the headline):**
- **FREE on B2 (C1):** `cBlast`, `darkBlast`, `cBlastAi`, and the *bolt half* of `arcticBlast`/`healBlast`.
- **NEW engine (C2):** `SplashDamage` (`#explode` + `#splashDamageOn` radius resolution), the
  `payloadFunction`/`CallPayloadFunction` dispatch (incl. lists), `#takeFreeze` vector formula,
  `#takeHeal`. These unlock `energyPulse`, `thunderBlast`, `freezeBlast`, `towerAxe`, `energyMine`,
  `arcticBlast`(freeze), `healBlast`, and the towers as a group.
- **NEW mechanic (C3):** summon-on-release (charge-tier → `createUnit`-shape spawn) + `randomSummon`
  wobble.

---

## (c) Component / file-level design

### C1 — no new components

`cBlast`/`darkBlast`/`arcticBlast`(bolt) are **`AttackData` rows + a pickup mapping**. The only files
touched:
- `entities/archetypes.ts` / `data.ts`: ensure `resolveActor("cBlast"/"darkBlast"/"arcticBlast")
  .attack` resolves (it already does — they're in `data.json`). No new fields beyond what `charge.ts`
  reads, except `arcticBlast` carries `payloadFunction`/`freezeMultiplier`/`glowTeal` (used by C2).
- `components/pickup.ts`: add `"cBlast"`/`"darkBlast"`/`"arcticBlast"` effect rows that
  `weaponManager.addWeapon(sym, resolvedAttack)` (the `energyBlast` pattern from B2). `cBlastAi` is an
  **AI-caster** scroll (not player-collectable; placed in 0 maps anyway) — skip.

### C2 — new `SplashDamage` resolution + payload dispatch + status handlers

**New `components/splash.ts` — `SplashDamage` (a resolution helper, not per-frame state).** Mirrors
`modSplashDamage` + the `#explode` branch of `modAttack`. It is invoked **at the moment a bullet
triggers** (lands / collides / mine-triggered), and resolves the area hit through `TeamMaster`:

```
resolveSplash(attacker, attack, teamMaster, sendHit):
  // radius + per-victim vector by attack type (cite: modAttack 231/421, modSplashDamage 61/87)
  if attack.type === "explode":
     radius   = attack.explodeCharge / 2                      // modExploder.getCurrentCharge
     hitTest  = (v) => distSqr(v, self) < (radius + v.radius)^2          // calcAttackHitMagic
     vectOf   = (v) => geomMoveVector(self->v, (radius + v.radius - dist) * attack.power)  // calcCollisionVectSpell
  else // bullet + splashDamageOn (towerAxe)
     radius   = attack.power                                  // calcAttackDistSplash
     hitTest  = (v) => distSqr(v, self) < radius^2                       // calcAttackHitSplash
     vectOf   = (v) => collisionCalcVect(v - self, attack.power)         // CollisionCalcVect
  for each hostile v in teamMaster area-search(self, radius) filtered by attack.hits roles:
     if hitTest(v):
        applyPayload(attack.payloadFunction, v, vectOf(v), attacker)     // §payload dispatch
```

This **reuses `TeamMaster`'s existing area search and allegiance/role filtering** (the same code path
`impactMeleeAttack` uses — extend `teams.ts` with an `impactAreaAttack(attacker, radius, hitFn)` that
takes an explicit radius + per-victim vector, factoring out the role/allegiance loop B1 already wrote;
`impactMeleeAttack` becomes the melee-reach special case of it). Keep the two new geometry helpers
(`collisionCalcVect`, radial `geomMoveVector`) pure + unit-tested in `engine/` (faithful ports of
`CollisionCalcVect()` and `GeomMoveVector`).

**`components/projectile.ts` — the `#explode`/`#splashDamageOn` trigger path.** Today `Projectile`
sends `takeHit` to the single entity it collides with. Add:
- a `mode: "fly" | "land" | "explode"` (faithful to `objBullet.goMode`), and a `triggerEvents` set
  from `#explodeEvents` (default: collide/land);
- on a trigger event, if the bullet's `attack.type === "explode"` **or** `attack.splashDamageOn`, call
  `resolveSplash(...)` instead of the single-target `takeHit`, then enter `explode`/`land` (play the
  explode anim/sound, then die — `modExploder.update`/`explodeFin`). A straight bullet (no splash) keeps
  the B2 single-target behaviour unchanged.
- `energyMine` is an `#objMine` actor (not a flying bullet) that triggers on proximity
  (`#mineTriggered`) — model as a static entity with a proximity check that fires the same
  `resolveSplash`. (Reachable: `energyMine` 5 maps, `energyMines` deposit 14 maps.)

**Payload dispatch — `applyPayload(payload, victim, vect, attacker)`** (new small helper, the
`CallPayloadFunction` port). `payload` is `string | string[]`; for each function:
- `"takeHit"` → `victim.send("takeHit", vx, vy, attacker.id, attack.damageMultiplier)` (existing).
- `"takeFreeze"` → `victim.send("takeFreeze", vx, vy, attacker.id)` (new vector signature, see Freeze).
- `"takeHeal"` → `victim.send("takeHeal", vx, vy, attacker.id)` (new, see Energy).
- `"armyTeleportOut"` → no-op for C (G2).
This is the single seam that makes a **list** payload (`[#takeFreeze,#takeHit]`) run both effects on one
hit — the audit's "payload-lists unmodelled" gap closed.

**`components/freeze.ts` — vector `takeFreeze`.** Change the signature from `takeFreeze(ticks)` to
`takeFreeze(vx, vy, attackerId)` and compute the real formula (cite `modFreeze.txt` 70–88):
```
if (!frozen) { frozen = true; prevSpeed = speed; setSpeed(0.5*prevSpeed); if (attack.glowTeal) glowTeal() }
freezeTicks += (|vx| + |vy|) * attack.freezeMultiplier * 4    // accumulate, not max
```
`update` decrements; at 0 → `defrost` (restore speed, accounting for level/potion speed gained while
frozen — `defrost` 31–42 — and stop teal). **The A1 coupling matters:** `vx,vy` is the *same*
collision vector A1/C2 builds, so a centre-of-blast hit freezes longer than a rim hit — faithful and
free once the vector flows. Keep a back-compat scalar entry only if a test needs it; prefer the vector
form everywhere (the only caller is the payload dispatch).

**`components/combat.ts` (Energy) — `takeHeal`.** Add a `takeHeal(vx, vy, healerId)` handler
(cite `modEnergy.txt` 256–265): `healAmount = (|vx|+|vy|)*2; increaseEnergy(healAmount); glowGold()`.
Heal respects max energy (existing `increaseEnergy`); no i-frames (it's friendly). The radial vector
falloff means a friendly near the blast centre heals more — same shape as damage.

**`healBlast` friendly-target cast** (`components/control.ts` / `CpuAI`). healBlast's `#attack` has
`targetAllegiance:#friendly`, `targetCriteria:#lowestHealth`. The player cast can stay
aim-at-cursor (the bolt is a radial heal-on-land; whoever's friendly in the disc heals) — the
`targetCriteria` is mainly for **CPU** casters (a friendly monk auto-heals the lowest-health ally).
For C2, wire the heal payload + radial resolution; the `#lowestHealth` *auto-targeting* for CPU heal
casters is a small `TeamMaster.findTarget` call with `allegiance:friendly, criteria:lowestHealth` —
include it if a reachable CPU caster needs it (else defer with a note; player heal works without it).

### C3 — summon mechanic (`components/summon.ts` or a method on the magic-cast path)

A summon spell is a `#magic` weapon whose **release runs `summonUnit` instead of (or alongside)
firing the bolt**. Design: when `castMagic` releases a weapon whose `attack.explodeFunction ===
"summonUnit"`:
1. `selectTier(charge, attack.multistage)` → the highest `type` whose `chargeRequired <= charge`
   (port of `selectPayload`); `#none` if below the first tier (cast fizzles, bolt still flies if
   `payloadFunctionNonBlank`).
2. `spawnUnit(type, loc, team)` — call the **existing archetype spawn** the port already has
   (`game.spawnAlly(type, x, y)` for friendly `#aldevar`/`armySummon`; `game.spawnEnemy(type, x, y)`
   for enemy `monsterSummon`/`skeliton…`). This **is** `armyMaster.createUnit`'s
   `actorMaster.newActor({typ, startLoc})` with `armyDetails = #none` (fresh, default level). Owner
   gains `+0.5` experience (`pExperienceGain`).
3. The bolt itself still fires (the `energyBlastBullet` with `payloadFunction:#takeHit`) so a summon
   cast also damages — faithful (`selectPayload` keeps `payloadFunction` non-blank).

This **replaces the ad-hoc `E`-key `spawnAlly("warrior")`** in `control.ts` (which hardcodes one unit,
cooldown 90) with the real charge-tier model on the `armySummon` weapon. The summon spell is acquired
via `addWeapon` like any magic weapon (the `armySummon` scroll is placed in **22 maps**).

**`randomSummon` wobble** goes in `charge.ts.chargeMax`: if `attack.randomSummon` and
`multistage[2] > chargeMax`, apply `tempMax = chargeMax*random(20)/17 + random(multistage[1]);
chargeMax = min(chargeMax, tempMax) + random(2)-1` (cite `modAttack.txt` 106–112). Affects
skeleton/goblin/undead/sc summons (all **dead content** — 0 maps — so this is faithfulness for
completeness, not reachability; keep it but flag it can't be in-game tested).

**Explicitly NOT in C3:** reservations/permission (`obtainPermissionOrHalt`/`chargeReinIn`), spell
icons (`objSpellIcons`), `armyTeleportIn`/`restoreArmyDetails` (reserve persistence), and
`displayNextSummons` HUD — all **G2** (army-reserve). C3 summons a fresh default-level unit, always
permitted, no icons. Note the seam loudly in the plan output and code comments.

---

## (d) Implementation order (substrate-first; C1 → C2 → C3)

**C1 (smallest, do first — proves the engine is generic):**
1. Add `cBlast`/`darkBlast`/`arcticBlast` pickup rows → `addWeapon` (reuse B2's `energyBlast` row).
   `arcticBlast` carries its payload fields but fires as a plain bolt until C2 lands (graceful — the
   payload dispatch defaults to `#takeHit`). Unit-test: `resolveAttack` for each yields the cited
   charge numbers; `charge.ts` reproduces `cBlast`'s always-999 ceiling, `darkBlast`'s start-5/cd-15.

**C2 (the real engine work):**
2. **Geometry substrate** — port `CollisionCalcVect` + radial `GeomMoveVector` into `engine/` (pure,
   unit-tested against hand-computed centre/rim vectors).
3. **`TeamMaster.impactAreaAttack(attacker, radius, vectOf, payloadFn)`** — factor the area-search +
   role/allegiance filter out of `impactMeleeAttack` (B1) so both melee and splash share it. Unit-test:
   a 3-enemy cluster, radius covers 2, payload runs on exactly those 2.
4. **`SplashDamage` resolver** (`splash.ts`) — `#explode` (explodeCharge/2, magic hit/vect) and
   `#splashDamageOn` (power-radius) variants; unit-test radius + radial falloff (centre hit > rim hit;
   out-of-radius = no hit) for `energyPulse`(10), `thunderBlast`(100), `towerAxe`(50).
5. **Payload dispatch** `applyPayload(sym|list, ...)` — unit-test the **list** `[#takeFreeze,#takeHit]`
   runs both; `#takeHeal` heals; unknown/`armyTeleportOut` no-op.
6. **`Freeze.takeFreeze(vx,vy)`** vector formula + 0.5× speed + teal + accumulate + defrost. Unit-test
   the formula (`(|vx|+|vy|)·mult·4`), first-hit latch, thaw restores speed.
7. **`Energy.takeHeal(vx,vy)`** = `(|vx|+|vy|)·2` + clamp to max + gold glow. Unit-test.
8. **`Projectile` trigger path** — `mode`/`triggerEvents`; on trigger, splash-vs-single dispatch;
   explode anim/sound then die. Unit-test: a splash bullet on land hits a cluster; a plain bullet
   unchanged. Wire `towerAxe` (dwarfTower as a static ranged CpuAI — `walkSpeed:0`, splash bullet) and
   the `arcticBlast`/`freezeBlast` freeze payload.
9. **`energyMine`/`energyMines` deposit** (optional, reachable): `depositMines` scatter +
   proximity-triggered mine explode. Defer if time-boxed (note reachability: 5/14 maps).
   **Defer `modFireBullets` streaming** for `energyPulseSpell`/`energyBeamSpell` (§g) — the `energyPulse`
   *bullet* splash is done (8), but the streaming-release loop is large; energyPulseSpell stays
   `SKIP_SPAWN` until then.

**C3 (summons, thin over B1 spawn + B2 charge):**
10. **`selectTier` + `summonUnit`** on the magic-cast release path; `armySummon` → `spawnAlly`,
    `monsterSummon` → `spawnEnemy` (fresh, default level, always permitted). Replace the `E`-key
    ad-hoc summon. Unit-test tier selection (charge 9→none, 10→warrior, 32→kingInGame for armySummon).
11. **`randomSummon` wobble** in `charge.ts.chargeMax`. Unit-test it stays within `[0, chargeMax]` and
    is deterministic under a seeded RNG.
12. Update audit `03` rows (cBlast/darkBlast → FAITHFUL; splash/explode/takeFreeze/takeHeal/summon →
    FAITHFUL or PARTIAL) + `README.md` status log.

Steps 1, 2–7 are pure/unit-only (no fight changes); 8–11 are the behaviour wiring, each independently
testable; the in-game smoke (step 12-adjacent) is **gated on F1**.

---

## (e) Test plan

**Unit (`vitest`) — stands alone, no F1 needed:**
- `resolveAttack`/`charge.ts`: `cBlast` ⇒ `chargeMax=999` for any capacity (Basic 999/Mod 0),
  `chargeSpeed=.1·flow`; `darkBlast` ⇒ `chargeStart=5+burst`, `cooldown=15`, `power=3`; `arcticBlast`
  ⇒ `payloadFunction=[takeFreeze,takeHit]`, `freezeMultiplier` present, `limitMagic` honored.
- Geometry: `CollisionCalcVect` returns `(0,0)` when `dist>=power`; for `dist<power` the L1 magnitude
  decreases with distance (centre > rim). Radial `GeomMoveVector` points self→target with the given
  speed.
- `SplashDamage`: `#explode` radius = `explodeCharge/2`; hits all in disc, not outside; vector falloff.
  `#splashDamageOn` radius = `power`. `towerAxe` (power 50) hits within 50, misses at 60.
- Payload dispatch: `[#takeFreeze,#takeHit]` runs **both** on one victim; `#takeHeal` only heals;
  scalar vs list both work; `#armyTeleportOut` no-op.
- `Freeze`: `takeFreeze((|vx|+|vy|)=10, freezeMultiplier=3)` ⇒ `+120` ticks; first hit latches frozen +
  halves speed; second hit accumulates; thaw restores speed (incl. a level-up during freeze).
- `Energy.takeHeal`: `(|vx|+|vy|)=10` ⇒ `+20` energy, clamped to max; gold glow set.
- `selectTier`: armySummon charge 9→#none, 10→#warrior, 24→#monk, 32→#kingInGame; monsterSummon
  31→#summonGolem. `randomSummon` wobble bounded + seeded-deterministic.
- Summon spawn: releasing `armySummon` at charge 15 spawns one friendly `archer` at the cast loc via
  `spawnAlly`, owner gains +0.5 xp, the bolt still fires.
- No-regression: `energyBlast` (B2) charge/damage numbers unchanged; the single-target bullet path
  (non-splash) unchanged.

**Reachability / in-browser smoke — GATED ON F1:**
- Once F1 loads all 47 maps, load a map that places each spell and verify it casts:
  `cBlast`/`arcticBlast` (mr4Demo, TeamOverrideTest), `healBlast` (TeamOverrideTest, citadel),
  `armySummon` (22 maps incl. AutoSummonTest), `monsterSummon` (monster_summon, TeamOverrideTest),
  `dwarfTower` (teambattles, samii) auto-fires `towerAxe` splash, `energyMines` (teambattles) deposits.
- `AutoSummonTest.txt` / `TeamOverrideTest.txt` are purpose-built test maps that place arcticBlast +
  energyBeamSpell + summons + healBlast together — the natural C in-browser smoke targets.
- Smoke assertions: arcticBlast freezes a cluster (teal + halved speed); healBlast heals a damaged
  ally; armySummon at high charge spawns the right tier; dwarfTower hits a group with one axe; no
  pageerrors; room still resolves.

**Before F1:** a headless harness can spawn the relevant archetypes directly (bypassing the map) and
drive a cast to exercise the splash/freeze/heal/summon paths — the unit tests above already do this at
the component level, so F1 only gates the *map-placed* verification, not correctness.

---

## (f) Faithfulness risks

1. **Splash falloff at px scale (highest C2 risk).** The radial vector
   `(radius + targetRadius − dist)·power` and `CollisionCalcVect`'s `outputPower = power − dist` are
   **engine-unit** formulas; A1 already px-tunes knockback (`KNOCK_SCALE`) and the slice tunes damage.
   A `towerAxe` `power 50` / `damageMultiplier 10` or `thunderBlast explodeCharge 100` could be wildly
   over/under-lethal at the port's scale (a centre hit's `(|vx|+|vy|)·10` can dwarf room-1 energies).
   **Mitigation:** route splash damage through the **same `mult`/scale calibration B2 used for the
   single-target path** (so a splash hit's per-victim damage uses the identical `(|vx|+|vy|)·mult`
   formula `Energy.takeHit` already scales), and add a "splash hit on a centred vs rim victim" unit
   test pinning the falloff *shape* even if the absolute scale is tuned. Do **not** invent a separate
   splash damage formula — falloff must be the radial-vector L1, same as melee/bullet.
2. **Freeze/heal coupling to the A1 vector model.** `takeFreeze`/`takeHeal` *read the same collision
   vector* as damage — so they only work if C2 builds that vector correctly per attack type (explode →
   `calcCollisionVectSpell`; splash → `CollisionCalcVect`). If a status payload is wired to a *scalar*
   (the old `takeFreeze(ticks)`), freeze time/heal amount lose the radial falloff and the
   distance-from-blast nuance. **Mitigation:** the payload dispatch passes the *vector* the splash
   resolver computed, never a pre-baked scalar; the `Freeze` signature change to `(vx,vy)` is
   load-bearing and must land before any freeze spell is wired. Also: `accumulate` (not `max`) the
   freeze counter — the original *subtracts from a counting-up counter*, so repeated hits extend it
   (the current `Math.max` is wrong for multi-hit).
3. **Payload-list ordering.** `[#takeFreeze, #takeHit]` runs freeze **then** damage on the same vector;
   if order flips, a victim that dies to `takeHit` might never register the freeze (minor) — keep list
   order faithful. The dispatch must also run **every** function (not stop at the first), or arctic/
   freeze hits stop freezing.
4. **Summon team/level/persistence.** A C3 summon spawns a **fresh default-level** unit (armyDetails
   `#none`). The original, *with* G2, would restore a *reserved* unit at its saved experience level
   (a level-5 warrior you summoned earlier). So C3's summons are faithful to a *no-reserve* world but
   will under-power vs a save with a built-up reserve army — **acceptable and explicit** (G2 owns the
   delta). Also: enemy summons (`monsterSummon`) join `#monsterSummon`/`#enemies` teams with their own
   allegiance (`tem_monsterSummon`: friends `[aldevar,village]`, hates the rest) — verify the spawned
   unit's `tem_*` allegiance is the summon's `residentTeamCategory`, not the caster's team, or a
   summoned monster could fight the wrong side.
5. **`randomSummon` non-determinism in tests.** The wobble uses `random()` — must inject a seeded RNG
   (the port already needs one for reproducible tests) so the tier outcome is assertable.
6. **`explodeCharge` vs live charge confusion.** For `#explode` bullets the radius is the **fixed**
   `explodeCharge/2`, *not* the caster's live charge — a common porting slip would be to use the
   spell's charge. Cite `modExploder.getCurrentCharge` override; unit-test that `energyPulse`'s radius
   is always `5` regardless of how hard the caster charged.
7. **Tower as static CpuAI.** `dwarfTower` (`walkSpeed:0`, `reelProof:true`, `inertia:95`) must not be
   knocked around or try to path — verify the CpuAI ranged path tolerates a zero-walk-speed turret
   (it should, post-B2) and that its `towerAxe` is a splash bullet, not a single-target one.

---

## (g) Out of scope (explicit seams)

- **GMG toggle** (`modGoldenMachineGun`/`gmgMaster`/`modAttack.gmgOn/Off`) — `#gmg` is a collected
  toggle, placed in only 3 maps (mr4Demo, TeamOverrideTest). The `gmg*` fields parse into `AttackData`
  (B2) but the on/off swap + auto-fire + HUD are deferred (audit 03 §3, B2 §g). Several C spells carry
  `gmgAutoFire` data (cBlast/arctic/healBlast/energyMines) — parsed, not activated.
- **Magic limiter master** (`magicLimitMaster.getMagicLimit`) — `charge.ts` multiplies by it but it
  defaults to 100 (no-op); `#magicLimit25` is placed in 7 maps but the limiter master + `objMagicLimit`
  are unbuilt. `limitMagic:true` on cBlast(no)/arctic/energyPulseSpell/energyMines/monsterSummon is
  honored structurally (×100/100=×1) until the master lands.
- **Reservations / army-reserve persistence (`reservationsMaster`, `armyMaster` reserve, spell icons,
  `armyTeleportIn/Out`, `restoreArmyDetails`, `displayNextSummons`) = G2.** C3 summons fresh
  default-level units, always permitted, no icons, no headcount gating. `#armyTeleportOut`
  payloadFunction is a no-op in C. `armySummonStones` (the acquisition chatter that grants the
  armySummon scroll on touch, 2 maps) is a trigger, not a spell — defer to a pickup/trigger pass.
- **`modFireBullets` streaming release** (`energyPulseSpell` `releaseFunction:#fireBullets`,
  `energyBeamSpell` beam) — the streaming-release loop (fire a `energyPulse` every `fireDelay:5` until
  charge spent) is large. **energyPulseSpell IS placed in 19 maps** (highest-reachability unbuilt
  spell) and IS placed-but-`SKIP_SPAWN`'d in the room-1 map — so this is the one streaming item worth
  pulling forward *after* C2's splash bullet exists, but it is **not** required for C2's `energyPulse`
  *bullet* splash to be faithful. `energyBeamSpell`/`laserBeam` (beam, 0–4 maps) deferred entirely.
- **Spell-actor live-growth lifecycle** (`objSpell`/`objAiAttack.ensureSpell`/`chargeSpell` as a live
  growing actor that converts to bullets, `calcChargeLoc`, eyestrain, attack-frame gating) — the port
  keeps the B2 instant `fireBullet`-on-release. C does not add the live spell actor.
- **Boss-specific spells = E.** `freezeSticks`/`thunderSticks` (the enemy weapons that fire
  `freezeBlast`/`thunderBlast`) are carried by enemy/boss actors, not placed as scrolls — their
  *bullets* are made faithful by C2's splash/freeze engine, but *placing* the wielders is D/E content.
- **Cosmetic decals** — `splashGraveOn` cracks (`drawGrave`), chargeColour glows, chargeVolumeMap audio
  ducking — render/audio fidelity (F3); C wires the mechanic, not the decal.

---

## Reachability findings (ground truth — `maps/**` object layers via `tlk_*Objects_key.txt`)

Computed by resolving each map's `#objects` layer grid indices through its objects-tileset key
(`merlin4`/`merlin`/`merlinOpen` Objects keys), 1-based, comments excluded — mirroring the port's `tlk`
parser. **None is reachable in the room-1 slice; all need F1 to load their maps.**

| Spell / actor | placed in maps | notable maps |
|---|---|---|
| `armySummon` (C3) | **22** | AutoSummonTest, teambattles, mri, many campaign maps |
| `energyPulseSpell` | **19** (deferred §g) | descent_into_darkness(!skip), teamtest, orcs_vs_humans, … |
| `dwarfTower` (C2) | **14** | teambattles, samii, merlinart*, very_big_map |
| `energyMines` (C2) | **14** | teambattles, mr4Demo, mri, … |
| `cBlast` (C1) | **11** | mri, Scarlet_Castle, winterland_test, … |
| `merlinSword` (B2 ref) | 12 | descent_into_darkness, mr4Demo, … |
| `maxikit` (ref) | 9 | descent_into_darkness, mr4Demo, … |
| `garTower` (C2/E) | 8 | goblin_defence, monster_summon, citadel |
| `energyMine` (C2) | 5 | teambattles, dungeon, roads_to_aldevar |
| `monsterSummon` (C3) | **5** | monster_summon, TeamOverrideTest, mr4Demo |
| `arcticBlast` (C2) | 4 | mr4Demo, AutoSummonTest, TeamOverrideTest |
| `energyBeamSpell` (deferred) | 4 | AutoSummonTest, TeamOverrideTest, mr4Demo |
| `magicLimit25` (OUT §g) | 7 | magicLimit, testScarletKing, very_big_map |
| `armySummonStones` (G2) | 2 | roads_to_aldevar, mriiilongii |
| `gmg` (OUT §g) | 3 | mr4Demo, TeamOverrideTest |
| `healBlast` (C2) | **2** | TeamOverrideTest, citadel_map_note |

**Dead content across ALL 47 maps (placed in 0 maps — flagged):**
- **`darkBlast`** (C1) — not in any objects key; build for completeness, **cannot be in-game tested**.
- **`cBlastAi`** (C1) — AI-caster scroll, not in any objects key (it's `cBlastAi`, granted to AI casters
  in code, not placed). Effectively dead as a *placed* spell.
- **`skelitonSummon`, `undeadSummon`, `goblinSummon`, `scSummon`** (C3) — none placed; the
  `randomSummon` wobble they exercise is build-for-completeness, untestable in-game.
- **`thunderBlast`, `freezeBlast`, `energyPulse`, `towerAxe`, `energyBeam`** — these are **bullets, not
  placeable objects**, so "0 maps" is expected; they're reached via the spells/towers/enemy-weapons
  that fire them (`towerAxe`←dwarfTower [14], `energyPulse`←energyPulseSpell [19],
  `freezeBlast`/`thunderBlast`←freezeSticks/thunderSticks enemy weapons [D/E placement]).
- **`blackAxe`, `summonBoulder`, `laserBeam`** — 0 placed-object maps (enemy weapons / units, not spell
  scrolls).

So C's **reachable, testable-after-F1** spell content is, in priority order: **`armySummon`** (22),
**`cBlast`** (11), **`dwarfTower`/towerAxe + energyMines/energyMine** (14/14/5), **`monsterSummon`**
(5), **`arcticBlast`** (4), **`healBlast`** (2). `darkBlast`/`cBlastAi` and the four random-summons are
faithful-but-dead.
