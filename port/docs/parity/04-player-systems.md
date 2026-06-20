# Parity Audit 04 — Player Progression, Items, and Master/Manager Systems

Domain owner: agent 4. Scope: player progression (XP/leveling/stats), items/pickups/potions,
the 39 `casts/master_objects/*.txt` managers, and save/load completeness. Grounded in the actual
Lingo source and `port/src`. Read alongside `docs/PORTING_PLAN.md` + `docs/PLAN_REVIEW.md`.

Status legend: **FAITHFUL** (ported, behaviour matches) · **PARTIAL** (ported but lossy/approximate)
· **MISSING** (not ported, needed for parity) · **N-A** (dev-tooling / engine-internal / out-of-domain;
not needed for gameplay parity). Effort: S (<½ day) · M (1–2 days) · L (3+ days).

---

## 1. Master-systems table (39 managers)

The save tree (`saveMaster.saveGame`) is exactly four top-level slices: `currentMap` (the whole
`objMap` → `pRooms[]` tree), `g_potionMaster`, `g_soundMaster`, `g_armyMaster`. Only **3** masters
implement `addSaveData`/`restoreFromSave` (potion, sound, army) — plus `characterEnergyRollOverMaster.restoreFromSave()`
(no-arg, display-only). Everything else's persistent state lives on the entity chain inside `pRooms`.

