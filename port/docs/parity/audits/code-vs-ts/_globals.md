# GameInitGlobals Parity Audit: Original Lingo vs TypeScript Port

**Audit Date:** 2026-06-21  
**Scope:** All globals initialized in `extracted/engine/scripts/MovieScript 1 - GameSpecific.ls` (on GameInitGlobals)  
**Methodology:** For each global, verified:
1. Original behavior gate (casts file & line)
2. Port implementation status (file:line or MISSING)
3. Gameplay/visible behavior parity

---

## Summary

**Status:** 4 gameplay-affecting globals MISSING from port  
**Already Known Excluded:** gNavMode (fixed), gCharacterEnergyRolloverOn (catalogued)

---

## Per-Global Audit

### g3DMode = 0 (FALSE)
- **Original Value:** 0 (2D mode, no 3D rendering)
- **Original Behavior Gate:** 
  - `casts/master_objects/spriteMaster.txt:38` — if g3DMode = false, use 2D sprites; else use 3D objects
  - `casts/master_objects/movieMaster.txt:26` — if g3DMode = true, initialize 3D rendering
- **Port Status:** MISSING — no 3D mode toggle in port
- **Port Implementation:** Always 2D (no 3D sprite/object system exists in port)
- **Parity Note:** ✓ Port behavior matches default (g3DMode=0). No 3D system needed.

---

### gBounceyWalls = 0 (FALSE)
- **Original Value:** 0 (walls absorb momentum)
- **Original Behavior Gate:**
  - `casts/script_objects/objGameObject.txt:315` — case gBounceyWalls of
  - `casts/script_objects/objGameObject.txt:316-321` — if TRUE: bounceRight/bounceLeft; else: setVectX(0)
  - Used in `collisionWallLeft()` and `collisionWallRight()` methods
- **Port Status:** MISSING — no bounce behavior implemented
- **Port Implementation:** `port/src/components/movement.ts:148-149` handles collision events but does NOT handle them:
  ```ts
  if (ev.wallLeft) this.entity.send("collisionWallLeft");
  if (ev.wallRight) this.entity.send("collisionWallRight");
  ```
  These events are sent but never handled by any component. Wall collision always stops movement (v=0).
