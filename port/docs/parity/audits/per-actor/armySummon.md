# Behavioral Parity Audit: armySummon

**Actor**: `act_armySummon` (spell scroll, #objScroll / #objAiPowerUp)  
**Spell Type**: Multistage summon with reserve requirement (G2 army bank)  
**Audit Date**: 2026-06-21

## Summary

The armySummon spell is a charged multistage summon that releases one ally from the army reserve bank at the cast location. All critical behavioral requirements are implemented faithfully.

## Behavioral Requirements Verified

| Requirement | Original (Lingo) | Port (TypeScript) | Status |
|---|---|---|---|
| **Data Resolution** | `act_armySummon.txt`: attack.multistage proplist {warrior:10, archer:15, monk:20, dwarf:25, kingInGame:32} | `data.json`: same structure, normalized to sorted array via `normMultistage()` (weapon.ts:80-86) | ✓ MATCH |
| **Tier Selection** | `modSpellMultistage.selectPayload()` (line 316-340): iterate multistage, highest tier where `chargeRequired <= charge` | `summon.selectTier()` (line 42-49): identical logic, returns type string or null | ✓ MATCH |
| **Charge Calculation** | `modAttack.calcAttackChargeMax()` (line 83-118): apply chargeMax, chargeMaxModifier, chargeMaxBasic, limitMagic, randomSummon wobble | `charge.chargeMaxOf()` (line 26-46): identical, including randomSummon wobble for multistage ≥2 | ✓ MATCH |
| **Reserve Requirement** | `armyMaster.createUnit()` (line 80-87): if `armyDetails = #none` AND `spellName = #armySummon`, return #none (fizzle) | `summon.summonUnit()` (line 63-72): `if (isArmySummon) return null` when `!hasReserve(team, type)` | ✓ MATCH |
| **Unit Spawning** | `armyMaster.createUnit()` (line 88-108): newActor at `startLoc`, apply `restoreArmyDetails()` to re-field at banked level, consume reserve | `armyMaster.createUnit()` (port: 74-86): spawnAlly at (x,y), call `restoreArmyDetails()`, splice consumed record | ✓ MATCH |
| **Summon Location** | `modSpellMultistage.summonPayload()` (line 372-393): called from objSpell at landing location after explode | `spellActor.explode()` (line 126-127): `summonUnit(attack, charge, m.x, m.y, ownerId)` at landing loc before resolveSplash | ✓ MATCH |
| **Bolt Still Fires** | `modSpellMultistage.selectPayload()` (line 338): if `pCurrentPayload <> #none`, set `payloadFunction = [pPayloadFunctionNonBlank]`; objSpell.goMode #explode calls `teamMaster.impactAttack()` radial hit | `spellActor.explode()` (line 136-144): `resolveSplash(explodeAttack, ...)` runs radial area hit AFTER summonUnit (the bolt damage) | ✓ MATCH |
| **Experience Gain** | `modSpellMultistage.summonPayload()` (line 389-391): owner gains 0.5 experience | `summon.summonUnit()` (line 70): `owner?.send("gainXp", 0.5)` | ✓ MATCH |
| **Reserve Consumption** | `armyMaster.restoreUnitToCombat()` (line 315-329): find highest-level record, splice from list | `armyMaster.createUnit()` (port: line 83): `found.list.splice(found.idx, 1)` removes consumed record | ✓ MATCH |
| **Multistage Tiers** | Charge 0–9: none; 10–14: warrior; 15–19: archer; 20–24: monk; 25–31: dwarf; 32+: kingInGame | Same tier mapping via sorted array (chargeRequired ascending) | ✓ MATCH |
| **No Random Wobble** | `attack.randomSummon: false` — armySummon is deterministic | Data.json: `randomSummon: false`; charge.chargeMaxOf() skips wobble branch (line 36-44) | ✓ MATCH |
| **Reserve Lookup** | `armyMaster.lookupArmyDetails()` (line 251-268): return highest-level record of [team][typ] by `ListGetPosOfMaxByProp(unitList, #pExperienceLevel)` | `armyMaster.lookupArmyDetails()` (port: line 59-65): iterate [team][typ] list, return entry with max level | ✓ MATCH |

## Edge Cases Verified

| Case | Lingo | Port | Status |
|---|---|---|---|
| **Fizzle (no reserve)** | createUnit returns #none; summonPayload returns early (line 373-375) | summonUnit returns null; line 72 fizzles | ✓ MATCH |
| **Tier 0 (charge < 10)** | selectPayload returns #none (no tier ≤ charge); summonPayload fizzles (line 373-375) | selectTier returns null; summonUnit returns null (line 58) | ✓ MATCH |
| **Empty reserve** | hasReserve → checkUnitAvailability false; createUnit → armyDetails=#none for armySummon → return #none | hasReserve(team, type) false; createUnit returns null (line 76) | ✓ MATCH |
| **Charge exponent** | chargeExplodeFactor=1: no radial growth on explode (line 12) | explodeCharge = charge * 1 (line 121); radius unchanged | ✓ MATCH |
| **Reserved unit re-field** | restoreArmyDetails applies level-up growth from spawn level to banked level (line 98-99) | restoreArmyDetails calls forceLevelUp in a loop (line 93) | ✓ MATCH |

## Known Out-of-Scope Items

Per the audit brief (§g), the following are **NOT flagged** as gaps:
- Permission/icon UI (obtainPermissionOrHalt, displayIcon, chargeReinIn) — reserve requirement applies silently
- Teleport-in animation — collapsed to instant (render-only)
- Audio/volume settings
- Rotational behavior
- MiniMap status display

## Conclusion

**BEHAVIORAL PARITY: CLEAN**

The armySummon spell faithfully implements all critical behaviors:
1. ✓ Multistage tiers resolve correctly via charge thresholds
2. ✓ Reserve bank is required (fizzles without a banked unit of the selected type)
3. ✓ Units summon at the spell's landing location
4. ✓ The radial damage bolt still fires (energy cost applies)
5. ✓ Banked units are re-fielded at their saved level and consumed
6. ✓ Experience credit is awarded to the caster

No behavioral divergences detected.
