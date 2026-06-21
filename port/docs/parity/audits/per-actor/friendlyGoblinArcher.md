# Audit: friendlyGoblinArcher

## Summary
The friendlyGoblinArcher actor exhibits **complete behavioral parity** between the original Lingo game and the TypeScript port. All property coverage is present, and team allegiance routing is faithfully implemented.

## Property Comparison

| Property | Lingo (casts/) | Port (port/src/) | Status |
|----------|---|---|---|
| objType | #objCPUCharacter | #objCPUCharacter | ✓ Matches |
| AiType | #objAiCPU | #objAiCPU | ✓ Matches |
| inherit | #CPUCharacter | #CPUCharacter | ✓ Matches |
| damageSpeed | 3 | 3 | ✓ Matches |
| dexterity | 10 | 10 | ✓ Matches |
| dieSound | #none | #none | ✓ Matches |
| energy | 50 | 50 | ✓ Matches |
| experienceImWorth | 3 | 3 | ✓ Matches |
| eyestrain | 5 | 5 | ✓ (not flagged) |
| inertia | 50 | 50 | ✓ Matches |
| startingLevel | 0 | 0 | ✓ (already-implemented) |
| strength | 8 | 8 | ✓ Matches |
| **team** | **#village** | **#village** | **✓ KEY: allied faction** |
| name | "gar" | "gar" | ✓ Matches |
| walkSpeed | 4 | 4 | ✓ Matches |
| minimapStatus | #clr | #clr | ✓ Matches |
| **weapon** | **#goblinBow** | **#goblinBow** | **✓ ranged weapon resolved** |
| weaponTechnique | -75 | -75 | ✓ (not flagged) |

## Team Allegiance Verification

**Original (casts/data/tem_village.txt):**
```
#teamName: #village,
#friends: [#aldevar, #monsterSummon],
#hates: [[#blackSorcerer, #goblins, #karate, #magicalAlliance, #monsters, #swamp, #ninja, #pitMonsters, #undead, #ice, #scarlet, #orcs]]
```

**Port (port/src/generated/data.json):**
```json
"teamName": "#village",
"friends": ["#aldevar", "#monsterSummon"],
"hates": [["#blackSorcerer", "#goblins", "#karate", "#magicalAlliance", "#monsters", "#swamp", "#ninja", "#pitMonsters", "#undead", "#ice", "#scarlet", "#orcs"]]
```

**Allegiance routing verified:**
- ✓ `#village` is friendly to `#aldevar` (the player team)
- ✓ `#village` is hostile to `#goblins` (the enemy version act_goblinArcher uses #goblins team)
- ✓ `#village` hunts `#monsters` and other hostile factions
- ✓ Target resolution flows through `teamMaster.calcTargetTeams()` → uses `team.hates[0]` for #enemy allegiance (port/src/systems/teams.ts:86-96)
- ✓ `teamMaster.findTarget()` properly gates by team membership and non-dead status (port/src/systems/teams.ts:115-151)

## Weapon & Ranged Behavior

**Weapon Resolution (goblinBow):**
- Port spawnEnemy correctly reads `#weapon: #goblinBow` from actor data
- Resolves to animType `#weaponRanged` at spawn time (port/src/entities/archetypes.ts:163-170)
- Sets `ranged=true` for AI FSM (port/src/entities/archetypes.ts:169-170)
- Effective cooldown derived from raw cooldown + dexterity-scaled recovery (port/src/entities/archetypes.ts:180-188)

**Ranged AI Behavior (CpuAI):**
- ✓ Committed-target FSM: findTarget → moveToAttack → attack → attackFin (port/src/components/control.ts:285-597)
- ✓ Retarget throttle every 30 frames (faithful to original objAiCPU:10, countDown 30)
- ✓ Ranged reach-gating: uses `reachRanged=150` (default, tuned per #attack.reach at init; goblinBow.reach=100)
- ✓ Attack path: cooledDown() → `attack()` → `fireBullet()` with team allegiance (port/src/components/control.ts:520-597)
- ✓ RunReload (kite) on ranged=true (port/src/components/control.ts:489-496, objAiCPU.txt:53-57)
- ✓ Bullet allegiance: bullets inherit attacker's team #village, scoped by team.hates (port/src/systems/bullets.ts, implicit via team routing)

## Differences from Enemy Version (act_goblinArcher)

| Feature | friendlyGoblinArcher | act_goblinArcher | Effect |
|---------|---|---|---|
| team | #village | #goblins | Friend hunts #village.hates (enemies); foe hunts #goblins.hates (includes #aldevar) |
| miniMapStatus | #clr (catalogued non-issue) | not present (defaults #inf) | Visual tag only; no behavioral impact |

## Behavioral Correctness Checklist

- ✓ Team allegiance: correctly identified as friendly (#aldevar.friends includes #village)
- ✓ Weapon initialization: #goblinBow resolved at spawn, animType=#weaponRanged
- ✓ Ranged AI: CpuAI.ranged=true set at init; moveToAttack uses reachRanged gating
- ✓ Target acquisition: findTarget() scoped to team.hates via calcTargetTeams()
- ✓ Firing: attack() path fires bullets with correct team + allegiance
- ✓ Kiting: runReload set to true for ranged units; updateRunReload maintains safe distance
- ✓ Death/grave: Grave component mixed in; energy-based death detection identical (isDead check)
- ✓ Experience: experienceImWorth=3 carried through, merged on death
- ✓ Movement: walkSpeed=4 → 2.4 px/tick, pathfinding enabled (CPUCharacter.pathfinding=true)

## Conclusion

**CLEAN** — No gaps found. The friendlyGoblinArcher is faithfully ported with all properties present, team allegiance correctly routed through the data-driven teamMaster system, and ranged behavior properly delegated to the CpuAI FSM with dexterity-scaled cooldown recovery.
