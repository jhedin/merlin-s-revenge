# Behavioral Audit: act_blackOrc

**Audit Date**: 2026-06-21  
**Scope**: Port vs Original (casts/data/act_blackOrc.txt)  
**Result**: ✅ CLEAN — all behavioral aspects match the original.

---

## Data Fidelity

### Spec (Original Lingo)
```lingo
[#name: "act_blackOrc", #type: #field]
[
#objType: #objCPUCharacter,
#AiType: #objAiCPU,
#inherit: #CPUCharacter,
#character: #friendlyCharacter,
#team: #monsters,
#weapon: #blackAxe,
#strength: 30,
#energy: 1200,
#walkSpeed: 6,
#dexterity: 3,
#inertia: 80,
#experienceImWorth: 50,
#dieSound: "blackOrc_die",
(+ damageSpeed, frictionReel, miniMapStatus, stallSpeed, dieVolume: all in known-omitted list)
]
```

### Port (src/generated/data.json + registry resolution)
All properties correctly preserved: `objType`, `AiType`, `inherit`, `character`, `team`, `weapon`, `strength`, `energy`, `walkSpeed`, `dexterity`, `inertia`, `experienceImWorth`, `dieSound`. Data matches line-by-line.

---

## Behavioral Verification

### 1. Archetype & AI FSM
| Aspect | Original | Port | Status |
|--------|----------|------|--------|
| Archetype | #objCPUCharacter (CPU slot) | EnemyArchetype with EnemyAI | ✓ Equivalent |
| AiType | #objAiCPU | Read from data; drives CpuAI FSM (committed-target chase+attack) | ✓ Correct |
| Special AI | None (not spellcaster/ghost/builder/bomber) | runReload=false, ghost=false, builder=false, dodgesBullets=false | ✓ Standard hunt mode |

**Evidence**:  
- `casts/data/act_blackOrc.txt:4` → `#AiType: #objAiCPU`  
- `port/src/entities/archetypes.ts:171-210` → ai type resolved; non-spellcaster, non-ranged → standard FSM  
- `port/src/components/control.ts:285-330` → CpuAI FSM implements committed-target hunt

### 2. Attack Type Resolution
| Aspect | Original | Port | Status |
|--------|----------|------|--------|
| Has own #attack | No | No | ✓ Correct |
| Weapon | #blackAxe | Resolved from data | ✓ Correct |
| Weapon.animType | #weaponMelee | #weaponMelee | ✓ Correct |
| Inferred type | Melee (contact) | typeFromAnimType("#weaponMelee") → "melee" | ✓ Correct |
| Fire mode | NOT ranged | ranged=false (line 169-170) | ✓ Correct |

**Evidence**:  
- `casts/data/act_blackOrc.txt:21` → `#weapon: #blackAxe`  
- `casts/data/act_blackAxe.txt:8` → `#animType: #weaponMelee`  
- `port/src/entities/archetypes.ts:145-162` → spawnEnemy logic: no own attack → use weapon's attack  
- `port/src/components/weapon.ts:86-95` → typeFromAnimType maps #weaponMelee → "melee"

### 3. Team & Targeting
| Aspect | Original | Port | Status |
|--------|----------|------|--------|
| Team | #monsters | Read and set as "#monsters" | ✓ Correct |
| Player side? | No | isPlayerSide("#monsters")=false → type="enemy" | ✓ Correct |
| Hates | #aldevar (player's team) | tem_monsters.hates includes #aldevar | ✓ Data-driven |
| Friends | #goblins, #swamp | tem_monsters.friends matches | ✓ Data-driven |

**Evidence**:  
- `casts/data/act_blackOrc.txt:18` → `#team: #monsters`  
- `port/src/entities/archetypes.ts:54-59` → spawnUnit checks isPlayerSide(team); false → "enemy" type  
- `port/src/systems/teams.ts:40-97` → tem_monsters allegiance loaded; hates=#aldevar  

### 4. No Special Flags
| Flag | Present? | Behavior | Status |
|------|----------|----------|--------|
| wizard | No | — | ✓ Not triggered |
| ghost | No | — | ✓ Not triggered |
| multiAttack | No | — | ✓ Not triggered |
| builder | No | — | ✓ Not triggered |
| leaveWhenFinished | No | — | ✓ Not triggered |
| reelProof | No | — | ✓ Not triggered |

All checked in `port/src/entities/archetypes.ts:154-210`; all falsy, standard unit behavior applies.

---

## Combat Sequence (Behavioral Correctness)

1. **Spawn**: `spawnEnemy("blackOrc", x, y)` reads act_blackOrc data
2. **Archetype**: EnemyArchetype (CpuAI FSM + melee weapon)
3. **Team**: #monsters (hunts #aldevar)
4. **Attack**: Resolves weapon #blackAxe → #weaponMelee → melee type
5. **FSM**: Standard hunt (findTarget → moveToAttack → swing → cooldown)
6. **No deviations**: No spell-casting, no possession, no multi-weapon switch, no building

**This matches the original objAiCPU hunting behavior exactly.**

---

## Conclusion

✅ **CLEAN** — blackOrc behaves faithfully in the port. All data properties, AI routing, attack resolution, team allegiance, and flag handling are correct. No behavioral divergences found.
