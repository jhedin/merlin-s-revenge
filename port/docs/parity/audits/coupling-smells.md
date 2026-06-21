# Coupling-Smell Audit — "Decoupling of Things That Should Be Coupled"

**Scope:** the TypeScript port (`port/src/`) vs the original Lingo (`casts/`).
**Smell class:** the original funnels a set of *atomic* side-effects through a SINGLE
event/handler (one choke-point). The port scatters those effects across multiple
functions, render-time gates, and components that must be kept in sync by hand.
Every time they drift, a bug appears.

A **TRUE** smell here = effects the original fires *together, atomically, from one handler*,
which the port splits into independently-maintained sites. This audit deliberately
distinguishes those from **legitimate separation of concerns** (e.g. the takeHit
component chain, which faithfully reproduces the module ancestor chain) and from
**documented architectural adaptations** (the KNOCK-channel knockback substitution),
which are NOT flagged unless they actually cause drift.

Findings are ranked by severity (likelihood of a real bug × centrality of the system).

---

## 1. Room-clear / nav-mode / minimap / exits / arrows / cleared-sound — **SEVERITY: HIGH** (the anchor)

### Original choke-point
`objRoom.attemptOpenExits` — `casts/script_objects/objRoom.txt:187‑223`.
When `g.teamMaster.isPlayerEnemiesDead()` becomes true this ONE handler fires, in order:
- `g.teamMaster.setRoomClear(true)` (`:193`)
- `me.openExits()` — open the room edges (`:196`)
- `pRoomCleared = true` + `me.playSound(pRoomClearedSound)` ("end_screen"), gated `if pMap.isMapClear()=false` (`:200‑207`)
- `if gNavMode then g.gameMaster.goNavMode()` (`:209‑211`) — and `goNavMode`
  (`casts/master_objects/gameMaster.txt:134‑137`) ITSELF couples two more effects:
  `getPlayer().goNavMode()` (player walk-accel 2→6, `modNavMode.txt:goNavMode`) **and**
  `getCurrentMap().goNavMode()` → `modMiniMap.goNavMode` → `displayMiniMap()`
  (`casts/script_objects/modMiniMap.txt:177‑179`). **In the original the minimap is
  explicitly shown/freed by the nav-mode transition — it is NOT a render-time gate.**
- `if gExitArrows then me.drawExitArrows()` (`:213‑215`)
- `pMap.checkMapCleared()` (`:218`)

The inverse transition (`gameMaster.leaveNavMode`, `:168‑171`) is equally atomic:
restore player accel + `modMiniMap.miniMapOffScreen` (frees the sprite).

### Scattered port sites
- `RoomManager.setExits` — `port/src/world/rooms.ts:247‑258`: owns `exitsOpen`, `grid.open`,
  AND `game.navMode = open` (`:252`).
- `RoomManager.markCleared` — `port/src/world/rooms.ts:340‑351`: owns the cleared set
  AND plays `"end_screen"` (`:349`) AND the map-clear win (`:350`).
- `RoomManager.update` — `port/src/world/rooms.ts:354‑356`: the live "enemies just died"
  edge calls `markCleared(); setExits(true)` as TWO separate calls.
- `RoomManager.enter` — `port/src/world/rooms.ts:126‑127`: the on-entry clear path
  (`markCleared()` then `setExits(...)`), again two calls.
- `RoomManager.exitArrowRects` — `port/src/world/rooms.ts:275‑329`: a render-time
  RECOMPUTATION of the arrows, gated on `this.exitsOpen` (`:280`).
- Minimap render gate — `port/src/main.ts:407` `if (game.navMode) drawMinimap(...)`:
  the minimap is a **render-time `if`** keyed off `game.navMode`, NOT a state owned by
  the clear transition. (Original: shown by `goNavMode`, freed by `leaveNavMode`.)
- Player speed read — `port/src/components/movement.ts:116` reads `game.navMode` for
  `NAV_SPEED_MULT`.
- Chatter gate — `port/src/components/chatter.ts:64` reads `game.navMode` (talkOnlyOnNavMode).

