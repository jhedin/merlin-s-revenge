# Merlin's Revenge — Parity Tracker

**Goal:** 100% behavioral parity between the TypeScript port (`port/`) and the original
Macromedia Director/Shockwave game (Lingo in `casts/`).

**Method (the loop):** each iteration — (1) **audit** a subsystem against the original, (2) write a
**plan**, (3) **implement** it faithfully and verify (`tsc` + `vitest` + in-browser smoke), then PR.
This tracker is the running backlog; update the status table + log each iteration.

> Iteration 0 (this doc) is the full-game audit. Five domain audits live alongside it:
> [`01-ai-combat`](01-ai-combat.md) · [`02-actors-bosses-dwellings`](02-actors-bosses-dwellings.md) ·
> [`03-spells-weapons`](03-spells-weapons.md) · [`04-player-systems`](04-player-systems.md) ·
> [`05-world-render-shell`](05-world-render-shell.md). Read those for the per-feature tables.

---

## Where we are: engine + slice complete; mr4Demo content (Phase I) in progress

Started at ~20%. Phases A–H below are implemented and verified (tsc-clean, room-1 no-regression gate held
at every step). Phase I Pass A (I1–I6 + I9) is done — **263 tests** (+22). The port faithfully runs the
combat/AI/weapon engine, the full 47-map asset pipeline, the spell roster, save/army/medikit, the boss
reincarnation cascade, the complete game shell, collision/render fidelity, and the mr4Demo region/mine/
chatter objType mechanics. Pass B (I7 GMG, I8 beams) remains.