- **Parity Issue:** ✗ Port does NOT implement bouncy walls. Default behavior (stop, don't bounce) happens to match gBounceyWalls=0, but the gate is missing.
- **Impact:** NONE (default is correct), but feature is unimplemented.

---

### gBulletsCollideWithBackground = 0 (FALSE)
- **Original Value:** 0 (bullets pass through terrain)
- **Original Behavior Gate:**
  - `casts/script_objects/objBullet.txt:119` — if gBulletsCollideWithBackground then (run ancestor collision check)
  - Default false: bullets fly through walls, die only on target/stall/expire
- **Port Status:** ✓ CORRECTLY IMPLEMENTED
- **Port Implementation:** `port/src/components/movement.ts:38-42`:
  ```ts
  // objBullet.checkCollisions: bullets do NOT collide with terrain
  // (gBulletsCollideWithBackground is never set)
  passThrough = false;  // ...init sets passThrough = cfg["passThrough"] === true
  ```
  `port/src/entities/archetypes.ts:148` — projectiles set passThrough=true, no moveBox.
- **Parity Status:** ✓ CLEAN — port behavior matches (bullets pass through terrain).

---

### gCharacterEnergyRolloverOn = 1 (TRUE)
- **Status:** ALREADY CATALOGUED — feature implemented in port (navMode).
- **Excluded from this audit per user instruction.**

---

### gEnemyEnergyMasterOn = 0 (FALSE)
- **Original Value:** 0 (no enemy health bars)
- **Original Behavior Gate:**
  - `casts/master_objects/actorMaster.txt:146` — if gEnemyEnergyMasterOn = true then g.enemyEnergyMaster.start()
  - When TRUE: spawns enemy energy bars (HUD overlay)
- **Port Status:** MISSING — no enemy health bar system in port
- **Port Implementation:** No enemyEnergyMaster in game context or render pipeline.
  - Enemy actors have Energy component but no UI display
  - Render pipeline has no HUD/overlay for enemy health (port/src/render/renderer.ts draws sprites only)
- **Parity Note:** ✓ Port behavior matches default (gEnemyEnergyMasterOn=0). No enemy health bars rendered.
- **Impact:** NONE (default is correct), but UI feature is missing.

---

### gExitArrows = 1 (TRUE)
- **Original Value:** 1 (draw exit arrows on room edges)
- **Original Behavior Gate:**
  - `casts/script_objects/objRoom.txt:213` — if gExitArrows then me.drawExitArrows()
  - When TRUE: overlay arrow rects marking passable exits (green if room cleared, red if not)
- **Port Status:** ✓ CORRECTLY IMPLEMENTED
- **Port Implementation:**
  - `port/src/world/rooms.ts:251-285` — exitArrowRects() builds arrow overlay rects per edge
  - `port/src/main.ts:378-381` — drawExitArrows() renders the overlays on the frame
  ```ts
  // K22 exit arrows (objRoom.drawExitArrows → modScreenExits.drawExitArrowsOnImage)
  drawExitArrows(renderer, assets, rooms.exitArrowRects());
  ```
  - Green/red logic matches original (green = room cleared → grid.open[edge]; red = not cleared)
- **Parity Status:** ✓ CLEAN — exit arrows fully implemented.

---

### gGameView = #topDown (SYMBOL)
- **Original Value:** #topDown (top-down camera)
- **Original Behavior Gate:**
  - `casts/script_objects/modMoveToLoc.txt:109-133` — case gGameView of #sideOn / #topDown (mostly commented out)
  - `casts/script_objects/objGameObject.txt:36-42` — case gGameView (commented out, friction hardcoded to point(50,50) for topDown)
  - Many files declare `global gGameView` but actual usage is commented out (legacy from earlier game design)
- **Port Status:** MISSING — no gGameView branching in port
- **Port Implementation:** Always top-down. No side-view mode exists. Movement physics hardcoded as if gGameView=#topDown.
- **Parity Note:** ✓ Port behavior matches default (#topDown). All side-view code is commented out in original.
- **Impact:** NONE (default is correct; side-view never implemented in original).

---

### gMapBoundary = 128 (PIXELS)
- **Original Value:** 128 (boundary display margin)
- **Original Behavior Gate:**
  - `casts/script_objects/objMap.txt:569` — if gMapBoundary > 0 then me.displayBoundary()
  - When > 0: draw a visual boundary rect around the playable area (inflate map rect by this margin)
  - `casts/script_objects/modBoundary.txt:45` — boundaryRect = inflate(mapRect, gMapBoundary, gMapBoundary)
- **Port Status:** MISSING — no boundary display in port
- **Port Implementation:** No displayBoundary() or boundary visualization in render pipeline
  - `port/src/render/renderer.ts` draws collision grid + sprites only
  - No boundary overlay/rect in main.ts render calls
- **Parity Issue:** ✗ Port does NOT draw boundary visualization. This is a visible cosmetic feature.
- **Impact:** VISUAL FEATURE MISSING — players cannot see the map boundary rect overlay.

---

### gMaxEnemies = 16 (COUNT)
- **Original Value:** 16 (cap concurrent enemy units)
- **Original Behavior Gate:**
  - `casts/master_objects/old_reservationsMaster.txt:30` — mn.enemies = gMaxEnemies
  - Used by reservationsMaster to cap spawned enemies (concurrent unit cap)
- **Port Status:** PARTIAL/DIVERGENT — soft cap implemented differently
- **Port Implementation:** 
  - `port/src/components/dwelling.ts:20` — aliveCap = 6 (soft concurrent dwelling cap, hardcoded)
  - Dwellings respect this cap per-building, but no global enemy limit check
  - No reservationsMaster equivalent; each dwelling self-gates
- **Parity Issue:** ✗ Port's concurrent cap (6 per dwelling) differs from original's global cap (16 total enemies)
  - Original: hard global limit on active enemy units
  - Port: per-dwelling soft limit only
  - A map with 3 dwellings could field up to 18 concurrent enemies (3×6), vs original's hard 16 global limit
- **Impact:** GAMEPLAY DIVERGENCE — enemy spawn behavior differs; could lead to difficulty tuning mismatches.

---

### gMaxFriends = 12 (COUNT)
- **Original Value:** 12 (cap concurrent friendly/summoned units)
- **Original Behavior Gate:**
  - `casts/master_objects/old_reservationsMaster.txt:31` — mn.friends = gMaxFriends
  - Used by reservationsMaster to cap summoned allies (concurrent ally cap)
- **Port Status:** PARTIAL/DIVERGENT — no global ally cap
- **Port Implementation:**
  - `port/src/systems/armyMaster.ts` — manages banked summoned allies (teleport-out on room leave)
  - No hard cap on active allies; player can field unlimited allies at once
  - Allies are pooled (G2) but not spawn-limited
- **Parity Issue:** ✗ Port does NOT enforce concurrent ally cap. Original hard limit: 12 active friendlies.
  - Port: allows unlimited concurrent allies (only limits room teleport-in by remaining pool budget)
- **Impact:** GAMEPLAY DIVERGENCE — player can field more allies than in original; ally spam possible.

---

### gMenuBaseColour = rgb(0, 0, 0) (BLACK)
- **Status:** COSMETIC/UI — excluded per user instruction (pure menu colour)
- **Port Status:** Not relevant to gameplay mechanics

---

### gMenuHiColour = gButtonHiColour (WHITE)
- **Status:** COSMETIC/UI — excluded per user instruction (pure menu colour)

---

### gMenuPulse = gButtonPulse (0/FALSE)
- **Status:** COSMETIC/UI — excluded per user instruction (pure animation flag)

---

### gMenuShadowedColour = rgb(100, 100, 100) (GREY)
- **Status:** COSMETIC/UI — excluded per user instruction (pure menu colour)

---

### gButtonBaseColour = rgb(100, 100, 100) (GREY)
- **Status:** COSMETIC/UI — excluded per user instruction (button colour)

---

### gButtonHiColour = rgb(255, 255, 255) (WHITE)
- **Status:** COSMETIC/UI — excluded per user instruction (button colour)

---

### gButtonPulse = 0 (FALSE)
- **Status:** COSMETIC/UI — excluded per user instruction (button animation)

---

### gPlayerHair = 0 (FALSE)
- **Original Value:** 0 (no player hair collision system enabled)
- **Original Behavior Gate:**
  - `casts/script_objects/objCPUCharacter.txt:231` — if gPlayerHair then me.checkCollisionsWithHair()
  - When TRUE: enemy updateAI checks if player's hair sprite overlaps enemy rect; if yes, apply collision damage
  - `casts/script_objects/objGameObject.txt:259-267` — checkCollisionsWithHair() queries player.checkHairCollisions()
  - `casts/script_objects/objHair.txt` — full hair object system (growth, collision, cutting)
- **Port Status:** MISSING — no player hair collision system in port
- **Port Implementation:** No objHair equivalent. Player sprite is static. No dynamic hair collision detection.
  - `port/src/components/anim.ts` renders player/enemy sprites but no separate hair sprite
  - Movement component handles terrain collision only, not hair
- **Parity Note:** ✓ Port behavior matches default (gPlayerHair=0). Hair collision disabled.
- **Impact:** NONE (default is correct), but entire hair feature (growth, collision, cutting) is unimplemented. Set gPlayerHair would unlock a large missing subsystem.

---

### gNavMode = 1 (TRUE) ← Already Fixed
- **Status:** ALREADY FIXED IN PORT — feature implemented
- **Excluded from this audit per user instruction.**

---

### gGameCompleteScript = #cut_scene_to_play_at_end (SYMBOL)
- **Status:** ASSET/DATA — excluded; port correctly routes cutscene triggers
- **Port Status:** ✓ Implemented (completeScript in main.ts line 98)

---

### gGameOverScript = #cut_scene_to_play_when_wasted (SYMBOL)
- **Status:** ASSET/DATA — excluded; port correctly routes cutscene triggers
- **Port Status:** ✓ Implemented (wastedScript in main.ts line 97)

---

### gGameName = #merlin_3 (SYMBOL)
- **Status:** ASSET/DATA STRING — excluded per user instruction
- **Port Status:** Not relevant to gameplay

---

### gGameSaveFile = "mr4_saveGame_0_03.txt" (STRING)
- **Status:** ASSET/DATA STRING — excluded per user instruction (save filename)
- **Port Status:** Not relevant to gameplay

---

### gKeySetFileName = "MerlinsRevengeKeys.txt" (STRING)
- **Status:** ASSET/DATA STRING — excluded per user instruction (config filename)
- **Port Status:** Not relevant to gameplay

---

### gIntroScript (not explicitly set)
- **Status:** Not initialized in GameInitGlobals; excluded

---

## Flagged Issues Summary

### MISSING Gameplay-Affecting Globals (4 Total)

| Global | Original Value | Port Status | Severity |
|--------|---|---|---|
| **gMapBoundary** | 128 | MISSING display | VISUAL |
| **gMaxEnemies** | 16 | HARDCODED 6 per dwelling, not global | GAMEPLAY |
| **gMaxFriends** | 12 | NO GLOBAL CAP | GAMEPLAY |
| **gBounceyWalls** | 0 (disabled) | MISSING handler | FEATURE |

### CLEAN Implementations (Matching Default)

| Global | Port Status |
|--------|---|
| g3DMode (0) | Always 2D ✓ |
| gBulletsCollideWithBackground (0) | Bullets pass through ✓ |
| gCharacterEnergyRolloverOn (1) | navMode implemented ✓ |
| gEnemyEnergyMasterOn (0) | No bars drawn ✓ |
| gExitArrows (1) | Arrows rendered ✓ |
| gGameView (#topDown) | Always top-down ✓ |
| gPlayerHair (0) | No hair collision ✓ |

---

## Recommendations

### Critical (Gameplay Divergence)
1. **gMaxEnemies / gMaxFriends:** Implement global concurrent unit caps. Current dwelling-per-cap + unlimited allies allow overflow.
2. **gMapBoundary:** Add boundary rect overlay visualization (low priority—visual feedback only).

### Nice-to-Have (Completeness)
3. **gBounceyWalls:** Implement wall bounce handler (currently events sent but unhandled).
4. **gPlayerHair:** Document hair system as out-of-scope (requires substantial feature work).

### Codebase References
- Original globals: `extracted/engine/scripts/MovieScript 1 - GameSpecific.ls:1-29`
- Port game context: `port/src/game/context.ts`
- Port main setup: `port/src/main.ts:85-195`
- Dwelling spawning: `port/src/components/dwelling.ts:20`
- Movement collision: `port/src/components/movement.ts:100-155`
