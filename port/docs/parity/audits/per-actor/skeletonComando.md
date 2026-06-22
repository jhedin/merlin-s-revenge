# Actor Parity Audit: skeletonComando

**Date:** 2026-06-22
**Actor:** skeletonComando
**Sources:** casts/data/act_skeletonComando.txt, casts/data/act_skeletonComandoSword.txt,
  casts/script_objects/objAiCPU.txt, casts/script_objects/objAiAttack.txt,
  casts/script_objects/modAttack.txt, casts/script_objects/objCPUCharacter.txt,
  casts/script_objects/modEnergy.txt, port/src/entities/archetypes.ts
**Probe:** port/tools/_audit_skeletonComando.ts (run 2026-06-22, deleted after run)
**Probe result:** 66 PASS, 13 FAIL (all 13 are cascades of one root divergence)

---

## 1. Derived (Original)

### Identity and Team
- `#objType: #objCPUCharacter`, `#AiType: #objAiCPU`
- `#inherit: #CPUCharacter` (adds frictionReel point(10,10), pathfinding, walkType:#anyDirSpeed)
- `#team: #undead` — hostile to #aldevar
- No `#collisionDetection:false`, no `#reincarnateAs`, no `#leaveWhenFinished`

### Stats
| Property | Value | Source |
|----------|-------|--------|
| energy | 275 | act_skeletonComando |
| strength | 12 | act_skeletonComando |
| dexterity | 4 | act_skeletonComando |
| eyestrain | 30 | act_skeletonComando |
| inertia | 65 | act_skeletonComando |
| walkSpeed | 8 | act_skeletonComando (overrides CPUCharacter 3) |
| experienceImWorth | 20 | act_skeletonComando |
| damageSpeed | 5 | act_skeletonComando |
| stallSpeed | 4 | act_skeletonComando |
| frictionReel | point(10,10) | from #CPUCharacter |

### Sprite / Animations
Art char is `skeletonComando`. Confirmed bundled strips:
- `skeletonComando_stand` (1 frame), `skeletonComando_walk` (7 frames)
- `skeletonComando_weaponMelee` (7 frames, dela=1 each)
- `skeletonComando_reel` (2 frames), `skeletonComando_grave` (2 frames)
No death strip; death plays the grave strip (`objCPUCharacter.flasherFinished` → `drawGrave`).

### AI (objAiCPU / objAiAttack)
Committed-target melee FSM: `findTarget → moveToAttack → attack (weaponMelee strip) → attackFin → findTarget`.
- `targetInReachMelee`: checks `calcStrikePoint(±1)` inside target's collision rect.
- `calcStrikePoint`: `loc + collisionLoc`, so reach = |collisionLoc.x| = 27 px.
- No `#runReload`, no `#multiAttack`, not ranged, not a ghost.

### Weapon: skeletonComandoSword (act_skeletonComandoSword.txt)
| Field | Original value | Notes |
|-------|---------------|-------|
| `#animType` | `#weaponMelee` | → attack type melee |
| `#animframe` | 3 | hit fires on strip frame 3 (1-based) |
| `#cooldown` | 0 | raw; effective = rawCooldown+6 frames × agility(1) + 1 = 7 |
| `#collisionLoc` | point(27, -3) | strike point offset; melee reach = 27 px |
| `#power` | point(1, 0) | melee knockback magnitude |
| `#hits` | [#teamMembers, #teamBuildings] | targets buildings too |
| `#sound` | "skeleton_fire" | plays on swing |
| `#dammageMultiplier` | 14 | **TYPO — see WONTFIX below** |

### damageMultiplier WONTFIX
`act_skeletonComandoSword.txt` has `#dammageMultiplier: 14` (double-m).
`modEnergy.txt:276` reads `attackingObj.getAttack().damageMultiplier` (correctly spelled).
The `deepModify` in registry merges the typo'd key `dammageMultiplier` into the structAttack record, but
`structAttack.damageMultiplier` (correct spelling) stays at its default value 1.
`resolveAttack` reads `r["damageMultiplier"]` (correct) → 1.
Result: the multiplier the engine actually uses is **1** in both the original engine and the port.
The typo key `dammageMultiplier:14` is dead code in both. **Port is faithful. WONTFIX.**

### Death / Grave / Reincarnation
On lethal hit: `flasherFinished` → `goMode(#finish)` + `drawGrave()` + `setDead(true)`.
Grave strip: `skeletonComando_grave` (2 frames).
No `#reincarnateAs`, no `#minEnergy` — standard single-stage death.
No `#leaveWhenFinished` — does not teleport out on room clear.

---

## 2. Reproduce (Probe Results)

Probe ran 200 frames with a player at 260px and skeletonComando at 200px. Key observations:

| Check | Expected | Got | Status |
|-------|----------|-----|--------|
| entity.type | "enemy" | "enemy" | PASS |
| team | "#undead" | "#undead" | PASS |
| energy | 275 | 275 | PASS |
| walkSpeed (px/tick) | 4.8 | 4.8 | PASS |
| inertia | 65 | 65 | PASS |
| damageSpeed | 5 | 5 | PASS |
| frictionReel | 10 | 10 | PASS |
| EnemyAI.ranged | false | false | PASS |
| EnemyAI.runReload | false | false | PASS |
| EnemyAI.ghost | false | false | PASS |
| EnemyAI.reach | 27 | 27 | PASS |
| EnemyAI.eyestrain | 30 | 30 | PASS |
| attack.damageMultiplier | 1 | 1 | PASS (WONTFIX typo) |
| Grave present + active | true | true | PASS |
| Experience.imWorth | 20 | 20 | PASS |
| All 5 animation strips | present | present | PASS |
| No bullets spawned (melee) | true | true | PASS |
| Hits landed on player | >0 | 11/200t | PASS |
| FSM enters moveToAttack | true | true | PASS |
| **attack.animType** | **#weaponMelee** | **#naturalMelee** | **FAIL** |
| **attack.animFrame** | **[3]** | **[2]** | **FAIL** |
| **attack.cooldown** | **7** | **19** | **FAIL** |
| **attack.powerX/Y** | **1, 0** | **5, -1** | **FAIL** |
| **attack.powerScalar** | **1** | **6** | **FAIL** |
| **attack.collisionLoc** | **{27,-3}** | **{25,0}** | **FAIL** |
| **attack.hits[1]** | **#teamBuildings** | **undefined** | **FAIL** |
| **attack.sound** | **skeleton_fire** | **#none** | **FAIL** |
| **attack.cooldown effective** | **7** | **19** | **FAIL** |
| **animAction during swing** | **"weaponMelee"** | **(not seen)** | **FAIL** |
| **avg damage/hit** | **~2.16** | **~12.96** | **FAIL** |

---

## 3. Divergences

### DIVERGENCE 1 (root): `hasAttack` guard rejects weapon attack when `#name` is a `$global` reference

**File:** `port/src/entities/archetypes.ts`, line 207
**Root cause:** `act_skeletonComandoSword.txt` uses an unquoted bare symbol for `#name`:
```
#name: skeletonComandoSword   (no quotes — Lingo bare symbol -> resolves as a global variable)
```
The data parser serialises this as `{ "$global": "skeletonComandoSword" }` in `data.json`. The
`hasAttack` guard at archetypes.ts:207 checks:
```typescript
typeof atk["name"] === "string" && atk["name"] !== "#none"
```
`atk["name"]` is `{ $global: "skeletonComandoSword" }` (an object), so `typeof ... === "string"` is
`false`, making `hasAttack = false`. The code then falls back to the synthetic attack:
```typescript
resolveAttack({ name: "#natural", animType: "#naturalMelee", cooldown: fallbackCooldown })
```
with `fallbackCooldown = Math.round(18 * 1 + 1) = 19`.

**All 13 failed checks are cascades of this single guard:**

| Diverged property | Original | Port gets (fallback) |
|-------------------|----------|---------------------|
| animType | `#weaponMelee` | `#naturalMelee` |
| animFrame | `[3]` | `[2]` (structAttack default) |
| effectiveCooldown | 7 (rawCooldown 0 + 6 = 6 × 1 + 1) | 19 (fallback 18×1+1) |
| powerX / powerY | 1, 0 | 5, −1 (structAttack default) |
| powerScalar | 1 | 6 |
| collisionLoc | {27, −3} | {25, 0} (structAttack default) |
| hits[1] | "#teamBuildings" | absent (structAttack hits=[#teamMembers]) |
| sound | "skeleton_fire" | "#none" |
| animAction during swing | "weaponMelee" | not visible (naturalMelee, probe checks exact string) |
| damage per hit | ~2.16 | ~12.96 (powerScalar 6 × str 12 × 0.18) |

**Fix:** In `archetypes.ts:207`, broaden the name check to accept `$global` objects (extract the
string value) or simply accept any non-null `name` field when `animType` is already set:
```typescript
// Before:
const hasAttack = animType !== "" && typeof atk["name"] === "string" && atk["name"] !== "#none";
// After (tolerate $global name references — Lingo bare-symbol names in weapon records):
const nameVal = atk["name"];
const nameStr = typeof nameVal === "string" ? nameVal
  : (nameVal && typeof nameVal === "object" && "$global" in nameVal)
    ? String((nameVal as any)["$global"]) : "";
const hasAttack = animType !== "" && nameStr !== "" && nameStr !== "none" && nameStr !== "#none";
```
This makes `hasAttack = true` for skeletonComandoSword and any other weapon whose Lingo `#name` was
an unquoted bare symbol, restoring all 13 failed checks to their correct values.

---

## 4. Non-Divergences / WONTFIX

### dammageMultiplier typo (WONTFIX)
Original cast: `#dammageMultiplier: 14` (double-m). Engine reads `damageMultiplier` (correct spelling)
at `modEnergy.txt:276`. The typo key is dead in the original. `structAttack.damageMultiplier` defaults
to 1 in both original and port. Port is faithful — the probe confirmed `attack.damageMultiplier = 1`.

### findTarget not observed in 200-tick probe (non-issue)
The probe's `modesSeen` set did not include `"findTarget"` because on tick 0 the target was already
found and the mode immediately entered `moveToAttack`. This is a timing artefact of the short probe
window, not a behavioural divergence.

---

## Summary

| Category | Count |
|----------|-------|
| Real divergences (root causes) | 1 |
| Cascade failures from that root | 12 |
| WONTFIX (faithful to original) | 1 |
| Total probe checks: PASS | 66 |
| Total probe checks: FAIL | 13 |

**Status: DIVERGENCES=1** (one root cause; 12 cascades; all fixable by one line change in archetypes.ts)

---

`skeletonComando | DIVERGENCES=1`
- DIV-1: `hasAttack` guard in `archetypes.ts:207` rejects weapon when `#name` is a `$global` object (bare Lingo symbol `skeletonComandoSword`) — all weapon params fall back to synthetic `#natural` attack (wrong animType, animFrame, cooldown, power, collisionLoc, hits, sound)
