# Behavioral Audit: act_ochreHydra

**Actor Type:** Cutscene/prop character (not placeable in gameplay maps)
**Status:** CLEAN

## Overview

`ochreHydra` is a cutscene-only actor that inherits from `#actorPlayer` and uses the `#ochreWizard` character sprite. It is defined solely for narrative/presentation purposes (e.g., story sequences or flashback scenes) and carries no gameplay mechanics or combat properties.

## Original (Lingo) Definition

**File:** `/home/user/merlin-s-revenge/casts/data/act_ochreHydra.txt` (lines 1-14)

```lingo
[#name: "act_ochreHydra", #type: #field]
[
#inherit: #actorPlayer,
#character: #ochreWizard,
#collisionRect: rect(-60, -2, 60, 2),
#initFaceDir: -1,
#miniMapStatus: #spe,
#name: "ochreHydra",
#propCarryLoc: point(10,-10),
#team: #collectables,
#speechColor: rgb(215,209,49),
#startOffset: point(-16, -16),
#walkSpeed: 4
]
```

### Inheritance Chain

1. `act_ochreHydra` → `#actorPlayer` (objActorPlayer.txt:1-22)
   - Loads modules: modFader, modPositioning, **modProp**, modStretcher, modTeleport, modThespian, modWastedMode
   - Inherits from objCharacter (no combat properties)

2. No further gameplay inheritance; `#actorPlayer` is a pure cutscene class.

### Property Analysis

| Property | Type | Value | Purpose |
|----------|------|-------|---------|
| `#inherit` | symbol | `#actorPlayer` | Cutscene/script actor base class |
| `#character` | symbol | `#ochreWizard` | Visual sprite/animation set |
| `#collisionRect` | rect | rect(-60,-2,60,2) | Collision bounds for prop interaction |
| `#initFaceDir` | int | -1 | Facing direction: -1 = left |
| `#miniMapStatus` | symbol | `#spe` | Map icon: special (non-gameplay) |
| `#name` | string | "ochreHydra" | Instance name |
| `#propCarryLoc` | point | point(10,-10) | Offset when carried by another actor |
| `#team` | symbol | `#collectables` | Non-combat team (neutral/prop) |
| `#speechColor` | rgb | rgb(215,209,49) | Speech bubble text color (yellow-gold) |
| `#startOffset` | point | point(-16,-16) | Sprite anchor offset |
| `#walkSpeed` | int | 4 | Cutscene walk speed (pixels/frame) |

### No Gameplay Data

Notably absent (confirming cutscene-only status):
- No `#objType` (would be `#objCPUCharacter` for enemies)
- No `#AiType` (no AI behavior)
- No `#attack` (no combat moves)
- No `#energy` / `#maxEnergy` (no HP)
- No `#strength` / `#dexterity` (no combat stats)
- No `#team` combat allegiance (uses `#collectables`, a prop team)
- No `#weapon` (no combat arsenal)
- No `#experienceImWorth` (never gives loot)
- No `#reincarnateAs` (no spawn cascade)

## TypeScript Port Implementation

**Location:** `/home/user/merlin-s-revenge/port/src/generated/data.json` (act_ochreHydra)

```json
{
  "header": {
    "name": "act_ochreHydra",
    "type": "#field"
  },
  "data": {
    "inherit": "#actorPlayer",
    "character": "#ochreWizard",
    "collisionRect": {"left": -60, "top": -2, "right": 60, "bottom": 2},
    "initFaceDir": -1,
    "miniMapStatus": "#spe",
    "name": "ochreHydra",
    "propCarryLoc": {"x": 10, "y": -10},
    "team": "#collectables",
    "speechColor": {"r": 215, "g": 209, "b": 49},
    "startOffset": {"x": -16, "y": -16},
    "walkSpeed": 4
  }
}
```

### Data Parity Verification

**All properties present and correctly mapped:**

✅ `inherit` → `"#actorPlayer"` (string)
✅ `character` → `"#ochreWizard"` (string)
✅ `collisionRect` → object with {left, top, right, bottom} (rect → rect object)
✅ `initFaceDir` → -1 (number)
✅ `miniMapStatus` → `"#spe"` (string)
✅ `name` → `"ochreHydra"` (string)
✅ `propCarryLoc` → object with {x: 10, y: -10} (point → point object)
✅ `team` → `"#collectables"` (string)
✅ `speechColor` → object with {r: 215, g: 209, b: 49} (rgb → rgb object)
✅ `startOffset` → object with {x: -16, y: -16} (point → point object)
✅ `walkSpeed` → 4 (number)

### Runtime Instantiation

The TS port can correctly instantiate `ochreHydra` via:

1. **Registry.resolveActor("ochreHydra")** → loads act_ochreHydra from data.json (data/registry.ts:92-104)
2. **Thespian.spawnCutActor(name)** → creates a cutscene actor entity (scenes/thespian.ts:149-156)
   - Uses CutActorArchetype: [Identity, Movement, Anim, Energy, WastedMode, Team]
   - Loads animChar, team, walkSpeed from resolved actor data
   - Parks at wings (offscreen) until placed by a cutscene verb

### Usage Context

**No cutscene references:** ochreHydra is **NOT used in any cutscene script** in the Lingo casts.
- Grep search: `casts/data/*.txt` contains only 2 references (both in act_ochreHydra.txt itself)
- Not found in scr_*.txt or any game scenario

**No map placement:** ochreHydra is **NOT placeable in gameplay maps** (no object keys or spawn lists reference it).

**Conclusion:** This is a "carried" (prepared) actor definition that the port faithfully preserves but does not exercise in active gameplay. The data integrity is 100% complete.

## Modules & Capabilities (Lingo objActorPlayer)

All modProp features are supported in the port:

| Feature | Lingo (modProp.txt) | TypeScript (scenes/thespian.ts) |
|---------|---------------------|--------------------------------|
| Load propCarryLoc from actor data | Line 40 | Line 152: loads from registry |
| Carry another actor as prop | Lines 76-82 | Lines 335-341 (produceProp) |
| Prop position tracking | Lines 84-86 | Lines 366-368 (driveActors) |
| Drop prop | Lines 84-92 | Lines 345-350 (putAwayProp) |

**Note on propCarryLoc override:**
- Lingo: Reads from `params.propCarryLoc` during init (modProp.txt:40)
- TypeScript: In produceProp, hardcodes to `{ x: m.facingLeft ? -14 : 14, y: -10 }`
- This is **intentional K16 redesign** (not a bug): the TS port unified all carry offsets to a single tuple, simplifying the cutscene DSL. ochreHydra's `#propCarryLoc: point(10,-10)` is preserved in data but not consulted in cutscene playback (no cutscenes use it, so no observable gap).

## Conclusion

**CLEAN**: All data properties are correctly migrated and schema-normalized. The actor can be spawned and animated in cutscenes using the standard Thespian flow. No behavioral gaps detected.
