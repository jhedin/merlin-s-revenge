# Actor Audit: blueScroll

## Summary
blueScroll is a cutscene-only non-interactive character with no gameplay mechanics. Original and port behavior are **BEHAVIORALLY IDENTICAL**.

## Data Structure

### Original (casts/data/act_blueScroll.txt:1-8)
```
[#name: "act_blueScroll", #type: #field]
[
#inherit: #actorPlayer,
#character: #prop,
#name: "blueScroll",
#speechColor: rgb(100,100,255),
#team: #collectables
]
```

### Port (port/src/generated/data.json)
```json
{
  "header": { "name": "act_blueScroll", "type": "#field" },
  "data": {
    "inherit": "#actorPlayer",
    "character": "#prop",
    "name": "blueScroll",
    "speechColor": { "r": 100, "g": 100, "b": 255 },
    "team": "#collectables"
  }
}
```

## Inheritance Analysis

- **blueScroll inherits from #actorPlayer** (casts/data/act_actorPlayer.txt:3): `#objType: #objActorPlayer`
- **No explicit #objType override** in blueScroll data
- **No #attack property** (unlike gameplay scrolls: energyBlast, cBlast, merlinSword, etc.)
- **No other gameplay properties** (no animation, no loot, no behavior flags)

## Gameplay Role

blueScroll appears **only in cutscenes**:
- **demo008Intro.txt**: `u produceProp bls` / `u dropProp` (Ulin shows Merlin a scroll prop in dialogue)
- **Never spawned** in any playable room (not in any level data)
- **Never collectible** in gameplay (team=#collectables is cosmetic; the actor never gets picked up)

## Behavioral Verification

### Original Lingo
- **objType dispatch** (casts/script_objects hierarchy):
  - Gameplay scrolls (energyBlast, cBlast, etc.) override with `#objType: #objScroll` → execute `objScroll.collected()`
  - blueScroll has NO override → inherits #objActorPlayer (no collection handler)
  - Result: **NOT a pickup; cannot be collected**

### TS Port (port/src/entities/actorSerial.ts)
- **spawnFromSymbol** routing:
  1. Check PICKUPS registry (port/src/world/spawnTable.ts:9-23) → blueScroll NOT listed
  2. Check objType dispatch → blueScroll has #objActorPlayer (no special handling)
  3. Fall through → spawn as Unit via `spawnUnit()`
  - Result: **Spawned as enemy/unit, not pickup; cannot be collected**

## Conclusion

**Both implementations prevent collection** because blueScroll lacks:
- An explicit `#objType: #objScroll` override
- An `#attack` property to grant on collection
- Any placement in playable rooms

The port's treatment (Unit archetype with no Pickup component) is **functionally equivalent** to the original's treatment (objActorPlayer with no collection handler), since neither ever executes and the actor only exists as a cutscene prop.

**Status**: CLEAN — No behavioral divergence. Text display (cutscene) is out of scope.
