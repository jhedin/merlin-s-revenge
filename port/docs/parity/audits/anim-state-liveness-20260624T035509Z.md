# Per-actor anim-state liveness + spawn-presentation audit — 20260624T035509Z

Charter lens: **§4 Visual LIVENESS** ("an asset bundled but never requested by any render path"). The
existing `test/effect_liveness.test.ts` covers cross-actor effect *families* (`*_explode`, `spell_charge`,
`spellIcons_*`, `*_writing`). This audit extends that to **per-actor `<char>_<state>` strips**: every bundled
state-family must be reachable by some render/FSM path, else it is "bundled but never drawn" — the class that
shipped the 17 dead `*_explode` strips and the wizard portraits.

Probe (gitignored): `tools/_audit_anim_states.ts` enumerates 617 anim keys, groups by char+state suffix, and
marks each state with the port code path that can select it (or DEAD/NA). Re-run: `npx tsx tools/_audit_anim_states.ts`.

---

## PART 1 — Per-actor anim-state liveness

### How states get selected in the port

State strings are **computed** (`${char}_${action}`), never string-literal grep targets — so the existing
liveness lint's token search would miss them. The selectors are:

| Driver | States it can return | `file:line` |
|---|---|---|
| `Anim.pickAction` | `stand`, `walk`, `grave` (+ `animAction` override) | `src/components/anim.ts:151-162` |
| `Hurt.animAction` | `reel` | `src/components/hurt.ts:80` |
| `PlayerControl.animAction` | `naturalMelee`/`weaponMelee`, `release`/`releasewalk`, `charge`/`chargewalk` | `src/components/control.ts:415-422` |
| `CpuAI.animAction`/`attackAction` | `naturalMelee`,`weaponMelee`,`weaponRanged`,`naturalRanged`,`charge`,`release`,`build` | `src/components/control.ts:570-600` |
| `Mine.animAction` | `primed`, `explode` | `src/components/mine.ts:65` |
| `drawBullets` (not Anim) | `<char>_fly`, `<char>_explode` only | `src/main.ts:721,736-737` |

`#naturalRanged` (27 strips) and the summon face icons are all confirmed LIVE.

### DEAD state-families — bundled but no port code path drives them (31 strips, 4 families)

