# Behavioral Audit: act_summonBoulder

**Actor:** summonBoulder | #objCPUCharacter | Team: #monsterSummon | AiType: #objAiCPU

Player-summoned monster ally; ranged #boulder thrower (#fullstrength, strength 12).

| Property | Value | Port handling | Status |
|----------|-------|---------------|--------|
| `attack.animType`/`bullet` | #naturalRanged / #boulder (#bullet) | RANGED plain bullet | ✓ |
| `attack.firingType` | #fullstrength | throwSpeed = strength = **12 px/tick** (matches original) | ✓ |
| `attack.reach` | 220 | reachRanged capped 220 | ✓ |
| `strength` | 12 | CpuAI.strength=12 → throwSpeed 12 (control.ts:352,545) | ✓ |
| `team` | #monsterSummon | player-summoned ally allegiance | ✓ |

## Note — agent false positive (verified NON-issue)
The per-actor agent flagged "firingType not implemented; boulder 0.67 vs 12 px/tick". This is WRONG:
firingType #fullstrength IS implemented (control.ts:545) and `this.strength` (12) flows into throwSpeed,
so the boulder fires at exactly 12 px/tick — matching the original. Empirically locked by the new
attack.test.ts velocity test (a #fullstrength thrower fires at strength px/tick). The "0.67" was a Haiku
miscalculation (the documented over-flag pattern).

**Status: CLEAN (firingType velocity correct; agent over-flagged).**
