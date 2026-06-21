# Behavioral Parity Audit: greyGhost

## Actor Profile

| Property | Original | Port | Status |
|----------|----------|------|--------|
| **objType** | #objCPUCharacter | #objCPUCharacter | ✓ |
| **AiType** | #objAiCPUSpellCaster | #objAiCPUSpellCaster | ✓ |
| **Team** | #undead | #undead | ✓ |
| **Weapon** | #undeadSummon | #undeadSummon | ✓ |
| **Energy** | 100 | 100 | ✓ |
| **Strength** | 1 | 1 | ✓ |
| **Dexterity** | 1 | 1 | ✓ |
| **Mana Capacity** | 20 | 20 | ✓ |
| **Mana Flow** | 3 | 3 | ✓ |
| **Mana Regeneration** | 0.5 | 0.5 | ✓ |
| **Walk Speed** | 1 | 1 (× 0.6 px/tick conversion) | ✓ |
| **Inertia** | 70 | 70 | ✓ |
| **Charge Offset** | #side (point 8,0) | #side (point 8,0) | ✓ |
| **Collision Detection** | false | false | ✓ |
| **Mini-Map Status** | #inf | #inf | ✓ |
| **Die Sound** | "greyGhost_die" | "greyGhost_die" | ✓ |

---

## Weapon Behavior: #undeadSummon (Spell Actor)

| Property | Original | Port | Status |
|----------|----------|------|--------|
| **animType** | #magic | #magic | ✓ |
| **explodeFunction** | #summonUnit | #summonUnit | ✓ |
| **chargeMax (attack)** | 36 | 36 | ✓ |
| **chargeMaxModifier** | 1 (default) | 1 (default) | ✓ |
| **chargeMaxBasic** | 0 (default) | 0 (default) | ✓ |
| **Effective chargeMax** | min(36, 20×1+0) = 20 | min(36, 20×1+0) = 20 | ✓ |
| **chargeStart** | 0 | 0 | ✓ |
| **chargeSpeed** | 0.6 | 0.6 | ✓ |
| **Effective chargeSpeed** | 0.6 × 3 = 1.8 | 0.6 × 3 = 1.8 | ✓ |
| **randomSummon** | true | true | ✓ |
| **residentTeamCategory** | #enemies | #enemies | ✓ |
| **reach** | 9999 (ranged/spell) | 9999 (ranged/spell) | ✓ |

---

## Multistage Summon Tiers

| Unit Type | Charge Required | Summonable by greyGhost? |
|-----------|-----------------|------------------------|
| skeletonWarrior | 15 | YES (≤ 20) |
| skeletonArcher | 17 | YES (≤ 20) |
| skeletonThrower | 20 | YES (= 20) |
| greyGhost | 25 | NO (> 20) |
| undeadDragon | 29 | NO (> 20) |
| necromancer | 33 | NO (> 20) |
| darkMage | 35 | NO (> 20) |
| skelitonLord | 38 | NO (> 20) |

All tiers verified in port: `port/src/generated/data.json` → `act_undeadSummon.attack.multistage`.

---

## Behavioral Parity: CPU Spellcaster Casting

| Behavior | Original Logic | Port Implementation | Status |
|----------|-----------------|---------------------|--------|
| **Spellcaster AI Mode** | #objAiCPUSpellCaster → optimumPosition (bullet-dodge, kite) | CpuAI.updateMoveToOptimumPosition() + EnemyArchetype spawning with dodgesBullets flag | ✓ |
| **Weapon Resolution** | greyGhost.weapon = #undeadSummon → resolves to magic attack | spawnEnemy() line 155-162: routes spellcaster weapon correctly | ✓ |
| **Attack Type** | animType #magic → ranged AI mode | archetype.ts line 169: isMagic = animType === "#magic" | ✓ |
| **Casting Entry** | objAiAttack.attack() → me.attackMagic() → me.chargeMagic() | CpuAI.attack() → chargeMagic path (line 530+) | ✓ |
| **Charge Loop** | pChargeCounter increments until chargeMax or spell charged | CpuAI attack loop: cooledDown() → attack() fires when ready | ✓ |
| **Summon Dispatch** | modSpellMultistage.doExplodeFunction() → summonPayload() → armyMaster.createUnit() | control.ts line 544-547: detects explodeFunction=#summonUnit → summonUnit() call | ✓ |
| **Summon Tier Selection** | selectPayload(): highest tier ≤ current charge | summon.ts selectTier(): highest tier ≤ charge ✓ | ✓ |
| **Summoned Unit Team** | team = spell.getTeam() (caster's team = #undead) | summon.ts line 45: team = owner.getTeam() = #undead ✓ | ✓ |
| **Summoned Unit Spawn** | spawnUnit(type, x, y) routes by team → #undead enemy | archetypes.ts spawnUnit(): reads unit's #team = #undead, marks as "enemy" type | ✓ |

---

## Parity Summary

**All properties and behaviors verified.** greyGhost correctly:
- Resolves as a CPU spellcaster with #objAiCPUSpellCaster
- Carries the #undeadSummon weapon with #magic attack, #summonUnit explodeFunction
- Calculates charge ceiling = 20 (mana 20 × mod 1 + basic 0, capped by attack chargeMax 36)
- Routes summon dispatch through summonUnit() with proper multistage tier selection
- Spawns undead units on #undead team (matching original createUnitFromSummonSpell logic)
- Implements spellcaster positioning (bullet-dodge, kite around target)

**CLEAN — No gaps detected.**

---

## Verification Points

### Data Files
- **Original**: casts/data/act_greyGhost.txt (inherit #CPUCharacter)
- **Original**: casts/data/act_undeadSummon.txt (#summonUnit spell actor)
- **Port**: port/src/generated/data.json (resolved act_greyGhost + act_undeadSummon)

### Implementation Files
- **Port**: port/src/entities/archetypes.ts (spawnEnemy, spawnUnit, EnemyArchetype)
- **Port**: port/src/components/control.ts (CpuAI.attack, summonUnit dispatch)
- **Port**: port/src/components/summon.ts (selectTier, summonUnit team resolution)
- **Port**: port/src/components/charge.ts (chargeMaxOf, chargeSpeedOf)
- **Port**: port/src/data/registry.ts (STRUCT_ATTACK defaults)

### Original Files
- **Original**: casts/script_objects/objAiCPUSpellCaster.txt (spellcaster AI mode)
- **Original**: casts/script_objects/modSpellMultistage.txt (selectPayload, summonPayload)
- **Original**: casts/master_objects/armyMaster.txt (createUnitFromSummonSpell)
- **Original**: casts/master_objects/structMaster.txt (structAttack defaults)