| Char(s) | State | Strips | Cast intent | Real gap vs N/A | Fix |
|---|---|---|---|---|---|
| 24 bullet chars (gobarrow, archerArrow, axe, towerAxe, shuriken, skeletonHead, smokePin, blueFlame, spark, needle, lizardEgg, ostrichEgg, scArcherArrow, iceboulder, skelitonMissile, lightning, laser, acid, fireBall, fangBunnyBabyBullet, crossBolt, batBullet, boulder, thunderBlast) | `land` | **24** | A plain `#type:#bullet` projectile, on STALL (friction decay) or wall-collision, goes `#land` mode and plays its `<char>_land` strip ONCE (`objBullet.txt:155-167, 207-209, 278-299`: `goMode(#land)` → `updateLand` → `getAnimLooped(#land)` → die + reincarnate). The landing splat/stick (arrow embeds, axe thuds, egg cracks). | **REAL.** Plain bullets in the port carry friction (`archerArrow friction:{x:5,y:5}`, CPU passes it at `control.ts:1031`), stall in `Projectile.update`, and call `finish()` → `done=true` with **no land strip** (`projectile.ts:145-148`). `drawBullets` only ever draws `_fly`/`_explode` (`main.ts:737`), never `_land`. The whole 24-strip family draws ZERO frames — direct analog of the 17 dead `*_explode`. | On stall (`projectile.ts:145`), for a NON-splash bullet whose char has a `_land` strip, enter a brief `landing` substate (mirror `exploding`): zero velocity, hold position, play `<char>_land` one-shot for its strip length, THEN `finish()` (reincarnate). Add the `_land` branch to `drawBullets` (`main.ts:735`) alongside `_explode`. |
| dwarfTower, goblinHut, goblinHouse, garTower, goblinMageHut | `beBuilt` | **5** | The "under-construction" art a dwelling/tower shows while a `modBuilder` CPU constructs it (`objCharacter`/`modAnimSet` `getAnimSym` → `#beBuilt` while not yet markBuilt). | **REAL (builder path only).** `CpuAI.builderLookForBuilding` spawns the building and sets `b.flags.add("underConstruction")` (`control.ts:1212`), cleared on completion (`:1249`) — but **nothing reads that flag** (grep: only the set/delete sites). The building shows its finished `stand` sprite the whole build, never the half-built `beBuilt` frame. | Give the building archetype an `animAction` (or extend `Dwelling`) returning `"beBuilt"` while `entity.flags.has("underConstruction")` and a `${char}_beBuilt` strip exists; else `next()`. |
| fangBunnyPortal | `produceGroup` | **1** | The portal's "spawning a wave" animation (`objDwelling.txt:58-59`: `getAnimSym` returns `#produceGroup` while `residentMode == #produceGroup`). | **REAL (one spawner).** Port `Dwelling` tracks a `produce` mode (`dwelling.ts:22,55,63`) but has **no `animAction` handler** — the portal stays on `stand` while producing. | Add `Dwelling.animAction(): mode==="produce" && hasStrip("produceGroup") ? "produceGroup" : null`. |
| mer (player) | `magicMelee` | **1** | `mer_magicMelee` is the 7-frame **energyPunch** swing. energyPunch is a real collectable player scroll (`act_energyPunch`, `#animType:#magicMelee`); on swing `modAnimSet.getAnimSym` returns the weapon's animType → plays `mer_magicMelee`. | **REAL (player-reachable).** energyPunch IS grantable in the port (`pickup.ts:96 equipSword(scrollAttack("energyPunch"))`). But `tryStartSwing` sets `usingSword = animType === "#weaponMelee"` → false for `#magicMelee`, so `PlayerControl.animAction` returns `naturalMelee` (`control.ts:373,418`). The energyPunch DAMAGE is correct (`control.ts:407`); only the distinct swing ANIMATION is dropped — the player throws a generic punch instead of the energy-punch strip. | In `PlayerControl.animAction`, return `"magicMelee"` when the in-swing weapon's `animType === "#magicMelee"` and `mer_magicMelee` is bundled; track the swing's animType on `tryStartSwing` (alongside `usingSword`). |

### N/A — bundled art with no cast driver, or intentionally superseded (not port gaps)

| Char | State | Why N/A |
|---|---|---|
| mer | `die` (1) | The player uses `stretchDeath:true` (`act_player.txt:41`) — a magical stretch-fade death (`anim.ts` STRETCH_DURATION), which holds the BODY frame, not a `die` strip. `mer_die` is the legacy side-scroll death frame; superseded by stretchDeath, which the port implements. Every other char dies via `_grave`. |
| mer | `weaponMagic`, `weaponMagicWalk` (2) | `#weaponMagic` animType has **0 actors** in `data.json` (only `#magic`/`#magicMelee` exist). No weapon drives this strip in the cast either. |
| ber | `mosh`, `strum`, `rock` (3) | Berlin band-cutscene art. **No `#mosh`/`#strum`/`#rock` symbol anywhere in the cast** (grep clean) — the original has no driver. The thespian DSL *could* drive them via `goMode #mosh` (`thespian.ts:274,500-510`), but no shipped cutscene script does. |
| king | `play` (1) | king-playing-music art; no `#play` symbol in cast. |
| fangBunnyPortal | `altStand` (1) | No `#altStand` driver in cast. |
| scw | `sideStand` (1) | Side-scroll heritage stand variant (cf. the dropped `#jump`/`#fall` modes in `objCharacter.txt:204-212`); no top-down driver. |
| ostrichEgg | `02` (1) | A numbered sheet variant (`ostrichEggland_02`); no driver. |

