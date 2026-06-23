# Audit: goblinRunner — derived-vs-observed (REPRODUCED)

Method: derived correct behavior from `casts/data/*` + `casts/script_objects/*`, then REPRODUCED the
port via a throwaway harness (`tools/_audit_goblinRunner.ts`) that loads the REAL
`src/generated/assets.json`, spawns `goblinRunner` through the real placement path
(`spawnFromSymbol`), ticks 200 frames against a hostile `#aldevar` target, and contrasts it against
`goblinWarrior` (the combat actor whose sprite goblinRunner borrows).

---

## What goblinRunner IS (derived from original)

`act_goblinRunner` (`casts/data/act_goblinRunner.txt`):

```
#inherit: #actorPlayer,  #name: "goblinWarrior",  #scriptToPerform: #demo_006_ulin,
#collisionRect: rect(-60,-2,60,2),  #initFaceDir: -1,  #miniMapStatus: #clr,
#speechColor: rgb(74,255,57),  #walkSpeed: 5,  #weight: 0
```

Resolved `#inherit` chain → `#actorPlayer` → `#actor`:
- `objType: #objActorPlayer`, `AiType: #objAiAttack` (from `act_actorPlayer.txt`)
- `team: #chatters` (from `act_actor.txt` — goblinRunner does NOT override it)

`objActorPlayer` (`casts/script_objects/objActorPlayer.txt`) is documented "acts in scripts and cut
scenes". Its `new` installs `modFader, modPositioning, modProp, modStretcher, modTeleport,
modThespian, modWastedMode` — i.e. CUTSCENE modules only. It installs **NO AI driver**, and its
`checkCollisions` is a no-op (`return newLoc`). So:

- goblinRunner is a **scripted cutscene actor (thespian puppet)**, NOT a combat CPU.
- The inherited `AiType: #objAiAttack` is **vestigial** — objActorPlayer never spins up an attack AI,
  so it never seeks/fights. It walks, stands, faces, teleports, and emotes only when a cutscene
  script drives it via modThespian.
- `#name: "goblinWarrior"` is purely the **sprite character** (modAnimSet renders the goblinWarrior
  strips); it does NOT make goblinRunner a goblin combatant. Team stays `#chatters`.
- `#scriptToPerform: #demo_006_ulin` is a thespian/cutscene script name.

### Energy / movement / attack / weapon / death (derived)
- **energy:** none set; objCharacter seeds 100. Irrelevant — a thespian actor is never in combat.
- **movement:** walkSpeed 5, `#weight: 0` (no gravity). It moves only when a script issues `walkTo`.
- **attack / weapon / reach / #animframe:** NONE. No `#weapon`, no `#attack`, no AI to fire one.
  It does not fight and does not flee-as-combat — its "running" is whatever a cutscene scripts.
- **death / grave:** N/A — never takes combat damage in its intended (cutscene) context.

### Placement / usage (derived — CRITICAL)
- `goblinRunner` the actor appears in NO `scr_*.txt` cutscene script's character list
  (`grep goblinRunner casts/data/scr_*.txt` → none) and in NO map.
- `#demo_006_ulin` is a **dangling script reference**: there is no `scr_demo_006_ulin.txt`, it is not
  in the cutscenes manifest, and it is shared verbatim by `act_ulin` and `act_prestotolin` too. No
  such cutscene exists in the shipped data.
- The only in-game thing carrying the *goblinRunner* name is the **separate** `#goblinRunner`
  **cutscene script** triggered by `act_goblinRunnerStones` (a `#chatter`/`#objChatter`,
  `team: #collectables`). That stone is the real placed object; it plays its script through
  `objChatter.collected → cutSceneMaster.playCutScene`, and the port spawns it via `spawnChatter`
  (objType `#objChatter`) — fully ported, NOT part of this actor.

Conclusion from derivation: **the goblinRunner ACTOR is an unused, never-instantiated thespian
puppet.** Neither the original nor the port ever spawns it in gameplay.

---

## What the PORT does (OBSERVED via harness)

Routing: `spawnFromSymbol("goblinRunner")` (the single placement path) does NOT branch on
`#objActorPlayer` (`actorSerial.ts:48-54` handles dwelling/mine/magicLimit/music/teamOverride/chatter,
then falls through to `spawnUnit`). So goblinRunner builds an **EnemyArchetype** with a `CpuAI`.

Observed over 200 ticks (target = an `#aldevar` blackOrc 70px away, inert):

