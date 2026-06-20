# Parity Audit 03 — Spells, Weapons & Projectiles (the offensive kit)

Scope: every spell/blast, every summon, the weapon/charge/limit infrastructure, and every
projectile (bullet/beam/splash). Grounded in the real `casts/data/act_*.txt`,
`casts/script_objects/mod*.txt`, and `casts/master_objects/*.txt`. Port side:
`port/src/components/control.ts` (the `SPELL`/`PUNCH` constants + casting), `projectile.ts`,
`systems/bullets.ts`, `entities/archetypes.ts` (`spawnEnemy`/`spawnAlly`), `components/combat.ts`
(`takeHit`), `components/freeze.ts`.

## 0. How the original kit actually works (the model the port must hit)

One `#attack` prop-list flows **weapon → character → bullet → victim**. The schema defaults live in
`structMaster.structAttack` (`structMaster.txt`). The load-bearing pieces:

- **Charge, not mana pool.** `modAttack` computes the live charge ceiling per cast:
  `chargeMax = min(attack.chargeMax, capacity*chargeMaxModifier + chargeMaxBasic)`; if
  `limitMagic`, `chargeMax = chargeMax * magicLimit/100`. `chargeStart = chargeStart + manaBurst`
  (clamped to `chargeStartMax`); `chargeSpeed = chargeSpeed * manaFlow` (clamped to
  `chargeSpeedMax`). Cooldown is a `modWeaponManager` counter whose `inc` = `manaRegeneration` for
  magic. **No resource is spent.** (`modAttack.calcAttackChargeMax/Start/Speed`,
  `modWeaponManager.addCooldownCounter`.)
- **Damage == knockback magnitude, scaled by `damageMultiplier`.** `modEnergy.takeHit`:
  `damage = (|collisionVect.x| + |collisionVect.y|) * attack.damageMultiplier`, then
  `loseEnergy(damage)`. The `collisionVect` IS the knockback applied by `objGameObject.takeHit`.
  So a bullet's damage = `(speed·power)·damageMultiplier`; a melee hit = `(power·strength)·mult`;
  a spell = `((charge/2 − dist)·power)·mult` (radial, `modAttack.calcCollisionVectSpell`).
  (`PORTING_PLAN` §6, `PLAN_REVIEW` "damage==knockback".)
- **Attack `#type`** (from `animType`): `#melee`, `#bullet`, `#explode`, `#magic`. `modAttack`
  branches power/hit/collision-vect per type. Splash bullets (`modSplashDamage`) and
  multi-stage/fire-bullets spells (`modSpellMultistage`, `modFireBullets`) layer on top.
- **GMG** (`modGoldenMachineGun` + `modAttack.gmgOn/Off`): a collected toggle that swaps the
  charge math to the `gmg*` fields (`gmgChargeMax/Speed/Start`, often `gmgAutoFire`) — turns a
  charged spell into an auto-firing machine gun.

## 1. Coverage table

Status legend: **FAITHFUL** = mechanic ported with correct math; **PARTIAL** = present but
approximated/missing sub-behaviour; **MISSING** = unported. "Placed?" = appears in the shipped
`public/assets/map.txt` objects layer (ground-truthed below; only `#energyBlast`, `#merlinSword`,
`#maxikit` of the offensive kit are actually placed). Effort S/M/L.

### Player spells / blasts (objScroll, `#animType:#magic`)

