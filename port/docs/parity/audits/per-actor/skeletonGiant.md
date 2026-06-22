# Behavioral Audit: act_skeletonGiant

**Audit Date**: 2026-06-22  
**Method**: REPRODUCED — spawned + ticked in a live probe (`port/tools/_audit_skeletonGiant.ts`, deleted after run); all findings are observed, not inferred.

---

## 1. Identity / Inheritance Chain

```
act_skeletonGiant
  #inherit: #CPUCharacter
    #inherit: #character
      #inherit: #actor
  #weapon: #skeletonGiantSword
    #inherit: #weapon
      #inherit: #actor
```

**Resolved properties** (original cast files, line refs):

- `act_skeletonGiant.txt:3`  — `#objType: #objCPUCharacter`
- `act_skeletonGiant.txt:4`  — `#AiType: #objAiCPU`
- `act_skeletonGiant.txt:5`  — `#inherit: #CPUCharacter`
- `act_skeletonGiant.txt:6`  — `#damageSpeed: 2`
- `act_skeletonGiant.txt:7`  — `#dexterity: 2` (ranged cooldown stat — irrelevant for a melee weapon; agility=1 inherited from character governs cooldown)
- `act_skeletonGiant.txt:8`  — `#energy: 200`
- `act_skeletonGiant.txt:9`  — `#inertia: 65`
- `act_skeletonGiant.txt:10` — `#stallSpeed: 3`
- `act_skeletonGiant.txt:11` — `#experienceImWorth: 20`
- `act_skeletonGiant.txt:12` — `#eyestrain: 30`
- `act_skeletonGiant.txt:13` — `#strength: 6`
- `act_skeletonGiant.txt:14` — `#team: #undead`
- `act_skeletonGiant.txt:15` — `#name: "skeletonGiant"`
- `act_skeletonGiant.txt:16` — `#walkSpeed: 7`
- `act_skeletonGiant.txt:17` — `#weapon: #skeletonGiantSword`
- `act_CPUCharacter.txt:4`   — `#frictionReel: point(10,10)`
- `act_CPUCharacter.txt:6`   — `#pathfinding: true`
- `act_CPUCharacter.txt:7`   — `#walkType: #anyDirSpeed`
- `act_character.txt:4`      — `#agility: 1` (melee cooldown rate — skeletonGiant sets no override)

**Weapon: `act_skeletonGiantSword.txt`**
- `#animType: #weaponMelee` — melee contact attack
- `#animframe: 6` — hit fires on frame 6 of the `weaponMelee` strip (1-based)
- `#collisionLoc: point(30,0)` — strike point is 30px in front
- `#cooldown: 0` (raw; engine adds agility-based recovery)
- `#dammageMultiplier: 8` — **note the double-m typo** (same key as `act_skeletonComandoSword.txt`)
- `#power: point(1,0)`
- `#hits: [#teamMembers, #teamBuildings]`
- `#sound: "skeleton_fire"`

---

## 2. Correct Behavior (Derived from Original)

| Property | Value | Source |
|----------|-------|--------|
| Team | `#undead` | `act_skeletonGiant.txt:14` |
| Energy | 200 HP | `act_skeletonGiant.txt:8` |
| Strength | 6 | `act_skeletonGiant.txt:13` |
| WalkSpeed | 7 engine units → 4.2 px/tick in port | `act_skeletonGiant.txt:16` |
| Inertia | 65% knockback damping | `act_skeletonGiant.txt:9` |
| Dexterity | 2 (unused — weapon is melee) | `act_skeletonGiant.txt:7` |
| Agility | 1 (inherited from act_character) | `act_character.txt:4` |
| ExperienceImWorth | 20 XP | `act_skeletonGiant.txt:11` |
| Eyestrain | 30 (ranged scatter — irrelevant; this is a melee actor) | `act_skeletonGiant.txt:12` |
| AiType | `#objAiCPU` (committed-target hunt FSM) | `act_skeletonGiant.txt:4` |
| Attack type | `#weaponMelee` (no ranged, no magic) | `act_skeletonGiantSword.txt:8` |
| Attack fire frame | frame 6 of `weaponMelee` strip | `act_skeletonGiantSword.txt:7` |
| Attack reach (approach gate) | 30px (from `collisionLoc.x=30`) | `act_skeletonGiantSword.txt:9` |
| Damage multiplier | **8** (`#dammageMultiplier`) | `act_skeletonGiantSword.txt:14` |
| Attack sound | `"skeleton_fire"` | `act_skeletonGiantSword.txt:15` |
| Hits targets | `[#teamMembers, #teamBuildings]` | `act_skeletonGiantSword.txt:11` |
| RunReload | false (not set, no kiting) | — |
| Ghost | false | — |
| Reincarnation | none (no `#reincarnateAs`) | — |
| Pathfinding | true (from `#CPUCharacter`) | `act_CPUCharacter.txt:6` |
| Cooldown (derived) | 7 ticks (`round(max(1, 0+6) × agility(1) + 1)`) | `objAiAttack.addCooldownCounter` |

