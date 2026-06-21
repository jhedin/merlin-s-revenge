# goblinMage Parity Audit

## Data Coverage

| Property | Original | Port | Status |
|----------|----------|------|--------|
| objType | #objCPUCharacter | #objCPUCharacter | ✓ |
| AiType | #objAiCPUSpellCaster | #objAiCPUSpellCaster | ✓ |
| inherit | #CPUCharacter | #CPUCharacter | ✓ |
| character | #goblinMage | #goblinMage | ✓ |
| damageSpeed | 4 | 4 | ✓ (non-issue) |
| dexterity | 3 | 3 | ✓ |
| energy | 50 | 50 | ✓ |
| experienceAmountForNextLevel | 3 | 3 | ✓ |
| experienceImWorth | 6 | 6 | ✓ |
| inertia | 60 | 60 | ✓ |
| miniMapStatus | #inf | #inf | ✓ (non-issue) |
| stallSpeed | 0.5 | 0.5 | ✓ (non-issue) |
| strength | 1 | 1 | ✓ |
| team | #goblins | #goblins | ✓ |
| name | "goblinMage" | "goblinMage" | ✓ |
| walkSpeed | 3.5 | 3.5 | ✓ |
| weapon | #energyBlast | #energyBlast | ✓ |
| mana_capacity | (default) | 10 (default) | ✓ |
| mana_flow | (default) | 1 (default) | ✓ |
| mana_burst | (default) | 1 (default) | ✓ |
| mana_regeneration | (default) | 1 (default) | ✓ |

## Behavioral Verification

### 1. Spellcaster AI Chain (objAiCPUSpellCaster)
- **Original**: `objAiCPUSpellCaster` handles bullet-dodge positioning via `updateMoveToOptimumPosition` and `runTangentToObjects`.
- **Port**: `AiType === "#objAiCPUSpellCaster"` sets `dodgesBullets = true` (archetypes.ts:214); `CpuAI.update` routes to `optimumPosition` mode after attack (control.ts:435, 511); `runTangentToNearestBullet` faithfully re-implements the tangent-run geometry (control.ts:625–651).
- **Status**: ✓ Faithful

### 2. Spell Casting & Resolution
- **Original**: `objAiCPUSpellCaster` fires the #weapon (#energyBlast) via objBullet; energyBlast is a ranged magic spell (reach:9999, type:magic).
- **Port**: Enemy attack resolution checks `ca.type === "magic"` (control.ts:543) and routes to `fireBullet` for plain energy spells (line 576), with spell speed & power derived from the attack data. No mana pool depleted; mana stats are tuning parameters for charge only (Mana.ts:1–5).
- **Status**: ✓ Faithful

### 3. Movement & Positioning
- **Original**: CPUCharacter walks at `walkSpeed:3.5` with `inertia:60` for knockback damping; spellcaster idles once in safe range.
- **Port**: `walkSpeed 3.5 * 0.6 = 2.1 px/tick` (archetypes.ts:263 slice-scale); inertia=60 applied as Movement damping coefficient; optimumPosition chain keeps the caster moving perpendicular to bullets or retreating from close enemies.
- **Status**: ✓ Faithful (scale conversion is documented)

### 4. Death & Spell Cleanup
- **Original**: On character death, active spells are discarded (objCPUCharacter death mode -> pSpellCasterMode = #none; spell.discard).
- **Port**: EnemyArchetype includes Grave component; spell discard happens implicitly when the caster's entity is removed/swept (room clear). No active-spell pool for enemies (the spell-actor path is player-only; enemies fire bullets directly).
- **Status**: ✓ Faithful (enemies don't hold live spell actors; no discard needed)

### 5. Team & Allegiance
- **Original**: team=#goblins; targeting via objAiCPU.findTarget + teamMaster lookup (hostile to player/aldevar).
- **Port**: team="#goblins" set; EnemyArchetype targets via Targeting component (control.ts:290–292) with allegiance="#enemy" (enemy intent) and hits=["#teamMembers","#teamBuildings"]; teamMaster.findTarget hunts by allegiance+roles (teams.ts).
- **Status**: ✓ Faithful

## Conclusion

All **15 explicit properties** from act_goblinMage are present and match original values. **Behavioral implementation is complete and faithful**: the spellcaster AI chain (bullet-dodge optimumPosition), spell firing (magic routing), mana defaults, movement, death handling, and team allegiance are all correctly implemented. **No gaps detected.**

**Result: CLEAN**
