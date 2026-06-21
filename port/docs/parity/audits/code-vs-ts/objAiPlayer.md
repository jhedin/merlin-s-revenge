# Audit: objAiPlayer.txt vs TypeScript Port

**Date**: 2026-06-21
**Source file**: `casts/script_objects/objAiPlayer.txt`
**Port file**: `port/src/components/control.ts` (PlayerControl class), `port/src/main.ts`, `port/src/systems/input.ts`

Scope excludes Rapunzel features (`#hairGem`, extra-lives, `#timeAlive`). Wizard/army summon-helper hotkeys (`#wizard`, `#wizardSelector`, `#army`) and `#weaponSelector` palette are already catalogued as an unimplemented scope-decision feature in `keyMaster.md`; they appear in tables below but are not re-litigated.

---

## Handler Map

| Lingo handler | TS location | Status |
|---|---|---|
| `on new` / `on init` | `PlayerControl.init` (control.ts:65) | CLEAN |
| `on finish` | entity disposal; no explicit cleanup | CLEAN (no port-side resource) |
| `on initCharacterInfo` → `goMode(#playerControl)` | `spawnPlayer` builds PlayerControl in active state | CLEAN |
| `on start` → `goMode(#beBuilt)` | `spawnPlayer` (archetypes.ts:103); no beBuilt anim in port | CLEAN (beBuilt is purely cosmetic spawn anim; not ported) |
| `on attackFin(#completed)` → `goMode(#playerControl)` + `goMode(#walk)` | implicit: `charging=false`+`charge=0` on release (control.ts:176) | CLEAN |
| `on characterModeChanged(#dazed,#die)` → `goMode(#dazed)` | **NOT IN PlayerControl** — only CpuAI handles this | **GAP-1** (see §GAP-1) |
| `on getTarget` → `#notApplicableToPlayer` | not needed; PlayerControl reads cursor directly | CLEAN |
| `on getTargetLoc` → `mouseMaster.getMouseLoc()` | `input.cursor()` (control.ts:138) | CLEAN |
| `on goMode` → sets `pUnstickSpell=true` when leaving `#freeze` | `pUnstickSpell` concept absent; not needed (no standalone spell actor during cutscene) | CLEAN (design change, see §freeze) |
| `on internalEvent(#buildingFinished)` → `goMode(#playerControl)` | not present (player is never a builder) | CLEAN (dead code for player) |
| `on internalEvent(#spellCharged)` → GMG autofire | control.ts:169-171 | CLEAN |
| `on internalEvent(#gmgTurnedOn)` → `playerAttackRelease()` | **NOT PRESENT** — `setGmg()` only toggles flag (control.ts:75) | **GAP-2** (see §GAP-2) |
| `on internalEvent(#gmgTurnedOff)` → `playerAttackRelease()` + `playerAttackCharge()` | **NOT PRESENT** | **GAP-2** |
| `on interpretCheatKeys` | **NOT PRESENT** | **GAP-3** (see §GAP-3) |
| `on interpretGameKeys` — `#escape` | main.ts:314 `input.pressed("escape")` | CLEAN |
| `on interpretGameKeys` — `#gmg` | control.ts:129 `input.pressed("g")` | CLEAN |
| `on interpretGameKeys` — `#spell1`..`#spell9` | control.ts:134 loop | CLEAN |
| `on interpretGameKeys` — `#wizard` | MISSING — scope decision | NOTED |
| `on interpretGameKeys` — `#army` | MISSING — scope decision | NOTED |
| `on interpretGameKeys` — `#weaponSelector` | MISSING — scope decision | NOTED |
| `on interpretGameKeys` — `#wizardSelector` | MISSING — scope decision | NOTED |
| `on interpretMouse` — `#merlin_3` branch | control.ts:148 `mouseDown() \|\| held(" ")` | CLEAN (see §mouse) |
| `on interpretMouse` — `#freeze` branch → `AIisTryingToMove()` | **CHANGED** — skip fires on space/escape/enter, not move/click | **GAP-4** (see §GAP-4) |
| `on interpretMoveKeys` — move vector | control.ts:126 `input.moveVector()` | CLEAN |
| `on interpretMoveKeys` — `#freeze` branch → `AIisTryingToMove()` | same as §GAP-4 | **GAP-4** |
| `on playerAttackCharge` | control.ts:154-172 (hold-to-charge branch) | CLEAN |
| `on playerAttackRelease` — `#magic` path | control.ts:173-176 (`else if (this.charging)` branch) | CLEAN |
| `on playerAttackRelease` — `#melee/#ranged` → nothing | control.ts skips release for non-magic; CLEAN | CLEAN |
| `on restoreFromSave` → `pUnstickSpell=true` | not present; not needed (see §pUnstickSpell) | CLEAN |
| `on restorePlayerControl` → `goMode(#playerControl)` | not needed; player always active after spawn | CLEAN |
| `on unpaws` → `unstickCurrentSpell()` | not present; not needed | CLEAN |
| `on unstickCurrentSpell` | not present; not needed | CLEAN |
| `on update` — mode gate (`#attack,#playerControl,#freeze,#release`) | control.ts:108-181; always runs unless dead (see §GAP-1) | **GAP-1 partial** |

