# Actor Parity Audit: #character

**Scope**: Base abstract character template (`act_character`). Never placed directly; only inherited by concrete actors like `act_blackOrc`, `act_warrior`, etc. (all via `act_CPUCharacter`).

**Inheritance Chain**: `act_character` → `#actor` (`act_actor`)

---

## 1. Data-Level Defaults (Explicit in Cast Files)

### From `/home/user/merlin-s-revenge/casts/data/act_character.txt`

| Property | Value | Type | Port Data | Status |
|----------|-------|------|-----------|--------|
| `agility` | 1 | integer | ✓ present in `act_character.data` | ✓ MATCH |
| `dexterity` | 1 | integer | ✓ present in `act_character.data` | ✓ MATCH |
| `eyestrain` | 0 | integer | ✓ present in `act_character.data` | ✓ MATCH |
| `mana_burst` | 1 | integer | ✓ present in `act_character.data` | ✓ MATCH |
| `mana_capacity` | 10 | integer | ✓ present in `act_character.data` | ✓ MATCH |
| `mana_flow` | 1 | integer | ✓ present in `act_character.data` | ✓ MATCH |
| `mana_regeneration` | 1 | integer | ✓ present in `act_character.data` | ✓ MATCH |
| `strength` | 1 | integer | ✓ present in `act_character.data` | ✓ MATCH |

### From `/home/user/merlin-s-revenge/casts/data/act_actor.txt` (parent)

| Property | Value | Type | Port Data | Status |
|----------|-------|------|-----------|--------|
| `actorType` | `#typ` | symbol | ✓ present in `act_actor.data` | ✓ MATCH |
| `initLoc` | `point(random(450), 300)` | point | ✓ present in `act_actor.data` | ✓ MATCH |
| `initVect` | `point(0,0)` | point | ✓ present in `act_actor.data` | ✓ MATCH |
| `layerZ` | `gGameObjectLayer` | global ref | ✓ present in `act_actor.data` | ✓ MATCH |
| `masterPrg` | `#actorMaster` | symbol | ✓ present in `act_actor.data` | ✓ MATCH |
| `miniMapStatus` | `#inf` | symbol | ✓ present in `act_actor.data` | ✓ MATCH |
| `startOffset` | `point(-16, -16)` | point | ✓ present in `act_actor.data` | ✓ MATCH |
| `team` | `#chatters` | symbol | ✓ present in `act_actor.data` | ✓ MATCH |

---

## 2. Runtime-Applied Defaults (Implicit in Script Objects)

These defaults are programmatically set during instantiation in the Lingo game via `objCharacter.new()` and parent `objGameObject.new()`, but **NOT stored in the .txt data files**. They must be applied by the port when spawning instances.

### From `/home/user/merlin-s-revenge/casts/script_objects/objCharacter.txt` (lines 28–38, `new` handler)

| Property | Value | Type | Port Behavior | Status |
|----------|-------|------|-----------|--------|
| `attack` | `structMaster.getStruct(#attack)` | struct (complex) | Merged from `#attack` data at registry level | ⚠️ DATA-DRIVEN, see §3 |
| `chargeLoc` | `point(0,-8)` | point | NOT in data; NOT applied by spawnEnemy | ❌ GAP |
| `gmgChargeLoc` | `point(8,0)` | point | NOT in data; NOT applied by spawnEnemy | ❌ GAP |
| `chargeOffsetSide` | `#top` | symbol | NOT in data; NOT applied by spawnEnemy | ❌ GAP |
| `dieSound` | `#none` | symbol | Read from data; applied to dieSound field if present | ⚠️ DATA-DRIVEN |
| `dieVolume` | `100` | integer | NOT in data; NOT applied by spawnEnemy | ❌ GAP |
| `energy` | `100` | integer | spawnEnemy uses `num("energy", 40)` | ❌ GAP: default is 40, not 100 |
| `energyRecoverDelay` | `30` | integer | spawnEnemy uses `num("energyRecoverDelay", 0) OR undefined` | ❌ GAP: default is 0→undefined, not 30 |
| `jumpPower` | `-7` | integer | NOT in data; NOT applied by spawnEnemy | ❌ GAP |
| `jumpSound` | `#none` | symbol | NOT in data; NOT applied by spawnEnemy | ❌ GAP |
| `leaveWhenFinished` | `false` | boolean | Applied during spawnEnemy build: `leaveWhenFinished: d["leaveWhenFinished"] === true` | ✓ MATCH (default false) |

### From `/home/user/merlin-s-revenge/casts/script_objects/objGameObject.txt` (lines 33–82, `new` handler)

