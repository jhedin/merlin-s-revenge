# Audit: blackPotion

## Summary
**blackPotion** is defined as an actor in the original codebase but is **not collectible during normal gameplay in either the original or the port.** It is a cutscene-only prop with no potion effect behavior implemented or needed.

## Findings

### Data Definition
- **Original:** `casts/data/act_blackPotion.txt` — inherits from `#actorPlayer`, `#character: #prop`, team `#collectables`
- **Port:** `port/src/generated/data.json:act_blackPotion` — identical structure, no additional properties

### Potion Effect Behavior
- **Original Character Type:** `#prop` (not a potion type; generic prop)
- **Original Handler:** `casts/script_objects/objPlayerMerlinCharacter.txt:183-203` — `potionCollected()` only handles `#manaBurst`, `#manaCapacity`, `#manaFlow`, `#walkSpeed`. No case for `#prop`; would default to +25 health + temp invince + potion tally
- **Port Handler:** `port/src/components/pickup.ts:63-93` — `apply()` handles named effects (`heal`, `maxikit`, `speed`, spell types, mana powerups, etc.). No effect type `"blackPotion"` or `"prop"` exists

### Spawning
- **Original:** No spawn tile or room definition references `#blackPotion`
- **Port:** Not in `port/src/world/spawnTable.ts:PICKUPS` map
- **Usage:** Appears only in cutscenes (`cut_scenes/*.txt`), never in gameplay

### Comparison to horriblePotion
- **Original:** `casts/data/act_horriblePotion.txt` — identical to blackPotion (same `#character: #prop`, same team)
- **Port:** `port/src/generated/data.json:act_horriblePotion` — identical to blackPotion
- **Conclusion:** Both are unused cutscene props, not potion effects

## Verdict: CLEAN
No behavioral divergence. Both codebases treat blackPotion identically: it is an actor definition that exists but is never spawned or collected during gameplay. The "potion" label is a misnomer; these are generic `#prop` objects used in cutscenes (see `modProp.txt:2`). No harmful effect, no negative behavior, no missing implementation — simply non-functional in the gameplay systems.