| Spell | Original effect | Placed? | Port | Gap | Eff |
|---|---|---|---|---|---|
| `energyBlast` | Charged bolt; chargeMaxModifier .75/Basic 5/start 0/speed 1; cd 30; `#bullet:energyBlastBullet`; `limitMagic:true`; power .75; gmg 15/5/5 autofire | **YES** (room) | **PARTIAL** (B2) | Charge math now flows from the resolved `#attack` × mana via `charge.ts` (chargeMax `min(999,cap*.75+5)`, chargeStart `0+burst`, chargeSpeed `1*flow`, +clamps), not the inline `SPELL` constant; recast gated by the magic weapon's `Counter` (cooldown 30 / manaRegeneration). `limitMagic` honored structurally (×magicLimit/100, limiter defaults 100). Still: damage a tuned `dmgPerUnit*charge` (not vect·power·mult), GMG branch absent, bullet not the named `energyBlastBullet` actor | M |
| `cBlast` | Slow charge (.1), `chargeMaxBasic:999`/`Modifier:0`, power .5; effectively "always huge" | no | **MISSING** | unbuilt | S |
| `cBlastAi` | AI variant of cBlast (chargeMaxModifier 3, Basic 18) | no | MISSING | unbuilt (AI caster content) | S |
| `arcticBlast` | energyBlast + freeze: `payloadFunction:[#takeFreeze,#takeHit]`, `glowTeal`, `freezeMultiplier` via bullet, slow charge .25 | no | **MISSING** | freeze status exists (`Freeze`) but no arctic spell wired; payload-list (two functions) unmodelled | M |
| `darkBlast` | Fast cheap blast: start 5, cd 15, Basic 10, Modifier .5, power 3, not limited | no | MISSING | unbuilt | S |
| `healBlast` | Heals friendlies: `payloadFunction:#takeHeal`, `targetAllegiance:#friendly`, `targetCriteria:#lowestHealth`, power 1, cd 50, not limited | no | **MISSING** | no `#takeHeal` path; no friendly-targeting cast | M |
| `energyMines` | Charged then `explodeFunction:#depositMines` scatters N `energyMine` actors (`charge/chargePerUnit`) at random offsets; limited; gmg | no | **MISSING** | needs `modSpellMultistage.depositMines` + the mine actor | L |
| `energyPulseSpell` | `releaseFunction:#fireBullets`: on release, streams `energyPulse` bullets (`fireDelay 5`, `chargePerUnit 2`) until charge spent; `throwType:#fullstrength` | **YES** (placed in map) | **MISSING** | placed but `SKIP_SPAWN`'d; needs `modFireBullets` streaming-release loop | L |
| `energyBeamSpell` | Like pulse but `beam:true` → `performBeamAttack` (random-jittered targeted beam); chargePerUnit 5 | no | MISSING | needs beam attack path | L |

### Summon spells (multistage, `explodeFunction:#summonUnit`)

| Spell | Original effect | Placed? | Port | Gap | Eff |
|---|---|---|---|---|---|
| `armySummon` | Friendly multistage: charge tiers → `[warrior10,archer15,monk20,dwarf25,kingInGame32]`; reservation/permission via `reservationsMaster`; `payloadFunction:#armyTeleportOut`; experience .5; gmg | no | **PARTIAL** | `control.ts` has an ad-hoc `E`-key "summon warrior" (single unit, cooldown 90) — not the charge-tier/reservation model | L |
| `monsterSummon` | Enemy multistage `[summonArcher12…summonGolem31]`; `targetTileWhenNotBlank`; limited | no | MISSING | summon-spell mechanic unbuilt | L |
| `goblinSummon` | `[goblinWarrior15…blackOrc36]`, `randomSummon:true` | no | MISSING | + randomSummon charge wobble (`modAttack.calcAttackChargeMax`) | L |
| `skelitonSummon` | `[skelitonFootSoldier10…skelitonLord35]`, random | no | MISSING | unbuilt | L |
| `undeadSummon` | `[skeletonWarrior15…skelitonLord38]`, random, power 2 | no | MISSING | unbuilt | L |
| `scSummon` | `[scWarrior16,scArcher17,scMonk20]`, random | no | MISSING | unbuilt | L |
| `armySummonStones` | Chatter prop that runs `#collectArmySummon` (grants the armySummon scroll on touch) | no | MISSING | acquisition trigger, not a spell | S |

> The brief listed `summonArcher/Warrior/Orc/Golem/Boulder` and `tem_monsterSummon`. Those are the
> **produced units** (multistage payload symbols), not spells — they belong to agent 2 as content.
> `summonBoulder` is itself a CPU character (`objAiCPU`) that throws `#boulder` bullets; the
> summon-*units* like `summonArcher` are unit actors. Only the **summon spell mechanic** is in scope
> here, and it is essentially MISSING (one ad-hoc ally spawn aside).

### Towers / structures with attacks

| Actor | Original effect | Placed? | Port | Gap | Eff |
|---|---|---|---|---|---|
| `dwarfTower` | Static `objCPUCharacter` (walkSpeed 0), fires `#towerAxe` at `firingType:#proportional`, reach 600, cd 10 | no | MISSING (`SKIP_SPAWN`) | tower = ranged CPU w/ splash axe; dwelling archetype exists but no auto-fire turret | M |
| `garTower` | Static tower firing `#scArcherArrow` `#fullstrength`, reach 180, cd 60; reincarnateAs goblinArcher | no | MISSING | as above | M |
| `summonBoulder` (boulderMonster) | CPU that throws `#boulder` bullets, reach 220 | no | MISSING | a normal ranged CPU; covered if `spawnEnemy` ranged path is reused | S |

