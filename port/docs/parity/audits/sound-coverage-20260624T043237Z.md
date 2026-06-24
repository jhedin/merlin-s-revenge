# Sound / Audio Coverage Audit — 20260624T043237Z

Scope: the audio analog of `effect_liveness`. Two directions:
- **A. Trigger coverage** (cast → port): every cast sound TRIGGER fires in the port at the right moment with the right name.
- **B. Liveness** (bundle ↔ port): every bundled `sounds`/`music` entry is requested by some play path; conversely every cast sound name has a shipped file (or is a known data-vocab gap).

Derived from: `casts/master_objects/soundMaster.txt`, `casts/script_objects/*` (the `playSound`/`playMusic` call sites), `casts/data/act_*` (`#sound`/`dieSound`/`collectSound`/…), `cut_scenes/*`, `extracted/engine/scripts/*`, `port/src/generated/{data,assets}.json`, and `port/src/{systems/audio.ts, components/*, world/rooms.ts, main.ts}`.

**Headline:** the data-driven SFX layer is faithful and complete — every bundled SFX has a live trigger and every actor sound field flows `data.json → cfg → audio.play()`. The real findings are all in the **music/bundle** layer: **3 dead bundled music tracks** and **1 added (cast-absent) charge SFX**. No missing SFX trigger, no wrong SFX name.

---

## A. Trigger coverage table

Every cast sound trigger and its port call site. "FAITHFUL" = fires on the right event with the right (data-resolved) name.

| Cast trigger (file:line) | Sound source | Port call site | Verdict |
|---|---|---|---|
| `objAiAttack.performAttack` melee :306 | `getAttack().sound` (data `#attack.sound`) | `control.ts:806` `play(this.atkSound,0.5)` (CPU) | FAITHFUL — `atkSound` ← data `attack.sound` (weapon.ts:203) |
| `objAiAttack.performAttack` ranged :314 | `getAttack().sound` | `control.ts:806` (CPU ranged shares the attack path) | FAITHFUL |
| player natural/sword melee (`act_player #punch`/`act_merlinSword`) | `#sound` = `wizard_punch` / `skeleton_fire` | `control.ts:386` `play(usingSword?"skeleton_fire":"wizard_punch")` | FAITHFUL outcome, **hardcoded** (see GAP-2) |
| `objCharacter.goMode #die` :202 / `#stretchDeathStarted` :235 | `pDieSound` (actor `dieSound`) | `combat.ts:47,94` `play(this.dieSound,0.6)` | FAITHFUL — `dieSound` ← data |
| `objDwelling.goMode #dead` :80 | `pDieSound` | `combat.ts:47,94` (dwellings carry `dieSound`) | FAITHFUL (note: dwelling die sounds are data-vocab gaps — see B) |
| `modExploder.explode` :42 / `objExplodingBullet` :55 | `pExplodeSound` (`#explodeSound`) | `mine.ts:117`, `projectile.ts:83` `play(explodeSound,0.5)` | FAITHFUL — `#none`-guarded |
| `objSpell.goMode #explode` :155 | `attack.explodeSound` | `spellActor.ts:168` `play(explodeSound)` / `projectile.ts:83` | FAITHFUL — data-driven (healBlast→`heal_spell_explode`) |
| `objSpell.playReleaseSound` :225 | `attack.releaseSound` | `spellActor.ts:115` / `control.ts:314,913` / `projectile.ts:140` | FAITHFUL — falls back to `spell_release` when `#none` |
| `objPlayerCharacter.takeHit` :163 / `modEnergy.loseEnergy` :206 | `pTakeHitSound` | `hurt.ts:58` `play(takeHitSound,vol)` | FAITHFUL — non-lethal only; player `wizard_hit` is a data-vocab gap (see B) |
| `objPowerUp.collect` :57 / `objPowerUpWriting` :42 | `pCollectSound` | `pickup.ts:70` `play(POTIONS?"collect_powerup_02":"collect_powerup_01")` | FAITHFUL — resolves `act_powerUp` `_02` for potions, `_01` for medikit/scroll |
| `modExperience.levelUp` :210 | literal `"level_up"` | `experience.ts:66` `play("level_up")` (+ `main.ts:286` on banked-life respawn) | FAITHFUL |
| `objRoom.attemptOpenExits` :205 | `pRoomClearedSound` = `"end_screen"` (objRoom.ls:34) | `rooms.ts:385` `play("end_screen")` (gated off the map-win clear) | FAITHFUL |
| `gameMaster.gameComplete` :91 | `gGameCompleteSound` = `"end_level"` (GameSpecific.ls) | `main.ts:224` `play("end_level")` on the "complete" cutscene | FAITHFUL |
| `objMusic.start` :27 (region marker) | `pMusicName` (data `musicName`) | `regionMarker.ts` `playMusic(value)` ← `actorSerial.ts:51` | FAITHFUL — data-driven; `stopMusic` sentinel honored |
| cutscene `playSound`/`playMusic` script-verbs | `args.memberToPlay` | `cutscene.ts:35-63` parses; CutscenePlayer dispatches | FAITHFUL for the SHIPPED scripts (see GAP-1: the music cue lives in an *unbundled* variant) |
| `objHairCharacter.growHairSequence` :188 | `pGrowHairSound` (default `#none`) | (not wired) | FAITHFUL — every actor uses default `#none`; silent in original too |
| `objCharacter.goMode #jump` :212 | `pJumpSound` (default `#none`) | (not wired) | FAITHFUL — always `#none` |
| `objCPUCharacter.takeHit` :206 | `pHitByHairSound` (default `#none`) | (not wired) | FAITHFUL — always `#none` |
| `modExtraLives.lifePowerUpCollected` :78 | `pExtraLifeSound` (default `#none`) | (not wired) | FAITHFUL — always `#none` |
| `objFlyingEnemyCharacter.doJump` :34 | `pFlapSound` (default **`"flap_wings"`**) | (not wired) | FAITHFUL OUTCOME — `flap_wings` is unshipped (data-vocab gap), so the original is also silent |

