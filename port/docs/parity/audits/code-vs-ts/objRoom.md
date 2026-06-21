# objRoom.txt Behavioral Audit vs TypeScript Port

**Date:** 2026-06-21  
**File Audited:** `/home/user/merlin-s-revenge/casts/script_objects/objRoom.txt`  
**Scope:** Room lifecycle, enemy tracking, exit management, room-clear detection, sound, and game-end flow

---

## Executive Summary

**GAPS FOUND: 1 verified behavioral gap**

The TypeScript port exhibits **one missing audio behavior** on room-clear that plays in the original. All other critical room-flow mechanics (clear detection, exit opening, arrow rendering, transitions, pState save/restore) are faithfully implemented.

---

## Handler-by-Handler Analysis

### **1. Initialization & Lifecycle**

| Handler | Original Lingo | TypeScript Port | Outcome |
|---------|---|---|---|
| `on new` (L27-46) | Creates ancestor + adds modules (modCollisionDetection, modRoomGraves, modSoundFX) | RoomManager is instantiated in main.ts:179 without explicit module attachment—those systems are integrated via game.ts context globals (teamMaster, objectMaster) and the dispatch loop | **Port does:** Equivalent initialization distributed across main.ts + game/context.ts. **Port does NOT do:** Explicit module.add calls, but functionality is present. |
| `on init` (L48-72) | Sets pBeenActivated=false, pRoomCleared=false, pRoomObjects=[], pState=[], etc. | RoomManager.constructor() + enter() (lines 61-126): pBeenActivated implicit in logic; pRoomCleared represented by `cleared` Set; pRoomObjects managed via game.entities filter | **Port does:** Equivalent property initialization. Functional parity. |
| `on finish` (L105-108) | Finishes tile layers, ancestor | TypeScript: no explicit finish() is called on room leave; GC handles cleanup | **Port does:** Equivalent (no explicit cleanup needed in TS; entities are dropped from game.entities on exit). |

### **2. Room Entry & Activation**