**Animations** (all present in `assets.json`):

| Strip | Frames | Loop | Notes |
|-------|--------|------|-------|
| `skeletonGiant_stand` | 1 | true | idle |
| `skeletonGiant_walk` | 8 | true | movement (delay=3 each) |
| `skeletonGiant_weaponMelee` | 7 | false | attack; frame 6 fires the hit (delay=2 each, 14 ticks total) |
| `skeletonGiant_grave` | 2 | false | death marker |
| `skeletonGiant_reel` | 2 | false | knockback |

No `skeletonGiant_death` strip in assets — death goes straight to grave via `flasherFinished` → `drawGrave`.  
No `skeletonGiant_naturalMelee` strip — attack animType is `#weaponMelee`, not `#naturalMelee`.

---

## 3. Reproduced Behavior (Port — Observed)

**Probe setup**: spawned `skeletonGiant` at (350, 200) with `animChar="skeletonGiant"`, player at (300, 200) = 50px apart; 200-frame tick loop via `rebuildCombatSubstrate()` + `send("update")`. Second run: giant pre-placed at (320, 200) = 20px from player (within 30px reach immediately) to count attack cadence.

| Aspect | Observed in Port |
|--------|-----------------|
| Sprite char | `skeletonGiant` (stand strip found; no fallback to `blackOrc`) |
| Animation strips | stand/walk/weaponMelee/grave/reel all resolve to real bundled art |
| AI mode at t=0 | `moveToAttack` (target acquired immediately on tick 0) |
| Target acquisition | Committed to player on tick 0; maintained through the run |
| animActions observed | `weaponMelee` (correctly plays during attack window) |
| AI mode transitions | `moveToAttack` only (never drops out of hunt loop) |
| Frame first attack | t=7 (giant was already at 50px, moved into 30px reach then fired) |
| Attack entries in 200f | **16** entries when pre-positioned within reach |
| Team | `#undead` |
| Energy | 200 HP |
| Inertia | 65 |
| maxSpeed (walkSpeed) | 4.2 px/tick (= 7 × 0.6) |
| reach (CpuAI) | 30 (from `collisionLoc.x=30`, clamped to `[16,90]`) |
| animFrame | `[6]` (correctly reads lowercase `animframe:6` from data) |
| damageMultiplier **OBSERVED** | **1** (WRONG — should be 8; see DIV-1) |
| cooldown **OBSERVED** | 7 ticks (correct: `round(max(1, 0+6) × agility(1) + 1) = 7`) |
| Grave | `getGraveOn()=true`; dead giant renders `skeletonGiant_grave` strip |
| experienceImWorth | 20 XP |
| teamRole | `#teamMembers` |
| hits | `["#teamMembers", "#teamBuildings"]` |

---

## 4. Divergences

### DIV-1 — `dammageMultiplier` typo → reads 1 — **NOT A DIVERGENCE (WONTFIX, faithful)**

**VERDICT (post-review): this is faithful — do NOT "fix" it.** The original engine reads `getAttack().damageMultiplier` (correctly spelled, `modEnergy.txt:276`); NO original script reads the typo'd `#dammageMultiplier`. So in the ORIGINAL too the typo'd key was dead and the multiplier fell back to the `structMaster` default `1` (`structMaster.txt:171`). The port reads the same correctly-spelled key and falls back to the same default `1` (`registry.ts:26`) — it reproduces the original's shipped behavior EXACTLY. Reading the typo'd key (the "fix" below) would make skeletonGiant/skeletonComando deal 8×/14× — STRONGER than the real game. The "intended 8" never happened in the shipped game. The original analysis below is retained for context only.



**Cast file**: `act_skeletonGiantSword.txt:14` — `#dammageMultiplier: 8` (double-m typo).  
**Port resolves**: `damageMultiplier = 1` (the `STRUCT_ATTACK` default).

**Root cause**: The original cast uses `#dammageMultiplier` (double-m). The port's `registry.ts deepModify` preserves this key literally when merging the attack proplist over `STRUCT_ATTACK` (which uses `damageMultiplier`, single-m). After the merge the resolved attack object has both:
- `damageMultiplier: 1` — from `STRUCT_ATTACK`, not overridden (keys differ)
- `dammageMultiplier: 8` — appended from the weapon data, never read

`resolveAttack` in `port/src/components/weapon.ts:194` reads only `r["damageMultiplier"]`, finding `1` instead of `8`.

**Impact**: skeletonGiant's melee does **8× less damage than intended**.  
- Intended: `power(1) × strength(6) × ENEMY_DAMAGE_SCALE(0.18) × mult(8)` ≈ **8.6 effective**  
- Actual: `power(1) × strength(6) × ENEMY_DAMAGE_SCALE(0.18) × mult(1)` ≈ **1.1 effective**

