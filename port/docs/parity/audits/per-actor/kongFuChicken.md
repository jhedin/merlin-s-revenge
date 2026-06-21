# Behavioral Audit: act_kongFuChicken

**Actor:** kongFuChicken | **Type:** #objCPUCharacter | **Team:** #karate | **AiType:** #objAiCPU

Natural-melee brawler, hits units AND buildings, team #karate. CLEAN — no divergence.

| Property | Value | Port handling | Status |
|----------|-------|---------------|--------|
| `attack.animType` | #naturalMelee | MELEE area resolution | ✓ |
| `attack.hits` | [#teamMembers,#teamBuildings] | hits units + buildings | ✓ |
| `team` | #karate | allegiance routing | ✓ |

**Status: CLEAN.**
