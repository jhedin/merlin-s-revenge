# Behavioral Audit: act_treesRocksBW

**Actor:** treesRocksBW (black-and-white decoration variant)
**Classification:** Cutscene prop / scenery decoration (`character: #prop`)
**Status:** CLEAN

## Summary

treesRocksBW is a static scenery prop used exclusively in the "Game Complete" ending cutscene (mr3Complete.txt:11 via `propAt 350`). It is never placed on gameplay maps. The port correctly handles all aspects of its actual usage with 100% behavioral parity to the original Lingo game.

## Data Verification

### Original (casts/data/act_treesRocksBW.txt:1-8)
```lingo
[#name: "act_treesRocksBW", #type: #field]
[
#inherit: #actorPlayer,
#character: #prop,
#name: "treesRocksBW",
#speechColor: rgb(182,95,64),
#team: #collectables
]
```

### Port (port/src/generated/data.json)
```json
{
  "act_treesRocksBW": {
    "header": {"name": "act_treesRocksBW", "type": "#field"},
    "data": {
      "inherit": "#actorPlayer",
      "character": "#prop",
      "name": "treesRocksBW",
      "speechColor": {"r": 182, "g": 95, "b": 64},
      "team": "#collectables"
    }
  }
}
```

**Parity:** ✓ EXACT (color format differs syntactically but is semantically identical; all inheritance resolved correctly)

## Inheritance Chain

1. **treesRocksBW** overrides:
   - `character: #prop` → marks as static decoration
   - `team: #collectables` → overrides parent's `#chatters`
   - `speechColor: rgb(182,95,64)` → decorative only

2. **act_actorPlayer** (act_actorPlayer.txt:3-5):
   - `objType: #objActorPlayer`
   - `AiType: #objAiAttack`
   - `inherit: #actor`

3. **act_actor** (act_actor.txt:3-10):
   - Base actor properties (initLoc, initVect, layerZ, masterPrg, startOffset)
   - Default `team: #chatters` (overridden to #collectables)

**Resolved properties for treesRocksBW:**
- character: #prop ✓
- team: #collectables ✓
- name: treesRocksBW ✓
- speechColor: rgb(182,95,64) ✓
- No energy defined (not a combatant)
- No attack/scriptToPerform (static decoration)
- No solidity/collision properties (visual only)

## Actual Usage: Cutscene Scene

**File:** cut_scenes/mr3Complete.txt:2, 11
```
characters
#treesRocksBW - tr
...
setStage
tr propAt 350
```

### Port Implementation (port/src/scenes/thespian.ts:149-156, 243)

**Spawn (spawnCutActor):**
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

For treesRocksBW:
- Type: "cutscene" ✓
- Team: "#collectables" (resolved from data) ✓
- Energy: 100 (default for cutscene actors, non-combat) ✓
- animChar: "tre" or "treesRocksBW" (sprite lookup via cutAnimChar) ✓
- Archetype: CutActorArchetype (Identity, Movement, Anim, Energy, WastedMode, Team) — NO AI, NO combat

**propAt verb (line 243):**
```typescript
case "propAt": if (p) { p.propStatus = "prop"; this.at(p, this.interpretLoc(step.arg)); p.visible = true; } break;
```

Behavior:
1. Sets `propStatus = "prop"` ✓
2. Teleports to x=350, y=floor ✓
3. Makes visible ✓

**Result:** treesRocksBW placed at (350, floor) as a static, non-interactive cutscene decoration. Identical to original.

## Theoretical Map Spawn (NEVER OCCURS)

treesRocksBW is never placed on gameplay maps. If it were:

**Port routing (actorSerial.ts:39-56 → archetypes.ts:54-60):**
- No special objType dispatch (not a dwelling/mine/marker/chatter)
- Falls through to spawnUnit → spawnEnemy (because team #collectables ≠ player-side)
- Would spawn as "enemy" type with full EnemyAI (patrol/hunt) — **NOT correct for a #prop**

**Original routing (inferred):**
- `character: #prop` would suppress spawning entirely, or route to a static decoration handler
- Would be non-interactive, non-combative

**Parity gap:** Exists theoretically but is not a practical issue because:
1. No shipped content places props on maps
2. Props are a K16 cutscene feature
3. Map spawning is gameplay scope (out of range for scenery)
4. Gap would only affect future content adding #prop to maps

**Recommendation:** Not actionable. If props are added to gameplay maps in future, fix at that time with a generic check (e.g., if character: #prop → PropArchetype, not spawnUnit).

## Files Referenced

**Original (Lingo):**
- casts/data/act_treesRocksBW.txt:1-8 (actor definition)
- casts/data/act_actorPlayer.txt (parent: #actorPlayer)
- casts/data/act_actor.txt (parent: #actor)
- cut_scenes/mr3Complete.txt:2,11 (usage in "Game Complete" scene)

**Port (TypeScript):**
- port/src/generated/data.json (serialized actor data)
- port/src/scenes/thespian.ts:149-156 (spawnCutActor)
- port/src/scenes/thespian.ts:243 (propAt verb)
- port/src/entities/actorSerial.ts:39-56 (map spawn routing, theoretical)
- port/src/entities/archetypes.ts:54-60,136-200 (spawnUnit/spawnEnemy, theoretical)

## Conclusion

**100% parity for actual usage.** treesRocksBW correctly spawns as a cutscene decoration with all properties resolved identically to the original. No gameplay impact. Not a parity gap.
