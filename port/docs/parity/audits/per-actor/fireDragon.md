# Actor Behavioral Audit: `act_fireDragon`

## Overview
Behavioral correctness audit of the fireDragon actor in the port, verified against the original Lingo spec.

**Original spec:** `casts/data/act_fireDragon.txt`
**Port implementation:** `port/src/entities/archetypes.ts` (spawnEnemy), `port/src/components/control.ts` (CpuAI), `port/src/components/weapon.ts` (WeaponManager)
**Data resolution:** `port/src/generated/data.json` + `port/src/data/registry.ts`

---

## Audit Findings

### 1. **objType & Archetype**
| Property | Spec | Port | Status |
|----------|------|------|--------|
| `#objType` | `#objCPUCharacter` | `EnemyArchetype` | ✓ CORRECT |

**Verification:** FireDragon spawns via `spawnEnemy()` which creates an `EnemyArchetype` entity (line 252, archetypes.ts), mirroring the original `objCPUCharacter` stack with all combat components (Identity, Grave, EnemyAI, Mana, WeaponManager, Movement, Anim, Energy, Team, Targeting, etc.).

---

### 2. **AI Type & Behavior**
| Property | Spec | Port | Status |
|----------|------|------|--------|
| `#AiType` | `#objAiCPU` | `CpuAI` component | ✓ CORRECT |

**Verification:** FireDragon's `AiType: #objAiCPU` (casts/data/act_fireDragon.txt:4) is a standard committed-target FSM AI. The port's `CpuAI` class (control.ts:295+) implements the original's findTarget → moveToAttack → attack → attackFin loop, with per-tick targeting subscriptions and 30-frame throttle retargeting. FireDragon is **not** a spellcaster, flying bomber, builder, ghost, or multi-attack unit — it runs the baseline FSM with no kite (runReload).

---

### 3. **Attack Type & Firing Behavior**
| Property | Spec | Port | Chain | Status |
|----------|------|------|-------|--------|
| `#weapon` | `#flameThrower` | Resolved via registry | ✓ | CORRECT |
| `#attack.animType` (flameThrower) | `#weaponRanged` | Decoded as `type: "ranged"` | ✓ | CORRECT |
| Firing mode | RANGED (fires bullet) | `ranged = true` → fires via fireBullet | ✓ | CORRECT |

**Verification:**
- FireDragon has no own `#attack` (casts/data/act_fireDragon.txt:1–23). The port reads `d["attack"]` as empty, triggering the weapon-fallback path (archetypes.ts:155–162).
- FireDragon's `weapon: #flameThrower` resolves case-insensitively via registry.resolveActor("flameThrower") → act_flameThrower (registry.ts:86–90 fallback).
- FlameThrower's `#attack.animType: #weaponRanged` (act_flameThrower.txt:8) is classified as `type: "ranged"` by `typeFromAnimType` (weapon.ts:86–95).
- FireDragon sets `ranged = true` (archetypes.ts:169–170) and will fire bullets, not melee-contact.

---

### 4. **Weapon/Bullet Resolution**
| Property | Spec | Port | Resolution | Status |
|----------|------|------|------------|--------|
| FlameThrower name | `#flameThrower` | `"flameThrower"` (stripped) | ✓ Symbol → string | CORRECT |
| FlameThrower bullet | `#fireBall` | Resolves to `act_fireBall` data | ✓ Case-insensitive fallback works | CORRECT |
| Bullet damageMultiplier | `6` | Loaded from act_fireBall.txt:6 | ✓ Data-driven | CORRECT |
| Bullet power | `0.2` | Loaded from act_fireBall.txt:7 | ✓ Data-driven | CORRECT |

**Verification:**
- FlameThrower attack name is `#flameThrower` (act_flameThrower.txt:13) → stripped to `"flameThrower"` in WeaponManager.
- FlameThrower bullet reference `#fireBall` (act_flameThrower.txt:9) resolves via registry.resolveActor("fireBall") → act_fireBall.data (registry case-insensitive fallback, line 89).
- FireBall attack properties (damageMultiplier=6, power=0.2) are loaded from act_fireBall.txt and used in the K1 damage calculation (control.ts:554–576).

---