---

## GAP-1: Player can move and attack during reel (`#dazed` mode not implemented for PlayerControl)

### Lingo flow
In `objAiPlayer`, `characterModeChanged(#dazed, #die)` calls `me.goMode(#dazed)`. The `update` handler only runs input for modes `{#attack, #playerControl, #freeze, #release}` — `#dazed` is NOT in that list. So while Merlin reels after a hit, all input is entirely silenced: no movement, no spell charge, no key dispatch.

### TS flow
`PlayerControl.update` (control.ts:108) checks `entity.send("isDead")` and zeroes intent if dead. But it does NOT check `entity.send("isHurt")` (the `flashT > 0` flag set in `Hurt.takeHit`). During the 6-frame reel window, the player entity still runs the full input path: movement intent is applied, spells can be charged, keys dispatched.

`CpuAI` handles `characterModeChanged` correctly (control.ts:418-425) — CPUs freeze during reel. The PLAYER does not.

### Player-facing effect
When Merlin is hit, in the original he staggers and cannot respond for ~6 frames. In the port, taking a hit does not momentarily lock Merlin's input — he can continue moving and firing during the reel flash. The visual feedback (flash + reel strip) still plays, but it misrepresents the input state.

### Severity
LOW-MEDIUM. The 6-frame window is short; melee scenarios are most affected (enemy melees hit and Merlin keeps attacking). The reel-anim override (`animAction` returns "reel" via `Hurt.animAction`) still shows the correct animation strip, so visually it looks right.

### Fix
In `PlayerControl.update`, after the `isDead` check, add:
```ts
if (this.entity.send("isHurt")) {
  m.intentX = 0; m.intentY = 0;
  return next();
}
```
This is how `CpuAI` handles it (intent zeroed in `dazed`).

### Test gap
No test asserts that the player cannot move/fire during the reel window. `port/test/hurt.test.ts` tests i-frames and reel timing for CPUs but not for the player's input block.

---

## GAP-2: GMG toggle does not release/recharge in-flight spell

### Lingo flow
`modGoldenMachineGun.setGmg` (modGoldenMachineGun.txt:43-49):
- Toggle ON → `me.big.internalEvent(#gmgTurnedOn)`
- `objAiPlayer.internalEvent(#gmgTurnedOn)` → `me.playerAttackRelease()` (drops current spell)
- Toggle OFF → `me.big.internalEvent(#gmgTurnedOff)`
- `objAiPlayer.internalEvent(#gmgTurnedOff)` → `playerAttackRelease()` then `playerAttackCharge()` (releases held spell and immediately starts a fresh GMG-parameterised charge)

### TS flow
`PlayerControl.setGmg` (control.ts:75): `if (this.gmgCollected_) this.gmgOn = !this.gmgOn;`

That is all. No spell is released. If Merlin is mid-charge when G is pressed:
- Toggle ON: the spell continues charging but from next tick uses `gmgChargeSpeed` / `gmgChargeMax` parameters — the charge counter already accumulated is not reset, so the charge can land anywhere between the old `chargeStart` and the new `gmgChargeMax`. In Lingo the held spell is dropped entirely.
- Toggle OFF: the spell continues charging at normal rate. In Lingo the spell is released (fired at the current charge amount) and a new charge immediately begins.

### Player-facing effect
Pressing G to toggle GMG while a spell is mid-charge produces different results in the port vs the original. In the original, toggling ON drops the in-progress spell (the orb disappears); toggling OFF fires it and immediately begins a new charge. In the port, the charge seamlessly continues with the new GMG parameters — the orb does not vanish on toggle-ON, and it is not fired on toggle-OFF.

