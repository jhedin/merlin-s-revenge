# G-phase Plan — Systems & Persistence (the full save tree, army reserve, real medikit/potions)

**Backlog rows:** G1 (full save/load tree) · G2 (`armyMaster` + reserve persistence) · G3 (real
medikit stockpile + `potionMaster` counter). Domain audit input: [`../04-player-systems.md`](../04-player-systems.md)
§3 (save-gap list) + §1 (master table). Engine substrate: A1 (`takeHit` vector), B1
(`teamMaster`/`findTarget`/committed `#target`), B2 (`WeaponManager`/per-weapon cooldown), F1 (load-any-map).

**One-line thesis:** today the port saves a single namespaced player blob (`save.ts` →
`{v, room, player-chain}`). The original saves the **entire world** — `currentMap → pRooms[] →
pRoomObjects[]` — by re-running the same `addSaveData`/`restoreFromSave` cascade the port already uses for
the player, but per-actor and per-room, plus three master singletons (`potion`, `sound`, `army`). The
work is to lift that cascade from "the player" to "every room and every actor in it," and to make actors
**re-spawnable from their actor-type symbol + saved chain**, re-acquiring cross-actor references
**positionally** rather than by stored id.

---

## (a) Original mechanics — grounded in cited handlers

### A.1 The save cascade (`saveMaster` → `objMap` → `objRoom` → actor chain)

`casts/master_objects/saveMaster.txt`:

- `pSaveVersion = 12` (init). The top-level save dict is exactly **four** slices (`saveGame`, lines 71–101):
  ```
  sd[#ver]            = pSaveVersion
  sd[#currentMap]     = currentMap.addSaveData([:])   -- the whole objMap → pRooms[] tree
  sd[#g_potionMaster] = g.potionMaster.addSaveData([:])
  sd[#g_soundMaster]  = g.soundMaster.addSaveData([:])
  sd[#g_armyMaster]   = g.armyMaster.addSaveData([:])
  ```
  Persisted with `setPref(gGameSaveFile, string(sd))` — a stringified prop-list (the port's localStorage+JSON
  is the faithful analogue).
- `isLoadAvailable` (21–36): reads the pref, `value()`s it, and gates on **`sd.ver = pSaveVersion`** — an
  old-format save is silently unavailable, not migrated.
- `loadGame` (38–54): `currentMap.restoreFromSave(sd.currentMap)`, then the three masters
  `restoreFromSave`, then `characterEnergyRollOverMaster.restoreFromSave()` (no-arg, display refresh only).
  **Order is fixed: map first, then masters.**

`casts/script_objects/objMap.txt`:

- `addSaveData` (233–246): writes `pCurrentRoomLoc`, `pName`, then **iterates `pRooms` and folds each
  room's `addSaveData` into `sd.pRooms[]`** (a flat array in room order), then chains to the ancestor.
- `restoreFromSave` (632–656): the multi-phase rebuild —
  1. `ancestor.restoreFromSave(sd)`,
  2. `clearCurrentRoom()` — so `moveToRoom` later doesn't accidentally `saveState` the about-to-be-replaced room,
  3. **`g.actorMaster.finishActors()` — tears down every live actor first**,
  4. iterate `pRooms` **by index, assuming the same room order as at save time**, calling
     `room.restoreFromSave(roomsData[i])`,
  5. `moveToRoom(sd.pCurrentRoomLoc)` — which triggers the active room's `activate()` and its restore,
  6. `pMiniMap.initMiniMapData()`.

`casts/script_objects/objRoom.txt`:

- `addSaveData` (169–185): `pBeenActivated`, `pRoomCleared`, `pNum`, `pState` (a duplicated list), then
  iterates `pRoomObjects` folding each `roomObject.addSaveData([:])` into `sd.pRoomObjects[]`.
- `restoreFromSave` (600–611): warns if `pNum` mismatches; loads `pBeenActivated`, `pRoomCleared`,
  **stashes `sd.pRoomObjects` into `pRoomObjectsToRestore`** (deferred — not respawned yet), and `pState`.
- **The deferral is the key two-path design.** A room is only repopulated when it is `activate()`d
  (110–137):
  - `pBeenActivated = false` → `activateActors()` (first visit: spawn from the `#objects` tile layer).
  - `pBeenActivated = true` and `pRoomObjectsToRestore.count > 0` → `restoreRoomObjects()` — used **only
    for the one room that was active at save time** (its live actors, incl. bullets/charging spells).
  - `pBeenActivated = true` and no restore list → `restoreState()` — re-create from `pState`, the snapshot
    `freezeObjects`/`saveState` took when the player last **left** that room.
- `restoreRoomObjects` (613–653) and `restoreState` (655–701) are near-identical multi-phase respawns:
  for each saved object — `g.actorMaster.newActor({typ: actorType, startLoc, forceCreate})`, then
  `newActor.restoreFromSave(data)`, then collect into a list and run **four cross-cutting passes** over the
  whole batch:
  1. `frameAdvance` (fix the graphic),
  2. `internalEvent(#clearDefaultBuildings)` (a builder restored mid-build shouldn't keep the stub it
     auto-started),
  3. `restoreRelationships` (re-link targets/owners — see A.4),
  4. `internalEvent(#restoredFromSave)` (final per-module fixup, e.g. multi-stage spell icons).