The same typo affects `act_skeletonComandoSword.txt:14` (`#dammageMultiplier: 14` also lost).

**Fix sketch** (two options):
1. In `resolveAttack` (`weapon.ts:194`), read both keys: `numOr(r["damageMultiplier"] ?? r["dammageMultiplier"], d["damageMultiplier"])`.
2. In `registry.ts deepModify` (or the `parse_data.ts` parser), normalise `dammageMultiplier` → `damageMultiplier` before merge.

Option 1 is the minimal fix; option 2 is cleaner but touches the data pipeline.

**Original line**: `casts/data/act_skeletonGiantSword.txt:14`.  
**Port line**: `port/src/components/weapon.ts:194` (`resolveAttack damageMultiplier read`).

---

### DIV-2 — `animframe` vs `animFrame` dual-key (latent, currently correct)

**Cast file**: `act_skeletonGiantSword.txt:7` — `#animframe: 6` (lowercase `f`).

After `deepModify(STRUCT_ATTACK, weapon_attack)` the resolved attack has BOTH `animFrame: 2` (from `STRUCT_ATTACK`, camelCase) and `animframe: 6` (from data, lowercase). `resolveAttack` in `weapon.ts:181` reads `r["animframe"] ?? r["animFrame"]` — the lowercase key wins, giving the correct `[6]`. **Currently non-impacting**: attack fires on the correct frame. However, if the resolution order changed or the data parser normalised to camelCase, the wrong frame `2` would be used.

This is the same structural issue as documented in the `blackOrc` audit (DIV-2 there).

**Original line**: `casts/data/act_skeletonGiantSword.txt:7`.  
**Port line**: `port/src/data/registry.ts:47-53` (`deepModify`), `port/src/components/weapon.ts:181` (`resolveAttack animFrame read`).

---

## 5. Confirmed Correct

| Aspect | Status |
|--------|--------|
| Sprite + all animation strips (stand/walk/weaponMelee/grave/reel) | All present, named correctly in `assets.json` |
| `spriteCharOr("skeletonGiant")` → `"skeletonGiant"` (no fallback) | Correct |
| `animFrame = [6]` (fires on frame 6 of weaponMelee, 1-based) | Correct — resolveAttack reads `animframe:6` |
| Attack type: melee (not ranged, not magic) | Correct |
| `ranged=false`, `runReload=false`, `ghost=false` | Correct |
| Team `#undead`, role `#teamMembers` | Correct |
| Energy 200 | Correct |
| Strength 6, powerScalar=1 (from `point(1,0)`) | Correct |
| Inertia 65 | Correct |
| `walkSpeed` → `maxSpeed = 4.2 px/tick` (7 × 0.6 conversion) | Correct |
| `agility=1` (not `dexterity=2`) governs melee cooldown | Correct |
| Cooldown = 7 ticks (`round(max(1,0+6) × 1 + 1)`) | Correct |
| reach = 30 (clamped from `collisionLoc.x=30`, within `[16,90]`) | Correct |
| AtkSound `"skeleton_fire"` in CpuAI | Correct |
| ExperienceImWorth 20 | Correct |
| `hits: ["#teamMembers","#teamBuildings"]` | Correct |
| AI FSM: `#objAiCPU` → committed-target hunt (findTarget → moveToAttack → attack → attackFin) | Correct |
| No reincarnation (no `#reincarnateAs`) | Correct |
| No runReload / kiting | Correct |
| Grave: `getGraveOn()=true`; dead giant renders `skeletonGiant_grave` strip | Correct |
| Pathfinding enabled (from `#CPUCharacter`) | Correct |
| `weaponMelee` animAction observed while attacking | Correct |
| Attack cadence: ~16 entries in 200 frames (consistent with cooldown=7) | Correct |
| Previous audit's claim `damageMultiplier=8` in resolved form | **WRONG — see DIV-1; actual is 1** |

---

## Summary

One real divergence and one latent structural issue.

**DIV-1** (`dammageMultiplier` typo → `damageMultiplier=1`) is a live combat bug: skeletonGiant deals **8× less melee damage than the original** because the double-m typo in the cast data is not aliased by `resolveAttack`. The same bug affects `skeletonComandoSword` (`dammageMultiplier: 14` also lost).

**DIV-2** (dual `animframe`/`animFrame` key after structAttack merge) is latent — the hit fires on the correct frame 6 today, but it is fragile.

The previous read-only audit of this actor incorrectly asserted `damageMultiplier=8` in the resolved form without running the code.

---

`skeletonGiant | DIVERGENCES=2`  
- DIV-1: `dammageMultiplier` typo → port reads `damageMultiplier=1` instead of 8 (`weapon.ts:194`)  
- DIV-2: dual `animframe`/`animFrame` key in structAttack merge (latent; currently resolves correctly)
