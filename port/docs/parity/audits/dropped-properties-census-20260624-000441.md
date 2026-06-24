# Dropped Cast-Properties Census — 20260624-000441

**Audit lens:** AUDIT-CHARTER.md "blind spot" — properties parsed into config but read by **no** port
code. A dropped mechanic is invisible to per-actor/per-module audits because nothing references it.

**Method (regenerated, not trusted from a stale copy):**
1. Ground truth = the raw Lingo cast records in `casts/data/*.txt`. Enumerated every `#propertyName:` key
   across all 295 actor/team/binding/font records (scr_/tlk_ have separate grammars). Scripts:
   `scratchpad/cast_keys.js`, `scratchpad/readdrop.js`, `scratchpad/unread.js`.
2. Three buckets:
   - **COVERED** — in `data.json` AND read by some `src/**/*.ts` (excl. `src/generated`).
   - **READ-DROP** — survived into `data.json` but read by no src code.
   - **PARSE-DROP** — present in the Lingo cast but ABSENT from `data.json` (parser silently dropped it).
3. For each READ-DROP: classify FAITHFULLY-INERT vs DROPPED-MECHANIC, deriving "correct" from the cast,
   confirming the port lacks it, citing both trees `file:line`.

## Headline counts

```
cast-props (distinct #key:, excl header)  = 240
PARSE-DROP                                = 0     (parser is faithful — proven below)
READ-DROP (unread at exact casing)        = 94    (92 truly unread + 2 case-variants)
  of which FAITHFULLY-INERT               = 80
  of which DROPPED MECHANIC               = 14    (12 in the table + rotational + the minimapStatus
                                                   casing; rotational & casing are DROPPED-but-LOW,
                                                   written up in the "load-bearing leads" section)
```

## PARSE-DROP = 0 (the "doubly invisible" bucket is empty — proven)

The parser (`port/src/data/lingo.ts`) preserves **every** `#key: value` pair it parses, stripping only the
leading `#` and **keeping original case** (`lingo.ts:121` `k.slice(1)`). It never selectively skips a key;
an unrecognized value form makes the **whole record** throw, which `parse_data.ts:55-58` reports and
`exit(1)`s on. Empirical check (`scratchpad/cast_keys.js`): every `#key:` in `casts/data/*.txt`
(excl. scr_/tlk_) appears in `data.json` at the **same casing** — diff is empty in both directions.
`parse_data.ts` run: `parsed 295/295 Lingo data records, 0 failures`. So no key is parse-dropped.

> The `minimapStatus` vs `miniMapStatus` casing split is therefore **not** a parse bug — the parser
> faithfully preserves the cast's own inconsistent casing. The bug (if any) is at the READ layer (below).

---

## DROPPED MECHANICS — ranked by gameplay impact

