# Cutscene Parity Audit: STONES / LORE in-game cutscenes

**Original scripts:** `casts/data/scr_stones1.txt` … `scr_stones10.txt`
**Original infra:** `casts/script_objects/modThespian.txt`, `objScriptPerformer.txt`, `objChatter.txt`, `casts/master_objects/cutSceneMaster.txt`
**Original actor defs (chatters):** `casts/data/act_stones1..10.txt`, `act_loreStone.txt`, `act_kingStones.txt`, `act_armySummonStones.txt`, `act_goblinRunnerStones.txt`
**Port:** `port/src/data/cutscene.ts` (parser), `port/src/scenes/thespian.ts` (engine), `port/src/scenes/cutscenePlayer.ts` (host), `port/src/components/chatter.ts` (trigger), `port/src/main.ts` (in-game host wiring), `port/tools/build_assets.ts` (bundling)
**Method:** REPRODUCED. A throwaway probe (`port/tools/_audit_stones.ts`, since deleted) parsed each `scr_stonesN.txt`, drove the REAL `Thespian` with `{ ingame: true, bound: { m: liveMerlin } }` and a stub host capturing speech/title/sound, ticked to completion, and diffed derived say-lines vs observed speech.
**Date:** 2026-06-23
**Auditor:** Claude Code (manual; engine stepped, not just read)

---

## Important note on the named target scripts

The audit prompt named `scr_loreStone`, `scr_kingStones`, `scr_armySummonStones`, `scr_goblinRunnerStones`.
**No such `scr_*` scripts exist** in `casts/data/`. Those names are the *actor* definitions
(`act_loreStone.txt` etc.), each a `#inherit:#chatter` with a `#scriptToPerform` symbol:

| Actor def | `#scriptToPerform` | resolves to | exists in `casts/data`? |
|---|---|---|---|
| `act_stones1..10` | `#stones1..10` | `scr_stones1..10` | YES (the live lore stones) |
| `act_loreStone` | `#loreStoneBlackSorcerer` | `scr_loreStoneBlackSorcerer` | **NO** |
| `act_kingStones` | `#rescueKing` | `scr_rescueKing` | **NO** |
| `act_armySummonStones` | `#collectArmySummon` | `scr_collectArmySummon` | **NO** |
| `act_goblinRunnerStones` | `#goblinRunner` → `scr_goblinRunner` | `scr_goblinRunner` | **NO** |

The four missing scripts live ONLY in `in_game_scenes_(don't_play)(If you want to make one, go to data, scr_stones1, through 10)/`
(`loreStoneBlackSorcerer.txt`, `rescueKing.txt`, `collectArmySummon.txt`, `goblinRunner.txt`). The folder name itself
says *don't play*. `collectionsMaster` only loads `casts/data/`, so in the ORIGINAL,
`cutSceneMaster.playCutScene(#rescueKing)` → `getObject(#objScript,#rescueKing)` finds nothing → the scene cannot run.
These four chatters are dead/unfinished content in the original. (See divergence D2.)

So the ACTUAL readable lore stones that play in-game are `scr_stones1..10`. `scr_stones6..10` are the army-summon
tutorial (text identical to the dead `collectArmySummon`), so even the army-summon lesson that *does* fire goes through
`act_stones6..10`, not `act_armySummonStones`.

---

## SECTION 1 — Derived behavior (from the original scripts + infra)

### Trigger & environment (objChatter → cutSceneMaster → objScriptPerformer → modThespian)
- `objChatter.collected` (objChatter.txt:43-61): on player overlap, if not yet performed → `goMode(#talking)` (swap to talking member) → `g.cutSceneMaster.playCutScene(pScriptToPerform)` → latch `pPerformed`. Gated by `talkOnlyOnNavMode` (default true): only triggers in nav mode (room cleared).
- `cutSceneMaster.playCutScene` (cutSceneMaster.txt) → `beginPerformance` → `calcEnvironment`: no cutscene-background sprite ⇒ `pEnvironment = #ingame`. `getSpeechDisplayMode` returns `#ingame`, propagated to every actor via `objScriptPerformer.introduceMeToPlayers` (only when `pCaller = cutSceneMaster`) → `modThespian.setSpeechDisplayMode(#ingame)`.
- `#ingame` ⇒ `displaySpeechInGame` (modThespian.txt): bubble above the speaker's head + a blended background rect — NOT the top-of-stage `displaySpeechCutScene` caption.
- Cast binding (`objScriptPerformer.acquirePlayers`/`createMissingPlayers`): `#playerCharacter` resolves to the LIVE Merlin (already on screen); other characters (`#ulin`,`#berlin`,`#prestotolin`) are spawned at the wings and teleported/walked in by script verbs.

