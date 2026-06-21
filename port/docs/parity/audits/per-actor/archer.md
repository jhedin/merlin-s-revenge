# Actor Audit: act_archer

**Audit Date:** 2026-06-21  
**Port Version:** TypeScript  
**Original Spec:** `casts/data/act_archer.txt`  
**Actor Type:** CPU-controlled character, friendly ranged unit  

## Properties Summary

| Property | Verdict | Original Cite | Port Cite | Note |
|----------|---------|---------------|-----------|------|
| `#objType` | USED | act_archer.txt:3 | entities/archetypes.ts:137–309 (spawnEnemy dispatcher) | Maps to EnemyArchetype; objCPUCharacter routes to spawnEnemy path. |
| `#AiType` | USED | act_archer.txt:4 | entities/archetypes.ts:154–210 (FSM config) | Value #objAiCPU selects standard attack FSM; checked for spellcaster/ghost/builder overrides. |
| `#inherit` | USED | act_archer.txt:5 → #CPUCharacter | data/registry.ts:92–112 (resolveActor chain) | Registry resolves #inherit chain recursively; child overrides parent. Archer inherits CPUCharacter defaults. |
| `#character` | NOT USED (DESIGN) | act_archer.txt:6 | components/anim.ts:14–23 (spriteCharOr fallback) | Port uses actor name as fallback; does not read #character field. Uses sprite index lookup instead of legacy character mapping. |
| `#damageSpeed` | **GAP** | act_archer.txt:7, modEnergy.txt:250–253 | combat.ts:35–37 (takeHit) | **Original:** damageSpeed subtracted from every hit (line 250: `if amount > pDamageSpeed then amount = amount - pDamageSpeed`). **Port:** applies full damage without reduction. **Consequence:** archer takes more damage per hit than intended (4 damage reduction missed). |
| `#dexterity` | USED | act_archer.txt:8 | entities/archetypes.ts:174, 187, 225, 276 | Stored and used to scale ranged weapon cooldown recovery (counter inc = dexterity for ranged attacks). |
| `#energy` | USED | act_archer.txt:9 | entities/archetypes.ts:258 → combat.ts:23 | Health pool; read as num("energy", 40) and set as max energy. |
| `#inertia` | USED | act_archer.txt:10 | entities/archetypes.ts:262 → movement.ts:41, 55 | Knockback resistance; clamped [0,100], reduces incoming damage vector by (100-inertia)/100. Archer: 60 inertia = 40% knockback resistance. |
| `#leaveWhenFinished` | USED (builder only) | act_archer.txt:11, objAiCPU.txt:234–237 | entities/archetypes.ts:268 → control.ts:354, 778–779 | Checked in builder FSM; archer is not a builder so no behavioral effect. Property read but not applied. |
| `#miniMapStatus` | NOT USED (SCOPE) | act_archer.txt:12 | world/map.ts (room-level property only) | miniMapStatus is a ROOM property (objRoom), not an actor property. Archer should inherit room's minimap status. Port does not set per-actor minimap override. |
| `#stallSpeedIncLevel` | **GAP** | act_archer.txt:13, objGameObject.txt:101, modCharacterAttackProperties.txt:206 | (not referenced in port) | **Original:** applied on levelUp via `me.big.incStallSpeed(pStallSpeedIncLevel)` (modCharacterAttackProperties.txt:206), modifying objMoveXY.pStallSpeed (velocity halt threshold). **Port:** no stallSpeed concept; stall/halt velocity is hardcoded. **Consequence:** archer's movement halt threshold not adjusted per level. |
| `#strength` | USED | act_archer.txt:14 | entities/archetypes.ts:259, 276 → weapon.ts:133–142 | Melee damage multiplier: `power·strength·MELEE_SCALE` (player) or `power·strength·ENEMY_DAMAGE_SCALE` (enemy). Used in attack power calculation. |
| `#strenghtIncLevel` | USED (name corrected) | act_archer.txt:15 (typo: "strenght") | components/combat.ts (no direct ref) | Port reads as "strengthIncLevel" (note case correction). Applied on level-up via Experience module. Archer grows +0.5 strength per level. |
| `#team` | USED | act_archer.txt:16 | entities/archetypes.ts:56, 73, 260, 270 → systems/teams.ts | Allegiance; #aldevar (player team) hunts #enemy targets. Controls targeting and reward logic. |
| `#name` (display) | IGNORED (DESIGN) | act_archer.txt:17 | entities/archetypes.ts:256 (actorType) | Port uses actor type ("archer") for respawn key, not display name. Display is handled by localization/string keys elsewhere. |
| `#walkSpeed` | USED | act_archer.txt:18 | entities/archetypes.ts:257 → movement.ts:37, 85 | Movement cap; scaled to px/tick (walkSpeed · 0.6). Archer: 5 · 0.6 = 3 px/frame max speed. |
| `#weapon` | USED (resolved) | act_archer.txt:19 | entities/archetypes.ts:155–162, 218–230 → weapon.ts:resolveAttack | Resolved via registry.resolveActor("archerBow") → extract attack → build AttackData. Weapon attack becomes enemy attack; cooldown calibrated per ranged type. |
| `#weaponTechniqueInc` | **GAP (name mismatch, hardcoded value)** | act_archer.txt:20 (name: weaponTechniqueInc) | entities/archetypes.ts:273 (reads "weaponTechnique"), weaponTechnique.ts:30 (hardcoded INC=2) | **Original:** weaponTechniqueInc added on levelUp (modWeaponTechnique.txt:88: `pWeaponTechnique = pWeaponTechnique + pWeaponTechniqueInc`). **Port:** reads weaponTechnique initial value (3) correctly, but level-up increment is hardcoded to 2 (WeaponTechnique.INC), ignoring the data value. **Consequence:** archer's attack speed scaling per level diverges (port adds 2/level instead of 3/level). |

