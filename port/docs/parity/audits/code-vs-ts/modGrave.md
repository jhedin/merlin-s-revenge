# Audit: modGrave.txt vs TypeScript Port

**File**: `casts/script_objects/modGrave.txt`  
**Audit Date**: 2026-06-21  
**Status**: CLEAN

## Summary
The Lingo modGrave implementation (permanent death graves) and its TypeScript port are functionally equivalent. The original's baked-blit grave rendering (drawn into room background, recorded in pGraves) is faithfully modelled as dead actors persisting as grave sprites with low render-z, serialized into the per-room pState snapshot, achieving identical outcome.

---

## Original Behavior (Lingo)

### Death Flow
- **modGrave.drawGrave()** (line 31-39):
  - Checks `pGraveOn` flag; returns early if false (ghosts)
  - Calls `me.setFlipFromDir(1)` to face graves RIGHT
  - Gets current room via `g.gameMaster.getCurrentRoom()`
  - Calls `currentRoom.drawAndRecordGrave(me.ID.bigMe)` to bake grave into room background + record

### Initialization
- **modGrave.addModParams()** (line 13-19): sets default `#graveOn = true`
- **modGrave.init()** (line 21-29):
  - Reads `params.graveOn` → `pGraveOn`
  - **If `params[#ghost] == true`, sets `pGraveOn = false`** (ghosts leave no grave)

### Query
- **modGrave.getGraveOn()** (line 45-47): returns `pGraveOn` boolean

### Death Trigger Points
- **objCPUCharacter.flasherFinished()** (line 150-156):
  - Sets `me.pDead = true`
  - Calls `me.goMode(#finish)`
  - Calls `me.drawGrave()` → triggers grave render + record
  - Calls `ancestor.flasherFinished()`

- **objCPUCharacter.goMode(newMode)** (line 175-178):
  - On entering `#finish` mode: calls `me.drawGrave()` again + sets `me.setDead(true)`

### Grave Persistence (modRoomGraves.txt)
- **drawAndRecordGrave()** (line 32-40):
  - Reads `graveMember` from actor
  - Renders grave image into room background at actor's loc
  - Calls `me.recordGrave(...)` to add to `pGraves[]` list
- **recordGrave()** (line 54-62):
  - Creates a `#graveRecord` struct: `{actorType, member, rect}`
  - Appends to `pGraves`
- **addSaveData()** (line 26-30): `sd[#pGraves] = pGraves.duplicate()`
  - Graves persist across save/load via pState snapshot

---

## TypeScript Port Behavior

### Grave Component (grave.ts)

**File: `/home/user/merlin-s-revenge/port/src/components/grave.ts`**

- **Lines 14-24**: `Grave` component
  - Handles only `["getGraveOn"]`
  - Private `graveOn = true` (default)
  - **init()** (line 19): `this.graveOn = cfg["ghost"] !== true`
    - **Exact match**: if ghost is true, graveOn becomes false (no grave)
  - **reset()** (line 20): `this.graveOn = true` (reset on entity reuse)
  - **getGraveOn()** (line 23): returns `this.graveOn`

### Death & Animation Rendering (anim.ts)

**File: `/home/user/merlin-s-revenge/port/src/components/anim.ts`**

- **pickAction()** (line 58-59):
  - If `entity.send("isDead")` returns `"grave"` action
  - **Matches original**: dead actor's animation strip switches to #grave

- **sprite()** (line 97-126):
  - Line 103-104: checks `dead = entity.send("isDead")` and `graveOn = entity.send("getGraveOn")`
  - **Line 105**: `if (dead && graveOn === false) return null;` ← **Ghost case**: no sprite rendered, vanishes
  - **Line 106**: `const isGrave = dead && graveOn === true;` ← **Grave case**: dead + graveOn=true
  - **Line 123**: `z: isGrave ? m.y - 100000 : m.y;` ← **LOW RENDER-Z**: graves sit BEHIND all living actors (y - 100000 bias keeps graves under the living band)
  - **Line 124**: `flip: isGrave ? false : m.facingLeft;` ← **GRAVES FACE RIGHT**: isGrave forces `flip=false` (right-facing), matching `setFlipFromDir(1)`

### Death Trigger (combat.ts)

**File: `/home/user/merlin-s-revenge/port/src/components/combat.ts`**

- **Energy.takeHit()** (line 33-53):
  - Line 40-42: On lethal damage: sets `this.dead = true` and `this.killedInAction = true`
  - Sets death immediately; no separate death handler needed

### Persistence via pState (rooms.ts)

**File: `/home/user/merlin-s-revenge/port/src/world/rooms.ts`**

- **onLeaveRoom** (line 70-88):
  - Line 87: `this.pState.set(leavingNum, game.entities.filter((e) => e.type !== "player" && isRecordableActor(e)).map(serializeActor));`
  - **Dead actors are recordable** (grave sprites persist in snapshot)

- **enter()** (line 78-126):
  - Line 109: retrieves snapshot from `this.pState.get(this.room.num)` on re-entry
  - **Line 113**: calls `this.restoreRoomObjects(snapshot, ...)` → respawns grave-bearing dead actors at rest

- **Comment** (lines 17-22): `#recordInRoomState` behaviour explained:
  - Transient combat objects (bullets, non-recordable placed actors) are NOT frozen
  - Graves (dead actors) ARE recordable; they persist in pState and are restored on re-entry

