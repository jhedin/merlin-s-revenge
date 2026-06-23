# Per-Actor Parity Audit: bat (+ caveBat / batBullet / batTree)

**Audit Date:** 2026-06-23
**Method:** Behavior derived purely from the ORIGINAL cast/data, then REPRODUCED in the port via a node
harness (`tools/_audit_bat.ts`, since deleted) that loaded the REAL `src/generated/assets.json`, spawned a
bat (+ batTree) with an inert `#aldevar` target (player dummy; `#cave` hates `#aldevar`), wired
`game.spawnEnemy/spawnUnit/spawnAlly`, pushed actors to `game.entities`, and ticked through
`rebuildCombatSubstrate()` + full component update (~260 frames; bullets ticked to move).

**Original spec:** `casts/data/act_bat.txt`, `act_caveBat.txt`, `act_batBullet.txt`, `act_batTree.txt`,
`act_CPUCharacter.txt`, `act_actor.txt`; `casts/script_objects/objAiCPU.txt`, `objAiAttack.txt`,
`modAttack.txt`, `objBullet.txt`, `objCPUCharacter.txt`, `objMoveXY.txt`,
`casts/general_functions/varValRange ().txt`.

---

## SECTION 1 — Derived-correct behavior (from the original)

### bat — `casts/data/act_bat.txt`
| Property | Original value | Source |
|---|---|---|
| objType / AiType / inherit | `#objCPUCharacter` / `#objAiCPU` / `#CPUCharacter` | act_bat.txt:3-5 |
| team / character | `#cave` / `#friendlyCharacter` | act_bat.txt:29,18 |
| energy / strength / dexterity | 50 / 6 / 3 | act_bat.txt:22,28,21 |
| walkSpeed / inertia / damageSpeed | 12 / 60 / 4 | act_bat.txt:31,24,20 |
| experienceImWorth | **4** | act_bat.txt:23 |
| **collisionDetection** | **false** → DRIFTS through terrain | act_bat.txt:19 |
| **runReload** | **true** → kites away while reloading | act_bat.txt:26 |
| stallSpeed (character) | 2 | act_bat.txt:27 |
| `#name` (sprite char) | **"bat"** | act_bat.txt:30 |
| attack `#dropPoo` | `#naturalRanged`, **#animframe: 2** (single int → 1 shot/cycle), bullet `#batBullet`, reach 80, cooldown 80, firingType `#fullstrength`, collisionLoc(0,-2), sound `#none` | act_bat.txt:6-17 |

### caveBat — `casts/data/act_caveBat.txt`
Identical to `bat` EXCEPT **`collisionDetection: true`** (does NOT drift) and **`experienceImWorth: 10`**
(act_caveBat.txt:19,23). Note: BOTH actors carry `#name: "bat"` — they share the bat sprite; only the
record KEY differs.

### batBullet — `casts/data/act_batBullet.txt`
inherit `#bullet`; `#character:#bullet`; `#name:"batBullet"`; attack `#bullet` power 0.6 / damageMultiplier 3;
**`#friction: point(4,4)`**; weight 0.4; `#recordInRoomState:false`. No `#stallSpeed` → inherits objBullet's
`point(2,2)` (objBullet.new). The bullet has no `_stand` strip; it renders via the `batBullet_fly`/`_land`
projectile path.

### batTree — `casts/data/act_batTree.txt`
`#objDwelling`, energy 100, experienceImWorth 20, team `#cave`, totalResidents 10, dieSound `tree_die`,
frictionReel(100,100). residentGroups: `#bat` buildTime[20,30] groupSize[1,6] releaseInterval[10,50].

**Derived bat behavior:** a `#cave` ranged flyer. Approaches to within reach 80, drops one poo-bullet per
attack animation on strip frame 2, then (runReload) RETREATS from the target while the 80-frame cooldown
recovers, then re-approaches and fires again — classic kiting. Drifts through walls. Bullet is fired at
`#fullstrength` (speed ≈ strength = 6), decays 4% of speed/frame (`VarValRange(4,[0,speed])` = 4%, NOT a
flat 4 units — confirmed `varValRange ().txt:4-20`), and lands when it stalls below stallSpeed 2. Dies to a
grave; energy 50.

---

## SECTION 2 — Observed in the port (REPRODUCED)