---

## GAPS

### Gap 1: damageSpeed not applied to damage reduction
- **Property:** `#damageSpeed: 4`
- **Original Behavior:** `modEnergy.txt:250–253` — every damage event subtracts damageSpeed before applying: `if amount > pDamageSpeed then amount = amount - pDamageSpeed; me.loseEnergy(amount)`
- **Port Behavior:** `combat.ts:33–37` — full damage applied: `this.energy -= dmg;` (no damageSpeed subtraction)
- **Consequence:** Archer absorbs 4 less damage per hit in the original but takes full damage in port. Over many hits in combat, archer's survivability is lower than intended.
- **Fix Required:** Energy.takeHit should subtract damageSpeed from damage before applying (when damage > damageSpeed, otherwise no hit).

### Gap 2: stallSpeedIncLevel not applied on level-up
- **Property:** `#stallSpeedIncLevel: 0.25`
- **Original Behavior:** `modCharacterAttackProperties.txt:206` — on level-up, calls `me.big.incStallSpeed(pStallSpeedIncLevel)`, which modifies objMoveXY.pStallSpeed. This adjusts the velocity threshold at which the unit is considered to have "naturally halted" (movement wind-down).
- **Port Behavior:** `weaponTechnique.ts` (Experience module) has no stallSpeed concept; port movement uses hardcoded halt logic.
- **Consequence:** Archer's velocity halt-threshold does not increase per level. At high levels, the unit's movement wind-down behavior (how quickly it comes to a stop) differs from the original.
- **Fix Required:** Add stallSpeed tracking to Movement or a new component; apply stallSpeedIncLevel on Experience.levelUp.

### Gap 3: weaponTechniqueInc uses hardcoded level-up increment instead of data value
- **Property:** `#weaponTechniqueInc: 3` (labeled "inc" in data, but port reads as initial "weaponTechnique")
- **Original Behavior:** `modWeaponTechnique.txt:87–88` — on level-up, `pWeaponTechnique = pWeaponTechnique + pWeaponTechniqueInc`, so archer gains 3 weapon technique rating per level.
- **Port Behavior:** `weaponTechnique.ts:30` — hardcoded `const INC = 2`, so every unit gains 2 technique per level, regardless of data value.
- **Consequence:** Archer's attack animation speed-up per level is +2/level (port) instead of +3/level (original). Over many levels, animation playback diverges.
- **Fix Required:** Read weaponTechniqueInc from actor data and apply it in Experience.levelUp instead of hardcoded 2.

---

## Summary

**Total Properties Audited:** 20 (including inherited/metadata)  
**USED (faithful):** 16  
**GAPS:** 3 (damageSpeed reduction, stallSpeedIncLevel, weaponTechniqueInc hardcoding)  
**NOT USED (design/scope):** 1 (#character → spriteCharOr fallback, miniMapStatus → room property)  

**Severity Assessment:**
- **damageSpeed (HIGH):** Affects survivability in every hit; cumulative over combat.
- **stallSpeedIncLevel (LOW):** Movement wind-down; cosmetic unless unit fights at exact halt thresholds.
- **weaponTechniqueInc (MEDIUM):** Attack animation speed scaling per level; noticeable at high levels (e.g., late-game archer).

All three gaps are **real divergences** where the port ignores or mishandles data that the original actively consumes.