### Concrete risk / bugs already caused
`game.navMode`, `exitsOpen`, the `cleared` set, the cleared-sound, the arrows and the
minimap are SIX signals derived from one logical event but set/read at six sites with
no single owner. Drift here is exactly the bug history:
- `7390b42` "exit-arrow colour/geometry/z-order + **minimap nav-gating**" — the minimap
  was always-on because the render gate wasn't tied to the clear transition.
- arrows "coloured by the wrong source" — `exitArrowRects` recomputes colour from
  `roomHasHostiles(nbr)` independently of the clear state it's gated on.
- "nav-mode never triggering" — `setExits(true)` was the only writer of `game.navMode`
  and an entry path that skipped it left nav-mode wrong.

Any new entry/clear path that forgets to call `setExits` (e.g. a future scripted
room-clear) silently leaves navMode/minimap/arrows stale.

### Recommended consolidation
Introduce a single `RoomManager.onRoomCleared()` choke-point (faithful to
`attemptOpenExits`) that, on the `isPlayerEnemiesDead` rising edge, owns: add-to-cleared,
open exits + `game.navMode`, play `"end_screen"` (gated on not-map-clear), reveal the
minimap **as owned state set here** (not a render `if`), trigger the arrow rebuild, and
`checkMapCleared`. Fold `markCleared`+`setExits`+the `update`/`enter` clear edges into it.
Mirror with an `onRoomEntered`/leave that resets the same bundle. The minimap render call
should read a `clearTransition.minimapVisible` flag this method owns, not `game.navMode`.

---

## 2. Player-death sequence (die-anim → respawn/gameOver) — **SEVERITY: HIGH**

### Original choke-point
`objPlayerMerlinCharacter` + `modStretchDeath` drive ONE FSM:
- `takeHit` → `checkDead` → `goMode(#die)` (`casts/script_objects/objPlayerMerlinCharacter.txt:238‑239`).
- `goMode(#die)` → `startStretchDeath` (`:121‑128`) — `modStretchDeath` runs the blend/height
  transform (`casts/script_objects/modStretchDeath.txt`).
- When BOTH transforms finish, `modStretchDeath.checkFin` fires **`#stretchDeathFin`**
  (`modStretchDeath.txt:checkFin`) — the SAME event that resolves the outcome.
- `internalEvent(#stretchDeathFin)` → `stretchDeathFin()` →
  `attemptRespawn()` (extra-lives) else `gameOver = true` → `g.gameMaster.gameOver()`
  (`objPlayerMerlinCharacter.txt:218‑226`).

The animation-finish and the respawn/gameOver decision are **the same event**: the visual
and the logical resolution cannot drift because one fires the other.

### Scattered port sites
- `Anim.STRETCH_DURATION = 33` + its own `deathT` counter that advances the visual
  stretch/fade — `port/src/components/anim.ts:44‑52, 86‑89`.
- A SECOND, independent `deathT` counter in the main loop — `port/src/main.ts:135` (decl),
  `:199` (reset), `:338‑339` (`if isDead → deathT=1`; `++deathT > 36 → resolveDeath()`).
- `resolveDeath()` — `port/src/main.ts:275‑279`: attemptRespawn else `scene.gameOver`.
- `WastedMode` component — `port/src/components/wasted.ts:8‑15`: a separate presentation
  flag driven later by the wasted cutscene verb.

### Concrete risk
The visual death length (`STRETCH_DURATION = 33`, anim.ts) and the logical-resolution
delay (`> 36`, main.ts) are TWO hand-tuned magic numbers for what the original models as
ONE finish event. If the stretch duration is retuned (blendSpeed/stretchHeight data
change) but `> 36` isn't, the body finishes fading and then sits invisible for the
remaining frames, or `resolveDeath` fires mid-stretch (snap to wasted cutscene before the
fade completes). The two counters can never be proven in-sync by construction — only by
the `33 < 36` coincidence. A non-stretch death (no `stretchDeath`) still rides the same
`> 36` timer in main.ts, decoupled from any anim.

