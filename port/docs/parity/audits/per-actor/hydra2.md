# Hydra2 Parity Audit

## Property Coverage

| Property | Original (casts/) | Port (port/src/) | Status |
|---|---|---|---|
| **Classification** | #objCPUCharacter + #objAiCPU | ✓ resolved | PASS |
| **Attack Type** | #naturalMelee | ✓ animType: #naturalMelee | PASS |
| **Attack Hits** | [#teamMembers, #teamBuildings] | ✓ hits array | PASS |
| **Energy** | 1000 | ✓ 1000 | PASS |
| **Max Energy** | 1500 | ✓ 1500 | PASS |
| **Min Energy** | 500 | ✓ 500 (death threshold) | PASS |
| **Team** | #swamp | ✓ #swamp | PASS |
| **Walk Speed** | 6 | ✓ 6 (×0.6 px/tick scale) | PASS |
| **Strength** | 10 | ✓ 10 | PASS |
| **Dexterity** | 10 | ✓ 10 | PASS |
| **Reincarnate As** | #hydra1 | ✓ #hydra1 | PASS |

## Behavioral Verification

### 1. Melee AI
- **Expected**: #objAiCPU (standard melee commando) with #naturalMelee attack
- **Port**: EnemyAI component + animType resolved as melee, no ranged/magic flags
- **Result**: ✓ CORRECT

### 2. Attack Targets
- **Expected**: Hits both units (#teamMembers) and buildings (#teamBuildings)
- **Port**: `Targeting.hits` initialized from attack data as `["#teamMembers", "#teamBuildings"]`
- **Result**: ✓ CORRECT

### 3. Energy & Death Threshold
- **Expected**: Start at 1000, max 1500, die at/below 500 (minEnergy floor)
- **Port**: 
  - `Energy.init()` reads `energy: 1000`, `max: 1500`, `minEnergy: 500`
  - Death logic (line 40): `if (this.energy <= this.minEnergy) { this.dead = true; this.killedInAction = true; }`
- **Result**: ✓ CORRECT

### 4. Reincarnation Chain
- **Expected**: hydra3 (#reincarnateAs: #hydra2) → hydra2 (#reincarnateAs: #hydra1) → hydra1 (no reincarnation)
- **Port**:
  - `Reincarnate.init()` parses `reincarnateAs: #hydra1`
  - On death (isDead && getKilledInAction), spawns hydra1 at corpse location
  - Cascading reincarnation uses depth budget to prevent infinite cycles
- **Result**: ✓ CORRECT

### 5. Audio
- **Expected**: Dies silently (#dieSound: #none)
- **Port**: `dieSound` property read and gated; #none skips audio
- **Result**: ✓ CORRECT

## Code Verification

### Energy Component (components/combat.ts:22–50)
- Reads `energy`, `minEnergy`, `maxEnergy` from config
- Death threshold check: `if (this.energy <= this.minEnergy)`
- Sets `killedInAction` only on lethal damage (reincarnate gate)

### Reincarnate Component (components/reincarnate.ts:55–99)
- Normalizes `#reincarnateAs` to actor key array
- Updates on death-finalize edge only (dead && killedInAction)
- Spawns non-#none entries in order at corpse location

### Archetype Spawn (entities/archetypes.ts:301–305)
- Reads `reincarnateAs` from registry-resolved actor data
- Passes to EnemyArchetype.build() config
- Reads and forwards `minEnergy` to Energy component

## Conclusion

**Hydra2 is CLEAN.** All properties read correctly from generated data. Reincarnation chain (hydra3 → hydra2 → hydra1) is behavioral-correct: minEnergy floor (500) gates death and triggers spawn of #hydra1. Melee AI, attack targeting (units + buildings), energy/maxEnergy, and team allegiance all match original.
