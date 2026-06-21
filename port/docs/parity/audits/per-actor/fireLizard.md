# Parity Audit: fireLizard

**Auditor**: Claude Code  
**Actor**: fireLizard (act_fireLizard.txt vs port/src/generated/data.json)  
**Date**: 2026-06-21

---

## Summary

**fireLizard** is a hostile red lizard enemy deployed on the scarlet team. It differs from its base class **act_lizard** (monsters team) ONLY in team allegiance (`#scarlet` vs `#monsters`). All other properties, attack mechanics, and AI behavior are identical to **act_lizard**.

**Verdict: CLEAN** — All behavioral properties are correctly implemented in the port.

---

## Property Coverage Audit

| Property | Original (casts/) | Port Value (data.json) | Implementation | Status |
|----------|-------------------|------------------------|-----------------|--------|
| **objType** | #objCPUCharacter | #objCPUCharacter | EnemyArchetype | ✓ |
| **AiType** | #objAiCPU | #objAiCPU | CpuAI component (control.ts) | ✓ |
| **inherit** | #CPUCharacter | #CPUCharacter | Resolved in data | ✓ |
| **team** | #scarlet | #scarlet | spawnUnit checks; isPlayerSide (teams.ts:80-83) | ✓ |
| **attack.animType** | #naturalMelee | #naturalMelee | resolveAttack (weapon.ts:153-200) | ✓ |
| **attack.cooldown** | 0 | 0 | Effective cooldown re-derived (archetypes.ts:180-188) | ✓ |
| **attack.power** | point(15,2) | {x:15,y:2} | powerScalar = abs(15)+abs(2) = 17 | ✓ |
| **attack.damageMultiplier** | 1 | 1 | Carried to enemyMeleeBasePower (weapon.ts:144) | ✓ |
| **attack.name** | #babyFlamethrower | #babyFlamethrower | Attack identity | ✓ |
| **attack.sound** | "dragon_fire" | "dragon_fire" | Audio playback (control.ts:594) | ✓ |
| **attack.hits** | [#teamMembers, #teamBuildings] | [#teamMembers, #teamBuildings] | Targeting (combat.ts:150) | ✓ |
| **strength** | 2 | 2 | CpuAI.init (control.ts:340-343) | ✓ |
| **dexterity** | 10 | 10 | Cooldown counter inc (archetypes.ts:174, 187) | ✓ |
| **energy** | 100 | 100 | Energy component (combat.ts:60-120) | ✓ |
| **walkSpeed** | 2 | 2 | spawnEnemy build (archetypes.ts:263) | ✓ |
| **inertia** | 60 | 60 | Knockback damping (archetypes.ts:268) | ✓ |
| **dieSound** | #none | #none | Played on death (archetypes.ts:295) | ✓ |
| **takeHitSound** | "dragon_hit" | "dragon_hit" | Audio on damage (Hurt component) | ✓ |
| **startingLevel** | 0 | 0 | Pre-spawn level-up (archetypes.ts:313-314) | ✓ |
| **experienceImWorth** | 4 | 4 | Experience grant on death (archetypes.ts:296) | ✓ |

---

## Behavioral Correctness Audit

### AI Mode (CpuAI / objAiCPU)
- **Original**: objAiCPU → committed-target FSM (findTarget/moveToAttack/dazed)
- **Port**: CpuAI class (control.ts:295-650) implements identical FSM
- **Status**: ✓ **CORRECT**

### Attack Resolution (Melee)
- **Original**: calcCollisionVectMelee (modAttack.txt:463) → point(15,2) × strength(2) = 34 base power
- **Port**: enemyMeleeBasePower(attack, 2) = powerScalar(17) × strength(2) × ENEMY_DAMAGE_SCALE = 34 × scale
- **Note**: Port's ENEMY_DAMAGE_SCALE is a deliberate tuning adjustment (design choice), faithful to the original's damage model
- **Status**: ✓ **CORRECT**

### Targeting & Allegiance
- **Original**: #scarlet team → defined in tem_scarlet.txt with hates/friends
- **Port**: spawnUnit routes by team (archetypes.ts:54-60)
  - `isPlayerSide("#scarlet")` → false (not #aldevar) → type = "enemy"
  - Allegiance read from #attack.targetAllegiance (defaults to "#enemy") 
  - hits = [#teamMembers, #teamBuildings]
- **Status**: ✓ **CORRECT**

### Movement & Speed
- **Original**: walkSpeed 2 (unit-engine units)
- **Port**: 2 × 0.6 = 1.2 px/tick (conversion factor for slice, archetypes.ts:263)
- **Status**: ✓ **CORRECT** (tuned conversion, not behavioral change)

### Death & Reincarnation
- **Original**: No reincarnation properties set → dies normally
- **Port**: reincarnateAs/reincarnateInto not in data → Reincarnate component leaves unchanged
- **Status**: ✓ **CORRECT**

### Cooldown & Rate of Fire
- **Original**: cooldown=0 + dexterity(10) → frames recovered per tick = 10
- **Port**: Effective cooldown re-derived from rawCooldown(0) + melee(6) × dexterity(10) + 1 = 61 frames max (archetypes.ts:181-188)
- **Note**: Port re-derives cooldown by design (B2 plan §f.3) to preserve feel; melee attacks fire ~every 6 frames per dexterity tick
- **Status**: ✓ **CORRECT** (re-derived, documented, preserves feel)

### Gravity & Jump (N/A)
- **Original**: No jump/gravity properties
- **Port**: Defaults used (Movement component)
- **Status**: ✓ **NOT APPLICABLE**

### Special Mechanics
- **Original**: No multiAttack, builder, ghost, spellcaster, or splash modes
- **Port**: All flags default to false (archetypes.ts:213-216) → standard committed-target AI
- **Status**: ✓ **CORRECT**

---

## Comparison to Base Class (act_lizard)

| Aspect | fireLizard | act_lizard | Port Handling |
|--------|-----------|-----------|----------------|
| Team | #scarlet | #monsters | Both read correctly; affects render type only |
| Attack | Identical | Identical | Same resolveAttack path |
| AI | Identical | Identical | Same CpuAI FSM |
| Stats | All identical | All identical | Bit-for-bit same build parameters |

The ONLY divergence is team (#scarlet vs #monsters), which:
1. Is correctly read from data (archetypes.ts:266)
2. Is correctly routed through spawnUnit (which tags type by isPlayerSide)
3. Does NOT affect attack/damage/AI behavior — only rendering/room-clear logic
4. Matches the original's team-based allegiance design

---

## Conclusion

**CLEAN** — fireLizard is a faithful port with no behavioral gaps. The sole property difference (team) is correctly implemented. All melee attack mechanics, cooldown rates, targeting, AI modes, and stats match the original's behavior.

