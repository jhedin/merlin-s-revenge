# Audit: prestotolin Actor Behavioral Parity

**Actor:** prestotolin (cutscene prop / named-wizard character)  
**Audit Date:** 2026-06-21  
**Status:** CLEAN

## Classification

**Actor Type:** Cutscene prop with two variants:
1. **act_prestotolin** (cutscene-only prop): A #scriptToPerform trigger used exclusively in cutscenes
2. **act_prestotolinInGame** (named-wizard CPU character): A in-game playable ally for the player team

**Role in Game:**
- Named wizard character appearing in cutscene scr_stones3 (demo_006_ulin)
- Supports dialogue/character interaction in game narrative
- Available as a friendly AI character in gameplay (act_prestotolinInGame variant)

## Original Lingo Definition (casts/)

### act_prestotolin.txt (cutscene variant)
File: /home/user/merlin-s-revenge/casts/data/act_prestotolin.txt:1-13

```
[#name: "act_prestotolin", #type: #field]
[
#inherit: #actorPlayer,
#collisionRect: rect(-60, -2, 60, 2),
#initFaceDir: -1,
#miniMapStatus: #spe,
#name: "presto",
#scriptToPerform: #demo_006_ulin,
#speechColor: rgb(173,49,255),
#startOffset: point(-16, -16),
#walkSpeed: 2,
#weight: 0
]
```

**Key Properties Identified:**
- **#inherit:** #actorPlayer (inherits from player actor base)
- **#scriptToPerform:** #demo_006_ulin (triggers cutscene on interaction)
- **#walkSpeed:** 2 (cutscene movement speed)
- **#initFaceDir:** -1 (faces left initially)
- **#miniMapStatus:** #spe (special/unique status on minimap)
- **#speechColor:** rgb(173,49,255) (purple dialogue text)
- **#collisionRect:** rect(-60, -2, 60, 2) (collision bounds)
- **#startOffset:** point(-16, -16) (sprite anchor offset)
- **#weight:** 0 (non-physical, cutscene-only)

### act_prestotolinInGame.txt (gameplay variant)
File: /home/user/merlin-s-revenge/casts/data/act_prestotolinInGame.txt:1-37

**Gameplay-Relevant Data:**
- **#attack:** punch attack with 30 power, 10-frame cooldown (line 8-15)
- **#team:** #aldevar (friendly wizard team, line 33)
- **#energy:** 200 HP (line 21)
- **#strength:** 1 (line 32)
- **#wizard:** true (spellcaster AI, line 18)
- **#weapon:** #energyPulseSpell (spell attack, line 36)
- **#walkSpeed:** 3 (gameplay movement, line 35)

## Parent Class Chain Resolution (casts/data/)

**Parent: #actorPlayer** (act_actorPlayer.txt:1-6)  
**Grandparent: #actor** (act_actor.txt:1-11)

Both properly define base actor behavior including team, miniMapStatus, and startOffset.

## TypeScript Port Implementation (port/src/)

### Data Serialization (port/src/generated/data.json)

**act_prestotolin Entry:** ✓ VERIFIED
- All properties present and correctly serialized
- collisionRect: rect(-60, -2, 60, 2) → {left: -60, top: -2, right: 60, bottom: 2}
- speechColor: rgb(173,49,255) → {r: 173, g: 49, b: 255}
- scriptToPerform: #demo_006_ulin (string preserved)
- startOffset: point(-16, -16) → {x: -16, y: -16}

**act_prestotolinInGame Entry:** ✓ VERIFIED
- All gameplay-relevant properties present
- Attack stats, team, energy, wizard flag all correct

### Runtime Actor Resolution (port/src/data/registry.ts)

**Registry Resolution:** ✓ VERIFIED
- Registry.resolveActor("prestotolin") will successfully load act_prestotolin
- Inheritance chain properly resolved: prestotolin → #actorPlayer → #actor
- Case-insensitive fallback active if needed
- File: /home/user/merlin-s-revenge/port/src/data/registry.ts:86-104

### Cutscene Integration (port/src/scenes/thespian.ts)

**Cutscene Spawning:** ✓ VERIFIED
- spawnCutActor("prestotolin") will succeed
- Will create entity with proper team, animChar, energy
- Script-to-perform trigger ready if placed
- File: /home/user/merlin-s-revenge/port/src/scenes/thespian.ts:149-156

### Cutscene Script Integration (port/src/generated/assets.json)

**Bundled Cutscene:** ✓ VERIFIED
- scr_stones3 bundled and available at cutscenes/stones3.txt
- Character reference in script: `#prestotolin - p`
- File: /home/user/merlin-s-revenge/port/public/assets/cutscenes/stones3.txt:2-5

### scriptToPerform Handler (port/src/components/chatter.ts)

**Script Trigger Logic:** ✓ VERIFIED
- Chatter component reads scriptToPerform property
- On player overlap, triggers cutscene playback
- #demo_006_ulin will be correctly handled
- File: /home/user/merlin-s-revenge/port/src/components/chatter.ts:19-49

## Gameplay-Relevant Data Verification

| Property | Lingo | TypeScript | Status |
|----------|-------|-----------|--------|
| **Cutscene Variant (act_prestotolin)** |
| #name | "presto" | "presto" | ✓ MATCH |
| #scriptToPerform | #demo_006_ulin | "#demo_006_ulin" | ✓ MATCH |
| #walkSpeed | 2 | 2 | ✓ MATCH |
| #weight | 0 | 0 | ✓ MATCH |
| #initFaceDir | -1 | -1 | ✓ MATCH |
| #miniMapStatus | #spe | "#spe" | ✓ MATCH |
| #speechColor | rgb(173,49,255) | {r:173,g:49,b:255} | ✓ MATCH |
| #collisionRect | rect(-60,-2,60,2) | {left:-60,top:-2,...} | ✓ MATCH |
| **Gameplay Variant (act_prestotolinInGame)** |
| #team | #aldevar | "#aldevar" | ✓ MATCH |
| #energy | 200 | 200 | ✓ MATCH |
| #strength | 1 | 1 | ✓ MATCH |
| #wizard | true | true | ✓ MATCH |
| #attack (power) | point(30,0) | {x:30,y:0} | ✓ MATCH |
| #attack (cooldown) | 10 | 10 | ✓ MATCH |

## Map Placement Analysis

**Note:** prestotolin is defined as two variants but **not placed in any map**. It appears only as:
- Cutscene reference in scr_stones3 (dialogue cutscene)
- Named character in team registry (tlk_merlinOpenObjects_key)

The port successfully:
- ✓ Provides both actor definitions (cutscene prop + gameplay variant)
- ✓ Bundles the cutscene that references prestotolin
- ✓ Registry resolves the actor for cutscene spawning
- ✓ All gameplay data correctly ported

## Summary

**No gameplay-relevant properties missed.** The port contains complete behavioral parity for:
- Cutscene actor (act_prestotolin) with #scriptToPerform trigger
- Gameplay variant (act_prestotolinInGame) with full combat stats
- Cutscene script (scr_stones3) with prestotolin character line
- Registry and Thespian integration to spawn/resolve the actor