### Melee/ranged weapon actors (objPowerUp `#inherit:#weapon`, carry an `#attack`)

| Weapon | Original effect | Placed? | Port | Gap | Eff |
|---|---|---|---|---|---|
| `merlinSword` | Player melee upgrade: `damageMultiplier 16`, power point(.5,.5), reach point(12,5) | **YES** | **PARTIAL** | `equipSword()` sets a flat `power+160` & longer reach; not the real mult/power/reach-rect or `magicMelee` strength scaling | S |
| `blackAxe` | Melee, `damageMultiplier 3`, power point(1,0) (blackOrc) | no | MISSING | enemy `#weapon` melee — folded into `spawnEnemy` `atkPower` approximation | S |
| `archerBow`/`goblinBow`/`crossBow`/`scArcherBow`/`skeletonBow` | Ranged `#weaponRanged`, fire arrows/bolts, `firingType:#fullstrength`, per-weapon reach/cd | partly (via enemies) | **PARTIAL** | enemies fire a generic bullet (`fireBullet`, `power*2`) — not the weapon's real bullet actor, throwVect, or `damageMultiplier` | M |
| `orcSword`/`ninjaSword`/`goblinSword`/`kingSword`/`scWarriorSword`/`skeletonComandoSword`/`dwarfAxe`(melee) | Melee `#weaponMelee`, per-weapon mult/power | via enemies | PARTIAL | melee folded into `EnemyAI.attack` scalar `power`; no weapon swing/reach geometry | M |
| `laserBeam` | `#weaponRanged` `beam:true`, fires `energyBeam`, reach 150, mult on bullet | no | MISSING | beam attack path | M |
| `flameThrower`/`pinShooter`/`pitchFork`/`goblinHammer` | Misc enemy weapons | no | PARTIAL/MISSING | generic-bullet or melee approximation | S–M |

### Projectiles (bullets / beams / splash — `act_*.txt #inherit:#bullet`)

All non-splash bullets share one model: `objBullet` flies on `#friction`, dies on collision, and on
hit applies `vect·power·damageMultiplier`. The port has ONE generic pooled bullet
(`systems/bullets.ts` + `projectile.ts`) with a scalar `power` and straight-line constant velocity.

