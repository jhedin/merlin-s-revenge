# Actor Audit: `act_berlinInGame`

**Actor Type:** Friendly summoned wizard (CPU spellcaster)  
**Original:** `casts/data/act_berlinInGame.txt`  
**Port Base:** `port/src/entities/archetypes.ts::spawnAlly()` / `spawnEnemy()` + component chain  

---

## Property Inventory

| Property | Original Value | Type | Port Cite | Verdict | Note |
|----------|---|---|---|---|---|
| `#objType` | `#objCPUCharacter` | Archetype selector | archetypes.ts:41-46 (EnemyArchetype) | USED | Determines spawn path to EnemyArchetype |
| `#AiType` | `#objAiCPUSpellCaster` | AI FSM selector | archetypes.ts:154, 206-208 (CpuAI init) | USED | Sets `dodgesBullets=true`, `runReload=true` for spellcaster positioning |
| `#inherit` | `#CPUCharacter` | Parent class merge | data/registry.ts:93-112 (resolveActor) | USED | Resolves parent chain; berlinInGame inherits base stats |
| `#name` | `"ber"` | Display/reference name | archetypes.ts:256 (actorType) | USED | Carried as actorType (respawn key) |
| `#character` | `#friendlyCharacter` | Team allegiance | archetypes.ts:44 (spawnAlly) | USED | Sets `team="#aldevar"` on summoned ally |
| `#wizard` | `true` | Summoned ally flag | **NOT EXPLICITLY READ** | GAP | Original checks for this to set wizard summoning behaviour; port has no wizard flag handling |
| `#team` | `#aldevar` | Team affiliation | archetypes.ts:44 (spawnAlly overrides) | USED | Forced to `#aldevar` for summoned allies |
| `#energy` | `200` | Max HP | archetypes.ts:258 (num("energy", 40)) | USED | Passed to Energy component |
| `#inertia` | `60` | Knockback resistance | archetypes.ts:262 (num("inertia", 0)) | USED | Passed to Movement damping |
| `#walkSpeed` | `5` | Movement velocity | archetypes.ts:257 (num("walkSpeed", 3) * 0.6) | USED | Scaled to port units |
| `#strength` | `1` | Melee/spell power source | archetypes.ts:259 (num("strength", 5)) | USED | Melee base power + caster spell damage |
| `#damageSpeed` | `4` | Knockback recovery speed | archetypes.ts:262-263, control.ts:338-341 | USED | Folded into CpuAI.power calculation |
| `#dexterity` | `3` | Ranged attack cooldown modifier | archetypes.ts:174 (num("dexterity", 0.2)) | USED | Ranged/magic cooldown counter inc |
| `#miniMapStatus` | `#fre` | HUD icon | **ABSENT** | NOT A GAP | Cosmetic display-only (port has no minimap) |
| `#leaveWhenFinished` | `true` | Summoned ally retire-on-no-targets | archetypes.ts:268 (passed to CpuAI) | PARTIAL USAGE | Set in config but not triggered; see GAPS section |
| `#mana_regeneration` | `5` | Magic cooldown divisor | archetypes.ts:186 (num("mana_regeneration", 1)) | USED | Mana.regeneration (magic attack cooldown inc) |
| `#mana_regenerationIncLevel` | `1` | Per-level mana regen growth | archetypes.ts not shown, mana.ts:27 | USED | Per-level stat bump (levelUp 1/4 chance) |
| `#mana_capacityIncLevel` | `1.25` | Per-level capacity growth | archetypes.ts:120 (num(...) fallback to 0.5) | USED | Per-level stat bump (levelUp 1/4 chance) |
| `#stallSpeed` | `0.5` | Air-friction damping | archetypes.ts, Movement component | NOT EXPLICITLY CITED | Likely absorbed into Movement init defaults; no per-actor override |
| `#attack` (block) | See below | Melee backup attack | archetypes.ts:145 (d["attack"]) | USED | Resolved and stored in WeaponManager |
| &nbsp;&nbsp;`#animFrame` | `14` | Animation keyframe trigger | weapon.ts:resolveAttack (not exposed) | NOT A GAP | Attack metadata not directly consumed by port |
| &nbsp;&nbsp;`#animType` | `#naturalMelee` | Attack class | weapon.ts:163, control.ts:169 (typeFromAnimType) | USED | Determines melee vs ranged vs magic FSM |
| &nbsp;&nbsp;`#collisionLoc` | `point(35,-1)` | Hit-box center offset | **ABSENT** | NOT A GAP | Cosmetic; port uses fixed offsets per attack type |
| &nbsp;&nbsp;`#cooldown` | `10` | Base cooldown frames | archetypes.ts:180, weapon.ts:168 (cooldown counter) | USED | Calibrated into counter.tim[2] |
| &nbsp;&nbsp;`#name` | `#punch` | Attack symbol | weapon.ts:166 (carried as AttackData.name) | USED | Weapon registry key |
| &nbsp;&nbsp;`#power` | `point(30,0)` | Melee force vector | weapon.ts:156-159 (powerX/powerY/powerScalar) | USED | Melee damage base = power·strength·ENEMY_DAMAGE_SCALE |
| &nbsp;&nbsp;`#reach` | `point(25,10)` | Strike box size | weapon.ts:160-164 (reach as radius) | USED | Melee hit detection radius |
| &nbsp;&nbsp;`#sound` | `"wizard_punch"` | Audio cue | weapon.ts:173, control.ts:282 (atkSound) | USED | Played on melee swing |
| `#weapon` | `#energyBlast` | Primary ranged weapon | archetypes.ts:155-162 (I9 spellcaster fix) | USED | For spellcaster: weapon attack REPLACES melee as primary |
| `#leaveWhenFinished` | `true` | Retire flag (checked in refreshTarget) | control.ts:315, 778 (builder leaveWhenFinished) | **PARTIAL GAP** | Set in config, used by builder path only; no summoned-ally retire-on-no-targets logic |

