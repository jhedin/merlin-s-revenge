# Behavioral Audit: act_blackOrc

**Audit Date**: 2026-06-22
**Method**: REPRODUCED — spawned + ticked 200 frames via a live probe; all findings are observed, not inferred.

---

## 1. Identity / Inheritance Chain

```
act_blackOrc
  #inherit: #CPUCharacter
    #inherit: #character
      #inherit: #actor
  #weapon: #blackAxe
    #inherit: #weapon
      #inherit: #actor
```

**Resolved properties** (original cast files, line refs):
- `act_blackOrc.txt:3` — `#objType: #objCPUCharacter`
- `act_blackOrc.txt:4` — `#AiType: #objAiCPU`
- `act_blackOrc.txt:6` — `#character: #friendlyCharacter`
- `act_blackOrc.txt:7` — `#damageSpeed: 4`
- `act_blackOrc.txt:8` — `#dexterity: 3` (ranged stat; weapon is melee so this does NOT gate cooldown — agility=1 governs)
- `act_blackOrc.txt:9–10` — `#dieSound: "blackOrc_die"`, `#dieVolume: 50`
- `act_blackOrc.txt:11` — `#energy: 1200`
- `act_blackOrc.txt:12` — `#experienceImWorth: 50`
- `act_blackOrc.txt:13` — `#frictionReel: point(20,20)`
- `act_blackOrc.txt:14` — `#inertia: 80`
- `act_blackOrc.txt:17` — `#strength: 30`
- `act_blackOrc.txt:18` — `#team: #monsters`
- `act_blackOrc.txt:20` — `#walkSpeed: 6`
- `act_blackOrc.txt:21` — `#weapon: #blackAxe`
- `act_CPUCharacter.txt:6` — `#pathfinding: true`
- `act_CPUCharacter.txt:7` — `#walkType: #anyDirSpeed`
- `act_character.txt:4` — `#agility: 1` (melee cooldown rate)

**Weapon: act_blackAxe.txt**
- `#animType: #weaponMelee` — melee contact attack
- `#animframe: 8` — the hit fires on frame 8 of the weaponMelee strip (1-based)
- `#collisionLoc: point(70,0)` — the strike point is 70px in front of the orc (large reach)
- `#idealAttackLoc: point(70,0)` — target approach stop-point is 70px in front of the orc
- `#cooldown: 0` (raw; the original engine added an agility-based recovery)
- `#damageMultiplier: 3`
- `#power: point(1,0)` — knockback/damage vector
- `#sound: "blackOrc_fire"` (plays when attack fires, NOT on death)
- `#hits: [#teamMembers, #teamBuildings]`
- NO `#reach` field — reach is governed by `collisionLoc` in the original engine

---

## 2. Correct Behavior (Derived from Original)

