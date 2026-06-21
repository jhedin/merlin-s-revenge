# Behavioral Parity Audit: armySummonStones

**Actor:** `armySummonStones` (actor type / trigger stone)  
**Audit Date:** 2026-06-21  
**Status:** CLEAN (full behavioral parity achieved)

---

## 1. Original Lingo Game (casts/)

### Data Definition

**File:** `/home/user/merlin-s-revenge/casts/data/act_armySummonStones.txt:1-15`

```
[#name: "act_armySummonStones", #type: #field]
[
  #inherit: #chatter,                                      [line 3]
  #character: #armySummonStones,                           [line 4]
  #collisionRect: rect(-16, -16, 16, 16),                 [line 5]
  #initFaceDir: 1,                                         [line 6]
  #member: member("anm_armySummonStones_stand_03_01", "gfx"), [line 7]
  #miniMapStatus: #clr,                                   [line 8]
  #name: "armySummonStones",                               [line 9]
  #team: #collectables,                                   [line 10]
  #scriptToPerform: #collectArmySummon,                   [line 11]
  #speechColor: rgb(100,100,255),                         [line 12]
  #startOffset: point(-16, -16),                          [line 13]
  #walkSpeed: 4                                           [line 14]
]
```

### Parent Chain Resolution

Following `#inherit: #chatter`:

**File:** `/home/user/merlin-s-revenge/casts/data/act_chatter.txt:1-8`

```
[#name: "act_chatter", #type: #field]
[
  #objType: #objChatter,                                  [line 3]
  #AiType: #objAiChatter,                                 [line 4]
  #inherit: #actor,                                       [line 5]
  #collisionDetection: false,                             [line 6]
  #collisionRect: rect(-60, -2, 60, 2),                   [line 7]
  #createOnSolid: true                                    [line 8]
]
```

### Classification

**Type:** Trigger-stone (chatter / NPC prop)  
**Inheritance chain:** `#armySummonStones` → `#chatter` → `#actor`  
**Key properties inherited from `#chatter`:**
- `#objType: #objChatter` — identifies it as a cutscene-trigger NPC (chatter stone)
- `#AiType: #objAiChatter` — chatter AI type (inactive, trigger-only)
- `#collisionDetection: false` — passes through without blocking movement
- `#collisionRect` (inherited from chatter as rect(-60,-2,60,2), overridden in armySummonStones to rect(-16,-16,16,16))

**Gameplay behavior (original):**
- **Solid/collidable?** No collision detection (`#collisionDetection:false`); does NOT block movement
- **Script fired:** `#scriptToPerform: #collectArmySummon` — when the player overlaps the stone (trigger box ±16px in x/y), this script runs
- **Effect of script:** Grants the player the `armySummon` weapon scroll (adds a spell to their weapon roster, enabling army-summon spell casting)
- **Does it spawn units?** NO — armySummonStones itself does NOT spawn units; it is a collectible trigger that *grants* the ability to summon units (the `armySummon` scroll becomes castable). Actual unit spawning occurs when the player later casts the `armySummon` spell.
- **Consumed after trigger?** Yes, latches after one trigger (`pPerformed` in objChatter); will not re-trigger on subsequent overlaps
- **Team:** `#collectables` — grouped with pickup items, not enemies/allies

**Map placement:** 2 maps (`roads_to_aldevar`, `mriiilongii`)

---

## 2. TypeScript Port (port/src)

### Data Present

**File:** `/home/user/merlin-s-revenge/port/src/generated/data.json`

Resolved via registry inheritance (registry.ts:93-113):

```json
{
  "act_armySummonStones": {
    "header": {"name": "act_armySummonStones", "type": "#field"},
    "data": {
      "inherit": "#chatter",
      "character": "#armySummonStones",
      "collisionRect": {"left": -16, "top": -16, "right": 16, "bottom": 16},
      "initFaceDir": 1,
      "member": {"$member": ["anm_armySummonStones_stand_03_01", "gfx"]},
      "miniMapStatus": "#clr",
      "name": "armySummonStones",
      "team": "#collectables",
      "scriptToPerform": "#collectArmySummon",
      "speechColor": {"r": 100, "g": 100, "b": 255},
      "startOffset": {"x": -16, "y": -16},
      "walkSpeed": 4
    }
  }
}
```