| Property | Value | Type | Port Behavior | Status |
|----------|-------|------|-----------|--------|
| `allowScreenExit` | `false` | boolean | NOT in data; NOT applied | ❌ GAP |
| `character` | `#gameObject` | symbol | NOT in data; NOT applied | ❌ GAP |
| `collisionDetection` | `true` | boolean | NOT in data; NOT applied | ❌ GAP |
| `collisionUseMiddle` | `false` | boolean | NOT in data; NOT applied | ❌ GAP |
| `constrainToPlayArea` | `#auto` | symbol | NOT in data; NOT applied | ❌ GAP |
| `createOnSolid` | `false` | boolean | NOT in data; NOT applied | ❌ GAP |
| `friction` | `point(50, 50)` | point | NOT in data; NOT applied | ⚠️ POSSIBLY ABSORBED in Movement component (physics-driven) |
| `frictionReel` | `point(10,10)` | point | Present in CPUCharacter override; applied via spawnEnemy build | ✓ PRESENT in concrete actors |
| `inertia` | `0` | integer | Applied via spawnEnemy build: `inertia: num("inertia", 0)` | ✓ MATCH (default 0) |
| `initFaceDir` | `1` | integer | NOT in data; NOT applied | ⚠️ POSSIBLY BAKED into animation system |
| `initMode` | `#stand` | symbol | NOT in data; NOT applied | ⚠️ POSSIBLY DEFAULT in EnemyArchetype |
| `keepVect` | `false` | boolean | NOT in data; NOT applied | ⚠️ PHYSICS-DRIVEN |
| `minCollisionSpeed` | `5` | integer | NOT in data; NOT applied | ⚠️ COLLISION PHYSICS |
| `name` | `#none` | symbol | NOT in data; NOT applied | ⚠️ COSMETIC |
| `recordInRoomState` | `true` | boolean | NOT in data; NOT applied | ⚠️ ROOM PERSISTENCE |
| `stallSpeed` | `0.2` | decimal | NOT in data; NOT applied | ⚠️ PHYSICS (knockback recovery) |
| `startOffset` | `point(0,0)` | point | Overridden in act_actor to `point(-16,-16)` | ✓ INHERITED from act_actor |
| `teamRole` | `#teamMembers` | symbol | Applied via spawnEnemy build: `teamRole: "#teamMembers"` | ✓ MATCH |
| `weight` | `0.2` | decimal | NOT in data; NOT applied | ⚠️ PHYSICS (knockback scaling) |
| `wizard` | `false` | boolean | NOT in data; NOT applied | ⚠️ COSMETIC (wizard tracking) |

---

## 3. Attack Schema Handling

### `/home/user/merlin-s-revenge/casts/script_objects/objCharacter.txt` (line 28)
```lingo
i[#attack] = g.structMaster.getStruct(#attack)  // structAttack defaults
data[#attack] = ListModifyProperties(attack, data.attack)  // deep overlay
```

**Port**: `registry.resolveActor()` applies `deepModify(structuredClone(STRUCT_ATTACK), atk)` after inheritance merge.

**Status**: ✓ MATCH — attack defaults are handled via the attack schema merge at registry level and applied to spawned enemies via `resolveAttack()`.

---

## 4. Gameplay Parity Assessment

### Critical Gaps (Applied in Original, NOT Applied in Port)

1. **`energy: 100`** (objCharacter line 34)  
   - **Original**: Characters default to 100 energy.
   - **Port**: `spawnEnemy()` defaults to 40 if not in data (line 268).
   - **Impact**: Any CPU character that doesn't override `energy` in its data spawns with 40 instead of 100. *This affects combat difficulty and unit lifespan.*
   - **Evidence**: 
     - Original: `/home/user/merlin-s-revenge/casts/script_objects/objCharacter.txt:34`
     - Port: `/home/user/merlin-s-revenge/port/src/entities/archetypes.ts:268`

2. **`energyRecoverDelay: 30`** (objCharacter line 35)  
   - **Original**: Characters recover energy every 30 frames by default.
   - **Port**: `spawnEnemy()` applies 0 or undefined (line 301–302), which likely disables recovery.
   - **Impact**: Any CPU character without explicit `energyRecoverDelay` in data does not recover energy. *This breaks attrition mechanics.*
   - **Evidence**:
     - Original: `/home/user/merlin-s-revenge/casts/script_objects/objCharacter.txt:35`
     - Port: `/home/user/merlin-s-revenge/port/src/entities/archetypes.ts:301–302`

3. **`jumpPower: -7`** (objCharacter line 36)  
   - **Original**: Characters jump with velocity -7 by default.
   - **Port**: Nowhere applied in spawnEnemy; Movement component has no fallback.
   - **Impact**: Characters cannot jump. *This breaks platforming/mobility.*
   - **Evidence**:
     - Original: `/home/user/merlin-s-revenge/casts/script_objects/objCharacter.txt:36`
     - Port: No reference to jumpPower in `/home/user/merlin-s-revenge/port/src/entities/archetypes.ts`

