# Plan K2–K8 — the AI-completeness cluster

Backlog items **K2–K8** of [`K-deferred-backlog.md`](K-deferred-backlog.md) Tier 1 — the AI/combat
deferrals from B1 §g and B2 §g. The owner's directive: implement **everything** previously deferred. This
plan designs each item against the existing engine (`CpuAI`/`PlayerControl` in
[`control.ts`](../../../src/components/control.ts), `WeaponManager`
[`weapon.ts`](../../../src/components/weapon.ts), `TeamMaster` [`teams.ts`](../../../src/systems/teams.ts),
the per-tick [`combatTick.ts`](../../../src/systems/combatTick.ts)), grounds each in the real Lingo, and —
the owner having already corrected one wrong "unreachable" call — backs every reachability claim with
**decoded map-placement evidence** (the `#objects` tile layer across all 47 bundled maps, decoded with the
same `parseMap`/`parseTileKey`/`tileSymbol` path the shipped tools use).

> **Scope split.** K1 (faithful damage coupling; [`K1-faithful-damage.md`](K1-faithful-damage.md)) is the
> *keystone* and lands first — it owns the inertia-damps-damage change and the `power·str·mult` enemy
> rescale, and it **explicitly defers the spell's faithful radial magic vector to K2** (K1 §g: "the radial
> falloff only matters for the live-growing spell"). So **K2 is the K1 seam**: the live `objSpell` actor is
> where `calcCollisionVectSpell`'s `(charge/2 + targetRadius − dist)·power` finally couples. Everything in
> K2–K8 composes with K1's `takeHit(vx,vy,attacker,mult)` vector and the two new scales
> (`ENEMY_DAMAGE_SCALE`, `BULLET_DAMAGE_SCALE`).

---

## Reachability summary (evidence first — the owner's rule)

Decoded every `#objects` layer across all 47 maps in `port/public/assets/maps/`. `#AiType:` grep over
`casts/data/act_*.txt` gives the actor→AI mapping (the field is `#AiType`, **not** `#ai`).

| Item | Actors / trigger | Placement evidence | Verdict |
|---|---|---|---|
| **K2 spell-actor** | every `#magic`/`#magicMelee` caster (player + 20 `#objAiCPUSpellCaster` actors) | player reaches energyBlast/beams/pulse; casters `necromancer`(358)/`goblinMage`(232)/`darkMage`(221)/`greyGhost`(207)/`mageOrc`(106)/`monk`(113) etc. placed across nearly every map | **REACHABLE, substantive** |
| **K3 pathfinding** | every `#objAiCPU`/`SpellCaster`/`Builder` that moves to a target | universal | **REACHABLE, substantive** |
| **K4 bullet-dodge** | `#objAiCPUSpellCaster` (kiting casters) | 19 of 20 caster actors placed (only `friendlyGoblinMage` unplaced — runtime-summoned) | **REACHABLE, substantive** |
| **K5 ghost possession** | `#objAiCPUGhost` = `monkGhost`; target `getActorType()==#monk` on team `#aldevar` | `monkGhost`: `teambattles`(6), `not_fully_tested_roads_to_aldevar`(4), `samii`(3). `#monk`: 26 maps (113 total) | **REACHABLE** (possession *fires* only where both co-occur: teambattles + not_fully_tested; `samii` has ghosts but **0 monks** → drift-only there) |
| **K6 setMultiAttack** | `#multiAttack:true` 2-weapon CPUs = `ninja`, `shrouder` | `ninja`: 15 maps (330 placements incl `works_mr4Demo`=72, `new_mr4Demo`=75); `shrouder`: 6 maps (53) | **REACHABLE, substantive** |
| **K7 weaponTechnique** | actors with nonzero `#weaponTechnique` (15 actors: ninja/shrouder=20, kongFuChicken=200, bowOrc/archer negatives…) | ninja/shrouder placements above; bowOrc/goblinArcher widely placed | **REACHABLE** (small module) |
| **K8a builder AI** | `#objAiCPUBuilder` = `dwarf`, `goblinBuilder` | `dwarf`: 18 maps (58 incl `works_mr4Demo`=5); `goblinBuilder`: 4 maps (8) | **REACHABLE** — K-backlog's "MISSING" label was a *port* gap, not unreachable |
| **K8b "hairSeek"** | real file `objAiEnemyTargetSeek` (`#playerHair`/`#attach`) | **0 actor records** carry `#AiType:#objAiEnemyTargetSeek`; `#playerHair` appears nowhere in data; its base `objAiEnemy` is **absent from source** (cannot run) | **UNREACHABLE / dead engine code** (justified below) |
| **K8c weaponSeek** | real file `objAICPUWeaponSeek` (seeks dropped weapons) | **0 actor records** carry `#AiType:#objAiCPUWeaponSeek`; symbol referenced only inside its own file | **UNREACHABLE / dead engine code** (justified below) |

**Net:** K2, K3, K4, K6, K7, K8a are reachable + substantive; K5 is reachable (conditionally fires); K8b/K8c
are evidence-backed unreachable orphans. (Filename note: the K-backlog's `objAiHairSeek`/`objAiBuilder`/
`objAiWeaponSeek` are mislabels — the real files are `objAiEnemyTargetSeek`, `objAICPUBuilder`,
`objAICPUWeaponSeek`.)

---

## K2 — Spell-actor live-growth lifecycle

### (a) Original mechanics (cited)

The charged spell is a **live `objSpell` actor** (`casts/script_objects/objSpell.txt`), not a number on the
caster. Lifecycle, driven by `objAiAttack` (`casts/script_objects/objAiAttack.txt`):

- **`attack`** (37–54): gated on `getCooldownFin()`; dispatch by `getAttack().type` → `attackMagic` →
  `chargeMagic` (61–63).