No summon / teleport / spell-charge / building-finished / menu-click / UI-click sound TRIGGERS exist in the cast (searched `casts/` exhaustively) — so the port is correct to omit them. Screen-transition audio in the original is the room-cleared (`end_screen`) and game-complete (`end_level`) cues above, both wired.

---

## B. Liveness

### B1. Bundled SFX (`assets.json.sounds`, 29 entries) — every one is LIVE

Each bundled SFX is requested by a play path:
- Data-driven via `data.json` fields (24): all `*_fire` (skeleton/goblin/orc/blackOrc/darkGolem/boulder/dragon/hydra1/hydra2/vulture/fangBunny/fangBunnyBaby/quadranid), `blackOrc_die`/`tree_die`/`greyGhost_die` (dieSound), `dragon_hit`/`vulture_hit` (takeHitSound), `spell_explode`/`spell_release`/`heal_spell_explode`/`heal_spell_release` (attack release/explode), `collect_powerup_01`/`collect_powerup_02`, `wizard_punch`.
- Hardcoded literals (4): `level_up` (experience.ts:66), `end_level` (main.ts:224), `end_screen` (rooms.ts:385 + cutscenes), `spell_charge` (control.ts:252 — **but absent from the cast; see GAP-3**).

The static census flagged `end_level / end_screen / level_up / spell_charge` as "not in any data.json sound field," but all four are LIVE via hardcoded literal triggers (the first three are correct cast literals; `spell_charge` is the lone added one). **0 dead SFX.**

### B2. Bundled MUSIC (`assets.json.music`, 8 entries) — **3 DEAD**

| Track | Referenced by | Status |
|---|---|---|
| `baroque_rock_v1` | data `musicName` + main.ts:122/236 (title) | LIVE |
| `baroque_rock_techno_v1` | data `musicName` (region) | LIVE |
| `electronic_merlin_v1_02` | data `musicName` + main.ts:209 (dungeon) | LIVE |
| `last_stand_v4` | data `musicName` + main.ts:224 (complete) | LIVE |
| `woods_of_evil_v1` | data `musicName` (region) | LIVE |
| **`final_stand_2_v1`** | **nothing** — not in `casts/`, not in `cut_scenes/`, not in any port path | **DEAD BUNDLE** |
| **`merl2319_v1`** | only `cut_scenes/mr3Complete.txt:96 playMusic merl2319_v1` — an UNUSED complete-script variant | **DEAD BUNDLE** (see GAP-1) |
| **`the_ultimate_song_thing_v1`** | **nothing** | **DEAD BUNDLE** |

`build_assets.ts:223` bundles *every* `.mp3` in `extracted/music/` indiscriminately, so three never-referenced tracks rode along (analog of the 17 `*_explode` strips). They waste ~bundle size only; no behavioral bug, but they should be pruned or wired.

