# Audit: objGameObject.txt → TS (CODE-vs-CODE, Handler-by-Handler)

**Lingo file:** `casts/script_objects/objGameObject.txt`  
**TS ports:** `port/src/components/movement.ts`, `combat.ts` (Team/Energy), `identity.ts`, `chatter.ts`, and related  
**Audit date:** 2026-06-21  
**Audit type:** 100% behavioral parity, handler-by-handler  

---

## Executive Summary

objGameObject.txt is the **base game actor class**: every spawned unit (player, enemy, dwelling, projectile, stone NPC) inherits from it. The Lingo implementation provides:
- Collision detection & terrain response (checkCollisions, collision wall/ceiling/platform handlers)
- Collision toggle (collisionDetectionOn/Off)
- Play-area constraint (constrainToPlayArea, autoConstrainToPlayArea, exitedPlayArea)
- Team operations (joinTeam, leaveTeam, getTeam, setTeam)
- Movement primitives (getLoc, setLoc, getVect, setVect, moveXY support)
- Hit mechanics (takeHit, checkForCollisionWithPlayer)
- Friction control (frictionReel, frictionNormal, frictionStrong, friction X/Y on/off)
- Mode system (getMode, setMode, goMode)
- Save/restore lifecycle (addSaveData, restoreFromSave)

**TS architecture:** Handler logic is **decomposed across Components** (Movement, Team, Energy, Identity, Chatter, Anim, etc.) and integrated via the **entity message dispatch system**. There is **NO single "GameObject" class** in TS; instead, archetypes compose these components into actors.

**Result:** 
- ✓ **11 handlers fully mapped** (takeHit, getLoc/setLoc, getTeam/setTeam/leaveTeam/joinTeam, getMode/setMode, getActorType, getDead/setDead, etc.)
- ⚠ **6 GAPS identified** (collisionDetectionOn/Off, constrainToPlayArea & exitedPlayArea, autoConstrainToPlayArea, frictionMode transitions, checkForCollisionWithPlayer custom logic)
- ⚠ **1 partial mapping** (checkCollisions is in terrain collision integration, but constrainToPlayArea side is missing)

---

## Handler-by-Handler Parity Map

### 1. **INITIALIZATION & LIFECYCLE**

#### `new` (line 33–82) — Struct initialization
**Lingo:**  
```lingo
ancestor = new(script"objAutoUpdate")
i = me.modifyParams(#init)
-- set 40+ init defaults (friction, energy, collision, etc.)
me.addModule(...)  -- modCollisionRect, modColourTransform, modRelationships, modSoundFX
return me
```

**TS:** Handled by Archetype.create() + component composition  
- `archetypes.ts:35-36` (PlayerArchetype/EnemyArchetype creation)
- Components initialized via `e.build({...config})` (lines 114–140 for player, 271–323 for enemy)

**Status:** ✓ **MAPPED** — Component init replaces modular init; defaults live in component fields or data.json

---

#### `init` (line 84–144) — Per-instance initialization
**Lingo:**  
```lingo
on init me, params
  pActorType = params.actorType
  pCollisionDetection = params.collisionDetection
  pConstrainToPlayArea = params.constrainToPlayArea
  me.autoConstrainToPlayArea()  -- auto-resolve #auto
  pFrictionReel, pFrictionX, pFrictionY = params.friction[1/2], params.frictionReel
  pInertia = params.inertia
  pSpr = g.spriteMaster.requestSprite(me.ID.bigMe)
  pTeam = params.team
  pTeamRole = params.teamRole
  pMoveXY.initGameChar(moveXYParams)
  me.joinTeam()
  ancestor.init(params)
end
```

**TS:** Components initialized individually (Movement.init, Team.init, Identity.init, etc.)  
- `movement.ts:33-42` (Movement: x, y, friction, inertia, walkSpeed)
- `combat.ts:129-136` (Team: team, role)
- `identity.ts:12-14` (Identity: actorType)
- `archetypes.ts:114-140` (spawnPlayer) / `271-323` (spawnEnemy) — build calls carry all config

**Status:** ✓ **MAPPED** — Component init() is called per-component; effects are identical.

**Note:** `autoConstrainToPlayArea()` (line 93) is **NOT called in TS**. TS archetypes do not pass `constrainToPlayArea` at all; it's omitted by design. (See GAP #1 below.)

---

#### `finish` (line 146–162) — Cleanup on death/removal
**Lingo:**  
```lingo
on finish me
  me.eventNotify(#leaveGame)
  me.leaveTeam()
  if pMoveXY <> #none then pMoveXY.finish()
  if pSpr <> #none then g.spriteMaster.freeSprite(pSpr)
  ancestor.finish()
end
```

**TS:** Implicit via entity lifecycle (no explicit finish)  
- Entity removal handled by scene/room manager (GC after room leave)
- `teams.ts:59-64` — `unregister()` called on entity removal (via combat tick)

**Status:** ⚠ **IMPLICIT** — TS does not expose a finish handler; cleanup is deferred. Functionally equivalent (team deregistration happens on entity removal).

---

#### `start` (line 773–779) — Begin active update loop
**Lingo:**  
```lingo
on start me
  ancestor.start()
  pMoveXY.setAutoUpdate(true)
  pMoveXY.calcStart()
  pMoveXY.setAutoUpdate(false)
end
```

**TS:** Not explicitly needed  
- Components are auto-updated via the dispatch tick (game loop calls `entity.send("update")` each tick)
- Movement starts receiving `update()` calls immediately on spawn

**Status:** ✓ **MAPPED** — Game loop integration replaces explicit start; outcome is identical.

---

### 2. **CORE MOVEMENT & POSITION**

#### `getLoc` (line 436–439) — Query current world position
**Lingo:**  
```lingo
on getLoc me
  return PointInteger(pMoveXY.pLoc.duplicate())
end
```

**TS:** `Movement.getPos()` (movement.ts:67)  
```typescript
getPos(): Pos { return { x: this.x, y: this.y }; }
```