| Master | Role (1 line) | Port status | Gap | Effort |
|---|---|---|---|---|
| **actorMaster** | Spawns/pools actors, assigns AI, collision routing; `getParams(#newActor)`/`newActor`. | **PARTIAL** | Port has `spawn*` factories + `pool.ts`, but no central actor registry/`newActor` indirection or `getPlayer()` master; army summon path leans on it. | M |
| **teamMaster** | Allegiance (`tem_*`), `findTarget` by role, unit tile-map broad-phase, `isPlayerEnemiesDead`/`setRoomClear`. | **PARTIAL** (not my domain — agent 1/2) | `isFriendlyTeam` reads `tem_aldevar.friends`; no unit tile-map, no real `findTarget`/room-clear authority. Seam: agent 1. | — |
| **soundMaster** | 8-channel SFX/music, "don't restart same music", volume, on/off; saves `pActive`. | **PARTIAL** (logic mine, playback agent 5) | `systems/audio.ts` plays SFX; no music-channel/`pLastMusic` no-restart logic; **`pActive` not saved**. Seam: agent 5 owns Web Audio layer. | S |
| **screenMaster** | Screen on/off + fade transitions, layout sprite recording. | **N-A** (agent 5) | Render/scene layer. | — |
| **mouseMaster** | Mouse loc/state (pressed/released/idle), in-bounds click validation. | **PARTIAL** (agent 5/1) | `systems/input.ts` has cursor/mouseDown; no idle/in-bounds master abstraction. | — |
| **keyMaster** | Active key set + current presses → move vector. | **PARTIAL** (agent 1/5) | `input.ts` builds move vector; key-set switching lives in keyChoose. | — |
| **keyChooseMaster** | WASD/Arrows binding-scheme selector UI. | **N-A / MISSING** (agent 5) | Menu UI; bindings table is agent 5. | S |
| **frameTimer** | 30 fps busy-wait timing + metrics. | **N-A** | Plan forbids porting the busy-wait; `loop.ts` is the fixed-timestep replacement. | — |
| **gameMaster** | Top coordinator: map load, pause/resume, win/lose, menu options. | **PARTIAL** (agent 5 + me) | `main.ts` drives map/pause/save; no formal gameMaster, no win/lose conditions. | M |
| **movieMaster** | Screen transitions, button routing, cutscene lifecycle. | **N-A** (agent 5) | Scene FSM. | — |
| **saveMaster** | Save/load orchestrator: writes `{ver, currentMap, g_potionMaster, g_soundMaster, g_armyMaster}` to a pref; version-gates load. | ☑ **G1** FAITHFUL (Option A) | `systems/save.ts` v2 cascades `map → rooms[] (cleared flags) → current-room objects[]` + player chain + potion/army master slices; `SAVE_VERSION=2` gate REJECTS (no migrate) old blobs. Per-room `pState` for non-current rooms deferred to H3; sound slice deferred (audio domain). | L |
| **profileMaster** | Code-section timing profiler. | **N-A** (dev tooling) | — | — |
| **memberMaster** | Factory for temp cast members (text/image). | **N-A** (agent 5) | Render-member creation. | — |
| **spriteMaster** | Sprite-channel alloc/free, 3D shader setup. | **N-A** | Plan drops channels for a `locZ` display list. | — |
| **collisionMaster** | Object-vs-terrain collision + play-area boundary + screen-exit notify. | **PARTIAL** (agent 2/1) | `world/collision.ts` exists; boundary/exit-notify is world domain. | — |
| **controllerMaster** | Factory for menu/map/audio controllers. | **N-A** (agent 5) | — | — |
| **enemyEnergyMaster** | Pooled enemy energy-bar display (Rapunzel-specific). | **N-A** (agent 5 HUD) | Display only. | — |
| **characterEnergyRollOverMaster** | Health/level/XP bars on hover over friendly units; `restoreFromSave()` (no-arg, re-displays). | **MISSING** (agent 5 HUD) | No hover-bar HUD. Save hook is display-refresh only — trivial. | S |
| **starMaster** | Spawns XP stars on level-up (`experienceStar`/`releaseStar`), `starBurstX` (4 stars), marker stars. | **MISSING** | `modExperience.levelUp → releaseStar` not reproduced. Port plays `level_up` sound but spawns no star actor. Cosmetic but visible. | S |
| **potionMaster** | Tracks potions-drunk per type + on-screen counter; **saves `pPotionsCollected`**. | ☑ **G3b** FAITHFUL (counter) | `systems/potionMaster.ts` `PotionMaster` singleton: every pickup `potionCollected(type)` bumps a per-type tally; `addSaveData`/`restoreFromSave` round-trip the stripped `{character,numCollected}` list. On-screen counter/icons are render-only (agent 5). | M |
| **medikitMaster** | Passes display updates between `modMedikit` and the medikit HUD. | ☑ **G3a** FAITHFUL (logic+save) | `components/medikit.ts` ports `modMedikit` (stockpiled gradual heal, +1/5-frame, `nextMedikit` refill, `getNumOfMedikits`, save slice) on the player. medikitMaster display is agent 5; the queries (`getNumOfMedikits`) are exposed. | M |
| **armyMaster** | Reserve army of teleported/summoned units (`pReserveArmy` by team→typ), `createUnit`/`recordUnitDetails`, "NEXT" display; **saves `pReserveArmy`**. | ☑ **G2** FAITHFUL (level-banked) | `systems/armyMaster.ts` `ArmyMaster` singleton: `teleportOut` banks a SUMMONED ally (teleportable flag) at its level on room-leave, `createUnit`/`lookupArmyDetails` re-fields the highest-level reserve unit (rebuilding stats via `forceLevelUp` growth) on the next room, `restoreUnitToCombat` consumes it; `pReserveArmy` persists in the save. "NEXT" display is agent 5. | L |
| **showArmyMaster** | Paginated grid of reserved units (level/count). | **MISSING** (agent 5 UI) | Depends on armyMaster. | M |
| **reservationsMaster** | Per-team spawn-slot reservation to respect caps. | **MISSING** (agent 1/2) | No spawn-cap reservation system. | M |
| **old_reservationsMaster** | Legacy, superseded by reservationsMaster. | **N-A** (dead code) | Don't port. | — |
| **structMaster** | Blank-struct factory for ~50 record types (attack defaults, potionRecord, screenExits…). | **PARTIAL** | Port resolves `#attack` via data registry; no central struct-defaults table. Some defaults inlined. | S |
| **weaponMaster** | Droppable-weapon registry, ownership, nearest-available lookup for AI. | **MISSING** (agent 3) | Weapon mechanics domain. | — |
| **wizardMaster** | Wizard/summon-selector display + unlock notifications. | **MISSING** (agent 5/3) | Wizard selection UI. | M |
| **gmgMaster** | Golden-machine-gun display/charge feedback. | **N-A** (agent 3/5) | Special weapon HUD. | — |
| **magicLimitMaster** | Stores global magic-cast power cap (`act_magicLimit*`). | **MISSING** (agent 3) | Spell-power cap not enforced. | S |
| **mapEditMaster** | Map load/edit dev menu. | **N-A** (dev tooling) | — | — |
| **creditsMaster** | Loads/scrolls credits text. | **N-A** (agent 5) | — | — |
| **cutSceneMaster** | Cutscene playback (dialogue, staging, effects). | **PARTIAL** (agent 5) | `scenes/cutscenePlayer.ts` exists; not my domain. | — |
| **collectionsMaster** | Central typed-data registry (`act→Actor`, `tem→Team`…) from cast members. | **FAITHFUL** | `data/registry.ts` mirrors it (prefix→type maps, `#inherit`/`#attack` merge). | — |
| **copyProtectionMaster** | License web-check (disabled on Mac). | **N-A** | Don't port. | — |
| **XMLmaster** | Prop-list ↔ XML serialization. | **N-A** | Save uses JSON instead. | — |
| **GPL** | GPL v2 license text. | **N-A** | — | — |
| **LicenceHeader** | Copyright/GPL notice. | **N-A** | — | — |