- **`chargeMagic`** (126–130): `ensureMode(#charge)` on the character, then `ensureSpell()` then `chargeSpell()`.
- **`ensureSpell`** (157–188): if no current spell, spawn a `#spell` actor at `calcChargeLoc()` via
  `actorMaster.newActor`, push `setSpellProperties{attack, chargeOffsetSide, team}` (and `gmgOn`→`fireDelay=0`),
  then seed the **charge counter** from the mana-scaled charge math: `pChargeCounter.tim[1] =
  calcAttackChargeStart()`, `tim[2] = calcAttackChargeMax()`, `inc = calcAttackChargeSpeed()` and
  `CounterReset` it. `setChargingSpell(currentSpell)`.
- **`chargeSpell`** (132–142): each tick, `currentSpell.charge(pChargeCounter.theCount,
  calcChargeLoc())` then `CounterOnce(pChargeCounter)`; when the counter `fin` → `internalEvent(#spellCharged)`
  (the GMG auto-fire / "fully charged" hook).
- The spell grows: `objSpell.charge` (114–121) sets `pCurrentCharge`, `align(chargeLoc)` (positions it over
  the head), and fires `internalEvent(#charge)` (multistage permission check). **Size** = `pCurrentCharge *
  chargeSize` (`calcSize`, 110–112) applied to sprite width/height (`updateSize`, 303–308). **Position**:
  `align` (75–80) adds `calcChargeOffset` — `#top` ⇒ `point(0, −size/2)` (over the head), `#side` ⇒
  `point(±size/2, 0)` by facing (90–108). `calcChargeLoc` (`objCharacter.txt` 113–123) = caster loc +
  `pChargeLoc·facing` (GMG uses `pGmgChargeLoc`, 246).
- **`#updateReel`** (objAiAttack 248–253): while reeling, the charging spell follows
  (`chargingSpell.align(calcChargeLoc())`).
- **`releaseMagic(targetLoc)`** (337–350): `ensureMode(#release)`, `releaseSpell` (352–359):
  `currentSpell.release(targetLoc, spellSpeed)` then `setCurrentSpell(#none)` + `resetCooldown`.
- **`objSpell.release`** (228–233): stores target/speed, fires `internalEvent(#spellReleased)`. Two release
  functions:
  - **`#release`** (normal, `objSpell.internalEvent` 207–211 → `releaseNormal` 235–248): `moveToTarget`
    toward the target at `speed` (it FLIES). On arrival `moveXYfin` (214–217) → `goMode(#explode)`
    (145–161): `pCurrentCharge *= chargeExplodeFactor`, `teamMaster.impactAttack(me)` (the radial
    `calcCollisionVectSpell` area hit at the landing loc), play explode sound, fade out. **So the bolt's
    damage is the radial vector off the *grown* charge — this is the K1-deferred spell coupling.**
  - **`#fireBullets`** (modFireBullets 58–71 → `goMode(#fireBullets)`): the spell stays put and
    `updateFireBullets` (96–107) emits one bullet every `fireDelay` frames, draining `chargePerUnit`
    (`fireBullet` 30–51); `charge<0` → `setDead`. `beam` bullets use `performBeamAttack`. (energyPulse,
    energyBeam.)
- **multistage** (`modSpellMultistage.txt`): `#charge` event → `chargeMultistage` → `selectPayload`
  (316–341, the highest tier whose `chargeRequired ≤ charge`), `obtainPermissionOrHalt` (reservation gate for
  `#summonUnit`, reins the charge in if denied — `chargeReinIn` 84–90), `displayIcon`. `#explode` →
  `doExplodeFunction` (161–169): `#summonUnit`→`summonPayload` (army createUnit), `#depositMines`→`depositMines`
  (124–149, scatter N=`charge/chargePerUnit` mines).
- **`isOnAttackFrame` gating** (objAiAttack `updateAttack` 389–414): a melee/ranged strike `performAttack`
  resolves **only on the designated attack anim frame** (`isOnAttackFrame()`); `attackFin` fires when the anim
  loops (`getAnimLooped`). (Magic resolves on `#release`, not a per-frame attack-frame.)
- **eyestrain** (`modifyLocWithEyestrain` 268–288): aim error scaled by distance/reach — at max range,
  inaccuracy = 100% of the caster's `getEyestrain()`; jitter `VarRoughly(0, eyestrain)` on each axis.

### (b) Port gap

`PlayerControl.castMagic` and `CpuAI.attack` do **instant** bullet emission on release — there is no live
actor that grows/positions over the head, the charge is a scalar on the controller, and the magic damage uses
the **calibrated** `SPELL_FX.dmgPerUnit·charge` (port adaptation), not the radial `calcCollisionVectSpell`.
I8 already models the `#fireBullets` stream as a `PlayerControl.stream` substate, and C3 summons via
`summonUnit` on release — but neither is a positional growing actor, and there is no `chargeSize` render, no
attack-frame gating for CPU melee/ranged, no eyestrain. CPUs charge instantly (no ramp — B1/B2 §g
"acceptable").

### (c) Design — a real `Spell` Entity, with a `ChargingSpell` controller substate

**Decision: model the charged spell as a real, short-lived `Entity` (a `Spell` archetype), referenced by the
caster's controller** — faithful to `objSpell` being a first-class actor. This subsumes the I8 `stream`
substate and the C3 release-summon into one lifecycle, and is the seam where the K1-deferred radial spell
vector lands. Rationale for an Entity (not a `PlayerControl` substate): the original spell *is* an actor (it
renders, grows, positions, can outlive its caster — `objSpell.gainExperience`/`recordKill` exist precisely
because "Berlin teleports out and his last spell kills something", objSpell 134–138), and the port already
has the entity/component machinery + a `Sprite` with `scaleX/scaleY/rotation` (added in I8) to draw a growing
disc. A pure controller-substate could not render a positional growing sprite faithfully.