### 5. **Firing Type (Velocity Model)**
| Property | Spec | Port | Calculation | Status |
|----------|------|------|-------------|--------|
| `#firingType` (flameThrower) | `#fullstrength` | Read at control.ts:531 | ✓ Implemented | CORRECT |
| Throw speed | Constant = strength | `isFullStrength ? strength : distToTarget/10` | ✓ Correct path | CORRECT |
| FireDragon strength | `8` | Applied as throwSpeed | ✓ CORRECT |

**Verification:**
- FlameThrower attack firingType: `#fullstrength` (act_flameThrower.txt:12).
- Port reads it at control.ts:531: `const isFullStrength = (ftAttack?.firingType ?? "#proportional").toLowerCase() === "#fullstrength"`.
- When true, throwSpeed = max(1, this.strength) = 8 (firedragon.strength = 8).
- This sets a constant bullet velocity (calibrated to the slice's damage model), faithful to the original's fullstrength mode.

---

### 6. **Cooldown Calibration (Ranged)**
| Property | Spec | Port | Calculation | Status |
|----------|------|------|-------------|--------|
| `#cooldown` (flameThrower) | `0` | Raw=0, Effective=(0+18)·10+1=181 | ✓ Calibrated | CORRECT |
| Dexterity (skill stat) | `10` | Read from fireDragon data | ✓ Used as inc | CORRECT |

**Verification:**
- FlameThrower attack cooldown: 0 (act_flameThrower.txt:11).
- FireDragon dexterity: 10 (act_fireDragon.txt:7).
- Port calibration (archetypes.ts:180–188):
  - rawCooldown = 0 (from attack.cooldown)
  - ranged weapon → framesWanted = max(1, 0 + 18) = 18
  - counterInc = dexterity = 10
  - effectiveCooldown = round(18 · 10 + 1) = 181
- FireDragon fires every 181 ticks with dexterity increment, matching the faithful per-type cooldown calibration model (B2 plan §f.3).

---

### 7. **Attack Reach & Sound**
| Property | Spec | Port | Status |
|----------|------|------|--------|
| `#reach` (flameThrower) | `150` | Read as-is → targetReach | ✓ CORRECT |
| `#sound` (flameThrower) | `"dragon_fire"` | Passed to atkSound | ✓ CORRECT |

**Verification:** FlameThrower reach (act_flameThrower.txt:14) = 150 px. Port reads it directly (weapon.ts:163–164) and passes it as targetReach. Sound "dragon_fire" is read and stored in CpuAI.atkSound for playback on attack.

---

### 8. **Team & Targeting (CRITICAL: #scarlet vs #monsters)**
| Property | Spec | Port | Status |
|----------|------|------|--------|
| `#team` | `#scarlet` | Team component set to "#scarlet" | ✓ CORRECT |
| Team data resolution | tem_scarlet.txt:hates=[aldevar, village, monsterSummon, goblins, ninja, magicalAlliance, orcs, monsters] | Loaded via registry.team("#scarlet") → TeamRuntime with same hates tiers | ✓ CORRECT |
| Targeting allegiance | Default (attack inherits) | `targetAllegiance: "#enemy"` (STRUCT_ATTACK default) | ✓ CORRECT |
| Targeting roles | Default | `targetRoles: [["#teamMembers", "#teamBuildings"]]` (STRUCT_ATTACK default) | ✓ CORRECT |
| Hits | Default | `hits: ["#teamMembers"]` (STRUCT_ATTACK default) | ✓ CORRECT |

**Verification:**
- FireDragon is a `#scarlet` team member (act_fireDragon.txt:19, different from act_dragon.txt:19 which is `#monsters`).
- The port reads team="scarlet" → "#scarlet" (archetypes.ts:260) and registers it with teamMaster.
- TeamMaster lazily loads tem_scarlet.txt data (systems/teams.ts:40–51): friends=[], hates=[[aldevar,village,monsterSummon,goblins,ninja,magicalAlliance,orcs,monsters]].
- FlameThrower attack carries no override targeting fields, so it inherits STRUCT_ATTACK defaults: target enemies, prioritize #teamMembers, hit #teamMembers on melee (fireDragon never melees, so this is a non-issue).
- Allegiance/roles are fully data-driven via the Targeting component (combat.ts). The #scarlet team will correctly hunt members of its hates list.

---

### 9. **Special Flags & Disposition**
| Flag | Spec | Port | Status |
|------|------|------|--------|
| `#wizard` | Not present | — | N/A |
| `#ghost` | Not present | ghost=false (default) | ✓ CORRECT |
| `#multiAttack` | Not present | multiAttack=false (default) | ✓ CORRECT |
| `#builder` | Not present | builder=false (default) | ✓ CORRECT |
| `#leaveWhenFinished` | Not present | leaveWhenFinished=false (default) | ✓ CORRECT |
| `#reelProof` | Not present | reelProof=false (default) | ✓ CORRECT |
| `#runReload` (derived) | Not spellcaster → false | ranged=true, aiType=#objAiCPU, animType=#weaponRanged → runReload=false (archetypes.ts:206) | ✓ CORRECT |

**Verification:** FireDragon has no special disposition flags. The port defaults all component flags to false. Most critically, `runReload` evaluates to false because:
- `ghost = false` ✓
- `ranged = true` ✓
- `aiType !== "#objAiCPUSpellCaster"` ✓ (it's "#objAiCPU")
- `animType !== "#magic"` ✓ (it's "#weaponRanged")
- `aiType !== "#objAiFlyingBomber"` ✓

So the condition `!ghost && ranged && (isSpellcaster || isMagic || isFlyer)` = `true && true && false` = **false**. FireDragon will NOT kite; it commits to targets and fires in place, faithful to its CPU type.

---

### 10. **Reincarnation & Death**
| Property | Spec | Port | Status |
|----------|------|------|--------|
| `#reincarnateAs` | Not present | reincarnateAs=undefined | ✓ CORRECT |
| `#reincarnateInto` | Not present | reincarnateInto=undefined | ✓ CORRECT |
| `#minEnergy` | Not present | minEnergy=0 (single-stage death) | ✓ CORRECT |
| `#dieSound` | `#none` | dieSound=undefined (no custom sound on death) | ✓ CORRECT |

**Verification:** FireDragon has no reincarnation chain. On lethal death (energy ≤ 0), it dies outright via Energy.update (combat.ts:40–41) without spawning child actors. The Reincarnate component exists but does nothing (reincarnateAs/Into both empty). minEnergy defaults to 0, so death threshold is the natural 0.

---

### 11. **Energies & Stats**
| Property | Spec | Port | Status |
|----------|------|------|--------|
| `#energy` | `500` | Read and applied | ✓ CORRECT |
| `#strength` | `8` | Read and applied | ✓ CORRECT |
| `#walkSpeed` | `7` | Scaled 7·0.6=4.2 px/tick | ✓ Calibrated |
| `#dexterity` | `10` | Used as ranged cooldown inc | ✓ CORRECT |
| `#experienceImWorth` | `50` | Stored in XP component | ✓ CORRECT |
| `#inertia` | `70` | Knockback resistance | ✓ Applied |
| `#startingLevel` | `0` | No level-up loop (stays lv0) | ✓ CORRECT |

**Verification:** All numeric stats are read case-insensitively from fireDragon data (via the `num()` helper in archetypes.ts:139) and applied to the entity's build config. Walk speed is calibrated to px/tick (line 257). Inertia dampens knockback vector (Hurt component, scaled by inertia). No starting level loop runs, so fireDragon spawns at level 0 (line 307–308).

---

## Conclusion

**All behavioral properties of `act_fireDragon` are correctly ported.** The fireDragon:
1. Is spawned as an `EnemyArchetype` with `CpuAI` (standard committed-target FSM).
2. Has **no own attack** → uses its weapon's (`#flameThrower`) attack instead.
3. FlameThrower's `#weaponRanged` attack classifies as **ranged**, firing `#fireBall` bullets.
4. Cooldown is faithfully calibrated using dexterity (10) as the skill stat: effective 181 ticks per shot.
5. Fires with **#fullstrength velocity** (constant speed = strength = 8), distinct from proportional-distance lobs.
6. Does **not kite** (runReload=false) — commits to targets and fires in place.
7. Belongs to the **#scarlet team** with proper allegiance data loaded (hates aldevar et al).
8. Has no reincarnation, no multistage death, no special disposition flags.
9. All energies, reach, sound, team, and targeting are read correctly.

**Status: CLEAN — No behavioral divergences detected.**
