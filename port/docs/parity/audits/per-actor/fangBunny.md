# Behavioral Audit: act_fangBunny

**Actor:** fangBunny | **Type:** #objCPUCharacter | **Team:** #cave | **AiType:** #objAiCPU

Melee bruiser (energy 500), #fangStrike (#naturalMelee, damageMultiplier 0.5), hits members + buildings.

| Property | Value | Port handling | Status |
|----------|-------|---------------|--------|
| `attack.animType` | #naturalMelee | MELEE (area resolution) | ✓ |
| `attack.damageMultiplier` | 0.5 | applied as mult in enemy melee | ✓ |
| `attack.hits` | [#teamMembers,#teamBuildings] | attacks units AND buildings | ✓ |
| `energy`/`strength`/`inertia` | 500 / 10 / 30 | health / power / knockback | ✓ |
| `team` | #cave | enemy | ✓ |

No firingType (melee). CLEAN — no divergence.

**Status: CLEAN.**
