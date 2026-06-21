# Actor Audit: tv

**Actor Name:** tv  
**Lingo Class:** act_berlinTV  
**Actor Type:** Cutscene prop (ghost)  
**Audit Date:** 2026-06-21  
**Status:** CLEAN

---

## Summary

The **tv** actor is a cutscene-triggered prop that appears in the rescueBerlin_002 in-game cutscene. It's a ghost (non-physical) prop spawned by cutscene scripts to provide visual context during dialogue. The port implementation maintains 100% behavioral parity with the original Lingo game.

---

## 1. Classification & Gameplay Role

### Original (Lingo)
- **File:** /home/user/merlin-s-revenge/casts/data/act_berlinTV.txt:1-16
- **Class:** act_berlinTV with #name: "tv" (line 10)
- **Inheritance:** #inherit: #chatter (line 3)
- **Type:** Cutscene prop (propStatus: #prop, line 11)
- **Special Property:** #ghost: true (line 6) — leaves no grave on death

### Port (TypeScript)
- **File:** /home/user/merlin-s-revenge/port/src/generated/data.json
- **Entry:** "act_berlinTV" with "name": "tv"
- **Inheritance:** "inherit": "#chatter" (via act_chatter → act_actor)
- **Type:** Cutscene prop (propStatus: "#prop")
- **Special Property:** "ghost": true — properly handled by Grave component (/home/user/merlin-s-revenge/port/src/components/grave.ts:18)

**Finding:** Classification matches perfectly.

---

## 2. Inheritance Chain Verification

### Original Chain: act_berlinTV ← #chatter ← #actor

**act_berlinTV specifics (casts/data/act_berlinTV.txt):**
| Property | Value | Purpose |
|----------|-------|---------|
| #inherit | #chatter | Base type |
| #character | #berlinTV | Character sprite/animation |
| #collisionRect | rect(-100, -1, 100, 100) | Spatial bounds |
| #ghost | true | No grave on death |
| #initFaceDir | 1 | Initial facing direction (right) |
| #member | member("anm_tv_stand_3_01", "gfx") | Animation member |
| #miniMapStatus | #clr | Not visible on minimap |
| #name | "tv" | Actor display name |
| #propStatus | #prop | Marked as prop |
| #scriptToPerform | #rescueBerlin_002 | Cutscene to trigger |
| #speechColor | rgb(182,95,64) | Dialogue text color |
| #startOffset | point(-16, -16) | Sprite offset |
| #weight | 0 | No collision weight |

**act_chatter inheritance (casts/data/act_chatter.txt):**
| Property | Value |
|----------|-------|
| #objType | #objChatter |
| #AiType | #objAiChatter |
| #inherit | #actor |
| #collisionDetection | false |
| #collisionRect | rect(-60, -2, 60, 2) |
| #createOnSolid | true |

**act_actor base (casts/data/act_actor.txt):**
| Property | Value |
|----------|-------|
| #actorType | #typ |
| #initLoc | point(random(450), 300) |
| #initVect | point(0,0) |
| #layerZ | gGameObjectLayer |
| #masterPrg | #actorMaster |
| #miniMapStatus | #inf |
| #startOffset | point(-16, -16) |
| #team | #chatters |

### Port Implementation

**Generated data (port/src/generated/data.json):**
```json
{
  "act_berlinTV": {
    "header": { "name": "act_berlinTV", "type": "#field" },
    "data": {
      "inherit": "#chatter",
      "character": "#berlinTV",
      "collisionRect": { "left": -100, "top": -1, "right": 100, "bottom": 100 },
      "ghost": true,
      "initFaceDir": 1,
      "member": { "$member": ["anm_tv_stand_3_01", "gfx"] },
      "miniMapStatus": "#clr",
      "name": "tv",
      "propStatus": "#prop",
      "scriptToPerform": "#rescueBerlin_002",
      "speechColor": { "r": 182, "g": 95, "b": 64 },
      "startOffset": { "x": -16, "y": -16 },
      "weight": 0
    }
  },
  "act_chatter": {
    "header": { "name": "act_chatter", "type": "#field" },
    "data": {
      "objType": "#objChatter",
      "AiType": "#objAiChatter",
      "inherit": "#actor",
      "collisionDetection": false,
      "collisionRect": { "left": -60, "top": -2, "right": 60, "bottom": 2 },
      "createOnSolid": true
    }
  },
  "act_actor": {
    "header": { "name": "act_actor", "type": "#field" },
    "data": {
      "actorType": "#typ",
      "initLoc": { "x": { "$call": "random", "args": [450] }, "y": 300 },
      "initVect": { "x": 0, "y": 0 },
      "layerZ": { "$global": "gGameObjectLayer" },
      "masterPrg": "#actorMaster",
      "miniMapStatus": "#inf",
      "startOffset": { "x": -16, "y": -16 },
      "team": "#chatters"
    }
  }
}
```

**Registry Resolution (port/src/data/registry.ts:92-100):** The port's Registry class flattens the #inherit chain and resolves all inherited properties at actor-resolution time. When resolveActor("berlinTV") is called, it merges act_berlinTV with act_chatter with act_actor, with child overrides taking precedence.

**Finding:** Inheritance chain is properly ported. All properties are present and correctly converted (points, colors, strings, and object references).

---

## 3. Gameplay-Relevant Data Analysis

### Attack/Combat Properties
- Original: **NONE** (not present in act_berlinTV)
- Port: **NONE**
- **Finding:** ✓ Parity maintained.

### Team/Alignment
- Original: Inherits #team: #chatters from act_actor (casts/data/act_actor.txt:10)
- Port: Inherits #team: "#chatters" from act_actor resolved via registry
- **Finding:** ✓ Parity maintained.

### Energy/Strength/Defense
- Original: **NONE** (not a combat entity)
- Port: **NONE**
- **Finding:** ✓ Parity maintained.

### Spawn/Summon Mechanics
- Original: Not a spawner. Spawned by cutscene scripts (rescueBerlin_002.txt:4 defines alias #berlinTV - t)
- Port: Not a spawner. Same cutscene alias mechanism at port/src/data/cutscene.ts:31 (produceProp/teleportInAt verbs)
- **Finding:** ✓ Parity maintained.

### scriptToPerform & Cutscene Triggering
- Original: #scriptToPerform: #rescueBerlin_002 (casts/data/act_berlinTV.txt:12)
- Port: "scriptToPerform": "#rescueBerlin_002" with Chatter component (port/src/components/chatter.ts:20-47)
- **Mechanism:** Port's Chatter component (line 20) extracts scriptToPerform, resolves it without the leading # (line 46), and calls game.scene?.playInGameCutScene(script) on player overlap.
- **Cutscene:** rescueBerlin_002 is available in port/public/assets/cutscenes/ (bundled at build time)
- **Finding:** ✓ Parity maintained. Cutscene triggering works identically.

### reincarnateAs
- Original: **NONE**
- Port: **NONE**
- **Finding:** ✓ Parity maintained.

### Collision & Solidity
- Original:
  - #collisionRect: rect(-100, -1, 100, 100) — overrides chatter's rect(-60, -2, 60, 2)
  - #ghost: true — no physical collision/damage
  - #weight: 0 — no mass
  - #propStatus: #prop — marked as prop, not a living actor
- Port:
  - "collisionRect": { "left": -100, "top": -1, "right": 100, "bottom": 100 }
  - "ghost": true — Grave component disables graveOn (port/src/components/grave.ts:19)
  - "weight": 0
  - "propStatus": "#prop"
  - "collisionDetection": false (inherited from act_chatter, casts/data/act_chatter.txt:6)
- **Finding:** ✓ Parity maintained. Ghost props are non-physical in both versions.

---

## 4. Character Definition Verification

### Original
- #character: #berlinTV is referenced in casts/data/act_berlinTV.txt:4
- #berlinTV is listed in casts/data/tlk_merlinObjects_key.txt:59 (tileset icon key)
- Character sprite member: anm_tv_stand_3_01 (line 8)

### Port
- "character": "#berlinTV" in port/src/generated/data.json
- Character definitions not separately listed in generated data (character sprites are resolved at runtime via member loads)
- Animation member: { "$member": ["anm_tv_stand_3_01", "gfx"] } (correctly ported)
- **Verification:** Port loads animation member via the standard $member resolver
- **Finding:** ✓ Parity maintained.

---

## 5. Cutscene Usage Verification

### Original
- **File:** /home/user/merlin-s-revenge/in_game_scenes_(don't_play)(If you want to make one, go to data, scr_stones1, through 10)/rescueBerlin_002.txt:1-118
- **Usage:** Alias #berlinTV - t (line 4) in cutscene characters section
- **Commands using tv:**
  - Line 13: t: ...whoah LOOK at THAT!!... (dialogue)
  - Line 63: b produceProp g (berlin produces gmgBullets, unrelated to tv)
- **Spawning:** tv is instantiated by the cutscene as a character alias, not placed in a room map

### Port
- **File:** /home/user/merlin-s-revenge/port/public/assets/cutscenes/ (bundled cutscenes)
- **Cutscene Parser:** Handles character aliases and produceProp/teleportInAt verbs identically at port/src/data/cutscene.ts
- **Spawning:** Cutscene script engine instantiates actors by name via the registry
- **Finding:** ✓ Parity maintained. Cutscene system handles tv correctly.

---

## 6. Map/Room Placement Check

### Original
- No evidence of tv being placed in any static room map (casts/data/act_berlinTV.txt is the only definition)
- tv is spawned **only** by the rescueBerlin_002 cutscene
- No hardcoded room references to "tv" actor

### Port
- No map data found for static tv placement
- tv is spawned only by cutscene scripts
- Registry correctly resolves the actor by name when cutscene commands reference it
- **Finding:** ✓ Parity maintained.

---

## 7. Behavioral Differences & Edge Cases

### Ghost Property Handling
- **Original:** #ghost: true prevents grave module from recording a grave on death (casts/script_objects/modGrave.txt)
- **Port:** Grave component (port/src/components/grave.ts:19) mirrors this: `this.graveOn = cfg["ghost"] !== true`
- **Finding:** ✓ Exact parity.

### Collision Rectangle Override
- **Original:** tv's collisionRect rect(-100, -1, 100, 100) overrides the chatter base rect(-60, -2, 60, 2)
- **Port:** Child properties override parent via registry's mergeRecords (port/src/data/registry.ts:42-43)
- **Finding:** ✓ Exact parity.

### Non-Combat Status
- tv inherits from #chatter, not #CPUCharacter or #actorPlayer
- It has no #attack, #energy, #strength, or combat stats
- Port correctly treats tv as a non-combatant NPC
- **Finding:** ✓ Exact parity.

---

## 8. Property Coverage Matrix

| Property | Original | Port | Status |
|----------|----------|------|--------|
| #name | "tv" | "tv" | ✓ |
| #inherit | #chatter | "#chatter" | ✓ |
| #character | #berlinTV | "#berlinTV" | ✓ |
| #collisionRect | rect(-100,-1,100,100) | {...left:-100,...} | ✓ |
| #ghost | true | true | ✓ |
| #initFaceDir | 1 | 1 | ✓ |
| #member | member("anm_tv_stand_3_01","gfx") | $member[...] | ✓ |
| #miniMapStatus | #clr | "#clr" | ✓ |
| #propStatus | #prop | "#prop" | ✓ |
| #scriptToPerform | #rescueBerlin_002 | "#rescueBerlin_002" | ✓ |
| #speechColor | rgb(182,95,64) | {r:182,g:95,b:64} | ✓ |
| #startOffset | point(-16,-16) | {x:-16,y:-16} | ✓ |
| #weight | 0 | 0 | ✓ |
| (inherited) #objType | #objChatter | "#objChatter" | ✓ |
| (inherited) #AiType | #objAiChatter | "#objAiChatter" | ✓ |
| (inherited) #collisionDetection | false | false | ✓ |
| (inherited) #team | #chatters | "#chatters" | ✓ |
| (inherited) #actorType | #typ | "#typ" | ✓ |
| (inherited) #initLoc | point(random(450),300) | {$call:"random",...} | ✓ |

---

## Conclusion

The **tv** actor (act_berlinTV) demonstrates **100% behavioral parity** between the original Lingo game and the TypeScript port. All properties are correctly ported, inheritance chains are properly resolved, and the cutscene triggering mechanism works identically. No gaps or discrepancies were found.

The actor is a ghost cutscene prop that:
1. Spawns only via cutscene scripts (rescueBerlin_002)
2. Is non-physical (ghost=true) and leaves no grave
3. Has no combat capabilities
4. Uses a scriptToPerform for in-game cutscene triggering
5. Renders with the anm_tv_stand_3_01 animation member

All of these behaviors are correctly implemented in the port.
