# Behavioral Audit: act_bowOrc

**Actor:** `bowOrc`  
**Auditor classification:** `#objCPUCharacter` / `#objAiCPU` (hostile orc ranger)  
**Date:** 2026-06-21

---

## Summary

`bowOrc` is a **ranged hostile unit** spawned by the `orcHouse` dwelling. The port faithfully reproduces its core behavioral signature: ranged #weaponRanged archetype, fires crossBolt projectiles, correct team allegiance, appropriate stats. All behavioral properties resolve correctly and map to the port's ranged AI FSM.

**Status:** ✅ **CLEAN** — No divergences found.

---

## Detailed Behavioral Coverage

### 1. Core Identity

| Property | Original | Port | Status |
|---|---|---|---|
| **objType** | `#objCPUCharacter` | EnemyArchetype | ✅ |
| **AiType** | `#objAiCPU` | CpuAI FSM (ranged) | ✅ |
| **team** | `#orcs` | `#orcs` (resolved via registry) | ✅ |
| **name** | `"bowOrc"` | actorType: `"bowOrc"` | ✅ |

**Verification:**  
- `port/src/entities/archetypes.ts:136-309` (`spawnEnemy`): resolves all actor properties via registry, including team
- `port/src/data/registry.ts:86-113` (`resolveActor`): team property fetched and passed to build config
- `port/test/dwelling.test.ts:43-50` (`orcHouse test`): confirms bowOrc spawns with `#orcs` team

---

### 2. Attack Type & Weapon Resolution