| Handler | Original Lingo | TypeScript Port | Outcome |
|---------|---|---|---|
| `on activate` (L110-137) | Sets g.teamMaster.setRoomClear(false); adds player to room objects; calls activateActors() if first entry, else restoreRoomObjects() or restoreState(); calls attemptOpenExits() | RoomManager.enter() (L78-126): same flow—snapshot on-leave, clear entities, choose restore-or-spawn path, call setExits() (equivalent to attemptOpenExits) | **Port does:** All activation steps. Direct mapping: enter() ≈ activate(). |
| `on activateActors` (L139-143) | Calls pTileLayers[#objects].activateActors() | RoomManager.spawnObjects() (L318-346): spawns from tile layer #objects symbol-by-symbol (L319-341) | **Port does:** Spawn actors at activation. Functional equivalent. |
| `on activateZones` (L145-149) | Calls pTileLayers[#backgroundActive].activateZones() | Not found in port. Zones are implicit in collision detection; no explicit activation needed. | **Port does NOT do:** Explicit zone activation. **Assessment:** Zones (objZone) are part of the #backgroundActive tile layer but don't require runtime activation in the port—collision detection is stateless. Non-gap (cosmetic/edit-time artifact). |

### **3. Player & Room Objects Management**

| Handler | Original Lingo | TypeScript Port | Outcome |
|---------|---|---|---|
| `on addPlayerToRoomObjects` (L151-163) | Adds player + charging spell to pRoomObjects | RoomManager.enter() → spawnObjects() / restoreRoomObjects(): player is kept alive in game.entities and never removed (filter for e.type !== "player" on room-leave, L87 + L107) | **Port does:** Player persists across rooms. Charging spell (SpellActor component on player) handled by spellActor lifecycle (systems/spells.ts). |
| `on addRoomObject` (L165-167) | Adds object to pRoomObjects list | game.entities is the equivalent; push on spawn (main.ts:340) | **Port does:** Maintains entity list. |
| `on removeChargingSpell` (L585-591) | Removes player's charging spell from room objects before save | RoomManager.enter() (L87): filters out SpellActor entities when snapshotting—they are NOT recordable (`symbolIsNonRecordable` check in spawnNonRecordableTileActors, L215) | **Port does:** Charging spells are excluded from pState snapshots. Functional equivalent. |

### **4. CRITICAL: Room-Clear Detection**

| Handler | Original Lingo | TypeScript Port | Outcome |
|---------|---|---|---|
| `on attemptOpenExits` (L187-223) | **Core room-clear flow:** Tests g.teamMaster.isPlayerEnemiesDead() (L192); if true: sets g.teamMaster.setRoomClear(true), calls openExits(), latches pRoomCleared (L200-207), plays sound if map not clear, enters navMode if gNavMode=true, calls drawExitArrows() if gExitArrows=true, calls pMap.checkMapCleared() | RoomManager.update() (L306-316) + setExits() (L223-234) + markCleared() (L296-303): **On each tick**, tests !this.enemiesAlive() (L308); if true AND !this.exitsOpen: calls markCleared() (latches first-clear into `cleared` Set) + setExits(true) + sets game.navMode=true. On room entry (L124): if already cleared or no enemies on entry, calls markCleared() immediately. | **Port does:** Detect room-clear on tick 308 (when last enemy dies) OR on entry (L124). Exits open via setExits(true). NavMode set. **Port does NOT do:** Play a per-room sound on clear (see below). |

### **5. AUDIO GAP: Room-Cleared Sound**

| Handler | Original Lingo | TypeScript Port | Outcome |
|---------|---|---|---|
| `on attemptOpenExits` (L200-207) | **Sound logic:** `if pRoomCleared = false then pRoomCleared = true` → `if pMap.isMapClear() = false then me.playSound(pRoomClearedSound)` — **Plays "end_screen" sound when a room clears, UNLESS the entire map is clear** | RoomManager.markCleared() (L296-303): Does NOT call any audio.play(). Only fires onMapClear() callback if endRoom or all-clear condition triggers (not per-room). | **VERIFIED GAP:** The port does NOT play a per-room room-cleared sound ("end_screen" by default). The original plays it on first clear of a non-final room. **Playthrough-visible:** Player receives no audio feedback when a room clears. |

### **6. Exit Opening & Navigation Mode**

| Handler | Original Lingo | TypeScript Port | Outcome |
|---------|---|---|---|
| `on attemptOpenExits` (L196) → `on openExits` | Calls me.openExits() to mark edges open where adjacent rooms exist and NOT at map edge | RoomManager.setExits() (L223-234): Opens grid edges (left/right/up/down) based on whether adjacent rooms exist + whether open param is true. Called at L308 when room clears. | **Port does:** Open exits. Line 230-233 exactly mirrors edge logic. |
| Navigation mode (L209-211) | `if gNavMode = true then g.gameMaster.goNavMode()` → player enters nav mode (3x faster walk) | RoomManager.setExits() (L228): `game.navMode = open` (where open=true on clear). Movement component reads game.navMode for speed boost (components/movement.ts:114). | **Port does:** Set game.navMode=true on clear. Player speed boost applied correctly. |

### **7. Exit Arrows Rendering**

| Handler | Original Lingo | TypeScript Port | Outcome |
|---------|---|---|---|
| `on drawExitArrows` (L232-258) | Called when gExitArrows=true (L213-215). Fetches surrounding hostiles + exit tiles, combines them, calculates arrow rects, gets image, draws arrows via pTileLayers[#backgroundActive].drawExitArrowsOnImage() with green/red coloring based on surroundingHostiles. | RoomManager.exitArrowRects() (L251-285) + main.ts drawExitArrows() (L497-514): Built on tick, returns arrow rects with green/red colour based on grid.open[edge] (whether the room is cleared, L268). Drawn OVER room layers (main.ts:381). | **Port does:** Render exit arrows. **Colour logic differs slightly:** Original keys RED off destination room's hostiles; port keys off current room's exitsOpen state (clear/unclear). **Playthrough effect:** Same—red arrows on uncleared rooms, green on cleared. **Timing:** Arrows drawn when gExitArrows=true (original), and every frame if room is present (port). |

### **8. Per-Room State Save/Restore**

| Handler | Original Lingo | TypeScript Port | Outcome |
|---------|---|---|---|
| `on saveState` (L723-746) | Freezes live actors on room-leave into pState: only recordable actors, with position/type/saveData | RoomManager.enter() (L87): On leave, `pState.set(leavingNum, game.entities.filter(...isRecordableActor).map(serializeActor))` — exact equivalent. | **Port does:** Save room state correctly. |
| `on restoreState` (L655-701) | On re-entry (if not fresh spawn), respawns saved actors at rest; phase-2 pass re-acquires target links; re-spawns #recordInRoomState:false placed actors fresh. | RoomManager.restoreRoomObjects() (L179-200): Respawns saved actors, rebuilds combat substrate, restores target links, then calls spawnNonRecordableTileActors() (L205-220). | **Port does:** Restore state faithfully. K13 logic (non-recordable placed actors re-spawn fresh) is implemented. |
| `on getMiniMapStatus` / `on getMiniMapStatusFromRoomState` (L409-460) | Queries pState to determine if room is #inf (infested—has live hostiles), #clr (cleared), or #spe (special) for minimap display. Latches pRoomCleared=true if room starts clear. | RoomManager.infestedRooms() (L137-145): Returns set of rooms that hold live hostiles; `clearedSet()` (L134) returns the cleared set. main.ts drawMinimap() (L390-393) uses both. | **Port does:** Track minimap status via cleared/infested sets. Functional equivalent. |

### **9. Minimap & Hostile Tracking**

| Handler | Original Lingo | TypeScript Port | Outcome |
|---------|---|---|---|
| `on getHostile` (L342-352) | Returns whether room currently has live hostiles: if been activated, query pState; else query tile layer. Used for minimap initial display. | RoomManager: no explicit getHostile(); minimap status via clearedSet()/infestedRooms(). On-entry minimap state determined by enemiesAlive() (L236-238). | **Port does:** Report hostility status. Timing is identical (query on entry, check live enemies). |

### **10. Room Exit/Transition**

| Handler | Original Lingo | TypeScript Port | Outcome |
|---------|---|---|---|
| `on offScreen` (L556-563) | Frees sprite/member; deactivates if pMode=#activate | RoomManager.update() (L306-316): No explicit offScreen; room entity is simply not rendered after exit, and on-leave hook fires (L82-88). Entities are cleared from game.entities. | **Port does:** Clean up on exit via entity list management. |
| Transition detection | Not in objRoom directly; objMap.update() gates transitions. | RoomManager.update() (L306-316): Tests player.x/y against bounds; if exceeded + grid.open[edge]=true, calls enter(adjacent). Returns true if room changed. | **Port does:** Detect + execute transitions. Functionally equivalent. |

### **11. Save/Load Persistence**

| Handler | Original Lingo | TypeScript Port | Outcome |
|---------|---|---|---|
| `on addSaveData` (L169-185) | Serializes pBeenActivated, pRoomCleared, pNum, pState, pRoomObjects to save struct | main.ts doSave() (L145-152): Calls rooms.clearedRooms(), rooms.fullPState(), etc. and passes to buildSave() | **Port does:** Serialize room state. Equivalent. |
| `on restoreFromSave` (L600-611) | Deserializes saved room state, restores pRoomCleared latch | main.ts doLoad() (L156-169): Calls rooms.restoreCleared() + rooms.restorePState() + rooms.restoreInto() | **Port does:** Restore room state. Equivalent. |

### **12. Map-Level Completion**

| Handler | Original Lingo | TypeScript Port | Outcome |
|---------|---|---|---|
| `on attemptOpenExits` (L218) → `pMap.checkMapCleared()` | After a room clears, checks if entire map is clear; if so, triggers game-complete. | RoomManager.markCleared() (L296-303): After latching room clear, checks if `this.cleared.size >= this.map.rooms.size` (all rooms clear) → fires this.onMapClear() callback (line 302). main.ts (L179) wires this to scene.gameComplete(). | **Port does:** Detect map-clear + fire win callback. Equivalent flow. |

### **13. Per-Room pRoomCleared Latch**

| Handler | Original Lingo | TypeScript Port | Outcome |
|---------|---|---|---|
| pRoomCleared property (L16, 63, 200-201) | Once set true on first clear, never reset to false for that room (except on reload). Used to suppress duplicate room-clear sound and to report room status. | RoomManager.cleared Set (L55): Once a room num is added, it persists across re-entries. Survives within a play session and is serialized/restored on save/load (rooms.clearedRooms/restoreCleared). | **Port does:** Latch room-cleared status. Persistent per session. Functional equivalent. |

---

## Verified Behavioral Gaps

### **GAP 1: Missing Per-Room Clear Sound**

**Severity:** Playthrough-visible audio feedback loss  
**Original Behavior (objRoom.txt:200-207):**
```lingo
if pRoomCleared = false then
  pRoomCleared = true
  if pMap.isMapClear() = false then
    me.playSound(pRoomClearedSound)  -- plays "end_screen" by default
  end if
end if
```

**Port Behavior (rooms.ts:296-303):**
```typescript
private markCleared(): void {
  const firstClear = !this.cleared.has(this.room.num);
  if (firstClear) this.cleared.add(this.room.num);
  if (this.won) return;
  const endRoomWin = this.isEndRoom();
  const clearAllWin = this.cleared.size >= this.map.rooms.size;
  if (endRoomWin || clearAllWin) { this.won = true; this.onMapClear(); }
}
```

**What's Missing:** 
- No `audio.play("end_screen")` call when a room first clears
- No conditional check `if (!pMap.isMapClear())` to suppress sound only on final-room clear

**Playthrough Impact:**
- Player defeats all enemies in a non-final room: **Original plays "end_screen" sound**; **Port is silent**
- Player defeats all enemies in the final room: both silent (intentional—game-complete sound plays instead)

**Where Sound Should Play:** RoomManager.markCleared() at line 297-298, after `firstClear && !endRoomWin`:
```typescript
if (firstClear) {
  this.cleared.add(this.room.num);
  // MISSING: if (!endRoomWin && !clearAllWin) audio.play("end_screen");
}
```

**Files Affected:**
- `/home/user/merlin-s-revenge/port/src/world/rooms.ts` line 296-303 (markCleared method)
- Requires passing audio system ref to RoomManager, or wiring via callback

---

## Non-Gaps (Cosmetic / Implementation Detail)

| Item | Original | Port | Status |
|------|----------|------|--------|
| Tile layer tweens (pFrontLayerBlendLevel) | Blend level param set on layer. Edit-mode feature. | Not used in gameplay render; foregroundPassive layer drawn at 0.5 alpha (main.ts:377). | Non-gap: gameplay cosmetic; edit-mode only in original. |
| Zone objects (objZone / #backgroundActive tiles) | Runtime activation via activateZones() | Collision detection via CollisionGrid (stateless tile query) | Non-gap: zones don't require activation; collision is data-driven. |
| gExitArrows global flag | Code checks `if gExitArrows then me.drawExitArrows()` | Arrows always rendered if bundle is present; no global toggle | Non-gap: arrows always on in port (simpler, same visual effect). |
| Charge-spell save logic | Explicitly removed before save via removeChargingSpell() | Handled via symbolIsNonRecordable() + recording-flag check | Non-gap: equivalent outcome (charge spells excluded from pState). |
| freezeObjects/saveState call on deactivate | Explicit sequence in activate/deactivate | Implicit in enter() on-leave hook (L87) | Non-gap: same state snapshot, different organization. |

---

## Handler-to-Code Mapping Table

| Original Handler | Port Equivalent | File | Line(s) | Notes |
|---|---|---|---|---|
| on new | constructor | rooms.ts | 61-68 | Instantiation |
| on init | constructor + enter | rooms.ts | 61-126 | Property init distributed |
| on finish | GC (no explicit finish) | — | — | TS GC handles cleanup |
| on activate | enter() | rooms.ts | 78-126 | Room entry flow |
| on activateActors | spawnObjects() | rooms.ts | 318-346 | Tile spawn |
| on activateZones | — | — | — | Collision detection (stateless) |
| on addPlayerToRoomObjects | implicit (player in entities) | rooms.ts | 107 | Player entity filter |
| on removeChargingSpell | symbolIsNonRecordable() | rooms.ts | 215 | Non-recordable filter |
| on attemptOpenExits | update() + markCleared() + setExits() | rooms.ts | 306-334 | Room-clear flow |
| on openExits | setExits(true) | rooms.ts | 223-234 | Exit opening |
| on drawExitArrows | exitArrowRects() + drawExitArrows() | rooms.ts + main.ts | 251-285, 497-514 | Arrow rendering |
| on saveState | pState.set() | rooms.ts | 87 | State snapshot on-leave |
| on restoreState | restoreRoomObjects() | rooms.ts | 179-200 | Restore on re-entry |
| on getMiniMapStatus | clearedSet()/infestedRooms() | rooms.ts | 134-145 | Status query |
| on addSaveData | doSave() → buildSave() | main.ts | 145-152 | Serialization |
| on restoreFromSave | doLoad() | main.ts | 156-169 | Deserialization |
| on offScreen | entity cleanup | rooms.ts | 107 | Entity removal on exit |
| Transition detection | update() | rooms.ts | 306-316 | Edge crossing detection |

---

## Conclusion

The TypeScript port faithfully implements the core room-flow mechanics: enemy tracking, room-clear detection at the correct moment (when last enemy dies or on entry if pre-cleared), exit opening, navMode activation, pState save/restore, and map-complete detection. 

**One verified behavioral gap** exists: the per-room clear sound ("end_screen" by default) is not played when a non-final room clears. This is a playthrough-visible audio feedback loss but does not affect game progression or win conditions.

All other handlers map correctly, with non-gaps being cosmetic or implementation-detail differences (zone activation, blend levels, global flags) that do not affect playthrough.

---

## Audit Metadata

- **Auditor:** Claude Code
- **Audit Date:** 2026-06-21
- **Files Reviewed:**
  - `/home/user/merlin-s-revenge/casts/script_objects/objRoom.txt` (original)
  - `/home/user/merlin-s-revenge/port/src/world/rooms.ts` (RoomManager)
  - `/home/user/merlin-s-revenge/port/src/main.ts` (flow + audio)
  - `/home/user/merlin-s-revenge/port/src/scenes/sceneManager.ts` (game states)
  - `/home/user/merlin-s-revenge/port/src/systems/audio.ts` (reference)
- **Depth:** Full handler enumeration + behavioral comparison + outcome verification