- `saveState`/`freezeObjects` (277–287, 723–746): on **leaving** a room, only objects whose
  `getRecordInRoomState() = true` are snapshotted (`{loc, actorType, saveData}`); the player and hair are
  excluded (`getRoomObjects`, 462–478). This is the "live room state on re-entry" mechanism (port backlog H3).

**Master tally for the save tree** (04 §1): of 39 masters only **potion/sound/army** carry game state
into the save; everything else's persistent state lives on the actor chain inside `pRooms`.

### A.2 What an actor's `addSaveData` chain contains

`objGameObject.getActorType` (399) returns the actor-type symbol — **the respawn key**. The module chain
each contributes a namespaced slice; the port already mirrors four of them (Movement→`move`,
Energy→`energy`, Experience→`xp`, Mana→`mana`, WeaponManager→`weaponMgr`). The original additionally
chains `modMedikit` (stock), `modConstruction`/`modResidents` (dwelling build/resident progress),
`modRoomGraves` (death markers), `modRelationships` (targets/owners), `modArmyUnit.pTeleportOutStarted`.
Deferrable for the port slice (note where): graves (cosmetic), construction-stage art, charging-spell
in-flight bullets, multi-stage spell icons.

### A.3 The entity-ref problem and the original's solution (`getTargetDetails` / `restoreTarget`)

This is the load-bearing insight for G1. Saved relationships reference **other actors**, but actors are
torn down and respawned with brand-new identities on load — a stored object pointer (or, in the port, a
stored `entity.id`) would dangle. The original never stores a ref. It stores a **positional descriptor**
and re-acquires by proximity:

- `objGameObject.getTargetDetails` (542–555): for a live target returns
  `#targetDetails{ team, teamRole, sprLoc }` (a dead target returns a blank struct).
- `modRelationships.getRelationshipsTargetDetails` (132–148): serializes each relation as that descriptor.
- On restore, `modRelationships.restoreRelationships` (156–187): for each saved relation,
  `targetObj = g.teamMaster.restoreTarget(relTargetDetails)` then re-files it as `#target`/`#owner`/
  `#currentSpell`.
- `teamMaster.restoreTarget` (1297–1306): `findTargetInTeam(team, sprLoc, #closestDistance, [[teamRole]])`
  — **the nearest live unit of that team+role to the saved location wins.** Exact identity is not
  preserved; behavioral parity is (the unit re-commits to "the orc that was roughly there").

So the entity-ref strategy is **save-by-locator, restore-by-spatial-query**, run as a deferred pass
*after every actor in the batch already exists*.

### A.4 `armyMaster` + `modArmyUnit` — the reserve (G2)

`casts/master_objects/armyMaster.txt`: *"records details of units that have been teleported off the
screen and saved."*

- `pReserveArmy` (init): a 2-level prop-list keyed `[team][typ] = [armyDetails, …]`. `addSaveData` (57–59)
  saves it whole; `restoreFromSave` (309–313) restores it whole then `displayNextSummons`.
- Teleport-out path: when a unit leaves a room, `modArmyUnit.armyTeleportOut` (57–78) plays the teleport
  (guarded by `pTeleportable` — **Merlin is false**, ghosts false — and a `pTeleportOutStarted` latch). On
  `#teleportOutFinished` (`internalEvent`, 99–121): `g.armyMaster.recordUnitDetails(me.big)` then
  `leaveGame` + `eventNotify(#leaveGame)`.
- `recordUnitDetails` (280–307): `armyDetails = obj.generateArmyDetails()`; tacks on a `stand`-frame
  member/width/height; `ensureLists(team, typ)`; appends to `pReserveArmy[team][typ]`; `displayNextSummons`.
- `modArmyUnit.generateArmyDetails` (80–93): **deliberately NOT `addSaveData`** — *"there are a lot of
  things we don't want to record — eg. targeting info, health levels, animFrame."* It builds a fresh
  `pArmyDetails = [:]` and broadcasts `internalEvent(#addToArmyDetails)`; each module appends its
  *persistent* state (e.g. `modExperience` writes `pExperienceLevel`, `modCharacterAttackProperties` its
  mana stats, `modArmyUnit.pTeleportOutStarted`). So a reserve record is a **lossy snapshot keyed to level
  + grown stats, not full health/position/target.**