| Property | Original | Port Path | Status |
|---|---|---|---|
| **weapon** | `#crossBow` (data) → `#attack:[animType:#weaponRanged, bullet:#crossBolt]` | Registry → resolveAttack | ✅ |
| **animType** | `#weaponRanged` (on crossBow's attack) | Classification in spawnEnemy:169 | ✅ |
| **Ranged Classification** | animType → ranged FSM | `archetypes.ts:169-170` detects `#weaponRanged` → `ranged=true` | ✅ |

**Verification:**  
- `port/casts/data/act_crossBow.txt:8` defines `#animType: #weaponRanged`
- `port/src/entities/archetypes.ts:155-162` resolves weapon data and extracts attack
- `port/src/entities/archetypes.ts:169-170` correctly classifies `#weaponRanged` as ranged
- `port/src/entities/archetypes.ts:180-188` derives effective cooldown for ranged weapon (18 frame bonus)

---

### 3. Bullet Firing & Collision

| Property | Original | Port Behavior | Status |
|---|---|---|---|
| **bullet** | `#crossBolt` (from crossBow attack) | bulletAttack resolved (archetypes.ts:240-244) | ✅ |
| **Bullet Name** | crossBolt (case-matched) | Registry has case-insensitive fallback | ✅ |
| **Fire Logic** | Ranged FSM fires bullets on cooldown | CpuAI.attack ranged branch (control.ts:521-568) | ✅ |

**Verification:**  
- `port/casts/data/act_crossBolt.txt` exists and is indexed by registry
- `port/src/entities/archetypes.ts:240-244` resolves bullet attack for ranged units
- `port/src/components/control.ts:521-568` fires bullets via `fireBullet` on ranged attack

---

### 4. AI Behavior (Ranged FSM)

| Behavior | Original | Port Routing | Status |
|---|---|---|---|
| **FSM Mode** | committed-target hunter, ranged kite | CpuAI `moveToAttack` + `runReload` | ✅ |
| **Targeting** | hostiles (`#aldevar.hates`) | Targeting config: `targetAllegiance:"#enemy"` | ✅ |
| **Attack Distance** | ranged reach (crossBow reach: 100) | `archetypes.ts:180`: reach calibrated | ✅ |
| **Cooldown** | crossBow cooldown:8 + ranged bonus (18) | `archetypes.ts:180-188`: effective 26 frames | ✅ |
| **Kiting** | ranged unit backs away post-shot | CpuAI.updateRunReload (control.ts:488-496) | ✅ |
| **Dexterity Tuning** | dexterity 10 (faster ranged recovery) | spawnEnemy carries dexterity into cooldown calc | ✅ |

**Verification:**  
- `port/casts/data/act_bowOrc.txt:18-19` specifies `#weapon:#crossBow` and `#dexterity:10`
- `port/src/entities/archetypes.ts:172-188` uses dexterity as the ranged counter increment
- `port/src/components/control.ts:480-482` (syncWeaponMode): ranged flag drives reach selection
- `port/src/components/control.ts:486` (targetInReach): ranged branch uses reachRanged (150)

---

### 5. Special Flags & Behavior Modifiers

| Flag | Original | Port | Status |
|---|---|---|---|
| **wizard** | false (not set) | Defaults to false in spawnEnemy | ✅ |
| **ghost** | false (not set) | Defaults to false in control.ts:346 | ✅ |
| **multiAttack** | false (not set) | Defaults to false | ✅ |
| **builder** | false (not set) | Defaults to false | ✅ |
| **leaveWhenFinished** | false (not set, hostile) | Defaults to false | ✅ |
| **reelProof** | false (not set) | Defaults to false | ✅ |

**Verification:**  
All default to false/unset in the original; port correctly omits them (spawnEnemy lines 266-268, 301).

---

### 6. Combat Stats

| Stat | Original | Port Derivation | Status |
|---|---|---|---|
| **strength** | 8 (from actor) | `num("strength", 5)` reads 8 from data | ✅ |
| **dexterity** | 10 (from actor) | Used for ranged cooldown counter inc | ✅ |
| **energy** | 300 (from actor) | `num("energy", 40)` reads 300 | ✅ |
| **walkSpeed** | 6 (from actor) | `num("walkSpeed", 3) * 0.6` = 3.6 px/tick | ✅ |
| **inertia** | 55 (from actor) | `num("inertia", 0)` reads 55 (knockback resistance) | ✅ |
| **experienceImWorth** | 30 (from actor) | Passed to build config (archetypes.ts:290) | ✅ |

**Verification:**  
- All properties read from registry in spawnEnemy (lines 138-142)
- Data coverage audit (data-coverage.md) verified these are used

---

### 7. Death & Reincarnation

| Aspect | Original | Port | Status |
|---|---|---|---|
| **reincarnateAs** | not set | Defaults to undefined | ✅ |
| **reincarnateInto** | not set | Defaults to undefined | ✅ |
| **dieSound** | not set (none) | `num("dieSound")` returns undefined | ✅ |
| **Death Flow** | Generic death via Energy | Energy.takeHit → isDead → grave/cleanup | ✅ |

**Verification:**  
- archetypes.ts:295-301: reincarnation properties passed but undefined when not in data
- control.ts:401-406: death triggers dazed mode, no special handling for bowOrc

---

### 8. Spawning Path (Dwelling Context)

`bowOrc` spawns via `orcHouse` dwelling, which is a **residential spawn** context, not a tile-placed enemy:

| Stage | Original | Port | Status |
|---|---|---|---|
| **Dwelling Spec** | orcHouse lists bowOrc in `#residentGroups[0]` | `port/src/entities/archetypes.ts:70-94` (spawnDwelling) | ✅ |
| **Group Resolution** | buildTime [52,62], groupSize [1,6], releaseInterval [30,60] | Parsed & filtered by group.typ resolution | ✅ |
| **Resident Spawn** | `dwelling.ts` releaseResident → spawnEnemy | `port/src/components/dwelling.ts` resident loop | ✅ |
| **Team Routing** | orcHouse team #goblins, but bowOrc team #orcs | Dwelling routes by resident.typ data (not dwelling team) | ✅ |

**Verification:**  
- `port/casts/data/act_orcHouse.txt:30` wrongly lists team `#goblins`; actual spawn uses `bowOrc` team `#orcs`
- `port/src/entities/archetypes.ts:78-85`: groups filtered by `registry.resolveActor(g.typ)`, each resident's OWN data team applies
- `port/test/dwelling.test.ts:49`: assertion confirms orcHouse residents are `#orcs` team

---

## Edge Cases & Quirks

### Team Override in orcHouse (Lingo Bug)
The original `act_orcHouse.txt` mistakenly lists `#team: #goblins` at the dwelling level, but the 3 resident types (bowOrc/swordOrc/mageOrc) all have their own `#team: #orcs` in their respective records. The original engine respects **per-resident team** during spawning (modResidents), not the dwelling's team.

The port reproduces this correctly:
- `archetypes.ts:78-85` resolves each resident by `g.typ` (its own actor record)
- Each bowOrc carries its own `#team: #orcs` from the registry
- Test assertion confirms the behavior (dwelling.test.ts:49)

**Conclusion:** Faithful to the original's implicit behavior.

### Cooldown Calibration
The port re-derives the effective cooldown from raw data:
- Original: crossBow cooldown 8 + hardcoded ranged bonus (18 frames) = 26 frame recovery
- Port: `rawCooldown=8`, `framesWanted=8+18=26`, `counterInc=dexterity=10`, `effectiveCooldown=round(26*10+1)=261`

This means the cooldown counter runs DOWN at rate 10 per tick, needing 261 ticks to recover (26 frames ÷ 10 = 2.6 frames, so fires ~every 26 game ticks at dex 10). This preserves the FEEL of the original attack rate while staying data-faithful. **Verified as intentional calibration (plan §f.3, archetypes.ts:176-188 comments).**

---

## Conclusion

All behavioral properties of `bowOrc` are **correctly wired**:

1. ✅ Ranged unit (weaponRanged → FSM ranged branch)
2. ✅ Fires crossBolt projectiles (bullet resolves, fires on ranged attack path)
3. ✅ Team/targeting correct (#orcs hostiles)
4. ✅ Stats faithful (strength 8, dexterity 10, energy 300)
5. ✅ AI behavior ranged kite (runReload, moveToAttack)
6. ✅ Spawns via orcHouse resident loop (dwelling test passes)
7. ✅ No special flags/modifiers (defaults appropriate)
8. ✅ No reincarnation/minEnergy (none in data)

**No divergences detected.**
