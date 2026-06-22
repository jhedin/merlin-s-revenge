# Behavioral Audit: act_kongFuChicken

**Actor:** kongFuChicken | **Type:** #objCPUCharacter | **AiType:** #objAiCPU | **Team:** #karate
**Method:** REPRODUCED in the port (`tools/_audit_kongFuChicken.ts`, since deleted) against the REAL
`@/generated/assets.json` bundle. Spawned with a hostile target, ticked ~200 frames through
`rebuildCombatSubstrate`, and observed sprite resolution / attack hit-count+cadence / move+face+target /
death+grave.

## Derived-correct behavior (from the ORIGINAL)

Source: `casts/data/act_kongFuChicken.txt` (inherits `#CPUCharacter` → `#character` → `#actor`;
template `tem_karate.txt`).

| Property | Original value (file:line) | Meaning |
|----------|----------------------------|---------|
| team | `#team: #karate` (act:27) | enemy team; hates aldevar/cave/monsterSummon/goblins/magicalAlliance/ninja/undead/orcs/village (`tem_karate.txt`) |
| energy | `#energy: 200` (act:21) | health 200 |
| movement | `#walkSpeed: 6` (act:29); `#walkType:#anyDirSpeed`, `#pathfinding:true` (act_CPUCharacter) | omnidirectional pathfinding walker |
| attack type | `#animType: #naturalMelee` (act:9) | natural (unarmed) MELEE, area-resolved |
| weapon | none (no `#weapon`/`#bullet`) — `#punchKick` natural attack only | pure melee brawler |
| #animframe | `[5, 14, 18]` (act:8) | **3 hits per swing**, on frames 5/14/18 of the 28-frame naturalMelee strip |
| power / mult | `#power: point(0.01,0)` (act:15), `#damageMultiplier: 120` (act:10) | very low base power, high multiplier |
| cooldown | `#cooldown: 0` (act:12) | original recovers in ~0 frames (gate ≈ every frame) |
| hits | `#hits:[#teamMembers, #teamBuildings]` (act:13) | strikes BOTH enemy units AND enemy buildings |
| collisionLoc | `point(15,0)` (act) | melee origin 15px ahead |
| sound | `"wizard_punch"` (act) | attack sfx |
| dieSound | `#none` (act) | silent death |
| experienceImWorth | `15` (act) | XP reward on death |
| eyestrain | `25` (act) | aim-scatter — IRRELEVANT (melee, never fires a projectile) |
| weaponTechnique | `#weaponTechnique: 0` (act:30) | **0 → the attack-speedup loop never triggers; NORMAL cadence** |
| startingLevel | `0` (act) | level 0 |
| death | `#objCPUCharacter` default → leaves a grave (`getGraveOn`=true), not a ghost | grave on death |
| AI | `#objAiCPU` (`casts/script_objects/objAiCPU.txt`) | committed-target FSM: findTarget → moveToAttack → attack → attackFin/re-acquire |

## Observed port behavior (REPRODUCED)

- **Sprite resolution:** `spriteCharOr("kongFuChicken")` → `kongFuChicken` (OWN art, NO `_stand`/blackOrc
  fallback). All required strips are bundled in assets.json:
  `kongFuChicken_stand` (1f, loop), `_walk` (6f, loop), `_naturalMelee` (28f, one-shot),
  `_reel` (1f), `_grave` (2f). Every action resolves to a real strip.
- **Resolved stats:** team `#karate`, energy 200, animChar `kongFuChicken`, imWorth 15, melee attack
  `#punchKick` animFrame `[5,14,18]`, power 0.01, mult 120, hits `[#teamMembers,#teamBuildings]`,
  sound `wizard_punch`, collisionLoc `(15,0)`.
- **Attack:** in melee reach it enters the swing and lands **exactly 3 hits per swing** on internal
  frames 5 / 14 / 18 (faithful to `#animframe`), ~2.16 dmg each (power·strength·scale·mult, inertia-
  damped), then `attackFin` re-acquires. Cadence over 200 frames: hits at 5,17,24 | 58,70,77 |
  111,123,130 | 164,176,183 — clean repeating 3-hit swings.
- **Move / target / face:** with a distant target to the RIGHT it pathfinds toward it (dx +137 over 40
  ticks), `facingLeft=false` (faces the target), aiMode `moveToAttack`, target committed.
- **Death / grave:** lethal `takeHit` → `isDead=true`, `getGraveOn=true`, `kongFuChicken_grave` strip
  resolves. Leaves a grave (not a ghost), as derived.
- **weaponTechnique:** runtime `technique = 0` → no frame-skip, normal punch cadence (matches data).

## Divergences

**NONE behavioral.** kongFuChicken reproduces faithfully end-to-end.

### Faithful calibrations (NOT divergences — global, documented, apply to every enemy)
- **cooldown 0 → effective 6.** `spawnEnemy` re-derives an effective melee cooldown
  (`framesWanted = ceil((cooldown-1)/agility)+6`, then `round(·×agility+1)` →
  `port/src/entities/archetypes.ts:194-223`). For `#cooldown:0` this yields 6. Documented B2 §f.3
  enemy-cadence calibration applied uniformly; NOT specific to this actor.
- **walkSpeed 6 → 3.6 px/tick.** `walkSpeed*0.6` engine→px slice conversion
  (`port/src/entities/archetypes.ts:308`), applied to every enemy. Faithful by design.

### Non-behavioral (doc-only) note — port-side comment mislabel
- `port/src/components/weaponTechnique.ts:6` comment reads *"kongFuChicken = 200 (very fast)"*. This is
  **incorrect**: `casts/data/act_kongFuChicken.txt:30` gives `#weaponTechnique: 0`, while the value 200
  belongs to **`act_sumo`** (`casts/data/act_sumo.txt:32`). The CODE is correct — it reads
  `cfg["weaponTechnique"]` and the probe confirmed kongFuChicken runtime technique=0 (sumo=200). Only the
  comment is misattributed; no behavioral impact (candidate doc cleanup, not a behavior bug).

## Status: CLEAN — faithful reproduction, 0 behavioral divergences.