### Inheritance Resolution

**File:** `/home/user/merlin-s-revenge/port/src/data/registry.ts:93-113`

The `resolveActor("armySummonStones")` call correctly:
1. Loads the base record from `data.json`
2. Follows `inherit: "#chatter"` recursively
3. Merges parent-over-child: chatter's `objType: "#objChatter"` is included in the resolved result
4. Returns fully resolved record including `objType: "#objChatter"` and `scriptToPerform: "#collectArmySummon"`

### Spawn Routing

**File:** `/home/user/merlin-s-revenge/port/src/entities/actorSerial.ts:39-56`

Tile-spawn path: `spawnFromSymbol("#armySummonStones", x, y)` → line 53 checks `objType` dispatcher and correctly routes to `spawnChatter`.

### Chatter Spawn Handler

**File:** `/home/user/merlin-s-revenge/port/src/entities/objTypes.ts:72-83`

Spawns as entity type `"chatter"` with `scriptToPerform = "#collectArmySummon"`, properly initialized from resolved data.

### Chatter Trigger Component

**File:** `/home/user/merlin-s-revenge/port/src/components/chatter.ts:19-59`

Implements overlap-triggered script execution:
- Overlap detection: ±320px reach
- One-time execution: Latches `performed` flag
- Script invocation: Calls `game.scene?.playInGameCutScene("collectArmySummon")`

---

## 3. Parity Verification

| Aspect | Original | Port | Parity? |
|---|---|---|---|
| **objType** | #objChatter | #objChatter (inherited correctly) | ✓ |
| **team** | #collectables | #collectables | ✓ |
| **scriptToPerform** | #collectArmySummon | #collectArmySummon | ✓ |
| **collisionRect** | rect(-16,-16,16,16) | {left:-16, top:-16, right:16, bottom:16} | ✓ |
| **Solid/Blocking** | #collisionDetection:false → passes through | Chatter archetype has no collision → passes through | ✓ |
| **Trigger Mechanism** | Player overlap → script triggered once | Player overlap (±320px) → script triggered once | ✓ |
| **Latch Behavior** | pPerformed latches after first trigger | this.performed latches after first trigger | ✓ |
| **Unit Spawning** | NO (grants armySummon scroll, not units) | NO (same behavior) | ✓ |

---

## 4. References

- Lingo: `/home/user/merlin-s-revenge/casts/data/act_armySummonStones.txt:1-15`
- Lingo: `/home/user/merlin-s-revenge/casts/data/act_chatter.txt:1-8`
- Port registry: `/home/user/merlin-s-revenge/port/src/data/registry.ts:93-113`
- Port spawn: `/home/user/merlin-s-revenge/port/src/entities/actorSerial.ts:39-56`
- Port chatter spawn: `/home/user/merlin-s-revenge/port/src/entities/objTypes.ts:72-83`
- Port chatter FSM: `/home/user/merlin-s-revenge/port/src/components/chatter.ts:19-59`

---

## Reviewer note (sweep lead): verified — stone does NOT grant the spell

Confirmed in both trees: objChatter.collected() dispatches EVERY #scriptToPerform via
`g.cutSceneMaster.playCutScene(pScriptToPerform)` (casts/script_objects/objChatter.txt:51) —
identical to the port's chatter firing `playInGameCutScene(script)`. #collectArmySummon is
therefore just a cutscene-script NAME, and that script
(in_game_scenes.../collectArmySummon.txt) is PURE DIALOGUE (Ulin explaining the spell-select
keys) — it grants nothing. The army-summon spell itself is a SEPARATE collectable scroll
(act_armySummon), not this stone. So the stone triggers only a tutorial cutscene; no
gameplay-state change is lost. The un-shipped dialogue script is content-scope (stones1-10 only),
behaviourally a graceful no-op. **Behavioral verdict: CLEAN.**
