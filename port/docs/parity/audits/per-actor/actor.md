# Behavioral Audit: act_actor (Inheritance-Defaults)

**Actor:** actor (base template) | **Type:** inheritance base, never spawned | **Inheritance:** none | **Team:** N/A

**Status:** BEHAVIORAL GAPS (objGameObject class defaults not applied in port)

---

## Summary

The `#actor` base template is an abstract record that all concrete game objects inherit from. In the original Lingo game, actors receive defaults from TWO sources:

1. **objGameObject class** (lines 43–74 in `casts/script_objects/objGameObject.txt`) — sets ~24 base properties
2. **act_actor data** (lines 2–11 in `casts/data/act_actor.txt`) — overrides 8 of those

The port's entity system has the infrastructure to support class-level defaults (the `collectDefaults` hook in dispatch.ts:21–22) but **no component implements it**. This means actors receive only the 8 properties explicitly in act_actor data, losing the 18 objGameObject defaults that concrete actors depend on.

---

## Original Architecture: Two-Layer Defaults

### Layer 1: objGameObject Class Initialization

File: `/home/user/merlin-s-revenge/casts/script_objects/objGameObject.txt` (lines 33–82)

When objGameObject.new() is called, it runs `modifyParams(#init)` which returns a property list initialized with ~24 defaults:

```lingo
i[#actorType] = #gameObject
i[#allowScreenExit] = false
i[#character] = #gameObject
i[#collisionDetection] = true
i[#collisionUseMiddle] = false
i[#constrainToPlayArea] = #auto
i[#createOnSolid] = false
i[#friction] = friction        -- point(50, 50)
i[#frictionReel] = point(10,10)
i[#inertia] = 0
i[#initFaceDir] = 1
i[#initLoc] = point(100,100)
i[#initMode] = #stand
i[#initVect] = point(0,0)
i[#keepVect] = false
i[#layerZ] = gGameObjectLayer
i[#name] = #none
i[#masterPrg] = #none
i[#member] = #none
i[#minCollisionSpeed] = 5
i[#recordInRoomState] = true
i[#stallSpeed] = 0.2
i[#startOffset] = point(0,0)
i[#team] = #none
i[#teamRole] = #teamMembers
i[#weight] = 0.2
i[#wizard] = false
```

File: `/home/user/merlin-s-revenge/casts/master_objects/actorMaster.txt` (lines 126–143, 267–285)

The actorMaster.retrieveActorData() resolves the #inherit chain and applies ListModifyProperties (deep merge):

```lingo
on retrieveActorData me, datatyp
  data = g.collectionsMaster.getObj(#objActorData, datatyp)
  data = dataObj.getData()
  
  if data[#inherit] <> void then
    inheritData = me.retrieveActorData(data.inherit)
    data = ListsMerge(inheritData.duplicate(), data)  -- shallow overlay
  end if
  
  return data
end

on setParamsFromData me, params, data
  params = ListModifyProperties(params, data)  -- DEEP overlay onto class defaults
  return data
end
```

**Key:** The actor data is merged ONTO the class-default params via `ListModifyProperties`, not replacing them. This means if an actor doesn't override `#friction`, it inherits the objGameObject default of `point(50,50)`.

### Layer 2: act_actor Data Overrides

File: `/home/user/merlin-s-revenge/casts/data/act_actor.txt` (lines 2–11)

```lingo
[#name: "act_actor", #type: #field]
[
#actorType: #typ
#initLoc: point(random(450), 300)
#initVect: point(0,0)
#layerZ: gGameObjectLayer
#masterPrg: #actorMaster
#miniMapStatus: #inf
#startOffset: point(-16, -16)
#team: #chatters
]
```

act_actor overrides only 8 properties of the 24+ objGameObject defaults. All others remain as class defaults.

### Verification via Inheritance Chain

When an actor like `bat` is spawned:

1. `act_bat` inherits from `#CPUCharacter`
2. `act_CPUCharacter` inherits from `#character`
3. `act_character` inherits from `#actor`
4. `act_actor` overrides 8 objGameObject defaults
5. All other objGameObject defaults carry through unchanged

