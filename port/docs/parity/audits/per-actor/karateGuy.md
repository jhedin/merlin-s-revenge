# Audit: karateGuy (act_karateGuy.txt → port/src)

## Property Coverage

| Property | Original Value | Port Read | Status |
|----------|---|---|---|
| `objType` | `#objCPUCharacter` | ✓ (spawnEnemy path) | OK |
| `AiType` | `#objAiCPU` | ✓ (control.ts CpuAI) | OK |
| `inherit` | `#CPUCharacter` | ✓ (resolved) | OK |
| `attack.animtype` | `#naturalMelee` | ✓ (resolveAttack) | OK |
| `attack.damageMultiplier` | `100` | ✓ (archetypes.ts:197, weapon.ts) | OK |
| `attack.collisionLoc` | `point(4,0)` | CATALOGUED | OK |
| `attack.cooldown` | `0` | ✓ (archetypes.ts:180-188 derives effective) | OK |
| `attack.hits` | `[#teamMembers, #teamBuildings]` | ✓ (archetypes.ts:293) | OK |
| `attack.name` | `#punchKick` | ✓ (resolveAttack) | OK |
| `attack.power` | `point(0.01,0)` | ✓ (archetypes.ts:253-257) | OK |
| `attack.sound` | `"wizard_punch"` | ✓ (archetypes.ts:288, control.ts:594) | OK |
| `damageSpeed` | `3` | CATALOGUED | OK |
| `dexterity` | `10` | ✓ (archetypes.ts:174, cooldown calc) | OK |
| `dieSound` | `#none` | ✓ (archetypes.ts:295) | OK |
| `energy` | `200` | ✓ (archetypes.ts:264) | OK |
| `experienceImWorth` | `10` | ✓ (archetypes.ts:296) | OK |
| `eyestrain` | `25` | CATALOGUED | OK |
| `inertia` | `50` | ✓ (archetypes.ts:268) | OK |
| `startingLevel` | `0` | ✓ (archetypes.ts:313-314) | OK |
| `strength` | `10` | ✓ (archetypes.ts:265, control.ts:340, 588) | OK |
| `team` | `#karate` | ✓ (archetypes.ts:266) | OK |
| `name` | `"karateGuy"` | ✓ (archetypes.ts:262) | OK |
| `walkSpeed` | `4` | ✓ (archetypes.ts:263) | OK |
| `weaponTechnique` | `0` | ✓ (archetypes.ts:279) | OK |

## Behavioral Correctness

### 1. **Team Allegiance (#karate)**
- **Original** (casts/data/tem_karate.txt:7): `#karate` hates `[#aldevar, #cave, #monsterSummon, #goblins, #magicalAlliance, #ninja, #undead, #orcs, #village]`
- **Port** (port/src/generated/data.json): Identical hates tier
- **Verification**: `spawnEnemy` (archetypes.ts:55-56) reads `team: str("team", "#monsters")` → uses karate; `TeamMaster.calcTargetTeams` (teams.ts:86-97) resolves hates dynamically per attack
- **Status**: ✓ CLEAN

### 2. **Melee AI Attack (#objAiCPU)**
- **Original** (casts/data/act_karateGuy.txt:4): `#AiType: #objAiCPU` → committed-target FSM (findTarget → moveToAttack → attack)
- **Port** (port/src/components/control.ts:285–289): "committed-target decision FSM. A referenced controller (objAiCPU) whose update() drives modes findTarget -> moveToAttack -> attack -> attackFin"
- **Port** (port/src/components/control.ts:518–597): `attack(m, dx, dy, target)` melee path (line 580–591) → `impactMeleeAttack` with `meleeHitFn`
- **Status**: ✓ CLEAN

### 3. **Melee Attack Resolution (#naturalMelee, #hits)**
- **Original** (casts/data/act_karateGuy.txt:9, 13): `#animType: #naturalMelee` + `#hits:[#teamMembers, #teamBuildings]` → area resolution
- **Port** (port/src/systems/teams.ts:277–282):
  - `impactMeleeAttack(attacker, hitFn)` reads `tg.hits` from Targeting component
  - Lines 266–267: filters candidates by `hits.includes(this.roleOf(u))` for both unit types
  - Role filtering for `#teamMembers` and `#teamBuildings` explicitly enforced
- **Port** (archetypes.ts:292–293): karateGuy's resolved `hits: ["#teamMembers", "#teamBuildings"]` passed to `impactMeleeAttack`
- **Power calc** (control.ts:588, weapon.ts:136–145): `enemyMeleeBasePower(ca, strength)` × `damageMultiplier` → faithful knockback vector
- **Status**: ✓ CLEAN

### 4. **Ranged AI Gating**
- karateGuy's `#attack.animType` is `#naturalMelee` (not ranged)
- **Port** (archetypes.ts:163–170): `ranged = (animType === "#weaponRanged" || animType === "#magic" || animType === "#naturalRanged")`
- karateGuy is not ranged → `ranged=false` ✓
- **Port** (control.ts:580–591): `CpuAI.ranged=false` → takes melee path, not ranged attack path
- **Status**: ✓ CLEAN

### 5. **Cooldown Derivation**
- **Original** (casts/data/act_karateGuy.txt:12): `#cooldown: 0` for karateGuy
- **Port** (archetypes.ts:180–188): Re-derives effective cooldown (B2 plan §f.3):
  ```
  rawCooldown = 0 (from data)
  framesWanted = max(1, 0 + 6) = 6  [melee adds 6]
  counterInc = agility (melee) = 1
  effectiveCooldown = round(6 * 1 + 1) = 7
  ```
- Cooldown is re-derived, not directly read (design choice per B2 plan)
- **Status**: ✓ CLEAN (documented non-issue: attack-cooldown rate re-derives by design)

### 6. **Movement & Speed**
- **Original** (casts/data/act_karateGuy.txt:29): `#walkSpeed: 4`
- **Port** (archetypes.ts:263): reads walkSpeed, multiplied by 0.6 for px/tick unit conversion
- **Status**: ✓ CLEAN (walkType/pathfinding are catalogued non-issues)

### 7. **Death Behavior**
- **Original** (casts/data/act_karateGuy.txt:20): `#dieSound: #none`
- **Port** (archetypes.ts:295): reads dieSound
- **Port** (archetypes.ts:36): EnemyArchetype includes Grave module → handles corpse/splashGraveOn
- **Status**: ✓ CLEAN

## Family Parity
Verify karateGuy matches the karate family pattern (act_sumo.txt, act_kongFuChicken.txt):

| Actor | animType | hits | strength | team |
|-------|----------|------|----------|------|
| **karateGuy** | #naturalMelee | [#teamMembers, #teamBuildings] | 10 | #karate |
| **sumo** | #naturalRanged | N/A (ranged) | 20 | #karate |
| **kongFuChicken** | #naturalMelee | [#teamMembers, #teamBuildings] | 10 | #karate |

karateGuy and kongFuChicken are both melee, karate team, identical hits target ✓

## Conclusion

No behavioral divergences detected. All properties are read from the resolved actor data:
- **Property Coverage**: 24/24 properties accounted for (21 read, 3 catalogued non-issues)
- **AI Logic**: Melee FSM, target commitment, team allegiance fully ported
- **Attack Resolution**: Area sweep over #hits roles with strength-scaled damage, all data-driven
- **Design Changes**: Effective cooldown re-derives per B2 plan (not a behavioral gap)

ACTOR=karateGuy | CLEAN