These 10 strips are bundled art the **original engine itself never wires up** (or that the top-down port
correctly supersedes). Dropping them is faithful — they should be *excluded* from the standing guard, not
flagged.

### Proposed STANDING guard (extends `effect_liveness.test.ts`)

A static lint asserting every bundled per-actor **state-family** is reachable by some selector, with an
explicit ALLOWLIST of the N/A states (so a NEW dead family fails loudly). Because selectors compute the
state string, the test asserts the *family token* appears in a known selector site OR the state is allowlisted:

```ts
// test/anim_state_liveness.test.ts — every bundled <char>_<state> family is selectable, or explicitly N/A.
import { describe, it, expect } from "vitest";
import assets from "../src/generated/assets.json";

// states a selector can return (see control/anim/hurt/mine + drawBullets). Keep in sync with the drivers.
const SELECTABLE = new Set([
  "stand","walk","grave","reel","charge","chargewalk","release","releasewalk",
  "naturalmelee","weaponmelee","weaponranged","naturalranged","build","primed","explode","fly",
  "armysummon","goblinsummon","monstersummon","scsummon","skelitonsummon","undeadsummon","firebullets",
  // FIX these to add their selectors, then move them up:
  "land","bebuilt","producegroup","magicmelee",
]);
// art with no cast driver / intentionally superseded — faithful to drop. Document each.
const NA = new Set(["die","weaponmagic","weaponmagicwalk","mosh","strum","rock","play","altstand","sidestand","02"]);

const STATES = ["weaponMagicWalk","naturalMelee","weaponMelee","weaponRanged","naturalRanged","weaponMagic",
  "magicMelee","releaseWalk","chargeWalk","releasewalk","chargewalk","altStand","sideStand","beBuilt","release",
  "charge","produceGroup","fireBullets","build","primed","stand","walk","reel","die","grave","land","fly",
  "explode","mosh","strum","rock","play","special","02",
  "armySummon","goblinSummon","monsterSummon","scSummon","skelitonSummon","undeadSummon"];
const stateOf = (k: string) => STATES.find(s => k.toLowerCase().endsWith(s.toLowerCase()))?.toLowerCase() ?? "?";

describe("anim-state liveness: every bundled <char>_<state> family is selectable or explicitly N/A", () => {
  const states = new Set(Object.keys((assets as any).anims).map(stateOf));
  for (const s of states) {
    it(`state "${s}" is reachable by a selector (or allowlisted N/A)`, () => {
      expect(SELECTABLE.has(s) || NA.has(s)).toBe(true);
    });
  }
});
```

This guard fails today on `land`/`bebuilt`/`producegroup`/`magicmelee` only because they are listed in
`SELECTABLE` *aspirationally* — once their selectors are wired (fixes above) the test documents them as
genuinely live; a brand-new bundled family with no entry fails immediately.

---

## PART 2 — Spawn-presentation properties (`#initFaceDir`, `#startOffset`)

Cast definitions: `objGameObject.txt:58,70,135` (defaults + use). Both are *init params* of `objGameObject`.

### `#startOffset` — **N/A (behavior present, expressed differently)**

- **Cast:** `actorMaster.startActor` adds it to the spawn loc — but **only when `useOffsets` is true**
  (`actorMaster.txt:204-207`). The base `act_actor` sets `#startOffset: point(-16,-16)` (`act_actor.txt:9`),
  inherited by all combat units.
- **Who passes `useOffset=true`:** the DEFAULT (`actorMaster.txt:31`), but nearly every spawn path explicitly
  sets it FALSE — room restore (`objRoom.txt:625,667`), residents (`modResidents.txt:157`), bullets
  (`modAttack.txt:694,791`), army (`armyMaster.txt:91,121`), builder (`objAICPUBuilder.txt:222`), spell
  (`modSpellMultistage.txt:140`), scriptPerformer (`objScriptPerformer.txt:86`). The one path that keeps the
  default `true` is the **primary initial tile placement** `objTileLayer.activateActors`
  (`objTileLayer.txt:179-183`): `objectLoc = tileLoc*tileSize + mapLocation`, then `+ startOffset`.
