# Behavioral Audit: act_fangBunnyBaby

**Actor:** fangBunnyBaby | **Type:** #objCPUCharacter | **Team:** #cave | **AiType:** #objAiCPU

Ranged catapult: throws #fangBunnyBabyBullet at reach 125 with #fullstrength velocity.

| Property | Value | Port handling | Status |
|----------|-------|---------------|--------|
| `attack.animType` | #naturalRanged | RANGED thrower | ✓ |
| `attack.bullet` | #fangBunnyBabyBullet | resolves | ✓ |
| `attack.reach` | 125 | reachRanged=125 | ✓ |
| `attack.firingType` | #fullstrength | **FIXED** — throw velocity = strength (8), was fixed 4.5 | ✓ |
| `energy`/`strength` | 200 / 8 | health / power | ✓ |
| `team` | #cave | enemy | ✓ |
| `weaponTechnique` | 0 | original hardcodes inc — catalogued | ✓ |

## Gap found + FIXED
- **firingType #fullstrength ignored** — see dwarfTower; fixed systemically (throw velocity now = strength).

**Status: FIXED (firingType).**
