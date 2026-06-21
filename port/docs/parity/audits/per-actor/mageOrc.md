# Behavioral Audit: act_mageOrc

**Actor:** mageOrc | **Type:** #objCPUCharacter | **Team:** #goblins | **AiType:** #objAiCPUSpellCaster

Spellcaster SUMMONER (#goblinSummon). Summons goblin units; the summon is #randomSummon (tier wobbles per cast).

| Property | Value | Port handling | Status |
|----------|-------|---------------|--------|
| `AiType` | #objAiCPUSpellCaster | spellcaster: charge/cast + bullet-dodge optimumPosition | ✓ |
| `weapon` | #goblinSummon | magic, explodeFunction #summonUnit → summonUnit() | ✓ |
| `goblinSummon.randomSummon` | true | **FIXED** — CPU summon now passes game.rng → per-cast tier wobble (was deterministic top tier) | ✓ |
| `team` | #goblins | enemy | ✓ |

## Gap found + FIXED
- **randomSummon tier-wobble not invoked** — chargeMaxOf implements the calcAttackChargeMax wobble but only
  when passed an rng; NO caller passed one, so every randomSummon caster (mageOrc, goblinMage, necromancer,
  greyGhost via goblin/undead/sc/skeleton summon) always reached the deterministic TOP tier. FIXED: the CPU
  summon release passes game.rng (one-shot, cooldown-gated → no jitter); the player charge also caches a
  per-cast wobbled ceiling (calcAttackChargeMax fires once). casts/script_objects/modAttack.txt calcAttackChargeMax |
  port/src/components/control.ts (attack summon release + player charge-start) + charge.ts.

**Status: FIXED (randomSummon wobble wiring — all CPU randomSummon casters).**
