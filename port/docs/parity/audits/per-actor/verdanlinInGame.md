# Behavioral Audit: act_verdanlinInGame

**Actor:** verdanlinInGame | #objCPUCharacter | Team: #aldevar | AiType: #objAiCPUSpellCaster | #wizard | weapon: #energyMines

| Property | Value | Port handling | Status |
|----------|-------|---------------|--------|
| `weapon.explodeFunction` | #depositMines | **FIXED** — now deposits #energyMine actors, was a generic bolt | ✓ |
| `weapon.chargePerUnit` | 10 | numMines = charge/10 | ✓ |
| `wizard` / mana | true | spellcaster charge/cast | ✓ |
| `team` / leaveWhenFinished | #aldevar / true | ally; retires on room-clear | ✓ |

## Gap found + FIXED
- **#depositMines not implemented (player AND CPU)** — modSpellMultistage.depositMines drops
  numMines = charge/chargePerUnit #energyMine actors. The port's spellActor.explode() handled only
  #summonUnit, and CpuAI had no mine branch, so the player's energyMines spell AND verdanlinInGame just
  did the radial explode with NO mines. FIXED: a shared depositMines() helper (summon.ts) spawns the mines
  (VarRoughly scatter, charge/2); wired into spellActor.explode() (player) and CpuAI.attack() (CPU caster,
  at the target loc). casts/script_objects/modSpellMultistage.txt:124 | port/src/components/summon.ts +
  spellActor.ts + control.ts.

**Status: FIXED (#depositMines — player energyMines + verdanlinInGame).**