- **What it does:** with `tileSize=32` and `startOffset=(-16,-16)`, it shifts a tile-corner anchor to the
  tile **center** — a uniform half-tile centering. No actor varies the value from `-16,-16`.
- **Port:** the tile spawn at `rooms.ts:251` already spawns at `c*t + t/2, r*t + t/2` (tile center, `t=32` →
  +16). This is the *same* centering, inlined as half-tile rather than read from a per-actor property. The
  property has 0 readers because the math is hardcoded — and since the cast value is uniform, that is faithful.
- **Verdict: N/A.** Dropping the per-actor `#startOffset` is invisible. (Were any actor to set a non-(-16,-16)
  offset it would matter, but none does.)

### `#initFaceDir` — **REAL but cosmetic / low impact**

- **Cast:** `setSpriteFlipFromDir(params.initFaceDir)` at spawn (`objGameObject.txt:135`); default `1` = face
  right. 23 actors set it explicitly; **8 set `-1` (face LEFT at spawn): goblinRunner, berlin, kingStones,
  prestotolin, king, ochre, ulin, ochreHydra.** The other 15 set `1` (= the default, already correct).
- **Port:** `Movement.facingLeft` defaults `false` (= face right = `initFaceDir:1`), and `#initFaceDir` has
  **0 readers** (`movement.ts:41`). So the 8 `-1` actors spawn facing RIGHT instead of LEFT.
- **Is it visible?** Mostly no:
  - The 8 `-1` actors are **all cutscene/scripted** (berlin/prestotolin/ochre/ulin are the cutscene wizards;
    king/kingStones are cutscene kings; goblinRunner is a scripted demo runner, `#scriptToPerform:#demo_006_ulin`;
    ochreHydra a boss-intro actor). The port's thespian drives facing per speaking line via `turnToFace`
    (`thespian.ts:451-454`) and per walk (`:486,497`), so their facing is corrected on the first script beat.
  - Any **moving combat** actor (incl. goblinRunner once it runs) has `Movement` flip facing to the
    walk/aim vector on the first moving frame (`movement.ts:159`), overwriting the initial value.
  - The only window the gap is visible is the **first few frames after spawn, before the first
    turnToFace/walk** — e.g. a cutscene wizard who materializes facing right then snaps left on his first line.
- **Verdict: REAL but low/cosmetic.** A faithful, cheap fix is worth it for the cutscene wizards' entrance.
- **Fix sketch:** in the actor build path (`archetypes.ts` / `actorSerial.ts` `spawnFromSymbol`), read the
  resolved actor's `initFaceDir` and set `Movement.facingLeft = (initFaceDir === -1)` on init (default right).
  Thespian/Movement then overwrite it on the first turn/walk as today, but the *spawn* frame is correct.

---

## Summary

- **Dead state-families: 4** (`land` ×24, `beBuilt` ×5, `produceGroup` ×1, `magicMelee` ×1) = **31 bundled
  strips drawing zero frames.** `land` is the big one — the bullet "landing splat" family, exact analog of the
  17 dead `*_explode` that triggered this whole lens.
- **10 N/A strips** correctly dropped (player stretchDeath supersession + band/king cutscene art with no cast
  driver + side-scroll heritage). Allowlist them in the guard.
- **`startOffset`: N/A** — tile-centering is hardcoded as half-tile in `rooms.ts:251`, faithful (value is
  uniform -16,-16). **`initFaceDir`: REAL but cosmetic** — 8 cutscene actors spawn facing right not left;
  corrected within a frame by thespian/Movement; cheap to fix at spawn.
- Proposed standing guard: `test/anim_state_liveness.test.ts` (above), with an explicit N/A allowlist so the
  next bundled-but-never-drawn family fails loudly.

Probe: `tools/_audit_anim_states.ts` (gitignored). Investigation only — no port code changed.