### Serialization (actorSerial.ts)

**File: `/home/user/merlin-s-revenge/port/src/entities/actorSerial.ts`**

- **serializeActor()** (line 85-100):
  - Line 85-87: each component folds its saved state via `addSaveData(chain)` call
  - Line 88: position is belt-and-braces round-tripped via Movement
  - **Dead actors serialize with their chain intact** (Energy stores `{energy, max, dead}`; Anim stores frame state)

- **isRecordableActor()** (line 62-67):
  - Line 63: bullets explicitly return false (transient)
  - Line 65-66: resolves actor type; checks `recordInRoomState !== false` (defaults to true)
  - **Dead actors (enemies, dwellings, allies) are recordable by default**

---

## Mapping: Handler → TS

| Handler (Lingo) | TS Equivalent | File:Line |
|---|---|---|
| `modGrave.init(params)` — #ghost check | `Grave.init()` — `cfg["ghost"] !== true` | grave.ts:19 |
| `modGrave.getGraveOn()` | `Grave.getGraveOn()` | grave.ts:23 |
| `modGrave.drawGrave()` trigger | Removed; dead actors persist as sprites | anim.ts:59 |
| `drawAndRecordGrave()` render+record | `Anim.sprite()` low-z rendering + `RoomManager.pState` snapshot | anim.ts:105-126, rooms.ts:87, 109 |
| `setFlipFromDir(1)` grave orient | `Anim.sprite()` `flip: false` (right) for graves | anim.ts:124 |
| `modRoomGraves.recordGrave()` struct | Dead actor persists in Entity tree + serialized | actorSerial.ts:85-100 |
| `pGraves` list on room | `pState[roomNum]` array of ActorSave (includes dead) | rooms.ts:58, 87 |
| `addSaveData(#pGraves)` | `serializeActor(e)` on each entity, Energy.addSaveData() stores dead flag | actorSerial.ts:87, combat.ts:113-115 |
| Grave visibility (ghost=false → vanish) | `Anim.sprite()` returns null if ghost | anim.ts:105 |

---

## Outcome Comparison

| Aspect | Lingo | TypeScript | Parity |
|---|---|---|---|
| **Grave-on-death trigger** | `drawGrave()` called in `flasherFinished()` + `goMode(#finish)` | Dead actor persists; Entity stays in world with dead flag | ✓ Same outcome: grave remains at death loc |
| **Grave persistence across save/load** | Baked into room background; `pGraves[]` in `addSaveData()` | Entity serialized into pState; re-entered room restores it | ✓ Same outcome: graves return on re-entry |
| **Grave non-collidable** | Original: actor removed after baking; sprite is just pixels | TS: dead actors don't move/collide (Movement skips dead); grave is a low-z sprite behind living actors | ✓ Same outcome: not a physical obstacle |
| **Grave render order** | Baked INTO room background (behind all actors) | Low render-z (y - 100000) keeps grave under living band | ✓ Same outcome: grave rendered behind living |
| **Ghost (no grave)** | `#ghost=true` → `pGraveOn=false` → `drawGrave()` returns early → no rendering + no record | `cfg["ghost"]=true` → `graveOn=false` → `Anim.sprite()` returns null (no sprite) | ✓ Same outcome: ghost vanishes, no grave |
| **Grave sprite/frame** | `getGraveMember()` reads `#grave` anim strip | `Anim.pickAction()` returns `"grave"` → looks up `#grave` frame in assets | ✓ Same outcome: grave frame rendered |
| **Grave orientation** | `setFlipFromDir(1)` → face RIGHT | `flip: false` in sprite() when isGrave | ✓ Same outcome: graves face right |

---

## Verification

### Non-Gaps (Verified Identical)
1. **Ghost gate** (modGrave.init line 26-28 vs grave.ts:19): Ghost actors skip grave rendering identically
2. **Grave sprite frame** (modGrave.getGraveMember() vs anim.ts:59): Both read `#grave` action/frame
3. **Right-facing orientation** (setFlipFromDir(1) vs flip:false): Graves face RIGHT in both
4. **Persistence mechanism** (pGraves record vs pState serialization): Both persist graves across room transitions
5. **Death latch**: Energy.takeHit() (combat.ts:40-42) sets `dead=true` on lethal damage only, matching the original's kill-action distinction

### No Behavioral Divergence Detected
- Dead actors don't collide (Movement skips them, Anim.sprite() returns null for ghosts)
- Graves are serialized into per-room snapshots, not a separate global pGraves list (but outcome identical: persistence across room-leave/re-entry)
- No fade timing specified in original modGrave.txt; the TS port shows graves at full opacity indefinitely (matching original, which bakes them permanently)
- No grave persistence timer in original; graves remain "forever" in pGraves (matching TS pState serialization)

---

## Conclusion

**STATUS: CLEAN**

The TypeScript port faithfully preserves modGrave behaviour:
- Ghost actors leave no grave (early return vs null sprite)
- Non-ghost actors persist as grave sprites with correct orientation and render order
- Graves survive room transitions via pState serialization (equivalent to pGraves recording)
- No observable divergence in game behavior

The implementation difference (baked-blit vs persistent entity with low render-z) is internal; outcomes are identical.