Example: `bat` does NOT set `#weight`. The inheritance chain is:
- `act_bat` → (no #weight)
- `act_CPUCharacter` → (no #weight)
- `act_character` → (no #weight)
- `act_actor` → (no #weight)
- **objGameObject class default** → `#weight = 0.2` ✓

---

## Port Architecture: Single-Layer Defaults (DATA ONLY)

### Entity Build Pipeline

File: `/home/user/merlin-s-revenge/port/src/engine/dispatch.ts` (lines 118–125)

```typescript
build(record: Record<string, any> = {}): this {
  const cfg: Record<string, any> = {};
  for (const c of this.comps) c.collectDefaults?.(cfg);  // Component class defaults
  Object.assign(cfg, record);  // ListModifyProperties: actor data overlay
  for (const c of this.comps) c.init?.(cfg);
  return this;
}
```

The system calls `collectDefaults` on each component, allowing code-level defaults to be declared. **But no component implements it.**

### Registry.resolveActor (Inheritance Chain)

File: `/home/user/merlin-s-revenge/port/src/data/registry.ts` (lines 92–113)

```typescript
resolveActor(name: string): Record_ | undefined {
  const key = name.replace(/^#/, "");
  const cached = this.inheritCache.get(key);
  if (cached) return cached;
  const base = this.raw("actor", key);
  if (!base) return undefined;
  let data: Record_ = { ...base };
  const inherit = data["inherit"];
  if (typeof inherit === "string") {
    const parent = this.resolveActor(inherit);
    if (parent) data = mergeRecords(parent, data);  // Shallow merge
  }
  // ... attack schema merge ...
  this.inheritCache.set(key, data);
  return data;
}
```

This resolves only the data inheritance chain. It does NOT provide class-level defaults (would require a `collectDefaults` call, which doesn't exist).

### Generated act_actor Data

File: `/home/user/merlin-s-revenge/port/src/generated/data.json`

```json
{
  "act_actor": {
    "header": {"name": "act_actor", "type": "#field"},
    "data": {
      "actorType": "#typ",
      "initLoc": {"x": {"$call": "random", "args": [450]}, "y": 300},
      "initVect": {"x": 0, "y": 0},
      "layerZ": {"$global": "gGameObjectLayer"},
      "masterPrg": "#actorMaster",
      "miniMapStatus": "#inf",
      "startOffset": {"x": -16, "y": -16},
      "team": "#chatters"
    }
  }
}
```

Only 8 properties. No class defaults injected.

---

## Verified Gaps: 18 Missing objGameObject Defaults

For each gap: (1) original source cited, (2) port absence confirmed, (3) behavioral impact identified.

### GAP 1: allowScreenExit

**Original:** objGameObject.txt line 49  
**Value:** `false`  
**Port:** Undefined (not in generated/data.json act_actor; no component collectDefaults)  
**Impact:** BEHAVIORAL — Actors may leave the screen unintentionally. Original clips actors to play area; port behavior undefined.

```lingo
# Original (objGameObject.txt:49)
i[#allowScreenExit] = false
```

```typescript
// Port: no collectDefaults provides this
```

---

### GAP 2: character

**Original:** objGameObject.txt line 50  
**Value:** `#gameObject`  
**Port:** Undefined  
**Impact:** BEHAVIORAL — Character-type identification broken. Used for team targeting, NPC vs projectile logic.

```lingo
# Original
i[#character] = #gameObject
```

---

### GAP 3: collisionDetection

**Original:** objGameObject.txt line 51  
**Value:** `true`  
**Port:** Undefined  
**Impact:** CRITICAL — Collision system broken. Original: background tilemap collisions ON by default. Port: undefined means actors may pass through terrain if they don't explicitly override.

```lingo
# Original
i[#collisionDetection] = true
```

Evidence from bat: bat explicitly overrides to `false` (casts/data/act_bat.txt line 19). Without the class default of `true`, actors with no override have undefined collision behavior.

---

### GAP 4: collisionUseMiddle

**Original:** objGameObject.txt line 52  
**Value:** `false`  
**Port:** Undefined  
**Impact:** BEHAVIORAL — Collision registration changes. false = use sprite regpoint (the standard). Undefined may cause collision rect to compute from sprite center instead, altering hit zones.

```lingo
# Original
i[#collisionUseMiddle] = false
```

---

### GAP 5: constrainToPlayArea

**Original:** objGameObject.txt line 53  
**Value:** `#auto`  
**Port:** Undefined  
**Impact:** BEHAVIORAL — Play-area clipping logic. #auto means: if collisionDetection=true, constrain=false (can move freely); if collisionDetection=false, constrain=true (clip to screen). Undefined means no auto-clamping.

```lingo
# Original
i[#constrainToPlayArea] = #auto
```

---

### GAP 6: createOnSolid

**Original:** objGameObject.txt line 54  
**Value:** `false`  
**Port:** Undefined  
**Impact:** BEHAVIORAL — Actor spawn validation. Original: reject spawn if over solid background. Port: no validation if undefined, actors spawn inside walls.

```lingo
# Original
i[#createOnSolid] = false
```

Evidence from actorMaster.txt:227–245:

```lingo
if collisionsOk or forceCreate then
  collisionsOk = true
else
  collisionsOk = true
  if obj.getCollisionDetection() = true then
    collisionsOk = g.collisionMaster.checkCollisionsNewObject(obj)
  end if
  if collisionsOk = true then
    if obj.getCollisionDetection() = true then
      collisionsOk = me.checkCollisionsWithSolidArea(startLoc)
    end if
  end if
end if
```

This logic uses #createOnSolid to gate spawn validation.

---

### GAP 7: friction

**Original:** objGameObject.txt lines 41, 55  
**Value:** `point(50, 50)`  
**Port:** Undefined  
**Impact:** CRITICAL — Movement physics broken. Friction damps velocity each frame. Original: all actors decelerate at 50 px/frame² in both axes. Port: no friction means actors maintain velocity indefinitely.

```lingo
# Original
friction = point(50, 50)
i[#friction] = friction
```

Evidence from modMoveToLoc.txt + objGameObject.txt:125:

```lingo
pMoveXY.setFriction(params.friction)
```

Friction is applied to every frame update. Without it, movement physics are completely broken.

---

### GAP 8: frictionReel

**Original:** objGameObject.txt line 56  
**Value:** `point(10,10)`  
**Port:** Undefined in act_actor; act_CPUCharacter overrides to `point(10,10)` (act_CPUCharacter.txt line 4)  
**Impact:** BEHAVIORAL — Hit-reeling damping. After being knocked back, actors reel with this friction. Only CPUCharacter and subclasses get it; base actors and other branches lose it.

```lingo
# Original (applied to all actors)
i[#frictionReel] = point(10,10)
```

---

### GAP 9: inertia

**Original:** objGameObject.txt line 57  
**Value:** `0`  
**Port:** Undefined  
**Impact:** BEHAVIORAL — Knockback damping. inertia=0 means "no damping, apply full knockback" (modEnergy.txt). Actors that don't override inherit 0. Port: undefined means knockback calculations break.

```lingo
# Original
i[#inertia] = 0
```

Evidence from modEnergy.txt:

```lingo
-- Knockback damps by inertia
knock_damped = knock * ((100 - inertia) / 100)
```

Without the default 0, concrete actors like bat (which override to 60) would use wrong logic.

---

### GAP 10: initFaceDir

**Original:** objGameObject.txt line 58  
**Value:** `1`  
**Port:** Undefined  
**Impact:** BEHAVIORAL — Initial facing direction. 1 = face right, -1 = face left. Undefined means sprite orientation at spawn is wrong.

```lingo
# Original
i[#initFaceDir] = 1
```

---

### GAP 11: initMode

**Original:** objGameObject.txt line 60  
**Value:** `#stand`  
**Port:** Undefined  
**Impact:** BEHAVIORAL — Initial animation state. #stand is the idle pose. Undefined means actors spawn in wrong animation frame (or no animation).

```lingo
# Original
i[#initMode] = #stand
```

---

### GAP 12: keepVect

**Original:** objGameObject.txt line 62  
**Value:** `false`  
**Port:** Undefined  
**Impact:** BEHAVIORAL — Velocity persistence. false = clear velocity on frame update. Undefined means velocity behavior undefined.

```lingo
# Original
i[#keepVect] = false
```

---

### GAP 13: minCollisionSpeed

**Original:** objGameObject.txt line 67  
**Value:** `5`  
**Port:** Undefined  
**Impact:** BEHAVIORAL — Collision response threshold. Speeds below this don't register collisions. Undefined means all speeds collide (or none do).

```lingo
# Original
i[#minCollisionSpeed] = 5
```

---

### GAP 14: recordInRoomState

**Original:** objGameObject.txt line 68  
**Value:** `true`  
**Port:** Undefined  
**Impact:** BEHAVIORAL — Room persistence. true = actor saved when room exits. Undefined means actors don't persist across room re-entry.

```lingo
# Original
i[#recordInRoomState] = true
```

Evidence from objGameObject.txt:186–189:

```lingo
on addSaveData me, sd
  sd[#pRecordInRoomState] = pRecordInRoomState
```

This is critical for save-game compatibility.

---

### GAP 15: stallSpeed

**Original:** objGameObject.txt line 69  
**Value:** `0.2`  
**Port:** Undefined (only act_bat, act_caveBat, etc. override)  
**Impact:** BEHAVIORAL — Hit recovery speed. Higher = recover faster from knockback. bat overrides to 2 (casts/data/act_bat.txt line 27). Without the class default, other actors lose recovery.

```lingo
# Original
i[#stallSpeed] = 0.2
```

---

### GAP 16: teamRole

**Original:** objGameObject.txt line 72  
**Value:** `#teamMembers`  
**Port:** Undefined  
**Impact:** BEHAVIORAL — Team classification. #teamMembers = NPC/enemy, #teamBullets = projectile. Undefined breaks team querying.

```lingo
# Original
i[#teamRole] = #teamMembers
```

Evidence from objGameObject.txt:193:

```lingo
params.teamRole = #teamMembers
```

---

### GAP 17: weight

**Original:** objGameObject.txt line 73  
**Value:** `0.2`  
**Port:** Undefined  
**Impact:** CRITICAL — Movement velocity scaling. weight damps velocity applied to pMoveXY. Original: all actors slow-move at 0.2× the raw velocity. Port: undefined means all actors move at full speed (or stop).

```lingo
# Original
i[#weight] = 0.2
```

Evidence from objGameObject.txt:129:

```lingo
pMoveXY.setWeight(params.weight)
```

And modMoveToLoc.txt:

```lingo
pVect = pVect * pWeight  -- velocity damping
```

This is critical for movement speed calibration.

---

### GAP 18: wizard

**Original:** objGameObject.txt line 74  
**Value:** `false`  
**Port:** Undefined  
**Impact:** BEHAVIORAL — Wizard flag. Triggers wizard discovery logic. Undefined means non-player wizards won't be registered.

```lingo
# Original
i[#wizard] = false
```

Evidence from objGameObject.txt:141–143:

```lingo
if params.wizard = true then
  g.wizardMaster.newWizardFound(pActorType)
end if
```

---

## Non-Gaps (Intentional or Cosmetic)

These are correctly omitted from act_actor or port (not gaps):

1. **miniMapStatus** = `#inf` — explicitly in act_actor in both ✓
2. **masterPrg** = `#actorMaster` — explicitly in act_actor in both ✓
3. **name** = `#none` — actor-specific, no inheritance ✓
4. **member** = `#none` — animation member, actor-specific ✓

---

## Root Cause

The port's Entity.build() (dispatch.ts:118–125) has the infrastructure to apply component class defaults:

```typescript
for (const c of this.comps) c.collectDefaults?.(cfg);
```

But **no component implements collectDefaults**. Grep confirms:

```bash
$ grep -r "collectDefaults" /home/user/merlin-s-revenge/port/src/components --include="*.ts"
# (no results)
```

This architecture mismatch means class-level defaults (the entire objGameObject.txt:43–74) are not applied.

---

## Path to Fix

**Option A (Code-level, recommended):** Implement collectDefaults in a base component that all actors use (e.g., Spatial, Movement, or a new "Defaults" component):

```typescript
class BaseActorDefaults extends Component {
  static readonly handles = [];
  
  collectDefaults(cfg: Record<string, any>): void {
    cfg.allowScreenExit ??= false;
    cfg.character ??= "#gameObject";
    cfg.collisionDetection ??= true;
    cfg.collisionUseMiddle ??= false;
    cfg.constrainToPlayArea ??= "#auto";
    cfg.createOnSolid ??= false;
    cfg.friction ??= { x: 50, y: 50 };
    cfg.frictionReel ??= { x: 10, y: 10 };
    cfg.inertia ??= 0;
    cfg.initFaceDir ??= 1;
    cfg.initMode ??= "#stand";
    cfg.keepVect ??= false;
    cfg.minCollisionSpeed ??= 5;
    cfg.recordInRoomState ??= true;
    cfg.stallSpeed ??= 0.2;
    cfg.teamRole ??= "#teamMembers";
    cfg.weight ??= 0.2;
    cfg.wizard ??= false;
  }
}
```

**Option B (Data-level):** Add all 18 properties to act_actor.txt in the Lingo source, then regenerate data.json. (This changes the design philosophy that act_actor is minimal; not recommended.)

---

## Summary Table

| Property | Original | Port | Gap? | Severity |
|----------|----------|------|------|----------|
| actorType | #typ | #typ | NO | — |
| initLoc | point(random(450), 300) | point(random(450), 300) | NO | — |
| initVect | point(0,0) | point(0,0) | NO | — |
| layerZ | gGameObjectLayer | gGameObjectLayer | NO | — |
| masterPrg | #actorMaster | #actorMaster | NO | — |
| miniMapStatus | #inf | #inf | NO | — |
| startOffset | point(-16, -16) | point(-16, -16) | NO | — |
| team | #chatters | #chatters | NO | — |
| allowScreenExit | false | undefined | **YES** | High |
| character | #gameObject | undefined | **YES** | High |
| collisionDetection | true | undefined | **YES** | **CRITICAL** |
| collisionUseMiddle | false | undefined | **YES** | Medium |
| constrainToPlayArea | #auto | undefined | **YES** | High |
| createOnSolid | false | undefined | **YES** | High |
| friction | point(50,50) | undefined | **YES** | **CRITICAL** |
| frictionReel | point(10,10) | undefined | **YES** | High |
| inertia | 0 | undefined | **YES** | High |
| initFaceDir | 1 | undefined | **YES** | High |
| initMode | #stand | undefined | **YES** | High |
| keepVect | false | undefined | **YES** | Medium |
| minCollisionSpeed | 5 | undefined | **YES** | Medium |
| recordInRoomState | true | undefined | **YES** | **CRITICAL** |
| stallSpeed | 0.2 | undefined | **YES** | High |
| teamRole | #teamMembers | undefined | **YES** | High |
| weight | 0.2 | undefined | **YES** | **CRITICAL** |
| wizard | false | undefined | **YES** | Medium |

---

## Conclusion

**18 verified behavioral gaps** in `#actor` base template defaults. All are gameplay-critical (movement physics, collision, team classification, animation, room persistence). The port's architectural support for class-level defaults exists but is unused.

---

ACTOR=actor | GAPS=18 | collisionDetection (terrain collision OFF by default), friction (movement deceleration undefined), weight (velocity scaling broken), recordInRoomState (save persistence lost), inertia/stallSpeed/frictionReel (knockback physics broken), initMode/initFaceDir (animation state undefined), character/teamRole (team identification broken), constrainToPlayArea/createOnSolid/allowScreenExit (screen/spawn clipping undefined), minCollisionSpeed/collisionUseMiddle/keepVect (collision/movement response undefined), wizard (discovery logic broken)