| Property | Value | Source |
|----------|-------|--------|
| Team | #monsters | act_blackOrc.txt:18 |
| Energy | 1200 HP | act_blackOrc.txt:11 |
| Strength | 30 | act_blackOrc.txt:17 |
| WalkSpeed | 6 engine units | act_blackOrc.txt:20 |
| Inertia | 80% (very tanky) | act_blackOrc.txt:14 |
| ExperienceImWorth | 50 XP | act_blackOrc.txt:12 |
| DieSound | "blackOrc_die" | act_blackOrc.txt:9 |
| AiType | #objAiCPU (committed-target hunt) | act_blackOrc.txt:4 |
| Attack type | weaponMelee (no ranged, no magic) | act_blackAxe.txt:8 |
| Attack fire frame | frame 8 of weaponMelee strip | act_blackAxe.txt:7 |
| Attack reach (approach gate) | ~54px effective (collisionLoc 70 − target half-box ~16) | act_blackAxe.txt:9 |
| Damage multiplier | 3 | act_blackAxe.txt:11 |
| Attack sound | "blackOrc_fire" | act_blackAxe.txt:16 |
| RunReload | false (no kiting) | not set in data |
| Ghost | false | not set |
| Pathfinding | true (from #CPUCharacter) | act_CPUCharacter.txt:6 |

**Animations (all present in assets.json)**:
| Strip | Frames | Delays | Notes |
|-------|--------|--------|-------|
| `blackOrc_stand` | 1 | delay=3 | idle |
| `blackOrc_walk` | 8 | delay=3 each | movement |
| `blackOrc_weaponMelee` | 9 | [1,1,3,2,1,1,1,1,5] = 16 ticks total | attack; frame 8 fires the hit |
| `blackOrc_grave` | 2 | delay=1 each | death marker |

No `blackOrc_dead` or `blackOrc_reel` strip (reel falls back to stand per Anim logic; death goes straight to grave).

---

## 3. Reproduced Behavior (Port — Observed)

**Probe setup**: spawned blackOrc at (300,200), player at (200,200) = 100px apart; 200-frame tick loop.
All observations from `port/tools/_audit_blackOrc.ts` (deleted after run).

| Aspect | OBSERVED in Port |
|--------|-----------------|
| Sprite char | `blackOrc` (stand strip found; no fallback) |
| Animation strips | stand/walk/weaponMelee/grave all resolve to real bundled art |
| AI mode at t=0 | `moveToAttack` (target acquired immediately on first tick) |
| Target acquisition | Committed to player on tick 0; maintained for 200+ frames |
| Movement | Moves toward player (intentX/Y nonzero while approaching) |
| Attack fires | Frame 15–23 (after closing distance); `weaponMelee` animAction observed |
| Attack cadence | 13 hits in 200 frames (~1 per 15 frames) |
| Per-hit damage to player | ~16.2 HP (damageMultiplier 3 applies; enemy-side scale) |
| animFrame resolution | `[8]` (correctly reads `animframe:8` from data) |
| Grave | `getGraveOn()=true`; Anim picks `grave` action and holds frame when dead |
| DieSound | `"blackOrc_die"` in `Energy.dieSound` |
| Team | `#monsters` |
| Energy | 1200 |
| Inertia | 80 |
| WalkSpeed (maxSpeed) | 3.6 px/tick (= 6 × 0.6 conversion — correct) |
| Cooldown | 7 ticks (= round(max(1, 0+6) × agility(1) + 1)) |

---

## 4. Divergences

### DIV-1 — Melee approach reach: port stops at ~22px; original stops at ~54px

**Severity**: Observable — the blackOrc must walk much closer to the player before it swings, making it easier to dodge and changing the feel of the fight.

**Original** (`act_blackAxe.txt:9`):
```
#collisionLoc: point(70,0)
#idealAttackLoc: point(70,0)
```
In the Lingo engine `objAiAttack.calcIdealAttackLoc` uses `idealAttackLoc` to compute where to stop approaching (target_loc + idealAttackLoc offset = 70px in front of the target). `targetInReachMelee` checks whether `calcStrikePoint(faceDir)` (= `loc + collisionLoc×faceDir`) falls inside the target's collision rect. With `collisionLoc.x = 70` and a target half-box of ~16px, the blackOrc is in-reach when it is approximately **54px away** from the target center.

**Port** (`port/src/entities/archetypes.ts:279-281`):
```ts
const rch = atk["reach"];                   // reads the structAttack-merged field
const targetReach = typeof rch === "number" ? rch : ...;
```
The `blackAxe` attack record has NO explicit `reach` field. `structAttack` fills it with the default **25**. `spawnEnemy` passes this as `atkReach`, then `CpuAI.init` clamps it: `reach = max(16, min(40, 25)) = 25`. The port also does NOT implement `calcIdealAttackLoc` (the offset stop-point) — the orc beelines to the exact target location and attacks when within 25px. **Observed**: orc attacks at ~21.6px.

**Fix sketch**: Derive the melee approach threshold from `collisionLoc.x` (the strike offset) minus a standard target half-box (~16px), i.e. `atkReach = max(16, collisionLoc.x - 16)`. For `blackAxe`: `max(16, 70-16) = 54`. Remove the `min(40, ...)` cap (or raise it) for large-collisionLoc weapons. `calcIdealAttackLoc` can be approximated by pathing to `target_loc + collisionLoc_offset` instead of the raw target loc. Affected actors with the same issue: hydra2/hydra3 (collisionLoc 35,5), skelitonLordSword (80,15), skelitonSword (15,40).

**Original line**: `act_blackAxe.txt:9` (`#collisionLoc: point(70,0)`), `casts/script_objects/objAiAttack.txt:75-93` (`calcIdealAttackLoc`), `objAiCPU.txt:379-394` (`targetInReachMelee`).
**Port line**: `port/src/entities/archetypes.ts:279-281`, `port/src/components/control.ts:495-498` (`CpuAI.init` reach clamping), `port/src/components/control.ts:658` (`targetInReach`).

---

### DIV-2 — `animframe:8` key case: data carries both `animframe` and `animFrame` after structAttack merge

**Severity**: Latent / currently non-impacting (resolveAttack reads `animframe` first and gets the correct `[8]`).

**Original** (`act_blackAxe.txt:7`): `#animframe: 8` (lowercase `f`).

**Port** (`port/src/generated/data.json` / registry.ts `deepModify`): After `#attack` schema merge the record ends up with BOTH `animframe: 8` (from data) AND `animFrame: 2` (from `structAttack` which uses camelCase `animFrame`). `resolveAttack` in `weapon.ts:178` reads `r["animframe"] ?? r["animFrame"]` — the lowercase key wins, giving the correct `[8]`. If the resolution order were reversed or the data parser normalised keys to camelCase, the wrong value `2` would be used.

**Fix sketch**: Normalise the `deepModify` / `resolveActor` pipeline to consistently fold `animframe` -> `animFrame` during merge so only one key exists in the resolved record. Lower urgency since the current read order is correct.

**Original line**: `act_blackAxe.txt:7`.
**Port line**: `port/src/data/registry.ts:47-53` (`deepModify`), `port/src/components/weapon.ts:178` (`resolveAttack animFrame read`).

---

## 5. Confirmed Correct

| Aspect | Status |
|--------|--------|
| Sprite + all animation strips (stand/walk/weaponMelee/grave) | All present and named correctly in assets.json |
| `spriteCharOr("blackOrc")` → `"blackOrc"` (no fallback) | Correct |
| `animFrame = [8]` (fires on frame 8 of weaponMelee) | Correct — resolveAttack reads `animframe:8` |
| Attack type: melee (not ranged, not magic) | Correct |
| `ranged=false`, `runReload=false`, `ghost=false` | Correct |
| Team `#monsters`, role `#teamMembers` | Correct |
| Energy 1200 | Correct |
| Strength 30, power resolved from `point(1,0)` | Correct |
| Inertia 80 (takes 20% effective damage per hit) | Correct |
| walkSpeed → maxSpeed = 3.6 px/tick (6 × 0.6 conversion) | Correct |
| agility=1 governs melee cooldown (dexterity=3 is unused for melee) | Correct |
| Cooldown = 7 ticks | Correct |
| AtkSound `"blackOrc_fire"` wired in CpuAI | Correct |
| DieSound `"blackOrc_die"` in Energy | Correct |
| ExperienceImWorth 50 | Correct |
| Grave: `getGraveOn()=true`; dead orc renders `blackOrc_grave` strip | Correct |
| AI FSM: `#objAiCPU` → committed-target hunt (findTarget → moveToAttack → attack) | Correct |
| No reincarnation, no special AI flags | Correct |
| Pathfinding enabled (from CPUCharacter) | Correct |
| `hits: ["#teamMembers","#teamBuildings"]` | Correct |
| damageMultiplier 3 | Correct |

---

## Summary

The prior read-only audit missed two divergences that only surface at runtime.

**DIV-1** (reach) is behaviorally observable: the blackOrc walks ~32px closer than it should before swinging. This applies equally to all melee actors whose `collisionLoc.x` significantly exceeds the structAttack `reach` default of 25 (`skelitonLordSword`, `hydra2/3`, `skelitonSword`).

**DIV-2** (dual animframe key) is currently latent but is a fragile code smell that would break if the key-resolution order changed.
