# Actor Audit: berlin

## Summary
**berlin** is a CUTSCENE/PROP-class actor (objActorPlayer). It carries NO gameplay-relevant data — no attack, energy, strength, weapon, team assignment, reincarnate, or scriptToPerform behavior. Berlin appears only in cutscenes (demo007Intro, merlin3Intro, etc.) as an animated talking head.

## Original Data

**File:** `/home/user/merlin-s-revenge/casts/data/act_berlin.txt` (lines 1–12)

```lingo
[#name: "act_berlin", #type: #field]
[
#inherit: #actorPlayer,
#character: #berlin,
#collisionRect: rect(-60, -2, 60, 2),
#initFaceDir: -1,
#miniMapStatus: #spe,
#name: "ber",
#speechColor: rgb(255,0,255),
#startOffset: point(-16, -16),
#walkSpeed: 4
]
```

### Inheritance Chain
1. `act_berlin` (line 3) → `#actorPlayer`
   - **File:** `/home/user/merlin-s-revenge/casts/script_objects/objActorPlayer.txt`
   - Loads modules: modFader, modPositioning, modProp, modStretcher, modTeleport, modThespian, modWastedMode
   - Inherits from script `objCharacter` (line 7)

2. `#actorPlayer` → `#actor` (objCharacter via objActorPlayer ancestry)
   - **File:** `/home/user/merlin-s-revenge/casts/data/act_actor.txt` (lines 1–11)
   - Base properties: actorType, initLoc, initVect, layerZ, masterPrg, miniMapStatus, startOffset, team

### Direct Properties (act_berlin)
| Property | Value | Purpose |
|----------|-------|---------|
| `#inherit` | `#actorPlayer` | Links to cutscene actor parent |
| `#character` | `#berlin` | Character identity symbol (used by cutscene parser) |
| `#collisionRect` | `rect(-60, -2, 60, 2)` | Collision bounds (rendering/cutscene geometry) |
| `#initFaceDir` | `-1` | Initial facing direction (left) |
| `#miniMapStatus` | `#spe` | Minimap marker: special/cutscene |
| `#name` | `"ber"` | Short name (used in debug/UI) |
| `#speechColor` | `rgb(255,0,255)` | Magenta speech color for dialogue |
| `#startOffset` | `point(-16, -16)` | Sprite draw offset |
| `#walkSpeed` | `4` | Cutscene walk speed |

### Gameplay-Relevant Properties
- **attack**: NONE (cutscene only)
- **energy**: NONE (cutscene only)
- **weapon**: NONE (cutscene only)
- **team**: Inherited `#chatters` from act_actor (line 10 of act_actor.txt)
- **reincarnateAs**: NONE
- **scriptToPerform**: NONE

## Port Data

**File:** `/home/user/merlin-s-revenge/port/src/generated/data.json`

```json
{
  "act_berlin": {
    "header": { "name": "act_berlin", "type": "#field" },
    "data": {
      "inherit": "#actorPlayer",
      "character": "#berlin",
      "collisionRect": {
        "left": -60, "top": -2, "right": 60, "bottom": 2
      },
      "initFaceDir": -1,
      "miniMapStatus": "#spe",
      "name": "ber",
      "speechColor": { "r": 255, "g": 0, "b": 255 },
      "startOffset": { "x": -16, "y": -16 },
      "walkSpeed": 4
    }
  }
}
```

### Resolved Inheritance Chain (Port)
1. `act_berlin` → `#actorPlayer` (inherit field)
   - **Generated from:** `/home/user/merlin-s-revenge/casts/script_objects/objActorPlayer.txt`
   - Loads modules via archetype: modFader, modPositioning, modProp, modStretcher, modTeleport, modThespian, modWastedMode

2. `#actorPlayer` → `#actor`
   - **Data:** act_actorPlayer.data.inherit = `"#actor"` (per data.json)
   - **Generated from:** `/home/user/merlin-s-revenge/casts/data/act_actor.txt`

### Port Cutscene Integration

**File:** `/home/user/merlin-s-revenge/port/src/scenes/thespian.ts` (lines 37–43)

```typescript
const CUT_ANIM_CHAR: Record<string, string> = { merlin: "mer", ulin: "uli", berlin: "ber", tv: "tv" };
function cutAnimChar(name: string): string {
  if (CUT_ANIM_CHAR[name]) return CUT_ANIM_CHAR[name];
  return game.assets?.index.anims[`${name}_stand`] ? name : name.slice(0, 3);
}
```

