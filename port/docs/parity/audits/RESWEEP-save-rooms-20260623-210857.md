# RESWEEP — SAVE/LOAD round-trip + ROOM progression/exits (2026-06-23)

Charter: AUDIT-CHARTER.md. Two whole features driven end-to-end against the cast, not method-by-method.
Probes (gitignored, removed-after): `tools/_audit_resweep_{army,rooms,active,exits,weapon}.ts`. Derived
"correct" from `casts/master_objects/{saveMaster,armyMaster,potionMaster,soundMaster}.txt` +
`casts/script_objects/{objMap,objRoom,objGameObject,modArmyUnit,modExperience,modEnergy,
modCharacterAttackProperties,modMedikit,modExtraLives,modResidents}.txt`.

**Verdict: SAVE = mostly faithful, ONE real gap (army bank stats); ROOMS/EXITS = CLEAN (a stale "PARTIAL"
note was already fixed).** The army system again looks "CLEAN" by code-shape but diverges behaviorally —
exactly the failure-mode-#1/#8 trap the charter warns about, and the existing `save.test.ts` only asserts
`level` so it masks it.

---

## GAP 1 (REAL) — Army bank re-derives grown stats instead of restoring them (mana randomized, potions lost, energy inflated)

**Mechanic.** Leaving a room banks a summoned ally into `g.armyMaster.pReserveArmy`; `armySummon` / a new
room withdraws and re-fields it. The cast banks the unit's EXACT grown stats and restores them directly;
the port banks **level only** and re-derives every grown stat by replaying level-ups.

**Original (cast).** `modArmyUnit.generateArmyDetails` (modArmyUnit.txt:80-93) fires
`internalEvent(#addToArmyDetails)`, which fans out to EVERY module's `addToArmyDetails`. The contributing
modules write the *actual* grown values:
- `modExperience.addToSaveData` (modExperience.txt:73-80): `pExperienceLevel` + thresholds + `pLevelData`.
- `modCharacterAttackProperties.addToSaveData` (modCharacterAttackProperties.txt:89-98): **`pAgility,
  pDexterity, pEyestrain, pManaBurst, pManaCapacity, pManaFlow, pManaRegeneration, pStrength`** — the exact
  current values (which already bake in potion gains and the specific random per-level rolls).
- `modEnergy` has **NO `addToSaveData`** (verified: `grep -c "on addToSaveData" modEnergy.txt` → 0). So
  energy/maxEnergy is NOT in army details.

Re-field: `armyMaster.createUnit` (armyMaster.txt:80-108) spawns a fresh default unit, then
`restoreArmyDetails` → `modArmyUnit.restoreFromArmyDetails` (modArmyUnit.txt:129-132) →
`modExperience/modCharacterAttackProperties.restoreFromSaveData` SET those properties **directly** and never
fire `#levelUp`. Net cast behavior: re-fielded unit has its **exact** banked level/mana/strength but
**spawn-default maxEnergy** (energy grows via `#levelUp` → `modEnergy.levelUpEnergy`, which never replays).

**Port (`port/src/systems/armyMaster.ts`).** `ArmyDetails = {typ, team, level}` (armyMaster.ts:16);
`generateArmyDetails` records level only (armyMaster.ts:25-31); `restoreArmyDetails` (armyMaster.ts:95-97)
re-fields by calling `forceLevelUp` from spawn-level up to `level`. `forceLevelUp` (experience.ts:50-57)
fires `levelUp`, so:
- `Mana.levelUp` (mana.ts:33-41) rolls a **`game.rng.next()` random** stat each level — different from the
  unit's actual earned distribution.
- `Energy.levelUp` (combat.ts:127-131) **grows maxEnergy** each level — the cast does not.
- Potion gains (`Mana.incCapacity` +0.75 etc.) are never replayed — **lost**.

