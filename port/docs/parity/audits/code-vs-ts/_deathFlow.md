# Death / End-Game Flow Parity Audit

**Scope:** `modWastedMode`, `modStretchDeath`, `modStarReleaser`, `objStar`, `modRoomGraves`
**Authority:** extracted bytecode `MovieScript 1 - GameSpecific.ls` for globals;
`ParentScript 59/52/169` (`.ls`) as decompiled ground truth.
**Out of scope:** Rapunzel / `gPlayerHair` / `lifePowerUp` / `#timeAlive`; level-editor tooling.

---

## 1. modWastedMode

### Lingo

```
on new me        ancestor = new(script("modModule"))
on addModParams  modifyParams(#init); ancestor.addModParams()
on init          pWastedModeBlend=30; pWastedModeBlendOff=100; pWastedModeHeight=60; pWastedModeIsOn=false
on finish        ancestor.finish()
on wastedModeOn  bigMe.setBlend(30); bigMe.setAnimKeepSize(true); bigMe.setSpriteHeight(60); pWastedModeIsOn=true
on wastedModeOff bigMe.setBlend(100); bigMe.setAnimKeepSize(false); pWastedModeIsOn=false
```

The module lives on `objPlayerMerlinCharacter` (confirmed in that object's `new` handler at line 39).
The wasted cutscene (`scr_cut_scene_to_play_when_wasted`) fires `m goWastedMode` to drive the REAL bound Merlin entity.

### TS implementation

**`port/src/components/wasted.ts` (whole file, 16 lines)**

```ts
export class WastedMode extends Component {
  static handles = ["goWastedMode", "isWasted", "wastedReset"];
  private wasted = false;
  override reset(): void { this.wasted = false; }
  goWastedMode(): void { this.wasted = true; }
  wastedReset(): void { this.wasted = false; }
  isWasted(): boolean { return this.wasted; }
}
```

Installed on `PlayerArchetype` (`port/src/entities/archetypes.ts:35`) and on `CutActorArchetype` (`port/src/scenes/thespian.ts:48`).

### Handler-by-handler comparison

| Lingo handler | TS equivalent | Notes |
|---|---|---|
| `on new` | `WastedMode` constructor (Component lifecycle) | Clean |
| `on addModParams` | `static handles` array | Clean (no observable params) |
| `on init` | `reset()` (sets `wasted=false`) | Defaults match (`pWastedModeIsOn=false`) |
| `on finish` | Component pool reset via `reset()` | Clean |
| `on wastedModeOn` | `goWastedMode()` sets `wasted=true` | **PARTIAL — see GAP 1** |
| `on wastedModeOff` | `wastedReset()` sets `wasted=false` | **PARTIAL — see GAP 1** |

### GAP 1 — `wastedModeOn` render signals partially absorbed but not fully wired

**Lingo** `wastedModeOn` fires three calls on the sprite:
1. `setBlend(30)` — alpha 30 % (transparent)
2. `setAnimKeepSize(true)` — keeps the current sprite size during stretch
3. `setSpriteHeight(60)` — squashes the sprite to 60 px height

**TS** `goWastedMode()` only sets a boolean flag `wasted=true`. The rendering consequences are handled in two different places:
- `port/src/scenes/cutscenePlayer.ts:80` — `ctx.globalAlpha = t.actorAlpha(p) * (p.wasted ? 0.4 : 1)` → 40 % opacity (close to the Lingo 30 % blend, within one rounding step of ~31 %).
- `port/src/scenes/cutscenePlayer.ts:77,81,82` — `dy = Math.round(m.y - h * 0.6)` and `ctx.drawImage(..., p.wasted ? h * 0.6 : h)` → squash height to 60 % of the full 2× scaled frame.

**Semantic delta:**
- Alpha: Lingo `setBlend(30)` in Director is a 0–100 scale where 100=opaque and 0=transparent, so 30 → 30 % opacity. TS uses `0.4` (40 %). The original cutscene spec is 30/100 = 0.30; the port renders at 0.40. **This is a visible brightness difference during the wasted cutscene.** The Merlin sprite appears less ghostly in the port.
- Height squash: Lingo `setSpriteHeight(60)` is an absolute pixel height (Director sprite `height` property). In the cutscene render at 2× scale, a "full" Merlin sprite from the art is approximately 32 × 2 = 64 px; `60 px` ≈ 93 % of the 2× height. TS renders `h * 0.6` of the 2× height, i.e. 60 % of 2×, not 60 px. **If the art height is ~32 px at 1×, the Lingo result (60 absolute px) and the TS result (0.6 × 2 × 32 = 38.4 px) diverge significantly.** The TS squash is too severe.
- `setAnimKeepSize(true)` is a Director-specific internal that locks the strip frame to the overridden height. There is no direct TS equivalent needed because the port does not run Director anim strips — it manually draws the image into a `drawImage` call with the override height. Functionally equivalent.
- `wastedModeOff` / `wastedReset()` — the flag is cleared, and the render reverts to normal alpha and full height. Correct in shape.

**Activation:** The `goWastedMode` verb fires in the wasted cutscene (`port/public/assets/wasted.txt:16`) which is parsed and dispatched via `Thespian.performLine → goWastedMode(p)` (`port/src/scenes/thespian.ts:301–305`). The cutscene is played by `SceneManager.gameOver` → `playCutScene("wasted")` → `CutscenePlayer.withBound(wastedScript, ..., { m: player })`, binding the LIVE Merlin entity as the `m` alias. So `goWastedMode` fires on the real player entity. **Activation chain is correct.**

**Player POV:** The player sees Merlin appear on screen at approximately 40 % opacity (too high vs intended 30 %) and squashed to 60 % of his 2× rendered height (likely too much squash vs intended 60 px absolute height). The visual reading is "compressed ghost" — correct intent, wrong calibration.

**Tests:** `port/test/death.test.ts:67–77` confirms `goWastedMode/isWasted/wastedReset` flag mechanics. No test validates the render alpha or height squash values. **Untested observable: alpha=0.4 vs intended 0.30 and height squash amount.**

---

## 2. modStretchDeath

### Lingo

```
on init         pBlendFin=true; pHeightFin=true; pBlendSpeed=params.blendSpeed; pStretchDeath=params.stretchDeath;
                pStretchDeathStarted=false; pStretchHeight=params.stretchHeight; pStretchSpeed=params.stretchSpeed
on addModParams blendSpeed=3; stretchDeath=false; stretchHeight=50; stretchSpeed=1
on checkFin     if pBlendFin and pHeightFin: big.internalEvent(#stretchDeathFin)
on getStretchDeath return pStretchDeath
on internalEvent:
  #landed/#outOfEnergy/#reelFinished/#reelLanded/#walk: if checkDead() -> if stretchDeath: startStretchDeath() + goMode(#dazed); else goMode(#die)
  #stretchDeathFin: big.goMode(#dead)
  #transBlendFin: if pStretchDeathStarted -> pBlendFin=true; checkFin()
  #transHeightFin: if pStretchDeathStarted -> pHeightFin=true; checkFin()
on startStretchDeath: startTransBlend(pBlendSpeed, #out) + startStretchHeight(pStretchHeight, pStretchSpeed); pStretchDeathStarted=true; internalEvent(#stretchDeathStarted)
```

**Who uses it:** `act_player.txt:41` sets `#stretchDeath: true`; `act_greyGhost.txt:24` also sets it true. The player has `stretchDeath:true` and `stretchHeight:50` (from `addModParams` default). The module is installed on `objPlayerMerlinCharacter` (line 39).

**What it does at runtime (player death):** When the player takes lethal damage, `checkDead()` returns true; the `internalEvent(#walk / #reelLanded / etc.)` branch fires `startStretchDeath()` which launches two simultaneous tweens: a blend fade-out (opacity 100→0) and a height stretch (to `stretchHeight=50` px). When BOTH tweens complete, `#stretchDeathFin` fires → `objPlayerMerlinCharacter.internalEvent(#stretchDeathFin)` → `stretchDeathFin()` → `attemptRespawn()` or `gameMaster.gameOver()`.

### TS implementation

**No direct `modStretchDeath` component exists in the port.** There is no file named `stretchDeath.ts` and no handler strings matching `startStretchDeath`, `startTransBlend`, or `startStretchHeight` in the TS source.

The player death pathway in the port (`port/src/main.ts:269–273, 331–332`):

```ts
// main.ts:331-332
if (player.send("isDead")) { if (deathT === 0) deathT = 1; }
if (deathT > 0 && ++deathT > 36) { deathT = 0; resolveDeath(); }
```

```ts
// main.ts:269-273
function resolveDeath() {
  const respawned = player.send("attemptRespawn") as boolean;
  if (respawned) { audio.play("level_up"); return; }
  scene.gameOver(!!wastedScript);
}
```

The port uses a **36-tick counter** (`deathT > 36` at 30 Hz = 1.2 s) as the die-animation delay before calling `resolveDeath()`. This replaces the `modStretchDeath` blend+height tween system.

**`Hurt.takeHit` (`port/src/components/hurt.ts:38–53`)** fires `characterModeChanged("#die")` on lethal hits, which selects the `die` anim strip via `Anim.pickAction → "grave"` (once dead). The `Hurt.update` loop clears the flash timer at `flashT=0` (6-tick flash), and the die anim runs for the remaining frames of the `deathT` window.

**`Energy.takeHit` (`port/src/components/combat.ts:33–53`)** sets `dead=true` and `killedInAction=true` on lethal damage.

### GAP 2 — `modStretchDeath` blend+height tween not ported (player only)

**What is missing:**
1. The simultaneous **opacity fade-to-zero** (blend from 100→0) during the player death animation. In the Lingo game, when Merlin dies he visually fades out while simultaneously stretching vertically. In the port, the player stays at full opacity until the 36-tick `deathT` window expires (no fade).
2. The **vertical stretch** (`setSpriteHeight(50)`) — Merlin grows taller as he dies. In the port, the player shows the normal `die` anim strip without any height scaling.
3. The tween-completion-gated death resolution: in Lingo, `stretchDeathFin` fires only once BOTH tweens complete. In the port, death resolves after a fixed 36-tick delay regardless of animation state.

**What IS correct:**
- The sequencing of death detection → delay → `attemptRespawn()` or `gameOver()` is preserved.
- The 36-tick delay is a reasonable approximation of the tween duration at the default `blendSpeed=3` and `stretchSpeed=1` for a `stretchHeight=50` change (a 50-unit stretch at speed 1 = 50 ticks, but 36 is in the right order of magnitude for the blend at speed 3: 100/3 ≈ 33 ticks).
- `greyGhost` also has `stretchDeath:true` but ghosts are out-of-combat in the normal Merlin death flow.

**Activation:** The player death pathway does fire (lethal hit → `Energy.dead=true` → `main.ts` deathT counter → `resolveDeath()`). The gap is purely cosmetic: no stretch, no fade.

**Player POV:** The player sees the `die` anim strip play normally, then the wasted cutscene triggers. They do NOT see Merlin grow tall and fade out as in the original. This is a missing visual effect during the death animation.

**Tests:** `port/test/death.test.ts` covers `attemptRespawn` and the FSM (`gameOver` → `loadGame`). No test covers the stretch-fade animation or the 36-tick delay length. **Untested observable: stretch+fade visual; 36-tick delay vs tween-duration-gated.**

---

## 3. modStarReleaser

### Lingo

```
on init         pNumOfStarsToBeReleased=0; pReleaseCooldownCounter.tim[2]=10
on releaseStar  pNumOfStarsToBeReleased += 1
on update       if pNumOfStarsToBeReleased>0 and counter.fin: g.starMaster.experienceStar(me.big); pNumOfStarsToBeReleased--; CounterReset; CounterOnce
```

**What it does:** A module on enemy/ally characters. When called with `releaseStar`, it queues an XP star to appear from the actor's location (via `g.starMaster.experienceStar`). Stars are staggered 10 ticks apart.

`g.starMaster.experienceStar` (extracted `ParentScript 19 - starMaster.ls:10–18`):
```
on experienceStar me, theObj
  params = g.actorMaster.getParams(#newActor)
  params.typ = #experienceStar
  params.initVect = point(0,-2)
  params.startLoc = theObj.getLoc()
  params.useOffset = 0
  star = g.actorMaster.newActor(params)
  theObjLocZ = theObj.getLocZ()
  star.setLocZ(theObjLocZ - 1)  -- drawn BELOW the dying actor (z=locZ-1)
end
```

The star is an `#experienceStar` object that flies upward (`initVect = point(0,-2)`), lives for `pLifeCount` ticks, and is collected by the player walking over it.

### TS implementation

**No `modStarReleaser` component exists in the TS port.** Searching `port/src` for `starMaster`, `experienceStar`, `releaseStar`, `StarReleaser` returns zero matches.

**The XP pickup system is replaced** with `Experience.gainXp` (direct XP transfer at kill time via `Energy.takeHit → killer.send("gainXp", reward)` at `port/src/components/combat.ts:46–47`). This means XP is awarded instantly to the killer on the death tick, with no visual star particles.

### GAP 3 — `modStarReleaser` / `g.starMaster.experienceStar` not implemented

**What is missing:**
1. The `releaseStar()` / `modStarReleaser.update` module — no staggered star release.
2. `g.starMaster` and `g.starMaster.experienceStar` — the star-spawn dispatch.
3. `objStar` / `#experienceStar` entities — no flying star particles.
4. The **player-visible XP pickup mechanic**: in the original, killing an enemy releases one or more glowing stars from its corpse that float upward. The player must walk into them to collect XP. In the port, XP is awarded silently and instantly to the killer with no visual feedback.

**What IS correct:**
- XP values (`experienceImWorth`, `getReward`) are faithfully computed and awarded to the killer.
- Level-up from accumulated XP works correctly.

**Activation:** `modStarReleaser.releaseStar` is called by `modExperience.attributeExperience` (experience module) when a kill is confirmed. The entire sub-system (starReleaser + starMaster + objStar) is absent from the port.

**Player POV:** The player NEVER sees XP stars. Kills award XP silently. The XP bar fills without any particle feedback. The original's core "collect star to gain XP" feel is not present.

**Tests:** None for star release or star collection. **GAP 3 is entirely untested.**

---

## 4. objStar

### Lingo

```
on new      ancestor = new(script"objGameObject"); addModule("modAnimSet")
on init     pLifeCount.tim[2] = params.lifeCount
on checkCollisions return newLoc  -- passthrough (no wall collisions)
on setLifeCount    pLifeCount.tim[2] = newLifeCount
on update   if pLifeCount.fin: pDead=true; if not onscreen: pDead=true; Counter(pLifeCount); ancestor.update()
```

**What it does:** A short-lived animated object that rises upward (`initVect=(0,-2)`), dies when its lifeCount timer expires OR when it goes off-screen. The player walks into it to collect XP (via the standard `modPickUpObject` overlap or the starMaster's `experienceStar` collection mechanism).

### TS implementation

**No `objStar` or `#experienceStar` entity exists in the TS port.** There is no corresponding TS component or entity file.

### GAP 3 (continued)

`objStar` is the visual representation of the XP drop. It is not ported. See GAP 3 above.

**Dead-code note:** `starMaster.markerStar` and `starMaster.starBurstX` (extracted `ParentScript 19`) are purely editor/dev-tool helpers and are out of scope.

---

## 5. modRoomGraves

### Lingo

```
on init         pGraves = []
on addSaveData  sd[#pGraves] = pGraves.duplicate(); ancestor.addSaveData(sd)
on drawAndRecordGrave  graveMember=theObj.getGraveMember(); graveImage=graveMember.image;
                       graveRect=RectOfMemberDrawnAtLoc(graveMember, theObj.getLoc());
                       drawGrave(graveImage, graveRect); recordGrave(graveMember, graveRect, theObj)
on drawGrave    roomImage = getMember().image; theRect -= rect(roomLocOnScreen, roomLocOnScreen);
                roomImage.copyPixels(theImage, theRect, theImage.rect, [#useFastQuads:true, #ink:36])
on recordGrave  newGrave = structMaster.getStruct(#graveRecord); newGrave.actorType=theObj.getActorType();
                newGrave.member=theMember; newGrave.rect=theRect; pGraves.append(newGrave)
on reDrawGraves repeat with grave in pGraves: drawGrave(grave.member.image, grave.rect); end
on restoreFromSave pGraves = sd.pGraves
```

**What it does:** When an enemy dies, `drawAndRecordGrave` blits the enemy's `#grave` animation member into the ROOM BACKGROUND BITMAP (permanent baked-in blit using Director's `copyPixels` with ink 36 = copy). The grave record is stored in `pGraves`. On room re-entry (`reDrawGraves`), the graves are re-blitted into the fresh room background. On save/restore, `pGraves` round-trips through the save data.

### TS implementation

**`port/src/components/grave.ts` (whole file, 24 lines)** — the `Grave` component tracks `graveOn` (false for ghosts).

**`port/src/components/anim.ts:99–127`** — dead actors with `graveOn=true` render the `#grave` anim frame at a very low z-order (`z = m.y - 100000`), facing right (flip=false). The dead actor IS its own persistent grave entity.

**`port/src/entities/actorSerial.ts:62–67`** — `isRecordableActor` includes dead enemies in the pState snapshot (they have a real actor type). Dead actors that are serialized round-trip through `serializeActor / respawnActor` with their `dead=true` energy state, so they re-appear as graves on room re-entry.

**`port/src/world/rooms.ts:87`** — `pState.set(leavingNum, game.entities.filter((e) => e.type !== "player" && isRecordableActor(e)).map(serializeActor))` freezes ALL recordable entities including dead ones (graves). On `restoreRoomObjects` (line 181–200), dead actors are respawned with `restoreFromSave` restoring `energy.dead=true`, so they re-render as graves immediately.

### Handler-by-handler comparison

| Lingo handler | TS equivalent | Notes |
|---|---|---|
| `on init` (pGraves=[]) | No separate list; dead entities persist in `game.entities` | Architectural difference, same observable effect |
| `on drawAndRecordGrave` | `Anim.sprite()` with `z=m.y-100000`, `action="grave"` via `pickAction()` | Clean |
| `on drawGrave` (copyPixels into room bitmap) | `renderer.drawSprites(sprites)` sorted by z; grave sprites fall behind all live actors | **DEVIATION — see GAP 4** |
| `on recordGrave` | Dead actor's position in `game.entities` persists | Clean (different mechanism) |
| `on reDrawGraves` | Dead actors re-spawn from pState with `dead=true` on room re-entry | Clean |
| `on addSaveData` / `on restoreFromSave` | `serializeActor/respawnActor` round-trips dead actors | Clean |

### GAP 4 — Grave z-ordering: entity-band vs baked-blit

**Lingo** bakes the grave into the ROOM BACKGROUND BITMAP via `copyPixels`. This means:
- Graves are drawn at the absolute lowest layer (part of the room image itself, below all sprites).
- A live actor CAN walk over a grave with no z-fighting (the grave is the background).

**TS** draws dead actors as sprites with `z = m.y - 100000`. This renders them below all live actors (whose z = m.y which is at most ~300 for a typical room), but ABOVE the tile layers drawn by `renderer.drawTileLayer`. The draw order in `main.ts:363–378` is:
1. `#backgroundPassive` tile layer (renderer.drawTileLayer)
2. `#backgroundActive` tile layer
3. `renderer.drawSprites(sprites)` — sorted by z, includes grave sprites at z = m.y-100000
4. Bullets, spells, pickups
5. `#foregroundPassive` tile layer

So **graves are drawn above both tile layers** in the TS port. In the original, graves are drawn INTO the backgroundPassive (they ARE the background). The observable difference is subtle: in the port a grave sprite sits above the background tiles — it may be occluded differently by transparent tile edges or the foreground layer, and there is a 1-pixel rendering difference at the grave's edges vs the background-baked version. Under normal play this is not visually significant, but it is an architectural divergence.

**Another minor delta:** The Lingo `#ink:36` is Director's "Copy" ink (copies the source pixels exactly, preserving alpha). The TS `drawImage` call in the renderer uses the standard Canvas compositing (source-over by default), which also correctly overlays the grave frame. Equivalent.

**Ghost actors:** `graveOn=false` set by `ghost:true` config (`Grave.init:19`). `Anim.sprite()` returns `null` for dead ghosts (`port/src/components/anim.ts:105`). Ghost actors vanish on death — matches Lingo `modGrave.init: if params[#ghost] then pGraveOn = false`.

**Persistence across room exit/re-entry:** The pState snapshot includes dead entities. Confirmed at `rooms.ts:87` (freeze on leave) and `restoreRoomObjects` (restore on re-enter). **This is correct.**

**Save/restore:** Dead actors round-trip through `serializeActor` with `energy.dead=true`. On `restoreFromSave`, `Energy` restores `dead=true` (`combat.ts:118–120`). After `respawnActor`, the entity is dead on spawn and `Anim.pickAction` returns `"grave"`. **This is correct.**

**Activation / reachability:** `Grave` is installed on `EnemyArchetype` and `DwellingArchetype` (`archetypes.ts:36,38`). When `Energy.dead` becomes true, `Anim.pickAction()` switches to `"grave"` on the next update. The entity stays in `game.entities` indefinitely (no sweep for dead non-player entities). **Activation is correct.**

**Player POV:** Player sees enemy death animations, then a grave sprite appears in place, persists on re-entry, and is saved/restored. This matches the original. The layer difference (above tiles vs baked into tiles) is not player-visible under normal gameplay.

**Tests:** `port/test/render_f3.test.ts:170–205` — the K21 suite confirms:
- Dead non-ghost actors render with `z = m.y - 100000` (behind live actors) and `flip=false`.
- Dead ghost actors (`ghost:true`) produce `sprite()=null`.
- Grave z-order among multiple graves orders by world-y.

No test validates pState persistence of graves across room transitions. **Untested observable: graves persist across room exit/re-entry in the live system (rooms.ts path).**

---

## 6. Activation / Reachability Summary

| System | Trigger | Fires? |
|---|---|---|
| Player enters wasted mode | `takeHit` lethal → `deathT > 36` → `scene.gameOver()` → wasted cutscene → `m goWastedMode` | YES |
| `stretchDeath` animation | `internalEvent(#walk/#reelLanded)` after `checkDead()` | NOT PORTED |
| Stars released on kill | `modExperience.attributeExperience` → `modStarReleaser.releaseStar` | NOT PORTED |
| Enemy grave drawn | `Energy.dead=true` → `Anim.pickAction()` → "grave" strip | YES |
| Grave persists on re-entry | pState snapshot includes dead entities | YES |
| Grave saved/restored | `serializeActor/respawnActor` round-trips `energy.dead` | YES |

---

## 7. Global / Initial State Cross-Check

`GameSpecific.ls` defines: `gGameOverScript = #cut_scene_to_play_when_wasted`.
TS: `port/public/assets/wasted.txt` exists; `main.ts:97` loads it as `wastedSrc` and `wastedScript` is non-null. `scene.gameOver(!!wastedScript)` fires with `true`. **Matches.**

`modWastedMode.init`: `pWastedModeBlend=30`, `pWastedModeBlendOff=100`, `pWastedModeHeight=60`, `pWastedModeIsOn=false`.
TS `WastedMode.reset()`: `wasted=false`. No numeric defaults stored (the render constants 0.4 and 0.6 are hardcoded in `cutscenePlayer.ts:77,80`). **The alpha=0.4 vs Lingo 30/100=0.30 is a calibration gap (GAP 1).**

`modStretchDeath.addModParams`: `blendSpeed=3`, `stretchDeath=false`, `stretchHeight=50`, `stretchSpeed=1`.
TS: No equivalent. The 36-tick `deathT` delay is a fixed approximation. **GAP 2.**

`modStarReleaser.init`: `pNumOfStarsToBeReleased=0`, `pReleaseCooldownCounter.tim[2]=10`.
TS: No equivalent. **GAP 3.**

---

## 8. Draw Order / Occlusion

| Element | Original z-order | TS z-order | Match? |
|---|---|---|---|
| Room background | Layer 0 | `drawTileLayer` (first) | YES |
| Enemy grave | Baked INTO background (below all sprites) | `z = m.y - 100000` (above tile layers, below all live actors) | CLOSE (GAP 4) |
| Live actors | Sorted by locZ (world-y in practice) | `z = m.y` | YES |
| XP star particles | `locZ = theObjLocZ - 1` (just below the source actor) | NOT PRESENT | GAP 3 |
| Foreground overlay | `#foregroundPassive` over actors | `drawTileLayer` after `drawSprites` | YES |
| Wasted Merlin | Cutscene actor at stage floor | Same, via Thespian | YES |

---

## 9. Missing Test Detection

| Observable | Test exists? | Gap |
|---|---|---|
| Wasted alpha = 30 % (vs port 40 %) | No | **UNTESTED** |
| Wasted height = 60 px absolute (vs port 60 % of 2× frame height) | No | **UNTESTED** |
| Player die anim shows stretch+fade before death resolves | No | **UNTESTED** |
| 36-tick death delay matches original tween duration | No | **UNTESTED** |
| XP star particles spawn on kill | No | **UNTESTED** (feature absent) |
| Stars are collectible by player | No | **UNTESTED** (feature absent) |
| Graves persist across room exit/re-entry (live rooms.ts path) | No | **UNTESTED** |
| Ghost actors leave no grave (confirmed only in K21 unit test) | YES (render_f3.test.ts:195) | OK |
| Grave z-order: behind live actors | YES (render_f3.test.ts:184) | OK |
| WastedMode flag cycle (goWastedMode/isWasted/wastedReset) | YES (death.test.ts:67–77) | OK |
| `attemptRespawn` false → `gameOver` FSM | YES (sceneManager.test.ts:32–43) | OK |
| `attemptRespawn` true → respawn in place | YES (death.test.ts:19–36) | OK |

---

## Summary of Gaps

| # | File | Severity | Description |
|---|---|---|---|
| 1 | modWastedMode | Minor-visual | `wastedModeOn` alpha is 0.40 in TS vs 0.30 (30/100) in Lingo; height squash is 60% of 2× frame vs 60 absolute px |
| 2 | modStretchDeath | Moderate-visual | Stretch+fade death animation not ported; 36-tick fixed delay replaces completion-gated tween |
| 3 | modStarReleaser + objStar | Major-feature | XP star particles not ported; XP is awarded silently; no `starMaster`/`experienceStar`/`objStar` |
| 4 | modRoomGraves | Cosmetic | Graves drawn as sprites above tile layers, not baked into room bitmap; not player-visible under normal play |
