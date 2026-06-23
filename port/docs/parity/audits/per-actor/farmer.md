# Behavioral Audit (REPRODUCED): act_farmer

**Audit Date**: 2026-06-23
**Method**: REPRODUCTION — throwaway `tools/_audit_farmer.ts` loaded the real
`@/generated/assets.json`, spawned farmer (via `spawnUnit`) with a HOSTILE blackOrc target placed in
melee range, ticked ~200f through `rebuildCombatSubstrate` each frame, and OBSERVED
sprite/team/hits-per-#animframe/reach/cadence/grave. A second farmer was killed to observe the death→grave path.
**Result**: ✅ CLEAN — every observed behavior matches the original. 0 divergences.

---

## Derived spec (original cast/data)

```lingo
[#name: "act_farmer" ...]
[ #objType:#objCPUCharacter, #AiType:#objAiCPU, #inherit:#CPUCharacter,
  #damageSpeed:3, #dexterity:3, #experienceImWorth:4, #eyestrain:30, #inertia:30,
  #miniMapStatus:#clr, #strength:3, #team:#village, #name:"farmer",
  #walkSpeed:4, #weapon:#pitchFork ]
```
```lingo
act_pitchFork [ #objType:#objPowerUp, #inherit:#weapon, #attack:
  [ #animframe:3, #animType:#weaponMelee, #collisionLoc:point(12,2), #cooldown:30,
    #damageMultiplier:5, #hits:[#teamMembers,#teamBuildings], #idealAttackLoc:point(12,2),
    #name:#pitchFork, #power:point(.3,.3), #sound:"skeleton_fire" ] ]
```
- A friendly **#village** CPU melee unit (no own #attack → fights with its **#pitchFork** weapon).
- #village ∈ #aldevar.friends ⇒ player-side; #village.hates includes #orcs/#monsters/#undead/etc.
- Has its own bundled sprite family (`farmer_stand/walk/weaponMelee/grave`). **No `farmer_reel` strip**
  (unlike townWatch) — but the inherited CPUCharacter reel/recoil is animation-only; absence is cosmetic.

## Dual-tree evidence

| Aspect | Original (cast/data) | Port (reproduced) | Verdict |
|---|---|---|---|
| Archetype / AI | `#objCPUCharacter` + `#objAiCPU` (committed-target melee hunt) | EnemyArchetype + CpuAI FSM; not ghost/builder/caster/multi/runReload | ✅ FAITHFUL |
| Team / allegiance | `#team:#village` (∈ #aldevar.friends) | `spawnUnit` → **type=ally**, team `#village`, `isPlayerSide('#village')=true` | ✅ FAITHFUL |
| **Sprite by #name** | `#name:"farmer"` keys `farmer_*` strips | `spriteCharOr('farmer') ⇒ "farmer"` (NOT blackOrc); stand/walk/weaponMelee/grave all bundled | ✅ FAITHFUL |
| Attack type | weapon `#animType:#weaponMelee` | resolved `type=melee, animType=#weaponMelee` | ✅ FAITHFUL |
| **#animframe (hits/swing)** | `#animframe:3` (scalar) on a 5-frame weaponMelee strip → one hit per swing on frame 3 | resolved `animFrame=[3]`; observed **5 hits over 200t across 6 swing-entries = exactly 1 hit/swing** (6th swing not yet past frame 3 at the 200t cutoff) | ✅ FAITHFUL |
| Cadence | `#cooldown:30` → swing replays gated by cooldown recovery + fire-frame offset | observed hit-gaps uniformly **39t** (5 hits at t=14,53,92,131,170) | ✅ FAITHFUL |
| damageMultiplier / power | mult 5, power point(.3,.3) | `damageMultiplier=5`, `powerScalar=0.6`; enemy-melee base = 0.6·str(3)·ENEMY_SCALE × mult 5 | ✅ FAITHFUL |
| hits roles | `[#teamMembers,#teamBuildings]` | Targeting.hits `["#teamMembers","#teamBuildings"]` | ✅ FAITHFUL |
| targetRoles | `[[#teamMembers,#teamBuildings]]` | Targeting.targetRoles `[["#teamMembers","#teamBuildings"]]` | ✅ FAITHFUL |
| Targeting found enemy | hunts #village.hates (#orcs/#monsters) | `findTarget` returned the hostile (type=enemy, dist≈10); landed real damage on it, not an ally | ✅ FAITHFUL |
| Reach | melee strike = #collisionLoc.x = 12 | `Targeting.reach=16` = clamp(12,[16,90]) — port-wide melee floor, same as townWatch; unit walks in then swings | ✅ FAITHFUL (port convention) |
| Death / grave | `#graveOn` default (no override) → grave | killed farmer2 → action sequence `[grave]`, `farmer_grave` (2-frame one-shot) held; animChar stays `farmer` | ✅ FAITHFUL |
| strength / walkSpeed / inertia / XP | 3 / 4 / 30 / 4 | str 3, walk 4·0.6, inertia 30, experienceImWorth 4 | ✅ FAITHFUL |
| dexterity 3 / eyestrain 30 | ranged-only stats (aim scatter / look counter) | unused — farmer is melee (no scatter); recorded | ✅ FAITHFUL (inert for melee) |
| damageSpeed 3 / miniMapStatus #clr | wall-slam threshold / minimap | damageSpeed forwarded; miniMapStatus on known-omitted list | ✅ FAITHFUL |

## Observed run (probe output, condensed)
- `spriteCharOr('farmer') => farmer` (real strip, no blackOrc fallback). Strips present:
  `farmer_stand(1f) walk(4f) weaponMelee(5f,one-shot) grave(2f,one-shot)`; `farmer_reel` absent (cosmetic).
- `spawnUnit('farmer').type = ally`, team `#village`, `isPlayerSide=true`.
- resolved attack: `type=melee animType=#weaponMelee animFrame=[3] reach=25(data)/16(strike) damageMult=5 powerScalar=0.6 hits=[#teamMembers,#teamBuildings]`.
- 200 ticks vs adjacent hostile blackOrc (energy frac 1 → survives): **6 swing-entries, 5 hits** on the
  target, hit-ticks `[14,53,92,131,170]`, uniform **39t** gaps → exactly one hit per #animframe-3 swing
  (the 6th swing simply hadn't crossed frame 3 by t=200). Actions seen `[stand, walk, weaponMelee]`.
- `findTarget` → enemy at dist≈10; `village hates` = blackSorcerer/goblins/karate/…/orcs.
- death (loseEnergy 99999) → action `grave`, animChar stays `farmer`.

> Note on the data dump: the raw pitchFork record carries BOTH a struct-default `animFrame:2` and the
> real Lingo `animframe:3`. `resolveAttack` reads `r["animframe"]` FIRST, so the effective firing frame
> is **3** (verified: resolved `AttackData.animFrame=[3]`). Not a divergence.

## Conclusion
✅ **CLEAN**. farmer reproduces faithfully: own bundled `farmer_*` sprite (no blackOrc stand-in),
correct ally routing by #village team, melee #pitchFork with exactly one hit per #animframe-3 swing,
cooldown-30 gated cadence (39t), role-filtered hits, and a `farmer_grave` on death. No port divergences.
(The 12→16 melee-reach floor is the established port-wide clamp applied identically to all short-reach
melee units — e.g. townWatch's townMace collisionLoc.x=12 — not a farmer-specific change.)