**Driven evidence (`_audit_resweep_army.ts`).** A warrior leveled 4× + one capacity potion, banked, re-fielded:
```
BANKED   : level 4, capacity 12.75, flow 1,   burst 1,   regeneration 1.20
REFIELDED: level 4, capacity 11,    flow 1.1, burst 1.1, regeneration 1.1   (mana match: FALSE; potion: LOST)
fresh warrior spawn maxEnergy: 300  (= the value the CAST re-fields at)
port re-fielded warrior maxEnergy: 312  (port inflates it via replayed level-ups)
```
Only `level` matches — which is all `save.test.ts:147-155,196-198` asserts (charter taxonomy #8: the test
locks the port's lossy behavior in green).

**Fix sketch.** Make `ArmyDetails` carry the grown stats the cast banks, and restore them by assignment
(no level-up replay):
- `armyMaster.ts:16` — extend `ArmyDetails` with `mana:{capacity,flow,burst,regeneration}`,
  `strength`, `agility`, `dexterity` (read via getters on bank).
- `generateArmyDetails` (armyMaster.ts:25-31) — snapshot those live values, not just level.
- `restoreArmyDetails` (armyMaster.ts:95-97) — set `Experience.level` directly and **assign** the banked
  mana/strength onto the `Mana`/combat components; do NOT call `forceLevelUp` (so Energy stays at spawn
  default, matching the cast's no-`#levelUp` replay). If level-derived sprite size / thresholds are needed,
  set `Experience` fields directly like `modExperience.restoreFromSaveData` does.
- Bump `ArmyDetails` shape + `addSaveData`/`restoreFromSave` (armyMaster.ts:128-151) to (de)serialize the new
  fields; bump `SAVE_VERSION` (save.ts:17) since the reserve blob shape changes.
- Update `save.test.ts` G2 to assert mana/strength/energy parity against a *banked* unit (cast intent), not
  just `level` — the behavioral repro the charter requires.

---

## GAP 2 (MINOR / DIVERGENCE) — Extra-lives persistence: port saves what the cast drops; life-powerup progress lost in both

**Mechanic.** `modExtraLives` banks extra lives + progress toward the next life (`pLifePowerUpsCollected`,
100 hairGems = 1 life).

**Original (cast).** `modExtraLives` (modExtraLives.txt, whole file) has **NO `addSaveData`/`restoreFromSave`**
— only `attemptRespawn/respawn/recordRespawnPoint/lifePowerUpCollected`. So on load the module re-inits to
`params.extraLives` (default 0) and `pLifePowerUpsCollected = 0`: **the cast loses banked lives AND progress
on save/load.**

**Port (`port/src/components/extraLives.ts`).** DOES persist `lives` (extraLives.ts:48-55), so a save/load
keeps extra lives — *more* faithful to player expectation but a behavioral divergence from the cast. Neither
the cast nor the port persists `pLifePowerUpsCollected` (the port doesn't model it at all).

**Severity.** Low — shipped config banks 0 lives, and the port erring toward *keeping* player state is benign.
Flagged per charter-#3 (don't trust a divergence silently). `_audit_resweep_rooms.ts` confirmed lives=2
round-trips in the port.

**Fix sketch.** Decide intent. If matching the cast literally: drop `lives` from
`ExtraLives.addSaveData/restoreFromSave` (it would reset to 0 on load). If keeping the port's improvement
(recommended): leave lives, and additionally track + persist life-powerup progress so a near-complete life
isn't silently dropped (add `pLifePowerUpsCollected` to the component + its save slice). Either way, document
the chosen divergence at extraLives.ts:48.

---

## CLEAN — with behavioral evidence

### C1. Whole-world save tree shape (saveMaster.saveGame) — FAITHFUL
`save.ts buildSave` mirrors `saveMaster.saveGame` (saveMaster.txt:71-101): currentMap (rooms+pState) +
potion + sound + army masters. `soundMaster.addSaveData` saves only `pActive` (mute) (soundMaster.txt:99-101)
→ port saves `{muted}`. `potionMaster.addSaveData` strips to `{character,numCollected}`
(potionMaster.txt:43-57) → potionMaster.ts:26-29 identical. Version-gate reject (no migration) matches
`isLoadAvailable` (saveMaster.txt:21-36). **Driven (`_audit_resweep_rooms.ts`):** player pos/energy/max/
level/xp, medikits, lives, potions, army-count, cleared-set [1,2] all round-trip exactly.

### C2. Active-room restore (objRoom.restoreRoomObjects path) — FAITHFUL, no double-spawn
The cast distinguishes the active room (restored from live `pRoomObjects` via `restoreRoomObjects`,
objRoom.txt:121-127,613-653) from non-active rooms (`pState`/`restoreState`, objRoom.txt:655-701). The port
collapses both into `pState` but reaches the same result: `restoreInto` → `enter(restoreObjects)` bypasses
`spawnObjects` and respawns the snapshot. **Driven (`_audit_resweep_active.ts`):** a damaged-but-alive orc
(energy 333, moved to 150,175) restored at exactly energy 333 / pos 150,175, enemies=1 (NOT double-spawned).

### C3. Cleared-room flags + dead-stay-dead on re-entry — FAITHFUL
`_audit_resweep_rooms.ts`: room 2 cleared, its orc dead, save→load→re-enter room 2 → orc returns `dead=true`,
map-clear does NOT re-fire (`won` stays 1). Matches the cast (a dead actor is still `recordInRoomState=true`
— only the powerup-writing object flips it false, objPowerUpWriting.txt:41 — so it persists as a grave; cleared
set gates the fresh tile-spawn off).

### C4. Locator-based target restore (the "wrong owner" suspect) — FAITHFUL (matches cast, incl. its limits)
`actorSerial.ts:97` saves committed AI targets as a POSITIONAL `rel` locator (never an entity id);
`teams.ts restoreTarget:179-195` re-acquires the nearest live unit of the saved team+role — byte-faithful to
`teamMaster.restoreTarget` → `findTargetInTeam(team, sprLoc, #closestDistance, [[teamRole]])`
(teamMaster.txt:1297-1306). Exact identity isn't preserved, but the cast itself documents this
(objRoom.txt:691 "*** merlin's spells will often find the wrong owner ***"). No id leakage
(`save.test.ts:137` asserts no `"id"` in the blob). Port matches intent including the accepted imprecision.

### C5. Dwelling spawn-budget NOT persisted — FAITHFUL (surprising, but matches)
`Dwelling` (dwelling.ts) has no save methods; a partially-spent spawner resets to full budget on load. This
LOOKS like a dropped field, but the cast's `modResidents` (modResidents.txt) also has **no
`addSaveData`/`restoreFromSaveData`** (verified) — `pResidentsRemainingCounter` re-inits to `pTotalResidents`.
So both reset to full. Port faithful. (The dwelling's HP *does* persist via `Energy`, matching `modEnergy`.)

### C6. Medikit stockpile + weapon inventory round-trip — FAITHFUL
`Medikit` (medikit.ts:74-92) persists `numOfMedikits/remainingHitpoints/active/healDelay` exactly per
`modMedikit.addSaveData` (modMedikit.txt:40-48); `getNumOfMedikits` = banked + (1 if mid-heal)
(modMedikit.txt:82-90 ≡ medikit.ts:31). `WeaponManager.addSaveData` (weapon.ts:383-409) persists the whole
inventory. **Driven (`_audit_resweep_weapon.ts`):** a collected `energyBlast` → `getHasSpell` true survives
save/load; `_audit_resweep_rooms.ts`: 3 banked medikits round-trip.

### C7. ROOM EXITS — per-tile bilateral exit ranges — CLEAN (05-world-render-shell.md:49 "PARTIAL" is STALE)
The 05 note claims the port models exits as a whole-edge boolean and "lets you cross anywhere along a cleared
edge." **That note is out of date** — the K22/exit-mask work superseded it. `rooms.ts edgeExitMask:277-300`
builds a per-index BILATERAL mask (passable only where THIS room AND the facing neighbour are both `#none`);
`collision.ts solidCell:195-211` gates out-of-bounds crossing to mask cells; the exit-arrow runs derive from
the same mask (no drift). **Driven (`_audit_resweep_exits.ts`):** room 1 right edge fully open beside room 2
whose left edge is walled except row 2 → `exitMask.right = [0,0,1,0,0,0]`, and the right border is passable
ONLY at row 2 (the doorway). The player cannot cross where the neighbour is walled. Per charter-#3, the doc
note should be corrected to **DONE**, not left as a standing "PARTIAL" suspect.

### C8. Win triggers + room-clear across transitions — FAITHFUL
`rooms_h3.test.ts` (passing) + `RoomManager.markCleared:371-382` fire `onMapClear` on the two cast triggers
(reach+clear `#endRoom` OR clear-all, objMap.txt:248-252,499-507). Bullets/effects are dropped on transition
(`enter:102,115`); summoned allies bank via `onLeaveRoom` and re-field via `onEnterRoom` (the army-bank seam —
but see GAP 1 for the stat fidelity once re-fielded). `restoreCleared:177-181` latches `won` so a loaded
fully-cleared map doesn't re-fire the win.

---

## Note (not a gap): single-map load gate
`main.ts doLoad:168` rejects a save whose `map` differs from the currently-loaded map id
(`flash("save is for a different map")`). The cast's `loadGame` always restores into the current map
(saveMaster.txt:47-48). In practice loadGame is only invoked in-map (pause menu / post-wasted reload), so the
map always matches and this never bites — but a true cross-map load would need `main.ts` to reload the saved
map id first (the `save.ts:27` comment claims "restore reloads the right map first"; the wiring at doLoad does
not). Low priority; flagged for accuracy.