**New `port/src/entities/spell.ts` — `Spell` archetype + `SpellActor` component (`objSpell`).**
Components: `Identity`, `Movement` (for the release fly), `Anim`/`Sprite` (the growing disc), `Team`,
`SpellActor`. State (mirrors `objSpell`): `attack: AttackData`, `charge` (`pCurrentCharge`), `team`,
`chargeOffsetSide` (`#top`/`#side`), `mode: "charge"|"fly"|"explode"|"fireBullets"`, `ownerId`,
`releaseTargetX/Y`, `releaseSpeed`, plus the multistage `payloadNum`/`payload` and the fireBullets
`fireDelayCounter`. Methods:
- `charge(amount, locX, locY)` — set `charge`, `align` (loc + `calcChargeOffset` from `size/2`), set
  `Sprite.scaleX/scaleY = size / baseFrameSize` where `size = charge · attack.chargeSize` (so the disc grows
  visibly), run the multistage `#charge` hook (selectPayload + reservation reinIn). Faithful sizing.
- `release(targetX, targetY, speed)` — branch on `attack.releaseFunction`:
  - `"#release"` (default magic): set `Movement` velocity toward target at `speed` → `mode="fly"`. On arrival
    (within an arrival radius, mirroring `moveXYfin`) → `explode()`.
  - `"#fireBullets"` → `mode="fireBullets"`, run the existing I8 stream logic *inside this actor* (drain
    `chargePerUnit`/`fireDelay`, `fireSplashBullet`/`performBeamAttack`).
- `explode()` — `charge *= chargeExplodeFactor`; resolve the **radial spell vector** through the existing
  `resolveSplash`/`impactAreaAttack` path (K1 seam, below); play explode sound; fade+finish. For
  `#summonUnit`/`#depositMines` explode functions, call `summonUnit`/deposit at the landing loc (C3 already
  has `summonUnit`).

**The K1 spell-coupling (the load-bearing reconciliation with K1 §g).** Today the bolt damage is the
calibrated `SPELL_FX.dmgPerUnit·charge`. K2 replaces it with `calcCollisionVectSpell`: at explode, for each
hostile in the disc, `vect = (charge/2 + targetRadius − dist) · power` aimed spell→victim, fed through
`takeHit(vx,vy,owner,mult)` — the **same A1 vector scale K1 calibrated**. `resolveSplash` already does the
radial `(hitRange − dist)·power` shape for `#explode` bullets (C2); the spell explode is the same disc with
`hitRange = charge/2 + targetRadius`. So K2 **reuses C2's `resolveSplash`** with the grown charge as the
radius — no new damage formula, and it consumes the `BULLET_DAMAGE_SCALE`/spell-scale K1 sets. **Calibration
gate:** the radial centre-lethality must keep the "energyBlast base charge fells a rank-and-file 300-energy
enemy" invariant (K1 §c carried the spell on the scalar precisely so this could be re-pinned here). A scale
factor on the radial vector (analogous to `MELEE_SCALE`) is fit so base-charge centre damage ≈ today's
`dmgPerUnit·12.5 ≈ 325`, asserted by the existing "spell fells a 300-energy enemy" unit test.

**Driver changes.** `PlayerControl`: while charging, instead of accumulating a scalar, `ensureSpell` (spawn
the `Spell` entity at `calcChargeLoc`) and `chargeSpell` (call `spell.charge(counter, chargeLoc)` each tick,
advancing the charge counter — reusing `charge.ts` for `chargeStart/Max/Speed`). On release/cooldown-cut →
`spell.release(aimX, aimY, spellSpeed)` and drop the reference. The `chargeFrac` HUD reads
`spell.charge / chargeMax`. The I8 `stream` substate is **retired** into the spell actor's `fireBullets`
mode (same observable cadence). `CpuAI`: a magic caster's `attack` calls the same `ensureSpell`/`chargeSpell`
ramp (so casters now **charge over frames** rather than instant-fire — closing the B1/B2 §g "no charge-ramp"
deviation), releasing when the counter fins (or at a target-in-reach decision). `eyestrain` is applied to the
CPU's release `targetLoc` via `modifyLocWithEyestrain` (caster actors carry an `#eyestrain`; default 0 = no
jitter, so non-eyestrain casters are unaffected).

**attack-frame gating (`isOnAttackFrame`).** Add an `attackFrame` to melee/ranged anim resolution: the strike
(`impactMeleeAttack`/`fireBullet`) resolves on the designated frame of the attack strip (recorded per-anim,
default = frame 1 so existing behaviour is unchanged where no attack-frame is data-driven), and `attackFin`
re-acquires when the anim loops (the FSM already has `attackFin`). This makes melee/ranged timing match the
animation (a wind-up before the hit) instead of firing on cooldown-edge. **Risk-gated:** default attack-frame
= first frame keeps room-1 timing identical unless the data specifies otherwise.

### (d) Composition / order

