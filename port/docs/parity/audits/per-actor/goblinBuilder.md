# Parity Audit: goblinBuilder

Method: behavior was DERIVED from the original cast/data, then REPRODUCED in the port by running a
throwaway Node harness (`tools/_audit_goblinBuilder.ts`, since deleted) against the REAL
`@/generated/assets.json` bundle — spawning the actor, ticking ~200 frames, and probing which action
strip `Anim` resolves in each FSM phase. The earlier "full behavioral parity" verdict checked only the
FSM logic + data properties and MISSED the animation layer; reproduction surfaced one real port bug.

## Derived-correct behavior (from the original)

Source: `casts/data/act_goblinBuilder.txt`, `act_CPUCharacter.txt`, `act_character.txt`;
`casts/script_objects/objAICPUBuilder.txt`, `modBuilder.txt`, `modAnimSet.txt`, `objCPUCharacter.txt`.

- **Identity/stats**: team `#goblins`, energy 50, strength 5, dexterity 10, inertia 20, walkSpeed 4,
  experienceImWorth 2, weapon `#goblinHammer` (a #weaponMelee, hits #teamMembers+#teamBuildings),
  minimapStatus #fre. AiType `#objAiCPUBuilder`, objType `#objCPUCharacter`.
- **Build config (modBuilder)**: buildRate 70, buildRateInc 50, buildOne **false** (builds repeatedly),
  buildDie **true** (retires after a build), pBuildRange 50, unitToBuild
  `[#goblinHouse, #goblinHut, #goblinMageHut, #garTower]` (random pick each cycle via getUnitToBuild).
- **Build FSM (objAICPUBuilder)**: `#lookForBuilding` → startBuilding: if no in-progress site, spawn the
  chosen unitToBuild at `loc + point(32,0)` preBuilt=false → `#walkToBuilding` (path + checkBuildingInRange,
  50px) → `#build`: each tick accrue `pBuildAmount += buildRate`; every full 100 → one `advanceBuildFrame`.
  On `#buildingFinished` with buildDie: moveToLoc(building), setDead(true), setMode(#dead) → grave.
- **Animation (modAnimSet.getAnimSym)**: mode→strip mapping is
  `#build` → **`#build`** *when checkMyBuildingInRange()=true*, else `#walk`; `#walk` → `#stand` when not
  moving; `#look`→`#stand`; `#dead/#finish/#reelSit`→`#grave`. So while constructing (in range, stationary)
  the builder plays its **`#build`** strip. The bundle confirms a real `goblinBuilder_build` strip exists,
  so the original ships and shows this animation. Strips present: stand, walk, build, weaponMelee, grave, reel.

## Observed port behavior (harness run)

```
bundled strips: goblinBuilder_build, _grave, _reel, _stand, _walk, _weaponMelee
config: builder=true buildRate=70 buildOne=false buildDie=true
        unitToBuild=["goblinHouse","goblinHut","goblinMageHut","garTower"]   (all correct)
f0: mode=walkToBuilding  building spawned -> goblinMageHut (objDwelling -> spawnDwelling), team=#goblins
f1: mode=build           action=walk  strip=goblinBuilder_walk
build-mode reached: true | 'build' STRIP ever played while in build mode: FALSE
distinct live actions observed: stand, walk, grave   (build NEVER selected)
death/grave: isDead=true action=grave strip=goblinBuilder_grave real=true   (ok)
builder dead after build: true, builtCount=1   (buildDie honored)   (ok)
```

Everything resolves to a REAL bundled strip (no fallbacks) — but the builder never plays `build`.
FSM, target/site selection, the (32,0) spawn offset, build accrual, and the buildDie→grave retirement
all reproduce faithfully. Stats are all correct. The single divergence is the dropped build animation.

## DIVERGENCES

### D1 — PORT BUG: the `#build` animation strip is never played (dropped construction animation)

While a builder is in `#build` mode (stationary, aligned, in range of its site), the original plays the
dedicated `#build` strip; the port plays `stand` (or `walk` on the transition tick) instead. The bundled
`goblinBuilder_build` strip is therefore dead art — never selected by any code path.

- Original: `casts/script_objects/modAnimSet.txt` getAnimSym — the `#build:` branch returns `#build`
  unless `checkMyBuildingInRange() = false` (i.e. in range it KEEPS `#build`):
  ```
  case sym of
    #build:
      if me.big.checkMyBuildingInRange() = false then
        sym = #walk
      end if
  ```
  In build mode the builder is aligned to the site (`modBuilder.alignToBuilding`, run every tick while in
  `#build`) so it IS in range → the `#build` strip plays for the whole construction.
- Port: `port/src/components/anim.ts:113` (`pickAction`) — a LIVE unit can only resolve to `walk`/`stand`
  or whatever `animAction` override the control component returns:
  ```
  return this.entity.get(Movement).moving() ? "walk" : "stand";
  ```
  `port/src/components/control.ts:534-537` (`CpuAI.animAction`) only ever returns an **attack** strip (and
  only while `attackT > 0`); there is no `build` branch. `builderBuild` (control.ts:1041) calls
  `this.idle(m)` (control.ts:708) so the unit is stationary during construction → `pickAction` returns
  `stand`. Nothing in the port's anim/render path ever requests `goblinBuilder_build` (grep confirms zero
  references to a "build" action outside the FSM mode name).
- Evidence: harness reports `'build' STRIP ever played while in build mode: FALSE`; live actions seen =
  `stand, walk, grave` only, despite `goblinBuilder_build` being bundled.
- Fix sketch (NOT applied — audit only): have `CpuAI.animAction` return `"build"` while
  `builderMode === "build"` and the site is in range (mirroring getAnimSym's `#build` branch), so the
  bundled strip plays.

## Non-divergences confirmed (faithful)

- All 13 data properties (buildRate 70, buildRateInc 50, buildOne false, buildDie true, energy 50,
  strength 5, dexterity 10, inertia 20, walkSpeed 4, experienceImWorth 2, team #goblins,
  weapon #goblinHammer, unitToBuild list) read correctly — `entities/archetypes.ts:241-244,332-333`.
- Build FSM phases (lookForBuilding→walkToBuilding→build) with random site pick, (32,0) spawn offset,
  pBuildRange 50, per-100 frame accrual — `control.ts:998-1079`. MATCH.
- buildDie retirement → grave (`goblinBuilder_grave`, real strip) — `control.ts:1067-1079`. MATCH.
- Built `goblinMageHut`/`goblinHouse`/`goblinHut` route through `spawnDwelling` (objDwelling) as
  `type=enemy` on `#goblins` (a non-player team) — faithful; `garTower` (objCPUCharacter) routes as a unit.
- stand / walk / weaponMelee / reel strips all bundled and resolve without fallback.
- buildOne=false is effectively a NOOP for goblinBuilder: buildDie=true kills it after the first build,
  so the multi-build loop is never reached. Faithful to the original (same disposition order).

DIVERGENCES = 1