| # | key | n | impact | cast (how it drives behavior) | port (what it does instead) | fix sketch |
|---|---|---|---|---|---|---|
| 1 | **walkAcceleration** | 2 | **MED** | `modMoveToLoc.txt:95` `pWalkAcceleration=params.walkAcceleration`; the live top-down move applies it as the per-tick accel (`modMoveToLoc.txt:319/483` `vectAdd(point(walkAccel*dir,0))`). Data: player **2**, monkGhost **0.3**. | `Movement` reads `cfg["accel"]` (`movement.ts:65`) — a key that does NOT exist in data.json — so every unit falls to the default `accel=1.4` (`movement.ts:64`). monkGhost ramps ~4.6× too fast (loses its floaty drift); player 1.4 vs 2. | In `Movement.init` read `cfg["walkAcceleration"]` into `this.accel`. Forward it in `archetypes.ts` player/enemy cfg. Nav-mode 6/2 ratio already modeled as `NAV_SPEED_MULT`, so only the base accel needs the rename. |
| 2 | **armyMembers** | 1 | **MED** | `act_player` = `[#warrior,#archer,#monk,#dwarf,#kingInGame]`. `modAutoSummon.summonArmy` (`modAutoSummon.txt:45-99`) walks this FIXED priority order, allocates `slotsPerUnit` per type, and under slot pressure **drops the last 2 types (kings & dwarves: `membersNum-2`)**. | `PlayerControl.summonArmy` (`control.ts:134-146`) iterates `reserveTypes(team)` (whatever is banked, **unordered**) and fields round-robin to capacity — no priority, no drop-top-2. Under capacity pressure the army composition is wrong (may field kings while dropping warriors). | Drive `summonArmy` from the static `armyMembers` roster order; apply the per-type slot quota + drop-top-2-under-pressure rule. Read `armyMembers` from `act_player` data. |
| 3 | **chargeLoc** | 5 | **MED** | `objCharacter.txt:113-122` `calcChargeLoc` anchors the charge orb at the CHARACTER's per-actor `pChargeLoc` (default point(0,-8), facing-flipped). Casters set -8…-16. | The orb is positioned at the generic `muzzle()` = the WEAPON's `collisionLoc` (or fallback `(0,-6)`) — `control.ts:39-42,255,316`; per-actor `chargeLoc` is never read. | Add `chargeLoc` to character config; anchor the charge orb at `caster + chargeLoc` (facing-flipped) instead of `muzzle()`. |
| 4 | **chargeOffsetSide** | 6 | **MED** | `objCharacter.txt:9,113-` `#side` puts the orb at the flank (facing-flipped x), `#top` over the head. greyGhost = `#side` (chargeLoc x:8). | `SpellActor` hardcodes the top/`muzzle` placement (`spellActor.ts`); the side branch is unreachable. So greyGhost's flank-charge renders over its head. | Read `chargeOffsetSide` from act data into `SpellActor` and honor the `#side` flank branch. |
| 5 | **maxEnergy** | 3 | **LOW-MED** | `modEnergy.txt:45-48` when `maxEnergy≠#auto`, `pMaxEnergy=1500` while energy starts 500/1000/1500; health bar = `VarPercent(energy,[0,maxEnergy])` (`:112`) and the head can be **healed up to 1500** (`:88`). | `Energy.init` hardcodes `this.max = this.energy` (`combat.ts:23`) — the `#auto` case only. hydra1/hydra2 show a FULL bar instead of 33%/67% and can never heal/grow past their start energy. (Hit-count to kill unchanged → gameplay LOW.) | In `Energy.init`, when `cfg["maxEnergy"]` is numeric use it for `this.max`; keep `max=energy` only for `#auto`/unset. |
| 6 | **chargeVolumeMap** | 16 | **LOW** | `objSpell.txt` `VarMapRange(charge, map.charge, map.vol)` ramps spell release/explode SFX volume with charge level (a soft tap vs a loud full cast). | Release/explode play at fixed gains (`control.ts`, `projectile.ts` mine detonate 999999 path; audio uses a flat volume). | Compute `VarMapRange(charge, chargeVolumeMap.charge, chargeVolumeMap.vol)/255` and pass as the play() vol. |
| 7 | **speechColor** | 33 | **LOW** | `modThespian.txt:78,121` per-actor cutscene speech-bubble text colour (Merlin blue, scarlet wizard red, default white). | The cutscene/bubble text is drawn a fixed colour (`cutscenePlayer.ts` / `thespian.ts`); `speechColor` not threaded in. | Thread the speaking actor's `speechColor` into the bubble-text fill. Cutscene-cosmetic only. |
| 8 | **gmgChargeLoc** | 1 | **LOW** | `objCharacter.txt:246` swaps the charge anchor to `pGmgChargeLoc` (player point(10,-1)) while holding the Golden Machine Gun. | `charge.ts` swaps the charge MAGNITUDE for gmg but not the orb POSITION. | When `gmgOn`, swap the charge-orb anchor offset to `gmgChargeLoc`. |
| 9 | **splashGraveOn** | 2 | **LOW** | `modSplashDamage.txt:111,149` `drawSplashGrave` blits the `#grave`/crack image at the predicted landing loc **while the bullet is still airborne** (cracks/towerAxe AoE telegraph). | No pre-landing decal in the port's splash path. | In the splash-bullet flight path, when the actor has `splashGraveOn`, blit its `#grave` member at the target loc during flight. |
| 10 | **buildRateInc** | 2 | **LOW** | `modBuilder.txt:269` `pBuildRate += pBuildRateInc` on `#levelUp` (dwarf/goblinBuilder build faster as they level; inc 50 default). | `CpuAI.levelUp` (`control.ts:554`) grows only `strength`; `buildRate` (`control.ts:525`) is static. | In the builder's `levelUp`, add `this.buildRate += cfg["buildRateInc"]`. |
| 11 | **pathFindingStallTime** | 2 | **LOW** | `modPathFinding.txt:36` `pStallCounter.tim[2]=params.pathFindingStallTime` — frames of zero-movement before the pather gives up & re-routes. skeletonArcher/Thrower set **30**. | Port hardcodes `STALL_TIME=5` (`pathFinding.ts:21`, comment cites the very property) → these skeletons abandon re-pathing 6× sooner, jittering at obstacles. | Forward per-actor `pathFindingStallTime` into `PathFinding` instead of the const 5. |
| 12 | **propCarryLoc** | 1 | **LOW** | `modProp.txt` carried-prop offset = `pPropCarryLoc` (ochreHydra point(10,-10), facing-flipped). | Port hardcodes a `carryOffset≈{±14,-10}` (`thespian.ts`). ~4px, cutscene-only. | Read `propCarryLoc` from act data into the carried-prop offset in `thespian.ts`. |