### Recommended consolidation
Have `Anim` (the component that already owns the stretch transform) emit a single
`stretchDeathFin` signal when its transform completes, and have `resolveDeath` trigger off
THAT (a `player.send("isDeathAnimFin")` query or an event), deleting the main-loop `deathT`
magic-number timer. One finish event owns both the visual end and the respawn/gameOver
branch, exactly like `modStretchDeath.checkFin → #stretchDeathFin`.

---

## 3. Summon / teleport-out room-leave banking (army reserve) — **SEVERITY: MEDIUM**

### Original choke-point
A summoned ally banks through one disposition: `objCharacter.leaveGame → goMode(#finish)`
(`casts/script_objects/objCharacter.txt:254‑256`) and the `armyTeleportOut →
#teleportOutFinished` path records the unit into `armyMaster` (`casts/master_objects/armyMaster.txt`).
The unit's removal and its banking are the same finish.

### Scattered port sites (two removal mechanisms for ONE concept)
- Combat-retire path: `CpuAI.leaveGame` — `port/src/components/control.ts:530‑536`:
  `armyMaster.teleportOut(e)` THEN `e.flags.add("left")`; the entity is later removed by
  the main-loop sweep `port/src/main.ts:333` (`flags.has("left") → splice`).
- Manual unsummon: `control.ts:95` `teleportOut(active); active.flags.add("left")`.
- Room-leave path: `rooms.onLeaveRoom` hook — `port/src/main.ts:188‑196`:
  `teleportOut(e)` then **splices the entity directly** (does NOT set `left`).
- pState snapshot — `port/src/world/rooms.ts:82‑89`: the freeze MUST run AFTER
  `onLeaveRoom` so banked allies are already gone; it filters by `isRecordableActor`
  (`port/src/entities/actorSerial.ts:62‑67`), which returns `true` for an ally.

### Concrete risk
The same logical event "ally leaves the field and banks to the reserve" has TWO removal
implementations: the `left`-flag-then-sweep path (control) and the splice-immediately path
(onLeaveRoom). The only thing preventing a **double-bank / ghost-snapshot** on room-leave
is the *ordering* invariant in `enter` (`rooms.ts:82‑89`): teleport-out hook runs, splices
the ally, THEN the pState snapshot is taken. The snapshot's `isRecordableActor` filter does
NOT exclude allies (it returns `true`), so if that ordering is ever reversed — or a new
leave path snapshots before banking — a teleported ally would be frozen into pState AND
banked into the reserve, re-spawning twice on re-entry. The invariant is load-bearing and
hand-maintained, exactly the smell.

### Recommended consolidation
Route both leave paths through one `bankAndRemove(e)` helper on `RoomManager`/armyMaster
that sets `left` AND banks AND is the single thing the snapshot filter excludes (snapshot
should skip `flags.has("left")` explicitly, not rely on splice-before-snapshot ordering).
Then the ordering invariant becomes a filter invariant that can't silently reverse.

---

## 4. Save/restore cascade — missing participant: sound settings — **SEVERITY: MEDIUM-LOW**

### Original choke-point
`saveMaster.saveGame` serializes a FIXED tree of master singletons
(`casts/master_objects/saveMaster.txt:71‑95`): currentMap, `g_potionMaster`,
**`g_soundMaster`**, `g_armyMaster`; `restoreFromSave` restores the same three
(`:47‑53`). `soundMaster.addSaveData` persists `pActive` — the sound on/off state
(`casts/master_objects/soundMaster.txt:99‑101`).

### Scattered port sites / the gap
- `buildSave` — `port/src/systems/save.ts:55‑66`: serializes player chain, `potions`
  (`game.potionMaster.addSaveData`), `army` (`game.armyMaster.addSaveData`). **No sound slot.**
- The mute state lives in `Audio.muted` — `port/src/systems/audio.ts:47`, toggled by the
  global `m` key `port/src/main.ts:284` — and participates in NO save tree.

### Concrete risk
This is the "missing participant" cousin of the smell: the original's save tree has three
masters, the port's has two. Sound on/off does not round-trip a save/load. Lower severity
because the omitted state is a single bool and not gameplay-affecting, but it IS a faithful
divergence: load a game and your sound preference is silently reset to default.