4. **`dieVolume: 100`** (objCharacter line 33)  
   - **Original**: Death sound plays at volume 100 by default.
   - **Port**: Not applied; relies on per-actor data.
   - **Impact**: Death sounds may be silent if not explicitly set in actor data.
   - **Evidence**:
     - Original: `/home/user/merlin-s-revenge/casts/script_objects/objCharacter.txt:33`
     - Port: `/home/user/merlin-s-revenge/port/src/entities/archetypes.ts:299` (no dieVolume field)

5. **`chargeLoc: point(0,-8)` and `gmgChargeLoc: point(8,0)`** (objCharacter lines 29–30)  
   - **Original**: Spell charge location defaults to top-center offset from character.
   - **Port**: Not in data; not applied by spawnEnemy.
   - **Impact**: Spellcasters do not charge spells at the correct world location (UI/aiming broken).
   - **Evidence**:
     - Original: `/home/user/merlin-s-revenge/casts/script_objects/objCharacter.txt:29–30`
     - Port: Grep for `chargeLoc` in `/home/user/merlin-s-revenge/port/src/` yields no matches.

6. **`chargeOffsetSide: #top`** (objCharacter line 31)  
   - **Original**: Spell charge offset defaults to top-of-character.
   - **Port**: Not in data; not applied.
   - **Impact**: Charge animations appear in wrong direction.
   - **Evidence**:
     - Original: `/home/user/merlin-s-revenge/casts/script_objects/objCharacter.txt:31`
     - Port: Grep for `chargeOffsetSide` in `/home/user/merlin-s-revenge/port/src/` yields no matches.

---

## 5. Non-Gaps (Intentional Skips or Absorbed)

### Properties NOT Applied (Acceptable Reasons)

- **`friction: point(50, 50)`** — Physics constant absorbed into Movement component's friction model; engine-specific tuning.
- **`stallSpeed: 0.2`** — Physics constant absorbed into knockback recovery; engine-specific.
- **`weight: 0.2`** — Physics constant absorbed into knockback scaling; engine-specific.
- **`initFaceDir: 1`** — Baked into animation system; concrete actors may override via data.
- **`initMode: #stand`** — EnemyArchetype default behavior; entities spawn in base mode.
- **`allowScreenExit`, `character`, `collisionDetection`, `collisionUseMiddle`, `constrainToPlayArea`, `createOnSolid`, `keepVect`, `minCollisionSpeed`, `name`, `recordInRoomState`, `wizard`** — Cosmetic/engine lifecycle properties; not gameplay-affecting in scope.

---

## Summary

**Data-level defaults**: ✓ CLEAN (all `act_character` + `act_actor` properties match)

**Runtime defaults applied to instances**:
- ✓ 14 properties MATCH or are intentionally architecture-different
- ❌ **6 BEHAVIORAL GAPS** affecting gameplay:
  1. `energy` defaults to 40 instead of 100
  2. `energyRecoverDelay` defaults to 0 instead of 30
  3. `jumpPower` not applied (no default)
  4. `dieVolume` not applied (no default)
  5. `chargeLoc` not applied (no default)
  6. `chargeOffsetSide` not applied (no default)

---

## Recommendations

To achieve full parity, the port must either:
1. **Add these 6 properties to all actors' data**, OR
2. **Apply these 6 as hardcoded defaults in `spawnEnemy()`** when the property is absent from the resolved actor data, OR
3. **Re-baseline the port's design** if the original values are considered unintended (e.g., energy 40 is a deliberate balance change).

Current status: **BEHAVIORAL GAPS PRESENT** — Characters do not recover energy by default, cannot jump, and charge spells from wrong locations.

---

## Reviewer note (sweep lead): verified — energyRecoverDelay fixed elsewhere; rest are non-gaps

- energyRecoverDelay: the faithful CPU default is 300 (objCPUCharacter overrides objCharacter's 30), now FIXED
  for the enemy archetype (finding #13). The agent's "30" is the objCharacter value, not the CPU value.
- energy 40-vs-100: VERIFIED unreachable — 0 living CPU units resolve without an explicit #energy, so the
  enemy-archetype default never applies to a real unit (checked every act_ with a living objType). Non-gap.
- jumpPower (-7): platforming property; this is a top-down game with no jump mechanic. Non-gap.
- dieVolume (100): audio volume — excluded category (cosmetic).
- chargeLoc / gmgChargeLoc / chargeOffsetSide #top: spell-orb placement; the port's SpellActor already
  defaults offsetSide #top and positions the orb over the caster (calcChargeOffset). Cosmetic, non-gap.

**Verdict: CLEAN** (the one real item, CPU energyRecoverDelay, is fixed under finding #13).