| Bullet | mult / power / special | Port | Gap |
|---|---|---|---|
| `energyBlastBullet` | the player blast bolt (referenced by every spell's `#bullet`) | **PARTIAL** | port bullet is generic; not the named actor, no charge→size, no `#explode` |
| `archerArrow` 4/.6, `goblinArrow` 3/.5, `scArcherArrow`, `crossBolt` 4/.7, `acid` 4/.6, `skelitonMissile` 10/.3, `shuriken` 5/.5, `needle` 6/.2, `fireBall` 6/.2, `batBullet` 3/.6, `laser` 10/.3, `boulder` 1/2, `dwarfAxe` 4/1, `fangBunnyBabyBullet`, `smokePin`, `blueFlame` | straight bullets, vary by `friction`/`weight`/`damageMultiplier` | **PARTIAL** | one generic bullet; per-actor `damageMultiplier`, friction, weight, rotation not modelled; enemy damage = ad-hoc `power*2` |
| **Splash bullets** `towerAxe` (mult 10, `splashDamageOn`+`splashGraveOn`), `energyPulse` (mult 5, `#explode`, rotational), `energyBeam` (mult 10, `beam`), `freezeBlast` (power .25, `[#takeFreeze,#takeHit]`, `#explode`, freezeMult 3), `thunderBlast` (power .5, `#explode`), `energyMine` (mult 5, `#explode` on `#mineTriggered`) | radius hit (`modSplashDamage.calcAttackHitSplash`: dist² < power²) hitting ALL in range, optional grave | **MISSING** | no splash/radius damage; no `#explode` mode; no mine trigger |

### Charge / weapon / limit infrastructure

| System | Original | Port | Gap | Eff |
|---|---|---|---|---|
| `modAttack` charge math | capacity/flow/burst → chargeMax/Start/Speed (+limiter, +randomSummon) | **FAITHFUL** (B2) | `charge.ts` resolves chargeMax/Start/Speed generically from any weapon's resolved `#attack` × mana, incl. `chargeSpeedMax`/`chargeStartMax` clamps and `limitMagic` ×magicLimit/100 (limiter defaults 100). Reproduces energyBlast's old numbers exactly (unit-tested). `randomSummon` wobble = summon content (C-phase) | S |
| `modWeaponManager` | weapon registry, cooldown counters (`inc`=agility/dexterity/regen by type), `selectSpell`, `setMultiAttack` | **FAITHFUL** (B2) | `WeaponManager` (`components/weapon.ts`): `pWeapons`→`AttackData`, per-weapon `Counter` cooldowns (inc=agility/dexterity/manaRegeneration), `addWeapon`/`setCurrentWeapon`/`selectSpell`/`getWeapons`/`getCooldownFin`/`resetCooldown`, save/restore. No `setMultiAttack` (no reachable 2-weapon CPU, §g) | S |
| `modGoldenMachineGun` + `gmgMaster` | collect→toggle→swap to `gmg*` charge fields, auto-fire, HUD | **MISSING** | brief notes deliberately unbuilt (GMG not in map) | M |
| `magicLimitMaster` + `objMagicLimit` (`magicLimit`/`1/25/50/75`) | global `getMagicLimit()` scales every `limitMagic` spell's chargeMax | **MISSING** | brief notes unbuilt; `#magicLimit25` IS in some object keys but not this map | S |
| `reservationsMaster` (+ `old_`) | army headcount/permission gating for `armySummon` | **MISSING** | unbuilt (army-reserve persistence, agent-2/4 seam) | L |
| `modSpellMultistage` | charge-tier payload selection, summon/deposit, reservation, icons | **MISSING** | core of all summon spells + energyMines | L |
| `modFireBullets` | streaming release (energyPulse/beam) | **MISSING** | — | M |
| `modSplashDamage` | radius damage + grave on land/mineTriggered | **MISSING** | — | M |
| `modFreeze` `takeFreeze` | slows speed 0.5×, teal glow, time = (|vx|+|vy|)·freezeMult·4 | **PARTIAL** | `Freeze` slows + teal, but `takeFreeze(ticks)` takes a scalar — not the vect·multiplier formula | S |
| `modMedikit` `#takeHeal` / healBlast | heal-over-time / spell heal | **PARTIAL** | pickups heal instantly; no `#takeHeal` payload, no heal-spell | M |

## 2. Headline coverage for this domain

**~15% behavioral parity for the offensive kit.**

- 1 of ~9 player blast spells is present (energyBlast), and only PARTIAL (tuned scalar damage, no
  `limitMagic`/GMG, generic bullet).
- 0 of 7 summon spells (one ad-hoc ally-spawn keybind aside).
- 0 of 3 turret/tower attacks; 0 splash/beam/mine projectiles.
- 1 generic pooled bullet stands in for ~18 distinct bullet actors (PARTIAL).
- Of the heavy infrastructure (weaponManager, multistage, fireBullets, splash, GMG, magic limiter,
  reservations) — none is built; charge math exists only inline for the one spell.

Weighted by what's actually **placed/reachable** in the shipped map, the coverage of *reachable*
offensive content is higher (energyBlast + merlinSword + enemy melee/ranged approximations cover the
real combat the player meets), but `energyPulseSpell` IS placed-and-skipped, so even reachable
coverage is incomplete.

## 3. Prioritized build targets (grouped by shared mechanic)

**T1 — Generic `#attack` + bullet-actor pipeline (unlocks the most at once). Effort L, do first.**
Replace the ad-hoc damage with the real `damage = (|vx|+|vy|) · damageMultiplier` in
`combat.takeHit`, and make `fireBullet` carry the bullet's real `#attack` (power + damageMultiplier
+ friction/weight) resolved from `act_*` data. This single change converts every straight-bullet row
(archerArrow…boulder, ~18 actors) and every melee weapon (orcSword…blackAxe) from PARTIAL→FAITHFUL
with no per-actor code, and fixes the biggest faithfulness risk (see §4). It also makes towers and
`summonBoulder` trivial (ranged CPU reuse).

