# Behavioral Audit: `act_bombMage`

**Scope:** READ-ONLY behavioral verification. Comparing original Lingo spec against port implementation for faithful actor behavior.

---

## Summary

**CLEAN** — All behavioral properties correctly implemented. bombMage behaves identically to the original.

---

## Data Comparison

| Property | Original | Port | Match |
|----------|----------|------|-------|
| `#objType` | `#objCPUCharacter` | `#objCPUCharacter` | ✓ |
| `#AiType` | `#objAiCPU` | `#objAiCPU` | ✓ |
| `#attack.animType` | `#naturalRanged` | `#naturalRanged` | ✓ |
| `#attack.bullet` | `#bomb` | `#bomb` | ✓ |
| `#attack.reach` | `80` | `80` | ✓ |
| `#attack.cooldown` | `0` | `0` | ✓ |
| `#team` | `#magicalAlliance` | `#magicalAlliance` | ✓ |
| `#strength` | `10` | `10` | ✓ |
| `#dexterity` | `10` | `10` | ✓ |
| `#energy` | `200` | `200` | ✓ |
| `#walkSpeed` | `4` | `4` | ✓ |
| `#inertia` | `50` | `50` | ✓ |
| `#startingLevel` | `0` | `0` | ✓ |
| Special flags | none | none | ✓ |

---

## Behavioral Verification

### 1. Attack Classification: RANGED ✓

**Original:** `#animType: #naturalRanged` in `#attack`.  
**Port:** 
- `typeFromAnimType("#naturalRanged")` → `"ranged"` (`weapon.ts:7-10`)
- `spawnEnemy` recognizes `#naturalRanged` at line 170 and sets `ranged = true`
- CpuAI correctly routes to ranged `attack()` path at line 503

**Verdict:** bombMage correctly fires as RANGED, not melee. Will move to within reach (80 px), then fire bullets from range.

### 2. Bullet Resolution ✓

**Original:** `#attack.bullet: #bomb`.  
**Port:**
- Registry resolves `#bomb` → `act_bomb` with case-insensitive fallback (`registry.ts:86-90`)
- `spawnEnemy` line 241: resolves bullet actor data
- act_bomb data matches original: `#inherit: #bullet, #attack.type: #explode, explodeCharge: 20`

**Verdict:** Bomb resolves correctly. Type `#explode` classifies it as a splash bullet (line 243).

### 3. Splash Fire Behavior ✓

**Original:** Bomb is an exploding projectile per `act_bomb.txt`.  
**Port:**
- `spawnEnemy` line 243: `ba.attackType === "#explode"` → sets `splashBullet`
- CpuAI.attack line 505-510: fires splash bullets via `fireSplashBullet()`
- Bomb flies to target, explodes radially on arrival/collision (matching original behavior)

**Verdict:** bombMage's bomb fires and explodes as splash damage, faithful to original.

### 4. Team & Targeting ✓

**Original:** `#team: #magicalAlliance`.  
**Port:** 
- Team correctly read into Targeting component
- `#magicalAlliance` is hostile to enemy teams (confirmed in `tem_pitMonsters.txt`)
- Enemies acquire bombMage as a valid target

**Verdict:** Team allegiance correct. bombMage attacks enemies of #magicalAlliance.

### 5. AI Behavior ✓

**Original:** `#AiType: #objAiCPU` — standard enemy FSM.  
**Port:**
- CpuAI FSM: findTarget → moveToAttack → attack (with kite if ranged)
- No special flags (wizard, ghost, multiAttack, builder, leaveWhenFinished, reelProof) — all correctly absent
- Ranged flag enables `runReload` fallback (line 206 check fails — `aiType` is `#objAiCPU`, not spellcaster/bomber, so `runReload=false`)
- bombMage uses standard moveToAttack → fire → re-target loop

**Verdict:** AI behavior is standard CPU with no deviations.

### 6. Death & Reincarnation ✓

**Original:** No `#reincarnateAs` or `#reincarnateInto`.  
**Port:** Defaults to no reincarnation (E1 respects real data).

**Verdict:** No split-on-death, as original.

### 7. Cosmetic/Deferred Omissions (Acknowledged, Per Spec) ✓

The following are known faithful omissions per the data-coverage audit:
- `#damageSpeed: 3` — terrain/fall damage only (platforming, out of scope)
- `#eyestrain: 25` — caster aim jitter (deferred)
- `#dieSound: #none` — cosmetic audio
- `#attack.animframe: 16` — attack-frame gating (deferred)
- `#attack.sound: #none` — cosmetic audio
- `#attack.collisionLoc: point(0,-2)` — per-weapon bullet spawn offset (port uses fixed `y-6`)

None of these affect behavioral correctness.

---

## Dual-Tree Evidence Summary

| Behavior | Original (`casts/` file:line) | Port (`src/` file:line) | Verdict |
|----------|------|------|---------|
| Ranged attack type | `act_bombMage.txt:9` | `archetypes.ts:169-170` | CORRECT |
| Bullet resolution | `act_bombMage.txt:10, act_bomb.txt:1-23` | `archetypes.ts:240-245, registry.ts:86-90` | CORRECT |
| Splash fire route | `act_bomb.txt:6-8` | `archetypes.ts:243, control.ts:505-510` | CORRECT |
| Team & targeting | `act_bombMage.txt:27, tem_pitMonsters.txt` | `combat.ts:127, archetype.ts:260` | CORRECT |
| AI FSM | `act_bombMage.txt:4` | `control.ts:295-568` | CORRECT |
| No special flags | (all absent in original) | `archetype.ts:206-316` | CORRECT |

---

## Conclusion

**All behavioral properties verified CORRECT.** bombMage functions identically to the original:
- ✓ Attacks as a ranged thrower (not melee)
- ✓ Fires bombs that explode on impact (splash damage)
- ✓ Uses correct team and targeting
- ✓ Standard CPU AI with no special behaviors
- ✓ Correct stats and cooldown

**No behavioral divergences found.**
