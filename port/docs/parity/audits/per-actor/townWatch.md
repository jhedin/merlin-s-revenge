# Behavioral Audit (REPRODUCED): act_townWatch

**Audit Date**: 2026-06-23
**Method**: REPRODUCTION — throwaway `tools/_audit_townWatch.ts` loaded the real
`@/generated/assets.json`, spawned townWatch (via `spawnUnit`) with a HOSTILE blackOrc target,
ticked ~200f through `rebuildCombatSubstrate` each frame, and OBSERVED sprite/team/hits/cadence/grave.
**Result**: ✅ CLEAN — every observed behavior matches the original. 0 divergences.

---

## Derived spec (original cast/data)

```lingo
[#name: "act_townWatch" ...]
[ #objType:#objCPUCharacter, #AiType:#objAiCPU, #inherit:#CPUCharacter,
  #damageSpeed:2, #dexterity:6, #energy:75, #experienceImWorth:10, #eyestrain:60,
  #inertia:90, #miniMapStatus:#clr, #strength:8, #team:#village, #name:"townWatch",
  #walkSpeed:2, #weapon:#townMace ]
```
```lingo
act_townMace [ #objType:#objPowerUp, #inherit:#weapon, #attack:
  [ #animframe:9, #animType:#weaponMelee, #collisionLoc:point(12,3), #cooldown:0,
    #damageMultiplier:5, #hits:[#teamMembers,#teamBuildings], #idealAttackLoc:point(12,0),
    #name:#townMace, #power:point(2,0), #sound:"skeleton_fire",
    #targetRoles:[[#teamMembers,#teamBuildings]] ] ]
```
- A friendly **#village** CPU melee unit (no own #attack → fights with its **#townMace** weapon).
- #village is in #aldevar.friends ⇒ player-side; #village.hates includes #orcs/#monsters/etc.
- Has its own bundled sprite family (`townWatch_*`).

## Dual-tree evidence

| Aspect | Original (cast/data) | Port (reproduced) | Verdict |
|---|---|---|---|
| Archetype / AI | `#objCPUCharacter` + `#objAiCPU` (committed-target melee hunt) | EnemyArchetype + CpuAI FSM; not ghost/builder/caster/multi/runReload | ✅ FAITHFUL |
| Team / allegiance | `#team:#village` (∈ #aldevar.friends) | `spawnUnit` → **type=ally**, team `#village`, `isPlayerSide('#village')=true` | ✅ FAITHFUL |
| **Sprite by #name** | `#name:"townWatch"` keys `townWatch_*` strips | `spriteCharOr('townWatch')` ⇒ **"townWatch"** (NOT blackOrc); stand/walk/weaponMelee/grave/reel all bundled | ✅ FAITHFUL |
| Attack type | weapon `#animType:#weaponMelee` | resolved `type=melee, animType=#weaponMelee` | ✅ FAITHFUL |
| **#animframe (hits/swing)** | `#animframe:9` (scalar) on a 13-frame strip → one hit per swing on frame 9 | `animFrame=[9]`; observed **9 hits over 200t, exactly 1 per swing** | ✅ FAITHFUL |
| Cadence | `#cooldown:0` ⇒ re-swing as fast as the 13-frame strip replays (Σdelay≈21) | observed swing entries every ~20t, hit gaps **20t** uniform | ✅ FAITHFUL |
| damageMultiplier / power | mult 5, power point(2,0) | `damageMultiplier=5`; enemy-melee base power from strength 8 × mult | ✅ FAITHFUL |
| hits roles | `[#teamMembers,#teamBuildings]` | Targeting.hits `["#teamMembers","#teamBuildings"]` | ✅ FAITHFUL |
| targetRoles | `[[#teamMembers,#teamBuildings]]` | Targeting.targetRoles `[["#teamMembers","#teamBuildings"]]` | ✅ FAITHFUL |
| Targeting found enemy | hunts #village.hates (#orcs) | landed real damage on hostile blackOrc; routed to enemy by team, not ally | ✅ FAITHFUL |
| Reach | melee strike = loc+#collisionLoc, |x|=12 | meleeReach = clamp(12,[16,90]) = **16** (port-wide melee floor, same as farmer); unit walks in then swings | ✅ FAITHFUL (port convention) |
| Death / grave | `#graveOn` default (no override) → grave | on death, anim action → **grave** (`townWatch_grave`, 2-frame one-shot) | ✅ FAITHFUL |
| strength / walkSpeed / inertia / XP | 8 / 2 / 90 / 10 | str 8, walk 2·0.6, inertia 90, experienceImWorth 10 | ✅ FAITHFUL |
| dexterity 6 / eyestrain 60 | ranged-only stats (aim scatter / counter inc) | unused — townWatch is melee (melee uses agility, no scatter) | ✅ FAITHFUL (inert for melee) |
| damageSpeed 2 / miniMapStatus #clr | wall-slam threshold / minimap | damageSpeed forwarded; miniMapStatus on known-omitted list | ✅ FAITHFUL |

## Observed run (probe output, condensed)
- `spriteCharOr('townWatch') => townWatch` (real strip, no blackOrc fallback).
- `spawnUnit('townWatch').type = ally`, team `#village`, `isPlayerSide=true`.
- attack: `type=melee animFrame=[9] damageMult=5 hits=[#teamMembers,#teamBuildings]`.
- 200 ticks vs hostile blackOrc (energy 1200): **9 swings → 9 hits**, hit-gaps uniformly 20t, actions seen `[stand, walk, weaponMelee]`.
- death → action `grave`.

## Conclusion
✅ **CLEAN**. townWatch reproduces faithfully: own bundled sprite (no blackOrc stand-in), correct
ally routing by #village team, melee #townMace with exactly one hit per #animframe-9 swing, cd-0
strip-gated cadence, role-filtered hits, and a grave on death. No port divergences.
(The 12→16 melee-reach clamp is the established port-wide floor applied identically to all short-reach
melee units — e.g. farmer's pitchFork collisionLoc.x=12 — not a townWatch-specific change.)