**Master tally (this domain's gameplay-relevant set):** FAITHFUL 1 · PARTIAL 8 · MISSING 11 (incl. agent-shared) · N-A 19.
Squarely-mine-and-MISSING for parity: **potionMaster, medikitMaster, armyMaster, showArmyMaster, starMaster, magicLimitMaster, characterEnergyRollOverMaster**.

---

## 2. Progression + items table

### Leveling & stats (`modExperience`, `modCharacterAttackProperties`, `modEnergy`)

| Feature | Lingo source | Port status | Gap | Effort |
|---|---|---|---|---|
| Cumulative XP + rising threshold | `modExperience.attemptToLevelUp` (`L³+L²+thr/(L+1)+5+init`) | **FAITHFUL** | `experience.ts` replicates the formula exactly, incl. multi-level-per-kill loop. | — |
| Kill reward = `imWorth + gained/2` | `attributeExperience` | **FAITHFUL** | `getReward()` matches; bullets grant no XP handled at attacker side. | — |
| `recordKill`/`pKills` tally | `recordKill` | **MISSING** | Kills-per-type not recorded; feeds dwelling XP-worth + stats screens. | S |
| Strength growth (always, every level) | `incStrengthLevel` (`+strengthIncLevel`) | **FAITHFUL** | `PlayerControl.levelUp` bumps strength → punch power. | — |
| 1 random mana stat per level | `levelUpCharacterAttackProperties` (`random(4)`) | **FAITHFUL** | `mana.ts levelUp` rolls 1-of-4 (burst/capacity/flow/regen). Determinism caveat: Lingo RNG not reproducible (PLAN_REVIEW §4). | — |
| Stall-speed growth on level | `incStallSpeedLevel` (`pStallSpeedIncLevel`, default 0) | **PARTIAL** | Not ported; default inc is 0 for player so currently no-op — low risk. | S |
| Walk-accel growth on level (Merlin) | `modExperience.levelUp → incWalkAcceleration` | **MISSING** | Port does not speed Merlin up per level. Noticeable buff. | S |
| Star release on level-up | `levelUp → releaseStar` + `level_up` sound | **PARTIAL** | Sound plays; **no star spawned** (starMaster MISSING). | S |
| Resize-on-level | `setSpriteSizeFromLevel` | **N-A** | Commented out in Lingo — intentionally inert. | — |
| `agility`/`dexterity`/`eyestrain` | `modCharacterAttackProperties` (cooldown/inaccuracy mods) | **MISSING** | Not modeled. Affect attack cooldown (agility=melee, dexterity=ranged) + ranged inaccuracy. `act_player` sets agility 1, dexterity 0.2, eyestrain 0. | M |
| `mana_regeneration` real value | `act_player` `#mana_regeneration: 30` | **PARTIAL / RISK** | `spawnPlayer` reads it from data (good if registry has 30), but `mana.ts`/`control.ts` default to **1**; cooldown divisor of 30 vs 1 is a 30× difference in recast. Verify the resolved record actually carries 30 — see §5 risks. | S |
| Energy growth on level | `modEnergy` (`energyIncPercentage`, +max on level) | **PARTIAL** | Wired via cfg (`energyIncPercentage:2`); confirm Energy.levelUp raises max + heals. (agent-shared with combat.ts) | S |
| Starting-level pre-level units | `pStartingLevel`/`levelUpToStartingLevel` (no stars) | **MISSING** | Enemies with `#startingLevel` (e.g. powerOstrich=2) don't get pre-leveled. Affects difficulty. | S |
| Reincarnation XP transfer | `transferExperience` (`gained/2` to reincarnated self) | **MISSING** | Death/reincarnate flow not ported (Phase 6). | M |
| XP from healing | `gainExperienceFromHealing`/`takeHeal` | **MISSING** | Healing-as-XP path absent. | S |

### Items / pickups / potions

Powerups inherit `#powerUp` (`objType #objPotion`, `AiType #objAiPowerUp`, team `#collectables`,
weight 0). `objAiPowerUp.update` checks player overlap → `collected(player)` → `goMode(#dead)`.

| Item | Data file | Effect (Lingo) | Port status | Gap | Effort |
|---|---|---|---|---|---|
| medikit | `act_medikit` (`objMedikit`) | `modMedikit.medikitCollected`: +1 medikit; heals 1hp/5-frame counter when below max, consumes medikits. | ☑ **G3a** FAITHFUL | `components/medikit.ts`: collecting BANKS a kit (`numOfMedikits++`), gradual +1/5-frame heal up to max, `nextMedikit` refill, `getNumOfMedikits` HUD query, save slice (`numOfMedikits`/`remainingHitpoints`/`active`/`healDelay`). HUD draw is agent 5. | M |
| maxikit | `act_maxikit` (`objMedikit`, char `#maxikit`) | Same `objMedikit` path, bigger graphic. | ☑ **G3a** FAITHFUL | Same `Medikit` component; banks 1 kit — the original `medikitCollected` ignores the character, so maxikit and medikit are mechanically identical (the difference is purely the graphic). | S |
| manaCapacity | `act_manaCapacity` | `incManaCapacityPotion` (+0.75) | **FAITHFUL** | `Mana.incCapacity()` = +0.75. ✓ | — |
| manaFlow | `act_manaFlow` | `incManaFlowPotion` (+0.5) | **FAITHFUL** | `Mana.incFlow()` = +0.5. ✓ | — |
| manaBurst | `act_manaBurst` | `incManaBurstPotion` (+0.75) | **FAITHFUL** | `Mana.incBurst()` = +0.75. ✓ | — |
| walkSpeed | `act_walkSpeed` | Increases walk speed | **PARTIAL** | Port "speed" = `maxSpeed += 0.6` (approx; real inc not confirmed against a `modWalkSpeed`/handler). | S |
| merlinSword | `act_merlinSword` (`objScroll`) | `modWeaponManager.addWeapon` adds the `#merlinSword` melee attack (damageMultiplier 16, reach 12×5). | **PARTIAL** | Port `equipSword` = `+160` power, reach 24 (hard-coded approx, not the real `#attack`). | M |
| energyBlast scroll | `act_energyBlast` (scroll) | Grants charged magic weapon. | **PARTIAL** | `grantSpell()` unlocks `hasSpell`; SPELL constants hand-tuned, not data-driven from `act_energyBlast`. | M |
| **potion counter HUD** | `potionMaster` | Tally + on-screen icons, persisted. | ☑ **G3b** (logic+save) | `PotionMaster` per-type tally + save (G3b); on-screen icons/counters are render-only (agent 5). | M |
| blackPotion / horriblePotion | `act_blackPotion`/`act_horriblePotion` | `#prop`, `#collectables` — cutscene/story props (not gameplay powerups). | **N-A** | Cutscene actors (agent 5). | — |
| blueScroll / whiteScroll | `act_blueScroll`/`act_whiteScroll` | Story `#prop` scrolls. | **N-A** | Cutscene props. | — |
| `act_powerUp` base / `objAiPowerUp` | base actor + AI | Walk-over collect, `collected()` callback. | **PARTIAL** | Reproduced as `Pickup.update` overlap check (16px box) rather than the AI/`collected` path; behaviourally close. | S |
| speedyGuy / powerOstrich | `act_speedyGuy`/`act_powerOstrich` | Full CPU characters (NOT pickups despite names). | **N-A** (agent 2) | Enemy content. | — |

---

## 3. Save/load gap list (state not yet persisted) — UPDATED post-G

`saveMaster` top-level shape = `{ ver, currentMap, g_potionMaster, g_soundMaster, g_armyMaster }`.
G1/G2/G3 (`systems/save.ts` v2) now persist `{ ver:2, map, currentRoom, rooms[] (cleared + current-room
objects), player-chain, potions, army }`. Status of each original gap:

1. ☑ **Per-room actor state (G1).** The CURRENT room's live actors round-trip via the generic
   `serializeActor`/`respawnActor` cascade (`entities/actorSerial.ts`) — each actor re-spawns from its
   `getActorType` symbol + its restored chain (energy/XP/level/mana/weapon inventory/position/team-role).
   *Partial vs the original:* only the current room's objects are snapshotted (Option A); non-current
   rooms keep their cleared flag but re-derive from tiles on re-entry. Per-room `pState` for all visited
   rooms is **H3**.
2. ☑ **Room-clear / been-activated flags (G1).** The `cleared` set persists (`RoomManager.clearedRooms`/
   `restoreCleared`) → a cleared room re-enters empty.
3. ☑ **Potion tally (G3b).** `potionMaster.pPotionsCollected` persists per-type.
4. ☐ **Sound state (`soundMaster.pActive`).** Still deferred (audio domain; no behavior gated on it).
5. ☑ **Army reserve (G2).** `armyMaster.pReserveArmy` (per team→typ, level-banked) persists whole;
   teleport-out on room-leave + re-field at saved level.
6. ◐ **Dwelling / construction state.** A dwelling round-trips its `budget` from data (re-derived at
   respawn); fine-grained build/resident-in-progress + `modConstruction` stage are a deferrable G1 detail.
7. ☐ **Room graves** — cosmetic, deferred.
8. ☑ **Medikit stock (G3a).** `modMedikit` ported on the player; `numOfMedikits`/`remainingHitpoints`/
   `active`/`healDelay` persist in the player chain.
9. ☑ **Save-version gate.** `SAVE_VERSION=2`; `loadSave` REJECTS a version/shape mismatch (no migration),
   like `saveMaster.isLoadAvailable`. The pre-v2 `mr_save_v1` key is ignored (clean break).
10. ◐ **Entity-ref restore (G1c).** Committed `#target`s are saved as a positional locator `{team,role,
    x,y}` (never an entity id) and re-acquired by `teamMaster.restoreTarget` in a deferred phase-2 pass.

Modules that implement `addSaveData`/`restoreFromSave` in Lingo: **27 `mod*` + 18 `obj*` + 3 masters**
(`grep` confirmed). The port currently honors the cascade for **4 player components** (Experience,
Mana, PlayerControl-weapons, Energy) — none of the room/actor/master tree.

---

## 4. Headline coverage % (this domain)

- **Progression core (XP formula, level-up, strength + 1-random-mana-stat, mana potions):** ~**80%** FAITHFUL.
  Gaps are secondary stats (agility/dexterity/eyestrain), walk-accel-on-level, stars, starting-level, reincarnation.
- **Items/pickups:** ~**45%**. The three mana potions are exact; medikit/maxikit/sword/scroll/walkSpeed
  are approximations; potion-counter and real medikit stock are missing.
- **Master systems (gameplay-relevant subset, excluding N-A dev/render):** ~**25%**. Only collectionsMaster
  is faithful; potion/medikit/army/showArmy/star/magicLimit/rollover all missing; save/actor masters partial.
- **Save/load completeness:** ~**15%** (player chain only; the entire room/actor/army/potion/sound tree absent).

**Domain headline: ~35% behavioral parity.** Progression math is the strong point; persistence and the
collectible/army/HUD-master layer are the weak points.

---

## 5. Prioritized build targets + faithfulness risks

### Build targets (priority order)

1. **Full save/load tree (saveMaster parity).** Highest leverage. Implement the `currentMap → pRooms[] →
   pRoomObjects[]` cascade so all actors (not just the player) round-trip, plus `pRoomCleared`/`pBeenActivated`,
   and add `potionMaster`/`soundMaster`/`armyMaster` slices. Reuse each component's `addSaveData`/`restoreFromSave`
   (already the right pattern); the missing piece is iterating rooms + actors and the master singletons.
   Order matters on restore (character before AI; masters are separate singletons, never entity-swept — PLAN_REVIEW §1). **L.**
2. **armyMaster + reserve persistence + `modArmyUnit`/`generateArmyDetails`.** The defining world-progression
   feature (teleport-to-reserve, re-summon at saved level/stats, "NEXT" display). Unlocks meaningful summoning
   and a large slice of save state. Coordinate spawn path with actorMaster/reservationsMaster (agent 1/2). **L.**
3. **Real medikit + potionMaster counter.** Replace instant-heal with `modMedikit` stockpile (gradual heal,
   `pNumOfMedikits`/`pRemainingHitpoints`, save state) and add the potion-drunk tally (per-type count + save).
   Together these fix the two most-collected items and two save slices. **M.**

(Runner-up quick wins, all **S**: starMaster `releaseStar` on level-up; `incWalkAcceleration` per level;
`recordKill`/`pKills`; soundMaster `pActive` save + no-restart-same-music.)

### Faithfulness risks

- **`mana_regeneration` value mismatch (highest).** `act_player` sets `#mana_regeneration: 30`, but
  `mana.ts` and `control.ts` default it to **1**. Recast cooldown = `cooldown / regeneration`, so 30 vs 1 is a
  **30× faster recast** — game-defining. `spawnPlayer` does pass the data value through, so parity hinges on the
  resolved registry record actually carrying 30 (and on `#inherit: #actor` not clobbering it). **Verify the
  resolved `player` record's `mana_regeneration` is 30, not the default.** Note also the Lingo cooldown formula
  (`#magic` cooldown `/ regeneration`) should be confirmed against `modCharacterAttackProperties`'s real cooldown
  derivation, not the port's hand-tuned `SPELL.cooldown:30`.
- **Hand-tuned combat/pickup constants vs data.** SPELL (energyBlast), sword (`+160`/reach 24), punch power
  (`strength*4+8`), pickup increments other than mana, enemy `atkPower` scaling — all approximations layered on top
  of `damage == knockback`. They will drift from the real `#attack`/`#power` math (agent 3 seam). Flag every
  hard-coded magic number for a data-driven pass.
- **Determinism of the 1-random-stat roll.** `mana.ts levelUp` uses the engine RNG; the original `random(4)` is
  not reproducible (PLAN_REVIEW §4). Level-up stat outcomes can never byte-match the original — keep parity tests on
  the *deterministic* path (which stat-set is possible, threshold math), not the specific roll.
- **Save ordering / namespacing.** When the full tree lands, honor restore order (character before AI) and keep
  masters as singletons; flattening room nests would collide keys (`pMode`/`pState`) per PLAN_REVIEW §1 item 6.
- **`objAiPowerUp` collect path.** Port uses a 16px AABB overlap instead of the AI `checkForCollisionWithPlayer →
  collected → goMode(#dead)` path. Fine functionally, but pickups that should also be destructible/poolable
  (`#dead` mode) skip that lifecycle — watch when pooling pickups.
