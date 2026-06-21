# Behavioral Audit: act_treesRocks

**Actor:** treesRocks — scenery/decoration prop  
**Archetype:** #objActorPlayer / cutscene character (modProp: prop-capable)  
**Classification:** Decoration/scenery prop; NOT placeable in regular gameplay; cutscene-only role  
**Scope:** Data properties + prop inheritance chain verification (not gameplay-relevant for normal maps)

## Data Verification

| Property | Original | Port | Status |
|----------|----------|------|--------|
| **inherit** | #actorPlayer | #actorPlayer | ✓ Resolved (act_actor → #actor, act_actorPlayer → #objActorPlayer) |
| **objType** | #objActorPlayer (inherited) | #objActorPlayer | ✓ Cutscene character object |
| **character** | #prop | #prop | ✓ Animation sprite type |
| **name** | "treesRocks" | "treesRocks" | ✓ Identity |
| **team** | #collectables | #collectables | ✓ Faction (override of #chatters from act_actor) |
| **speechColor** | rgb(182,95,64) | {r:182, g:95, b:64} | ✓ Speaker color (unused for props) |
| **initLoc** | point(random(450), 300) (inherited) | {x: random(450), y: 300} | ✓ Spawn origin (not used in cutscenes) |
| **initVect** | point(0,0) (inherited) | {x: 0, y: 0} | ✓ Initial velocity |
| **layerZ** | gGameObjectLayer (inherited) | $global: "gGameObjectLayer" | ✓ Rendering layer |
| **masterPrg** | #actorMaster (inherited) | #actorMaster | ✓ Master controller |
| **miniMapStatus** | #inf (inherited) | #inf | ✓ Map display (not visible) |
| **startOffset** | point(-16, -16) (inherited) | {x: -16, y: -16} | ✓ Sprite origin |
| **AiType** | #objAiAttack (inherited from #actorPlayer) | #objAiAttack | ✓ AI controller (not active for props) |
| **energy** | (none; defaults via objCharacter init) | (handled via Energy component defaults) | ✓ Not gameplay-relevant for decoration |
| **propStatus** | (via modProp: #notAProp default) | propStatus: "notAProp" (Thespian.ts:140) | ✓ Prop-capable but not inherently a prop |

**Verification Notes:**
- No solidity, collision, blocking, or scriptToPerform properties (pure decoration)
- No attack, damage, or gameplay-affecting data
- Team #collectables indicates it may have been planned as a collectible but is not used as one in maps
- #objActorPlayer includes modProp module (casts/script_objects/objActorPlayer.txt:11), enabling prop mechanics in cutscenes

## Cutscene Role

**Original (casts/script_objects/objActorPlayer.txt:1-18):**
- modThespian.produceProp / propAt verbs can convert any #objActorPlayer into a carried prop (#prop status)
- modProp enables carrier/carried relationship; carried actors track carrier position
- treesRocks is NOT deployed as a prop in authored cutscenes (grep confirms only act_treesRocks and act_treesRocksBW declarations, no script references)

**Port (port/src/scenes/thespian.ts:52-72, 140-143, 242-247):**
- CutActorArchetype spawns cutscene characters via registry.resolveActor
- Line 151-155: spawnCutActor reads team from resolved actor data → defaults to #chatters, uses actor#team if set
- Line 140: propStatus initialized to "notAProp" for all spawned cutscene actors
- Lines 242-247: propAt/produceProp/putAwayProp/dropProp verbs implemented; prop mechanics functional
- treesRocks data resolves correctly (inherit → team → speechColor all inherited/override as expected)

**Verdict:** ✓ Faithful. If treesRocks were spawned in a cutscene and used with a prop verb (propAt/produceProp), the port would handle it correctly. Team field override, propStatus initialization, and prop verb dispatch all match original intent.

## Inheritance Chain Resolution

**Original (casts/data):**
```
act_treesRocks:
  #inherit: #actorPlayer
  #character: #prop
  #name: "treesRocks"
  #team: #collectables

act_actorPlayer:
  #objType: #objActorPlayer
  #AiType: #objAiAttack
  #inherit: #actor

act_actor:
  #team: #chatters
  #initLoc: point(random(450), 300)
  #initVect: point(0, 0)
  #layerZ: gGameObjectLayer
  #masterPrg: #actorMaster
  #miniMapStatus: #inf
  #startOffset: point(-16, -16)
```

**Port (port/src/generated/data.json):**
```json
{
  "act_treesRocks": {
    "data": {
      "inherit": "#actorPlayer",
      "character": "#prop",
      "name": "treesRocks",
      "speechColor": {"r": 182, "g": 95, "b": 64},
      "team": "#collectables"
    }
  }
}
```

**Registry.resolveActor Result (port/src/data/registry.ts:92-113):**
- Merges act_actor → act_actorPlayer → act_treesRocks (parent-over-child)
- Flattened result includes all inherited properties + overrides
- team: #collectables correctly overrides parent #chatters
- No attack schema (no #attack property in chain)

**Verification:**
- File: `/home/user/merlin-s-revenge/casts/data/act_treesRocks.txt:3` → inherit chain correct
- File: `/home/user/merlin-s-revenge/port/src/generated/data.json` → treesRocks entry present, inherit resolved
- File: `/home/user/merlin-s-revenge/port/src/data/registry.ts:100-104` → mergeRecords applies parent-over-child overlay correctly

**Status:** ✓ Chain resolves faithfully in port.

## Placement & Collision Behavior

**Original:**
- checkCollisions in objActorPlayer (casts/script_objects/objActorPlayer.txt:20-22) returns newLoc unchanged
- No collision detection or solidity per actor
- NOT placeable as an interactive obstacle in maps (no solid/collision markers)
- Decoration-only; used in cutscenes as background detail or carried prop

**Port:**
- No gameplay maps spawn treesRocks (not in room state records or map object lists)
- Cutscene-only: if spawned in Thespian, moves and animates via Entity/Movement, no collision system interaction
- Entity archetype: cutscene type (dispatch.ts), never added to game.entities combat loop

**Verdict:** ✓ Faithful. Non-solid behavior preserved; no collision simulation needed.

## Animation & Sprite

**Original:**
- #character: #prop → animates via anm_prop spritesheet (cutscene anims)
- No special anim states for treesRocks (no health, death, attack anims)

**Port (port/src/scenes/thespian.ts:40-43):**
- CUT_ANIM_CHAR fallback: cutAnimChar("treesRocks") returns "tre" (first 3 chars) or queries anm_treesRocks if asset exists
- If treesRocks asset pack absent, sprite index fallback to first 3 chars (standard Director heuristic)
- Minimal Anim module (stand, walk, face only; no damage/freeze anims needed for static prop)

**Verdict:** ✓ Faithful. Animation routing matches original prop semantics.

## Summary

treesRocks is a **pure decoration/scenery prop** with no gameplay-relevant properties (no solidity, energy, attacks, collision, scripting). The original Lingo actor is a cutscene-only #objActorPlayer that CAN be used as a prop (propAt/produceProp verbs) but ISN'T authored into any active cutscene in the game.

**Data:** All inherited properties (team, sprite, position, layer) correctly merge and override in the port registry.  
**Mechanics:** If treesRocks were spawned in a cutscene, the Thespian would instantiate it via CutActorArchetype, resolve its data including team=#collectables, initialize propStatus="notAProp", and allow prop verbs to convert it to a carried/placed prop. All verb dispatch (propAt/produceProp/etc.) implemented and functional.  
**Non-gaps:** Property-coverage and intentional K1 re-calibration do not apply (no damage/gameplay scaling). Decoration status is preserved.

**Class Verification:** #objActorPlayer prop mechanics verified through modProp and Thespian verb audit (port/src/scenes/thespian.ts lines 242-247, modProp ported into Entity components).

**Status: CLEAN** (data verified across inheritance chain; prop mechanics functional; no gameplay-affecting gaps).