### Confirmed load-bearing LEADS — verdicts (the 5 the charter flagged)

- **`weight` (70×) → FAITHFULLY-INERT.** The lead hypothesized weight scales knockback/reel. It does NOT.
  In the cast, `params.weight → pMoveXY.setWeight → pWeight`, and `pWeight` feeds ONLY gravity:
  `GravWeightSpeed = pGravity * pWeight * gGameSpeed` (`objMoveXY.txt:175`). `pGravity` initializes to 0
  (`:52`) and the **only** `setGravity(1)` is commented out in `initGameChar` (`:75`, gated on the disabled
  `gGameView=#sideOn`); the only live `setGravity` is `setGravity(0)` in the title `blastOff` cosmetic
  (`objScreen.txt:202`). So `GravWeightSpeed = 0·weight = 0` for every game object — this is a top-down game.
  Knockback/reel is driven by `pInertia` + `pFrictionReel` (the comment at `objGameObject.txt:20` literally
  reads *"pInertia — used instead of weight to dampen effect of getting hit"*), both of which the port DOES
  read (`movement.ts:69,74`). **Reproduction** (`tools/_audit_prop_weight.ts`): two enemies reel by very
  different amounts (skeletonArcher 22.5px vs boulderMonster 6.2px) — but that difference comes from
  frictionReel (40 vs 10) + inertia, NOT weight (both have undefined cast weight). The port is correct.

- **`rotational` (21×) → DROPPED but LOW (over-rotation).** `modRotational` (`modRotational.txt`) rotates a
  bullet sprite to its travel angle: `false`=never, `#once`=set from initial vect then frozen, `true`=track
  every frame. `act_bullet` base default `#once`. The port (`main.ts:725,738,752`) rotates **every** flying
  bullet to its current velocity (`rotate=true` hardcoded), reading no per-actor flag. Divergence: the
  `rotational:false` set (bomb, energyBeam, energyMine, fire, fangBunnyBabyBullet, shuriken, skeletonHead,
  smoke, towerAxe, the auras) should draw a FIXED orientation but the port rotates them. For straight-flying
  bullets `#once` and `true` are visually identical, so the only real artifact is spinning a sprite that
  should be upright (e.g. a shuriken/bomb art whose strip already animates rotation). LOW. Fix: read
  `rotational` per actor and pass `rotate = (rotational !== false)`; for `#once` freeze after frame 0.