### B3. Cast sound names with NO shipped wav (genuine data-vocab gaps — already flagged "ok" by build_assets.ts:217/422)

| Sound name | Used by (data) | Effect |
|---|---|---|
| `boulder_die` | 13 actors' `dieSound` (golems, boulders, rocks, skeletonDwelling…) | silent — `audio.play()` no-ops on unbundled name (audio.ts:163) |
| `goblin_hut_die_02` | 7 actors' `dieSound` (goblin huts/houses, dojo, tvBox) | silent |
| `wizard_hit` | `act_player.takeHitSound` | **player takes no hit sound** — silent |
| `flap_wings` | `objFlyingEnemyCharacter` default `flapSound` | silent on every flap |

These are faithful: the original Director movie referenced these SFX cast members but the wavs were never authored/shipped (only 29 SFX members exist in `extracted/.../sounds/`). Outcome is identical (silent) in original and port. **Not wiring bugs.** (Worth a one-line note if any are ever authored later.)

---

## Findings (classified)

### GAP-1 — `merl2319_v1` complete-cutscene music: wrong/missing source script (dead bundle ⇄ unbundled cue)
- **Class:** taxonomy #4 (bundled-but-never-requested) + #1 (seam).
- `build_assets.ts:168` copies `cut_scenes/mr4Complete.txt` → `complete.txt`. `mr4Complete.txt` has NO `playMusic` line. The `playMusic merl2319_v1` cue lives only in the sibling `cut_scenes/mr3Complete.txt:96`, which is never bundled. The canonical game-complete script for this game IS `#cut_scene_to_play_at_end` (GameSpecific.ls:13, `gGameName=#merlin_3`), whose member equals `mr4Complete` (no music) — so `mr4Complete` is the *correct* script and `merl2319_v1` is genuinely unused by the shipped game. The port substitutes its own hardcode `last_stand_v4` (main.ts:224) on the complete cutscene.
- **Verdict:** `merl2319_v1` is **dead bundle**. The port's `last_stand_v4` on complete is a deliberate substitution (the original complete script plays no music; region markers drive in-game music). **Impact: low.** **Fix:** prune `merl2319_v1`/`final_stand_2_v1`/`the_ultimate_song_thing_v1` from the music bundle in `build_assets.ts` (restrict to tracks named by `data.json musicName` ∪ the cutscene `playMusic` members of the *shipped* scripts ∪ the 4 main.ts hardcodes), OR if `last_stand_v4`-on-complete is undesired, wire the complete cutscene to honor its script's `playMusic` (it currently has none).

### GAP-2 — player melee sound is hardcoded, not data-driven (`control.ts:386`)
- **Class:** taxonomy #3 (trusted divergence) — fragile, not currently wrong.
- `control.ts:386` plays `this.usingSword ? "skeleton_fire" : "wizard_punch"`. `usingSword` is true only for `#weaponMelee`. The player's three actually-equippable melee weapons resolve to exactly these: `#punch`→`wizard_punch`, `energyPunch`(`#magicMelee`,`usingSword=false`)→`wizard_punch`, `merlinSword`(`#weaponMelee`)→`skeleton_fire`. **All correct today.** But the value is duplicated from data instead of read from `this.swingAttack.sound`, so if the player ever gains a melee weapon with a different `#sound` (e.g. a `blackAxe`→`blackOrc_fire` scroll), it would play `skeleton_fire`. The CPU path (`control.ts:806`) already does it the right way via `atkSound`.
- **Verdict:** FAITHFUL outcome, latent bug. **Impact: low** (no current pickup grants such a weapon). **Fix:** `control.ts:386` → `game.audio?.play(this.swingAttack?.sound || (this.usingSword?"skeleton_fire":"wizard_punch"))` (use the resolved `AttackData.sound`; keep the literal as a fallback for the `#punch` default).