### Recommended consolidation
Add a `sound: game.audio.addSaveData({})` slot to `SaveDataV3`/`buildSave` and a matching
`audio.restoreFromSave` on load, so every stateful master participates in the one save tree
(mirroring `saveMaster`'s three-master cascade). Bump `SAVE_VERSION`.

---

## 5. Room-enter reset bundle (magic-limit / team-override / effects / navMode / populate) — **SEVERITY: LOW–MEDIUM**

### Original choke-point
`objRoom.activate` (`casts/script_objects/objRoom.txt:110‑137`) is the single entry
handler: `teamMaster.setRoomClear(false)`, add player to room objects, populate
(`activateActors`/`restoreRoomObjects`/`restoreState`), redraw graves, then
`attemptOpenExits`. The region masters reset their defaults via their own `on finish`
on room-leave (objMagicLimit/objTeamOverride), so a dimmed region/override cannot leak.

### Port site (mostly consolidated — noted as a watch, not a defect)
`RoomManager.enter` — `port/src/world/rooms.ts:79‑128` — DOES bundle the resets in one
method: `onLeaveRoom` hook, pState freeze, `game.magicLimit.setDefault()` (`:94`),
`game.teamMaster.teamOverride = null` (`:95`), `game.effects.clear()` (`:96`), grid build,
entity filter, populate, then `markCleared`/`setExits`.

### Concrete risk
This is largely a TRUE consolidation already — `enter()` is a real choke-point. The
residual smell: `game.navMode` is reset only as a side effect of `setExits` at the END of
`enter` (`:127`), not explicitly at the top of the reset bundle. Any future early-return in
`enter` (before `setExits`) would leave navMode/exitsOpen stale from the previous room.
The reset bundle and the clear bundle (finding 1) are also two separate concerns inside the
same method that a reader must keep mentally paired.

### Recommended consolidation
Fold the navMode/exitsOpen reset into the explicit reset block at the top of `enter`
(alongside `magicLimit`/`teamOverride`/`effects`), so the room's transient state is cleared
in one place independent of whether `setExits` is reached. Couples naturally with finding 1's
`onRoomCleared`/`onRoomEntered` pair.

---

## NON-findings (verified correctly coupled / legitimately separate — NOT smells)

- **Hit resolution (takeHit fan-out).** The original is a module ANCESTOR chain
  (`modReel.takeHit → modEnergy.takeHit → objGameObject.takeHit`), single entry, fixed
  order. The port reproduces this faithfully as a component `next()` chain through one
  `send("takeHit")` entry: Movement (knockback + inertia damp, `movement.ts:78‑92`) →
  Experience (record attacker, `experience.ts:29‑32`) → Combat/Energy (damage + death + XP,
  `combat.ts:takeHit`) → Hurt (reel/i-frames) → Freeze. Ordering and coupling are central
  and centralized. The KNOCK-channel/`KNOCK_SCALE` substitution is the documented
  adaptation and does not cause drift. **Not a smell.**

- **Level-up fan-out.** `modExperience.levelUp` (`casts/script_objects/modExperience.txt:201‑225`)
  fires releaseStar+sound, `incWalkAcceleration`, `internalEvent(#levelUp)` (energy/mana/
  attack-props/walk-speed listeners), `eventNotify(#levelUp)`. The port broadcasts
  `entity.send("levelUp")` from `Experience.attemptLevelUp` (`experience.ts:64`) and ALL
  growth listeners participate via that one message: Combat/energy (`combat.ts:99`), Mana
  (`mana.ts:31`), Control strength (`control.ts:139`), WeaponTechnique (`weaponTechnique.ts:37`),
  and **walk-speed** (`movement.ts:63`). Star+sound are attached to `attemptLevelUp` (the
  player level-up) and correctly NOT to `forceLevelUp` (`experience.ts:49‑56`) — which
  mirrors `levelUpToStartingLevel`'s `disableLevelUpStars`. Faithfully coupled. The only
  nit: star/sound are emitted inline rather than as `levelUp`-channel responders, but since
  no other code needs to fire them, this is not drift-prone. **Not a smell.**