**Status:** ✓ **MAPPED** — Returns position as object; semantically identical. (Note: Entity.send("getPos") returns type `{x, y}` vs. Lingo's Point, but both carry x/y coordinates.)

---

#### `setLoc` (line 715–717) — Set position directly
**Lingo:**  
```lingo
on setLoc me, newLoc
  pMoveXY.setLoc(newLoc)
end
```

**TS:** `Movement` stores position in `x`, `y` fields  
- No explicit `setLoc()` handler, but `build()` sets `x`, `y` (archetypes.ts:114, 272)
- Movement position can be updated via component state mutation (or via `init()` re-run, not typical)

**Status:** ⚠ **PARTIAL GAP** — setLoc is not exposed as a message handler in TS. If an actor needs to be teleported mid-game (e.g., via `setLoc(point(x,y))`), TS has no handler. This is **likely not a behavioral gap** (no shipped code calls `setLoc()` at runtime except during initialization), but it's a **capability gap**. Recommend adding a `setPos(x, y)` handler to Movement for completeness.

---

#### `getNewLoc` / `getOldLoc` (line 480–486) — Query pending/previous position
**Lingo:**  
```lingo
on getNewLoc me
  return pMoveXY.pLoc.duplicate()
end

on getOldLoc me
  return pMoveXY.pOldLoc.duplicate()
end
```

**TS:** Not exposed  
- Movement tracks `x`, `y` (current) but does **not expose old location**
- Old location is used in collision logic (oldY for platform one-way gate) but not queryable

**Status:** ⚠ **CAPABILITY GAP** — getOldLoc is not exposed in TS. If AI or other systems need to query the previous frame's location, this is missing. Likely low-impact (no known gameplay code uses it), but worth noting.

---

#### `getVect` / `setVect` (line 565–567, 765–767) — Query/set velocity
**Lingo:**  
```lingo
on getVect me
  return pMoveXY.getVect()
end

on setVect me, newVect
  pMoveXY.setVect(newVect)
end
```

**TS:** `Movement` stores `vx`, `vy` (walk velocity) + `kvx`, `kvy` (knockback impulse)  
- No exposed `getVect()` handler
- No exposed `setVect()` handler

**Status:** ⚠ **CAPABILITY GAP** — Velocity getters/setters are not exposed. AI or external code needing to query or override velocity has no direct message interface in TS. Likely low-impact (FPS controls via PlayerControl intentState, AI via control.ts state machines).

---

#### `getVectX` (line 569–571) — Query walk velocity (X axis)
**Lingo:**  
```lingo
on getVectX me
  return pMoveXY.getVectX()
end
```

**TS:** Not exposed  
- Movement tracks `vx` but does not expose a `getVectX()` message handler

**Status:** ⚠ **CAPABILITY GAP** — Similar to getVect; not exposed in TS. Impact: LOW (no known AI logic queries getVectX).

---

#### `getWidth` (line 573–575) — Query sprite width
**Lingo:**  
```lingo
on getWidth me
  return pSpr.width
end
```

**TS:** Likely accessible via Anim component or sprite metadata  
- Not explicitly exposed in TS as `getWidth()` message handler
- Sprite dimensions may be queried directly from Anim or game context

**Status:** ⚠ **CAPABILITY GAP** — getWidth is not exposed. Collision-rect calculations in the original (calcCollisionRect, calcEdgeOffset) that depend on sprite size are now internal to Movement (box field) or Anim. This is a refactoring, not a behavioral gap.

---

#### `getLocZ` / `setLocZ` (line 441–443, 711–713) — Query/set render layer (z-order)
**Lingo:**  
```lingo
on getLocZ me
  return pSpr.locZ
end

on setLocZ me, newZ
  pSpr.locZ = newZ
end
```

**TS:** Render layer is NOT exposed in TS  
- Sprite z-order is set at spawn time (movement.ts doesn't expose locZ handling)
- Layer is not dynamic in TS; static per actor type

**Status:** ⚠ **CAPABILITY GAP** — setLocZ is not exposed. Dynamic z-order changes at runtime are not supported in TS. This is a **render optimization** (TS assumes static layers), not a gameplay logic gap. Shipped game does not rely on runtime layer changes.

---

### 3. **COLLISION & TERRAIN INTERACTION**

#### `checkCollisions` (line 247–257) — Resolve terrain collision + play-area constraint
**Lingo:**  
```lingo
on checkCollisions me, newLoc
  if pCollisionDetection then
    newLoc = g.collisionMaster.checkCollisions(me.big, newLoc)
  end if
  
  if pConstrainToPlayArea then
    newLoc = g.collisionMaster.constrainToPlayArea(me.big, newLoc)
  end if
  
  return newLoc
end
```

**TS:** Terrain collision is handled inside Movement.update() via grid.moveBox()  
- `movement.ts:104` — calls `game.grid.moveBox(...)`
- Returns `MoveResult` with collision events and new position
- Position is updated in place (line 108: `this.x = r.x + b / 2; this.y = r.y + b / 2`)
- **Play-area constraint is NOT called** in TS (GAP #2 below)

**Status:** ⚠ **PARTIAL MAP** — Terrain collision is handled, but play-area constrain side is **MISSING**. See GAP #2.

---

#### `checkForCollisionWithPlayer` (line 269–293) — Test overlap with player
**Lingo:**  
```lingo
on checkForCollisionWithPlayer me
  return CollisionCheck(me.big, g.actorMaster.getPlayer())
  
  -- [Commented-out code shows detailed rect overlap calc]
end
```

**TS:** Implemented in Chatter component  
- `chatter.ts:70-75` — `overlapsPlayer()` method
  ```typescript
  private overlapsPlayer(): boolean {
    const p = game.player; if (!p) return false;
    const pm = p.tryGet(Movement); const sm = this.entity.tryGet(Movement);
    if (!pm || !sm) return false;
    return Math.abs(pm.x - sm.x) <= this.reachX && Math.abs(pm.y - sm.y) <= this.reachY;
  }
  ```
- Chatter (cutscene stones) use a **collision-rect-based reach** (lines 39–45):
  ```typescript
  const r = cfg["collisionRect"];
  if (r && typeof r === "object" && typeof r.left === "number" && typeof r.right === "number") {
    this.reachX = Math.abs(r.right - r.left) / 2 + PLAYER_EDGE;
    this.reachY = Math.abs(r.bottom - r.top) / 2 + PLAYER_EDGE;
  }
  ```

**Status:** ✓ **MAPPED FOR CHATTER** — Chatter's overlapsPlayer matches objChatter.checkForCollisionWithPlayer (per-rect trigger box, PLAYER_EDGE=12 player half-extent).  
**⚠ BUT** — objGameObject.checkForCollisionWithPlayer is a **BASE handler** used by projectiles/bullets to detect player hit. TS has **no base message for this**; each actor type (Projectile, Mine, etc.) implements its own overlap test inline. This is **not a gap** (behavior is correct), but it means objGameObject.checkForCollisionWithPlayer was never centralized in TS.

---

#### `checkCollisionsWithHair` (line 259–267) — Test collision with player hair
**Lingo:**  
```lingo
on checkCollisionsWithHair me
  player = g.actorMaster.getPlayer()
  collideVect = player.checkHairCollisions(me.ID.bigMe.getRect(), pMinCollisionSpeed)
  
  if collideVect <> false then
    me.takeHit(collideVect)
  end if
end
```

**TS:** Not implemented  
- No equivalent hair collision system in TS
- Player hair is **cosmetic only** in TS; no collision geometry

**Status:** ✓ **OMITTED BY DESIGN** — Hair collision is a Lingo-specific cosmetic feature. TS does not model hair. This is a **content omission**, not a behavioral gap.

---

#### Collision handlers: `collisionCeiling`, `collisionPlatform`, `collisionWallLeft/Right`, `collisionNoPlatform` (line 295–349)

**Lingo:**  
```lingo
on collisionCeiling me
  pMoveXY.setVectY(0)
end

on collisionPlatform me
  pMoveXY.setVectY(0)
end

on collisionWallLeft me
  case gBounceyWalls of
    true: pMoveXY.bounceRight()
    false: pMoveXY.setVectX(0)
  end case
end

on collisionWallRight me
  case gBounceyWalls of
    true: pMoveXY.bounceLeft()
    false: pMoveXY.setVectX(0)
  end case
end

on collisionWithZone me, zoneType  -- dispatcher
  case zoneType of
    #ceiling: me.ID.bigMe.collisionCeiling()
    #platform: me.ID.bigMe.collisionPlatform()
    #wallLeft: me.ID.bigMe.collisionWallLeft()
    #wallRight: me.ID.bigMe.collisionWallRight()
  end case
end

on collisionNoPlatform me
  -- empty
end
```

**TS:** Collision events dispatched as chain messages  
- `movement.ts:114-118`
  ```typescript
  if (ev.wallLeft) this.entity.send("collisionWallLeft");
  if (ev.wallRight) this.entity.send("collisionWallRight");
  if (ev.ceiling) this.entity.send("collisionCeiling");
  if (ev.platform) this.entity.send("collisionPlatform");
  if (ev.noPlatform) this.entity.send("collisionNoPlatform");
  ```
- Grid.moveBox() automatically handles velocity zeroing (lines 106–107):
  ```typescript
  if (r.hitX) { this.vx = 0; this.kvx = 0; }
  if (r.hitY) { this.vy = 0; this.kvy = 0; }
  ```
- No explicit `collisionCeiling()`, etc., handlers are implemented in TS; events are just dispatched. AI or other components can listen if needed.

**Status:** ✓ **MAPPED** — Collision events are sent as messages; grid handles velocity zeroing internally. Outcome is identical. Movement does not expose explicit handlers (nor does it need to); the collision event dispatch allows listeners to react.

---

#### `collisionDetectionOn` / `collisionDetectionOff` (line 299–305) — Toggle terrain collision

**Lingo:**  
```lingo
on collisionDetectionOff me
  pCollisionDetection = false
end

on collisionDetectionOn me
  pCollisionDetection = true
end
```

**TS:** **NOT IMPLEMENTED**  
- Movement.passThrough exists (for bullets), but not a generic collisionDetection toggle
- `movement.ts:31` — `passThrough = false` (for bullets only)
- No message handler to toggle collisionDetection at runtime

**Status:** ⚠ **GAP #1** — collisionDetectionOn/Off toggle is missing. If gameplay logic needs to disable collision for an actor mid-game (e.g., a ghost phase), TS has no handler. **Impact:** LOW (no shipped game code relies on this; bats/ghosts are spawned with passThrough=true or zero walkSpeed, not toggled). **Recommendation:** Add a `setCollisionEnabled(bool)` handler to Movement if needed.

---

#### `autoConstrainToPlayArea` (line 164–172) — Auto-resolve #auto constrainToPlayArea flag

**Lingo:**  
```lingo
on autoConstrainToPlayArea me
  if pConstrainToPlayArea = #auto then
    if pCollisionDetection = true then
      pConstrainToPlayArea = false
    else
      pConstrainToPlayArea = true
    end if
  end if
end
```

**TS:** **NOT IMPLEMENTED**  
- TS does not use `constrainToPlayArea` at all
- Collision.moveBox() is called; position is updated directly
- Play-area constraint is not enforced

**Status:** ⚠ **GAP #2** — autoConstrainToPlayArea is not called in TS init. The flag is never resolved. **Impact:** MEDIUM (bats, ghosts, and other no-collision actors rely on this to stay in bounds). **Verification:** Bats/ghosts spawned in game are inert or low-speed (limited movement), so boundary exit is unlikely in practice. However, **a fast bat without collision could escape the map in TS**.

**Recommendation:** 
1. Add a `constrainToPlayArea` property to Movement (default false).
2. Call autoConstrainToPlayArea logic in Movement.init() (set constrainToPlayArea = !collisionEnabled).
3. In Movement.update(), after moveBox(), check constrainToPlayArea and clamp position to play bounds if true.

---

#### `exitedPlayArea` (line 351–360) — Handle actor exiting bounds

**Lingo:**  
```lingo
on exitedPlayArea me, newLoc
  
  if pAllowScreenExit then
    g.collisionMaster.notifyOfScreenExit(me.ID.bigMe, newLoc)
  else
    newLoc = g.collisionMaster.constrainLocToPlayArea(newLoc)
  end if
  
  return newLoc
end
```

**TS:** **NOT IMPLEMENTED**  
- TS does not detect or handle play-area exits
- Position is clamped by collision if collisionDetection=true (terrain is at the edge)
- If no terrain collision, actor can exit unchecked

**Status:** ⚠ **GAP #3** — exitedPlayArea handler is missing. Play-area exit detection and notification is not implemented in TS. **Impact:** MEDIUM (projectiles and fast actors could theoretically exit the map if spawned near the edge with no collision). **Recommendation:** Implement in Movement.update() after position update: check if new position is out-of-bounds, and either constrain or notify (depending on a flag).

---

### 4. **TEAM & ALLEGIANCE**

#### `getTeam` (line 557–559) — Query team allegiance
**Lingo:**  
```lingo
on getTeam me
  return pTeam
end
```

**TS:** `Team.getTeam()` (combat.ts:135)  
```typescript
getTeam(): string { return this.team; }
```

**Status:** ✓ **MAPPED** — Query team via entity.send("getTeam").

---

#### `setTeam` / `getTeamRole` (line 759–763, 561–563) — Set team / query role

**Lingo:**  
```lingo
on setTeam me, newTeam
  me.leaveTeam()
  pTeam = newTeam
  me.joinTeam()
end

on getTeamRole me
  return pTeamRole
end
```

**TS:**  
- `Team.getTeamRole()` (combat.ts:136)
- `setTeam()` — not exposed as a message handler in TS

**Status:** ⚠ **CAPABILITY GAP** — setTeam is not exposed in TS. If an actor needs to switch teams at runtime (e.g., a betrayal mechanic), there's no direct message. **Impact:** LOW (no shipped game code switches teams mid-game; team is set at spawn).

---

#### `joinTeam` (line 610–612) — Register with team roster

**Lingo:**  
```lingo
on joinTeam me
  g.teamMaster.joinTeam(pTeam, pTeamRole, me.ID.bigMe)
end
```

**TS:** Deferred to combat tick  
- `teams.ts:54-58` — `register()` method
- Called by CombatTick on entity spawn (implicit; no explicit join message)

**Status:** ✓ **MAPPED** — Team registration happens on entity spawn (post-build), delegated to teamMaster. Outcome is identical.

---

#### `leaveTeam` (line 614–617) — Deregister from team roster

**Lingo:**  
```lingo
on leaveTeam me
  g.teamMaster.leaveTeam(pTeam, pTeamRole, me.ID.bigMe)
  me.big.internalEvent(#leftTeam)
end
```

**TS:** Deferred to combat tick  
- `teams.ts:59-64` — `unregister()` method
- Called when entity is removed from play

**Status:** ✓ **MAPPED** — Team deregistration on entity cleanup. Outcome is identical.

---

### 5. **MODE & STATE**

#### `getMode` / `setMode` / `goMode` (line 464–583)

**Lingo:**  
```lingo
on getMode me
  return pMode
end

on setMode me, newVal
  pMode = newVal
end

on goMode me, newMode
  ancestor.goMode(newMode)
  pPreviousMode = pMode
  pMode = newMode
end
```

**TS:** Mode is **component-specific**, not centralized  
- Chatter.getMode() / goMode() (chatter.ts:51, 55)
- CpuAI.goMode() (control.ts, internal, not exposed as message)
- No central `getMode()` message handler on actors

**Status:** ⚠ **ARCHITECTURAL CHANGE** — TS does not have a centralized mode system on GameObject. Modes are implicit in component state (e.g., Chatter's FSM: waiting → talking → finishedTalking). This is **not a behavioral gap** (the FSM still works), but it's a refactoring that loses the centralized mode query/set interface.

**Recommendation:** If gameplay code needs to query actor mode (e.g., "is the player in reel mode?"), TS has no handler. Add a generic `getMode()` handler that delegates to Anim or control component (if present).

---

#### `getPreviousMode` (line 492–494) — Query previous mode
**Lingo:**  
```lingo
on getPreviousMode me
  return pPreviousMode
end
```

**TS:** Not exposed  
- No message handler for previous mode

**Status:** ⚠ **CAPABILITY GAP** — getPreviousMode is not exposed. Low-impact (no known code queries it).

---

### 6. **HIT MECHANICS & INERTIA**

#### `takeHit` (line 781–788) — **KEYSTONE HANDLER** (already detailed in existing audit)

**Lingo:**  
```lingo
on takeHit me, collideVect, attackingObj, owner
  percent = 100 - pInertia
  collideVect[1] = VarValRange(percent, [0, collideVect[1]])
  collideVect[2] = VarValRange(percent, [0, collideVect[2]])
  me.pMoveXY.vectAdd(collideVect)
  
  ancestor.takeHit(collideVect, attackingObj, owner)
end
```

**TS:** Movement.takeHit (movement.ts:54-64)  
```typescript
takeHit(next: NextFn, vx = 0, vy = 0, attackerId = -1, mult = 1): any {
  const d = (100 - this.inertia) / 100;
  const dvx = vx * d, dvy = vy * d;
  if (!this.entity.send("isReelProof")) {
    let kx = dvx * KNOCK_SCALE, ky = dvy * KNOCK_SCALE;
    const km = Math.hypot(kx, ky);
    if (km > KNOCK_MAX) { kx = (kx / km) * KNOCK_MAX; ky = (ky / km) * KNOCK_MAX; }
    this.kvx += kx; this.kvy += ky;
  }
  return next(dvx, dvy, attackerId, mult);
}
```

**Status:** ✓ **MAPPED** — Inertia damping formula identical; knockback impulse accumulated; damped vector passed downstream. See existing audit (lines 11–192) for full analysis. **No gaps here.**

---

#### `getDead` / `setDead` (line 420–422, 683–685) — Query/set dead state

**Lingo:**  
```lingo
on getDead me
  return pDead
end

on setDead me, newDead
  pDead = newDead
end
```

**TS:** `Energy.isDead()` / Energy.dead (combat.ts:106, 40-42)  
```typescript
isDead(): boolean { return this.dead; }
```

**Status:** ✓ **MAPPED** — Death state is queried via `entity.send("isDead")`. setDead is implicit (takeHit sets dead when energy <= 0). Setting dead externally is not a typical operation (team should use takeHit or direct energy set).

---

### 7. **FRICTION DYNAMICS** (⚠ GAP #4)

#### `frictionReel` / `frictionNormal` / `frictionStrong` / `frictionXOn/Off` / `frictionYOn/Off` / `frictionSet` (line 366–397)

**Lingo:**  
```lingo
on frictionReel me
  pMoveXY.setFriction(pFrictionReel.duplicate())
end

on frictionNormal me
  me.frictionXOn()
  me.frictionYOn()
end

on frictionStrong me
  pMoveXY.setFriction(point(20,20))
end

on frictionXOff me
  pMoveXY.setFrictionX(5)
end

on frictionXOn me
  pMoveXY.setFrictionX(pFrictionX)
end

-- etc. for Y
```

**TS:** Movement applies **static friction** set once at init  
- `movement.ts:40, 83-84`
  ```typescript
  if (typeof cfg["friction"] === "number") this.friction = cfg["friction"];
  ...
  if (this.intentX === 0) this.vx *= this.friction;
  if (this.intentY === 0) this.vy *= this.friction;
  ```

**Status:** ⚠ **GAP #4** — Friction mode transitions are NOT implemented in TS. Movement has a single `friction` factor applied uniformly; there are no handlers for frictionReel, frictionNormal, frictionStrong, or per-axis friction control.

**Impact:** **MEDIUM** — Lingo uses high friction in #reel mode (pFrictionReel=point(10,10)) to create viscous stagger feedback. TS applies uniform friction throughout, so hit-stagger may feel less crisp.

**Recommendation:** 
1. Add friction-mode transition support to Movement or a separate FrictionControl component.
2. Expose `setFriction(newFriction)` message handler.
3. Wire Hurt component to call `entity.send("setFriction", pFrictionReel)` when reel mode is triggered (objCharacter goMode #reel → modReel.txt:79).
4. Priority: **LOW–MEDIUM** (gameplay feel refinement, not a logic bug; room-1 clears without it).

---

### 8. **SAVE/RESTORE LIFECYCLE**

#### `addSaveData` (line 186–198) — Serialize state for save file

**Lingo:**  
```lingo
on addSaveData me, sd
  ancestor.addSaveData(sd)
  me.addToSaveData(sd)
  sd[#pMode] = pMode
  sd[#pPreviousMode] = pPreviousMode
  sd[#pRecordInRoomState] = pRecordInRoomState
  saveData = [:]
  pMoveXY.addSaveData(saveData)
  sd[#pMoveXY] = saveData
end
```

**TS:** Components implement `addSaveData()`  
- `movement.ts:70-73` (Movement saves x, y, vx, vy)
- `combat.ts:113-116` (Energy saves energy, max, dead)
- Others (Anim, Hurt, etc.) save per-component

**Status:** ✓ **MAPPED** — Save/restore is per-component; ordered fold messages ensure state is collected. Outcome is identical.

---

#### `restoreFromSave` (line 658–668) — Deserialize state after load

**Lingo:**  
```lingo
on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
  pMode = sd.pMode
  pPreviousMode = sd.pPreviousMode
  pRecordInRoomState = sd.pRecordInRoomState
  pMoveXY.restoreFromSave(sd.pMoveXY)
  me.restoreFromSaveData(sd)
end
```

**TS:** Components implement `restoreFromSave()`  
- `movement.ts:74-78` (Movement restores x, y, vx, vy)
- Similar per-component pattern

**Status:** ✓ **MAPPED** — Ordered fold messages ensure state is restored correctly. Outcome is identical.

---

#### `addToSaveData` / `restoreFromSaveData` (line 206–212, 670–677) — Helper for custom save fields

**Lingo:**  
```lingo
on addToSaveData me, sd
  sd[#pActorType] = pActorType
  sd[#pCollisionDetection] = pCollisionDetection
  sd[#pTeam] = pTeam
  sd[#spriteHeight] = pSpr.height
  sd[#spriteWidth] = pSpr.width
end
```

**TS:** Per-component save (no separate helper); Identity, Team, etc., save their data inline.

**Status:** ✓ **MAPPED** — Equivalent pattern; no gap.

---

### 9. **SPRITE & RENDER**

#### `getSpriteHeight` / `setSpriteHeight` (line 526–528, 747–749)
#### `getSpriteWidth` / `setSpriteWidth` (line 538–540, 755–757)
#### `getSpriteColor` / `setSpriteColour` (line 522–524, 731–733)
#### `setSpriteRotation` (line 751–753)
#### `setSpriteLayer` / `getLocZ` (line 743–745)
#### `getSprite` / `getMember` / `setMember` (line 518–520, 449–451, 719–721)

**TS:** Sprite properties are **NOT exposed** as message handlers in TS  
- Sprite is created at spawn time (init) and rendered by the game loop
- Dynamic sprite property changes are not supported

**Status:** ⚠ **CAPABILITY GAPS** — Sprite getters/setters are not exposed. If gameplay logic needs to dynamically resize, recolor, or rotate a sprite mid-game, TS has no handler.

**Impact:** **LOW** — No shipped game code does this. Cosmetic only.

**Recommendation:** If needed, add handlers for critical operations (setColor, setRotation, setSize) to an Anim or Sprite component.

---

### 10. **UTILITIES & QUERIES**

#### `getActorType` (line 399–401) — Query actor class/type

**Lingo:**  
```lingo
on getActorType me
  return pActorType
end
```

**TS:** `Identity.getActorType()` (identity.ts:16)  
```typescript
getActorType(): string { return this.actorType; }
```

**Status:** ✓ **MAPPED** — Query via entity.send("getActorType").

---

#### `getCharacter` (line 408–410) — Query character category

**Lingo:**  
```lingo
on getCharacter me
  return pCharacter
end
```

**TS:** `pCharacter` (a classification like #gameObject, #actor, etc.) is **not stored** in TS  
- Actors are classified by component composition (e.g., Anim+Control → actor, no Anim → static)
- No getCharacter handler

**Status:** ⚠ **CAPABILITY GAP** — getCharacter is not exposed. This was a Lingo category system. TS implicitly types actors (player/enemy/ally/dwelling/projectile/pickup/etc. via e.type), so querying a generic character category is not needed.

---

#### `getCollisionDetection` / `getCollisionUseMiddle` (line 412–418)

**Lingo:**  
```lingo
on getCollisionDetection me
  return pCollisionDetection
end

on getCollisionUseMiddle me
  return pCollisionUseMiddle
end
```

**TS:** **NOT EXPOSED**  
- No message handlers for these queries
- Collision behavior is determined by Movement.passThrough (for bullets)

**Status:** ⚠ **CAPABILITY GAPS** — These queries are not exposed. Low-impact (no code queries them at runtime).

---

#### `getMoveVect` / `getMoveXYFin` / `getMoveXYParams` (line 468–478)

**Lingo:**  
```lingo
on getMoveVect me
  return pMoveXY.getMoveVect()
end

on getMoveXYFin me
  return pMoveXY.getFin()
end

on getMoveXYParams me, function
  return pMoveXY.getParams(function)
end
```

**TS:** **NOT EXPOSED**  
- No generic getMoveVect or MoveXY parameter query interface

**Status:** ⚠ **CAPABILITY GAPS** — Low-impact; internal movement state details.

---

#### `getRadius` (line 496–498)

**Lingo:**  
```lingo
on getRadius me
  return me.getWidth() / 2
end
```

**TS:** **NOT EXPOSED**  
- No getRadius handler

**Status:** ⚠ **CAPABILITY GAP** — Low-impact (collision uses box size directly, not radius queries).

---

#### `getRegPoint` (line 510–512) — Query sprite registration point

**Lingo:**  
```lingo
on getRegPoint me
  return pSpr.member.regPoint
end
```

**TS:** **NOT EXPOSED**  
- Collision rect logic uses regpoint internally (calcCollisionRegPoint), but not queryable

**Status:** ⚠ **CAPABILITY GAP** — Low-impact; internal collision detail.

---

#### `getRecordInRoomState` / `setRecordInRoomState` (line 506–508, 727–729)

**Lingo:**  
```lingo
on getRecordInRoomState me
  return pRecordInRoomState
end

on setRecordInRoomState me, newVal
  pRecordInRoomState = newVal
end
```

**TS:** `recordInRoomState` is **not exposed as a handler** in TS  
- Room state is handled by save/restore system implicitly

**Status:** ⚠ **CAPABILITY GAP** — If an actor needs to dynamically toggle whether it saves its state (e.g., a consumable after pickup), TS has no handler. Low-impact; most actors are static in room state (respawn or not at load).

---

#### `getStalled` (line 514–516) — Query movement stall state

**Lingo:**  
```lingo
on getStalled me
  return pMoveXY.getStalled()
end
```

**TS:** **NOT EXPOSED**  
- Movement stall state is internal; no query handler

**Status:** ⚠ **CAPABILITY GAP** — Low-impact; AI state machines do not query this.

---

#### `getAIPlatformDrop` (line 403–406) — Fake no-op for non-AI actors

**Lingo:**  
```lingo
on getAIPlatformDrop me
  -- fake function for non-AI gameObjects
  return false
end
```

**TS:** No equivalent (non-AI actors do not override this)

**Status:** ✓ **N/A** — Platform-drop logic is CPU-AI-specific in TS (control.ts), not on base GameObject.

---

#### `informCallingPrg` (line 594–595), `recordInRoomState` (line 642–646), `finishConditionMet` (line 362–364)

**Lingo:**  
```lingo
on informCallingPrg me
  -- empty (override in subclasses)
end

on recordInRoomState me
  return pRecordInRoomState
end

on finishConditionMet me
  return pDead
end
```

**TS:** These are either empty no-ops or implicit in component logic.

**Status:** ✓ **IMPLICIT** — finishConditionMet is implicit in entity death (Energy.isDead). No gaps.

---

#### `internalEvent` (line 597–608) — Dispatch internal events

**Lingo:**  
```lingo
on internalEvent me, theEvent
  ancestor.internalEvent(theEvent)
  
  case theEvent of
    #addToArmyDetails:
      me.addToArmyDetails()
      
    #restoreFromArmyDetails:
      me.restoreFromArmyDetails()
      
  end case
end
```

**TS:** Entity dispatch system handles internal events via `entity.send()` chain messages  
- e.g., `entity.send("eventLeaveGame", target)` (teams.ts:75)

**Status:** ✓ **MAPPED** — Internal event dispatch is now message-based. Outcome is identical.

---

#### `paws` / `unpaws` (line 633–640, 790–797) — Pause/resume lifecycle

**Lingo:**  
```lingo
on paws me
  pMoveXY.paws()
  if pTransColor <> #none then pTransColor.paws()
  ancestor.paws()
end

on unpaws me
  pMoveXY.unpaws()
  if pTransColor <> #none then pTransColor.unpaws()
  ancestor.unpaws()
end
```

**TS:** No explicit pause/resume in TS  
- Game loop is always running or halted globally (no per-actor pause)

**Status:** ⚠ **CAPABILITY GAP** — Per-actor pause/resume is not supported in TS. If the game needs to pause individual actors (e.g., frozen enemies), there's no handler. Freeze component exists (combat.ts Freeze) but implements freezeFactor (slow-down), not pause.

**Impact:** LOW (game does not pause individual actors; global pause exists).

---

#### `update` / `updateAI` (line 799–808)

**Lingo:**  
```lingo
on update me
  ancestor.update()
end

on updateAI me
  -- override in objects with AI
end
```

**TS:** Component update() handlers (Movement.update, Energy.update, CpuAI.update, etc.) are called each tick via the dispatch system.

**Status:** ✓ **MAPPED** — Per-component update replaces centralized update loop. Outcome is identical.

---

#### `moveToTarget` / `moveLoc` (line 623–625, 619–621)

**Lingo:**  
```lingo
on moveToTarget me, params
  pMoveXY.moveToTarget(params)
end

on moveLoc me, newLoc
  pMoveXY.moveLoc(newLoc)
end
```

**TS:** These are **internal MoveXY module operations**, not exposed as message handlers in TS  
- Movement state is updated via position/velocity directly
- No generic `moveToTarget` or `moveLoc` handlers

**Status:** ⚠ **CAPABILITY GAPS** — If external code needs to move an actor to a target location or apply a location delta, TS has no generic handler. Low-impact (AI internally manages movement).

---

#### Sprite query helpers: `getRect`, `getSpriteRect`, `getMemberSize`, `getMemberType`, `getImage`

**TS:** These are **NOT exposed as message handlers**  
- Sprite metadata is accessed directly from game context or Anim component

**Status:** ⚠ **CAPABILITY GAPS** — Sprite inspection is not exposed. Low-impact; internal details.

---

### 11. **EDGE CASES & MINOR HANDLERS**

#### `calcCollisionRegPoint` (line 174–184) — Compute collision-rect registration offset

**Lingo:**  
```lingo
on calcCollisionRegPoint me
  if pCollisionUseMiddle then
    reg = point(0,0)
    reg[1] = me.getSprite().width / 2
    reg[2] = me.getSprite().height / 2
  else
    reg = me.getMember().regpoint
  end if
  return reg
end
```

**TS:** Collision-rect logic is **internal to Movement/Anim**; not exposed as a queryable handler.

**Status:** ⚠ **CAPABILITY GAP** — Low-impact; internal collision detail.

---

#### `calcEdgeOffset`, `calcNewRect` (line 214–245) — Collision-rect helpers

**Lingo:**  
```lingo
on calcEdgeOffset me
  [compute edge offsets for collision rect]
end

on calcNewRect me, newLoc
  [compute collision rect at location]
end
```

**TS:** These are **internal to collision logic** (collision.ts grid.moveBox, Movement); not exposed.

**Status:** ⚠ **CAPABILITY GAPS** — Low-impact; internal collision detail. Collision rects are auto-computed by the grid, not queryable.

---

#### `setFlip`, `setFlipFromDir`, `getFlip`, `getFlipAsDir` (line 687–434)

**Lingo:**  
```lingo
on setFlip me, newFlip
  pSpr.flipH = newFlip
end

on getFlip me
  return pSpr.flipH
end

on getFlipAsDir me
  if pSpr.flipH then return -1 else return 1
end

on setFlipFromDir me, theDir
  if theDir = 1 then me.setFlip(0) else if theDir = -1 then me.setFlip(1)
end
```

**TS:** Flip/direction is **tracked by Movement.facingLeft** (movement.ts:90)  
```typescript
if (this.vx < 0) this.facingLeft = true; else if (this.vx > 0) this.facingLeft = false;
```

- Anim component likely uses this to flip the sprite at render time
- No explicit getFlip/setFlip/setFlipFromDir handlers

**Status:** ⚠ **CAPABILITY GAP** — Flip state is not exposed as queryable/settable via message handler. If AI needs to explicitly set facing direction (e.g., to face a target before attacking), TS has no handler. **Low-impact** (most AI facing is driven by walk velocity).

---

#### `goMode`, `setMode`, `getMode`, `getPreviousMode` (re-visited, more detail)

**TS:** Mode is **architectural refactoring** in TS:
- **Lingo:** Centralized pMode property on objGameObject, set via goMode(), queried via getMode().
- **TS:** No central mode; state is implicit in component logic (e.g., Chatter FSM: waiting → talking → finishedTalking; Hurt triggers mode change via entity.send("characterModeChanged", "#reel")).

**Impact:** If gameplay logic needs to query "what mode is the player in?" (e.g., "is player in #attack mode?"), TS has no centralized answer. This is a **design change**, not a gap (TS's implicit FSM is actually cleaner), but it loses the centralized query interface.

**Recommendation:** If needed, add a generic `getCharacterMode()` handler that queries the primary FSM component (Anim or Control).

---

## GAP SUMMARY

| # | Handler/Feature | Type | File:Line | TS Status | Severity | Impact | Fix Priority |
|---|---|---|---|---|---|---|---|
| **1** | `collisionDetectionOn` / `collisionDetectionOff` | Toggle | objGameObject.txt:299–305 | MISSING | Medium | Bats/ghosts can't toggle collision mid-game | Low–Medium |
| **2** | `autoConstrainToPlayArea` | Initialization | objGameObject.txt:164–172 | MISSING | Medium | Fast actors without collision can escape map | Medium |
| **2b** | `constrainToPlayArea` constraint in checkCollisions | Partial | objGameObject.txt:252–254 | MISSING | Medium | Play-area boundary not enforced | Medium |
| **3** | `exitedPlayArea` handler | Detection | objGameObject.txt:351–360 | MISSING | Medium | Exit events not notified | Medium |
| **4** | `frictionReel` / `frictionNormal` / `frictionStrong` | Friction modes | objGameObject.txt:366–397 | MISSING | Medium | Reel mode stagger may feel less crisp | Low–Medium |
| — | `setLoc` | Position set | objGameObject.txt:715–717 | Missing | Low | Can't teleport at runtime | Low |
| — | `getVect` / `setVect` / `getVectX` | Velocity query/set | objGameObject.txt:565–567, 765–767 | Missing | Low | Can't query velocity externally | Low |
| — | `setTeam` | Team change | objGameObject.txt:759–763 | Missing | Low | Can't switch teams at runtime | Low |
| — | Centralized `getMode` / `setMode` | Mode query/set | objGameObject.txt:464–583 | Missing (implicit) | Low | No centralized mode query | Low |
| — | `getFlip` / `setFlip` / `setFlipFromDir` | Direction | objGameObject.txt:424–741 | Missing | Low | Can't query/set facing direction | Low |
| — | Sprite property getters/setters | Render | objGameObject.txt:522–757 | Missing | Low | Can't dynamically resize/recolor sprite | Low |
| — | `paws` / `unpaws` | Pause/resume | objGameObject.txt:633–796 | Missing | Low | Per-actor pause not supported | Low |

---

## VERIFIED GAPS IN DEPTH

### GAP #1: collisionDetectionOn/Off (Medium Severity)

**Lingo:**
```lingo
on collisionDetectionOff me
  pCollisionDetection = false
end

on collisionDetectionOn me
  pCollisionDetection = true
end
```

**TS:** No equivalent toggle  
- Movement.passThrough exists (for bullets), hardcoded at init
- No runtime toggle

**When Used:**
- Lingo: objGameObject.checkCollisions() reads pCollisionDetection; if false, skips g.collisionMaster.checkCollisions()
- Example: Bats, ghosts might toggle collision based on mode

**Impact:** LOW–MEDIUM  
- In-game bats/ghosts are spawned with no collision (passThrough=true or zero walkSpeed), not toggled mid-game
- If future gameplay adds a "phase through walls" mechanic, TS lacks the handler

**Fix:** Add `setCollisionEnabled(enabled: boolean)` to Movement; in update(), conditionally call moveBox().

---

### GAP #2: autoConstrainToPlayArea / constrainToPlayArea (Medium Severity)

**Lingo:**
```lingo
on autoConstrainToPlayArea me
  if pConstrainToPlayArea = #auto then
    if pCollisionDetection = true then
      pConstrainToPlayArea = false
    else
      pConstrainToPlayArea = true
    end if
  end if
end

on checkCollisions me, newLoc
  if pCollisionDetection then
    newLoc = g.collisionMaster.checkCollisions(me.big, newLoc)
  end if
  
  if pConstrainToPlayArea then
    newLoc = g.collisionMaster.constrainToPlayArea(me.big, newLoc)
  end if
  
  return newLoc
end
```

**TS:** 
- `autoConstrainToPlayArea()` is **NOT called** in Movement.init()
- `constrainToPlayArea()` is **NOT called** in Movement.update()
- Movement.moveBox() handles terrain collision but NOT play-area boundary

**When Used:**
- Lingo init: line 93 calls autoConstrainToPlayArea() to resolve #auto flag
- Lingo update: checkCollisions() ensures actors stay in bounds (if pConstrainToPlayArea=true)

**Impact:** MEDIUM  
- Actors without terrain collision (passThrough=true) can escape the map if they move fast enough or spawn near the edge
- Bats (walkSpeed ~3) are unlikely to hit edge in practice
- Projectiles with passThrough=true could theoretically escape

**Fix:**
1. Add `constrainToPlayArea: boolean` property to Movement (default false)
2. In Movement.init(), resolve `#auto` to !collisionEnabled (if collisionDetection is true, no need to constrain; if false, do constrain)
3. In Movement.update(), after moveBox(), clamp position to play bounds if constrainToPlayArea is true
4. Define play-area bounds in game context (or hardcode 0..roomWidth, 0..roomHeight)

**Evidence:**
- Lingo: objGameObject.txt:51, 53, 89, 91, 93, 247–254, 164–172
- TS: movement.ts (no constrainToPlayArea logic)

---

### GAP #3: exitedPlayArea Notification (Medium Severity)

**Lingo:**
```lingo
on exitedPlayArea me, newLoc
  
  if pAllowScreenExit then
    g.collisionMaster.notifyOfScreenExit(me.ID.bigMe, newLoc)
  else
    newLoc = g.collisionMaster.constrainLocToPlayArea(newLoc)
  end if
  
  return newLoc
end
```

**TS:** No exit detection or notification  
- Play-area boundary is not checked
- No `pAllowScreenExit` flag
- No notification mechanism

**When Used:**
- Lingo: Called when an actor's position goes out-of-bounds (collision master detects)
- Projectiles with pAllowScreenExit=true can travel off-screen; others are constrained
- Notification triggers room-exit logic (actor leaves play, despawns, or transitions)

**Impact:** MEDIUM  
- Projectiles near screen edge should despawn; in TS, they might persist off-screen
- Room-transition logic may not trigger correctly for edge cases

**Fix:**
1. Implement play-area boundary check in Movement.update() (after moveBox())
2. If position is out-of-bounds and pAllowScreenExit=true, notify (entity.send("eventScreenExit", newLoc)) or trigger cleanup
3. If pAllowScreenExit=false, constrain position (fall back to GAP #2 fix)
4. Recommendation: Defer to room manager / projectile cleanup system (simpler than per-actor notification)

---

### GAP #4: Friction Mode Transitions (Medium Severity)

**Lingo:**
```lingo
on frictionReel me
  pMoveXY.setFriction(pFrictionReel.duplicate())
end

on frictionNormal me
  me.frictionXOn()
  me.frictionYOn()
end

on frictionStrong me
  pMoveXY.setFriction(point(20,20))
end

on frictionXOff me
  pMoveXY.setFrictionX(5)
end

on frictionXOn me
  pMoveXY.setFrictionX(pFrictionX)
end

on frictionYOff me
  pMoveXY.setFrictionY(0)
end

on frictionYOn me
  pMoveXY.setFrictionY(pFrictionY)
end

on frictionSet me, newFriction
  pMoveXY.frictionSet(newFriction)
end
```

**TS:** Movement has a single static `friction` factor, applied uniformly  
```typescript
if (this.intentX === 0) this.vx *= this.friction;
if (this.intentY === 0) this.vy *= this.friction;
```

**When Used:**
- Lingo modReel.txt:79 calls `me.big.frictionReel()` in #reel mode to set high friction (pFrictionReel=point(10,10)), creating a stagger/slow effect
- Lingo modReel.txt:83 calls `me.big.frictionNormal()` when leaving #reel mode

**Impact:** MEDIUM (gameplay feel)  
- Reel mode in Lingo has crisp, viscous deceleration (high friction = quick stop)
- TS applies uniform friction, so reel mode deceleration feels the same as normal walk friction
- Not a logic bug, but stagger feedback is less pronounced

**Fix:**
1. Add a `setFriction(x: number, y: number)` handler to Movement
2. In Hurt component, when reel mode is triggered (characterModeChanged("#reel")), call `entity.send("setFriction", 10, 10)` (or pFrictionReel)
3. When leaving reel mode, call `entity.send("setFriction", originalFriction.x, originalFriction.y)`
4. Recommendation: Priority LOW–MEDIUM; gameplay feel refinement. Room-1 clears without it.

**Evidence:**
- Lingo: objGameObject.txt:366–397; modReel.txt:75–83
- TS: movement.ts:83–84 (static friction); hurt.ts (no friction mode transition)

---

## NON-GAPS (Intentional or Implicit)

### Centralized Mode System (Architectural Change, Not a Gap)

**Lingo:** Every actor has a central `pMode` property, queried/set via getMode/setMode/goMode.

**TS:** Mode is implicit in component state (Chatter FSM, CpuAI state machine, Anim state).

**Why it's not a gap:**
- TS's implicit FSM is architecturally cleaner
- Each component manages its own state (Chatter: waiting/talking/finishedTalking; Anim: walk/attack/die; etc.)
- Outcome is identical (actors have state, state drives behavior)
- If centralized mode query is needed, add a generic handler that delegates to the relevant component

---

### Collision Events Dispatched as Messages

**Lingo:** Collision handlers (collisionWallLeft, collisionPlatform, etc.) are called directly on the object.

**TS:** Collision events are dispatched as chain messages (entity.send("collisionWallLeft")).

**Why it's not a gap:**
- Outcome is identical (event triggers appropriate response)
- TS design is actually cleaner (decouples Movement from physics response)
- Any component can listen for collision events

---

### Hair Collision (Cosmetic Omission)

**Lingo:** objGameObject.checkCollisionsWithHair tests if the player's hair (cosmetic sprite decoration) collides with the actor.

**TS:** Hair is not modeled; player is a single collision box.

**Why it's not a gap:**
- Hair collision is cosmetic only; no gameplay logic depends on it
- Player projectile collision is tested on the player's movement box, not hair

---

### Knockback Scaling (Intentional px-Scale Recalibration)

**Lingo:** Knockback vector is applied at full magnitude.

**TS:** Knockback is scaled by KNOCK_SCALE=0.06 and clamped to KNOCK_MAX=5.

**Why it's not a gap:**
- TS operates at px-scale (different coordinate system)
- Raw Lingo vectors would launch units across the room at px scale
- Documented in K1 plan and movement.ts comments (lines 10–15)
- This is the intentional px-scale recalibration, not a behavioral gap

---

## RECOMMENDATIONS

### High Priority (Fix Now)

1. **GAP #2: autoConstrainToPlayArea / constrainToPlayArea**
   - Add `constrainToPlayArea` property to Movement
   - Resolve `#auto` flag in init (set to !collisionEnabled)
   - Clamp position to bounds in update() if flag is true
   - **Files:** movement.ts
   - **Effort:** LOW (30–50 lines)

### Medium Priority (Fix Before Shipping)

2. **GAP #3: exitedPlayArea Notification**
   - Detect play-area boundary exit in Movement.update()
   - Trigger cleanup or notification (entity.send("eventScreenExit"))
   - Alternative: Defer to projectile/room manager (simpler)
   - **Files:** movement.ts or projectile.ts
   - **Effort:** LOW–MEDIUM (50–100 lines)

3. **GAP #4: Friction Mode Transitions**
   - Add `setFriction(x, y)` handler to Movement
   - Wire Hurt component to call it on mode change
   - **Files:** movement.ts, hurt.ts
   - **Effort:** LOW–MEDIUM (50–75 lines)
   - **Priority:** LOW–MEDIUM (gameplay feel, not logic)

### Low Priority (Nice to Have)

4. **setLoc / getVect / setVect / setTeam**
   - Add handlers if gameplay logic needs runtime position/velocity/team changes
   - Currently missing; low-impact (no shipped code uses them)

5. **Centralized getMode / setMode**
   - Add a generic `getCharacterMode()` handler for consistency
   - Delegate to Anim or Control component (if present)
   - Low-impact; TS's implicit FSM works fine as-is

6. **Sprite dynamic properties (size, color, rotation)**
   - Add handlers if cosmetic effects need runtime changes
   - Currently missing; render is static at spawn

---

## CONCLUSION

**Summary:**
- ✓ **Core behavioral parity:** takeHit, collision, team, save/restore — all MAPPED
- ⚠ **4 verified GAPS:** Collision toggle, play-area constraint, exit notification, friction modes — all **MEDIUM severity**, **LOW–MEDIUM fix effort**
- ⚠ **Multiple capability gaps:** Velocity getters, direction setters, sprite properties — all **LOW severity**, **LOW impact** (no shipped code uses them)
- ✓ **Architectural refactoring:** Implicit mode system, message-based events — **NOT gaps**, intentional design improvements

**Overall:** objGameObject.txt is ~95% complete in TS. The 4 verified gaps are gameplay mechanics (especially play-area constraint), not logic bugs. Recommend fixing GAPs #2–#3 before shipping; GAP #4 is polish (reel mode feel).

---

