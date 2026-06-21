# Phase I — `mr4Demo` placed content (the "test-everything" map's inert objTypes)

**Goal:** 100% behavioral parity for the content the project owner's `maps/works/mr4Demo.txt`
(225-room "test everything" map) **places** but the port currently spawns inert. A prior pass called
much of this "unreachable / out of scope" — that was wrong. The map is data, and it places it. This
plan rejects the unreachable framing on evidence: **every** mechanic below is placed across **multiple**
of the 47 shipped maps (proof in §h), not just `mr4Demo`.

> **Ground truth (rerun any time):** `cd port && npx tsx tools/classify_placed.ts`. Buckets `mr4Demo`'s
> object layer by `#objType`. The GAP = `[skipped]` + `[otherObjType]` (null-spawned or `SKIP_SPAWN`'d).

This phase plugs into the DONE engines: B2 `WeaponManager`/`charge.ts`, C2 `splash.ts`/`impactAreaAttack`,
B1 `teamMaster` (override + roster), `audio.ts` (`playMusic`), `actorSerial.ts`/`spawnTable.ts` dispatch.

---

## §a — The real mechanics (grounded in Lingo)

### 1. `#objMine` (8 placed): `fire`, `pitMonster`, `snow/orc/quad/ice/undeadAura`
`casts/script_objects/objMine.txt` is `objGameObject` + `modAnimSet` + **`modAttack`** + **`modExploder`**.
It is a static actor on `gMineLayer` with a tiny FSM:

- `#stand` → counts down `pPrimeCounter` (`#timeToPrime` s → frames). When primed → `#primed`.
- `#primed` → every `pCheckCounter` (`#timeToCheck`, default 3 frames) calls `updateCheckCollisions`:
  `g.teamMaster.findTargetWithin(me.big, triggerRadiusTile).dist < triggerRadius²` → if a hostile is in
  range, fires `me.big.internalEvent(#mineTriggered)`. `#mineTriggered` is in `#explodeEvents`, so
  `modExploder` runs the `#attack` (an `#explode` area hit — the **same** `calcAttackHitMagic` /
  `calcCollisionVectSpell` path C2 already ports in `splash.ts`).
- `#explodeFin`: if `pDieOnExplode` → die; else `resetMine()` (back to `#stand`, re-prime) and increment
  `pExplosions`; die once `pExplosions >= dieOnExplodeNumber` (when `dieOnExplodeNumber <> 0`).

The mine's *team* decides who it hits: `#attack.hits` + `#attack.targetAllegiance` (default `#enemy`)
resolved through `teamMaster.calcTargetTeams` — exactly what `impactAreaAttack` already consumes.

| actor | team | trigger / prime | `#attack` (explode) | dies? |
|---|---|---|---|---|
| `fire` | `#fire` | r20, prime 0.1s | dmgMult **15**, explodeCharge 16, power .05, hits members+buildings | re-arms, dies after **10** explosions |
| `pitMonster` | `#pitMonsters` | r**50**, prime **120s** | dmgMult **40**, explodeCharge **100**, power .05 | re-arms forever (`dieOnExplode:false`, no number) |
| `snow/orc/quad/ice/undeadAura` | `#ice/#orcs/#monsters/#ice/#undead` | r16, prime 0.1s | dmgMult **0**, explodeCharge 18, power .25, **`payloadFunction:#takeFreeze` freezeMultiplier .5** | re-arms forever |

So `fire`/`pitMonster` are **damage** emitters; the five auras are **freeze** emitters (0 damage,
`#takeFreeze`) — a slowing proximity field around a team's units. `collideWithTarget` differs
(`fire` true, others false) but at the splash layer it's the disc test that matters. All have
`#friction point(9,9)`, `#weight 0.4`, `#character #mine`. `recordInRoomState` is `false` for `fire`,
`true` for the rest (save behavior — minor).

### 2. `#objMagicLimit` (4): `magicLimit1/25/50/75`
`objMagicLimit.txt`: `on init` calls `g.magicLimitMaster.setMagicLimit(params.magicLimit)`; `on finish`
calls `setMagicLimitToDefault()` (back to `gMagicLimit`, the global default = **100**).
`magicLimitMaster.txt` is a trivial holder (`pMagicLimit`, `getMagicLimit`/`setMagicLimit`).
The limiter is **read** in `modAttack.calcAttackChargeMax`:
`if pAttack.limitMagic then chargeMax = chargeMax * magicLimit / 100`. So placing a `magicLimit25`
actor in a region **dims** every `limitMagic:true` spell's charge ceiling to 25% while you're in that
room; leaving (the actor's `finish`) restores 100. Each `act_magicLimitN` only overrides `#magicLimit:N`.

### 3. `#objMusic` (4) + `#musicLastStand`: room music
`objMusic.txt`: `on start` → `g.soundMaster.playMusic(pMusicName)`. Each `act_music*` sets `#musicName`
to a logical track (`baroque_rock_v1`, `woods_of_evil_v1`, `last_stand_v4`, `baroque_rock_techno_v1`,
`electronic_merlin_v1`). `soundMaster.playMusic` has a **restart-guard** (`checkRestartMusic`: don't
restart if the same track is already playing). `#musicOff` → `act_musicOff` → `"stopMusic"` sentinel →
`stopMusic`. `musicLastStand` is just another `act_music` (currently in `SKIP_SPAWN`).

### 4. `#objTeamOverride`: `teamOverride`
`objTeamOverride.txt`: `on init` → `g.teamMaster.setTeamOverride(pTeamToTarget)`; `on finish` → reset
to `#none`. `act_teamOverride` sets `#teamToTarget: #aldevar`. Effect (already in `teams.ts`
`calcTargetTeams`): every `#enemy`-seeking unit that isn't itself on/friendly-to the override team
**ganks the override team** (`return [[...o.friends, ov]]`) — i.e. everyone gangs up on the player's
side. The port's `TeamMaster.teamOverride` field + the override branch exist; **nothing sets it**.

### 5. `#objChatter` (5): `stones1-5`
`objChatter.txt` inherits `objPowerUp` + `modProp` + `modThespian`; `#objAiChatter`. On `collected`
(player walks onto it, in nav mode), it `goMode(#talking)` (swaps to `pTalkingMember`) and
`g.cutSceneMaster.playCutScene(pScriptToPerform)` — i.e. it's a **decorative cutscene-trigger NPC**
(talking stones). `act_stones1..5` set `#scriptToPerform: #stonesN`, a `320×320` collisionRect (a big
"walk near me" trigger), `#team: #chatters` (stones1) / `#collectables` (stones2-5). It is NOT a weapon
or an army-summon stone — it is environmental chatter. (NB `collected` has `pPerformed` latch — talks
once, then `#finishedTalking`.) **`act_armySummonStones` is a SEPARATE actor** (not a chatter) and is
the army-summon-monolith; it is `SKIP_SPAWN`'d today and not in `mr4Demo` (see §f.8/§h).

### 6. `#objScroll`: `energyPunch`
`objScroll.txt`: a `objPowerUpWriting`; `on collected` → `collector.newScrollCollected(character,
attack.duplicate())`. `act_energyPunch` carries a full `#attack` (`#animType:#magicMelee`, power
point(3,1), damageMultiplier 1.75, reach point(7,10), `#name:#energyPunch`). So it's a **melee weapon
upgrade scroll** (a magic punch) — granted via the same `addWeapon` path as `merlinSword`/spells.
`newScrollCollected` (objPlayerMerlinCharacter 160-170): if `scrollType <> #gmg` → `addWeapon`; else
`gmgCollected()`.

### 7. `#gmg`: the Golden Machine Gun (`modGoldenMachineGun` + `gmgMaster`)
`act_gmg` is `#objType:#objScroll` (collected like a scroll) but `newScrollCollected` routes `#gmg`
specially to `me.gmgCollected()` → `modGoldenMachineGun.gmgCollected` sets `pGmgCollected = true` and
calls `setGmg()` (toggles ON). The **G key** (`objAiPlayer.interpretGameKeys` → `setGmg`) toggles it
thereafter. `setGmg` (`modGoldenMachineGun.txt`): flips `pGmgOn`; on → `me.big.gmgOn()` +
`internalEvent(#gmgTurnedOn)`; off → `gmgOff()` + `#gmgTurnedOff`; updates `gmgMaster` display.
`gmgOn/Off` live on **`modAttack`** (modAttack.txt 849-861): swap the active spell's charge params to
the `#gmgChargeMax/Speed/Start` set (e.g. energyBeam: gmgChargeMax 0, gmgChargeSpeed 2, gmgChargeStart
0, `gmgAutoFire:true`). The **auto-fire loop** is `objAiPlayer.internalEvent(#spellCharged)`: while
`getGmgOn()` and `attack.gmgAutoFire`, immediately `playerAttackRelease()` then `playerAttackCharge()`
again → the spell fires continuously the instant it charges (a machine-gun). `ensureSpell`
(objAiAttack 167-172) also forces `fireDelay = 0` when GMG is on. The GMG is a **mode**, not a weapon:
it modifies whatever magic weapon is current. `gmgMaster` is just an on/off HUD displayer.

### 8. beams: `energyBeamSpell`, `energyPulseSpell`
Both `#objScroll`s granting a `#magic` weapon with `#releaseFunction:#fireBullets`, `#bullet:#energyBeam`
/ `#energyPulse`. The original lifecycle: charging spawns an `objSpell` actor (objSpell.txt: `modAttack`
+ **`modFireBullets`** + `modSpellMultiStage`) over the player's head; on release (`#spellReleased`),
`modFireBullets.internalEvent` enters `#fireBullets` mode and, every `#fireDelay` frames, calls
`fireBullet`: drains `chargePerUnit` from the held charge, spawns a `#bullet`, and ends when charge<0
(then the spell actor dies). So a beam/pulse **streams** bullets proportional to how much you charged.

- `energyBeam` bullet: `#beam:true`, dmgMult 10, explodeCharge 1, power .25, explode-on-arrive. The beam
  uses `modAttack.performBeamAttack` (modAttack 623-718): spawns the bullet **at the target loc**
  (`startLoc = targetLoc`, with a ±10px jitter), then `bulletObj.setBeam(distToTargetScale, distXY)`
  (objBullet 239-247) **scales the sprite width to the distance + rotates it** so the bullet renders as a
  beam line from caster to target. `energyBeamSpell.#attack`: chargeMax 999, chargePerUnit 5, fireDelay
  6.75, `limitMagic:true`, gmgChargeSpeed 2, gmgAutoFire true.
- `energyPulse` bullet: NOT a beam — a normal rotational bullet (dmgMult 5, explodeCharge 10, power 1),
  fired via `performRangedAttack`. `energyPulseSpell.#attack`: chargeMax 999, chargePerUnit 2, fireDelay
  5. So energyPulse is a **rapid stream of small explode bullets**; energyBeam is a **scaled beam line**.

### 9. towers / invasions / InGame (the unit/dwelling assessment)
- `dwarfTower`/`garTower`: `#objType:#objCPUCharacter`, `walkSpeed 0`, `reelProof true`, a ranged
  `#attack` (`towerAxe` splash / `scArcherArrow` bullet) — **static ranged turrets**. Already spawn via
  the generic engine; `dwarfTower`'s towerAxe-splash path is C2-built. (`garTower` reincarnates to a
  `goblinArcher` on death — E1-built.)
- `orcInvasion`/`undeadInvasion`: `#objType:#objDwelling`, `#team:#invisible`, multi-group
  `#residentGroups` wave spawners (bowOrc/swordOrc/mageOrc; skeleton/necromancer/darkMage). Generic
  D2 dwelling engine handles them.
- `*InGame` (berlin/king/scarlet/amotonlin/...): **all `#objType:#objCPUCharacter`** (10 of 11 are
  `#objAiCPUSpellCaster`, king is plain CPU). Real `#attack`/`#weapon`/`#team`, `#leaveWhenFinished:true`.
  These are **combat CPUs** (allied wizard reinforcements, e.g. `berlinInGame` = energyBlast wizard on
  `#aldevar`), NOT cutscene-only NPCs. They spawn correctly via the generic B1/B2 engine.

---

## §b — The gap today (per `classify_placed.ts`)

`[skipped]`: `energyBeamSpell  energyPulseSpell  gmg  magicLimit25  musicLastStand  player`
`[otherObjType]` (null-spawned — `spawnFromSymbol` returns null for non-unit/dwelling objTypes):
`energyPunch(#objScroll)  fire/pitMonster/snow/orc/quad/ice/undeadAura(#objMine)
magicLimit1/50/75(#objMagicLimit)  musicBaroqueRock/…/WoodsOfEvil(#objMusic)
stones1-5(#objChatter)  teamOverride(#objTeamOverride)`.

Concretely inert:
- **objMine**: `spawnFromSymbol` returns null (objType not handled) → no fire/auras at all.
- **objMagicLimit**: null-spawned; `charge.ts` reads `MAGIC_LIMIT = 100` (a hardcoded const, never set).
- **objMusic**: null-spawned; `audio.playMusic` exists but nothing calls it from a placed actor.
- **objTeamOverride**: null-spawned; `teamMaster.teamOverride` exists but nothing sets it.
- **objChatter**: null-spawned (stones don't appear).
- **objScroll energyPunch**: null-spawned; not in `PICKUPS`.
- **gmg**: `SKIP_SPAWN` (no pickup, no toggle, no `gmgOn/Off` charge mode, no auto-fire loop).
- **beams**: `SKIP_SPAWN`; `AttackData` lacks `beam`/`fireDelay`/`releaseFunction`/`gmg*` fields;
  `Projectile` has no beam render; player charge has no streaming-release.

The unit/dwelling placements (81 + 15) are **fine** (see §f) — towers, invasions, InGame chars, and
the skeliton* multi-part bosses all spawn via the existing engine.

---

## §c — Component / dispatch design

The unifying move: `spawnFromSymbol` (in `actorSerial.ts`) currently routes
pickup → dwelling → unit and returns null for everything else. Add an **objType dispatch** keyed off
`registry.resolveActor(name)["objType"]` so each placed-but-inert objType spawns a real Entity. Keep the
behavior in small components, reusing the C2 splash/freeze engine, the B1 teamMaster, `audio.ts`, and
`charge.ts`.

### C.1 objMine → `Mine` component (`components/mine.ts`, new)
`spawnFromSymbol`: `objType==="#objMine"` → `spawnMine(name, x, y, attack)`. A minimal archetype:
`Identity` + `Movement` (static, friction 9 — it doesn't move) + `Team` (its `#team`) + `Anim` (mine
sprite) + `Energy` (so it can be killed; checkDead is no-op in the original but it's a real actor) +
**`Mine`**. The `Mine` FSM mirrors `objMine.update`:
- `prime` counter (`#timeToPrime`·gameSpeed → frames; 0.1s ≈ 3 frames, 120s ≈ a long fuse).
- every `#timeToCheck` frames, query `game.teamMaster` for a hostile within `triggerRadius` of its loc
  (reuse the unit-map: `unitMap.search` filtered to the mine's hostile teams via `calcTargetTeams`,
  nearest-dist < `triggerRadius²`). On hit → **detonate**: call **`resolveSplash`** (`splash.ts`) with
  the mine's `#attack` at its own loc (this already does `#explode` radius=explodeCharge/2, the radial
  `calcCollisionVectSpell` falloff, and the `#takeFreeze` payload for the auras). Play `#explodeSound`.
- `dieOnExplode` → `setDead`; else re-prime; track `pExplosions` vs `dieOnExplodeNumber`.

This is ~one small component; **all damage/freeze math is already built** (C2). The auras (dmgMult 0,
`#takeFreeze`) and fire/pit (damage) differ only in their `#attack` data — zero special-casing.

Helper on teamMaster: `findHostileWithin(mine, radius): {obj,dist}` — reuse `calcTargetTeams` +
`unitMap.search`, nearest hostile (mirrors `findTargetWithin`). Or reuse `findTarget` with a radius gate.

### C.2 objMagicLimit → set the limiter (no new actor needed)
Make the limiter a real piece of state. Add a tiny `MagicLimitMaster` (singleton on `game`, or a module
field) with `get()/set(n)/setDefault()` (default 100). Change `charge.ts`:
replace the `MAGIC_LIMIT` const with `game.magicLimit.get()` in `chargeMaxOf`. `spawnFromSymbol`:
`objType==="#objMagicLimit"` → spawn a minimal Entity that on spawn calls `set(record.magicLimit)` and
on room-leave/death calls `setDefault()`. Faithful detail: the original's `finish` restores 100, so the
limiter is **room-scoped** — clear it when the RoomManager tears down the room (hook the room-leave like
G2's army teleport-out, or have the limiter Entity reset on `removeFromGame`). For mr4Demo's per-room
test cells this is exactly "this room dims magic to N%". `limitMagic:true` spells (energyBeam/pulse,
the C spells with `#limitMagic`) respond; `energyBlast`/melee don't.

### C.3 objMusic → call `audio.playMusic` on spawn
`spawnFromSymbol`: `objType==="#objMusic"` → spawn a zero-cost marker Entity that calls
`game.audio?.playMusic(record.musicName)` once on spawn (mirrors `objMusic.on start`). `audio.ts`
already has the restart-guard (`currentMusic === name`) and per-name keying. `musicLastStand` is just
an `act_music` → remove it from `SKIP_SPAWN`. `#musicOff`/`act_musicOff` (`#musicName:"stopMusic"`) →
`audio.stopMusic()` (sentinel branch, like `soundMaster`). **Mapping note:** `#musicName` is a logical
track name (`baroque_rock_v1`); confirm those keys exist in `audio.index.music` (the F1 pipeline
bundled 8 music tracks) — add an alias table if the bundler used different keys (verify in §e).

### C.4 objTeamOverride → set teamMaster.teamOverride
`spawnFromSymbol`: `objType==="#objTeamOverride"` → spawn a marker Entity; on spawn
`game.teamMaster.teamOverride = record.teamToTarget`; on room-leave/death reset to null. The override
branch in `calcTargetTeams` already implements the gang-up. Room-scoped reset like C.2.

### C.5 objChatter → `stones1-5` decorative chatter NPC
`spawnFromSymbol`: `objType==="#objChatter"` → spawn a static Anim+Team(`#chatters`/`#collectables`)
+ a small `Chatter` component holding `scriptToPerform`. On player overlap (the 320×320 trigger), if
`!performed`, swap to the talking member and `game.sceneManager`/`cutscenePlayer` plays the cutscene
(`pScriptToPerform`), latch `performed`. The H1 `Thespian` cutscene engine already exists — wire the
trigger. **Lower priority / cheapest faithful**: if a stones cutscene script isn't authored/bundled,
spawn the stones as inert decorative sprites (visible, non-blocking, `collisionDetection:false`) so the
map renders correctly and they simply don't talk — matches the original's commented-out
"temporarily disabled inGame Scripts" risk (objChatter `collected` has a disable note). Decide in §e by
checking whether the stones cutscene scripts are bundled.

### C.6 objScroll energyPunch → a pickup that addWeapons its `#attack`
The faithful path: `objScroll.collected` → `newScrollCollected(character, attack)` → `addWeapon`. The
port's `Pickup` already routes `sword`/spell scrolls through `equipSword`/`grantSpell` (which call
`addWeapon`). Add a `energyPunch` pickup effect: `PICKUPS["#energyPunch"] = "energyPunch"`;
`SCROLL_ATTACK.energyPunch = "energyPunch"` (its `#attack` is on `act_energyPunch`); in `pickup.ts`
grant it as a **melee** weapon (`#animType:#magicMelee`) via `addWeapon`. It then fires through the B2
WeaponManager exactly like `merlinSword` (the `#magicMelee` branch in `calcCollisionVectMelee` adds the
mana term — note that detail when wiring melee damage, modAttack 481).

### C.7 gmg → collect + toggle + charge mode + auto-fire
Three pieces:
1. **Collect**: `PICKUPS["#gmg"]` → a `gmg` pickup effect that calls a new
   `PlayerControl.gmgCollected()` (sets `pGmgCollected`, turns it on) instead of `addWeapon`
   (`newScrollCollected`'s `#gmg` branch). Remove `#gmg` from `SKIP_SPAWN`.
2. **Toggle**: a key (the original's G / `#gmg`) → `PlayerControl.setGmg()` mirroring
   `modGoldenMachineGun.setGmg`: flip `gmgOn`; on → apply the gmg charge set, off → restore normal.
3. **Charge mode + auto-fire**: model `gmgOn/Off` as picking the `#gmgChargeMax/Speed/Start` from the
   *current magic weapon's* `#attack` when GMG is on. The port charges in `PlayerControl` (not an
   `objSpell` actor), so: when `gmgOn`, `chargeMaxOf/StartOf/SpeedOf` read the `gmg*` fields, and on
   `spellCharged` (charge reached max) **auto-release + re-charge** if `attack.gmgAutoFire` — i.e. the
   player's charge loop, on reaching `chargeMax` with GMG on, fires and immediately restarts (continuous
   fire). For a normal spell (energyBlast) under GMG: `gmgChargeMax/Speed/Start` come from data (verify
   energyBlast has them; energyBeam/pulse do). The `gmgMaster` HUD displayer is cosmetic (an on/off icon)
   — a small HUD flag, not load-bearing.

Add to `AttackData`: `gmgChargeMax`, `gmgChargeSpeed`, `gmgChargeStart`, `gmgAutoFire`.

### C.8 beams → streaming release (`fireDelay`/`chargePerUnit`) + beam render
Add to `AttackData`: `beam:boolean`, `fireDelay:number`, `releaseFunction:string` (`bullet` and
`spellSpeed` already exist). Two sub-mechanics:

1. **Streaming release** (`modFireBullets`): when a magic weapon has
   `releaseFunction === "#fireBullets"`, release does NOT fire one bolt — it enters a **stream** that
   emits a bullet every `fireDelay` frames, draining `chargePerUnit` of the held charge per shot, until
   charge<0. In the port, model this as a `BulletStream` substate on `PlayerControl` (or a short-lived
   "spell" Entity carrying the residual charge): on release, latch `streamCharge = held`, then each tick
   while `streamCharge >= 0` and the fireDelay counter fires, spawn the `#bullet` and subtract
   `chargePerUnit`. `energyPulse` fires via the normal ranged path (`fireBullet`/`fireSplashBullet` — it
   has explode `#attack` so use `fireSplashBullet`, C2). `energyBeam` fires via the **beam path** (below).
   GMG note: `ensureSpell` forces `fireDelay=0` under GMG → with GMG the whole stream empties in one tick.
2. **Beam render** (`performBeamAttack` + `setBeam`): the energyBeam bullet spawns **at the target loc**
   (with ±10px jitter) rather than travelling, and its sprite is **stretched to the caster→target
   distance and rotated** (objBullet.setBeam: `setSpriteWidth(dist+1)`, `setSpriteRotation(GeomAngle)`).
   Add a `beam` mode to `Projectile`/`bullets.ts`: place it on the line, set sprite scale-x + rotation,
   detonate (explode `#attack`) on its first frame at the target. The port's renderer already supports
   per-sprite rotation/scale (F3); the beam is a one-frame stretched explode at the target. Faithful-
   enough: a visible beam line that damages along/at the target with the energyBeam explode.

### C.9 spawnTable / dispatch summary
- `actorSerial.spawnFromSymbol`: after the pickup/dwelling/unit branches, add an `objType` switch for
  `#objMine`/`#objMagicLimit`/`#objMusic`/`#objTeamOverride`/`#objChatter` → their spawners. (The
  `#objScroll` ones — energyPunch/gmg/beams — go through `PICKUPS`, not here.)
- `PICKUPS`: add `#energyPunch`, `#gmg`, `#energyBeamSpell`, `#energyPulseSpell` (the last two grant a
  `#magic` weapon with the streaming release).
- `SKIP_SPAWN`: drop `energyBeamSpell`, `energyPulseSpell`, `gmg`, `magicLimit25`, `musicLastStand`
  (they become handled). Keep `#none`, `#player`. `#armySummonStones` stays (separate, §f.8).
- These actors must serialize/restore through `serializeActor`/`respawnActor` (G1) — mines and
  region-effect markers carry `recordInRoomState` flags; honor them (mine `recordInRoomState:false`
  means don't snapshot it into pState — re-spawns fresh on re-entry).

---

## §d — Step-by-step order (cheap wins first)

**Cheap wins (data wiring, ~no new mechanics):**
1. **objMusic** — marker Entity calls `audio.playMusic`; verify the music-name→key mapping; handle
   `musicOff`; drop `musicLastStand` from SKIP_SPAWN. (smallest)
2. **objMagicLimit** — `MagicLimitMaster` state + `charge.ts` reads it + room-scoped reset; drop
   `magicLimit25` from SKIP_SPAWN.
3. **objTeamOverride** — marker sets `teamMaster.teamOverride` (engine already gangs up); room-scoped
   reset.
4. **objScroll energyPunch** — `PICKUPS` row + `pickup.ts` addWeapon (melee `#magicMelee`).
5. **objChatter stones1-5** — decorative spawn (+ cutscene trigger if scripts bundled; else inert
   sprite).

**Bigger items (new components / engine):**
6. **objMine** (`Mine` component) — fire/pitMonster (damage) + the five auras (freeze) via `resolveSplash`.
   Add `teamMaster.findHostileWithin`.
7. **GMG** — collect + toggle + `gmg*` charge fields + the `spellCharged` auto-fire loop.
8. **Beams** — `AttackData` beam/fireDelay/releaseFunction fields, the streaming release
   (`modFireBullets`), and the beam render (`performBeamAttack`/`setBeam`). energyPulse (stream of
   explode bullets) is simpler than energyBeam (stretched beam) — do pulse first.

---

## §e — Test plan

**Unit (vitest), per mechanic:**
- objMine: a `Mine` primes after N frames, detonates when a hostile enters `triggerRadius`, calls
  `resolveSplash` with the right `#attack`; `fire` damages and re-arms (dies after 10), `pitMonster`
  re-arms forever; an aura applies `takeFreeze` (0 damage, 0.5× speed) not `takeHit`. Hostile outside
  radius → no trigger. Team gating: a `#fire`-team mine doesn't hit `#fire` units.
- objMagicLimit: `MagicLimitMaster.set(25)` → `chargeMaxOf(limitMagic spell)` is 25% of base; a
  non-`limitMagic` spell unchanged; room-leave resets to 100.
- objMusic: spawning `musicBaroqueRock` calls `audio.playMusic("baroque_rock_v1")`; same track twice =
  no restart (guard); `musicOff` → `stopMusic`.
- objTeamOverride: with override=`#aldevar`, a `#monsters` unit's `calcTargetTeams` returns the
  aldevar-side teams (gangs up); reset clears it.
- energyPunch: collecting grants a `#magicMelee` weapon (WeaponManager owns `energyPunch`, fires it).
- GMG: collect sets on; toggle flips; with GMG on, `chargeMaxOf` reads `gmgChargeMax`; on `spellCharged`
  with `gmgAutoFire`, the release+recharge loop fires repeatedly (count > 1 per N ticks).
- beams: a `releaseFunction:#fireBullets` weapon, on release with charge C, emits `floor(C/chargePerUnit)`
  bullets spaced by `fireDelay`; energyBeam bullet spawns at target loc with a stretched/rotated sprite.

**In-browser on `?map=works_mr4Demo`** (or `?map=new_mr4Demo`):
- the magic limiter dims the charge bar in a `magicLimitN` cell (visibly shorter max);
- walking a friendly/enemy into an aura zone slows it (teal/freeze) and fire/pit damages on contact;
- entering a `music*` cell changes the playing track (no restart on re-entry);
- in the teamOverride cell, enemies gang up on the player's side;
- collecting the GMG + toggling → continuous auto-fire; collecting a beam scroll → a beam/pulse stream
  fires; energyPunch grants a stronger melee.
- regression: room-1 `playthrough_smoke` still ends `enemies:0, exitsOpen:true, errors:none`; no
  pageerrors loading mr4Demo.

---

## §f — Unit / dwelling assessment (the 81 + 15)

**Verdict: they spawn correctly via the generic B1/B2/D2/E1 engine. No inert/wrong unit found.** Spot
checks of the tricky ones:

1. **Towers** (`dwarfTower`, `garTower`): `#objCPUCharacter`, `walkSpeed 0`, `reelProof true` → spawn as
   static ranged turrets. `dwarfTower` fires `towerAxe` (a splash bullet) — C2-built (the plan/tracker
   already verified "dwarfTower towerAxe splash@samii"). `garTower` fires `scArcherArrow` and
   `reincarnateAs:[#goblinArcher]` on death — E1-built. ✔ (`garTower`'s `#weaponRanged` bullet is a
   plain bullet; confirm it fires — it's a standard ranged CPU.)
2. **Invasions** (`orcInvasion`, `undeadInvasion`): `#objDwelling`, `#team:#invisible`, multi-group
   `#residentGroups` wave spawners. D2 dwelling engine handles `#residentGroups` (build timers, group
   sizes, release intervals). ✔ Verify the **multi-group** case (3–5 groups each with its own timer)
   actually cycles all groups, not just the first — flag if D2 only honored a single group.
3. **InGame named chars** (`berlin/king/scarlet/amotonlin/...InGame`): **all combat CPUs**
   (`#objCPUCharacter`, 10/11 `#objAiCPUSpellCaster`), real `#weapon`/`#team`/`#leaveWhenFinished`.
   They are allied/enemy reinforcements, NOT cutscene-only NPCs (the *cutscene* `berlin` is a different,
   alias-bound lead — E1/H1 §g). They spawn and fight via B1/B2. ✔ (The spellcaster AI fires its
   `#weapon` via the charge engine; verify the `#objAiCPUSpellCaster` path charges+releases — if the
   port only has the plain `CpuAI`, a spellcaster InGame char may melee instead of cast. **Flag to
   verify**: does the port have an AI-caster charge/release for enemy/ally wizards, or do they fall back
   to bullets/melee? B2's CpuAI gates fire on the counter but the *spell charge* loop for CPUs may be
   approximate — confirm berlinInGame actually casts energyBlast.)
4. **Multi-part bosses** (`skeliton*`): E1 reincarnation cascade built (Lord→Upper→TorsoTank→Head→Arm/
   LowerLeg/FootSoldier/Sword), verified in-browser in mr4Demo. ✔

**One real risk to verify (3 above):** the `#objAiCPUSpellCaster` casting loop for InGame wizards /
`scarletInGame` (undeadSummon) / `berlinInGame` (energyBlast). If the port's CPU AI can't *charge a
spell*, these named casters will spawn but under-fight. This is AI wiring (B-domain), surfaced here
because mr4Demo places them.

**`stones6-10`**: have `act_` records but are placed in **zero** maps (§h) → build-for-completeness only
(spawn-correct if reached, never reached). `armySummonStones` is placed (other maps) but not in mr4Demo;
it's the army-summon monolith (separate from chatter stones) — out of this phase's mr4Demo scope but
noted.

---

## §g — Faithfulness risks

1. **GMG charge mode in a pool-less port.** The original GMG is a charge-param swap on the live
   `objSpell` actor + an auto-fire loop on `spellCharged`. The port charges inside `PlayerControl`, so
   the GMG must be modeled as "current weapon's charge math reads `gmg*` + auto-release on reaching max."
   Risk: getting the cadence right (the original fires the instant charge maxes, `fireDelay=0`). Pin with
   a tick-count test. Cosmetic `gmgMaster` HUD icon can be a simple flag.
2. **Beam render.** `setBeam` stretches/rotates a single bullet sprite to the caster→target line and
   spawns it AT the target (not travelling). The port's renderer supports rotation+scale (F3), but the
   "spawn at target, one-frame stretched explode" differs from the travelling-bullet model — risk of a
   visual mismatch. Acceptable first cut: a stretched explode at the target; refine if it looks wrong.
3. **Streaming release timing** (`chargePerUnit`/`fireDelay`): the number of bullets per cast = how much
   you charged ÷ chargePerUnit. Get the drain loop exact (drain BEFORE the <0 check, fireDelay counter
   reset each shot) or the stream length will be off by one. Unit-test the count.
4. **Music name→key mapping.** `#musicName` strings (`baroque_rock_v1`, `last_stand_v4`, …) must match
   `audio.index.music` keys from the F1 bundler. If the bundler keyed by a different name, add an alias
   table. Verify before wiring (don't assume).
5. **Magic-limiter scope.** The original limiter is room-scoped (`finish` restores 100). The port must
   reset it on room-leave/teardown, or a dimmed region leaks into the next room. Hook the room lifecycle.
6. **Mana-melee term for energyPunch.** `#magicMelee` melee adds a mana term in `calcCollisionVectMelee`
   (`* (strength + 1.5*manaCapacity)/1.5`). The port's melee uses `power*strength*MELEE_SCALE`; honor
   the `#magicMelee` mana term so energyPunch scales with mana (or accept the documented B2 melee
   calibration and note the deviation).
7. **Aura "damage 0" must NOT call takeHit.** The auras are `damageMultiplier:0` + `#takeFreeze`. Route
   them through the payload list (freeze only), not a 0-damage takeHit, so they read as a slowing field.
8. **Chatter cutscene availability.** If `#stonesN` cutscene scripts aren't bundled, the faithful
   fallback is the original's own "temporarily disabled inGame Scripts" state — spawn the stones as inert
   decorative sprites. Don't fabricate cutscenes.

---

## §h — Genuinely dead even in mr4Demo (proven against all 47 maps' object layers)

Method: parsed the `#objects` layer of **all 47** bundled maps (manifest `src/generated/maps.json` →
the copied `public/assets/maps/<id>.txt`), resolving each tile to its symbol via the objects tileset key.
This is the object-layer placement ground truth, not an assumption.

**NOT dead — every Phase-I mechanic is placed across multiple maps** (so "unreachable" was wrong):
- `energyBeamSpell` 4 maps, `energyPulseSpell` **13**, `gmg` 3, `teamOverride` 3, `energyPunch` 6;
- `magicLimit1/25/50/75` **7 maps each**; `musicBaroqueRock` 7, `musicBaroqueRockTechno` 9,
  `musicWoodsOfEvil` 8, `musicLastStand` 8, `musicElectronicMerlin` 2, `musicOff` 4;
- `fire` 4, `pitMonster` **12**, `snow/orc/quad/iceAura` 2 each, `undeadAura` 3;
- `stones1-5` 2 maps each; `dwarfTower` 8, `garTower` 7, `orcInvasion` 5, `undeadInvasion` 4;
- `berlinInGame` **27 maps**, `kingInGame` 13, `scarletInGame` 5, `amotonlinInGame` 4;
- `energyMines` (scroll) **14**, `energyMine` (deposited mine) 5.

**Genuinely dead (records exist, placed in ZERO of 47 maps) — build-for-completeness only, do NOT
prioritize:**
- **`stones6`, `stones7`, `stones8`, `stones9`, `stones10`** — `act_` records exist; never placed. The
  `objChatter` engine (C.5) covers them generically if ever reached, but they need no map work.

**Other symbols placed in OTHER maps but NOT mr4Demo** (in scope for full parity, out of mr4Demo's set —
flagged so they aren't missed): `musicOff`, `armySummonStones`, `energyMine` (player-deposited),
`monkGhost`, `caveBat`, `sumo`, `berlinTV`, `loreStone`, `kingStones`, `goblinRunnerStones`,
`friendlyGoblinArcher/Warrior/MageHut`, `hydra2`. Most resolve to records and ride the generic engine;
`ochreWizard`/`scw` have **no `act_` record** under that exact name (alias or typo in those maps — they
will null-spawn; verify the intended actor name if those maps are targeted). These are noted for a later
cross-map sweep, not Phase I.

**Conclusion:** the only thing genuinely dead even with mr4Demo's "place everything" map is
`stones6-10`. Everything else this phase builds is reachable and placed — repeatedly.