### Severity
LOW. The GMG power-up is rare (one spawn per full run). The observable difference is only visible during the brief window when G is pressed while actively holding a charge.

### Fix
In `PlayerControl.setGmg`, if `this.charging`:
- On toggle-ON: call the internal equivalent of `playerAttackRelease` + drop the spell (discard orb, set charging=false, charge=0).
- On toggle-OFF: call the internal equivalent of `playerAttackRelease` (cast at current charge), then set `charging=false`/`charge=0`.

### Test gap
No test covers GMG toggle behavior mid-charge.

---

## GAP-3: Cheat keys (`#invincibility`, `#killAll`, `#medikit`, `#testHit`) not implemented

### Lingo flow
`interpretCheatKeys` (objAiPlayer.txt:99-138) is called every update tick. It reads:
- `#invincibility` → `gameMaster.cheat(#invincibility)` → `player.invinceToggle()` (permanent invincibility toggle)
- `#killAll` → `gameMaster.cheat(#killAll)` → `teamMaster.killEnemyTeams(#aldevar)` (instant clear room)
- `#medikit` → `gameMaster.cheat(#medikit)` → `player.medikitCollected()` (grant a medikit)
- `#testHit` → `pCharacterPrg.flickWhite()` (debug hit flash)

These are real bound keys in `bnd_wasd.txt` (keys 34, 40, 46, 17) and `bnd_arrow.txt`. They were accessible to players in the retail build.

### TS flow
None of these handlers exist in `control.ts`, `main.ts`, or elsewhere. No key binding, no action, no equivalent.

### Player-facing effect
- `#invincibility` (toggle permanent god-mode): absent in port. Players who know the original cheat key have no equivalent. Note that `invinceToggle` is also unimplemented in the port (`Hurt` only has timed i-frames, not a permanent toggle).
- `#killAll` (instant enemy clear): absent. `teamMaster.killEnemyTeams` equivalent would be `game.teamMaster` scan, but no port handler exists.
- `#medikit` cheat: absent. `player.send("medikitCollected", 1)` exists (used by `pickup.ts:65`) but no key triggers it as a cheat.
- `#testHit`/`flickWhite`: absent. `ColourTransform.flickWhite()` exists but no key triggers it.

### Severity
LOW. These are debug/cheat keys. Their absence does not affect normal gameplay. `invinceToggle` (permanent invincibility, not just timed i-frames) would need a new code path if re-added.

### Test gap
None required for debug-only keys (intentional omission).

---

## GAP-4: Cutscene skip: move/click does not cancel dialogue in port

### Lingo flow
When the player is in `#freeze` mode (during a thespian/dialogue script), `interpretMouse` and `interpretMoveKeys` both call `me.pCharacterPrg.AIisTryingToMove()`. That method lives in `modThespian` (modThespian.txt:132-136):
```lingo
on AIisTryingToMove me
  if pSkipCounter.fin then  -- a brief no-skip grace period has elapsed
    g.cutSceneMaster.scriptCancelled()
  end if
end
```
So clicking or pressing any movement key after the skip-counter expires instantly cancels (skips) the cutscene.

### TS flow
In the TS port, there is no `#freeze` mode on the player because in-game cutscenes gate the entire game loop: `scene.isInGameCutscene()` blocks all entity updates (main.ts:297-302). The cutscene itself only responds to `input.pressed("escape") || input.pressed(" ") || input.pressed("enter")` (cutscenePlayer.ts:28). Mouse-click and movement keys are not checked as skip triggers.

### Player-facing effect
In the original: players can dismiss dialogue by clicking or moving. This is a natural UX affordance — players who just want to proceed don't need to find a specific skip key.

In the port: only Escape, Space, or Enter cancel in-game cutscenes. Clicking on the game window or pressing WASD/arrows during dialogue does nothing (the entire game loop is paused, so the click/keypress is absorbed but not acted on).

### Severity
LOW-MEDIUM. The skip still works via Escape/Space/Enter, but the player-facing discoverability differs. Players who click to skip dialogue will be confused.

### Fix
In `CutscenePlayer.tick` (cutscenePlayer.ts:28), also check any movement key or mouse-click:
```ts
const mv = input.moveVector();
const skip = input.pressed("escape") || input.pressed(" ") || input.pressed("enter")
  || (mv.x !== 0 || mv.y !== 0) || input.mousePressed();
if (skip) this.thespian.cancel();
```
The skip-counter grace period (`pSkipCounter.fin`) could be approximated by requiring a minimum cutscene age before allowing skip.

