# keyMaster Parity Audit

**Sources examined**
- Original: `casts/master_objects/keyMaster.txt`, `casts/data/bnd_wasd.txt`, `bnd_arrow.txt`, `bnd_zqsd.txt`, `bnd_mac.txt`, `casts/data/kyd_all.txt`
- Original callers: `casts/script_objects/objAiPlayer.txt` (canonical), `casts/New folder/objAiPlayer.txt` (variant)
- Port: `port/src/systems/input.ts`, `port/src/components/control.ts`, `port/src/main.ts`, `port/src/scenes/screens.ts`

---

## 1. Every game key/action the original reads

The key-description file (`kyd_all.txt`) is the authoritative list of named actions exposed to the player. All bindings are per-scheme (WASD shown; arrow / zqsd / mac differ only in the physical key):

| #keyName | WASD keyNum | Resolved key (approx.) | Action triggered |
|---|---|---|---|
| `#up` | 13 | W | `getMoveVector` → `moveHoriz/moveVert` |
| `#down` | 1 | S | `getMoveVector` → `moveHoriz/moveVert` |
| `#left` | 256 | A | `getMoveVector` → `moveHoriz/moveVert` |
| `#right` | 2 | D | `getMoveVector` → `moveHoriz/moveVert` |
| `#wizard` | 3 | F | `pCharacterPrg.summonWizard()` — toggle the selected wizard in/out of combat |
| `#wizardSelector` | 15 | R | `pCharacterPrg.selectNextWizard()` — cycle which wizard will be summoned |
| `#weaponSelector` | 12 | Q (WASD) / Ctrl (arrow) | `pCharacterPrg.displayWeaponSelector()` — open the weapon-selector palette |
| `#gmg` | 14 | G | `pCharacterPrg.setGmg()` — toggle the Golden Machine Gun mode on/off |
| `#army` | 8 | C | `pCharacterPrg.summonArmy()` — summon a full battalion |
| `#escape` | 120 | Esc | `gameMaster.escapePressed()` — open/close the pause menu |
| `#spell1`…`#spell9` | 18–26 | 1–9 | `pCharacterPrg.selectSpell(1)` … `selectSpell(9)` — select magic weapon by slot |
| `#invincibility` | 34 | — (cheat) | `gameMaster.cheat(#invincibility)` |
| `#killAll` | 40 | — (cheat) | `gameMaster.cheat(#killAll)` |
| `#medikit` | 46 | — (cheat) | `gameMaster.cheat(#medikit)` |
| `#testHit` | 17 | T (WASD) | `pCharacterPrg.flickWhite()` — debug hit flash |

Mouse (handled in `interpretMouse`, not via keyMaster):
- `#pressed` → `playerAttackCharge()` — begin holding the spell/melee
- `#released` → `playerAttackRelease()` — fire the charged spell at the cursor

**Note on `#weaponSelector` scope**: in `casts/New folder/objAiPlayer.txt` (the variant), `#weaponSelector` is inside `case gGameName of #merlin_3`. In `casts/script_objects/objAiPlayer.txt` (canonical), it is unconditional (`interpretGameKeys`, lines 189–196). The canonical version is used here.

---

## 2. Per-key wiring status in the port

### Movement — `#up / #down / #left / #right`
**Status: WIRED**

`input.ts` SCHEMES map correctly: `wasd` binds W/S/A/D, `arrows` binds arrow keys, `zqsd` binds Z/Q/S/D, `both` merges all. `moveVector()` is read each tick in `control.ts:126` (`const mv = input.moveVector()`) and applied to `Movement.intentX/Y`. Faithful to `keyMaster.getMoveVector` + `interpretMoveKeys`.

### Fire / attack / charge-release — mouse
**Status: WIRED**

`input.attachMouse()` wires `mousedown`/`mouseup` edges; `input.mouseDown()` = held, `input.mousePressed()` = edge. `control.ts:148` reads `input.mouseDown() || input.held(" ")` for hold-to-charge, and releases on the else-branch. Space-bar as fallback is a port addition (non-gap). The aim cursor is `input.cursor()` (`control.ts:138`), matching `getTargetLoc` → `g.mouseMaster.getMouseLoc()`.

### `#escape` — pause / resume
**Status: WIRED**

`main.ts:314`: `if (input.pressed("escape")) { scene.escapePressed(); ... }`. `SceneManager.escapePressed()` toggles the ingame-menu overlay, faithful to `gameMaster.escapePressed()`.

### `#gmg` — Golden Machine Gun toggle
**Status: WIRED**

`control.ts:129`: `if (input.pressed("g")) this.setGmg();`. Direct edge-press of "g", matching original keyNum 14 (G key, all schemes). Correctly gated on `gmgCollected_`.

### `#spell1`…`#spell9` — magic weapon selection
**Status: WIRED** (fixed; was the known gap)