```
SPRITE CHAR:  bat -> "bat"   (REAL bundled bat_stand/walk/naturalRanged/grave strips — NOT blackOrc)
              batTree -> "batTree"   batBullet -> proj char "batBullet" (batBullet_fly/_land bundled)
              caveBat record resolves -> #name "bat", experienceImWorth 10  (distinct from bat's 4) ✓

CONFIG:  attack {name:#dropPoo type:ranged animType:#naturalRanged animFrame:[2] reach:80
                 cooldown:85* firingType:#fullstrength bullet:#batBullet}  team:#cave  type:enemy
         passThrough:true (collisionDetection:false → drift)  runReload:true  energy 50/50
         (* cooldown 85 = port's effective-cooldown calibration of the data's 80 + fire-frame offset)

SHOT COUNT:  1 shot per attack cycle (animframe is single [2], not a list) — 5 shots over 5 cycles ✓
             shot ticks [16,71,127,183,238]; gaps ~55-56t (cooldown + kite cycle)

KITING:  bat approaches target@360 to x≈296 (dist 64 < reach 80), FIRES at t=16, then RETREATS
         x: 296→254→182→149 (t22→50) while reloading, then re-approaches x→285 (t70) and fires again. ✓
         (objAiCPU runReload: attackFin → goMode #runReload → moveAwayFromLoc until cooldownFin)

BULLET:  char "batBullet", friction 4, initial vx 5.76 (≈ strength 6, #fullstrength) ✓
         trail (target@300): x 237→290.5 over 12 ticks, speed 5.53→3.39 decaying 4%/frame, then DONE/LANDED
         near the target — bullet REACHES the target. friction = 4% per frame (port projectile.ts:132
         `1-friction/100`), matching VarValRange(4,[0,speed]). ✓

DEATH/FACE: energy 50; lethal hit → isDead true, anim mode "grave", char "bat" (bat_grave strip). ✓
            facing follows walk dir, locks to aim at attack entry (target right → bullet +x). ✓

batTree:  produces 12 residents (budget 10) all char "bat", team #cave, type enemy — NOT blackOrc. ✓
```

---

## SECTION 3 — Comparison

| Aspect | Derived-correct (original) | Observed (port) | Verdict |
|---|---|---|---|
| Sprite char (bat/batTree/resident) | "bat" / "batTree" | "bat" / "batTree" (real strips) | ✓ FAITHFUL |
| caveBat distinctness | name "bat", XP 10 (vs bat XP 4) | resolves XP 10, key "caveBat" — no collision | ✓ FAITHFUL |
| team / objType / FSM | #cave / #objCPUCharacter / #objAiCPU ranged | #cave, enemy, ranged FSM | ✓ FAITHFUL |
| collisionDetection:false → drift | drifts through terrain | passThrough:true | ✓ FAITHFUL |
| Shots per attack (#animframe 2) | 1 per cycle | 1 per cycle | ✓ FAITHFUL |
| firingType #fullstrength bullet speed | ≈ strength 6 | vx 5.76 | ✓ FAITHFUL |
| runReload kiting | retreat while cooldown recovers | observed retreat/re-approach cycle | ✓ FAITHFUL |
| batBullet friction decay | 4% of speed/frame (VarValRange) | 1-friction/100 = 4%/frame | ✓ FAITHFUL |
| bullet reaches target / lands | decays + stalls near target | trail lands ~x290 near target@300 | ✓ FAITHFUL |
| energy / death / grave | 50 / grave | 50 / grave (bat_grave) | ✓ FAITHFUL |
| batTree production | releases #bat residents | 12 bats, team #cave | ✓ FAITHFUL |

### DIVERGENCES: 0

No PORT bugs found. The bat reproduces faithfully across sprite resolution, drift, single-shot-per-cycle
ranged attack, #fullstrength bullet speed, runReload kiting, friction-decay bullet landing, death/grave, and
batTree resident production.

### Candidate ORIGINAL-GAME quirks (faithful — do NOT "fix")
- **Two records named "bat"** (`act_bat` XP 4 / `act_caveBat` XP 10) differing only by
  `collisionDetection` and `experienceImWorth`. The port keys them by record name (bat / caveBat), so both
  resolve correctly; the shared `#name:"bat"` is faithful (both render the bat sprite). caveBat is unused by
  the shipped maps (spawns come from `batTree`, whose residentGroups `typ:#bat`).
- **attack `#name:#dropPoo` with `#sound:#none`** — the poo-drop is silent by design (faithful).

### Harness notes (NOT port divergences)
- `spawnEnemy`/`spawnDwelling` do not push to `game.entities` (main.ts/RoomManager does) — the harness pushes
  manually, and must wire `game.spawnEnemy/spawnUnit/spawnAlly` or the batTree produces 0 residents (a
  modResidents.releaseResident requirement, reproduced here — initially showed 0 until wired).
- The bat's per-cycle cadence in isolation (~55t) reflects the cooldown + kite-out/in travel, not a fixed
  re-fire timer; it varies with target distance (faithful to runReload).
