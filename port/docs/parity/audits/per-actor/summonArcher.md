# summonArcher Parity Audit

## Overview
Audit of **summonArcher** — a ranged, summoned monster ally on team #monsterSummon — comparing original Lingo implementation (casts/) against TypeScript port (port/src/).

## Data Property Coverage

| Property | Original | Port | Match |
|----------|----------|------|-------|
| #objType | #objCPUCharacter | #objCPUCharacter | ✓ |
| #AiType | #objAiCPU | #objAiCPU | ✓ |
| #inherit | #CPUCharacter | #CPUCharacter | ✓ |
| #damageSpeed | 1 | 1 | ✓ |
| #dexterity | 10 | 10 | ✓ |
| #dieSound | #none | #none | ✓ |
| #miniMapStatus | #clr | #clr | ✓ |
| #energy | 50 | 50 | ✓ |
| #experienceImWorth | 3 | 3 | ✓ |
| #eyestrain | 5 | 5 | ✓ (non-issue) |
| #inertia | 50 | 50 | ✓ |
| #startingLevel | 0 | 0 | ✓ |
| #strength | 8 | 8 | ✓ |
| #team | #monsterSummon | #monsterSummon | ✓ |
| #reelProof | true | true | ✓ (non-issue) |
| #collisionDetection | false | false | ✓ (non-issue) |
| #name | "gar" | "gar" | ✓ |
| #walkSpeed | 6 | 6 | ✓ |
| #weapon | #goblinBow | #goblinBow | ✓ |
| #weaponTechnique | -50 | -50 | ✓ (non-issue) |

## Weapon Resolution

**goblinBow** (#attack):
- **Original** (casts/data/act_goblinBow.txt, lines 7-8): `#animType: #weaponRanged` → fires at range
- **Port** (port/src/generated/data.json): `"animType": "#weaponRanged"` → resolves to `type: "ranged"` via `typeFromAnimType()` (weapon.ts:95)

**Ranged AI behavior** (port/src/components/control.ts):
- EnemyAI.attack() detects ranged weapon (line 534: `if (this.ranged)`)
- Ranged reach threshold (line 495: `this.reachRanged = Math.min(220, Math.max(60, ca.reach))`) — goblinBow reach=100 → kites beyond 60px
- After firing, enters #runReload mode (line 525: `this.runReload = true` set at spawn from data flag or spellcaster type)
- Kiting behavior: updateRunReload() backs away to 70% of ranged reach before re-engaging (line 507)

## Team Allegiance Routing

**#monsterSummon team configuration** (casts/data/tem_monsterSummon.txt & port/src/generated/data.json):
- **friends**: [#aldevar, #village] — player-side allies
- **hates**: [tier 0: {#blackSorcerer, #scarlet, #cave, #goblins, ...}, tier 1: {#pitMonsters, #invisible}]
- summonArcher spawns on #monsterSummon team (casts/data/act_summonArcher.txt line 16)
- Port summon.ts (line 35-44) confirms: unit carries its OWN #team in act data (#monsterSummon), which equals residentTeamCategory; spawnUnit() routes render type by isPlayerSide()

**Target allegiance** (port/src/systems/teams.ts):
- Inherited from weapon #attack.targetAllegiance (default: #enemy per act_monsterSummon.txt line 50)
- calcTargetTeams() (line 86) resolves #monsterSummon team's allegiance:
  - #enemy → target teams from tem_monsterSummon.hates[] tiers (goblins, monsters, etc.)
  - #friendly → target teams from tem_monsterSummon.friends[] (aldevar, village)
- findTarget() (line 115) culls empty teams and returns closest hostile within reach

**Summoning pathway**:
- summonUnit() (port/src/components/summon.ts line 38-44) calls game.spawnUnit(type, x, y, {})
- spawnUnit() (archetypes.ts line 54-60) resolves team from act data (#monsterSummon)
- checks isPlayerSide(team) → #monsterSummon.friends includes #aldevar → marks as ally (e.type="ally")
- EnemyAI initialized with this team; targeting is fully data-driven via tem_monsterSummon allegiance

## Behavioral Verification

| Behavior | Original | Port | Evidence |
|----------|----------|------|----------|
| **Ranged attack** | fires goblinArrow at range | detected via animType=#weaponRanged, cooldown calibrated to 200+18 frames | weapon.ts:169, archetypes.ts:180-181 |
| **Kiting** | implied by ranged AI loop (casts/script_objects/objAiCPU.txt) | runReload=true set automatically for ranged (control.ts:211), updateRunReload backs away | control.ts:501-509 |
| **Team #monsterSummon** | fights #aldevar.hates per tem_monsterSummon.txt | calcTargetTeams resolves from team data; findTarget culls and hunts hates[] | teams.ts:86-96, summon.ts:35-44 |
| **Summoned ally status** | player-summoned, joins #monsterSummon team | spawnUnit() checks isPlayerSide(#monsterSummon) → sets e.type="ally" | archetypes.ts:58 |
| **Movement & pathfinding** | walkSpeed 6 from #CPUCharacter base | inherited via Movement component, pathfinding enabled | archetypes.ts:36 |
| **Death & team cleanup** | unregister from teamMaster on death | EnemyAI.leaveGame() or unregister() in teamMaster | teams.ts:59-64 |

## Conclusion

**CLEAN**. All data properties match exactly. Ranged AI logic is correctly implemented: goblinBow's #weaponRanged animType is resolved to "ranged" type, triggering kiting behavior via #runReload mode. Team #monsterSummon allegiance routing is data-driven through teams.ts calcTargetTeams(), correctly pulling from tem_monsterSummon.friends/hates. Summoned units properly join the #monsterSummon team and are marked as player-side allies. No property unused, no behavioral divergence detected.
