# Behavioral Parity Audit: Specialized Enemy AI Variants

**Target files (Lingo):**
- `casts/script_objects/objAiEnemyTargetSeek.txt`
- `casts/script_objects/objAiFlyingBomber.txt`
- `casts/script_objects/objAICPUWeaponSeek.txt`
- `casts/script_objects/objAICPUBuilder.txt`
- `casts/script_objects/objAiGameObject.txt`

**TS port:** `port/src/components/control.ts` (CpuAI class, lines 310–890);
`port/src/entities/archetypes.ts` (spawnEnemy, lines 144–339)

**Date:** 2026-06-21
**Scope note:** The base AI FSM (objAi / objAiCPU / objAiCPUSpellCaster) is already
audited in `modAi.md`. This audit covers only the **specialized subclass behaviors**
in the five listed files. "Rapunzel's Escape" features (gPlayerHair, extra-lives,
#timeAlive) and level-editor tooling are out of scope.

---

## Reachability Pre-Check

Before analyzing each variant for behavioral parity, the reachability of each AI
subclass was verified against `casts/data/act_*.txt` (`#AiType` fields, all 47 maps).

| Lingo AI class | Actors with this #AiType | Verdict |
|---|---|---|
| `#objAiCPUBuilder` | `dwarf`, `goblinBuilder` | **REACHABLE** |
| `#objAiFlyingBomber` | **none** — no act_*.txt has `#AiType: #objAiFlyingBomber` | **UNREACHABLE — dead code** |
| `#objAICPUWeaponSeek` | **none** — no act_*.txt has `#AiType: #objAICPUWeaponSeek` | **UNREACHABLE — dead code** |
| `#objAiEnemyTargetSeek` | **none** — no act_*.txt has `#AiType: #objAiEnemyTargetSeek`; base `objAiEnemy` absent from cast | **UNREACHABLE — dead code** |

Evidence:
- `grep -r 'AiType' casts/data/` lists every `#AiType` in the 47 shipped data files.
  `#objAiFlyingBomber`, `#objAICPUWeaponSeek`, and `#objAiEnemyTargetSeek` each
  appear **zero times** in that output.
- `grep -rln 'objAiEnemy' casts/` → only `objAiEnemyTargetSeek.txt` itself; the
  base class `objAiEnemy` is absent from the source cast entirely (cannot
  instantiate the prototype chain).
- The closest apparent flying-bomb unit is `bombMage` (`act_bombMage.txt:4`), which
  carries `#AiType: #objAiCPU` — it is a **plain ranged CPU** throwing bomb
  projectiles (#naturalRanged, bullet #bomb), NOT a `#objAiFlyingBomber`.
- `objAICPUWeaponSeek` references `g.weaponMaster.getWeapon()` over
  `[#pan,#pad,#pug,#sci,#spd,#swd]` (weapon pickup economy). The `weaponMaster`
  global is never instantiated in any shipped map data and no dropped-weapon
  actors are placed; the whole economy is unused.

This finding is consistent with and confirms the prior assessment in
`K-deferred-backlog.md:53` and `K2-K8-ai-completeness.md:37–38`.

---

## 1. `objAiGameObject` — the AI-host game-object wrapper

### What it is

`objAiGameObject` is **not an AI subclass** but the *host object* that owns a
reference to an AI object (`pAI`) and delegates every AI-relevant message to it.
It is the Lingo equivalent of the TS entity/component dispatch pattern.

### Handler map

| Lingo handler | File:line | TS equivalent | TS file:line |
|---|---|---|---|
| `new` — set `i[#AI] = #none` | objAiGameObject.txt:7–13 | entity creation in `Archetype.create` | archetypes.ts:36 |
| `init` — capture `pAI`, call `pAI.initCharacterInfo` | objAiGameObject.txt:15–22 | `Entity.build()` wires components; each component's `init` is called in order | archetypes.ts:272 |
| `finish` — `pAI.finish()` then super | objAiGameObject.txt:24–27 | entity lifecycle managed by engine; no explicit finish call needed | dispatch.ts |
| `addSaveData` — serialize `pAI` state into `sd[#pAI]` | objAiGameObject.txt:29–35 | `CpuAI` has no `addSaveData` — AI mode is not persisted across saves | control.ts:396–399 |
| `calcAttackDist` — delegate to `pAI` | objAiGameObject.txt:37–39 | not a dispatch message; `CpuAI.reach`/`reachRanged` read directly | control.ts:309–313 |
| `calcAttackHit` — delegate to `pAI` | objAiGameObject.txt:41–43 | `SplashDamage.resolve` / `meleeHitFn` per attack type | splash.ts:64, teams.ts |
| `calcCollisionVect` — delegate to `pAI` | objAiGameObject.txt:45–47 | `meleeHitFn` / bullet velocity | control.ts:548, teams.ts |
| `cancelAttack`, `getAI`, `getAttack`, `getAttackDamageMultiplier`, etc. — all delegate | objAiGameObject.txt:49–100 | sent via entity message dispatch; each component handles its message | dispatch.ts |
| `internalEvent` — pass to `pAI` (except `#relationshipsRestored`) | objAiGameObject.txt:102–116 | `CpuAI.eventLeaveGame` handles `#leaveGame`; no relationship system in port | control.ts:423–425 |
| `restoreFromSave`, `restoreRelationships` — delegate | objAiGameObject.txt:119–131 | actor restore via `actorSerial.ts`; no relationship graph | actorSerial.ts |
| `setAttack`, `setChargingSpell` — delegate | objAiGameObject.txt:133–139 | `WeaponManager.addWeapon`; `PlayerControl.spell` | weapon.ts, control.ts |
| `start` — `pAI.start()` then `ancestor.start()` | objAiGameObject.txt:141–144 | entity lifecycle; components initialized in `build()` | — |
| `unpaws` — `ancestor.unpaws()` then `pAI.unpaws()` | objAiGameObject.txt:146–151 | no explicit unpause path in CpuAI (game-loop pause/resume at system level) | — |
| `updateAI` — `pAI.update()` | objAiGameObject.txt:153–155 | `CpuAI.update()` called by engine updater | updater.ts |

### Assessment

The TS port **does not use a delegation object pattern** — it uses a component
system where AI behavior lives directly in `CpuAI` (a `Component` on the entity).
The functional contract is preserved: every message `objAiGameObject` would
delegate (`update`, `characterModeChanged`, `eventLeaveGame`, `getAiMode`, etc.)
has a corresponding TS handler on `CpuAI` dispatched via the entity message bus.

**One semantic difference — `addSaveData`/`restoreFromSave` for AI state:**
Lingo serializes `pAI` state (`sd[#pAI]`), meaning an enemy's AI mode (e.g.,
`#moveToAttack`, current target) can survive a save/restore. The port does **not**
serialize `CpuAI` mode or target — on restore an enemy starts fresh in
`"findTarget"` mode. This matches the existing gap documented in `objAiCPU.md`
(target persistence via `getTargetDetails`/`setAiTarget` exists for the committed-
target relationship but the AI FSM mode itself resets). Low impact in practice
(an enemy resets its hunt on load, not a visible in-play regression).

**Verdict: MOSTLY CLEAN with minor save-restore difference (already documented).**

---

## 2. `objAiFlyingBomber` — kamikaze dive AI

### What it is (Lingo)

`objAiFlyingBomber` (objAiFlyingBomber.txt:1–44) inherits `objAiCPU` and overrides
only two handlers:

#### `on update` (lines 11–23)
```lingo
case me.pMode of
  #moveToAttack:
    fin = me.ID.bigMe.updateMoveToAttack()
    if fin then me.ID.bigMe.goMode(#attack)
  #attack:
    fin = me.updateAttack()
    if fin then me.ID.bigMe.goMode(#moveToAttack)
end case
CounterOnce(me.pAttack.cooldownCounter)
```

#### `on updateMoveToAttack` (lines 25–44)
```lingo
if me.pPlayer = #none then
  me.pPlayer = g.actormaster.getPlayer()
end if
attackLoc = me.pAttack.idealAttackLoc.duplicate()
reach = me.pAttack.reach
idealRect = me.pPlayer.getRect() + rect(attackLoc, attackLoc)
attackRect = me.pPlayer.getRect().inflate(reach[1], reach[2])
me.updateMoveToRect(idealRect)
inRect = me.checkInRect(attackRect)
return inRect
```

**Behavior:** The flyer aims for an ideal offset from the player (`idealAttackLoc`),
then checks if it is within the attack reach rectangle. When in reach it transitions
to `#attack`. On attack completion it loops back to `#moveToAttack` (kamikaze dive
restarts, implying the attacker survives the dive and re-approaches).

### TS Port Status

**No actor in `casts/data/` carries `#AiType: #objAiFlyingBomber`**
(confirmed by `grep -r 'AiType' casts/data/` — zero matches for this symbol).

The archetypes.ts `spawnEnemy` function at line 220 treats `#objAiFlyingBomber` as
a `runReload` kiter:

```typescript
// archetypes.ts:219-220
const runReload = !ghost && ranged && (d["runReload"] === true
  || aiType === "#objAiCPUSpellCaster" || animType === "#magic" || aiType === "#objAiFlyingBomber");
```

This is an approximation — a unit with this AI type would kite away after shots
rather than do the `idealAttackLoc`-dive loop. However, since **no actor record
carries `#AiType: #objAiFlyingBomber`**, this code path for the enum value is
never reached at runtime (archetypes.ts:162 reads `d["AiType"]` — the field that
is absent from all act_*.txt files for this type).

### Player-POV Behavior

The player should see the flying unit dive toward a specific offset position near
Merlin (the `idealAttackLoc` offset applied to `getRect()`), then attack from that
position, then repeat. This is distinct from the standard "approach to melee reach"
loop in that the attacker aims for a **geometric offset** (e.g., above/below/beside
the player), not the player's center.

**This behavior is NOT implemented in the port.** However, since no shipped actor
uses this AI type, it is **unreachable dead code** — the gap is not player-visible.

**Verdict: UNREACHABLE DEAD CODE — correctly not ported (per K-deferred-backlog.md:53–56). CLEAN.**

---

## 3. `objAICPUWeaponSeek` — dropped-weapon pickup AI

### What it is (Lingo)

`objAICPUWeaponSeek` (objAICPUWeaponSeek.txt:1–114) inherits `objAiCPU` and adds:

#### `on init` (lines 14–19) — init `pMyWeapon = #none`

#### `on initCharacterInfo` (lines 21–25) — save a copy of the unarmed attack
```lingo
pUnarmedAttack = me.pAttack.duplicate()
```

#### `on characterModeChanged` (lines 27–48) — override
```lingo
case newCharMode of
  #reelFly:
    me.dropWeapon()           -- drop weapon on knockback-fly
end case
case newCharMode of
  #look:
    me.goMode(#seekWeapon)    -- on spawn/reset: start seeking
  #walk:
    if me.pMode = #seekWeapon then
      me.goMode(#collectWeapon)   -- already seeking → start collecting
    else
      me.goMode(#seekWeapon)
      me.goMode(#collectWeapon)   -- jump straight to collect
    end if
  otherwise:
    ancestor.characterModeChanged(newCharMode)
end case
```

#### `on dropWeapon` (lines 51–58) — drop on knockback
```lingo
if pMyWeapon <> #none then
  if pMyWeapon.isCarried() then
    pMyWeapon.drop()
    me.droppedWeapon()    -- revert to unarmed attack
  end if
end if
```

#### `on droppedWeapon` (lines 60–62) — restore unarmed attack
```lingo
me.setAttack(pUnarmedAttack.duplicate())
```

#### `on goMode` (lines 64–80) — query `weaponMaster` on `#seekWeapon`
```lingo
case newMode of
  #seekWeapon:
    pMyWeapon = g.weaponMaster.getWeapon(me, [#pan, #pad, #pug, #sci, #spd, #swd])
  #collectWeapon:
    nothing
end case
if pMyWeapon <> #none then
  pMyWeapon.AiModeChanged(newMode)  -- notify the weapon object
end if
ancestor.goMode(newMode)
```

#### `on lostWeapon` (lines 82–84) — clear reference when weapon owner steals it
```lingo
pMyWeapon = #none
```

#### `on pickUpWeapon` (lines 86–90) — pick up and equip
```lingo
pMyWeapon.pickedUp(me)
attack = pMyWeapon.getAttack()
me.setAttack(attack)
```

#### `on update` (lines 92–101) — special mode dispatch
```lingo
case me.pMode of
  #collectWeapon:
    fin = me.updateCollectWeapon()
    if fin then me.ID.bigMe.goMode(#moveToAttack)
end case
ancestor.update()
```

#### `on updateCollectWeapon` (lines 103–113) — move to weapon
```lingo
if pMyWeapon = #none then
  return true
end if
theRect = pMyWeapon.getRect()
fin = me.updateMoveToRect(theRect, true)
if fin then me.pickUpWeapon()
return fin
```

### TS Port Status

**No actor in `casts/data/` carries `#AiType: #objAICPUWeaponSeek`.**
The `weaponMaster` global it depends on (a dropped-weapon registry that tracks
`#pan`, `#pad`, `#pug`, `#sci`, `#spd`, `#swd` weapons as pickup objects) is not
instantiated in any shipped map or data file.

The TS `WeaponManager` component (`weapon.ts`) handles Merlin's weapon inventory
(player-side) — it is a completely different system: it tracks named weapons the
*player* owns and switches between them, not pickup objects in the world that CPUs
can compete for. The weapon-pickup economy (`objWeapon.register`, `weaponMaster`,
`lostWeapon` callbacks) has no TS equivalent.

**Player-POV behaviors not ported:**
1. CPU enemy that runs toward a dropped weapon on the ground and picks it up,
   gaining a new attack
2. CPU enemy that drops its weapon on knockback-fly (`#reelFly`)
3. Weapon contention: two weapon-seekers compete for the nearest available weapon

**Verdict: UNREACHABLE DEAD CODE — correctly not ported. CLEAN.**

---

## 4. `objAiEnemyTargetSeek` — target-seek / hair-attach AI

### What it is (Lingo)

`objAiEnemyTargetSeek` (objAiEnemyTargetSeek.txt:1–93) inherits `objAiEnemy`
(a class **absent from the source cast** — cannot be instantiated) and overrides:

#### `on new` — creates `ancestor = new(script"objAiEnemy")`
This immediately fails at runtime: `objAiEnemy` is not a loadable script in the
cast.

#### `on init` (lines 13–19) — init `pAction = #none, pTargetType = #none`

#### `on characterModeChanged` (lines 21–28) — on `#look` mode: `refreshTarget()`

#### `on goMode` (lines 30–39) — on `#attack` mode: call `targetFound()` which may
override mode to `#attach`

#### `on refreshTarget` (lines 41–52) — for `pTargetType = #playerHair`:
```lingo
if me.pPlayer = #none then
  pTargetObj = #none
  me.refreshPlayer()
else
  pTargetObj = me.pPlayer.getHalfWayHair()  -- Rapunzel's hair attach target
end if
```

This is the `gPlayerHair` / Rapunzel's Escape feature — out of scope per audit
instructions.

#### `on targetFound` (lines 64–77) — on `#attach` action:
```lingo
case pAction of
  #attach:
    me.pCharacterPrg.attachTo(pTargetObj)  -- attach to a target (hair)
    newMode = #attach
end case
```

#### `on updateMoveToAttack` (lines 79–93) — move to target's rect inflated by
attack reach

### TS Port Status

**No actor in `casts/data/` carries `#AiType: #objAiEnemyTargetSeek`.**

The `actorMaster.startActor` function does include a specific branch for this AI
type (actorMaster.txt:196–199):
```lingo
if actorData[#AiType] = #objAiEnemyTargetSeek then
  AI.setTargetType(actorData[#AiTarget])
  AI.setAction(actorData[#AiTargetAction])
end if
```

This means the system was designed to be used, but no actor data file ever fills
the `#AiType: #objAiEnemyTargetSeek` slot. The base class `objAiEnemy` is also
absent from the cast, meaning even if an actor data file referenced this AI type,
the `new(script"objAiEnemy")` call in `objAiEnemyTargetSeek.on new` would fail.

The `pTargetType = #playerHair` / `getHalfWayHair()` path is explicitly out of
scope (Rapunzel's Escape). The `#attach` mode is similarly out of scope.

**Verdict: UNREACHABLE DEAD CODE (base class absent; no actor data references it). CLEAN.**

---

## 5. `objAICPUBuilder` — dwelling construction AI

### What it is (Lingo)

`objAICPUBuilder` (objAICPUBuilder.txt:1–288) inherits `objAiCPU` and implements
a 3-phase FSM: look for building site → walk to site → incrementally advance build
frames. This was audited in detail in `objAiCPUBuilder.md`. The findings are
summarized here.

### TS Port Status

**REACHABLE.** Actors `dwarf` and `goblinBuilder` carry `#AiType: #objAiCPUBuilder`
(confirmed in `casts/data/act_dwarf.txt:4`, `act_goblinBuilder.txt:4`). Both are
placed across multiple maps (`dwarf`: 18 maps, `goblinBuilder`: 4 maps).

The TS implementation lives in `CpuAI.updateBuilder()` and its sub-methods
(`builderLookForBuilding`, `builderWalkToBuilding`, `builderBuild`,
`buildingFinished`, `builderFightFallback`) at control.ts:772–872.

### Handler map (key handlers)

| Lingo handler | File:line | TS equivalent | TS file:line | Match |
|---|---|---|---|---|
| `init` — `pBuildingSituation = #none` | objAiCPUBuilder.txt:14–18 | `builderMode = "lookForBuilding"` | control.ts:380 | ✓ equiv |
| `goMode #walkToBuilding` → `startBuilding()` | objAiCPUBuilder.txt:113–125 | `builderLookForBuilding()` — spawns dwelling | control.ts:791–806 | ⚠ DIVERGE (see below) |
| `startBuilding` → re-acquire OR spawn | objAiCPUBuilder.txt:187–209 | always spawns fresh | control.ts:791–806 | ⚠ GAP (persistence) |
| `startNewConstruction` — `actorMaster.newActor(preBuilt=false)` at `loc+(32,0)` | objAiCPUBuilder.txt:211–236 | `spawn(sym, m.x+32, m.y)` | control.ts:798 | ✓ equiv |
| `updateWalkToBuilding` — `checkBuildingInRange(50px)` | objAiCPUBuilder.txt:284–288 | `(dx²+dy²) <= BUILD_RANGE²` (50px) | control.ts:812 | ✓ |
| `updateBuild` — accrue `buildRate`, advance frames per 100 accumulated | objAiCPUBuilder.txt:259–282 | `buildAmount += buildRate; frames = floor/100` | control.ts:819–831 | ✓ |
| `building.advanceBuildFrame()` (8 frames to finish) | objDwelling | `advanceBuildFrame()` BUILD_FRAMES=8 | control.ts:833–843 | ✓ |
| `eventNotification #buildingFinished` — buildDie → `setDead(true)` | objAiCPUBuilder.txt:56–67 | `buildingFinished()` → `takeHit(999999)` | control.ts:845–857 | ✓ equiv |
| `eventNotification #outOfEnergy` — building died → `goMode(#findTarget)` | objAiCPUBuilder.txt:69–77 | poll `b.send("isDead")` each tick | control.ts:821–823 | ✓ equiv |
| `internalEvent #clearDefaultBuildings` — clear started-new builds on save | objAiCPUBuilder.txt:134–139 | not present — no save serialization of builder mid-build | — | MINOR GAP |
| `internalEvent #relationshipsRestored` — re-subscribe to building events | objAiCPUBuilder.txt:142–150 | not present — no relationship graph | — | MINOR GAP |
| fight fallback (buildOne done) | objAiCPU ancestor | `builderFightFallback()` | control.ts:861–872 | ✓ |

### Player-POV Builder Behavior

The player sees a dwarf or goblinBuilder unit:
1. Walk toward a position offset +32px from its spawn point
2. Stand at the construction site and appear to build (immobile during build phase)
3. The dwelling appears progressively (8 build-frame advances)
4. On completion: dwarf disappears (leaveWhenFinished), goblinBuilder dies (buildDie)
5. The completed dwelling then functions as a tower/house spawning its residents

**All five player-visible behaviors fire correctly in the port.** The dwelling
entity is spawned with `flags.add("underConstruction")` and the builder walks to
it. `advanceBuildFrame` advances the `buildProgress` counter; on reaching
BUILD_FRAMES=8, the flag is removed and the building is live.

### Gaps (from objAiCPUBuilder.md — carried forward here)

**GAP-BUILDER-1 (LOW): Building re-acquisition on interrupted build.**
Lingo queries `g.teamMaster.getBuildingOfType()` to find an existing unfinished
building before spawning a new one. TS always spawns fresh. Affects save/restore
scenarios only; normal continuous play is unaffected.
- Lingo: objAiCPUBuilder.txt:85–111, 187–209
- TS: control.ts:791–806 (no re-acquisition branch)

**GAP-BUILDER-2 (LOW): `leaveWhenFinished` grace period.**
Lingo retires a leaveWhenFinished unit immediately when `#noTargetFound` fires.
TS adds a 60-frame grace (LEAVE_GRACE) to avoid premature retirement before all
enemies have spawned. This is an intentional port enhancement.
- Lingo: objAiCPU.txt:232–237
- TS: control.ts:443 (`LEAVE_GRACE = 60`)

**Verdict: BEHAVIORALLY CLEAN (gaps are pre-documented low-severity corner cases).**

---

## 6. Cross-Cutting: `objAiFlyingBomber` vs `bombMage` actor

This is the one potential confusion point deserving explicit disambiguation.

`bombMage` (`act_bombMage.txt`) carries `#AiType: #objAiCPU` (plain CPU),
`#animType: #naturalRanged`, `#bullet: #bomb`. In the TS port it becomes a
**ranged unit** (`ranged = true` since animType is `#naturalRanged`), fires splash
bomb projectiles (the `#bomb` bullet record resolves to a splash bullet via
`ba.attackType === "#explode"`), and uses the standard `moveToAttack` → fire loop.

The `runReload` flag in `archetypes.ts:220` is set for `aiType === "#objAiFlyingBomber"`,
but `bombMage` does NOT have this AiType — it has `#objAiCPU`. So `bombMage` does
NOT kite away after firing in the port (correct: bombMages stand and throw).

**The `runReload`-for-`#objAiFlyingBomber` branch in archetypes.ts:220 is
unreachable dead code** (no actor carries that AiType). It does not cause any
behavioral regression because it can never be entered.

**No observable divergence for `bombMage`.**

---

## Summary Table

| Variant | Lingo file | REACHABLE? | TS Implementation | Status |
|---|---|---|---|---|
| `objAiGameObject` | objAiGameObject.txt | Yes (every CPU enemy) | Component dispatch model — functionally equivalent | CLEAN (save-state difference is pre-documented) |
| `objAiFlyingBomber` | objAiFlyingBomber.txt | **NO** — 0 actor records | `runReload` approximation in archetypes.ts:220 (dead branch) | UNREACHABLE / CLEAN |
| `objAICPUWeaponSeek` | objAICPUWeaponSeek.txt | **NO** — 0 actor records; weaponMaster unused | Not ported | UNREACHABLE / CLEAN |
| `objAiEnemyTargetSeek` | objAiEnemyTargetSeek.txt | **NO** — 0 actor records; base class absent | Not ported | UNREACHABLE / CLEAN |
| `objAICPUBuilder` | objAICPUBuilder.txt | **YES** — dwarf + goblinBuilder | `CpuAI.updateBuilder()` control.ts:772–872 | CLEAN (2 minor pre-documented gaps) |

---

## Verified Gaps

| ID | Severity | Description | Lingo | TS |
|---|---|---|---|---|
| GAP-BUILDER-1 | LOW | Builder does not re-acquire interrupted build on respawn/save-restore | objAiCPUBuilder.txt:85–111, 187–209 | control.ts:791–806 |
| GAP-BUILDER-2 | LOW | leaveWhenFinished grace period (60-frame delay) vs immediate retire | objAiCPU.txt:232–237 | control.ts:443 |

No new gaps identified beyond those already documented in `objAiCPUBuilder.md`.

---

## Non-Gaps Confirmed

- `bombMage` is correctly a `runReload=false` ranged unit with `#objAiCPU`
  (not a FlyingBomber).
- The `runReload`-for-`#objAiFlyingBomber` dead branch in archetypes.ts:220
  does not affect any live unit behavior.
- Builder `buildRate` cadence (100/tick, floor/100 frames per advance, 8 frames
  to finish) is faithful.
- Builder `BUILD_RANGE` (50px) is faithful.
- Builder spawn offset (`loc + (32, 0)`) is faithful.
- Builder `buildDie`/`leaveWhenFinished` dispositions are faithfully implemented.
- The three unreachable AI variants (`FlyingBomber`, `WeaponSeek`, `EnemyTargetSeek`)
  were correctly left unbuilt per K-deferred-backlog.md:53–56 (evidence-backed
  dead engine code).
