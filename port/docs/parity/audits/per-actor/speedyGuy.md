# speedyGuy Parity Audit

## Summary
speedyGuy is a melee fighter on team #karate with high movement speed (walkSpeed 6, 50% faster than karateGuy's 4). Attack is #naturalMelee with punching/kicking animation, #objAiCPU-driven AI.

## Data Parity

| Property | Lingo (casts/) | TypeScript (port/src/) | Faithful? |
|----------|----------------|------------------------|-----------|
| #objType | #objCPUCharacter | #objCPUCharacter | ✓ |
| #AiType | #objAiCPU | #objAiCPU | ✓ |
| #inherit | #CPUCharacter | #CPUCharacter | ✓ |
| #team | #karate | #karate | ✓ |
| #walkSpeed | 6 | 6 (→ 3.6 px/tick @ 0.6 scale) | ✓ |
| #strength | 10 | 10 | ✓ |
| #dexterity | 10 | 10 | ✓ |
| #energy | 150 | 150 | ✓ |
| #inertia | 50 | 50 | ✓ |
| #startingLevel | 0 | 0 | ✓ |
| #experienceImWorth | 10 | 10 | ✓ |
| #damageSpeed | 3 | 3 | ✓ |
| #dieSound | #none | #none | ✓ |
| **Attack (#punchKick)** | | | |
| #animType | #naturalMelee | #naturalMelee | ✓ |
| #animframe | [5, 8, 12] | [5, 8, 12] | ✓ |
| #name | #punchKick | #punchKick | ✓ |
| #power | point(0.01, 0) | {x: 0.01, y: 0} | ✓ |
| #damageMultiplier | 90 | 90 | ✓ |
| #cooldown | 0 | 0 (→ effective 19 frames @ agility=10) | ✓ |
| #hits | [#teamMembers, #teamBuildings] | [#teamMembers, #teamBuildings] | ✓ |
| #collisionLoc | point(12, 3) | {x: 12, y: 3} | ✓ |
| #sound | "wizard_punch" | "wizard_punch" | ✓ |

## Behavioral Correctness

### AI Class: Melee (#objAiCPU)
**Port implementation:** `CpuAI` in `/port/src/components/control.ts` (lines 296–650)
- ✓ **Committed-target FSM:** findTarget → moveToAttack → attack → attackFin cycle (lines 433–450)
- ✓ **Retarget throttle:** 30-frame re-eval counter (line 332, RETARGET constant)
- ✓ **Reach gating:** default melee reach 22px (line 309), clamped [16, 40] (line 371)
- ✓ **Movement:** pathfinding enabled (K3, line 486) via beeline→scenic routing
- ✓ **Attack trigger:** `targetInReach()` (line 499) checks distance ≤ reach then calls `attack()` (line 531–616)
- ✓ **Melee dispatch:** calls `game.teamMaster.impactMeleeAttack()` (line 609) for area resolution (every hostile in reach)

### Attack Type: Natural Melee (#naturalMelee)
**Port implementation:** `typeFromAnimType()` in `/port/src/components/weapon.ts` (lines 90–98)
- ✓ **Classification:** #naturalMelee → "melee" attack type (line 97)
- ✓ **Melee execution:** `CpuAI.attack()` non-ranged branch (line 599–610):
  - Resolves current attack via `WeaponManager.getCurrentAttack()`
  - Calls `enemyMeleeBasePower()` to compute faithful power·strength·damageMultiplier
  - Routes through `meleeHitFn()` + `teamMaster.impactMeleeAttack()` for per-target takeHit
- ✓ **Cooldown recovery:** agility-seeded counter (10 → effective 19-frame cycle, line 187)

### Team & Allegiance: #karate
**Port implementation:** `Team` component in `/port/src/components/combat.ts`, `Targeting` in `/port/src/components/combat.ts`
- ✓ **Team assignment:** spawned with team="#karate" (archetypes.ts line 270)
- ✓ **Role:** teamRole="#teamMembers" (line 270, standard combatant)
- ✓ **Allegiance resolution:** data-driven via `game.teamMaster.findTarget()` — #aldevar.hates includes #karate, so speedyGuy hunts #aldevar units (verified casts/data/tem_aldevar.txt line 7)
- ✓ **Hit targeting:** #punchKick.hits=[#teamMembers, #teamBuildings] → melee strike targets player troops + dwellings

### Movement: High Walk Speed
**Port implementation:** `Movement` component in `/port/src/components/movement.ts` (lines 18–104)
- ✓ **Speed storage:** `maxSpeed` field, initialized from config["walkSpeed"] (line 37)
- ✓ **Scale factor:** 0.6× engine units → px/tick (archetypes.ts line 267)
  - speedyGuy: 6 units → 3.6 px/tick (vs. karateGuy 4 units → 2.4 px/tick, 1.5× ratio preserved)
- ✓ **Integration:** `intentX/Y` (control-set) + accel(1.4)/friction(0.6) + cap to maxSpeed each tick (lines 81–87)
- ✓ **Freeze support:** speed capped by freezeFactor (line 85, modfroze compatibility)

### Death Behavior
**Port implementation:** `Energy.takeHit()` in `/port/src/components/combat.ts` (lines 33–53)
- ✓ **Lethal threshold:** energy ≤ minEnergy (default 0) → dead flag set, killedInAction marked (lines 40–42)
- ✓ **dieSound playback:** if dieSound is set, play it at 0.6 volume (line 43)
  - speedyGuy dieSound="#none" → no audio on death (faithful, same as karateGuy)
- ✓ **XP award:** killer granted reward (modExperience contract, lines 44–47)

## Conclusion
**speedyGuy is CLEAN.** Data perfectly matches; melee AI, natural-melee attack resolution, #karate team allegiance, high walkSpeed (1.5× karateGuy), and #none dieSound all correctly implemented. No behavioral divergence detected.
