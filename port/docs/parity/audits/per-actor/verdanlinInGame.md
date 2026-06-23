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

---

## RE-VERIFY BY REPRODUCTION (2026-06-23)

Real assets/data; `verdanlinInGame` as `#aldevar` ally vs PINNED `darkGolem`; substrate rebuilt per tick; 260
frames. Harness gitignored/deleted. Confirms the prior `#depositMines` FIX holds.

| Check | Expected | Observed | Status |
|---|---|---|---|
| Sprite char | `verdan` (not blackOrc) | `spriteCharOr("verdan")→verdan`; full charge/release/grave strips bundled | ✓ |
| Weapon | `#energyMines` (`#explodeFunction #depositMines`, `#chargePerUnit 10`) | `getCurrentAttack name:#energyMines explodeFunction:#depositMines chargePerUnit:10` | ✓ |
| Cast outcome | deposit `#energyMine` actors (NO flying bolt, NO summon) | **12 `energyMine` actors** (type=mine, team `#aldevar`) deposited; **0 SpellActor orbs, 0 summons** — the dedicated depositMines branch, not the radial bolt | ✓ |
| Cadence | charge + cooldown 30 | mines at t=13,35,57,79,…,255 → **22-tick gaps** | ✓ |
| Damage | mines hit the caster's enemies | pinned darkGolem **energyFrac→0.000, 1 respawn** (killed by the mines) | ✓ |
| AI mode | spellcaster | `optimumPosition`(238t)+`moveToAttack`(22t) | ✓ |

**CLEAN — reproduced faithfully.** The `#depositMines` path (control.ts CPU branch + `summon.ts depositMines`)
fires the dedicated mine-drop, not a generic bolt — the prior fix is verified live.