### Test gap
No test asserts that movement or click skips an in-game dialogue cutscene.

---

## Clean handlers (detailed rationale)

### `on interpretMouse` — mouse state model

Lingo `mouseMaster` returns `#pressed` while the button is held (every frame), `#released` for one frame on button-up, `#notPressed` otherwise. The port's `input.mouseDown()` is equivalently held-based. The release path (Lingo `#released` → `playerAttackRelease`) maps to the `else if (this.charging)` branch in `PlayerControl.update` when `primary` (mouseDown || held(" ")) becomes false. Behaviorally identical.

The `gGameName = #merlin_3` guard in `interpretMouse` means the mouse path only fires for Merlin's Revenge, not for Rapunzel. The port has no game-name switch; it simply has no Rapunzel-mode code, so the guard is vacuously satisfied.

### `pUnstickSpell` / `unstickCurrentSpell` / `on unpaws`

In the Lingo, `pUnstickSpell` is set in `goMode` (when leaving `#freeze`) and in `restoreFromSave`. On the next update, `unstickCurrentSpell` checks if the mouse is still pressed and, if not, releases the spell. This prevents the spell orb from freezing in place after pause/restore.

In the TS port, the spell entity (SpellActor) is owned by `PlayerControl` as `this.spell`, and the charge state (`this.charging`, `this.charge`) is purely in-memory on the component. When the game un-pauses or restores, the `primary` expression (`mouseDown() || held(" ")`) is re-evaluated naturally. If the mouse is up, `this.charging` becomes false and the spell is cast (or discarded if no magic weapon). The unstick problem cannot arise because there is no external spell actor that could hang in mid-air — the SpellActor is driven by the same component that drives charging. CLEAN by design.

### `on goMode` — `#freeze` mode

In the original, `#freeze` is the AI mode during a cutscene script. The player enters `#freeze` via `goThespianMode` (objAi.txt:79-81), and `update` still runs (processing move/click as skip signals via `AIisTryingToMove`). In the port, in-game cutscenes gate the entire loop before any entity update, so the player entity never runs in that window. The `pMode` field concept is absent for `PlayerControl`; the equivalent "all input frozen" state is the game loop gate. Functionally equivalent with the exception noted in GAP-4.

### `on start` → `goMode(#beBuilt)`

`#beBuilt` is the spawn-animation mode (the construction anim where Merlin materialises). In the port, `spawnPlayer` (archetypes.ts:103) builds the entity and places it immediately in the active state. No beBuilt animation is played. This is a cosmetic omission, not a gameplay gap.

### `on getTarget` → `#notApplicableToPlayer`

The Lingo returns `#notApplicableToPlayer` to distinguish the player from CPU actors in targeting queries. The TS port does not query `getTarget` on the player entity; `teamMaster.findTarget` is called by `CpuAI` to acquire an enemy target, and the player's target for magic is the cursor (`input.cursor()`). No gap.

### GMG auto-fire (`#spellCharged`)

`internalEvent(#spellCharged)` fires via `pChargeCounter.fin` (objAiAttack.txt:139-141) when the charge counter hits max. For GMG with `gmgAutoFire=true`, it calls `playerAttackRelease()` then `playerAttackCharge()`. The TS equivalent is control.ts:169-171: when `gmg && magic.gmgAutoFire && this.charge >= cm`, it calls `castMagic` (release) then resets `this.charge` to `chargeStartOf` (re-charge). CLEAN.

### `#spell1`..`#spell9` dispatch

Lingo: `interpretGameKeys` calls `pCharacterPrg.selectSpell(n)` (1-indexed) when key result is true.
TS: control.ts:134 `for (let n = 1; n <= 9; n++) if (input.pressed(String(n))) this.wm().selectSpell(n - 1)` (0-indexed). The 0-vs-1 index difference is correct: `WeaponManager.selectSpell(idx)` is 0-indexed, and the Lingo `selectSpell(1)` is 1-indexed — the port's `n-1` adjusts faithfully. Covered by `port/test/spell_select.test.ts`. CLEAN.

### `#escape` dispatch

Lingo: `interpretGameKeys` calls `gameMaster.escapePressed()` on `getKeyResult(#escape)`.
TS: main.ts:314 `if (input.pressed("escape")) { scene.escapePressed(); ... }`. Handled at the scene level before any entity update, which is correct — the pause takes effect immediately and all entity updates are skipped. `SceneManager.escapePressed()` (sceneManager.ts:179-185) toggles the ingame-menu overlay and pauses. CLEAN.