> **CORRECTION (don't repeat this mistake):** an earlier wrap-up claimed the backlog was "complete" and
> that GMG, the magic limiter, beams, reservations, team-override, etc. were "out of scope / unreachable."
> **That was wrong** — `maps/works/mr4Demo.txt` (a 225-room map) PLACES all of them. The reachability was
> asserted from the audit agents' scans without checking the owner's map. `tools/classify_placed.ts` now
> prints exactly what `mr4Demo` places, bucketed by objType — **always verify reachability against the
> actual map data, never assert it.** The remaining placed-but-inert mechanics are tracked as **Phase I**.

| Domain | Coverage | One-line state |
|---|---|---|
| AI & combat engine | ~85% | **A1** vector `takeHit` (damage == knockback) + **B1** `teamMaster`/`findTarget`/`CpuAI` committed-target FSM (replaced the 4-branch stub) + **B2** `WeaponManager`/`Counter` cooldowns/data-driven charge. Remaining: bullet-dodge kiting, ghost possession, hair/builder AIs (unreachable) |
| Spells / weapons / projectiles | ~45% | B2 weapon manager + C charged blasts (cBlast/darkBlast/arctic/heal), splash/`#explode` (energyPulse/thunder/freeze/towerAxe), takeFreeze/takeHeal payload-lists, summons (army/monster), dwarfTower. Beams/fireBullets-streaming/GMG/reservations deferred |
| Actors / bosses / dwellings | ~26% | All 263 records parse (stats resolve); gaps are art + AI wiring + per-actor behavior; bosses ~55% (E1 reincarnation cascade ☑) |
| Player / progression / masters | ~50% | Progression math faithful; **G save tree v2** (whole current-room + cleared flags + player + potion/army masters, locator-based target restore); **army reserve** (teleport-to-reserve, re-field at level); **real medikit** stockpile + potion counter; 5 of 39 masters |
| World / render / pipeline / shell | ~75% | Asset pipeline complete (F1 ☑); **collision tile-types complete (F2 ☑):** per-edge `EdgeGrid` (solid/platform/ceiling/wallLeft/wallRight + merge + corners + directional events), `#solid`-only byte-identical/golden-locked; **render/anim fidelity (F3 ☑):** real `modColourTransform` tint palette (cached offscreen pass), per-frame anim `dela`+gGameSpeed+data loop flag, `#foregroundPassive` over-actors, per-sprite alpha, 5-state minimap. **Shell complete (H ☑):** Thespian cutscene engine over real actors, scene FSM + menus, death->wasted->reload, endRoom win + per-room pState (save v3) |

The **data** pipeline is genuinely complete (all 263 actors → `data.json`). Almost everything missing is
*behavior and assets*, not data — consistent with "content is data, not code."

---

## THE KEYSTONE — `damage == knockback` (do first; unblocks the most)

Three independent audits (combat, spells, player-systems) **and** the original `PORTING_PLAN.md` all name
the same root problem: the port bakes damage as a **scalar at the call site** (`dmgPerUnit*charge`,
`power*2`) and applies **no knockback**. The original's load-bearing semantic is:

> A weapon's `#attack.power` is a **`point`**. The collision computes a vector; its magnitude
> (`(|vx|+|vy|)·damageMultiplier`) **is** the damage, and the same vector is applied as **knockback
> velocity** (damped by `inertia`) *before* the energy hit. Reel/recoil duration is stall-based off that
> knockback; freeze and splash read the same vector.

Until `takeHit` carries a vector and weapons flow their real data-driven `#attack` (weapon→char→bullet→
victim), every weapon's relative lethality is a guess, and reel/recoil/freeze/splash are impossible to do
faithfully. Fixing it converts **~18 bullet actors + all melee weapons** from PARTIAL→FAITHFUL with no
per-actor code. **This is iteration 1.**

---

## Dependency-ordered backlog

Status: ☐ not started · ◐ in progress · ☑ done

### Phase A — Combat keystone
- ☑ **A1. `damage == knockback` (collision vector).** `takeHit(vx,vy,attacker,mult)`; damage =
  `(|vx|+|vy|)·mult` (modEnergy); the same vector applied as knockback (objGameObject), inertia-damped, as
  a separate decaying impulse; melee/bullet build aimed vectors via `aimedVect`. Damage numbers preserved
  (no balance regression); inertia damps knockback only for now — faithful damage-damping pairs with real
  data attack powers under B2. See [`plans/A1-damage-knockback.md`](plans/A1-damage-knockback.md). *(01 #1, 03 #1)*

### Phase B — Targeting & AI engine
- ☑ **B1. `teamMaster` + `findTarget` + `objAiCPU` target FSM.** Data allegiance (`tem_*`), unit-map
  broad-phase, target criteria/roles, committed `#target` relationships, `impactMeleeAttack` loop. Unlocks
  every CPU enemy/ally/dwelling. Plan: [`plans/B1-targeting-ai.md`](plans/B1-targeting-ai.md). *(01 #2)*
  - ☑ **2a substrate** — `UnitMap` broad-phase, `TeamMaster` (data allegiance/cull/roster/`#leaveGame`
    pub-sub), `findTarget`, `impactMeleeAttack`, `Targeting` component. Pure + unit-tested (11 tests).
  - ☑ **2b brain swap** — `EnemyAI`→`CpuAI` FSM (committed target, 30-frame retarget throttle,
    dazed-on-reel via `characterModeChanged`, `attackFin` re-acquire, bomber un-suicided), PlayerControl
    melee/aim via `TeamMaster`, archetype/context wiring + per-tick `UnitMap`/roster rebuild
    (`combatTick.ts`). Room 1 still clears; +4 CpuAI FSM tests (90 total).
- ☑ **B2. `modWeaponManager` + data-driven charge/cooldown.** Retired hardcoded `SPELL`/`PUNCH`/`hasSword`/
  `hasSpell`; `WeaponManager` component (`pWeapons`→`AttackData`, per-weapon `Counter` cooldowns inc=agility/
  dexterity/manaRegeneration), `engine/counter.ts`, `charge.ts` (chargeMax/Start/Speed from data×mana),
  `resolveAttack`. Pickups `addWeapon` instead of flipping booleans; `getHasSpell`=owns a magic weapon.
  Player keeps dual-mode auto-melee + hold-charge (port adaptation, plan §f.6); CpuAI gates fire on the
  per-weapon counter. `damageMultiplier` flows from `#attack` into `takeHit.mult` (player melee). Plan:
  [`plans/B2-weapon-manager.md`](plans/B2-weapon-manager.md). *(01 #3, 03 #2)*

### Phase C — Spell / weapon breadth (rides on A+B)
- ☑ **C1. Charged blasts (data wiring).** `cBlast`/`darkBlast`/`cBlastAi` + the bolt-halves of
  `arcticBlast`/`healBlast` are `#magic` weapons differing from `energyBlast` only in `#attack` numbers —
  FREE on the B2 engine. Added their `addWeapon` pickup rows (`pickup.ts` + `rooms.ts`); no new code.
  GMG toggle + magic limiter stay deferred (§g). Plan: [`plans/C-spell-roster.md`](plans/C-spell-roster.md). *(03 #2)*
- ☑ **C2. `SplashDamage` + `#explode` + status payloads.** `impactAreaAttack` factored out of
  `impactMeleeAttack` (the team-scoped disc search) and reused for splash; `splash.ts` resolves
  `#explode` (radius=explodeCharge/2) + `#splashDamageOn` (radius=power) area hits through the SAME
  `(|vx|+|vy|)·mult` A1 vector scale (no separate formula — falloff shape + centre-lethality pinned by
  tests). `CallPayloadFunction` port (`applyPayload`, sym|LIST). `Freeze.takeFreeze(vx,vy,…)` =
  `(|vx|+|vy|)·freezeMultiplier·4`, accumulate, 0.5× speed, teal. `Energy.takeHeal(vx,vy)` =
  `(|vx|+|vy|)·2` + gold glow. Unlocks `energyPulse`/`thunderBlast`/`freezeBlast`/`towerAxe`/`arcticBlast`
  (freeze)/`healBlast` + `dwarfTower` (static ranged CPU firing splash). *(03 #3)*
- ☑ **C3. Summons.** `selectTier(charge, multistage)` → `summonUnit` spawns a fresh default-level unit via
  the existing `spawnUnit`/`spawnAlly` path (`createUnit`'s newActor, no reserve), replacing the ad-hoc
  `E`-key summon. `randomSummon` charge wobble in `charge.ts`. armySummon/monsterSummon faithful;
  skeleton/goblin/undead/sc summons build-for-completeness (dead content, unit-tested). Reservations /
  army-reserve persistence / spell icons stay G2 (§g). *(03)*

### Phase D — Content breadth (art + wiring; gated on F1)
- ☑ **D1. Per-enemy sprite sheets + `spriteCharOr` wiring** — **free via F1**: bundling all 171 chars
  means `spriteCharOr` now resolves every shipped enemy to its own sprite (the lone art-less actor,
  `goblinHero`, aliases to `goblinWarrior`). *(02 #1)*
- ☑ **D2. Dwelling fidelity** — emptied dwelling self-destructs (`noMoreResidents→startDeath`, leaves a
  grave), residents emerge at a small random level (`setStartingLevel`), real `#totalResidents` (dropped
  the `min(12)` clamp; shipped 5–12 so a no-op, the concurrent `aliveCap` still guards floods). *(02 #2)*

### Phase E — Bosses
- ☑ **E1. `modReincarnate` component → skelitonLord cascade** (Lord→3→more, 8 actors); also unlocks the
  17 other reincarnating actors (hydras, golems, eggs, monk, sc-units). One generic data-driven
  `Reincarnate` component: on a killed-in-action death it spawns each non-`#none` `#reincarnateAs` entry
  at the corpse loc (fire-once latch, depth guard); team/level from each child's own data; `#minEnergy`
  multistage threshold + `#reelProof` honored. `berlin` is a **cutscene** lead, not an arena boss (§g).
  *(02 #3)*

### Phase F — World / render / pipeline
- ☑ **F1. Complete the asset pipeline** — all 10 tilesets (per-tileset tile size, unique-prefix match) +
  all 171 anim chars (556 anims; `seperateMembers` + per-frame `reg`/`dela`) + all 47 maps (`maps.json` +
  `loadMap(id)` load-any-map, `?map=<id>` picker) + vocabulary-driven SFX. Lazy per-map loading
  (`ensureMapAssets`) keeps first paint fast; `tilePx` resolved per-map. **Atlas baking descoped** (no
  image lib in the environment, `public/assets/` build-generated — frames stay individual PNGs, renderer
  unchanged). The lever for "load whatever the data ships." Gates D1. *(05 #1)*
- ☑ **F2. Collision tile-type breadth** — `tlk.tileTypeNums` + a derived `EdgeGrid` (4-bit edge mask +
  corner byte per cell): `#solid`/`#platform`(one-way top)/`#ceiling`/`#wallLeft`/`#wallRight`, per-edge
  merge (facing solid faces cancel, except bottom-over-platform), anti-diagonal corner detection, and a
  directional collision **event set** (`collisionWallLeft/Right/Ceiling/Platform/NoPlatform`) dispatched
  as chain messages by `Movement`. The **`#solid`-only path stays byte-identical** (the original swept-AABB
  resolver, gated by `hasTypedTiles`) so `collision_golden`/`world` pass UNCHANGED — none of the 47 maps
  ship non-solid active tiles (all `#solid`/`#none`), so room-1 is unaffected. Magic-rect ported literally
  (collapses to the box's 4 corner cells at the port's world origin). +14 golden tests. *(05 #2)*
- ☑ **F3. Render/anim fidelity** — `modColourTransform` palette as a `ColourTransform` component
  (glowRed/glowTeal/glowGold/glowRedAndTeal/flickWhite + chained fadeGoldBlack/fadeBlack, ping-pong, speed
  tween) + a renderer **offscreen source-atop tint pass cached by quantized (image, colour, strength)** —
  no per-frame getImageData; triggers wired in `Energy` (red-on-low-health re-armed on `colourTransformFin`,
  gold-on-heal, stopGlowRed), `Hurt` (flickWhite, retiring the binary flash), `Freeze` (teal). Per-frame
  anim `dela` + `gGameSpeed` + **data-driven loop flag** (retired the hard-coded `ONE_SHOT` set; recorded
  in `assets.json`). `#foregroundPassive` drawn OVER actors. Per-sprite `alpha`. **5-state minimap**
  (`#cur`/`#clr`/`#inf` live + data `#fre`/`#spe`) + distance blend. +15 structural tests. *(05)*

### Phase G — Systems & persistence
- ☑ **G1. Full save/load tree** — save v2 cascades `map → rooms[] (cleared flags) → current-room
  objects[]` + player chain + masters. Every actor re-spawns from its `getActorType` symbol + restored
  chain via a generic `serializeActor`/`respawnActor` (`entities/actorSerial.ts`, shared `spawnFromSymbol`
  routing). **G1c:** committed `#target`s are saved as a positional locator `{team,role,loc}` (NEVER an
  entity id) and re-acquired by `teamMaster.restoreTarget` in a deferred phase-2 pass after the batch
  respawns — closes B1's deferred committed-target-through-save. `SAVE_VERSION=2` rejects (no migrate) old
  blobs. Option A (current room + cleared set); per-room `pState` for non-current rooms is H3. *(04 #1)*
- ☑ **G2. `armyMaster` + reserve persistence** — `ArmyMaster` singleton: a SUMMONED ally (teleportable
  flag, set by `spawnAlly`) teleports to the reserve at its level on room-leave (`teleportOut`) and
  re-fields at the next room (`createUnit`/`lookupArmyDetails` picks the highest level, rebuilds stats via
  `forceLevelUp` growth, `restoreUnitToCombat` consumes it). `pReserveArmy` (per team→typ) persists in the
  save. Tile-spawned room allies are NOT teleportable (stay with their room). *(04 #2)*
- ☑ **G3. Real medikit stockpile + `potionMaster` counter** — `Medikit` component (`modMedikit`) on the
  player: collecting BANKS a kit, gradual +1/5-frame heal up to max, `nextMedikit` refill, save slice.
  `PotionMaster` per-type "potions drunk" tally + save. HUD draw is agent 5 (queries exposed). *(04 #3)*

### Phase H — Shell & flow
- ☑ **H1. Cutscene engine over real actors** — `Thespian` (`scenes/thespian.ts`) collapses cutSceneMaster +
  modThespian + objScriptPerformer + objScript into ONE runner that drives REAL spawned entities through
  the gameplay `Movement`/`Anim` (walk/stand/face/teleport/wasted) — a cutscene character IS a live Entity,
  not a draw-frame. Faithful `interpretLineCommand`/`interpretLineArgs` (point/rgb/symbol/text/sound; `:`
  ->speakLine; word2-command). Sync verbs fall through same tick; async (`speakLine`/`wait`/`lights`/`fade`)
  set a frame gate (`displayTime = 50 + chars·1.4`, `delay 12`; `wait N`; fade window) — dialogue
  auto-advances, no key. `#key` interpolation at display time. `cutscenePlayer.ts` is now a thin host.
  Gates H2's game-over/complete/wasted. *(05 #3)*
- ☑ **H2. Scene FSM + `objMenu` menus + death flow.** `SceneManager` (`scenes/sceneManager.ts`) mirrors
  movieMaster/screenMaster/gameMaster: `goScreen(sym, action)`, overlay `screenOn`/`backAScreen`, and the
  load-bearing `cutSceneFinished(scene)` dispatch (intro->game+startGame; **wasted->game+#loadGame** (reload
  the save, NOT a fresh run); complete->victory). `objMenu` is data-driven with **shadowed** items (Save
  greys while a cutscene plays). **Faithful death:** player `#die` (after the die anim) ->
  `modExtraLives.attemptRespawn` (`components/extraLives.ts` — lives>0 -> in-place respawn at the recorded
  point, energy restored, lives--) ELSE `gameMaster.gameOver` -> the **wasted cutscene** (the REAL Merlin
  bound by alias, `goWastedMode` blend+squash via `components/wasted.ts`) -> reload the save. Fallback to
  title when no save/wasted script.
- ☑ **H3. `#endRoom` win + per-room state restore.** Two win triggers (`RoomManager.markCleared`): clear-all
  (`isMapClear`) OR reach+clear the designated `#endRoom` (`isEndRoom`, parsed from the map). A `pState:
  Map<roomNum, ActorSave[]>` snapshots a room's recordable actors on leave (excluding reserve-banked allies,
  G2) and restores them on re-entry (reusing G1's `serializeActor`/`respawnActor`) — a half-fought room comes
  back exactly as you left it. The save tree extends to the **full per-room pState map** (superseding G1's
  current-room-only Option-A); `SAVE_VERSION` bumped to **3** with the same graceful-reject gate.

### Phase I — mr4Demo placed content (reopened — was wrongly called out-of-scope)
`maps/works/mr4Demo.txt` places these; today they spawn inert (null/SKIP_SPAWN) — see `tools/classify_placed.ts`.
**Pass A done (I1–I6 + I9); Pass B (I7–I8) deferred.**
- ☑ **I1. `#objMagicLimit`** (`magicLimit1/25/50/75`) — `MagicLimitMaster` singleton on `game` (get/set/
  setDefault, default 100); `charge.ts` reads `game.magicLimit.get()`; markers `set(N)` on spawn, reset to
  default on room-leave (room-scoped, hooked in `RoomManager.enter`). *(placed ×16)*
- ☑ **I2. `#objMusic`** (+ `musicLastStand`) — region markers call `audio.playMusic(record.musicName)` on
  spawn; `musicOff`'s `"stopMusic"` sentinel → `stopMusic`. **Music keys map 1:1** (no alias table needed —
  `baroque_rock_v1`/`woods_of_evil_v1`/`last_stand_v4`/`baroque_rock_techno_v1`/`electronic_merlin_v1_02`
  are all bundled keys). *(×25)*
- ☑ **I3. `#objTeamOverride`** (`teamOverride`) — marker sets `teamMaster.teamOverride = #aldevar` on spawn,
  reset null on room-leave (the gang-up branch in `calcTargetTeams` already existed). *(×9)*
- ☑ **I4. `#objScroll energyPunch`** — `PICKUPS["#energyPunch"]` → `equipSword(act_energyPunch)`: a
  `#magicMelee` melee weapon granted via `addWeapon` (fires through the B2 WeaponManager like merlinSword;
  the `#magicMelee` mana term is NOT applied — documented deviation, §g.6).
- ☑ **I5. `#objChatter`** (`stones1-5`) — decorative stone NPCs (Anim+Team). The `scr_stonesN` cutscene
  scripts are NOT bundled (only intro/wasted/complete are), so per the original's own "disabled inGame
  scripts" state they spawn as INERT decorative sprites (no fabricated cutscenes, §g.8).
- ☑ **I6. `#objMine`** (`fire`, `pitMonster`, `snow/orc/quad/ice/undead Aura`) — new `Mine` component
  (prime→check→detonate FSM calling `resolveSplash` at the mine loc). fire/pitMonster damage + re-arm (fire
  dies after 10, pit forever); the 5 auras are `damageMultiplier:0` + `#takeFreeze` → routed through the
  freeze payload (NOT a 0-damage takeHit). `teamMaster.findHostileWithin` added; team-gated. *(×550)*
- ☐ **I7. GMG** (`gmg`) — Golden Machine Gun collect + toggle + `modAttack.gmgOn/Off` auto-fire charge mode. **(Pass B)**
- ☐ **I8. Beams** (`energyBeamSpell`, `energyPulseSpell`) — `modAttack.performBeamAttack` / streaming release. **(Pass B)**
- ☑ **I9. Unit/dwelling audit** — towers fire (C2/E1), invasions cycle ALL `#residentGroups` (Dwelling
  random-picks a group each production cycle — verified `orcInvasion`→bowOrc/swordOrc/mageOrc emerge), and
  the `*InGame` spellcaster wizards now **cast their magic weapon**. **Found + fixed `berlinInGame`:** it
  carries a `#naturalMelee` `#punch` backup AND `#weapon:#energyBlast`; the port only read the melee attack
  (its animType is set), so 10/11 named wizards spawned melee-only and never cast. `spawnEnemy` now, for a
  `#objAiCPUSpellCaster` whose `#weapon` is `#magic`, uses the WEAPON's `#attack` as primary → they fire
  ranged magic via the existing CpuAI ranged path (instant-fire on cooldown, no charge-ramp — acceptable
  per B1/B2). `kingInGame` (plain `#objAiCPU`) stays melee; melee/ranged units unchanged.

### Out of scope (verify against the map data before trusting this list)
- **Map editor** — ships as a *separate executable* (`map_editor.exe`); `mapEditMaster` is editor-only.
  Maps are externally authored data, not a parity requirement. *(05)*
- (Per-effect sound channels / WebGL tinting — cosmetic; only after the above are reachable-and-working.)

---

## Status log
- **Iter 0** — Full-game audit via 5 parallel agents; this tracker + five domain docs. Overall ~20%.
  Keystone identified: `damage == knockback` (A1).
- **Iter 1** — ☑ A1 shipped. `takeHit` now carries a collision vector (damage = L1·mult, modEnergy) and
  applies it as inertia-damped knockback (objGameObject); melee/bullet/bomber build aimed vectors. Damage
  unchanged (room 1 still clears; spell still fells rank-and-file), enemies now recoil. +4 tests (75 total).
  Next: B1 (teamMaster/findTarget) or B2 (weapon manager) — the AI/targeting engine.
- **Iter 2** — ☑ B1 fully shipped. 2a (substrate) + 2b (brain swap). `EnemyAI`→`CpuAI` is now a real
  `objAiCPU` FSM with a **committed** `#target` (acquired once via `teamMaster.findTarget`, dropped
  reactively on `#leaveGame`, forced re-eval on a 30-frame throttle) instead of a per-tick nearest re-scan —
  the cardinal behaviour change. `Hurt` broadcasts `characterModeChanged` so the brain enters `#dazed`
  (zero intent) while reeling/dying and re-finds on recovery. Melee (player + CPU) routes through
  `teamMaster.impactMeleeAttack` (team-scoped AREA loop, A1 vector per victim) — a swing knocks back a
  cluster. Bomber no longer suicides (normal attack loop). Allegiance is now fully data-driven from
  `tem_*`/`#attack.targetAllegiance` (dropped `isFriendlyTeam`/`aiKind`/`targetTypes`). `UnitMap`+roster
  rebuilt once per tick (`combatTick.ts`) before AIs run. tsc clean; 90 tests pass (+4 CpuAI FSM); room 1
  clears (`enemies:0, exitsOpen:true, errors:none`); in-browser: orcs commit to player-side targets (30/30),
  0 target flicker over 12 ticks, one swing damages a 2-enemy cluster, no pageerrors. Next: B2 (weapon
  manager) — data-driven charge/cooldown + real weapon slots.
- **Iter 3** — ☑ B2 shipped. The hardcoded `SPELL`/`PUNCH` constants and `hasSword`/`hasSpell` booleans
  are gone, replaced by a real `WeaponManager` (modWeaponManager): `pWeapons` (sym→`AttackData`),
  `pCurrentWeapon`, per-weapon cooldown `Counter`s (`engine/counter.ts`, faithful CounterNew/Counter/
  Reset/Once) whose `inc` is the per-type skill stat (melee=agility, ranged=dexterity, magic=
  manaRegeneration). `charge.ts` resolves chargeMax/Start/Speed from each weapon's `#attack` × mana
  (reproducing energyBlast's old `cap*.75+5` / `0+burst` / `1*flow` exactly, +chargeSpeedMax/StartMax
  clamps + limitMagic ×magicLimit/100). Pickups call `addWeapon` (= newScrollCollected) instead of
  flipping flags; `getHasSpell` = owns a magic weapon. **Control scheme preserved** (plan §f.6, a
  documented port adaptation of the single-current-weapon model): Merlin still auto-melees with his
  current melee weapon (#punch→#merlinSword on pickup) AND holds to charge magic once owned — both at
  once; recast/swing each gate on that weapon's own counter, `resetCooldown` on FIRE (no free shot on
  swap). `damageMultiplier` now flows from `#attack` into `takeHit.mult` for the player's weapons.
  **Calibration (corrected in review):** MELEE_SCALE=2.5 pins `#punch`=40 (the pre-B2 `round(8*4)+8`)
  exactly; merlinSword=320 (its real damageMultiplier 16; one-shots the room-1 15–300-energy band, same
  effective clear speed). [Review caught the agent's arithmetic slip — it had SCALE=3/punch=48 claiming
  =40.] Enemy melee keeps the slice's tuned scalar damage (routing enemy power·strength·mult would inflate
  lethality 5–25× and break room 1) and enemy cooldowns are re-derived to preserve the old
  `atkCooldown+(ranged?18:6)` recovery in frames — enemy feel unchanged. A1 inertia→damage coupling stays
  deferred (reason documented in the A1 plan).
  tsc clean; 116 tests pass (+26: Counter edge cases, resolveAttack, charge reproduces today,
  WeaponManager add/select/cooldown/save, melee calibration, spell-fells-300); room 1 clears
  (`enemies:0, exitsOpen:true, errors:none`); in-browser: sword pickup → both #punch+#merlinSword owned
  (sword auto-current), melee+knockback land, grant energyBlast → getHasSpell true, charge bar fills to
  ~0.96, release fires a bolt, immediate recast gated, no pageerrors. Out of scope (plan §g): GMG toggle,
  magic limiter master, spell-actor lifecycle, setMultiAttack, weaponSelector UI, C-phase spell content.
- **Iter 4** — F1 shipped (asset pipeline complete). The slice-copier `build_assets.ts` is now a
  COMPLETE bundler: **all 10 tilesets** (4 families x {Passive,Active,Objects} + menu, matched by
  longest-unique-prefix `tlk_<family><Layer>`, each with per-tileset `tile`/`cols`/`keyFile` read from
  its `_key.txt` -- 32 gameplay, 16 menu); **all 171 anim chars / 556 anims** (member name space-split
  for `seperateMembers` before the `_`-split; per-frame `reg` + `dela` recorded); **all 47 maps** copied
  to `maps/<id>.txt` (folder-qualified ids on stem collision) + a `maps.json` manifest; **vocabulary-
  driven SFX** -- the closed logical-name set scanned from `casts/data` (`#sound`/`#collectSound`/
  `#dieSound`) union engine effects, each wav de-mangled + matched (all 29 land in the vocabulary, no
  lossy regex). Builder prints: `tilesets:10 chars:171 anims:556 maps:47 sounds:29 music:8`.
  **Consumers:** `assets.ts` gains a `chars` index + **lazy per-map loading** -- only the 10 (small)
  tileset sheets load up front; char frames load on demand via `ensureChar`/`ensureMapAssets` so the
  default map paints as fast as ever (no 14 MB eager-load). `map.ts` resolves `tilePx` per-map from the
  active layer's tileset (drops the global 32) and stays graceful on unknown/foreground layers. `main.ts`
  `loadMap(id)` plays **any** of the 47 maps (resolves its tilesets + per-layer keys + `ensureMapAssets`)
  with a `?map=<id>` dev picker; default id unchanged. `anim.ts`/`cutscenePlayer.ts` skip-and-lazy-load a
  frame that isn't loaded yet (summon/cutscene chars) instead of throwing. **Atlas baking descoped** --
  no image library is available and `public/assets/` is build-generated, so frames stay individual PNGs
  (renderer draws whole frames, unchanged); the F1 win is COMPLETENESS + load-any-map, not atlasing.
  tsc clean; **132 tests pass** (+16: `pipeline.test.ts` count gate cross-checked vs a fresh source scan
  + audio vocabulary coverage + a 7-map structural load smoke incl 64x64 / 37x25 / 50x1 / 30x30 asserting
  no throw; +1 audio real-key test). Room-1 no-regression: `playthrough_smoke` ends
  `enemies:0, exitsOpen:true, errors:none` (identical). In-browser: default + `merlinart` (64x64, merlin),
  `mr4Demo` (15x15, merlinOpen), `merliniii`, `merlinartiii` (35x18) all load and fully paint with **no
  pageerrors**. Out of scope (deferred): F2 collision tile-types (keys bundled, not interpreted), F3
  render fidelity, atlasing. Next: D1 (per-enemy sprite wiring -- now unblocked) or F2.
- **Iter 5** — ☑ C1/C2/C3 shipped (spell roster). **C1 (FREE):** `cBlast`/`darkBlast`/`cBlastAi` +
  arctic/heal bolt-halves are `#magic` weapons differing from `energyBlast` only in `#attack` numbers --
  added their `addWeapon` pickup rows (`pickup.ts` effects + `rooms.ts` scroll->pickup map), zero new
  mechanics; `charge.ts`/`WeaponManager` fire them as-is (unit-tested: cBlast's always-999 ceiling,
  darkBlast's start-5/cd-15/power-3). **C2 (new engine):** factored `impactAreaAttack(attacker,cx,cy,
  radius,hits,allegiance,hitFn)` out of `impactMeleeAttack` (the team-scoped disc search) and reused it
  for splash; new `splash.ts` `resolveSplash` handles `#explode` (radius=explodeCharge/2, hit-all-in-disc,
  `(hitRange-dist)*power` radial vector via `geomMoveVector`) and `#splashDamageOn` (radius=power,
  `collisionCalcVect`) -- both routed through the SAME `(|vx|+|vy|)*mult` A1 collision-vector scale B2
  calibrated (NO separate damage formula; falloff shape + centre-lethality pinned by tests); `applyPayload`
  ports `CallPayloadFunction` (symbol|LIST so one arctic hit runs `[#takeFreeze,#takeHit]`);
  `Freeze.takeFreeze` is now a VECTOR (`(|vx|+|vy|)*freezeMultiplier*4`, **accumulate** not max, 0.5x speed
  via `freezeFactor()`, teal latch); `Energy.takeHeal(vx,vy)`=`(|vx|+|vy|)*2`+gold glow; `Projectile`
  gained splash + single-target-payload trigger modes; `dwarfTower` spawns as a static ranged CPU firing
  the `towerAxe` splash bullet. **Splash calibration:** energyPulse centre hit = hitRange(17)*power(1)*
  mult(5) ~ **85 dmg**, falling to ~0 at the rim -- squarely in B2's single-target room-1 band (15-325);
  thunderBlast(31)/towerAxe(power 50 x mult 10, heavy turret) likewise scale by the radial-vector L1, never
  a bespoke formula. **C3:** `selectTier`->`summonUnit` spawns a fresh default-level unit via `spawnUnit`
  (correct `residentTeamCategory` team: army->#aldevar, monster->#monsterSummon), replacing the ad-hoc
  `E`-key summon; `randomSummon` wobble added to `charge.ts.chargeMaxOf` (seeded-deterministic). tsc clean;
  **155 tests pass** (+23: C1 charge data, geometry falloff, splash area/falloff/centre-lethality band,
  payload-list runs both, takeFreeze accumulate+slow, takeHeal clamp, selectTier, randomSummon bounded,
  summon spawns right team; freeze tests updated for the `(vx,vy)` signature). Room-1 no-regression:
  `playthrough_smoke` ends `enemies:0, exitsOpen:true, errors:none` (identical). In-browser (F1 `?map=`):
  **cBlast@winterland_test** (collect scroll -> getHasSpell -> charge+release fires a bolt),
  **armySummon@AutoSummonTest** (charge>=10 -> a friendly #aldevar ally appears, 0->1), **dwarfTower
  towerAxe splash@samii** (spawned among 10 enemies -> splash bullets damage a cluster) -- all with **no
  pageerrors**. Dead-content (build-for-completeness, unit-tested only): `darkBlast`/`cBlastAi` (placed in
  0 maps), skeleton/goblin/undead/sc random-summons. Deviation: C3 summons are always-permitted (the
  original armySummon requires a reservation; that's G2). Deferred per §g: GMG, magic limiter,
  `modFireBullets` streaming (energyPulseSpell), beams, the energyMines scatter-deposit (the mine
  *explode* path exists), spell-actor live-growth. Next: D1 (sprites) or the deferred streaming/beam spells.
- **Iter 6** — ☑ G1/G2/G3 shipped (save tree + army reserve + real medikit/potions). **G1a:** every spawned
  actor now carries its actor-type symbol (`Identity`/`getActorType`, set in the spawn factories); a generic
  `serializeActor(e)`→`respawnActor(snap)` pair (`entities/actorSerial.ts`) re-spawns any saved actor from
  its type + saved chain (energy/max/level/xp/position/weapon inventory/team-role) via the SHARED
  `spawnFromSymbol(sym,x,y)` routing factored out of `RoomManager` (pickup/dwelling/unit) so first-spawn and
  restore cannot drift. **G1b:** `save.ts` is now v2 — `saveGame` cascades `map → rooms[] (cleared flags) →
  current-room objects[]` + player chain + potion/army master slices; `SAVE_VERSION=2` gate REJECTS (no
  migrate) a version/shape mismatch and the pre-v2 `mr_save_v1` blob (returns null, never throws). On load
  (`main.ts.doLoad`): restore masters + cleared set + player chain, then `rooms.restoreInto` tears down the
  live actors and respawns the current room from its snapshot. Option A (current room + cleared set);
  per-room `pState` is H3. **G1c (the load-bearing trick):** NEVER serialize `entity.id` — a committed
  `#target` (CpuAI) is saved as a positional locator `{team,role,x,y}` (`getTargetDetails`) and re-acquired
  by a DEFERRED phase-2 pass (`teamMaster.restoreTarget`→nearest-in-team-to-loc) run AFTER every actor in
  the batch respawns + is rostered. Closes B1's deferred committed-target-through-save. **G2:** `ArmyMaster`
  singleton — a SUMMONED ally (`teleportable` flag, set only by `spawnAlly`; tile-spawned room allies are
  NOT) banks to `pReserveArmy[team][typ]` at its level on room-leave (`teleportOut`) and re-fields at the
  next room (`createUnit`/`lookupArmyDetails` picks highest level, rebuilds stats by re-running `forceLevelUp`
  growth, `restoreUnitToCombat` consumes the record); empty reserve → null; the bank persists in the save.
  **G3a:** real `Medikit` component (`modMedikit`) on the player replaces the instant full-heal — collecting
  BANKS a kit, gradual +1/5-frame heal up to max, `nextMedikit` refill, `getNumOfMedikits` HUD query, save
  slice (medikit==maxikit mechanically — the original `medikitCollected` ignores the character). **G3b:**
  `PotionMaster` per-type "potions drunk" tally (every pickup calls `potionCollected`) + save. tsc clean;
  **172 tests pass** (+17: actor round-trip, summoned-ally/dwelling round-trip, locator-target restore +
  no-dangling-id assert, army bank/re-field/level/highest-first/empty-null/teleportable-only,
  medikit cadence/nextMedikit/save-mid-heal, potion tally, full v2 save-tree round-trip, version gate). Room-1
  no-regression: `playthrough_smoke` ends `enemies:0, exitsOpen:true, errors:none` (identical). In-browser:
  set player energy/level + bank a medikit + grant merlinSword + summon a level-3 warrior, **Save (1)** →
  mutate (energy→1, drop ally, +potions) → **Load (2)** → player energy/level/medikit/potion/weapons + the
  ally + room-clear all restore, no pageerrors; separately, summon a level-4 ally then **walk to the next
  room** (only the summoned ally follows — re-fielded at level 4 — the 5 tile allies stay), no pageerrors;
  player position round-trips exactly through save/load. Deviations: Option A (not per-room `pState`, → H3);
  maxikit banks 1 like medikit (the data shows them identical — no bigger stockpile in the original);
  sound-slice save deferred (audio domain). Next: H3 (per-room state) or D1 (sprites).
- **Iter 7** — ☑ E1 shipped (modReincarnate → the skelitonLord cascade). ONE generic data-driven
  `Reincarnate` component (`components/reincarnate.ts`, the only new file) on the enemy/ally archetype:
  on a **killed-in-action** death it spawns each non-`#none` entry of the actor's `#reincarnateAs` /
  `#reincarnateInto` at the **corpse loc**, in list order; each spawned part re-arms its OWN Reincarnate
  from its act-data, so cascade depth is implicit (Lord→Upper→TorsoTank→Head is 4 deep). **Cardinal
  correctness:** (a) a **fire-once latch** (`done`, set BEFORE the spawn loop) so a double-update in the
  death frame can't duplicate; (b) spawn at the **death-finalize edge** reading `getPos` while the corpse
  is still valid (dead actors persist as graves in the port); (c) an **infinite-reincarnate guard** — a
  depth budget (12, deeper than any shipped chain) threaded into each child so a data cycle (A→A) can't
  spawn forever. **Team & level come from each CHILD's own act-data** (spawnUnit resolves the child's
  `#team`/`#startingLevel`), nothing inherited from the parent — so monk→monkGhost wouldn't mis-team.
  **Gate plumbing:** `Energy.takeHit` sets a `killedInAction` flag ONLY on lethal *damage* (modEnergy
  .pKilledInAction); a retire / room-exit / cull never sets it, so a `#leaveWhenFinished` ally doesn't
  split. `#minEnergy` added to the death threshold (hydra2/3 die at 500/1000, not 0). `#reelProof`
  (skelitonHead) wired generically in Hurt+Movement (no knockback/reel, still takes damage). All **17**
  `#reincarnateAs` actors wired generically (4 skeleton + hydra2/3 + doubleDarkGolem + fourArmGolem +
  lizardEgg + ostrichEgg + iceRock + garTower + monk + scArcher/scMonk/scWarrior + flamingRock). tsc
  clean; **182 tests pass** (+10 reincarnate: 3-tier in-order-at-corpse spawn, fire-once latch,
  #none-skip, bare-symbol parse, killedInAction gate, cyclic-chain depth-cap, child-data team, #minEnergy
  threshold, full skelitonLord tree drains to leaves, reelProof no-knockback). Room-1 no-regression:
  `playthrough_smoke` ends `enemies:0, exitsOpen:true, errors:none` (identical). In-browser (spawned a
  real skelitonLord via the live `game.spawnUnit` into works_mr4Demo + mr4Demo, killed it): Lord cascades
  into **skelitonUpper+skelitonLowerLeg+skelitonSword** (fires once), and draining the whole tree surfaces
  all **8 part types** (Lord, Upper, TorsoTank, Head, Arm, LowerLeg, FootSoldier, Sword), ending with 0
  live parts — no pageerrors. Deferred (plan §g): skelitonUpper's summon cast-loop (the C3 summon content
  ships; the enemy-caster fire-loop is AI wiring, not a mechanic), `#collisionDetection:false`
  pass-through (F2), `#reincarnated` XP transfer (cosmetic), bullet reincarnation (no shipped bullet sets
  it), berlin arena fight (cutscene-only, §g). Next: D1 (per-enemy sprites) or H (cutscene/flow).
- **Iter 8** — ☑ H1/H2/H3 shipped (the shell & game flow). **H1 (cutscene engine over REAL actors):** the
  standalone draw-frame reimpl is gone; `scenes/thespian.ts` is a faithful `Thespian` collapsing
  cutSceneMaster + modThespian + objScriptPerformer + objScript into one runner that drives REAL spawned
  entities through the gameplay `Movement`/`Anim` — a cutscene character is a live `Entity` (a minimal
  Identity+Movement+Anim+Energy+WastedMode+Team archetype, or the bound real Merlin for the wasted scene),
  walking/standing/facing/teleporting under its own modules, NOT a bespoke draw path (cutscene actors aren't
  in `game.entities`, so combat never touches them; the host paints them from each actor's `Anim.sprite()`).
  The parser (`data/cutscene.ts`) is faithful `interpretLineCommand` + `interpretLineArgs` (typed args:
  point/rgb/symbol/text/sound; `:`->speakLine; word2-command when word1 is a character). Two completion
  models: sync verbs (`at`/`walkTo`/`turnToFace`/`goMode`/`teleportIn/Out`/`enterStage*`/`exitStage*`/
  `gotoWings`/`setStage`/`showTitle`/`backgroundColourTo`/`playSound`/`playMusic`/`goWastedMode`) fall through
  the same tick; async (`speakLine`/`wait`/`lightsUp`/`lightsDown`/`fadeDown`) set a frame gate —
  `displayTime = round(50 + chars·1.4)` + `delay 12` (objScriptPerformer 27-31), `wait N`, fade window —
  dialogue AUTO-advances (no key). `#key` interpolation re-evaluated at display time (`keyForControl`). Prop /
  walkScroll / random-flash verbs staged behind the core movement+speech path (plan §f.1; unused by intro/
  wasted/complete). `cutscenePlayer.ts` is a thin host. **H2 (scene FSM + menus + death):** `SceneManager`
  (`scenes/sceneManager.ts`) replaces main.ts's mode var — `goScreen(sym, action)`, overlay `screenOn`/
  `backAScreen`, and the load-bearing `cutSceneFinished(scene)` dispatch (intro->game+startGame;
  **wasted->game+#loadGame** reload-the-save NOT fresh-restart; complete->victory). `objMenu` (`scenes/menu.ts`)
  is data-driven with **shadowed** items (Save greys while a cutscene plays, `isMenuItemShadowed`). Faithful
  death: player `#die` -> (after the die-anim delay) `modExtraLives.attemptRespawn` (`components/extraLives.ts`:
  lives>0 -> in-place respawn at the recorded point + `restoreEnergy` + lives--; else false) -> `gameOver`
  plays the **wasted cutscene** driving the REAL Merlin in `goWastedMode` (`components/wasted.ts`: blend
  30% + squash h=60%) -> reload the save (fallback to title when none). **H3 (endRoom win + per-room pState):**
  `map.ts` parses `#endRoom` (`#none`->undefined). `RoomManager.markCleared` fires on TWO triggers: clear-all
  OR reach+clear the `#endRoom` (`isEndRoom`). A `pState: Map<roomNum, ActorSave[]>` snapshots a room's
  recordable actors on leave (AFTER the G2 teleport-out hook, so reserve-banked allies are excluded) and
  restores them on re-entry (reusing G1's `serializeActor`/`respawnActor` + the G1c deferred relationship
  pass) — a half-fought room comes back exactly as left. The save tree extends to the **full per-room pState
  map** (`save.ts` v3, `buildSave.pState` + `pStateFromSave`/`rooms.fullPState`/`restorePState`), superseding
  G1's current-room-only Option-A; `SAVE_VERSION` bumped 2->3 with the same graceful-reject gate (G's save
  round-trips migrated to v3, kept green). tsc clean; **212 tests pass** (+30: 9 Thespian-runner — walkTo
  moves a real actor, speakLine/wait/lights gate timing, goMode/turnToFace, #key, cancel; 8 scene-FSM
  transitions incl wasted->reload-not-fresh + no-save->title + overlay round-trip; 5 death — respawn-with-life
  vs game-over + save round-trip + goWastedMode; 5 H3 — endRoom-triggers-win, #none-clear-all-regression,
  per-room HP restore round-trip, cleared-room-restores-empty, full-pState save round-trip; +1 pState save-tree
  + 2 parser typed-args; save tests migrated to v3). Room-1 no-regression: `playthrough_smoke` ends
  `enemies:0, exitsOpen:true, errors:none` (identical, default `#endRoom:#none` wins on clear-all unchanged).
  In-browser: the **intro cutscene plays with real actors MOVING** (distinct actor-x frames=19, walkTo drives
  them) + dialogue auto-advancing, then drops into gameplay (enemies:2, no pageerrors); `?map=merliniii` (real
  `#endRoom point(17,3)` = room 53): entering with 12 live enemies does NOT win, killing them -> **gameComplete
  victory cutscene** fires (the endRoom trigger, not clear-all); **death** (0 lives) -> wasted cutscene (real
  Merlin in goWastedMode) -> reload save -> back in game; **death with a banked life** -> in-place respawn
  (lives 1->0, not dead, no game-over); walk out of a half-cleared room + back -> the wounded orc restores at
  HP 15 (not fresh) — all with no pageerrors. Deferred (plan §g): credits/profile/showArmy/instructions screen
  CONTENT (transitions wired, overlays stubbed), copy-protection, map editor, screen-transition tweens (instant),
  grave persistence in pState, the rare prop/walkScroll cutscene verbs. Next: D1 (per-enemy sprites) or F2/F3.
- **Iter 9** — ☑ F2/F3 shipped (collision tile-types + render/anim fidelity). **F2 (golden-first):** the
  collision solver now handles every active-layer tile type via per-edge solidity. `tlk.tileTypeNums` maps
  each tile number to its `TileType`; `CollisionGrid.fromActiveLayer` builds a **derived EdgeGrid** (a 4-bit
  edge-solidity mask + a 4-bit corner byte per cell) — phase 1 sets each cell's raw edge mask from its type
  (`#solid`=LTRB, `#platform`=T one-way, `#ceiling`=B, `#wallLeft`=L, `#wallRight`=R), phase 2 **merges**
  facing solid edges between `#right`/`#bottom` neighbours (both cleared, EXCEPT a `#bottom` over a
  `#platform`), phase 3 detects **corner** tiles (`calcSolidCorner`: a solid tile's corner is solid when the
  two neighbour faces meeting at the diagonal are both solid — the anti-diagonal escape guard). `moveBox`
  now returns `{x,y,hitX,hitY,events}`; the **typed per-edge resolver** (the magic-rect 4-corner select +
  `calcOverlap` push-out with the −1,−1 fudge + the `#platform` was-above-last-frame one-way gate) runs ONLY
  when a non-`#solid` tile is present (`hasTypedTiles`). **The cardinal no-regression:** `#solid`-only grids
  stay on the original swept-AABB resolver, byte-for-byte — `collision_golden.test.ts`/`world.test.ts` pass
  UNCHANGED. None of the 47 shipped maps ship a non-solid active tile (verified: 403 `#solid`/106 `#none`,
  zero platform/ceiling/wall), so room-1 and every shipped map are unaffected; the typed path is breadth for
  editor maps. `Movement` dispatches the directional events (`collisionWallLeft/Right/Ceiling/Platform/
  NoPlatform`) as chain messages; the existing AI wall-detour keeps reading `hitX/hitY`, and reelFly-landing /
  scenic-repath are data-gated (no shipped map fires platform/noPlatform). The magic-rect is ported literally
  (its screen offset `tileSize−roomLocation` collapses to 0 at the port's world origin; +borderThickness is
  the 0-based grid's out-of-bounds border) — kept, not redesigned, per plan §F.1. **F3:** `modColourTransform`
  is now `components/colourTransform.ts` — the whole palette (glowRed/glowTeal/glowGold/glowRedAndTeal/
  flickWhite/pulseWhite + chained fadeGoldBlack/fadeBlack, ping-pong, speed-tween, `cancelTransColor` on a new
  transform, `transColorFin` chain) as a per-entity component exposing a resolved `{rgb,strength,additive}`
  tint. Triggers WIRED at the combat/status seam: `Energy.glowRedOnLowHealth` (<50%, re-armed on
  `colourTransformFin`) + `glowGold`-on-heal + `stopGlowRed`-on-recover; `Hurt` plays `flickWhite` on every
  non-lethal hit (retiring the binary white flash); `Freeze` plays `glowTeal`; glowRed↔glowTeal promote to
  glowRedAndTeal — all called DIRECTLY via `entity.tryGet(ColourTransform)` (no chain ambiguity). The renderer
  applies the tint via an **offscreen source-atop pass cached by quantized (image, colour, strength, additive)**
  — NO per-frame getImageData (the ban), bounded LRU cache. Anim: per-frame `dela` (the current frame's own
  delay, already in `assets.json`; 47/556 anims vary) + `gGameSpeed` scaling (`game.gameSpeed`, default 1) +
  a **data-driven `loop` flag** recorded by the builder (retiring the hard-coded `ONE_SHOT` set; the per-strip
  loop bool isn't cleanly recoverable from the cast, so it's the action classification recorded as overridable
  data — documented residual gap, plan §C.3.2). `#foregroundPassive` drawn OVER actors (front-layer blend 0.5).
  Per-sprite `alpha` on `Sprite`. `render/minimap.ts` is 5-state (`#cur`/`#clr`/`#inf` from live state + data
  `#fre`/`#spe` from `#miniMapStatus`, none ship) + the proximity distance blend (`VarMapRange(min(player,
  cursor)dist, [60,200], [10,90])` as globalAlpha). tsc clean; **241 tests pass** (+14 F2: per-type one-way,
  merge, corner via the typed path, directional events, Movement dispatch; +15 F3: ColourTransform state
  machine incl. glowGold->fadeGoldBlack chain + glowRed ping-pong + red/teal promotion + flickWhite one-shot,
  per-frame `dela` sequencing + gGameSpeed + loop-vs-hold from data + sprite-carries-tint, 5-state minimap
  selection). **Room-1 no-regression:** `playthrough_smoke` ends `enemies:0, exitsOpen:true, errors:none`
  (identical). In-browser: a hit shows a white flick (`[255,255,255]`), a low-health enemy glows red
  (`[255,0,0]`, additive), the sprite carries the tint, no pageerrors/404s; the intro cutscene plays with real
  actors; `?map=merlinart` loads + renders with no errors. Deviations/risks: (1) the magic-rect — ported
  literally, locked by the golden + the 4-corner-select tests before any refactor (the highest §F risk; the
  solid-only golden green is the proof). (2) `#current`-start colours approximated as black-start (the common
  idle->glow case); `getColourTransform` floors a freshly-armed bright transform so the glow shows immediately
  (the `objTransColor` exact curve is approximated linear, plan §G cosmetic). (3) no shipped map ships
  non-solid tiles or a `#foregroundPassive` layer, so those paths are golden/structurally tested, not
  in-browser-exercised. Out of scope (plan §G): WebGL tinting, map editor, minimap interaction, discrete
  layer-Z, AI platform drop-through. Next: D1 (per-enemy sprites).
- **Iter 10 — D2 + D1-via-F1 + integration.** D1 fell out of F1 (all 171 chars bundled → every shipped
  enemy resolves its own sprite; `goblinHero`→`goblinWarrior` alias). D2: dwelling self-destruct on
  empty, real `#totalResidents`, modest random resident level. Final cross-map integration sweep —
  intro cutscene + default + boss (`monster_summon`) + endRoom (`merliniii`) + 64×64 (`merlinart`) all
  load/spawn/paint with **no pageerrors**. 241 tests; room-1 gate green ×3. **The audited backlog (A–H)
  is complete.** Long-tail out-of-scope items (per each plan's §g) remain as documented non-goals.
- **Iter 11 — CORRECTION + Phase I opened.** The owner flagged that `mr4Demo` places the content a prior
  wrap-up wrongly called "out of scope." Decoded `maps/works/mr4Demo.txt` (225 rooms): it places `gmg`,
  `magicLimit1/25/50/75`, `energyBeamSpell`/`energyPulseSpell`, the auras/mines, `teamOverride`,
  `stones1-5`, `energyPunch`, towers, invasions, `*InGame` NPCs — 136 distinct symbols. Added
  `tools/classify_placed.ts` (objType buckets) as the reachability ground-truth. The engine/spell/save/
  boss/shell work all stands; Phase I builds the placed-but-inert objType mechanics (I1–I9). Lesson:
  verify reachability against the actual map data, never assert it from a partial scan.
- **Iter 12 — Phase I Pass A (I1–I6 + I9) shipped.** The placed-but-inert mr4Demo objTypes now spawn real
  Entities via an `objType` switch in `spawnFromSymbol` (`entities/objTypes.ts`). **I2 objMusic** (cheapest):
  region markers (`components/regionMarker.ts`) call `audio.playMusic(record.musicName)` on spawn; the
  `"stopMusic"` sentinel (act_musicOff) routes to `audio.stopMusic()`. **The music-key mapping is 1:1** —
  every `act_music*` `#musicName` (`baroque_rock_v1`, `woods_of_evil_v1`, `last_stand_v4`,
  `baroque_rock_techno_v1`, `electronic_merlin_v1_02`) is already a bundled `audio.index.music` key, so NO
  alias table was needed (§g.4 verified). **I1 objMagicLimit:** new `MagicLimitMaster` singleton on `game`
  (get/set/setDefault, default 100); `charge.ts` reads `game.magicLimit.get()` (replacing the dead const);
  the marker `set(N)` on spawn; `RoomManager.enter` resets it to default at room entry BEFORE that room's
  markers re-apply, making it room-scoped (§g.5). **I3 objTeamOverride:** the marker sets
  `teamMaster.teamOverride` (reset the same way); the gang-up branch in `calcTargetTeams` already existed.
  **I4 energyPunch:** `PICKUPS["#energyPunch"]` -> `equipSword` grants the `#magicMelee` melee weapon via
  `addWeapon` (deviation: the `#magicMelee` mana term isn't applied — the documented B2 melee calibration,
  §g.6). **I5 objChatter:** `scr_stonesN` cutscene scripts are NOT bundled (only intro/wasted/complete are),
  so the stones spawn as INERT decorative sprites (`components/chatter.ts`) per the original's own "disabled
  inGame scripts" state — no fabricated cutscenes (§g.8). **I6 objMine** (`components/mine.ts`): a static
  prime->check->detonate FSM (reusing the port's `Counter`) that calls **`resolveSplash`** with the mine's
  `#attack` at its loc — ALL damage/freeze math is the C2 engine, zero special-casing. fire (dmgMult 15,
  dies after 10) + pitMonster (dmgMult 40, re-arms forever) are damage emitters; the 5 auras (dmgMult 0 +
  `#takeFreeze`) route through the freeze payload (a slowing field, NOT a 0-damage takeHit — §g.7). Added
  `teamMaster.findHostileWithin` (reuses `calcTargetTeams`+unitMap); mines are team-gated (a `#fire` mine
  doesn't hit `#fire` units — `tem_fire.#hates` excludes itself). Mines are `type:"mine"` so a re-arming
  pitMonster never gates room-clear. **I9 audit:** towers/invasions verified (Dwelling random-picks a
  resident group each production cycle -> cycles ALL `#residentGroups`, confirmed `orcInvasion`->mageOrc
  emerges). **Found + fixed `berlinInGame` (and 9 other `*InGame` casters):** each carries a `#naturalMelee`
  `#punch` backup AND a magic `#weapon`; `spawnEnemy` only read the melee `#attack` (its animType is set),
  so the named wizards spawned MELEE-ONLY and never cast. Now, for a `#objAiCPUSpellCaster` whose `#weapon`
  is `#magic`, the WEAPON's `#attack` is used as primary -> it fires ranged magic via the existing CpuAI
  ranged path (instant-fire on cooldown, no charge-ramp, acceptable per B1/B2). `kingInGame` (`#objAiCPU`)
  stays melee; melee/ranged units unchanged. tsc clean; **263 tests** (+22 in `test/phase_i.test.ts`).
  Room-1 no-regression: `playthrough_smoke` ends `enemies:0, exitsOpen:true, errors:none`. In-browser on
  `?map=works_mr4Demo` (no pageerrors): entering room loc (12,11)->(2,12) changes the music track (no restart
  on re-entry); the (6,11) magicLimit25 cell dims the live charge ceiling to 3.125 (12.5×25%), reset to 100
  on leave; the (4,1) teamOverride cell makes a `#monsters` unit target the player's side; a fire mine in
  room (1,1) detonates on a blackOrc (1200->1080 energy); a pinned `#aldevar` warrior on a snowAura (room
  15,13) becomes `frozen` at 0.5× speed with energy UNCHANGED (freeze, not damage); the (6,11) energyPunch
  scroll grants `[#punch, #energyPunch]`; the (2,14) stones1 spawns a decorative NPC; `berlinInGame` (room
  1,8) spawns as an ally with `#energyBlast` (magic) current. Deviations/risks: (1) the `#magicMelee` mana
  term for energyPunch isn't applied (B2 calibration, §g.6); (2) heal/summon-caster wizards (ulinInGame
  healBlast, scarletInGame undeadSummon) fire a generic bolt — the heal/summon payload isn't applied for the
  CPU caster (the I9 fix only ensures they CAST; faithful payload routing for AI casters is a later pass);
  (3) `#recordInRoomState:false` (fire mines) are snapshotted into pState like any actor (the port's restore
  replaces tile-spawning, so excluding them would drop content — the mine FSM re-inits on respawn so the
  state is equivalent; save-bookkeeping deviation noted). Out of scope (Pass B): I7 GMG, I8 beams.