- Re-summon path: `armyMaster.createUnit(team, typ, startLoc, spellName)` (80–108): `lookupArmyDetails`
  (pick the **highest-`pExperienceLevel`** reserve unit of that team+typ via
  `ListGetPosOfMaxByProp`), `newActor`, then `newActor.restoreArmyDetails(armyDetails)` (→
  `modArmyUnit.restoreFromArmyDetails` → each module's `restoreFromSaveData`), `armyTeleportIn`, and
  `restoreUnitToCombat` (315–330) **removes the consumed record** from the reserve. `#armySummon` with an
  empty reserve returns `#none` (you can't summon what you haven't banked). `displayNextSummons` shows the
  next/best per typ.
- `checkUnitAvailability` (65–78): an `#armySummon` spell is only castable if a reserve record exists.

So the army is a **bank**: leaving a room with a summoned ally deposits it (at its current level/stats);
`armySummon` withdraws the best one and re-fields it. The whole bank persists in the save.

### A.5 Real medikit (G3a) — `modMedikit` + `medikitMaster`

`casts/script_objects/modMedikit.txt`: a **stockpiled, gradual** heal, not an instant top-up.

- State: `pNumOfMedikits` (banked kits), `pRemainingHitpoints` (hp left in the *active* kit),
  `pMedikitActive`, `pHealAmount = 1`, `pHealDelayCounter` (`tim[2]=5` → heals every 5 frames).
- `medikitCollected` (101–105): `pNumOfMedikits += 1`.
- `update` (119–128): while `checkEnergyIsAtMax() = false`, call `attemptHeal`; else deactivate.
- `attemptHeal` (50–68): tick the delay counter; on `fin`, if `pRemainingHitpoints > 0` then heal
  `pHealAmount` (`addToEnergy(1)`, decrement remaining, mark active); else `nextMedikit()` — if a banked
  kit exists, consume one (`pNumOfMedikits--`) and refill `pRemainingHitpoints = getMaxEnergy()`.
- `getNumOfMedikits` (82–90): banked + (1 if a partial kit is mid-heal). The HUD count.
- `addSaveData`/`restoreFromSave` (40–117): persists `pHealDelayCounter`, `pRemainingHitpoints`,
  `pMedikitActive`, `pNumOfMedikits`, `pUpdateMedikitDisplay`; restore refreshes the display.
- `medikitMaster.txt` is **display-only** (passes `updateDisplayFromObj` to `objMedikitDisplayer`) — the
  HUD is render domain (agent 5); the heal logic + save live on `modMedikit` (the actor).

### A.6 `potionMaster` counter (G3b)

`casts/master_objects/potionMaster.txt`: *"displays how many potions have been drunk."*

- `pPotionsCollected` (init): a list of records `{character, colour, member, numCollected, counter, icon}`.
- `potionCollected(thePotion)` (167–172): `getPotionRecord` (find-or-create by `character`), `numCollected += 1`,
  `display`.
- `addSaveData` (43–57): writes a stripped list — **only** `{character, colour, member, numCollected}` per
  record (the `counter`/`icon` display objects are NOT serialized; they are re-`request`ed on restore).
- `restoreFromSave` (192–213): clears live display objects, rebuilds each record from the saved fields, and
  re-`requestCounter`/`requestIcon` before `display`. So the **counts** persist; the display widgets are
  reconstructed.

---

## (b) Gap vs the port today — what `save.ts` does not persist

`port/src/systems/save.ts` is the whole of persistence today:
```ts
saveGame(player, room): localStorage[mr_save_v1] = { v:1, room, player: player.send("addSaveData", {}) }
```
It serializes **one entity** (the player's chain: `move/energy/xp/mana/weaponMgr`) plus the current room
loc. On load (`main.ts` 135/167) it just `rooms.enter(s.room)` + `player.send("restoreFromSave", s.player)`.
Concretely missing (04 §3), mapped to the responsible G-step:

| # | Missing state | Original source | G-step |
|---|---|---|---|
| 1 | **Per-room actor state** (every enemy/dwelling/ally's full chain) | `objRoom.pRoomObjects[].addSaveData` | **G1** |
| 2 | **Room-clear / been-activated flags** | `objRoom.pRoomCleared`/`pBeenActivated` | **G1** |
| 3 | Cross-actor references (targets/owners) | `modRelationships` + `restoreTarget` | **G1** |
| 4 | **Army reserve** (`pReserveArmy` by team→typ, per-unit level/stats) | `armyMaster` + `modArmyUnit` | **G2** |
| 5 | **Medikit stock** (`pNumOfMedikits`/`pRemainingHitpoints`/active) | `modMedikit` | **G3a** |
| 6 | **Potion tally** (`pPotionsCollected` per type) | `potionMaster` | **G3b** |
| 7 | Dwelling/construction/resident progress | `modResidents`/`modConstruction` | **G1** (deferrable detail) |
| 8 | Room graves; in-flight bullets/charging spell | `modRoomGraves`; bullets | **out of scope / deferred** |
| 9 | Sound on/off flag (`soundMaster.pActive`) | `soundMaster` | **out of scope** (audio domain; trivial follow-up) |
| 10 | **Version gate** (reject/migrate old saves) | `saveMaster.pSaveVersion = 12` | **G1** |

Port-status classification per slice:
- Player chain serialization: **FAITHFUL** (the four/five component slices already round-trip and are
  unit-tested — these are the proof the cascade pattern works).
- Whole-world save tree: **MISSING**.
- Medikit/maxikit: **PARTIAL/wrong** (`Pickup.apply` `case "heal": en.energy = en.max` — instant full heal,
  no stock, no save).
- Potion counter: **MISSING** (mana potions apply their stat then vanish; no tally).
- Army reserve: **MISSING** (`spawnAlly` fields a generic warrior; no bank, no level persistence).

**Substrate already in place** (do NOT rebuild): the `addSaveData`/`restoreFromSave` ordered fold;
`Entity.id`/`Entity.type`; `registry.resolveActor(name)`; the spawn factories
(`spawnUnit`/`spawnEnemy`/`spawnDwelling`/`spawnAlly`/`spawnPlayer`); `RoomManager.enter`/`spawnObjects`
and its `cleared:Set<number>`; `game.teamMaster` (B1) with team rosters + `findTarget`/unit-map;
`game.entities` as the live actor list; `Counter.save()/restore()` (B2). The actor-type symbol is
recoverable from the spawn tile today but **is not stored on the entity** — G1 must add it.

---

## (c) Concrete design

### C.1 Actor-type tag + a generic actor (de)serializer (foundation for G1/G2)

Every respawn in the original keys off `getActorType()`. The port's entities don't carry it. Add:

- A read-only `actorType: string` on every spawned actor (the bare name, e.g. `"blackOrc"`,
  `"orcVillage"`, `"player"`). Set it in the spawn factories (`spawnEnemy`/`spawnDwelling`/`spawnPlayer`/
  `spawnPickup`) — they already receive `actorName`. Expose via a `getActorType` query handler (mirrors
  `objGameObject.getActorType`).
- A `respawnActor(actorType, x, y) → Entity` dispatcher in `archetypes.ts` that routes a saved type back
  to the right factory (dwelling vs unit vs pickup), reusing the exact `RoomManager.spawnObjects`
  branching (`PICKUPS` map, `objType === "#objDwelling"`, else `spawnUnit`). **Factor that branching out of
  `RoomManager` into a shared `spawnFromSymbol(sym, x, y)` so save-restore and first-spawn cannot drift.**
- `serializeActor(e) = { typ: e.getActorType(), chain: e.send("addSaveData", {}) }` and
  `restoreActor({typ, chain, x, y})` = `respawnActor` then `e.send("restoreFromSave", chain)`. Movement's
  `move.{x,y}` already round-trips position, so `x,y` in the locator are belt-and-braces / for the spatial
  re-acquire; spawn at the saved loc, then restore overwrites finely.

### C.2 The save tree (`SaveData` v2)

Replace the flat `{v, room, player}` with the map→rooms→objects cascade. New shape:
```ts
interface SaveDataV2 {
  ver: number;                 // = SAVE_VERSION (start at 2; bump on any shape change)
  map: string;                 // map id (F1 multi-map: restore must reload the right map first)
  currentRoom: Vec2i;          // pCurrentRoomLoc
  rooms: RoomSave[];           // one per room num, in num order (objMap.pRooms)
  potions: PotionSave;         // g_potionMaster slice (G3b)
  army: ArmySave;              // g_armyMaster slice (G2)
  // sound slice deferred (audio domain)
}
interface RoomSave { num: number; cleared: boolean; activated: boolean; objects: ActorSave[]; }
interface ActorSave { typ: string; x: number; y: number; chain: Record<string, any>; rels?: RelSave[]; }
```

**Where room state lives in the port.** Today `RoomManager` only persists `cleared:Set<number>` in
memory and re-derives everything else from the `#objects` tile layer on each `enter`. The port has **no
standing `pRooms[]` of populated room objects** — a room that isn't current has no live actors (they were
`game.entities.filter(type==="player")`-ed away on the last `enter`). This is the port's analogue of the
original's `pState` snapshot-on-leave, except the port currently keeps **nothing** but the cleared bit.

Two faithful options; pick **Option A** for the G1 slice:

- **Option A (snapshot current room + cleared-set; matches the port's flip-screen model).** On save,
  serialize **only the current room's live `game.entities`** (the actors that exist right now) into its
  `RoomSave.objects`, plus the `cleared` set for every room (as `activated`/`cleared` flags), plus the
  player. Non-current rooms save `objects: []` + their cleared flag. On load: reload the map, restore the
  cleared set, `rooms.enter(currentRoom)` but **suppress the tile-layer spawn for the current room** and
  instead `restoreActor` each saved object. This reproduces the original's observable behavior at slice
  scope: a cleared room stays cleared (its dead don't respawn), and the room you saved in comes back with
  its exact actors. It maps `pRoomCleared` → `cleared`, `pBeenActivated` → `activated`, and the active
  room's `pRoomObjectsToRestore` → `RoomSave.objects`.
  - *Faithfulness note:* the original also remembers the half-cleared state of **previously-visited,
    non-current** rooms via `pState` (H3 territory). The port today already discards that (a non-cleared
    room you re-enter respawns from tiles). Option A preserves the port's *current* behavior through save —
    it does not regress and does not over-reach. Persisting per-room `pState` for all visited rooms is
    **explicitly deferred to H3** and called out in (g).

- **Option B (full `pRooms[]` with per-room snapshot-on-leave).** Introduce a real `RoomState[]` in
  `RoomManager` that snapshots actors when you leave a room (port `freezeObjects`), so every visited room
  round-trips. This is strictly more faithful but pulls in H3 (live room-state on re-entry) and is larger.
  **Recommend deferring to H3**; G1 ships Option A.

`saveGame`/`loadGame` become:
```
saveGame(): build SaveDataV2 from rooms + game.entities + masters; JSON → localStorage
loadGame():  read+parse; if ver !== SAVE_VERSION → return null (reject, like saveMaster.isLoadAvailable);
             else caller reloads map, restores cleared set, restores masters, restores current room.
```

### C.3 The entity-ref serialization strategy (the hard part)

Port the original's **save-by-locator / restore-by-spatial-query** exactly — do NOT serialize
`entity.id` (it is regenerated by `makeEntityId()` on respawn and would dangle).

- **Save:** for any actor holding a committed `#target` (B1's `Targeting`/`CpuAI` commitment), write a
  locator `{ team, teamRole, x, y }` = the target's `getTeam()`/`getTeamRole()`/`getPos()` (mirrors
  `objGameObject.getTargetDetails`). A dead/absent target writes nothing.
- **Restore (deferred pass).** After **all** actors in the batch are respawned and their chains restored
  (so the world is fully populated), run a `restoreRelationships` pass: for each saved locator,
  `target = game.teamMaster.findTargetInTeam(team, {x,y}, "#closestDistance", [[teamRole]])` (B1 already
  has the team-roster + unit-map machinery this needs — `restoreTarget` is a thin wrapper over
  `findTarget`). Re-commit it via the same path `CpuAI` uses to form a `#target`. The nearest live unit of
  that team+role wins — identity is approximate, behavior is faithful.
- **Ordering is mandatory:** relationship restore is **phase 2**, strictly after every `restoreActor`
  (phase 1) — exactly `restoreRoomObjects`'s `newActor` loop → `call(#restoreRelationships, newActors)`.
- **This is the resolution of B1's deferral** ("round-tripping committed targets through save is
  deferred" — B1 plan §401). G1 implements it via the locator pass; targets re-commit on load instead of
  being dropped to `#none`. If even this is too much for the first slice, the safe fallback is "restore no
  relationships; every CpuAI re-acquires next tick via its normal retarget throttle" — still correct,
  just a one-tick re-acquire. **Recommend shipping the locator pass** (it's small and it's the faithful
  behavior); note the fallback as the de-risking option.

### C.4 `armyMaster` reserve store (G2)

A new `ArmyMaster` singleton on `game` (sibling to `teamMaster`), with `pReserveArmy: Map<team, Map<typ,
ArmyDetails[]>>` (the port equivalent of the nested prop-list).

- `ArmyDetails` = the lossy snapshot from `generateArmyDetails`: `{ typ, team, level, stats }` where
  `stats` is what the modules choose to bank — for the slice that is **Experience.level** plus the grown
  mana/strength stats (Mana's `capacity/flow/burst/regeneration`, the strength growth). Deliberately **omit
  energy/position/target/animFrame** (faithful to the comment at `modArmyUnit.generateArmyDetails`). Build
  it via a new `addToArmyDetails` query the way `addToSaveData` works, OR pragmatically by reading
  `Experience.level` + `Mana` directly in `recordUnitDetails` (the slice has few banked modules; a direct
  read is acceptable and documented as the simplification).
- `recordUnitDetails(e)`: `ensureLists`, append `generateArmyDetails(e)` to `[team][typ]`.
- `teleportOut(e)`: the room-leave hook. When the player leaves a room (`RoomManager.enter` transition),
  for each **teleportable ally** (`type==="ally"`, not the player, not a ghost): `recordUnitDetails(e)`
  then remove it from `game.entities` (the port has no teleport animation — `armyTeleportOut` → record →
  `leaveGame` collapses to "bank it and despawn it"; the anim is render-only, out of scope). This is the
  **defining cross-room progression**: allies you summon don't die when you leave — they go to reserve.
- `createUnit(team, typ, startLoc)`: `lookupArmyDetails` (highest-level record via a
  `maxByProp(list, "level")` helper = `ListGetPosOfMaxByProp`), `spawnAlly(typ, …)`,
  `restoreArmyDetails(e, details)` (set `Experience.level` + re-apply per-level growth to reach the saved
  level, restore stats), then `restoreUnitToCombat` **deletes the consumed record**. Empty reserve for an
  `#armySummon` → return null (can't summon an empty bank). This is the substrate the C3 `armySummon`
  spell will call; G2 can wire a dev/test entry point (`summonReserve(team, typ)`) without the full spell.
- `addSaveData`/`restoreFromSave`: the whole nested structure is plain data (`{typ, team, level, stats}`)
  → serialize as nested objects/arrays. No entity refs in the reserve, so this slice has **no** locator
  problem — it's the easy master.

**Level persistence detail (faithful):** `restoreArmyDetails` must reproduce a unit *at* its saved level.
Two faithful routes: (i) spawn then call `Experience` to set `level` and re-run `levelUp` growth
`level-1` times (so strength/mana/energy match a naturally-leveled unit — matches `levelUpToStartingLevel`
semantics), or (ii) store the grown stats directly in `ArmyDetails` and assign them. **Use (i)** — it
reuses B2's level-up growth and keeps `ArmyDetails` minimal (just `{typ, team, level}`), which is closest
to `generateArmyDetails`'s "record level, not health."

### C.5 Real medikit (G3a)

Replace `Pickup.apply` `case "heal"` instant-fill with a faithful `Medikit` component on the player
(mirrors `modMedikit`), added to `PlayerArchetype`:

- State: `numOfMedikits`, `remainingHitpoints`, `active`, `healDelay = Counter(tim:[0,5])`, `healAmount=1`.
- `medikitCollected()`: `numOfMedikits++` (the pickup calls this instead of `en.energy = en.max`).
- `update`: if `Energy` not at max, tick `healDelay`; on fin, if `remainingHitpoints>0` heal 1
  (`Energy.energy = min(max, energy+1)`, decrement, active=true) else `nextMedikit()` (consume a banked
  kit → `remainingHitpoints = Energy.max`). Else `active=false`.
- `addSaveData`/`restoreFromSave`: `{numOfMedikits, remainingHitpoints, active, healDelay: counter.save()}`
  — a new namespaced `medikit` slice in the player chain. **This is why G3a rides on G1**: the slice only
  persists once the player chain is saved as part of the tree (it already is — player is saved today —
  so G3a is independently shippable even before the full tree).
- maxikit = same component, larger graphic (render only) — both pickups call `medikitCollected`.
- HUD count = `getNumOfMedikits()` (banked + partial). Display is agent 5 (out of scope); expose the
  query.

### C.6 `potionMaster` counter (G3b)

A `PotionMaster` singleton on `game` with `potionsCollected: Map<character, { numCollected }>` (the slice
needs only the count + a type key; colour/member are display fields — keep them if cheap, they round-trip
as plain data).

- The mana/heal pickups call `game.potionMaster.potionCollected(potionType)` after applying their effect
  (in `Pickup.apply`), where `potionType` is the pickup's source actor (`manaCapacity`/`manaFlow`/
  `manaBurst`/`medikit`/…). This is purely additive to the existing pickup flow.
- `addSaveData`/`restoreFromSave`: serialize the per-type counts (`potionMaster.pPotionsCollected`
  stripped to `{character, numCollected}`). Plain data, no entity refs.

---

## (d) Step-by-step order — substrate-first, each independently testable

**G1a — actor-type tag + generic spawn/serialize (no behavior change).**
Add `actorType` + `getActorType` to spawn factories; factor `RoomManager.spawnObjects`'s symbol-routing
into a shared `spawnFromSymbol(sym, x, y)`; add `respawnActor`/`serializeActor`/`restoreActor`. **Test:**
`serializeActor(spawnEnemy("blackOrc"))` → `restoreActor` yields an entity with matching
energy/level/position; `spawnFromSymbol` and `RoomManager` spawn identical entities for the same tile.

**G1b — save tree v2 (Option A) + version gate.**
Rewrite `save.ts`: `SaveDataV2`, `SAVE_VERSION`, `saveGame` builds map/currentRoom/rooms(cleared+current-
room objects)/player; `loadGame` rejects mismatched `ver`. Wire `RoomManager` to expose its `cleared` set
+ accept a restore (`enter` with a "don't tile-spawn; use these saved objects" path for the current room).
Update `main.ts` save/load to reload the map first, restore cleared set + current room. **Test:** populate
room 1 (spawn orcs + a dwelling), save, mutate (kill one orc, move player), load → assert actor count,
each actor's energy/level/position, dwelling residents-budget, and `cleared` flags match the saved
snapshot; assert a cleared room re-enters empty.

**G1c — relationship locator pass (resolves B1's deferral).**
Serialize committed-target locators in the actor save; add the phase-2 `restoreRelationships` pass after
batch respawn using `teamMaster.findTargetInTeam`. **Test:** two enemies committed to the player; save;
load; assert each re-commits to a player-side target (nearest by team+role), not `#none`; assert no
dangling-id crash; assert the fallback (skip rels) still leaves AIs that re-acquire next tick.

**G2 — armyMaster reserve.**
Add `ArmyMaster` singleton; `recordUnitDetails`/`generateArmyDetails`/`createUnit`/`lookupArmyDetails`/
`restoreUnitToCombat`; hook `teleportOut` into the `RoomManager` transition for teleportable allies; add
the reserve to `SaveDataV2.army`. **Test:** summon an ally (spawnAlly), level it, leave the room → assert
it's banked at its level and gone from `game.entities`; `createUnit` → assert a re-fielded ally at the
saved level (strength/mana grown), reserve decremented; save/load round-trips `pReserveArmy`; empty-reserve
summon returns null.

**G3a — real medikit.**
Add `Medikit` component to `PlayerArchetype`; repoint `Pickup` heal to `medikitCollected`; add the
`medikit` save slice. **Test:** collect 2 medikits at low health → assert gradual heal (+1/5 ticks),
banked count, `remainingHitpoints` carries the active kit; assert no heal at full energy; save mid-heal →
load → assert `numOfMedikits`/`remainingHitpoints`/active resume.

**G3b — potionMaster counter.**
Add `PotionMaster` singleton; `Pickup.apply` calls `potionCollected`; add the `potions` save slice.
**Test:** drink 3 manaFlow + 1 medikit → assert per-type counts; save/load round-trips
`pPotionsCollected`.

Order rationale: G1a is pure substrate (unblocks everything). G1b is the tree. G1c needs G1b (a populated
world to re-acquire into) + B1. G2 needs G1's serializer + B1's `findTarget`/roster + B2's level growth.
G3a/G3b ride on the player-chain save (already present) and are the smallest — they can land before or
after G2, but after G1a so they share the actor serializer. Each step is `tsc`+`vitest`-green and
in-browser smoke-clean on its own.

---

## (e) Test plan

**Unit (vitest) — round-trip is the core assertion (`save populated room → restore → deep-equal`):**
1. **Actor round-trip:** spawn each of {enemy, dwelling, ally, player}; `serializeActor`→`restoreActor`;
   assert chain fields (energy/max/dead, xp/level/threshold, mana stats, weaponMgr inventory+counters,
   movement x/y, dwelling budget) deep-equal.
2. **Room tree round-trip:** spawn a populated room (≥2 enemies + 1 dwelling + player at a moved
   position); save; clear `game.entities`; restore; assert (a) actor count, (b) per-actor type+energy+
   level+position, (c) `cleared`/`activated` flags per room, (d) a previously-cleared room restores empty.
3. **Entity-ref / relationship:** two CpuAI enemies committed to the player; save; restore; assert each
   has a committed target that is a player-side unit nearest its saved locator; assert restore runs
   strictly after all respawns (no dangling id); assert the no-rel fallback re-acquires within one tick.
4. **Army reserve:** ally summoned + leveled → leave room → banked at level, removed from entities;
   `createUnit` → re-fielded at saved level with grown stats, reserve decremented; `addSaveData`/
   `restoreFromSave` deep-equals `pReserveArmy`; empty-reserve summon → null.
5. **Medikit:** gradual heal cadence (+1 / 5 ticks), stock consumption (`nextMedikit`), no-heal-at-max,
   save/restore mid-heal resumes `remainingHitpoints` + count.
6. **Potion counter:** per-type tally increments; save/restore deep-equals counts.
7. **Version gate:** a save with `ver !== SAVE_VERSION` → `loadGame` returns null (no crash, no partial
   restore); a malformed/legacy `mr_save_v1` blob → null (reject, don't throw).

**In-browser smoke (manual, the keystone integration test):**
- Populate room, take damage, collect a medikit (watch gradual heal), summon an ally and level it, **walk
  to the next room** (ally teleports to reserve, room transition), **walk back** (room re-derives), then
  **save (key `1`) → reload page → load (key `2`)**: assert player position/energy/level, room-clear
  progress, the medikit stock keeps healing, the potion count shows, and `summonReserve` re-fields the
  banked ally at its level. No `pageerror`/console error across the save/load + room transition.
- Regression: room 1 still clears (`enemies:0, exitsOpen:true, errors:none`) with the medikit/potion/army
  wiring present.

---

## (f) Faithfulness risks

1. **Entity-ref round-trip (highest).** The original re-acquires targets **positionally**
   (`restoreTarget`→`findTargetInTeam`), so restored relationships are *approximate by design* — never
   byte-identical. The risk is (a) restoring rels **before** the world is fully respawned (phase
   ordering — must be phase 2), and (b) the port serializing `entity.id` by habit (it would dangle —
   `makeEntityId` regenerates). Mitigation: locator-only saves; mandatory deferred pass; the "skip rels,
   re-acquire next tick" fallback as the safety net. This is also the **resolution of B1's explicitly
   deferred committed-target-through-save** — call it out as closed by G1c.
2. **Multi-phase rebuild order.** `objMap.restoreFromSave` is strict: clear current room → **finish ALL
   live actors** → restore each room by index (same order assumed) → move to current room (which respawns
   it) → relationships. Skipping the "finish all actors first" step double-populates; restoring rooms out
   of `pNum` order corrupts the cleared flags. The port must tear down `game.entities` (keep nothing, not
   even the player until re-added) before restoring, and key rooms by `num`. PLAN_REVIEW §1: **character
   before AI** on restore (Experience/Energy before the brain reads them) — the archetype chain order
   already enforces this within an actor; the per-batch passes enforce it across actors.
3. **Save-format versioning.** Bump to `SAVE_VERSION = 2` and **reject** (not migrate) mismatches, like
   `saveMaster.isLoadAvailable`. The current code has a back-compat branch in `WeaponManager.restoreFromSave`
   for pre-B2 player blobs; with a hard version gate that branch becomes unreachable for whole-tree saves
   — keep it only if old `mr_save_v1` player-only saves must still load (recommend: new key `mr_save_v2`,
   old key ignored, gate returns null → clean break, documented).
4. **`generateArmyDetails` is intentionally lossy.** Banking energy/position/target would re-field a
   half-dead ally frozen mid-fight. Mitigation: bank **level only** and rebuild stats via B2 level-up
   growth (route (i) in C.4) — matches the original's "record level, not health."
5. **Determinism of restore-time respawns.** Dwelling production + level-up mana rolls use `game.rng`;
   the original `random()` isn't reproducible (PLAN_REVIEW §4). A restored dwelling's *future* residents
   won't byte-match. Keep army/medikit/potion tests on the **deterministic** state (level, counts, stock),
   never on a specific RNG outcome.
6. **Option A vs the original's per-room `pState`.** The port saves the current room's actors + a
   cleared-set, not every visited room's half-cleared snapshot. A non-current, non-cleared room restores
   from tiles (its in-progress damage is lost). This matches the port's *current* flip-screen behavior and
   is not a regression, but it is **less** than the original — flag it and tie the gap to H3.
7. **Teleport-out trigger coupling (G2).** The original teleports on `armyTeleportOut`/`#leaveGame` with a
   `pTeleportable` guard and a `pTeleportOutStarted` latch (Merlin/ghosts excluded). The port collapses
   the animation away; the risk is double-banking (latch) or banking the player (guard). Mitigation: bank
   only `type==="ally"` && not ghost && once per leave; honor the latch.

---

## (g) Explicitly out of scope

- **Multiple save slots / profiles.** Original is *"one savegame per local computer"*
   (`saveMaster` header) — single slot only. No `profileMaster`.
- **Copy protection.** `copyProtectionMaster` (license web-check, disabled on Mac) — never port.
- **`XMLmaster` serialization.** Original stringifies a prop-list; the port uses JSON — equivalent, no XML.
- **Render-only HUD:** `medikitMaster`/`objMedikitDisplayer`, `potionMaster.display`/counters/icons,
   `armyMaster.displayNextSummons`/`showArmyMaster` grid, `objMmap.pMiniMap` — agent 5. G-phase exposes
   the queries (`getNumOfMedikits`, counts, reserve) and saves the state; drawing them is H/agent-5.
- **`soundMaster.pActive` save slice** — trivial audio-domain follow-up; not in this slice (no behavior
   gated on it yet).
- **Per-room `pState` snapshot-on-leave for all visited rooms** (the original's live half-cleared
   room-state on re-entry) — **deferred to H3**. G1 ships Option A (current room + cleared-set).
- **In-flight bullets / charging-spell round-trip, room graves, multi-stage spell-icon restore,
   construction-stage art** — the original saves these on the active-room path; the port slice restores
   actors at rest. Deferred (note them so the chain shape leaves room).
- **The teleport-in/out animation, GMG/wizard/star/magicLimit masters** — separate backlog rows
   (C-phase / agent 5).

---

## Appendix — cited Lingo handlers (file : handler : lines)

- `saveMaster.txt` : `saveGame` 71–101, `loadGame` 38–54, `isLoadAvailable` 21–36, `pSaveVersion=12` init.
- `objMap.txt` : `addSaveData` 233–246, `restoreFromSave` 632–656.
- `objRoom.txt` : `addSaveData` 169–185, `restoreFromSave` 600–611, `activate` 110–137,
  `restoreRoomObjects` 613–653, `restoreState` 655–701, `saveState`/`freezeObjects` 277–287 / 723–746,
  `getRoomObjects` 462–478, `getRecordInRoomState` (via objGameObject 506).
- `objGameObject.txt` : `getActorType` 399, `getTargetDetails` 542–555, `getRecordInRoomState` 506.
- `modRelationships.txt` : `getRelationshipsTargetDetails` 132–148, `restoreFromSave` 150–154,
  `restoreRelationships` 156–187.
- `teamMaster.txt` : `restoreTarget` 1297–1306 (→ `findTargetInTeam`).
- `armyMaster.txt` : `pReserveArmy`/`addSaveData` 57–59, `restoreFromSave` 309–313, `createUnit` 80–108,
  `recordUnitDetails` 280–307, `lookupArmyDetails` 251–268, `restoreUnitToCombat` 315–330,
  `checkUnitAvailability` 65–78, `displayNextSummons` 151–206.
- `modArmyUnit.txt` : `generateArmyDetails` 80–93, `armyTeleportOut` 57–78, `internalEvent`
  (`#teleportOutFinished`) 99–121, `restoreArmyDetails`/`restoreFromArmyDetails` 123–142.
- `modMedikit.txt` : `attemptHeal` 50–68, `nextMedikit` 92–99, `medikitCollected` 101–105, `update`
  119–128, `addSaveData`/`restoreFromSave` 40–117, `getNumOfMedikits` 82–90.
- `potionMaster.txt` : `potionCollected` 167–172, `addSaveData` 43–57, `restoreFromSave` 192–213.
- `medikitMaster.txt` : display-only (`updateDisplay` 40–43).
- `modResidents.txt` : `releaseResident` 146–171, `startProduction` 178–192 (dwelling state context).