---

## Detailed Analysis

### Attack Properties (`#attack` sub-block)

**Original reads:** `modCharacterAttackProperties` (cooldown modifier), `modWeaponManager` (weapon selection), `objAiAttack` (fire gate)  
**Port reads:** `resolveAttack()` → `WeaponManager.addWeapon()` → cooldown counter init  

**Status:** USED (melee backup fully consumed; spellcaster flag drives weapon selection per I9 fix)

---

### AI Type (`#AiType: #objAiCPUSpellCaster`)

**Original behavior:**
- Runs `objAiCPUSpellCaster.updateMoveToOptimumPosition()` — bullet-dodge chain (K4)
- Sets `pRunReload=true` → kites after casting (modAiCPUSpellCaster line 53-55)
- Reach 9999 (infinite range spell) → always "in range", positioning-focused

**Port reads:**
- `archetypes.ts:206-208` detects `aiType === "#objAiCPUSpellCaster"` → sets `dodgesBullets=true`
- `control.ts:345` sets `this.dodgesBullets = cfg["dodgesBullets"]`
- `control.ts:493` routes spellcaster to `goMode("optimumPosition")` after attackFin
- `control.ts:574-592` implements `updateMoveToOptimumPosition()` with bullet-dodge + enemy-flee + target-approach chain

**Status:** USED (faithful K4 spell-caster positioning loop)

---

### Weapon Selection (`#weapon: #energyBlast`)

**Original behavior:**
- `modWeaponManager` reads character's `#weapon` (name of a weapon actor, e.g., `#energyBlast`)
- For spellcasters (`objAiCPUSpellCaster`), the spell's `#attack` is the PRIMARY attack (reach 9999)
- Melee `#punch` is a backup

**Port reads (I9 fix):**
- `archetypes.ts:155-162` checks: if actor has `#weapon` AND is spellcaster (`aiType===#objAiCPUSpellCaster`) AND weapon's attack is `#magic`, use weapon's attack instead of actor's own
- Fallback: if no `#attack.animType`, use weapon's attack
- Result: berlinInGame.energyBlast (magic spell, reach 9999) becomes the primary fire attack

