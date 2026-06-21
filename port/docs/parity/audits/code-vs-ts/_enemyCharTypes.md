# Behavioral Parity Audit: objAttachingEnemyCharacter + objFlyingEnemyCharacter + objAiChatter + modSummonBerlin

**Date:** 2026-06-21
**Lingo files audited:**
- `casts/script_objects/objAttachingEnemyCharacter.txt`
- `casts/script_objects/objFlyingEnemyCharacter.txt`
- `casts/script_objects/objAiChatter.txt`
- `casts/script_objects/modSummonBerlin.txt`

**Port mapping:** `port/src/entities/archetypes.ts`, `port/src/components/control.ts`, `port/src/components/chatter.ts`, `port/src/components/movement.ts`

**Scope note:** objChatter and objCPUCharacter already audited (`objChatter.md`, `objCPUCharacter.md`). objAiChatter's navMode gate was cross-audited in `objChatter.md` but that gap was subsequently **fixed** (see below).

---

## 1. objAttachingEnemyCharacter

### Summary

`objAttachingEnemyCharacter` extends `objEnemyCharacter` with a latch-and-drain mechanic: an enemy clings to an `attachObj` (a hair segment in Rapunzel's Escape), moves with it, then after `attachDuration` frames triggers `attachObjAttacked()` which calls `attachObj.cutOff()` to sever the attached object.

### Reachability Analysis — DEAD CODE in Merlin's Revenge

**Critical finding:** No `act_*.txt` actor data file in the Merlin's Revenge data set (`casts/data/`) sets `#objType: #objAttachingEnemyCharacter`. The actorMaster's `startActor()` (casts/master_objects/actorMaster.txt:181-250) resolves `actorData[#objType]` from `act_*.txt` records — if no data file uses this type, no actor can be instantiated with it.

The references to this type found at:
- `extracted/map_editor/scripts/ParentScript 13 - actorMaster.ls:73` — for `#hairSpider` (`AiTarget=#playerHair`, `AiTargetAction=#attach`)

...are from the **map_editor** version of actorMaster, which is a Rapunzel's Escape-targeted editor script, not the shipped Merlin's Revenge game. The Merlin actorMaster's `start()` function does list `#hairSpider` (casts/master_objects/actorMaster.txt:163) but at quantity `0`, and the real game never calls this path (line 151-152: `return` skips the test-spawn loop).

The `attachObjAttacked` handler itself calls `pAttachObj.cutOff()` via `#hair` character type — a Rapunzel feature (gPlayerHair=0 in Merlin's GameSpecific).

**Verdict: objAttachingEnemyCharacter is DEAD CODE for Merlin's Revenge.** No Merlin actor is assigned this objType; the attach/latch mechanic is a Rapunzel's Escape feature (objHair/pDownChain system). No TS port coverage is needed or expected.

### Handler-by-Handler Table

| Handler | Lingo Line | TS File | TS Coverage | Notes |
|---------|-----------|---------|------------|-------|
| `new` | 6-13 | — | None needed | Dead code — no Merlin actor uses this type |
| `init` | 15-20 | — | None needed | Dead code |
| `attachObjAttacked` | 22-28 | — | None needed | Calls `cutOff()` — Rapunzel #hair feature |
| `attachTo` | 30-36 | — | None needed | Dead code; calls `registerParasite(me)` on hair |
| `loseEnergy` | 38-44 | — | None needed | Dead code |
| `checkCollisionsWithHair` | 46-55 | — | None needed | Dead code; Rapunzel hair feature |
| `getAnimSym` | 57-72 | — | None needed | Dead code |
| `goMode` | 74-90 | — | None needed | Dead code |
| `targetGone` | 92-96 | — | None needed | Dead code |
| `update` | 98-114 | — | None needed | Dead code |
| `updateAttach` | 116-131 | — | None needed | Dead code |

### Player-POV Feature Description

The intended mechanic (from Rapunzel's Escape): a `#hairSpider` enemy targets the midpoint hair segment (`#playerHair`), moves to it, latches on (`goMode(#attach)`), tracks its position every frame (`me.moveLoc(objLoc)`), and after 120 frames triggers an attack that calls `cutOff()` severing that hair segment. Player sees an enemy clinging to their hair, then hair getting cut.

This mechanic does not exist in Merlin's Revenge. No hair, no hairSpider, no cut-off. The `objHair.registerParasite`/`unregisterParasite`/`sayGoodbye`/`cutOff` chain is present in the Lingo source but is also dormant for Merlin gameplay.

**Conclusion: OUT OF SCOPE for Merlin's Revenge. No gap to report.**

---

## 2. objFlyingEnemyCharacter

### Summary

`objFlyingEnemyCharacter` extends `objEnemyCharacter` with a flap-based jump animation override: it remaps ground-movement anim symbols (`#jump`, `#landed`, `#walk`, `#lift`) → `#fly`, and `#fall` → `#glide`. Its `doJump` handler fires the engine jump impulse when the animation reaches frame `pFlapFrame` (default 3), playing a wing-flap sound. `goMode(#reelFly)` turns off Y-friction; `goMode(#reelLanded)` turns it back on; `goMode(#lift)` applies an upward Y impulse.

### Reachability Analysis — DEAD CODE in Merlin's Revenge

**Critical finding:** No `act_*.txt` actor data file in `casts/data/` sets `#objType: #objFlyingEnemyCharacter`.

The references at `extracted/map_editor/scripts/ParentScript 13 - actorMaster.ls:61,64` assign this type to `#bat` and `#bigWitch` — in the Rapunzel's Escape map_editor, not the Merlin's Revenge game.

The Merlin `act_bat.txt` (casts/data/act_bat.txt:3) explicitly uses `#objType: #objCPUCharacter`, not `#objFlyingEnemyCharacter`. The bat in Merlin's Revenge is a standard CPU character (with `#collisionDetection:false` → `passThrough=true` in the port, which already makes it drift through walls as intended).

### Handler-by-Handler Table

| Handler | Lingo Line | TS File | TS Coverage | Notes |
|---------|-----------|---------|------------|-------|
| `new` | 7-16 | — | None needed | Dead code — no Merlin actor uses this type |
| `init` | 18-24 | — | None needed | Dead code |
| `doJump` | 26-41 | — | None needed | Dead code; reads pFlapFrame from enemy anim state |
| `getAnimSym` | 43-58 | — | None needed | Dead code; maps walk/landed/jump → fly |
| `goMode` | 60-75 | — | None needed | Dead code; frictionY on/off + lift impulse |

### Bat in Merlin's Revenge (what IS ported)

The bat (`act_bat.txt`) is a `#objCPUCharacter` with `#collisionDetection:false` (passes through walls) and `#runReload:true` (kites after shooting). The port correctly models this via:
- `archetypes.ts:280`: `passThrough: d["collisionDetection"] === false || ghost` → bat gets `passThrough=true`
- `archetypes.ts:219`: `runReload` includes `d["runReload"] === true` → bat kites
- The bat's anim in the port uses its `#naturalRanged` bat strips — no `objFlyingEnemyCharacter` animation mapping needed

The bat does NOT inherit the flap-frame-triggered jump, wing-flap sounds, or the frictionY-toggle that `objFlyingEnemyCharacter` adds. These are not needed because the Merlin bat is `passThrough` (terrain-ignoring) and is AI-driven as a ranged-kiting unit, not a platform-jumping flier.

**Conclusion: OUT OF SCOPE for Merlin's Revenge. No gap to report.**

---

## 3. objAiChatter

### Summary

`objAiChatter` is the AI driver for talking-stone chatter objects in the original Lingo architecture. It coordinates a player-proximity check with a nav-mode gate before firing the `collected()` cutscene trigger on the chatter program.

### Handler-by-Handler Analysis

| Handler | Lingo File:Line | TS File:Line | Coverage | Status |
|---------|----------------|-------------|---------|--------|
| `new` | objAiChatter.txt:8-11 | chatter.ts:24-46 | Ancestor init (objAi) integrated into Chatter.init | ✓ |
| `init` | objAiChatter.txt:13-18 | chatter.ts:35-46 | `pPlayer` fetch + mode = `waitingToTalk` → `mode="waiting"` init | ✓ |
| `checkNavModeActive` | objAiChatter.txt:20-25 | chatter.ts:64 | `game.navMode !== false` replaces `player.getNavModeActive()` | ✓ FIXED |
| `checkPossibleToTalk` | objAiChatter.txt:27-40 | chatter.ts:64 | Inline nav-mode gate in `update()` replaces the two-check function | ✓ FIXED |
| `update` | objAiChatter.txt:42-53 | chatter.ts:60-70 | FSM tick + overlap check + cutscene dispatch | ✓ |

### Nav-Mode Gate (Previously Flagged — Now Fixed)

The prior `objChatter.md` audit (GAP #1–#3) flagged that the nav-mode gate was missing. **This has been fixed** in `port/src/components/chatter.ts:64`:

```typescript
if (!this.performed && game.navMode !== false && this.overlapsPlayer() && !game.scene?.isInGameCutscene()) {
```

The condition `game.navMode !== false` precisely reproduces `talkOnlyOnNavMode AND checkNavModeActive()`:
- `game.navMode !== false` is `true` when `game.navMode` is `undefined` (unit tests — the original's `talkOnlyOnNavMode=false` pathway: possible=true unconditionally) or `true` (room cleared = nav active)
- `game.navMode === false` blocks the trigger during active combat (nav not active), matching `talkOnlyOnNavMode=true AND navModeActive=false → possible=false`

The `game.navMode` flag is set by `port/src/world/rooms.ts:228` (`game.navMode = open` where `open` = true when room is cleared). This is the same signal as `g.actorMaster.getPlayer().getNavModeActive()` in the original.

### Initial State Parity

Lingo (`objAiChatter.init`): `pPlayer = g.actorMaster.getPlayer()`, `goMode(#waitingToTalk)`
Port (`Chatter.init`): `mode = "waiting"`, `performed = false`

The explicit `pPlayer` assignment in Lingo is an optimisation to cache the player reference — the port uses `game.player` (set by main.ts on spawn) at check-time instead. Semantically equivalent.

### Remaining Cosmetic Difference (Non-Gap)

**Second touch → `#finishedTalking` mode swap** (`objChatter.txt:54-59`): In the original, if the player touches a chatter stone again while it's in `#talking` mode, it calls `goMode(#finishedTalking)` to revert the sprite to the waiting member. The port latches `performed=true` and never re-triggers. However, the port's comment at chatter.ts:11 explicitly acknowledges: "The port's stones ship a single stand strip (no separate talking/waiting art), so this tracks the FSM state only." Since there is no distinct talking-member artwork, the sprite swap is a no-op visually. This is a documented, intentional cosmetic difference, not a behavioral gap.

**Conclusion: objAiChatter — CLEAN. All handlers accounted for; nav-mode gate fix confirmed.**

---

## 4. modSummonBerlin

### Summary

`modSummonBerlin` is a player module that provides a `summonBerlin` action: it creates a `#berlinInGame` unit via `armyMaster.createUnit` (REQUIRES a reserve record of berlinInGame, matching the `#armySummon` pattern). It tracks `pBerlinOn`, subscribes to berlin's `#leaveGame` event (via `keepMePosted`), and persists state across saves.

### Reachability Analysis — SUPERSEDED BY modSummonWizard

**Critical finding:** `modSummonBerlin` is NOT mounted by the Merlin player.

The Merlin player character (`extracted/engine/scripts/ParentScript 152 - objPlayerMerlinCharacter.ls:18`) mounts:
```
me.addModule("modSummonWizard")
```
NOT `modSummonBerlin`. The source file `casts/script_objects/objPlayerCharacter.txt` (the Rapunzel player) also does not mount it.

`modSummonBerlin` hardcodes `#berlinInGame` as the summoned unit. `modSummonWizard` (the actual module used) is a generic wizard-summoner that cycles through a `pWizards` list and constructs `wizardSym = symbol(pWizardToSummon & "InGame")` dynamically.

No Lingo actor or player module list anywhere in `casts/` references `modSummonBerlin` by name except the file itself.

### Handler-by-Handler Table

| Handler | Lingo Line | In-Use | Notes |
|---------|-----------|--------|-------|
| `new` | 9-12 | No | Dead code — module never mounted |
| `addModParams` | 14-18 | No | Dead code |
| `init` | 20-24 | No | Dead code; sets `pBerlinOn=false` |
| `addSaveData` | 26-30 | No | Dead code |
| `eventNotification(#leaveGame)` | 32-44 | No | Dead code; tracks berlin's exit |
| `internalEvent(#noTargetFound)` | 46-53 | No | Dead code; calls armyTeleportOut |
| `restoreFromSave` | 55-59 | No | Dead code |
| `summonBerlin` | 61-89 | No | Dead code; the actual summon action |

### TS Port Assessment

The TS port has no equivalent of `modSummonBerlin` — and correctly so, since the actual player uses `modSummonWizard`. The TS port's wizard-summon infrastructure exists partially:
- `input.ts:99`: key binding "wizard" → Q key is defined
- `screens.ts:25,39`: control description "Summon Wizard"
- `armyMaster.ts:74`: `createUnit(team, typ, x, y)` supports re-fielding banked allies

However, the wizard-summon **action itself** (reading the Q key, calling `armyMaster.createUnit` with the selected wizard type, toggling the "wizard on/off" state) is **not wired** in `control.ts` or `main.ts`. This is a separate gap from modSummonBerlin: it corresponds to `modSummonWizard`, which is out of scope for this audit (it targets a different Lingo file). Flagging here for cross-reference only.

**Conclusion: modSummonBerlin — OUT OF SCOPE for Merlin's Revenge. The module is never mounted by any Merlin player or actor. The generic `modSummonWizard` supersedes it and is the actual mechanism used.**

---

## 5. Cross-Cutting: Activation / Wiring Verification

### objAiChatter — activation path verified

Chatter actors are spawned via `spawnFromSymbol` in `port/src/entities/actorSerial.ts`, using the `PickupArchetype`-adjacent path for `type="chatter"`. The `Chatter` component handles `update` and fires `playInGameCutScene` via `game.scene`. The `game.navMode` signal is set by `RoomManager` (rooms.ts:228) on every room clear. The path is live and reachable.

### objAttachingEnemyCharacter / objFlyingEnemyCharacter — not reachable

No spawn path exists for these types in Merlin's Revenge. The `spawnEnemy` function (archetypes.ts:145) reads actor data via `registry.resolveActor(actorName)`, which parses `act_*.txt` files. None of those files use these objTypes. The map editor references them only in Rapunzel's Escape editor scripts.

---

## 6. Global / Initial State Cross-Check

### objAttachingEnemyCharacter

Default `pAttachDuration = 120` frames (objAttachingEnemyCharacter.txt:10). No TS equivalent — dead code.

### objFlyingEnemyCharacter

Defaults: `pFlapFrame=3`, `pJumpType=#jump`, `pFlapSound="flap_wings"` (lines 11-13). No TS equivalent — dead code.

### objAiChatter

- Lingo initial mode: `#waitingToTalk` → port: `mode="waiting"` (chatter.ts:28) ✓
- Lingo `pPlayer`: fetched from actorMaster → port: `game.player` at check time ✓
- Lingo `talkOnlyOnNavMode` default `true` → port: `game.navMode !== false` (equivalent) ✓

### modSummonBerlin

- Lingo `pBerlinOn = false` (init:23) — not ported; dead code for Merlin

---

## 7. Player-POV Feature Description

### Attaching Enemy (Rapunzel only)

Player (Rapunzel) sees a `#hairSpider` walk toward her hair chain, grab onto a segment, and after ~4 seconds (120 frames) trigger a "cut" that severs the hair at that point. Observable: hair segment count decreasing, enemy briefly stationary on the hair. **Not present in Merlin's Revenge.**

### Flying Enemy (Rapunzel only, Merlin bat handled differently)

Player would see a bat-type enemy animate a flap cycle, jump at frame 3 of its fly strip, and play a wing-flap sound. Enemies would drift over terrain (via `frictionYOff`) and re-land (`frictionYOn`). **In Merlin's Revenge the bat is a `passThrough` ranged enemy (collisionDetection:false); it drifts through walls via Movement.passThrough, not via objFlyingEnemyCharacter's lift/frictionY mechanism. The observable behaviour (bat drifts through terrain) is correctly present via a different path.**

### Chatter Stone Cutscene (Merlin — CLEAN)

Player walks into a talking stone while the room is cleared (nav mode). The stone triggers its `#scriptToPerform` cutscene via `playInGameCutScene`. In combat, the stone does nothing (nav-mode gate). One trigger per stone (performed latch). All these signals are present and correct in the port.

---

## 8. Draw-Order / Z-Order (Chatter)

Chatter stones in the port are `type="chatter"` entities, rendered by the main entity draw pass. They have no special z-layer requirement. The port's renderer (renderer.ts) draws entities in entity-list order; stones are typically placed in the map's objects layer and spawn with their position. No z-order issue observed. ✓

---

## 9. Missing-Test Detection

### objAiChatter navMode gate (TESTED)

The navMode gate is covered by the existing `navmode.test.ts` smoke test (per `_findings.md:65`): "chatter combat-gate" is listed as verified. The Chatter.update `game.navMode !== false` condition is the ported implementation.

### objAttachingEnemyCharacter / objFlyingEnemyCharacter (NO TEST NEEDED)

Dead code for Merlin. No Merlin actor instantiates these types. No test surface.

### modSummonBerlin (NO TEST NEEDED)

Never mounted. Out of scope.

### Wizard Summon Q-key (UNTESTED — out of scope for this audit, cross-reference only)

`modSummonWizard` (the ACTUAL player module) has no test for the Q-key summon action. The binding is defined in input.ts:99 but no handler reads it. This is a separate gap (modSummonWizard, not modSummonBerlin). Out of scope here; flagging for the audit queue.

---

## Summary Table

| File | Verdict | Reason |
|------|---------|--------|
| `objAttachingEnemyCharacter.txt` | OUT OF SCOPE | No Merlin actor uses this objType; Rapunzel's Escape feature only (hairSpider). |
| `objFlyingEnemyCharacter.txt` | OUT OF SCOPE | No Merlin actor uses this objType; Merlin bat is objCPUCharacter+passThrough. |
| `objAiChatter.txt` | CLEAN | Nav-mode gate confirmed fixed (chatter.ts:64 `game.navMode !== false`). All handlers accounted for. |
| `modSummonBerlin.txt` | OUT OF SCOPE | Module never mounted; superseded by modSummonWizard on the actual Merlin player. |

**No behavioral gaps found for in-scope Merlin's Revenge functionality.**

Cross-reference gap noted (not this audit's scope): `modSummonWizard` Q-key action not wired in TS port — wizard summon does not fire on Q press.
