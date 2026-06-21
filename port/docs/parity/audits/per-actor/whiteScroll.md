# Audit: whiteScroll

## Data Parity

**Original** (casts/data/act_whiteScroll.txt:1-8):
```
[#name: "act_whiteScroll", #type: #field]
[
#inherit: #actorPlayer,
#character: #prop,
#name: "whiteScroll",
#speechColor: rgb(255,255,255),
#team: #collectables
]
```

**Port** (port/src/generated/data.json):
```json
{
  "inherit": "#actorPlayer",
  "character": "#prop",
  "name": "whiteScroll",
  "speechColor": {"r": 255, "g": 255, "b": 255},
  "team": "#collectables"
}
```

✓ Data matched exactly.

## Role Classification

**whiteScroll is a CUTSCENE PROP, not a gameplay collectible.**

Evidence:
- `character: #prop` — designates it as a prop/decoration for cutscenes
- Inherits from `#actorPlayer` (script for rendering cutscene actors/props), not a gameplay collectible parent
- Referenced only in cutscene files: mr3Intro.txt, merlin3Intro.txt, etc. (used as character 's')
- NOT in PICKUPS mapping (port/src/world/spawnTable.ts:9-23)
- NOT spawned in any room definition
- No in-game pickup effect defined or expected

The `team: #collectables` annotation appears to be a data artifact (possibly for classification) but has no behavioral impact since whiteScroll never spawns as a gameplay collectible.

## Behavioral Parity

**Original** (casts/script_objects/objActorPlayer.txt):
- Inherits checkCollisions override that returns position unchanged (line 20-22)
- Loads modFader, modPositioning, modProp, modStretcher, modTeleport, modThespian, modWastedMode
- Used for rendering/positioning props in cutscenes

**Port**:
- Not instantiated in gameplay (only data exists)
- Cutscene rendering is out of scope for this port (UI/presentation layer)
- No collectible pickup behavior attempted or expected

✓ **CORRECT**: Port does not attempt to spawn whiteScroll as a gameplay collectible. The prop-only role is correctly preserved.

## Conclusion

**CLEAN** — whiteScroll is a cutscene prop with no gameplay collectible behavior to port. Data matches exactly. No behavioral divergence detected.