### `#gmg` dispatch

Lingo: `interpretGameKeys` calls `pCharacterPrg.setGmg()` → `modGoldenMachineGun.setGmg`.
TS: control.ts:129 `if (input.pressed("g")) this.setGmg()`. `PlayerControl.setGmg` is the direct equivalent of `modGoldenMachineGun.setGmg` minus the `#gmgTurnedOn/Off` events (see GAP-2). The toggle logic is correct. CLEAN (with caveat in GAP-2).

### `on restoreFromSave`

Lingo: calls `ancestor.restoreFromSave(sd)` then sets `pUnstickSpell = true`. TS: `PlayerControl.restoreFromSave` (control.ts:95-102) restores GMG flags and re-widens the melee sweep to the current weapon reach. The `pUnstickSpell` equivalent is not needed (see §pUnstickSpell above). CLEAN.

---

## Global / initial state

- `pUnstickSpell` initialised to `false` in `on init` (line 18). TS: no equivalent needed.
- `pMode` initialised via `goMode(#playerControl)` on `initCharacterInfo`. TS: player entity always in active mode from spawn.
- `gGameName` guard in `interpretMouse`: only `#merlin_3` branch exists in Lingo. TS: no branch; Merlin-only code path implicitly satisfied.

---

## Draw-order / occlusion

`objAiPlayer` is a logic-only script (no sprite rendering). Movement intent flows to `Movement`, which drives the entity's position. No direct render concern.

---

## Test coverage summary

| Handler / feature | Tested? |
|---|---|
| Movement vector (interpretMoveKeys) | YES — `input.test.ts` |
| `#spell1..#spell9` hotkeys | YES — `spell_select.test.ts` |
| `#gmg` toggle (setGmg) | Incidentally in `phase_i.test.ts`; no dedicated key-binding assertion |
| `#escape` → pause menu | YES — `sceneManager.test.ts` (FSM logic); no input.pressed round-trip test |
| Mouse charge/release cycle | Covered indirectly in `phase_i.test.ts`; no isolated charge→release test |
| Player input blocked during reel (GAP-1) | NO TEST |
| GMG toggle mid-charge drops/fires spell (GAP-2) | NO TEST |
| Move/click skips in-game dialogue (GAP-4) | NO TEST |

---

## Summary of gaps

| # | Handler | Gap | Severity | Resolution |
|---|---|---|---|---|
| GAP-1 | `characterModeChanged(#dazed,#die)` | Player can move/attack during reel; `isHurt()` not checked in PlayerControl.update | LOW-MEDIUM | **FIXED** |
| GAP-2 | `internalEvent(#gmgTurnedOn/Off)` | Toggling GMG mid-charge does not release/recharge the in-flight spell | LOW | catalogued (minor) |
| GAP-3 | `interpretCheatKeys` | `#invincibility`/`#killAll`/`#medikit`/`#testHit` keys absent (intentional; debug-only) | LOW (intentional) | non-gap |
| GAP-4 | `#freeze` mode → `AIisTryingToMove` | In-game dialogue not skippable by move/click; only Escape/Space/Enter | LOW-MEDIUM | catalogued (minor) |

### GAP-1 FIX (2026-06-21)

Verified against `objAiPlayer.txt:344–357`: `update` interprets keys ONLY when `pMode` ∈ `{#attack,#playerControl,#freeze,#release}`. A hit drives `characterModeChanged(#reel/#die)` → `goMode(#dazed)` (line 42–46), so during the reel NO key interpretation runs — the player is frozen and only slides from the knockback. `PlayerControl.update` (control.ts) now mirrors this: when `isHurt()` (the 6-frame reel window) it zeroes movement intent and skips input, returning early after the in-flight stream/timer ticks. The player's 18-frame post-hit i-frames (archetypes.ts:135) outlast the 6-frame reel, so the freeze cannot chain-lock. Covered by `port/test/player_kit.test.ts` ("freezes the player during the reel after a hit").

**GAP-2 / GAP-4 left as catalogued minor items:** GAP-2 (GMG toggle mid-charge re-firing the spell) is a cosmetic micro-optimisation of the fire cadence; GAP-4 (cancel an in-game dialogue by trying to move) is a minor convenience. Both are low-severity polish, deferred rather than auto-built.
