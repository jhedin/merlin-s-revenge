# Shrouder Behavioral Parity Audit

## Summary
Shrouder is a #multiAttack CPU character with 2-weapon range-based auto-switching:
- **Weapon 1 (Primary):** throwSmoke (ranged, #naturalRanged, reach 300)
- **Weapon 2 (Secondary):** pinShooter (ranged, #naturalRanged, reach 80 from act_pinShooter)
- **Team:** #magicalAlliance (hunts #magicalAlliance.hates)
- **Behavior:** Switch to pinShooter within bufferDist (100, overridden to 80 since weapon 2 is ranged); else ranged throwSmoke

## Property Coverage

| Property | Lingo (casts/data) | Port (port/src/generated/data.json) | Status |
|----------|-------------------|-------------------------------------|--------|
| #objType | #objCPUCharacter | #objCPUCharacter | ✓ MATCH |
| #AiType | #objAiCPU | #objAiCPU | ✓ MATCH |
| #inherit | #CPUCharacter | #CPUCharacter | ✓ MATCH |
| #attack | throwSmoke (animframe [2,3,4,5,6,7], reach 300, cooldown 400) | Identical | ✓ MATCH |
| #weapon | #pinShooter | #pinShooter | ✓ MATCH |
| #multiAttack | true | true | ✓ MATCH |
| #team | #magicalAlliance | #magicalAlliance | ✓ MATCH |
| #energy | 150 | 150 | ✓ MATCH |
| #strength | 7 | 7 | ✓ MATCH |
| #dexterity | 10 | 10 | ✓ MATCH |
| #inertia | 50 | 50 | ✓ MATCH |
| #walkSpeed | 3 | 3 | ✓ MATCH |
| #damageSpeed | 2 | 2 | ✓ MATCH |
| #startingLevel | 0 | 0 | ✓ MATCH |
| #experienceImWorth | 15 | 15 | ✓ MATCH |
| #eyestrain | 50 | 50 | ✓ MATCH |
| #dieSound | #none | #none | ✓ MATCH |
| #weaponTechnique | 20 | 20 | ✓ MATCH |

## Behavioral Correctness

### 1. Weapon Setup (K6 multiAttack initialization)
**Original:** `modWeaponManager.initNaturalAttack()` loads throwSmoke; `initStartingWeapon()` loads pinShooter via #weapon.
**Port:** `EnemyArchetype.spawnEnemy()` builds `attack` (throwSmoke resolved) and `attack2` (pinShooter from #weapon). WeaponManager.init() receives both via cfg (lines 241–248 in weapon.ts).
- Port correctly adds **weapon 1** (throwSmoke, ranged) and **weapon 2** (pinShooter, melee via attack2).
- ✓ MATCH: Both weapons registered; weapon 1 defaulted current.

### 2. Range-Based Weapon Switching (K6 setMultiAttack)
**Original:** `objAiCPU.refreshTarget()` → `pCharacterPrg.setMultiAttack(pMultiAttack, pBufferDist)` (line 303).
Then `modWeaponManager.setMultiAttack()` (lines 343–389) applies:
  - Weapon 2's type checked: pinShooter is `#naturalRanged` with `#bullet: #smokePin` → type is ranged.
  - Since weapon 2 is ranged, bufferDist is overridden to weapon 2's reach (80).

**Port:** `CpuAI.updateMoveToAttack()` (line 481–483 in control.ts) calls `setMultiAttack()` before `targetInReach()`.
`WeaponManager.setMultiAttack()` (lines 309–329 in weapon.ts):
  - Checks `distToTarget = (tx-mx)² + (ty-my)²` (squared, faithful).
  - If weapon 2 ranged: `buf = weapon2.reach` → buf = 80.
  - If `distToTarget > buf²`: select weapon 1 (throwSmoke).
  - Else branch on target's attack type:
    - If target melee + `distToTarget > 20` + weapon2 melee → weapon 1 (poke from range).
    - Else → weapon 2.
  - Non-melee target inside buffer → weapon 2.

**Fidelity Check:**
- Shrouder's weapon 2 (pinShooter) is ranged (animType #naturalRanged, has bullet). Port sets its `.type = "ranged"` (line 235 in archetypes.ts). But original Lingo checks `pWeapons[2].type = #ranged` — which in Lingo checks the weapon's *attack* type. For pinShooter, the attack is a #bullet type, so it's ranged. Port correctly identifies it as ranged and uses weapon 2's reach (80) as the buffer.
- ✓ MATCH: Both beyond buffer → ranged weapon 1; within buffer → melee logic (target type dependent).

### 3. Attack Resolution & Cooldown
**Original:** `modWeaponManager.getCooldownFin()` checks current weapon's cooldown counter.
**Port:** `WeaponManager.getCooldownFin()` (line 338) checks current weapon's counter.
- throwSmoke: cooldown 400 (ranged, dexterity inc = 10).
- pinShooter: cooldown 0 (melee/ranged, animType naturalRanged).
- Port resolves both via `resolveAttack()` with calibrated effective cooldown (lines 196–237 in archetypes.ts).
- ✓ MATCH: Both weapons track independent cooldowns; getCooldownFin() returns current weapon's state.

### 4. Team Allegiance & Targeting
**Original:** Shrouder has `#team: #magicalAlliance` → hunts teams where allegiance is set up (via teamMaster).
**Port:** `spawnEnemy()` passes `team: str("team", "#magicalAlliance")` → Entity.build() sets Team component.
- CpuAI.refreshTarget() calls `game.teamMaster.findTarget()` → hunts entities in team's `.hates` list (data-driven).
- ✓ MATCH: Both use allegiance-based targeting; team is propagated correctly.

### 5. Movement & Death
**Original:** CpuAI FSM (findTarget → moveToAttack → runReload/attack). Movement via pathfinding. Death triggers grave/experience.
**Port:** CpuAI FSM identical. Movement via PathFinding component. Energy/Hurt/Grave components handle death.
- ✓ MATCH: FSM and death flow preserved.

### 6. Attack Behavior (Both Weapons)
- **throwSmoke (ranged):** cooldown 400, reach 300, bullet #smoke (explode, power 0.25).
- **pinShooter (ranged):** cooldown 0, reach 80, bullet #smokePin (power 1.5).
- Port correctly resolves both bullets' attack data (act_smoke.txt, act_smokePin.txt) for damage calculation.
- ✓ MATCH: Both weapons fire correctly; attack resolution uses bullet's real attack stats.
- Port's animType→type mapping (typeFromAnimType) correctly classifies `#naturalRanged` as "ranged".

## Conclusion
**CLEAN** — All properties match exactly; 2-weapon switching logic is faithful to the original. Shrouder's range-based auto-switch (throwSmoke beyond 80px, pinShooter within; bufferDist overridden to weapon 2's reach per modWeaponManager line 368) works identically in both trees. Team allegiance, targeting, movement, and death are all correctly implemented.