**File:** `/home/user/merlin-s-revenge/port/src/scenes/thespian.ts` (line 150)

```typescript
private spawnCutActor(name: string): Entity {
  const d = registry.resolveActor(name) ?? {};
  const team = typeof d["team"] === "string" ? (d["team"] as string) : "#chatters";
  const e = CutActorArchetype.create(makeEntityId());
  e.type = "cutscene";
  return e.build({ x: -200, y: this.floor, walkSpeed: 99, accel: 99, friction: 0,
    animChar: cutAnimChar(name), team, energy: 100, box: 8, actorType: name });
}
```

When a cutscene lists `#berlin - b`, the Thespian:
1. Calls `registry.resolveActor("berlin")` → retrieves full resolved actor data from data.json
2. Extracts `team` (inherited `#chatters`)
3. Uses `cutAnimChar("berlin")` → maps to `"ber"` (anm_ber.tsx sprite sheet)
4. Spawns a CutActorArchetype entity with the correct animation character

**File:** `/home/user/merlin-s-revenge/port/src/main.ts` (line 100)

```typescript
const CUT_SYM_CHAR: Record<string, string> = { merlin: "mer", ulin: "uli", berlin: "ber", tv: "tv" };
```

Berlin is also recognized in the main cutscene initialization.

## Property-by-Property Verification

| Property | Original | Port | Match | Notes |
|----------|----------|------|-------|-------|
| `inherit` | `#actorPlayer` | `#actorPlayer` | ✓ | Inheritance path preserved |
| `character` | `#berlin` | `#berlin` | ✓ | Character symbol matches |
| `collisionRect` | `rect(-60,-2,60,2)` | `{left:-60,top:-2,right:60,bottom:2}` | ✓ | Rect structure converted correctly |
| `initFaceDir` | `-1` | `-1` | ✓ | Facing direction preserved |
| `miniMapStatus` | `#spe` | `#spe` | ✓ | Minimap status unchanged |
| `name` | `"ber"` | `"ber"` | ✓ | Short name matches |
| `speechColor` | `rgb(255,0,255)` | `{r:255,g:0,b:255}` | ✓ | Color converted to RGB object |
| `startOffset` | `point(-16,-16)` | `{x:-16,y:-16}` | ✓ | Point converted to object |
| `walkSpeed` | `4` | `4` | ✓ | Speed preserved |

## Cutscene Usage Verification

**Original cutscenes using berlin:**
- `/home/user/merlin-s-revenge/cut_scenes/demo007Intro.txt` (line 2: `#berlin - b`)
- `/home/user/merlin-s-revenge/cut_scenes/merlin3Intro.txt`
- `/home/user/merlin-s-revenge/cut_scenes/mr3Complete.txt`
- `/home/user/merlin-s-revenge/cut_scenes/demo011Complete.txt`
- `/home/user/merlin-s-revenge/cut_scenes/shortTestScript.txt`

**Port cutscene parser:**
- `/home/user/merlin-s-revenge/port/src/data/cutscene.ts` (lines 103–134)
  - Parses character declarations: `#<symbol> - <alias>` format
  - Registry lookup on demand during scene execution
  - Berlin will be correctly resolved to `act_berlin` data

**Port cutscene executor (Thespian):**
- `/home/user/merlin-s-revenge/port/src/scenes/thespian.ts` (lines 126–156)
  - `acquirePlayers()` iterates cutscene.chars and calls `spawnCutActor(name)` for each
  - `registry.resolveActor("berlin")` retrieves the complete resolved actor data
  - Animation character mapping via `cutAnimChar()` correctly routes to `"ber"` sprite sheet
  - Entity is built as a CutActorArchetype with proper team and properties

## Conclusion

✅ **CLEAN** — berlin is a cutscene-only actor with zero gameplay mechanics. All 9 direct properties match exactly between original and port. The inheritance chain is preserved (act_berlin → #actorPlayer → #actor). The port's Thespian cutscene engine correctly registers berlin, resolves its data, and spawns it with the correct animation character ("ber"). No behavioral gaps detected.

---

**Audit Date:** 2026-06-21  
**Actor Class:** CUTSCENE (objActorPlayer)  
**Gameplay Impact:** NONE (cutscene only)  
**Data Locations:**
- Original: `/home/user/merlin-s-revenge/casts/data/act_berlin.txt` (lines 1–12)
- Port: `/home/user/merlin-s-revenge/port/src/generated/data.json` (act_berlin key)
- Cutscene Engine: `/home/user/merlin-s-revenge/port/src/scenes/thespian.ts` (lines 37–156)