| probe | value |
|---|---|
| `animChar` resolved | **`goblinWarrior`** (blackOrc fallback? **NO**) |
| strip `goblinWarrior_stand/walk/weaponMelee/reel/grave` bundled | all **true** |
| route → entity type | `enemy` (EnemyArchetype); components: Identity,Grave,**CpuAI**,…,Anim,Energy,Team,Targeting |
| has Chatter / Thespian component | **NO** — `scriptToPerform: #demo_006_ulin` is dropped |
| team | `#chatters` (correctly preserved from data) |
| energy / maxSpeed | 100 / 3 px (walkSpeed 5 × 0.6) |
| AI mode over 200 ticks | `findTarget` ×200 — **never leaves target-search** |
| movement | **0 px** (never moved) |
| hits landed | **0** (`findTarget` returns null) |
| died / grave | no — stays alive, inert |

Contrast (same harness): `goblinWarrior` (team `#goblins`, same sprite) moved 48 px and landed 12
hits on the same kind of target — proving the runner's total inertness is **purely the `#chatters`
team** (chatters hate nobody and are hated by nobody → `findTarget` null forever), not a sprite or
asset problem.

---

## DIVERGENCES (dual-tree)

### DIVERGENCE 1 — port routes the cutscene actor as a combat EnemyArchetype (not a thespian puppet)

```
ORIGINAL
  goblinRunner = #objActorPlayer
  └─ modThespian + modWastedMode, NO AI driver, checkCollisions = no-op
  └─ exists ONLY to be driven by a cutscene script (walk/stand/face/teleport/emote)
  └─ scriptToPerform #demo_006_ulin carried on the actor for the thespian system

PORT
  spawnFromSymbol("goblinRunner")
  └─ no #objActorPlayer branch  →  falls through to spawnUnit → spawnEnemy
  └─ builds EnemyArchetype (CpuAI, WeaponManager, synthetic #natural melee)
  └─ NO Chatter/Thespian component  →  scriptToPerform #demo_006_ulin silently dropped
  └─ would run hostile combat AI instead of being a scripted puppet
```

Classification: **PORT-BUG (latent / non-manifesting).** The port has no `#objActorPlayer` spawn
branch, so a placed objActorPlayer would be mis-built as a combat enemy with its thespian script lost.
BUT this never manifests in gameplay: goblinRunner is in no map and no cutscene's character list, and
`#demo_006_ulin` is a dangling reference with no backing cutscene. The port DOES model thespian actors
elsewhere (`scenes/thespian.ts` `spawnCutActor` builds a `CutActorArchetype` for cutscene casts) — but
that path is only reached for actors listed in a parsed cutscene's `chars`, which goblinRunner is not.
So the divergence is real in the routing code yet **dead** (unreachable for this actor). No
gameplay-visible effect; no fix required for goblinRunner specifically.

### Non-divergences verified
- **animChar:** original renders goblinWarrior strips via modAnimSet(`#name`); port `spriteCharOr`
  resolves `#name "goblinWarrior"` → `goblinWarrior_stand` (bundled) → **`goblinWarrior`, not
  blackOrc.** FAITHFUL.
- **team `#chatters`:** preserved exactly. FAITHFUL.
- **walkSpeed/weight/collisionRect/initFaceDir/miniMapStatus/speechColor:** all carried through
  resolveActor identically (data is byte-faithful).
- The runner's 0-movement/0-attack inertness in the port is itself **incidentally close to the
  original's intent** (a non-combat puppet that does nothing on its own), even though it is reached
  via the wrong (combat) archetype.

### Probe-API caveats (NOT divergences)
- First harness pass read `Energy.value` / `Movement.walkSpeed` (wrong field names) → `undefined`.
  Corrected to `Energy.energy` / `Movement.maxSpeed` (verified in `components/combat.ts:12`,
  `components/movement.ts:30`). The `undefined`s were probe errors, not port behavior.
- `act_orc` does not exist; used `blackOrc` for the target. Not a divergence.

---

## Conclusion

The goblinRunner **actor** is a dangling, never-instantiated cutscene puppet in both versions. The
port mis-routes `#objActorPlayer` through the combat spawn path (would build an enemy and drop the
thespian script), which is a genuine but **latent, never-exercised** mismatch — DIVERGENCE 1. Sprite
resolution, team, and all data props are faithful. The actually-played `goblinRunner` *cutscene* is
triggered by `goblinRunnerStones` (a `#chatter`), which is ported correctly and is out of scope for
this actor.

goblinRunner | DIVERGENCES=1
- D1: port routes the #objActorPlayer cutscene actor through spawnUnit→spawnEnemy (combat CpuAI, thespian #scriptToPerform dropped) instead of a thespian puppet — PORT-BUG, latent/never-instantiated (animChar/team/props all faithful).
