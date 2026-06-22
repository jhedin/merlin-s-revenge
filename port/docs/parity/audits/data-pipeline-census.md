# Data-pipeline census — surfacing non-actor / cross-cutting pipeline bugs

The per-actor sweep catches bugs in actors. Many bugs live in the *transform pipeline*
(`parse_data` → `data.json`, `build_assets` → `assets.json`) and affect non-actor data too.
This doc tracks the **cheap census passes** that surface them by bug-class, independent of cardinality.

## Pass A — field-key census ("parsed but unconsumed")
Method: enumerate every `#key` in `casts/data/*.txt`; flag any not referenced anywhere in `port/src` (case-insensitive). One script. Catches the dropped-field class across ALL record types at once (actors, weapons, maps, spells…). This is how `damageSpeed`/`collisionLoc`/`frictionReel`/`mana_capacityIncLevel` should have been caught earlier.

Result (240 keys → 58 unreferenced). Triage of the REAL field keys (excluding actor-name/symbol noise):

### Likely real gaps (to verify per consumer)
- **Audio (cosmetic):** `takeHitSound`, `takeHitVolume`, `takeHitSoundVolume`, `dieVolume`, `explodeVolume` — hit/death/explode sounds may not play.
- **Visual:** `charSize` — character render scale possibly ignored (wrong sprite size). `speechColor` — speech text colour. `counterColour`.
- **Gameplay/AI:** `immuneToAttack` (invuln flag), `enemyGoodShootingDistance` (ranged kite distance), `walkType` (#anyDirSpeed etc.), `minCollisionSpeed`, `overlapToLeaveRoom`, `pathFindingTime`, `throwType`, `collideWithTarget`, `createOnSolid`, `jumpPower`, `splashGraveOn`.
- **Per-level growth:** `buildRateInc`, `stallSpeed`, `stallSpeedIncLevel`.
- **Spawn/placement:** `initFaceDir`, `startOffset`, `initLoc`, `propCarryLoc`, `gmgChargeLoc`, `chargeOffsetSide`.

### Original-game typos (faithful — verify engine reads the correct key, then log in original-game-bugs.md)
- `dammageMultiplier` (already OGB-1). `strenghtIncLevel` (strength misspelled — the port reads `strengthIncLevel`; verify the engine does too).

### Known false positives (not field keys — actor/symbol names caught by the regex)
`darkMage scArcher scMonk scWarrior summonOrc/Golem/Boulder/Warrior skeletonThrower skeliton* undeadDragon kingInGame armyMembers spell3..8 thekey testHit killAll masterPrg layerZ`.

NOTE: "unreferenced" ≠ "bug" — some are consumed via object spread or are intentionally out-of-scope.
Each real-gap key needs a quick per-consumer check: is it forwarded to a component AND used?

## Pass B — source→output reconciliation ("in source, not in output")
Method: per transform edge, enumerate the RAW source with logic INDEPENDENT of the production tool and diff against the output. Edges: `extracted bitmaps → assets.json` (caught the prefix-drop), `extracted sounds/music → assets`, `casts/data → data.json`, `maps → maps.json`, `tilesets`, `tile-keys`, `casts/teams → team tables`. The existing `pipeline.test.ts` is a start but MUST NOT reuse the production parser for ground truth (that's what hid the prefix-drop).

## Principle
Derive expected from the rawest source via DIFFERENT logic than production; check presence (counts) AND consumption (does the runtime reflect it). Cheap census first (A, B) → targeted reproduce only on what they flag + high-surface non-actor collections (maps, player kit, teams, tilesets).
