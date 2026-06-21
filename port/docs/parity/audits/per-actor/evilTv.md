# Behavioral Audit: act_evilTv

**Actor:** evilTv | **Type:** #objCPUCharacter | **Team:** #monsters | **AiType:** #objAiCPU

Ranged enemy that throws #spark at reach 200 and KITES (runReload) after each shot.

| Property | Value | Port handling | Status |
|----------|-------|---------------|--------|
| `attack.animType` | #naturalRanged | RANGED thrower | ✓ |
| `attack.bullet` | #spark | resolves to act_spark | ✓ |
| `attack.reach` | 200 | reachRanged=200 | ✓ |
| `attack.firingType` | #fullStrength | **FIXED** — throw velocity = strength (was fixed 4.5) | ✓ |
| `runReload` | true | **FIXED** — now kites after a shot (data-driven; was ignored) | ✓ |
| `startingLevel` | 0 | no pre-levelling | ✓ |
| `team` | #monsters | enemy | ✓ |
| `weaponTechnique` | 3 | original hardcodes the technique inc — catalogued | ✓ |

## Gaps found + FIXED
- **runReload:true ignored** — the port derived runReload from AiType only; evilTv (#objAiCPU) was missed
  so it stood still after firing instead of kiting. Now reads the data property. objCPUCharacter.txt:162 |
  archetypes.ts:206.
- **firingType #fullStrength ignored** — see dwarfTower; fixed systemically.

**Status: FIXED (runReload + firingType).**