- **`stallSpeed` (36×, characters) → FAITHFULLY-INERT for characters; minor bullet-default divergence.**
  For CHARACTERS, `stallSpeed` is the speed below which `objMoveXY.stallUpdate` (`:380`) counts the unit as
  "come to rest" (sets `pFin`/`pStallCount`), gating move-to-target completion and hit-recovery. The port
  does not model a character "stall/pFin" state machine — arrival is distance-gated by `reach`
  (`control.ts:740`) and recovery is timer/friction-driven — so the character `stallSpeed` has no port slot
  to land in; the AI behaves equivalently without it. For BULLETS, the cast's `objBullet` overrides
  `stallSpeed` to `point(2,2)` (in script, not data); the port uses `STALL_SPEED=0.2` (`projectile.ts:25`),
  so port bullets coast slightly farther before a friction-stall detonation. Minor (LOW). The 36 *data*
  records are all characters; the bullet override isn't in data at all.

- **`killAll` (4×) → FAITHFULLY-INERT (debug cheat).** It lives in the `bnd_*` keyboard-binding records
  (key code 40), a developer cheat: `objAiPlayer.txt:126 → gameMaster.cheat(#killAll) → killAll →
  teamMaster.killEnemyTeams(#aldevar)` (`gameMaster.txt:161`). Not a room-clear/win condition — that is
  handled separately (`objRoom` clear logic, reproduced by the port's `rooms.ts` cleared/infested sets). The
  port hardcodes its own keymap (`input.ts`) and binds no cheats. Inert.

- **`minimapStatus` vs `miniMapStatus` casing → LATENT bug, currently INERT.** In Lingo these are the SAME
  symbol (case-insensitive), so the original reads both via `actorMaster.getMiniMapStatusForSymbol →
  data.miniMapStatus` (`actorMaster.txt:115`). In the port, JSON keys are case-sensitive; the only per-actor
  reader is `rooms.ts:170` `d["miniMapStatus"] === "#inf"` (camelCase) to detect room hostiles. **No
  lowercase-`minimapStatus` record has value `#inf`** — the 32 lowercase records are all `#spe` collectables
  (19), `#clr` friendlies/system (11), or `#fre` (2: dwarf/goblinBuilder). So the casing split changes
  nothing TODAY. Two latent risks: (a) if any future/edited actor uses lowercase `minimapStatus:#inf` it is
  silently invisible to enemy-detection; (b) the port does NOT implement the full per-actor room-status
  aggregation (`getMiniMapStatusFromRoomState` ranks actors along `[#clr,#inf,#fre,#spe]`,
  `objRoom.txt`) — it derives room colour from room-level map data + an infested set only, so a room holding
  a `#spe`/`#fre` actor won't tint accordingly. Fix: normalize the key case at parse OR read both casings in
  `rooms.ts`; separately, implement the actor-status→room-status max-progression if that minimap nuance is
  wanted. LOW.

---

## FAITHFULLY-INERT — with the one-line reason

### Read via a different mechanism / renamed-or-derived field (false positives of the static scan)

| key | n | reason (cast → port) |
|---|---|---|
| **summon-payload member names** (`summonArcher/Warrior/Orc/Boulder/Golem`, `warrior/monk/dwarf/kingInGame`, `goblinArcher/bowOrc/swordOrc/mageOrc`, `scWarrior/scArcher/scMonk`, `skelitonHead/Arm/TorsoTank/Sword/LowerLeg/Upper`, `skeletonWarrior/Archer/Thrower`, `greyGhost/undeadDragon/necromancer/darkMage`, `skelitonLord`) | ~30 | These live under each summon actor's `#multistage` proplist (unit→chargeRequired). Cast reads them dynamically (`modSpellMultistage.selectPayload`); the port reads the SAME proplist dynamically via `Object.entries` in `normMultistage` (`weapon.ts:97-103`) → `selectTier` (`summon.ts:43`). Flagged "unread" only because the static scan looks for literal key strings, not `Object.entries`. COVERED. |
| `idealAttackLoc` | 13 | Melee standoff = `targetLoc + attack.idealAttackLoc`. For ALL 13 records `idealAttackLoc.x == collisionLoc.x` (blackAxe both 70, goblinSword both 15, …), and the port uses `collisionLoc.x` as the melee standoff radius (`control.ts:735`). The standoff DISTANCE is reproduced. Only the small y-component (hydra −5, orcSword +6) and the 2D directional-mirror are flattened to a scalar radius — visually negligible. (Note: a peer agent mis-read blackAxe as differing; the data shows it identical.) |
| `collideWithTarget` | 9 | `objBullet.txt:96` skips target-collision when false (auras/mines). The port routes those actors to a dedicated `Mine` component (`mine.ts`, `objTypes.ts` MineArchetype) that does proximity damage and never collide-and-dies — the flag's behavior is structural. |
| `layerZ` | 5 | Cast uses discrete layer-band globals; the port uses a y-based painter sort (`renderer.ts:68`) PLUS a separate later draw pass for bullets (always-on-top) — reproducing the coarse band order (bullets > actors). Player-band nuance is the only minor diff (LOW). |
| `category` | 23 | Team `#category` is reproduced by the friends/hates relation lists (`teams.ts`), which the port reads; category itself isn't needed for targeting. |
| `lifeCount` | 1 | act_experienceStar #lifeCount 30 reproduced as a const `STAR_LIFE=30` (`effects.ts`). |
| `pathfinding` (flag) | 1 | Port gives every CpuAI a PathFinding instance unconditionally; the enable flag is moot. |
| `walkType` | 1 | `#anyDirSpeed` is the port's default omnidirectional movement; no per-actor branch needed. |
| `createOnSolid` | 5 | Cast bypasses a spawn-on-solid rejection; the port has NO spawn-collision rejection, so the bypass flag is moot. |
| `initLoc`/`initVect`/`masterPrg`/`startOffset`/`initFaceDir` | 1/1/1/23/23 | Base-template spawn defaults: position/facing are set by the port's tile-center spawn (`rooms.ts:420` `c*t+t/2`, equivalent to the cast's startLoc+startOffset) and facing init; `masterPrg` is a Lingo dispatch artifact. |