`control.ts:134`: `for (let n = 1; n <= 9; n++) if (input.pressed(String(n))) this.wm().selectSpell(n - 1);`. Physical keys "1"–"9" map directly to the original's keyNums 18–26 (Director keycode 18="1", 19="2", …). Covered by `port/test/spell_select.test.ts`.

**Caution**: save/load were originally on "1"/"2" in `main.ts` but have been moved to F5/F9 (`main.ts:316–317`), freeing "1"/"2" for #spell1/#spell2. The port's title-screen hint still says "save/load: 1/2" (`main.ts:431`) — that hint is stale but is UI text only, not a functional gap.

### `#wizard` — summon/unsummon the selected wizard
**Status: MISSING (GAP)**

Original: `objAiPlayer.interpretGameKeys:145` calls `pCharacterPrg.summonWizard()` on `getKeyResult(#wizard)`.
Port: No `input.pressed("q")`, `pressed("e")`, or any wizard-summon call exists anywhere in `control.ts` or `main.ts`. The `keyForControlInScheme` method in `input.ts:99` returns the string `"Q"` for display purposes only — it is never actually read by the game loop. The title-screen hint (`main.ts:431`) says "summon: E" which contradicts `keyForControl` returning "Q", and neither key triggers any summon action at runtime.

`modSummonWizard.summonWizard()` (the toggle summon/unsummon implementation) has no port equivalent called from player input.

### `#wizardSelector` — cycle which wizard to summon
**Status: MISSING (GAP)**

Original: `objAiPlayer.interpretGameKeys:193` calls `pCharacterPrg.selectNextWizard()` on `getKeyResult(#wizardSelector)`.
Port: `input.ts:100` returns "Tab" from `keyForControlInScheme("wizardSelector")` for display only. No `input.pressed("tab")` is read anywhere in `control.ts` or `main.ts`. `modSummonWizard.selectNextWizard()` has no port runtime call path.

### `#army` — summon a battalion
**Status: MISSING (GAP)**

Original (`casts/script_objects/objAiPlayer.txt:153`): `pCharacterPrg.summonArmy()` on `getKeyResult(#army)`. Listed in `kyd_all.txt` as "Summon a Battalion". The WASD binding is key 8 = "c".
Port: No `pressed("c")`, `pressed("h")`, or equivalent exists in `control.ts` or `main.ts`. `armySummon` as a *spell* is implemented (charge-and-cast via `summonUnit` in `spellActor.ts`), but the dedicated one-shot army-summon *hotkey* (bypassing the spell charge) is absent.

### `#weaponSelector` — open the weapon-selector palette
**Status: MISSING (GAP)**

Original (`casts/script_objects/objAiPlayer.txt:189–190`): `pCharacterPrg.displayWeaponSelector()` on `getKeyResult(#weaponSelector)`. The stones scripts (`scr_stones6–10.txt`) reference `#key #weaponSelector` in dialogue. The WASD binding is key 12 = "q".
Port: `input.ts` has no binding for "weaponSelector" in its `keyForControlInScheme` switch (it falls through to the `default: return c` branch, returning the literal string "weaponselector"). No `pressed(...)` call for this action exists in `control.ts` or `main.ts`. The key-config overlay (`screens.ts`) does not list `weaponSelector` in `KEY_DESCRIPTIONS`. The weapon-selector palette UI itself does not exist — the 1–9 hotkeys are the only switching mechanism.

---

## 3. Global/initial state and default keyset

**Default keyset**: `keyMaster.init` sets `pDefaultKeySet = #wasd` (`keyMaster.txt:19`). `loadKeySet` reads the pref file (`MerlinsRevengeKeys.txt` = "wasd"), falling back to `#wasd`. The port reads `localStorage.getItem("mr_scheme")` defaulting to `"both"` (`input.ts:28`). The original default is `#wasd`; the port default is `"both"` (WASD + arrow keys combined). The `"both"` superset is a strict superset of `"wasd"`, so no original-game player loses movement bindings — movement parity is preserved. This is a deliberate UX choice, not a breakage.

**Movement schemes**: WASD, arrows, and ZQSD all port faithfully. The original's `#mac` scheme (arrows + numpad keys) has no port equivalent, but Mac-specific keycodes are irrelevant for a web port.

**Action key defaults**: the original's WASD scheme binds non-movement actions to F (#wizard), R (#wizardSelector), Q (#weaponSelector), G (#gmg), C (#army). The port binds only G (#gmg) and 1–9 (#spell1–9). The wizard/army/weaponSelector bindings are undocumented in the port and unimplemented.

**Keyset persistence**: original uses `setPref`/`getPref` on `gKeySetFileName`; port uses `localStorage("mr_scheme")`. Functionally equivalent, correctly restored on reload.

---

## 4. Test coverage