### GAP-3 — `spell_charge` SFX is played by the port but has NO cast trigger (`control.ts:252`)
- **Class:** taxonomy #3 (added behavior stamped as parity).
- The string `spell_charge` appears NOWHERE in `casts/` (only the bitmap strip `anm_spell_charge` and the wav `002_spell_chargeC.wav`). The original's only spell sounds are `attack.releaseSound` (objSpell:225) and `attack.explodeSound` (objSpell:155); **charging is silent.** The wav was a preloaded SFX cast member the original never played (a dead SFX in the *original*). The port turns it live at `control.ts:252` (and the GMG re-charge loop) on charge start.
- **Verdict:** added sound, divergence from the original (which is silent while charging). **Impact: low** (arguably an enhancement; it does keep the bundled wav live). **Fix (parity):** remove the `play("spell_charge")` at `control.ts:252` to match the original's silent charge, OR document it as an intentional enhancement (and then `spell_charge` is correctly live). Recommend a one-line decision note, not a silent keep.

---

## Proposed standing guard — `test/sound_liveness.test.ts`

Model on `test/effect_liveness.test.ts` (and extend the existing `test/audio.test.ts`). Two static assertions over `assets.json` + concatenated `src/*.ts` (+ the shipped cutscene scripts under `public/assets/`):

```ts
// Sound liveness (AUDIT-CHARTER §4, audio analog): every bundled SFX/music must be REQUESTED by some
// play path (data.json sound field OR an audio.play()/playMusic() literal OR a shipped cutscene playSound/
// playMusic verb), else it's bundled-but-never-played dead audio. Conversely every data/literal sound name
// must be either bundled OR a documented data-vocab gap (no shipped wav).
import { describe, it, expect } from "vitest";
import assets from "../src/generated/assets.json";
import data from "../src/generated/data.json";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";

// known data-vocab gaps: cast names with no shipped wav (original never authored them) — silent in BOTH.
const VOCAB_GAPS = new Set(["boulder_die", "goblin_hut_die_02", "wizard_hit", "flap_wings"]);

function srcBlob(): string { /* walk src/ excluding generated, concat .ts (as effect_liveness.allSrc) */ }
function cutsceneBlob(): string { /* concat public/assets/{intro,wasted,complete}.txt + any bundled scr_* */ }
function dataSoundNames(): Set<string> { /* recurse data.json: collect every value of a *sound* key (excl #none) */ }
function dataMusicNames(): Set<string> { /* recurse: collect every value of a musicName key (excl stopMusic) */ }

describe("sound liveness", () => {
  const src = srcBlob() + cutsceneBlob();
  const requestedSfx = new Set([...dataSoundNames(), ...src.matchAll(/play\(\s*"([a-z0-9_]+)"/gi)].map(m=>m[1]))]);
  const requestedMusic = new Set([...dataMusicNames(), ...src.matchAll(/playMusic\(\s*"([a-z0-9_]+)"/gi)].map(m=>m[1]))]);

  it("every bundled SFX is requested by some play path (no dead SFX)", () => {
    for (const name of Object.keys(assets.sounds ?? {}))
      expect(requestedSfx.has(name), `dead bundled SFX: ${name}`).toBe(true);
  });

  it("every bundled music track is requested by some play path (no dead music)", () => {
    // CURRENTLY FAILS for final_stand_2_v1 / merl2319_v1 / the_ultimate_song_thing_v1 (GAP-1) — fix the bundle.
    for (const name of Object.keys(assets.music ?? {}))
      expect(requestedMusic.has(name), `dead bundled music: ${name}`).toBe(true);
  });

  it("every cast/literal sound name is bundled OR a known data-vocab gap", () => {
    for (const name of dataSoundNames())
      expect(!!assets.sounds?.[name] || VOCAB_GAPS.has(name), `unbundled & undocumented sound: ${name}`).toBe(true);
  });
});
```

This guard would have caught GAP-1 (red on the 3 dead tracks) and locks B1/B3. Pruning the bundle (GAP-1 fix) turns the music assertion green. The SFX-name assertion encodes the VOCAB_GAPS allowlist so a genuinely *new* unbundled name (a real wiring bug) fails loudly while the 4 historical gaps stay green.

---

## Summary

- **Trigger coverage:** every cast SFX trigger fires in the port with the correct, data-resolved name. No missing SFX trigger, no wrong SFX name. Music (region markers) is data-driven and faithful; the 4 main.ts music hardcodes (title/dungeon/complete) are deliberate substitutions for the screen-FSM layer.
- **Liveness:** 29/29 bundled SFX live; **3/8 bundled music tracks dead** (`final_stand_2_v1`, `merl2319_v1`, `the_ultimate_song_thing_v1`); 4 cast sound names are genuine unshipped data-vocab gaps (silent in original too).
- **One added sound** (`spell_charge`) with no cast trigger — decide enhancement vs. parity-removal.
