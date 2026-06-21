# Audit: skeletonGiant

**Actor Type:** CPU-controlled melee character  
**Team:** #undead  
**Weapon:** #skeletonGiantSword (melee)  
**Original Data:** `casts/data/act_skeletonGiant.txt`  
**Port Data:** `port/src/generated/data.json`  

## Property Coverage

| Property | Original | Port | Status |
|----------|----------|------|--------|
| **objType** | #objCPUCharacter | #objCPUCharacter | ✓ |
| **AiType** | #objAiCPU | #objAiCPU | ✓ |
| **inherit** | #CPUCharacter | #CPUCharacter | ✓ |
| **team** | #undead | #undead | ✓ |
| **energy** | 200 | 200 | ✓ |
| **strength** | 6 | 6 | ✓ |
| **dexterity** | 2 | 2 | ✓ |
| **inertia** | 65 | 65 | ✓ |
| **walkSpeed** | 7 | 7 | ✓ |
| **weapon** | #skeletonGiantSword | #skeletonGiantSword | ✓ |
| **experienceImWorth** | 20 | 20 | ✓ |
| **damageSpeed** | 2 | 2 | ✓ (flagged catalogued non-issue) |
| **stallSpeed** | 3 | 3 | ✓ (flagged catalogued non-issue) |
| **eyestrain** | 30 | 30 | ✓ (flagged catalogued non-issue) |
| **reincarnateAs** | *(not present)* | *(not present)* | ✓ |

## Behavioral Verification

### Weapon Resolution
- **Origin:** `casts/data/act_skeletonGiantSword.txt` defines melee attack with `#weaponMelee` animType, power=point(1,0), damageMultiplier=8, reach implied by collision
- **Port Implementation:** `port/src/entities/archetypes.ts` (spawnEnemy line 155-162):
  - Weapon actor resolved via `registry.resolveActor(d["weapon"])`
  - Weapon's #attack extracted and becomes the enemy's primary attack
  - For skeletonGiant: animType="#weaponMelee" triggers melee-type AI (ranged=false)
  - Cooldown calibration (line 180-188): rawCooldown=0 + base=6 frames → effective cooldown Math.round(6 * agility + 1) = Math.round(6*2+1) = 13 frames
  - **Result:** ✓ Faithful melee-type combat

### Melee Combat AI
- **Origin:** `casts/script_objects/objAiCPU.txt` – FSM-driven (findTarget/moveToAttack/attackFin)
- **Port Implementation:** `port/src/components/control.ts` CpuAI class (lines 306–616):
  - Same FSM: findTarget → moveToAttack → attack → attackFin → retarget
  - Line 485: `targetInReach(d)` checks d <= 22px (melee reach default) vs ranged=150px
  - Line 531-610: `attack()` method routes melee vs ranged:
    - Melee branch (line 599-610): calls `teamMaster.impactMeleeAttack()`
    - Passes `meleeHitFn` with base power = `enemyMeleeBasePower(ca, strength)` + damageMultiplier
    - For skeletonGiant: ca.damageMultiplier=8, strength=6 → faithful power scaling
  - **Result:** ✓ Melee contact and damage resolution identical to original

### Team Allegiance
- **Origin:** team=#undead (row 14 of act_skeletonGiant.txt)
- **Port Implementation:** `port/src/entities/archetypes.ts` line 270: `team: str("team", "#monsters")`
  - Resolves to "#undead" from data
  - `port/src/systems/teams.ts` (lines 85-97): calcTargetTeams routes #undead to its #hates list
  - TeamMaster at register (line 54-58) adds skeletonGiant to team roster
  - **Result:** ✓ Targeting allegiance preserved

### Death & Reincarnation
- **Origin:** No #reincarnateAs field in act_skeletonGiant.txt
- **Port Implementation:** `port/src/components/reincarnate.ts` (lines 41-46):
  - `parseReincarnate()` called with undefined → returns empty array
  - Line 65: `if (!this.done && this.reincarnateAs.length > 0 && this.depth > 0)` → skips spawn logic
  - Energy death (port/src/components/combat.ts line 100-107): `getKilledInAction()` returns true on lethal damage
  - Reincarnate component still mixes into EnemyArchetype, but with empty list → no effect
  - **Result:** ✓ No unintended spawning; corpse-only death behavior preserved

### Movement & Pathfinding
- **Origin:** walkSpeed=7 (0.7× the default 10 of CPUCharacter inheritance)
- **Port Implementation:** `port/src/entities/archetypes.ts` line 267: `walkSpeed: num("walkSpeed", 3) * 0.6`
  - Resolves to 7 * 0.6 = 4.2 px/tick engine units
  - Consistent with other melee enemies (walkSpeed scaled to engine coordinates)
  - Pathfinding enabled via CpuAI.path (line 338, PathFinding component)
  - **Result:** ✓ Movement speed and beeline→scenic pathing faithful

---

## Conclusion

**CLEAN** — All property values match, weapon melee-type is correctly resolved, AI FSM (findTarget → moveToAttack → melee attack → attackFin → retarget) is faithfully implemented, team allegiance is data-driven, and no unintended reincarnation occurs. Catalogued non-issues (damageSpeed, stallSpeed, eyestrain) confirmed absent from behavioral divergences.

**Cross-file evidence:**
- Original data: `casts/data/act_skeletonGiant.txt` (no reincarnateAs)
- Weapon reference: `casts/data/act_skeletonGiantSword.txt` (animType=#weaponMelee)
- Port spawn factory: `port/src/entities/archetypes.ts:137-312` (spawnEnemy resolution)
- Port combat AI: `port/src/components/control.ts:306-616` (CpuAI melee FSM)
- Port death handling: `port/src/components/combat.ts:103-107` (getKilledInAction) + `port/src/components/reincarnate.ts:64-73` (reincarnate gate)