| Test file | What it covers | Gap? |
|---|---|---|
| `port/test/input.test.ts` | movement scheme switching (wasd/zqsd/arrows), `moveVector()` output, edge `pressed()` | Movement only |
| `port/test/spell_select.test.ts` | 1–9 key → `selectSpell(n-1)` → WeaponManager switch | spell1–9 WIRED and tested |
| — | `#wizard` key → `summonWizard()` | NO TEST |
| — | `#wizardSelector` key → `selectNextWizard()` | NO TEST |
| — | `#army` key → `summonArmy()` | NO TEST |
| — | `#weaponSelector` key → weapon palette UI | NO TEST |
| — | `#gmg` key → `setGmg()` toggle | NO TEST (covered incidentally in phase_i tests but not as a key-binding assertion) |
| — | `#escape` key → pause/resume | Covered in `sceneManager.test.ts` for FSM logic but not as an input.pressed("escape") round-trip |

**Missing test**: there is no test asserting that pressing the wizard-summon key fires `summonWizard`, pressing Tab fires `selectNextWizard`, pressing the weaponSelector key opens the palette, or pressing the army key fires `summonArmy`. These are all currently unwired so a test would fail.

---

## Summary table

| #keyName | Action | Port status |
|---|---|---|
| `#up / #down / #left / #right` | movement | WIRED |
| mouse-pressed / mouse-released | charge + release magic | WIRED |
| `#escape` | pause/resume menu | WIRED |
| `#gmg` | Golden Machine Gun toggle | WIRED (`g` key) |
| `#spell1`…`#spell9` | select magic weapon slot | WIRED (`1`–`9`) |
| `#wizard` | summonWizard() toggle | **MISSING** — key name returns display string "Q" but no input.pressed() wired |
| `#wizardSelector` | selectNextWizard() cycle | **MISSING** — key name returns "Tab" for display only; no input.pressed() wired |
| `#army` | summonArmy() hotkey | **MISSING** — no key binding; spell-based army summon exists but the dedicated hotkey does not |
| `#weaponSelector` | weapon-selector palette | **MISSING** — palette UI absent; key not bound; stones cutscene `#key #weaponSelector` text will display the raw string "weaponselector" |
| `#invincibility / #killAll / #medikit` | debug cheats | not mapped (intentional; debug-only) |
| `#testHit` | debug hit flash | not mapped (intentional; debug-only) |

---

## 5. Triage outcome (2026-06-21)

**FIXED — concrete display bug.** `keyForControlInScheme` (input.ts:97–106) fell through to `default: return c` for `spell1..9`, `weaponSelector`, `army`, `gmg`. The bundled magic-tutorial cutscene `scr_stones6` (and 7–10) interpolates `#key #spell1` / `#key #weaponSelector`, so players saw "press **SPELL1** to change back to energy blast" / "press **WEAPONSELECTOR** and click the orange icon". Now resolves: spell1..9 → "1".."9" (the port's wired number keys), weaponSelector → "Q", army → "C", gmg → "G" (the original WASD bindings) for faithful `#key` display. Covered by `port/test/input.test.ts`.

**FIXED — stale title hint.** `main.ts:431` said "summon: E   save/load: 1/2"; save/load moved to F5/F9 and 1/2 now select spells. Now reads "spells: 1-9   save/load: F5/F9   pause: Esc   mute: M".

**`#weaponSelector` palette — BUILT (2026-06-21).** The E key now opens `modWeaponSelector`: a palette of the player's owned weapons grouped magic (above) / nonMagic (below) per `structWeaponSelectorPaletteOffsets`, each icon on a greenBox (available) / yellowBox (current) — clicking an icon `setCurrentWeapon`s and closes; otherwise it auto-closes after the 60-frame idle timer. The 24 `*_ws` icon assets are now bundled by `tools/build_assets.ts` (→ `weaponIcons/<sym>.png`, looked up via `assets.weaponIcon`). `port/src/scenes/weaponPalette.ts` + `port/test/weapon_palette.test.ts`. (Bound to E because Q/Tab are the wizard-summon keys; `keyForControl("#weaponSelector")` now reports "E".)

**`#wizard` / `#wizardSelector` / `#army` summon-helper — BUILT (2026-06-21).** A `#wizard:true` ally (act_*InGame) now registers itself as "found" on spawn (`newWizardFound`, in `spawnUnit`) and is marked teleportable so it banks to the army reserve on room-leave. The keys: **Q** (`summonWizard`) summons the selected found wizard at the cursor — re-fielded from the reserve when banked, else a fresh spawn — and toggles it back out (`armyTeleportOut`); **Tab** (`selectNextWizard`) cycles which found wizard; **C** (`summonArmy`, modAutoSummon) re-fields a battalion of the player's banked reserve, spread around the cursor and capped by `gMaxFriends`. New `port/src/systems/wizardMaster.ts` (the found-wizards registry) + `PlayerControl.summonWizard/summonArmy`; covered by `port/test/wizard_summon.test.ts`. Adaptation: the original summons strictly from the reserve (a wizard must have been banked first); the port falls back to a fresh spawn so a found wizard is always summonable — preserving the observable behaviour.
