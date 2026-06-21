# Audit: horriblePotion

**Actor:** horriblePotion  
**Type:** Collectible potion  
**Status:** UNREACHABLE (never spawned, but if spawned would diverge in behavior)

## Data Definition

- **Original:** `casts/data/act_horriblePotion.txt:1-8`
  - Inherits from `#actorPlayer` with `character: #prop`
  - Team: `#collectables`
  - No member/sprite defined
  - No special properties

- **Port:** `port/src/generated/data.json` mirrors the actor definition
  - Inherits from `#actorPlayer`, character `#prop`, team `#collectables`
  - No sprite member field to render
  - Not in `PICKUPS` spawn table (cannot be instantiated as a collectible)

## Behavior Analysis

### Original Casts Logic

1. **Collection trigger:** `casts/script_objects/objPotion.txt:26-29`
   - When collected, calls `collector.potionCollected(character, thePotion)`
   - For horriblePotion: calls `collector.potionCollected(#prop, thePotion)`

2. **Player handler:** `casts/script_objects/objPlayerMerlinCharacter.txt:183-203`
   - `potionCollected me, character, thePotion` has a case statement:
     - `#manaBurst` → incManaBurstPotion()
     - `#manaCapacity` → incManaCapacityPotion()
     - `#manaFlow` → incManaFlowPotion()
     - `#walkSpeed` → incWalkAcceleration(#potion)
     - **NO case for `#prop`** — falls through
   - After case: regardless of match
     - `me.startTempInvince()` (invincibility frames)
     - `me.increaseEnergy(pBonusEnergy)` where `pBonusEnergy = 25`
     - `g.potionMaster.potionCollected(thePotion)` (log/tally)

3. **If horriblePotion were collected in original:**
   - Case #prop matches nothing → no stat boost
   - Still grants: i-frames, +25 energy, potionMaster tally

### Port TS Behavior

1. **Spawn constraint:** `port/src/world/spawnTable.ts:PICKUPS`
   - Maps tile symbols to PickupEffect strings
   - Includes: `#medikit`, `#maxikit`, `#walkSpeed`, `#manaCapacity`, `#manaBurst`, `#manaFlow`, etc.
   - **Does NOT include `#horriblePotion` or `#blackPotion`**
   - Result: horriblePotion cannot be spawned from a room tile

2. **PickupEffect type:** `port/src/components/pickup.ts:29-31`
   - Union of effect strings: "heal" | "maxikit" | "speed" | ... | "manaBurst" | ... | "gmg"
   - **Does NOT include "prop"**
   - If "prop" were somehow created, it would be a type error

3. **Collection logic:** `port/src/components/pickup.ts:60-99`
   - Switch on `this.effect`:
     - All known effects handled (heal, speed, mana*, weapons, spells, gmg)
     - **NO default case or fallthrough for unknown effects**
   - After switch (line 98):
     - Grants +25 energy IF `effect !== "maxikit" && effect !== "gmg"`
     - If unrecognized effect somehow passed, it would **FAIL to grant the +25 bonus** (condition false)
   - potionMaster tally: always called (line 62)

## Divergence Summary

**Key gap if horriblePotion were enabled:**

| Aspect | Original | Port |
|--------|----------|------|
| Spawn capability | Tile-placeable (objPotion pattern) | Blocked (not in PICKUPS) |
| #prop character match | No case → falls through | Cannot instantiate with effect "prop" |
| +25 energy bonus | **Always granted** (line 200) | **Denied** (line 98 condition fails for unknown effect) |
| Invincibility frames | Granted | N/A (never collected) |
| potionMaster tally | Recorded | N/A (never collected) |

## Conclusion

**horriblePotion is unreachable in the port.** Even if the PICKUPS table were extended to include `"#horriblePotion": "prop"`, the Pickup component's switch statement would fall through without matching "prop", causing loss of the +25 energy bonus that the original unconditionally grants (casts/script_objects/objPlayerMerlinCharacter.txt:200).

**BEHAVIORAL DIVERGENCE**: If horriblePotion were to become reachable, collecting it would grant:
- ✓ Invincibility frames
- ✗ **+25 energy bonus (MISSING in port)**
- ✓ potionMaster tally