### Line model (objScriptPerformer + modThespian)
- `calcDisplayTimeForLine`: `displayTime = 50 (basicTimePerLine) + chars·1.4 (timePerLetter)` frames, then `12 (timeBetweenLines)` frames of cleared speech (`#delayAfterLine`). Auto-advance — NO keypress.
- Speech is `#key`-interpolated at DISPLAY time (`interpretSpeechVariables`, modThespian.txt:353): each `#key <control>` pair is replaced by the live bound key, **wrapped in QUOTE characters** (`QUOTE & currentKey & QUOTE`, line 360).
- `wait N` (cutSceneMaster.wait) blocks the chain N frames. `teleportInAt`/`teleportOut` are non-blocking (animate; `lineFinished()` fires immediately).
- `scriptFinished` (objScriptPerformer): created players → wings → finished; `cutSceneMaster.scriptFinished` → `movieMaster.cutSceneFinished` → resume gameplay (in-game scene, no screen change).

### Per-script line inventory (derived — all are `displaySpeechInGame`)
- **stones1** (`m`=#playerCharacter, `u`=#ulin): 32 say-lines (ulin tutorial: summon/#wizard/#wizardSelector, simpletons, autoteleport, Arctic Blast). 4 lines carry `#key` (`#wizard`×2, `#wizardSelector`). `u teleportInAt`, several `wait`, final `u teleportOut`.
- **stones2** (`m` only): 1 line `m: I should grab that energy blast to the south...`. No teleports.
- **stones3** (`m`,`u`,`p`=#prestotolin): 23 say-lines. ulin+prestotolin teleport in; mid-script `u teleportOut → wait 60 → u teleportInAt → wait 20 → u: you too, Prestotolin.`; ends `p: I'm goin'…` then `u/p teleportOut`.
- **stones4** (`m`,`b`=#berlin): 5 lines (berlin "Sit and Be Fit").
- **stones5** (`m`,`u`): 13 lines (edge-of-world / DRAGONS).
- **stones6–10** (`m`,`u`): 12 lines each, IDENTICAL army-summon tutorial. 4 lines carry `#key` (`#spell1`, `#weaponSelector`×2, `#spell2`).

---

## SECTION 2 — Observed (probe over the real Thespian)

| Script | derived say-lines | observed speech | order | speaker attribution | `#playerCharacter`→ | completes? |
|---|---|---|---|---|---|---|
| stones1 | 32 | 32 | exact | exact | `merlin` | YES (4474t) |
| stones2 | 1 | 1 | exact | exact | `merlin` | YES (209t) |
| stones3 | 23 | 23 | exact | exact | `merlin` | YES (2662t) |
| stones4 | 5 | 5 | exact | exact | `merlin` | YES (665t) |
| stones5 | 13 | 13 | exact | exact | `merlin` | YES (1318t) |
| stones6 | 12 | 12 | exact | exact | `merlin` | YES (1432t) |
| stones7 | 12 | 12 | exact | exact | `merlin` | YES (1432t) |
| stones8 | 12 | 12 | exact | exact | `merlin` | YES (1432t) |
| stones9 | 12 | 12 | exact | exact | `merlin` | YES (1432t) |
| stones10 | 12 | 12 | exact | exact | `merlin` | YES (1432t) |

**Result: every line displays, in source order, attributed to the correct speaker; `#playerCharacter` binds to the
live Merlin (alias `m`, rendered as speaker `merlin`); ulin/berlin/prestotolin spawn + teleport/re-teleport in and out
correctly (stones3's ulin re-entry before "you too, Prestotolin." is preserved — no dropped line); every stone
COMPLETES; and the engine runs `ingame: true` so speech renders as a head bubble (`renderInGame` / `displaySpeechInGame`),
not the cutscene caption.** The ONLY observed text mismatches were the `#key` lines (analyzed as D1).

---

## SECTION 3 — Divergences

### D1 — `#key` interpolation: missing surrounding quotes + forced uppercase  → **PORT-BUG (minor / cosmetic)**

Original wraps the substituted key in literal QUOTE characters and uses the key's natural casing; the port emits the
bare key force-uppercased (no quotes).

```
ORIGINAL  casts/script_objects/modThespian.txt:353-363  (interpretSpeechVariables)
  currentKey = g.keyMaster.getKeyFor(value(theSpeechText.word[i+1]))
  theSpeechText = ...word[1..i-1] && QUOTE & currentKey & QUOTE && ...word[i+2..]
  -- "press #key #wizard"  ->  press "W"      (quoted, key's own case)
```
```
PORT      port/src/scenes/thespian.ts:402-408  (interpretSpeech)
  return text.replace(/#key\s+#?(\w+)/g, (_m, ctrl) => {
    const k = this.host.keyForControl?.(ctrl);
    return k ? k.toUpperCase() : ctrl;            // no surrounding quotes; .toUpperCase()
  });
  // observed: press [WIZARD]->"WIZARD"? no: -> press Q ; #spell1 -> 1 ; #weaponSelector -> E
```
Effect: e.g. `press #key #spell1` shows as `press 1` (port) vs `press "1"` (original); `#weaponSelector` shows `E`
(port, uppercased) vs the keyMaster's cased glyph in quotes (original). All other words around the key are byte-identical.
Functionally the player still sees the right key; the quoting/casing is cosmetic. Re-evaluation at display time
(rebinding updates the line) is faithfully preserved on both sides.

### D2 — Named lore-stone chatters (loreStone/kingStones/armySummonStones/goblinRunnerStones) never play  → **FAITHFUL**

Their `#scriptToPerform` targets (`#loreStoneBlackSorcerer`, `#rescueKing`, `#collectArmySummon`, `#goblinRunner`) have
no `scr_*` script in `casts/data/` — they live only in the `in_game_scenes_(don't_play)…` folder, which
`collectionsMaster` never loads. So neither engine can play them:

```
ORIGINAL  casts/script_objects/objChatter.txt:53  ->  cutSceneMaster.playCutScene(#rescueKing)
          casts/master_objects/cutSceneMaster.txt (playCutScene)
            pScriptToPerform = g.collectionsMaster.getObject(#objScript, #rescueKing)  -- NOT FOUND
```
```
PORT      port/src/components/chatter.ts:66-67  ->  game.scene.playInGameCutScene("rescueKing")
          port/src/main.ts:231-237  ->  loadCutscene("rescueKing", manifest)
            manifest has no "rescueKing"  -> fetch "cutscenes/rescueKing.txt" (NOT bundled by
            tools/build_assets.ts:174-181, which bundles only stones1..10) -> 404 -> null
            -> scene.cutSceneFinished(name) -> resume gameplay
```
Both fail to play these scenes; the port degrades gracefully (latch + resume) rather than erroring. The port does NOT
ship these scripts (`build_assets.ts` bundles `scr_stones1..10` only) — matching the original's "don't play" status.
Not a regression. (Note: the live army-summon tutorial that *does* fire uses `act_stones6..10` → `scr_stones6..10`,
which are bundled and play correctly — see Section 2.)

### Non-divergences confirmed (FAITHFUL)
- **In-game speech mode**: chatter path forces `ingame: true` (main.ts:236) ⇒ `displaySpeechInGame` bubble, matching
  `calcEnvironment` ⇒ `#ingame`. Correct mode, not the cutscene caption.
- **`#playerCharacter` binding**: alias `m` bound to the live player (`{ m: player }`, main.ts:236); speaker rendered
  `merlin` (thespian.ts:392). No spawned-duplicate Merlin.
- **Line order / no dropped lines**: incl. stones3's ulin teleport-out → teleport-in → "you too, Prestotolin." re-entry.
- **Completion**: all 10 finish (no hang on trailing `wait`/`teleportOut`).
- **Line timing model**: `50 + chars·1.4` + `12` gap, auto-advance (thespian.ts:31-33,396-397) = objScriptPerformer.
- **Whitespace in lines** (double space after `:` in stones1 `u:  It will…`) preserved by the `\s?` say-regex.
- **No titles**: no stones script uses `showTitle`; no title concerns.

---

stones | DIVERGENCES=1 (D1 #key quoting/casing = PORT-BUG; D2 dead named scripts = FAITHFUL)
