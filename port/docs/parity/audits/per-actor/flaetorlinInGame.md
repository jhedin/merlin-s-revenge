# flaetorlinInGame Audit

## Property Coverage

All properties from the original Lingo data are correctly present in the TypeScript port:

| Property | Original | Port | Notes |
|----------|----------|------|-------|
| objType | #objCPUCharacter | ✓ | CPU-controlled character |
| AiType | #objAiCPUSpellCaster | ✓ | Spellcaster AI mode with bullet-dodge |
| inherit | #CPUCharacter | ✓ | Base character archetype |
| wizard | true | ✓ | Magical character flag |
| character | #friendlyCharacter | ✓ | Allied unit (team #aldevar) |
| team | #aldevar | ✓ | Player's team (friendly) |
| name | "flaeto" | ✓ | Actor identifier |
| leaveWhenFinished | true | ✓ | Retires on room-clear |
| energy | 200 | ✓ | Health pool |
| strength | 1 | ✓ | Melee damage scalar |
| inertia | 60 | ✓ | Knockback resistance |
| dexterity | 3 | ✓ | Ranged/magic cooldown seed |
| damageSpeed | 4 | ✓ | Melee damage timing |
| walkSpeed | 5 | ✓ | Movement speed (scaled to 3 px/tick) |
| stallSpeed | 0.5 | ✓ | Minimum walking speed |
| miniMapStatus | #fre | ✓ | Friendly minimap icon |
| mana_capacity | 20 | ✓ | Spell charge pool ceiling |
| mana_capacityIncLevel | 7.5 | ✓ | Capacity growth per level |
| mana_flow | 4 | ✓ | Charge speed multiplier |
| mana_flowIncLevel | 1 | ✓ | Flow growth per level |
| mana_regeneration | 5 | ✓ | Attack cooldown seed (magic counter inc) |
| mana_regenerationIncLevel | 1 | ✓ | Regen growth per level |
| weapon | #cBlastAi | ✓ | Primary spell weapon (magic blast) |
| attack | #punch (melee) | ✓ | Backup melee: cooldown 10, power point(30,0), reach point(25,10), sound "wizard_punch" |

## Behavioral Verification

### 1. Spellcaster AI Mode (Charge/Cast/Dodge)
- **Original**: objAiCPUSpellCaster runs `moveToOptimumPosition` FSM with tangent-dodge bullet-avoidance (casts/script_objects/objAiCPUSpellCaster.txt:34, 171-259)
- **Port**: Mode "optimumPosition" implemented in CpuAI (control.ts:291, 435); dodgesBullets flag set by AiType check (archetypes.ts:214); runTangentToNearestBullet executed (control.ts:625)
- **Status**: ✓ IMPLEMENTED

### 2. Spell/Weapon Resolution (I9 Fix)
- **Original**: modWeaponManager sets magic weapon as primary (reach 9999 signals "spell loaded"); melee #punch is backup
- **Port**: archetypes.ts:159-160 routes spellcaster + magic #weapon to weapon's #attack (not melee); animType check confirms #magic
- **Status**: ✓ IMPLEMENTED

### 3. Mana Pool & Charge Math
- **Original**: chargeMax = min(capacity × modifier + basic, 999); chargeSpeed = chargeSpeed × flow
- **Port**: charge.ts:26-68 implements both functions; archetypes.ts:186-188 passes mana_regeneration as magic counter inc
- **Status**: ✓ IMPLEMENTED

### 4. Targeting & Allegiance
- **Original**: team #aldevar hunts #aldevar.hates (hostiles)
- **Port**: spawnAlly() sets team = "#aldevar" (archetypes.ts:44); Targeting component reads allegiance (control.ts:15)
- **Status**: ✓ IMPLEMENTED

### 5. Movement & Speed
- **Original**: walkSpeed 5, inertia 60 (knockback resistance), stallSpeed 0.5 (minimum)
- **Port**: walkSpeed scaled 5 × 0.6 = 3 px/tick (archetypes.ts:263); inertia passed (line 268)
- **Status**: ✓ IMPLEMENTED

### 6. leaveWhenFinished Retirement
- **Original**: objAiCPU #noTargetFound (casts/script_objects/objAiCPU.txt:232-237): on room-clear, no targets → retire
- **Port**: CpuAI.LEAVE_GRACE = 60 frames (control.ts:323); noTargetCtr incremented; leaveGame() called on timeout (line 430)
- **Status**: ✓ IMPLEMENTED

### 7. Death & Spell Discard
- **Original**: objSpell drops on caster death (no release/explode)
- **Port**: PlayerControl.update() calls spell.discard() on death (control.ts:113); SpellActor.discard() sets done=true (spellActor.ts:83)
- **Status**: ✓ IMPLEMENTED

## Conclusion

flaetorlinInGame is a summoned spellcaster variant on the #aldevar (player's) team. It:
- Loads with correct mana pool (capacity 20, flow 4, regen 5) and attack parameters
- Spawns via spawnAlly() with #objAiCPUSpellCaster AI (optimumPosition bullet-dodge)
- Casts primary #cBlastAi magic weapon (reach 9999) via charge/release lifecycle
- Falls back to melee #punch if interrupted
- Retires on room-clear via leaveWhenFinished (60-frame grace on no targets)
- Discards charging spell on death (no delayed explode)
- Moves, targets, and dies correctly as an allied summoned wizard

All seven behavioral categories are faithfully implemented. No behavioral divergence detected.

ACTOR=flaetorlinInGame | CLEAN