K2 rides on K1 (the radial vector needs K1's scale) and **subsumes I8's stream + C3's release-summon** into
the actor. It is the largest K-item. Land it after K1 and after K3/K4 (which don't depend on it) so the spell
actor's *positioning* can reuse K3's `moveToLoc` for the fly.

---

## K3 — `modPathFinding` beeline→scenic (NOT A*)

### (a) Original mechanics (cited) — `casts/script_objects/modPathFinding.txt`

Confirmed **not A***. State: `pPathFindingMode` (`#beeline`/`#scenic`), `pPathFindingLoc` (one scenic
waypoint), `pPathFindingDistance=100`, `pStallCounter` (fires after 5 zero-movement frames), `pTargetLoc`.
`findPathToLoc(targetLoc)` (50–63) dispatches: in `#beeline`, `moveToLoc(pTargetLoc)` (aim straight at goal);
if `updateStallCount` reports stalled → `goPathFindingMode(#scenic)`. In `#scenic`, `moveToLoc(pPathFindingLoc)`
(the waypoint); on the next stall → back to `#beeline`. `goPathFindingMode(#scenic)` (65–73) picks the
waypoint **once**: `pPathFindingLoc = PointRoughly(currentLoc, 100)` — a **uniformly random point within ±100
px per axis of the unit's current loc** (NOT relative to the obstacle or target; there is no waypoint list).
`updateStallCount` (127–144): stall = on-screen movement exactly `point(0,0)` (sprite didn't move) for **5
consecutive frames** (`Counter`, `tim[2]=5`); any movement resets. Movement itself: `moveToLoc`
(`modMoveToLoc.txt`) steps toward the loc at `pWalkSpeed`, arrival within **5 px** (`GeomDistSqr`). `objMoveXY`
integrates momentum + friction `point(12.5,0)` (as a %-of-speed interp) + gravity·weight; `pMoveVect` is the
actual rendered delta the stall logic reads.

Net behaviour: walk straight at the goal; if blocked (no movement) for 5 frames, pick a **random nearby
point** and head there; when blocked again, flip back to straight. A random-walk-around-obstacles, not a
planned path.

### (b) Port gap

`CpuAI.seek` (control.ts 467–475) is a perpendicular-detour heuristic: when `m.hitX||m.hitY` it commits to a
sidestep perpendicular to the desired heading for 18 frames, else beelines. It's a reasonable stand-in but
*differs* — it sidesteps perpendicular (deterministic) rather than picking a random ±100px waypoint, and its
stall signal is the collision flag, not 5 frames of zero `moveVect`.

### (c) Design — replace `seek` with a faithful `PathFinding` helper

Add `port/src/components/pathFinding.ts` (or a small block on `CpuAI`) mirroring `modPathFinding`:
- State: `mode: "beeline"|"scenic"`, `waypointX/Y`, `stallCtr`, `targetX/Y`, `pathDist=100`.
- `findPathToLoc(tx, ty)`: set target; if `beeline` → set `Movement` intent toward `(tx,ty)`; if `updateStall`
  → `goScenic` (pick `waypoint = (x ± rng·100, y ± rng·100)` via the port `rng`, faithful to `PointRoughly`).
  If `scenic` → intent toward the waypoint; on stall → back to `beeline`.
- `updateStall`: track the **actual movement delta** this tick (the port's `Movement` already exposes the
  applied displacement / `hitX/hitY`; compare last-vs-current position → if `|Δ| ≈ 0` for 5 consecutive ticks
  → stalled). This replaces the collision-flag trigger with the faithful zero-movement counter.
- Arrival: stop within 5 px of the target (mirrors `moveToLoc` arrival).

`CpuAI.updateMoveToAttack` calls `findPathToLoc(calcIdealAttackLoc(targetX,targetY))` (the ideal-attack-loc is
already computed). The existing detour-window fields (`detourT`) are removed in favour of the
beeline/scenic mode. **No-regression:** in room 1 (open terrain) the unit never stalls, so it stays in
`beeline` = a straight chase, behaviourally identical to today's no-collision path.

### (d) Composition / order

Independent of K1/K2. Land early (it's small and de-risks K4, whose kiting also issues `moveToLoc`). K2's
spell-fly reuses the same `moveToLoc`-toward-target step.

---

## K4 — Bullet-dodge kiting (`objAiCPUSpellCaster.updateMoveToOptimumPosition`)

### (a) Original mechanics (cited) — `objAiCPUSpellCaster.txt`

A spellcaster has `reach=9999` (always "in reach"), so `moveToAttack` no-ops and the sub-AI drives
positioning. `update` (261–273): when `getAttack().reach == 9999` (no spell loaded), run
`updateMoveToOptimumPosition` (275–297) — a **strict priority chain**:
1. `runTangentToObjects(findNearestEnemyBullets, pBulletSafeDistance=100)` — **dodge bullets** (tangent run).
2. else `runFromObjects(findNearestEnemies, pEnemySafeDistance=100)` — flee enemies.
3. else `runTowardsObject(target)` (158–169) — approach, with hysteresis (only re-approach if farther than
   `√(100²+20²)≈102` px, `pBufferDistance=20`).
4. else `stopMoving`.

`attackFin` (38–44) sets target `#none` → **retarget every shot**. `runTangentToObjects` (171–259): run
**perpendicular to the nearest incoming bullet** via `GeomTangentPoint(bulletLoc, myLoc, dir, safeDist)` (a
point ~2·safeDist to the side + a small safeDist/5 along-axis push), with the side `dir` chosen from the
geometry of the two nearest bullets, then **blended 25–75% (random per call) with the straight-flee
`GeomMirrorPoint`**. The bullet broad-phase: `teamMaster.findNearestEnemyBullets` (teamMaster 196) =
`findNearest(obj, #enemy, #teamBullets, 2, pBulletMap)` — the **`pBulletMap`** is a second `objDataMap`,
maintained exactly like `pUnitMap` but bullets register there (`modListNode.pType = #bullet`); each
bullet re-links its tile as it moves (`modListNode.update`); nearest search = expanding shells (min 0, max 3)
returning the nearest 2 as `{closestPos, closestList[{obj,dist}]}`.

### (b) Port gap

`CpuAI.updateRunReload` (control.ts 392–400) is the simple kite band — back away from the target until the
shot has cooled, then re-engage. There is **no bullet map** and no tangent dodge: the kiter ignores incoming
bullets entirely. The port has no `pBulletMap` (only `pUnitMap`).

### (c) Design — a `bulletMap` broad-phase + a tangent-run optimum-position mode

**Bullet broad-phase.** Add a second `UnitMap` instance `bulletMap` on `TeamMaster` (the `UnitMap` class is
generic — reuse it). `combatTick.rebuildCombatSubstrate` already clears+inserts combatants into `unitMap`; add
a parallel pass inserting every live `Projectile` entity into `bulletMap` keyed by world loc (and record each
bullet's owner team via `Projectile.getTeam`, already exposed). Add
`teamMaster.findNearestEnemyBullets(e, n=2)`: resolve `e`'s hostile teams (`calcTargetTeams(team, "#enemy")`),
search `bulletMap` in expanding shells (min 0, max 3, faithful), return the nearest `n` bullets whose owner
team is hostile to `e`. (A bullet's "team" is its owner's team; a `#aldevar` caster dodges `#orcs` bullets.)

**The optimum-position mode.** Add a `CpuAI` mode `"optimumPosition"` used by casters (the FSM already routes
spellcasters via `runReload`; casters with the dodge get this instead). `updateMoveToOptimumPosition` runs the
priority chain:
1. `nearest = findNearestEnemyBullets(self, 2)`; if a bullet is within `bulletSafeDistance=100`, compute the
   **tangent destination** (port `GeomTangentPoint`: unit vector me→bullet, perpendicular swap ×2·safe + the
   safeDist/5 along-axis nudge, side from the two-bullet geometry, blended 25–75% via `rng` with the
   straight-flee `GeomMirrorPoint`) and `findPathToLoc(dest)` (reusing K3) → done.
2. else if an enemy is within `enemySafeDistance=100` (reuse `findHostileWithin`/unitMap) → flee its midpoint.
3. else if farther than the buffer ring from the committed target → approach it.
4. else idle.

`attackFin` for these casters forces `target=null` (retarget every shot, faithful). This **layers on the
existing `runReload`**: `runReload` (cooldown kite) stays for non-dodging ranged enemies (archers); the
spellcaster dodge replaces it for `#objAiCPUSpellCaster` actors (gated by a `dodgesBullets` cfg flag set in
`spawnEnemy` when `aiType=="#objAiCPUSpellCaster"`).

### (d) Composition / order

Needs K3 (issues `findPathToLoc` to the dodge dest) and the new `bulletMap`. Independent of K1/K2. Land after
K3. The bulletMap rebuild is the only `combatTick` change.

---

## K5 — Ghost possession (`objAiCPUGhost`)

### (a) Original mechanics (cited) — `objAiCPUGhost.txt`

`monkGhost` (team `#ghosts`, `teamWhenAlive #aldevar`) "drifts aimlessly looking for a unit to possess". State:
`pPossessDistance=10`, `pTargetLoc`, `pTargetType=#monk` (hardcoded in `new`, 15). FSM `update` (99–111):
`#findTarget` → `updateFindTarget` → `goToLoc`; `#goToLoc` → `updateGoToLoc` → (on arrival) `attemptPossess`.
`updateFindTarget` (113–127): `teamMaster.findUnitOfType(#monk, myTeam)` (teamMaster 960–983 — first
`getActorType()==#monk` in the team's member/building lists, no distance sort); if none → drift to
`PointRandomInRect(mapRect)`; else set it as `#target` + record its loc. `updateGoToLoc` (129–137): done when
within `pPossessDistance` (10 px). `attemptPossess` (33–51): if a live `#target` within 10 px →
`pCharacterPrg.mergeExperience(target)` + `pCharacterPrg.goMode(#finish)` (the ghost dies/draws a grave). Else
restart `#findTarget`. `mergeExperience` (`modExperience.txt` 240–244): `target.gainExperience(pExperienceImWorth
+ pExperienceGained)` (the **full** sum — not halved like reincarnation's `transferExperience`) +
`target.glowPink()`.

### (b) Port gap

`CpuAI.wander` (control.ts 478–482) is a drift approximation biased toward the (committed) target — no monk
lookup, no possession, no XP merge, no finish. The README/B1 §g called ghost the `wander` stand-in.

### (c) Design — a real `GhostAI` (or a `CpuAI` ghost-possession path)

Cheapest: extend the existing `ghost` branch in `CpuAI` into a faithful possession FSM (the entity already
spawns with `ghost:true`). Add `teamMaster.findUnitOfType(typ, team)` (scan the team roster's members then
buildings for `getActorType()==typ`, first match — the roster already exists). Ghost FSM:
- `findTarget`: `findUnitOfType("#monk", teamWhenAlive)`. If found → commit + `goToLoc`; else set
  `targetLoc = random point in the map rect` (use the room bounds) → `goToLoc` (drift).
- `goToLoc`: `findPathToLoc(targetLoc)` (reuse K3 — faithful drift to a loc). On arrival (within 10 px) →
  `attemptPossess`.
- `attemptPossess`: if a live committed monk within 10 px → `monk.send("gainExperience", ghost.xpWorth +
  ghost.xpGained)` + `monk.send("glowPink")` (ColourTransform already has a pink-capable glow; add the
  `rgb(255,200,200)` target if absent) + `ghost.send("goMode","#finish")` (the port's death-finalize →
  grave). Else restart `findTarget`.

`teamWhenAlive` (`#aldevar`) must be passed through `spawnEnemy` (the ghost's possess-team). `glowPink` and
`gainExperience` already exist on the port (Experience component + ColourTransform). **Replaces `wander`
entirely.** Where no `#monk` is rostered (e.g. `samii`), `findUnitOfType` returns null → the ghost drifts to
random map points forever — **faithful** (the original does exactly this; verified `samii` places 3 monkGhosts
and 0 monks).

### (d) Composition / order

Needs K3 (the drift `findPathToLoc`). Independent of K1/K2/K4. Small. Land with/after K3.

---

## K6 — `setMultiAttack` (range-based 2-weapon auto-switch)

### (a) Original mechanics (cited) — `modWeaponManager.txt` 343–389

For a CPU with `#multiAttack:true` and `≥2` weapons (natural ranged weapon 1 + melee weapon 2),
`setMultiAttack(multiAttack, bufferDist)` picks the current weapon by range to the committed target (all
**squared** distances):
- No target → weapon 1 (the ranged one), exit.
- `distToTarget = GeomDistSqr(targetLoc, myLoc)`; if weapon 2 is itself ranged, `bufferDist = weapon2.reach`.
- `attackDist = distToTarget − bufferDist²`. If `> 0` (target **beyond** buffer) → **weapon 1 (ranged)**.
- Else (within buffer): switch on the **target's** attack type. `#melee` and `distToTarget > 20` (sq) and our
  weapon 2 is melee → keep **weapon 1 (ranged)** (poke from range rather than trade blows); otherwise →
  **weapon 2 (melee)**. Non-melee target inside buffer → weapon 2.

`setCurrentWeapon` (305–317) cancels any in-flight non-magic swing and pushes the new attack. The two
`#multiAttack:true` actors are `ninja` (`#weapon:#ninjaSword` + natural `#shuriken`) and `shrouder`
(`#weapon:#pinShooter` + natural `#throwSmoke`).

### (b) Port gap

`WeaponManager` carries a single current weapon for CPUs; `spawnEnemy` builds only **one** enemy attack (the
spellcaster `#weapon` fix in I9 chose weapon-over-melee, it didn't keep both). `setMultiAttack` doesn't exist.

### (c) Design — give 2-weapon CPUs both weapons + a `setMultiAttack` on `WeaponManager`

In `spawnEnemy`, when the actor has `#multiAttack:true`, `addWeapon` **both** the natural `#attack` (weapon 1,
ranged) and the `#weapon`'s `#attack` (weapon 2, melee) into the enemy's `WeaponManager` (today it picks one).
Add `WeaponManager.setMultiAttack(targetLoc, myLoc, bufferDist)` faithful to the Lingo (squared compares, the
ranged-weapon-2 override, the melee-target/`>20`-sq nuance), selecting `current` between the two ordered
weapons. `CpuAI` for a `multiAttack` enemy calls `setMultiAttack(target.pos, self.pos, bufferDist)` each
`moveToAttack` tick before deciding to attack, so `getCurrentAttack()` (and thus `reach`/`type`/`bullet`) is
the range-appropriate weapon. The FSM is otherwise unchanged — `attack` already dispatches by
`getCurrentAttack().type`. **`bufferDist`** comes from the actor's `#bufferDist` param (default 100).

### (d) Composition / order

Needs the 2-weapon spawn (small `spawnEnemy` change) + `setMultiAttack`. Independent of K1/K2; benefits from
K3 (the unit closes distance with the melee weapon). Reachable in `works_mr4Demo` (ninja×72). Land after K3.

---

## K7 — `modWeaponTechnique` (attack-anim speedup accumulator)

### (a) Original mechanics (cited) — `modWeaponTechnique.txt`

While the AI is in `#attack` mode, each gated cycle adds the character's `pWeaponTechnique` to a running
`pWeaponTechniqueCache`; every full ±`pFrameValue=100` of cache is **spent**: positive → `frameAdvance`
(skip an attack-anim frame → faster), negative → `frameExtendDelay` (hold a frame → slower). The remainder
persists (no per-attack reset; only `init` zeroes it), so a high-technique unit's attack anim keeps speeding
up the longer it attacks. `#levelUp` (fired by `modExperience.levelUp`) raises `pWeaponTechnique` by
`pWeaponTechniqueInc=2`. Data: `ninja`/`shrouder`=20 (fast), `kongFuChicken`=200 (very fast),
`bowOrc`/`archer`=negative (slow). 15 actors carry nonzero values; default 0 (no effect).

### (b) Port gap

The port's anim runs at a fixed per-frame `dela`×`gGameSpeed` (F3). There is no technique accumulator —
repeated attacks don't speed up.

### (c) Design — a small `WeaponTechnique` component

Add `port/src/components/weaponTechnique.ts`: state `technique` (from `#weaponTechnique`), `cache`,
`frameValue=100`, a gate counter, `inc=2`. On the controller's attack frames (hook into the attack-anim
playback — `Anim`/the controller's `meleeT`/attack window), accumulate `cache += technique`; while
`cache > 100` emit a "skip one attack-anim frame" to `Anim` (advance the strip a frame early) and `cache -=
100`; while `cache < -100` extend the current frame's delay and `cache += 100`. On `levelUp` (the component
already receives `levelUp`), `technique += 2`. Default `technique=0` → the loop never triggers → **anim timing
unchanged** for the 26 actors with technique 0 and for the player (no room-1 effect). Only the 15
nonzero-technique actors change cadence. Persist `technique` in the save (it grows with level).

### (d) Composition / order

Independent of everything. Smallest item. Land any time; pairs naturally with K6 (ninja/shrouder carry both).

---

## K8 — Remaining AIs (builder + the two orphans)

### K8a — `objAICPUBuilder` (REACHABLE — `dwarf`, `goblinBuilder`)

**Original** (`objAICPUBuilder.txt`): FSM `#lookForBuilding`→`#walkToBuilding`→`#build`. `startBuilding`
finds an unfinished building of its `#unitToBuild` type via `teamMaster.getBuildingOfType` (`continueBuilding`)
or spawns a fresh one (`startNewConstruction`, `actorMaster.newActor` `preBuilt=false`, offset `point(32,0)`).
`updateBuild` accrues `pBuildAmount += getBuildRate()` and advances `building.advanceBuildFrame()` every 100
(`buildRate` goblinBuilder=70, dwarf=100; `buildRateInc` per level). `#buildingFinished` → `findTarget`; if
`getBuildDie()` (dwarf `buildOne:true`/`buildDie:true`) the builder walks to the building and dies. Builds:
goblinBuilder → `[goblinHouse, goblinHut, goblinMageHut, garTower]`; dwarf → its throwAxe one-shot tower.

**Port gap.** `spawnEnemy` maps `#objAiCPUBuilder` to nothing special — the dwarf/goblinBuilder spawn as
plain `CpuAI` combatants (they have a natural `#attack`), so they fight instead of building. The
**dwelling/construction** machinery (`advanceBuildFrame`, `preBuilt:false`) isn't wired.

**Design.** Add a `BuilderAI` path (a `CpuAI` mode set, or a small `BuilderAI` component selected when
`aiType=="#objAiCPUBuilder"`): FSM walk-to-site → accrue build → spawn the `#unitToBuild` dwelling. The port
already spawns dwellings (`spawnFromSymbol`/`DwellingArchetype`) and has a frame-advance render; the new piece
is the **incremental build** (spawn the dwelling `preBuilt:false` and advance its build frames by `buildRate`
until finished, then `markBuilt`). `buildDie` builders (dwarf) finish + die. Reuse K3 for walk-to-site. The
`#unitToBuild` list is data. **Reachability:** placed in `works_mr4Demo` (dwarf×5, goblinBuilder×2) — so this
is real content, not engine-only. (This corrects the K-backlog's "MISSING" framing: it's a port gap on
reachable actors.)

**Order:** needs K3 + the dwelling-build wiring; independent of K1/K2. Mid-priority (fewer placements than the
casters). Note: a builder with no buildable site/room may need a fallback (the original drifts/finds a target);
keep the plain `CpuAI` fight as the fallback when no `#unitToBuild` resolves.

### K8b — "hairSeek" = `objAiEnemyTargetSeek` (UNREACHABLE — justified)

The K-backlog's `objAiHairSeek` is actually `objAiEnemyTargetSeek` (`#playerHair`/`#attach` — a legacy
Rapunzel "grab the player's hair" mechanic). **Evidence it cannot run:** (1) `grep -rln '#AiType:
#objAiEnemyTargetSeek' casts/data/` → **empty** (no actor declares it); (2) `#playerHair`/`#AiTarget` appear
in **no** actor record; (3) its base class `objAiEnemy` is **absent from the source cast**
(`find casts -iname objAiEnemy.txt` → only the TargetSeek file), so the parent chain can't even instantiate.
With zero placements across all 47 maps and a missing base class, this is dead engine code. **Out of scope —
justified by placement + missing-dependency evidence.** (If a future map placed a hair-seeker, the actor
record + base class don't exist to support it; aliasing would be *less* faithful, like the `ochreWizard`/`scw`
orphans.)

### K8c — `objAICPUWeaponSeek` (UNREACHABLE — justified)

Seeks a dropped weapon pickup (`weaponMaster.getWeapon` over `[#pan,#pad,#pug,#sci,#spd,#swd]`), picks it up,
sets it as its attack, drops it on `#reelFly`. **Evidence:** `grep -rln '#AiType: #objAiCPUWeaponSeek'
casts/data/` → **empty**; the symbol is referenced **only inside its own file** (`grep -rln objAICPUWeaponSeek
casts/` → the one file). Zero actor records, zero placements. The supporting `weaponMaster.getWeapon`
drop-and-pickup economy isn't used by any shipped actor either. **Out of scope — justified by zero placement +
zero references.**

---

## Implementation order (and the K1 seams)

K1 lands first (the keystone). Then, ordered by dependency and de-risking:

1. **K1 (prereq, separate plan)** — inertia-damps-damage + `power·str·mult` enemy rescale +
   `ENEMY_DAMAGE_SCALE`/`BULLET_DAMAGE_SCALE`. **Seam for K2:** K1 *deliberately leaves the spell on the
   calibrated `dmgPerUnit·charge`* and flags the radial `calcCollisionVectSpell` recouple as K2 territory
   (K1 §g). K2 must consume K1's scale, not invent a new one.
2. **K7 weaponTechnique** — smallest, fully independent, no balance touch (default 0). Warm-up.
3. **K3 pathfinding** — replace `seek` with beeline→scenic. Independent; **unblocks K4/K5/K6/K8a** (they all
   issue `findPathToLoc`/drift). No-regression: open terrain never stalls = straight chase.
4. **K4 bullet-dodge** — `bulletMap` (new `UnitMap` on teamMaster + `combatTick` insert pass) +
   `findNearestEnemyBullets` + the tangent-run optimum-position mode. Layers on `runReload`. Needs K3.
5. **K5 ghost possession** — `findUnitOfType` + drift (K3) + `attemptPossess`/`mergeExperience`/`#finish`.
   Replaces `wander`. Needs K3.
6. **K6 setMultiAttack** — 2-weapon spawn + `WeaponManager.setMultiAttack`. Needs K3 (closing to melee range).
7. **K8a builder AI** — walk-to-site (K3) + incremental dwelling build. Needs K3 + the build-frame wiring.
8. **K2 spell-actor lifecycle** — the big one, **LAST** (it touches the most and subsumes I8 stream + C3
   release-summon). **K1 seam:** at `explode`, route the radial spell vector through `resolveSplash` on K1's
   scale (re-pinning "spell fells a 300-energy enemy"). Reuses K3's `moveToLoc` for the release-fly.
   Adds attack-frame gating + eyestrain (both default-off → no room-1 regression). CPU casters gain a real
   charge-ramp (closing B1/B2 §g).
9. **K8b/K8c** — no code; document the unreachability with the placement evidence above.

Each step is independently testable; 2–3 land first as the low-risk substrate, 8 (K2) is the
balance-sensitive finale gated by the spell-lethality test.

---

## Test plan + room-1 no-regression gate

**Unit (`vitest`):**
- **K2:** `Spell` actor grows (`scale ∝ charge·chargeSize`), positions over head (`#top` offset
  `−size/2`); `release "#release"` flies and `explode` resolves the radial vector through `resolveSplash`
  (assert centre damage on K1's scale fells a 300-energy enemy at base charge — the re-pinned invariant);
  `release "#fireBullets"` drains `chargePerUnit`/`fireDelay` = `floor(held/chargePerUnit)` bullets (reuses
  the I8 stream test); multistage `selectPayload` picks the highest affordable tier; eyestrain jitter scales
  with distance/reach (0 at point-blank, ±`eyestrain` at max range); `isOnAttackFrame` resolves the strike on
  the designated frame only (default frame-1 = unchanged).
- **K3:** beeline aims at goal; 5 zero-movement ticks → scenic with a waypoint within ±100px; next stall →
  back to beeline; arrival within 5px. Open terrain never leaves beeline (room-1 invariant).
- **K4:** `bulletMap` insert + `findNearestEnemyBullets` returns the nearest hostile-owned bullets only (not
  own-team); tangent dest is perpendicular-ish to the nearest bullet, blended 25–75%; priority chain
  (dodge > flee > approach > idle); a caster with no incoming bullets approaches its target.
- **K5:** `findUnitOfType("#monk", team)` first-match; ghost commits a monk, drifts when none; within 10px →
  monk gains the full `xpWorth+xpGained`, glows pink, ghost finishes (grave). No-monk map → perpetual drift.
- **K6:** beyond buffer → ranged weapon 1; inside buffer vs non-melee → melee weapon 2; melee target at
  `dist²>20` with melee weapon 2 → keep weapon 1; ranged-weapon-2 override sets `bufferDist=weapon2.reach`.
- **K7:** technique 20 accumulates to skip a frame after 5 cycles; technique 0 never triggers; `levelUp`
  raises technique by 2; negative technique extends frames.
- **K8a:** builder walks to a site, accrues `buildRate` to advance build frames, spawns the finished dwelling;
  `buildDie` builder dies after one; no-site fallback fights as plain CpuAI.

**Room-1 no-regression gate (`tools/playthrough_smoke.ts`):** the smoke grabs the sword and clears room 1.
**Gate: `after.enemies===0, exitsOpen===true, errors===none`** — unchanged. Room 1 has no casters, no
bullet-dodgers, no ghosts, no 2-weapon CPUs, no nonzero-technique enemies, and open terrain (no stalls), so
K3–K8 are no-ops there by construction; K2's spell path is exercised only once the player owns energyBlast
(room 6), guarded by the spell-lethality unit test, not the room-1 smoke. **Run the gate after every step**
(README discipline), especially after K1 (whole-game rebalance) and K2 (spell recouple).

**In-browser smoke (per item, on a map that places it):**
- K2: cast energyBlast → a visible disc grows over Merlin's head, scaling with charge, then flies and explodes
  (radial damage); a CPU caster (necromancer) now **charges over frames** then releases.
- K4: a goblinMage kites and **side-steps incoming bolts** (tangent), not just backs straight away.
- K5 (`teambattles`): a monkGhost drifts to a monk, the monk **glows pink + gains XP**, the ghost vanishes.
- K6 (`works_mr4Demo`): a ninja throws shuriken at range, switches to its sword in melee.
- K7: a kongFuChicken's punches visibly speed up over a sustained attack.
- K8a (`works_mr4Demo`): a dwarf/goblinBuilder walks to a spot and **constructs a building over time**.

---

## Risks

1. **K2 spell rebalance (the biggest risk).** Recoupling magic damage to the radial `calcCollisionVectSpell`
   over the grown charge changes every spell's lethality curve — it must re-pin "base charge fells a 300-energy
   enemy" on K1's scale (the calibration that K1 *deliberately deferred to here*). A radial-vector scale
   factor (analogous to `MELEE_SCALE`) is the single knob; the unit test + room-6 smoke gate it. **Mitigation:**
   land K2 last, isolated, with the spell-lethality test as the tripwire; keep the I8 stream cadence identical
   (it's the same drain math, just hosted in the actor).
2. **K2 as a real Entity vs a controller substate.** A growing, positional, possibly-orphan-outliving actor is
   more faithful but more surface area (it renders, moves, can kill after its caster leaves). **Mitigation:**
   reuse the existing entity/Sprite(scale)/Movement machinery; the actor is short-lived and pooled like
   `Projectile`. The fallback (a `PlayerControl` substate) is explicitly *less* faithful (can't render a
   positional growing sprite) and is rejected.
3. **K1↔K2 coupling order.** If K2 lands before K1's scale is fixed, the spell recouple has no consistent
   scale to target. **Mitigation:** the order pins K1 first and K2 last; K2's tests assert against K1's
   constants.
4. **K4 bulletMap cost + churn.** A second per-tick broad-phase over all live bullets (which churn heavily).
   **Mitigation:** reuse the `UnitMap` class (bounded shell search, max-3), insert in the existing
   `combatTick` pass; only casters with `dodgesBullets` query it.
5. **K3 random waypoint ≠ deterministic detour.** Swapping the perpendicular detour for the random ±100px
   waypoint changes *micro* movement; faithful but a behaviour shift. **Mitigation:** open-terrain (room-1)
   never stalls → identical; gate the smoke. Keep the port `rng` seeded so it's reproducible.
6. **K2 attack-frame gating regression.** If the default attack-frame isn't frame-1, existing melee/ranged
   timing shifts. **Mitigation:** default = first frame (resolve-on-first-frame == today's resolve-on-cooldown
   edge) unless data specifies an `#attackFrame`; assert room-1 melee cadence unchanged.
7. **K5 grave/finish path.** `goMode(#finish)` draws a grave + sets dead; the port's ghost must not double-fire
   `#leaveGame` or leave a dangling committed-target subscription. **Mitigation:** route through the existing
   death-finalize (which already fires `#leaveGame` cleanly in `combatTick`).

---

## (g) Genuinely out of scope (with placement proof — not dismissed)

- **K8b `objAiEnemyTargetSeek` ("hairSeek")** — 0 actor records (`#AiType:#objAiEnemyTargetSeek` grep empty),
  `#playerHair` absent from all data, **base class `objAiEnemy` missing from the source cast** (cannot
  instantiate), 0 placements across 47 maps. A legacy Rapunzel mechanic with no actor, no data, and no parent
  class. Faithful action = leave unbuilt (like the `ochreWizard`/`scw` orphans the owner accepted).
- **K8c `objAICPUWeaponSeek`** — 0 actor records (`#AiType:#objAiCPUWeaponSeek` grep empty), symbol referenced
  only in its own file, 0 placements, and the `weaponMaster` drop-economy it needs is unused. Dead engine code.
- **Spell *render* niceties** — the exact per-spell `chargeColour`/`chargeVolumeMap` audio curve and spell
  icons (`objSpellIcons`, multistage HUD) are cosmetic follow-ons to K2's core lifecycle; the growing-disc +
  radial-explode + streaming are the substance.
- **`reservationsMaster` permission gate for summon multistage** — K2 wires `#summonUnit`/`#depositMines`
  explode functions, but the *reservation* gate (`obtainPermissionOrHalt`) is the army-reserve system (G2/K9);
  K2 summons on release as C3 does today (always-permitted), with the reservation gate tracked as K9.

> **Filename corrections for the implementer:** the real Lingo files are `objAiEnemyTargetSeek.txt` (not
> `objAiHairSeek`), `objAICPUBuilder.txt` (not `objAiBuilder`), `objAICPUWeaponSeek.txt` (not
> `objAiWeaponSeek`), and `modSpellMultistage.txt`. The actor→AI field is `#AiType`. Placement was decoded
> from `port/public/assets/maps/*.txt` `#objects` layers (all 47).
