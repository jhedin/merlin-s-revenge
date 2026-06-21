# Audit: skelitonSummon

## Summary
Behavioral parity audit for the skelitonSummon spell (used by skelitonUpper). The spell summons a multistage undead unit chosen by charge tier, with randomSummon wobble to prevent reliable top-tier access.

## Data Coverage

| Property | Lingo (casts/) | TypeScript (port/src/) | Match |
|----------|---|---|---|
| **Spell Name** | `#skelitonSummon` | `act_skelitonSummon` ✓ | ✓ |
| **Spell Type** | `#objScroll` / `#objAiPowerUp` | Scroll archetype ✓ | ✓ |
| **Attack Type** | `#magic` (animType) | `animType: "magic"` ✓ | ✓ |
| **Explode Function** | `#summonUnit` | `explodeFunction: "#summonUnit"` ✓ | ✓ |
| **randomSummon** | `true` | `randomSummon: true` ✓ | ✓ |
| **Multistage Tiers** | 8 units (10–35 charge) | 8 units (10–35 charge) ✓ | ✓ |
| **Tier Order** | skelitonFootSoldier(10), skelitonHead(15), skelitonArm(17), skelitonTorsoTank(22), skelitonSword(25), skelitonLowerLeg(27), skelitonUpper(30), skelitonLord(35) | Same order (sorted ascending) ✓ | ✓ |
| **Team** | `#enemies` (residentTeamCategory) → summoned units `#undead` | residentTeamCategory `#enemies`, each summoned unit's own team data `#undead` ✓ | ✓ |
| **Charge Max** | 38 | `chargeMax: 38` ✓ | ✓ |
| **Charge Start** | 0 | `chargeStart: 0` ✓ | ✓ |
| **Charge Speed** | 0.4 | `chargeSpeed: 0.4` ✓ | ✓ |

## Logic Coverage

### Charge → Tier Selection (selectPayload / selectTier)
- **Lingo** (modSpellMultistage.txt:316–340): iterate multistage from lowest charge, pick highest tier ≤ current charge; exit early when chargeRequired > charge.
- **TypeScript** (summon.ts:42–48): same logic — iterate, pick highest tier ≤ charge, break early. ✓

### randomSummon Wobble (calcAttackChargeMax)
- **Lingo** (modAttack.txt): if randomSummon && tier[2]−chargeMax < 0, randomize ceiling: `tempMax = chargeMax·random(20)/17 + random(tier[1])`, then `chargeMax = min(chargeMax, tempMax) + random(2)−1`.
- **TypeScript** (charge.ts:33–44): identical wobble logic — check tier2 > cm, apply randomize formula with Rng.int. Both use 1..n inclusive random. ✓
- **Call Site**: charge.ts:153 (player cast) and control.ts:570 (CPU cast) both call `chargeMaxOf(magic, mana, game.rng)` to bake wobble once per cast. ✓

### summonUnit Execution
- **Lingo** (modSpellMultistage.txt:372–393, armyMaster.createUnitFromSummonSpell): 
  - selectTier chooses payload type
  - createUnitFromSummonSpell(me.big) spawns payload on its OWN team (read from character data)
  - owner gains +0.5 experience
- **TypeScript** (summon.ts:55–79):
  - selectTier picks type
  - Try armyMaster.createUnit(team, type, x, y) if reserve exists
  - Fall back to game.spawnUnit(type, x, y) — reads team from actor data ✓
  - owner.send("gainXp", 0.5) awards experience ✓

### Team Assignment (Undead Hierarchy)
- **Lingo**: summonPayload calls armyMaster.createUnitFromSummonSpell with the spell actor; the summoned unit inherits its OWN #team from character data (`#undead`).
- **TypeScript**: 
  - summon.ts:75 calls game.spawnUnit(type, x, y) for fresh units
  - archetypes.ts:54–59 reads team from actor definition: `team = d["team"] ?? "#monsters"`
  - skelitonFootSoldier et al. each carry `team: "#undead"` in generated data ✓
  - All 8 units verified: skelitonFootSoldier, skelitonHead, skelitonArm, skelitonTorsoTank, skelitonSword, skelitonLowerLeg, skelitonUpper, skelitonLord → all `team: "#undead"` ✓

### CPU Summon (skelitonUpper) Casting
- **Lingo**: modSpellMultistage charges to calcAttackChargeMax once, summonPayload fires on release.
- **TypeScript** (control.ts:565–571):
  - chargeMaxOf(ca, mana, game.rng) computes wobbled ceiling once per cast (one-shot cooldown-gated)
  - summonUnit called immediately at release ✓

## Verification Checklist

✓ Spell data matches exactly (8-tier multistage, charge thresholds 10–35)  
✓ Spell animType is `#magic`  
✓ Spell explodeFunction is `#summonUnit`  
✓ randomSummon flag is enabled  
✓ Multistage tiers sorted ascending by chargeRequired  
✓ Tier selection logic identical (highest affordable tier)  
✓ randomSummon wobble formula faithful (random(20)/17 + random(tier1) ± 1)  
✓ Wobble baked once per cast (calcAttackChargeMax→chargeCeil)  
✓ Wobble wired to game.rng for both player and CPU  
✓ Summoned units each carry own `team: #undead`  
✓ Team routing respects actor definitions (no caster-team bleed)  
✓ Experience awarded correctly (+0.5 to caster on summon)  
✓ CPU skelitonUpper correctly wields skelitonSummon spell  

## Conclusion

**CLEAN** — The skelitonSummon spell is behaviorally faithful. All charge logic, tier selection, randomSummon wobble, and team assignment are correctly implemented in the port. Multistage data is accurate and tiers are correctly sorted. The wobble is wired to game.rng for both player and CPU casts, baked once per cast as expected.