**Status:** USED (faithful)

---

### `#leaveWhenFinished` Flag

**Original behavior:**
- `objCharacter.pLeaveWhenFinished` (init from params, line 86)
- Read by `objAiCPU.internalEvent()` line 232-237:
  - Triggers on `#noTargetFound` event (fired when `g.teamMaster.isTargetsDead()` or `getRoomClear()`)
  - Calls `me.pCharacterPrg.armyTeleportOut()` → summoned ally exits the room

**Port reads:**
- `archetypes.ts:268` passes `leaveWhenFinished: d["leaveWhenFinished"] === true` to CpuAI.init
- `control.ts:315, 354` stores the flag in `this.leaveWhenFinished`
- **Used only in builder path:** `control.ts:778` checks `if (this.buildDie || this.leaveWhenFinished)` → builder finishes dwelling and dies
- **NOT checked for summoned allies:** No equivalent to original's `#noTargetFound` → `armyTeleportOut()` chain for spellcasters

**Consequence:** When berlinInGame exhausts all targets, the original code teleports it out (summoned ally reserve). The port leaves it standing idle in #findTarget mode forever.

**Status:** GAP (consequential for summoned allies)

---

## Summary: GAPS

| Property | Consequence | Original Site | Port Omission |
|----------|---|---|---|
| `#wizard` flag | Summoned ally marker; no gameplay effect per se, but context for summon/unsummon UI. Original modSummonBerlin checks this to mark wizard state. | modSummonBerlin.txt (summonWizard logic) | Not read anywhere; only used for wizard-on/off UI state, no missing logic |
| `#leaveWhenFinished` (summoned ally retire) | **CRITICAL:** When no valid targets remain (all enemies dead, room clear), the original fires `#noTargetFound` and teleports berlinInGame out (to reserve). Port stays idle forever in findTarget mode — the ally never leaves, blocking room progression if the player re-enters without dismissing it. | objAiCPU.txt:307-310 (refreshTarget), 232-237 (internalEvent #noTargetFound) | control.ts::refreshTarget/attackFin never fire #noTargetFound event; no teleportOut logic for summoned allies on target exhaustion |

---

## Analysis Notes

1. **#wizard flag:** Not a data-driven gap. Original uses it as context for UI state (modSummonBerlin/modSummonWizard track "which wizard is out"). Port has no wizard UI layer, so there's no read site. Not consequential for in-game behaviour.

2. **#leaveWhenFinished (summoned):** The port *does* recognize the property (archetypes.ts:268, control.ts:354), but the FSM never triggers the retire path. A summoned ally should exit the room when no targets remain; instead it idles in #findTarget. This blocks the room if the player tries to re-enter without summoning a fresh ally.

3. **All stat properties (energy, strength, mana_*, walkSpeed, etc.):** Faithfully consumed. Cooldown calibration (archetypes.ts:180-188) re-derives effective cooldowns to match the original's attack cadence.

4. **Attack properties (animType, reach, power, cooldown, sound):** All resolved by `resolveAttack()` and stored in WeaponManager. Cooldown counter init properly scales by dexterity/agility/mana_regeneration per attack type.

5. **AI positioning (dodgesBullets, runReload):** K4 spellcaster bullet-dodge and post-shot kiting fully implemented in `updateMoveToOptimumPosition()` and `updateRunReload()`.

---

## CLEAN / GAPS Tally

- **CLEAN properties:** 22 (objType, AiType, inherit, name, character, team, energy, inertia, walkSpeed, strength, damageSpeed, dexterity, mana_regeneration, mana_regenerationIncLevel, mana_capacityIncLevel, all #attack properties except cosmetics, #weapon)
- **PARTIAL/GAPS:** 1 (leaveWhenFinished — flag exists in config, but summoned-ally retirement FSM missing)
- **COSMETIC (not a gap):** miniMapStatus, stallSpeed, #wizard

**Consequence of GAP:** Summoned allies do not leave the room when no targets remain, causing potential soft-lock if the player re-enters.