### Dead in the ORIGINAL too (set in data, read by no cast code — or a typo that misses the reader)

| key | n | reason |
|---|---|---|
| `weaponTechniqueInc` | 5 | `modWeaponTechnique.txt:30` HARDCODES `pWeaponTechniqueInc=2` and never reads `params.weaponTechniqueInc`; data values (3) are dead in Lingo. Port matches with const `INC=2` (`weaponTechnique.ts:25`). |
| `strenghtIncLevel` | 2 | Cast TYPO ('strenght'). The reader uses the correct `params.strengthIncLevel` (`modCharacterAttackProperties.txt:51`), so archer/scArcher's intended 0.5 never applies → default 0.1 in the ORIGINAL. Port reads the correct spelling too (`control.ts:511`) and defaults to 0.1 — faithfully replicates the original-game bug. |
| `dammageMultiplier` | 2 | Cast TYPO ('dammage'). Reader uses the correct `damageMultiplier` (`modEnergy.txt`); the typo'd records never reach it → multiplier stays 1 in the original. Faithful. |
| `enemyGoodShootingDistance` | 2 | `objAiCPUSpellCaster` assigns `pEnemyGoodShootingDistance` but never reads it (both records = default 150). AI uses buffer/safe distances the port reproduces (ENEMY_SAFE). |
| `overlapToLeaveRoom` | 2 | `objPlayerCharacter.txt:38` assigns `pOverlapToLeaveRoom` but no handler ever reads it. Dead. |
| `immuneToAttack` | 1 | Only reference (`teamMaster.txt:1061`) is in a COMMENTED-OUT block. Chatters are protected by their empty `#hates`/`#friends` lists instead (reproduced by the port's team relations). |
| `jumpPower` | 1 | `#jump` mode exists (`objCharacter`) but every `doJump()` caller is commented out — a side-scroller vestige, dead in this top-down game. |
| `throwType` | 2 | No cast code reads `throwType` (set in data only). |
| `accurate` | 1 | No `pAccurate`/`accurate` reader; `GeomMoveVectorAccurate` is chosen elsewhere, not via this flag. |
| `pathFindingTime` | 2 | Cast recompute interval; the port's beeline→scenic pather re-evaluates each tick / on stall, no fixed timer — equivalent. |
| `minCollisionSpeed` | 1 | Feeds Merlin's "hair-as-weapon" collision (`objGameObject.txt:262 checkCollisionsWithHair`); the port has no hair-physics subsystem at all, so the threshold is moot (only relevant if hair is ever ported). |
| `stallSpeedIncLevel` | 6 | Per-level growth of the character `stallSpeed` recover-from-hit threshold (`modCharacterAttackProperties.txt:206`). The port has no character stall/pFin mechanic for it to grow (see the `stallSpeed` lead above), so the increment has nothing to apply to. |

### Cosmetic — SFX volumes & text colours reproduced at fixed/near-default values

| key | n | reason |
|---|---|---|
| `collectSound` | 22 | Powerup pickup SFX; the port plays a pickup sound (`audio.ts`/`potionMaster.ts`) — the per-actor sound NAME is reproduced where it matters; this is the volume/name flag, not a mechanic. |
| `explodeVolume`/`dieVolume`/`takeHitSoundVolume` | 3/2/1 | Per-actor SFX volumes; the port plays these effects at a fixed gain near the cast default (150/255). Cosmetic audio-mix only. |
| `counterColour` | 5 | Powerup-counter text colour; the port draws the counters a fixed colour. Cosmetic. |
| `explodeEvents` | 17 | The LIST of events that trigger a bullet's explosion (`#bulletArrivedAtTargetLoc`/`Collided`/`Landed`). The port detonates splash/explode bullets on the same triggers (target hit, land-stall, maxLife) in `projectile.ts`; the explicit event list is the cast's wiring, reproduced behaviorally. |
| `thekey`/`charSize` | 4/4 | Font glyph-key map + cell size in `fnt_*_properties`; the port's bitmap-font loader reads its own asset metadata (`assets.ts`, `bitmapFont.ts`). Editor/asset config. |

### Keybinding config — the port hardcodes its own keymap (intentional rebinds)

`weaponSelector, spell1..spell9, invincibility, killAll, testHit` (and the rest of the `bnd_*`/`kyd_*`
records: up/down/left/right/wizard/wizardSelector/escape/medikit/gmg/army) — n=4-5 each. The port hardcodes
its keymap in `input.ts` with deliberate rebinds (e.g. weaponSelector→E because Q is reused for
wizard-summon; spells→number keys), and binds no debug cheats. The data keybinding records are not loaded.
FAITHFULLY-INERT (input-layer substitution).

---

## Probe artifacts (gitignored `tools/_*`)

- `tools/_audit_prop_weight.ts` — reproduces that two enemies of differing reel behave per frictionReel/
  inertia (NOT weight); both have undefined cast weight. Run: `npx tsx tools/_audit_prop_weight.ts`.

## Spot-check note (charter compliance)

Every DROPPED verdict here cites the cast mechanic + the port's substitute `file:line`. The load-bearing
leads were each driven from the cast (gravity math for weight; modRotational for rotational; stallUpdate/pFin
for stallSpeed; getMiniMapStatusFromRoomState for the casing). The reel "two units differ" repro confirms the
correct driver is frictionReel/inertia, closing the weight lead as inert.