**T2 — `modAttack` charge engine + `modWeaponManager` (data-driven spells). Effort L.**
Generalize `control.ts`'s inline `SPELL` into a charge component that reads each spell's
`chargeMax/Modifier/Basic/Start/Speed/SpeedMax/StartMax`, `cooldown`, `power`, `bullet`,
`limitMagic` from `act_*`. Add a weapon list + per-weapon cooldown counters. This unlocks the
**simple charged blasts as a group** — `cBlast`, `darkBlast`, `cBlastAi`, and makes `energyBlast`
FAITHFUL — because they differ only in data. Cheap follow-ons once this lands:
`magicLimitMaster` (one global multiplier on chargeMax) and the **GMG toggle** (swap to `gmg*`
fields + auto-fire) — flagged as the infra that unlocks many spells at once.

**T3 — `modSplashDamage` + `#explode` mode (radius damage). Effort M.**
Adds explode-on-land radius damage hitting all targets within `power`. Unlocks as a group:
`energyPulse`, `thunderBlast`, `freezeBlast`, `towerAxe`, `energyBeam`, and the `energyMine`
trigger. Pairs with **`modFreeze.takeFreeze`** fix to make `arcticBlast`/`freezeBlast` correct, and
**`#takeHeal`/`healBlast`** (friendly-target heal spell) — both small once payload-lists are real.

> Deferred (large, lower reachability): `modSpellMultistage` + `reservationsMaster` for the summon
> spells and `energyMines`/`modFireBullets` streaming for `energyPulseSpell`/`energyBeamSpell`.
> None of the summon scrolls is placed in the shipped map; `energyPulseSpell` IS placed, so
> `modFireBullets` (T-after-T1) is the one streaming-release item worth pulling forward.

## 4. Faithfulness risks (call these out loudly)

1. **Damage is pre-baked at the call site, not `vect·power·damageMultiplier`.** `combat.takeHit`
   takes a scalar `dmg`; `control.ts` uses `dmgPerUnit*charge`, `EnemyAI.attack` uses `power*2`.
   The real model couples damage to the **knockback vector** and the bullet/weapon's
   `damageMultiplier`. Until T1, every bullet/weapon's relative lethality is a guess, and the
   defining "damage == knockback magnitude" semantics are absent. **Highest risk.**

2. **No knockback at all.** `objGameObject.takeHit` applies `collisionVect` as velocity before
   `modEnergy` reads it; the port applies neither knockback nor the post-knockback ordering. Combat
   *feel* (reel, push-back, freeze-time which is derived from the same vector) is wrong.

3. **Charge math is hardcoded for one spell.** `limitMagic` is silently ignored, `chargeSpeedMax`/
   `chargeStartMax` clamps and `randomSummon` charge-wobble are absent, and `chargeMaxModifier`/
   `Basic` come from a constant, not data. Any second spell will diverge.

4. **Multi-hit / splash / explode entirely missing.** Splash bullets hit ALL units in radius
   (`dist² < power²`) and can draw graves; mines trigger on proximity; pulse/beam stream many
   bullets. The single point-collision bullet can't express any of this — a `towerAxe` or
   `energyPulse` would hit one target for the wrong amount.

5. **Status-effect payloads are scalar, not the real formulas / payload-lists.**
   `takeFreeze(ticks)` ignores `freezeTime = (|vx|+|vy|)·freezeMultiplier·4` and the 0.5× speed +
   teal-glow lifecycle is only half-modelled; `#takeHeal` doesn't exist; `payloadFunction` as a
   **list** (`[#takeFreeze,#takeHit]` for arctic/freeze) is unmodelled, so a hit can't apply two
   effects.

6. **GMG / magic-limiter deliberately unbuilt** — acceptable per the brief (not placed), but note
   `#magicLimit25` and `#gmg` appear in *other* maps' object keys, so they are real content, not
   truly dead — just not in `merlin4`.

---

### Appendix — placement ground truth

Resolved `public/assets/map.txt` `#objects` layers through `objects_key.txt` (mirroring the port's
`tlk` parser, comments excluded, 1-based). Offensive content actually placed in the shipped map:
**`#energyBlast`, `#merlinSword`, `#maxikit`** plus `#energyPulseSpell` (placed but `SKIP_SPAWN`'d
in `world/rooms.ts`). All other spells, summons, towers, GMG, mines, beams, and the magic limiter
are **not in this map** — dead content here, though several recur in other maps' object keys
(`#energyMine/#energyMines/#armySummon/#dwarfTower/#cBlast/#healBlast/#monsterSummon/#magicLimit25/
#gmg/#garTower/#blackAxe`), so they are reachable elsewhere and not throwaway.
