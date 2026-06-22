# Per-Actor Parity Audit: `scMonk`

**Method:** Behavior derived from `casts/data/act_scMonk.txt` + inherit chain (`#CPUCharacter` → `#character` → `#actor`) + the weapon `casts/data/act_scSummon.txt`, `objAiCPUSpellCaster`, `modSpellMultistage`, `structMaster.structAttack`, `animStripMaster`. Reproduced by RUNNING `tools/_audit_scMonk.ts` (real `src/generated/assets.json` bundle, scMonk + a forced `#aldevar` target on an 80×80 grid, 250 ticks, summons counted by team/type; probe deleted after audit).

scMonk is a **scarlet summoner** (`#objAiCPUSpellCaster`, `#weapon: #scSummon`). Its spell is itself a *summon* (`#explodeFunction:#summonUnit`) that fields scWarrior/scArcher/scMonk by charge tier. It does NOT throw a damage bolt as its primary purpose — it summons reinforcements (the energyBlastBullet payload still lands a small radial hit).

---

## 1. Identity & Data — RUN-confirmed

| Property | Original (`act_scMonk.txt`) | Port (observed) | Match |
|---|---|---|---|
| `#objType` | `#objCPUCharacter` | `EnemyArchetype` | ✓ |
| `#AiType` | `#objAiCPUSpellCaster` | `optimumPosition` mode seen; `dodgesBullets`/`runReload` true | ✓ |
| `#character` | `#enemyCharacter` | (irrelevant to sprite — see §2) | n/a |
| `#name` (sprite char) | `"scMonk"` | resolves to **`blackOrc`** | ✗ **DIV-1** |
| `#team` | `#scarlet` | `#scarlet` | ✓ |
| `#weapon` | `#scSummon` | `#scSummon` (magic, reach 9999, explodeFunction `#summonUnit`) | ✓ |
| `#energy` | `175` | energyFrac 1 (full) | ✓ |
| `#strength` | `5` | 5 | ✓ |
| `#dexterity` | `1` | 1 | ✓ |
| `#inertia` | `75` | 75 | ✓ |
| `#walkSpeed` | `4` | 4 (×0.6 px slice) | ✓ |
| `#damageSpeed` | `6` | 6 | ✓ |
| `#experienceImWorth` | `30` | 30 | ✓ |
| `#chargeOffsetSide` / `#chargeLoc` | `#top` / `(0,-10)` | cosmetic muzzle | ✓ |
| `#mana_capacity` | `17` | 17 | ✓ |
| `#mana_flow` | `2` | 2 | ✓ |
| `#mana_regeneration` | `1` | 1 | ✓ |
| `#mana_capacityIncLevel` | `1` | 1 (forwarded) | ✓ |
| `#stallSpeed` / `#stallSpeedIncLevel` | `0.5` / `1` | reel-recovery rate — not modeled | WONTFIX |
| `#miniMapStatus` | `#inf` | no minimap in port | WONTFIX |
| `#reincarnateAs` | `[#fire]` | forwarded (`archetypes.ts:401`) | ✓ |

---

## 2. Animation Strips & sprite resolution

Original keys strips by the actor's `#name` (`scMonk`). The bundle DOES ship a full scMonk strip set:

| Strip key in `assets.json` | frames | loop |
|---|---|---|
| `scMonk_Stand` (capital **S**) | 1 | true |
| `scMonk_walk` | 8 | true |
| `scMonk_charge` | 4 | true |
| `scMonk_chargeWalk` | 4 | true |
| `scMonk_release` | 5 | false |
| `scMonk_releaseWalk` | 5 | true |
| `scMonk_reel` | 1 | false |
| `scMonk_grave` | 2 | false |

For comparison the sibling summons key their stand strip **lowercase**: `scArcher_stand`, `scWarrior_stand` (both present). Only scMonk's stand strip is `scMonk_Stand`.

### DIV-1 (PORT BUG): scMonk renders as `blackOrc` — its entire bundled strip set is dropped

**Observed (probe):**
```
animChar              : blackOrc   (expected 'scMonk')
scMonk_stand bundled  : false   scMonk_Stand bundled: true
...
summon counts by type : {"scArcher(char=scArcher)":10, "scMonk(char=blackOrc)":1}
```
Every scMonk — the caster itself AND any scMonk it summons — renders as a generic blackOrc. The summoned **scArcher** correctly renders as `scArcher`; only scMonk is broken, isolating the cause to the strip-key casing.

**Dual-tree evidence:**

- **Original cast member name (faithful data quirk):** `extracted/manifest.json` → `anm_scMonk_Stand_03_01L`. The original Director cast literally names scMonk's stand member with a capital `Stand`, while its other members are lowercase (`anm_scMonk_walk_…`, `anm_scMonk_release_…`, `anm_scMonk_reel_…`). This inconsistency is in the SHIPPED art.
- **Original engine tolerates it (case-insensitive symbols):** `casts/master_objects/animStripMaster.txt:69-71` — `data[3] = symbol(data[3])` converts the action token to a Lingo **symbol**, and Lingo symbols are case-insensitive: `symbol("Stand") == symbol("stand") == #stand`. So the original keys the strip under `#stand` and `modAnimSet.getAnimSym(#stand)` resolves it normally. The monk shows its real sprite.
- **Port keeps a case-SENSITIVE string key:** `port/tools/build_assets.ts:105,108` — `const action = t[2]`; `const key = \`${char}_${action}\``. The raw token `Stand` is preserved verbatim, producing `scMonk_Stand`.
- **Port lookup is lowercase-only:** `port/src/components/anim.ts:40-44` (`spriteCharOr`): it gates the char on `anims[\`${dn}_stand\`]` (lowercase `scMonk_stand`) → miss → falls through to `anims[\`${name}_stand\`]` (also `scMonk_stand`) → miss → no `CHAR_ALIAS` entry → **`return fallback` ("blackOrc")**. `archetypes.ts:351` then builds the unit with `animChar="blackOrc"`.

**Why the whole set is lost, not just stand:** `spriteCharOr` gates the *entire* char on the `_stand` probe. Because `scMonk_stand` (lowercase) is absent, the char never resolves to `"scMonk"`, so the present `scMonk_walk/charge/release/reel/grave` strips are never reached either. The monk is 100% blackOrc.

**Classification: PORT BUG.** The art is shipped and correct; the original engine displays it. The port's case-sensitive strip keying + lowercase-only `_stand` gate is a regression from Lingo's case-insensitive `symbol()`. Two faithful fixes (either is sufficient): (a) lowercase the action token when keying strips in `build_assets.ts` (mirrors `symbol()`), or (b) make `spriteCharOr`/`animFor` case-insensitive. Option (a) is closest to the original (symbols are case-folded at ingest). NOTE: this likely affects any other actor with a capitalized member-name token — worth a sweep, but out of scope for this single-actor audit.

---

## 3. Weapon / Spell (`#scSummon`) — FAITHFUL

| Property | Original (`act_scSummon.txt`) | Port (observed) |
|---|---|---|
| `#animType` | `#magic` | `#magic`, type magic ✓ |
| `#explodeFunction` | `#summonUnit` | `#summonUnit` ✓ |
| `#animframe` | `#none` | `[]` (empty → cast fires on strip-complete, not per-frame) ✓ |
| `#reach` | `9999` | 9999 (room-scale clamp) ✓ |
| `#cooldown` | `15` | 15 (effective ≈14-15 frame cadence observed) ✓ |
| `#bullet` | `#energyBlastBullet` | `#energyBlastBullet` ✓ |
| `#spellSpeed` | `25` | 25 → fly speed ✓ |
| `#randomSummon` | `true` | true ✓ |
| `#multistage` | `scWarrior:16, scArcher:17, scMonk:20` | parsed ascending `[16,17,20]` ✓ |
| `#chargeStart` / `#chargeMax` | `3` / `22` | 3 / 22 ✓ |
| `#residentTeamCategory` | `#enemies` | summons join `#scarlet` (caster's team) ✓ |
| `#targetAllegiance` | `#enemy` | `#enemy` ✓ |
| charge ceiling (`chargeMaxModifier`/`Basic` default `1`/`0`) | `min(22, 17·1+0)=17` | `chargeMaxOf=17` ✓ |

**Summon tier math (derived & confirmed):** With `chargeMaxModifier`/`chargeMaxBasic` unset, both default to `1`/`0` (`structMaster.txt:147,149`; port `STRUCT_ATTACK` `registry.ts:22`). Ceiling = `min(22, capacity·1 + 0) = min(22,17) = 17`. The randomSummon wobble (`charge.ts:36-43`) only fires when `tier2 - cm < 0`; here `17 - 17 = 0` → no wobble. So at base level scMonk deterministically summons the highest tier ≤ 17 = **scArcher (17)**, never the scWarrior fallback and (initially) never scMonk(20).

**Observed:** 10× scArcher + 1× scMonk over 250 ticks. The lone scMonk appears AFTER the caster levels up (`gainXp 0.5` per summon → `mana_capacityIncLevel:1` raises capacity → ceiling reaches 20 → scMonk tier becomes affordable). This is faithful tier-escalation behavior, not a divergence.

**AI (`objAiCPUSpellCaster`) — FAITHFUL:** probe saw modes `moveToAttack` and `optimumPosition` (the reach-9999 bullet-dodge/kite chain). `runReload`+`dodgesBullets` set (`archetypes.ts:264-267`). Casts at full ceiling on strip-complete (`#animframe #none`), summon FLIES to the target loc and fields the unit there (`control.ts:809-821`), so summons don't pile on the caster.

**Summoned-unit team routing — FAITHFUL:** summoned scArcher/scMonk carry `#scarlet` (caster's team), spawn as `type=enemy`. ✓

---

## 4. Death / grave / reincarnate — FAITHFUL

- `graveOn` defaults true → leaves a grave (`scMonk_grave` exists but is rendered through the blackOrc fallback → DIV-1 also taints the corpse sprite).
- `#reincarnateAs:[#fire]` forwarded (`archetypes.ts:401`) → splits into `#fire` on lethal death.

---

## Divergence Summary

| # | Severity | Kind | Summary |
|---|---|---|---|
| DIV-1 | High (visual) | **PORT BUG** | scMonk (caster + summoned) renders as `blackOrc`: bundle ships `scMonk_Stand` (capital S) but `spriteCharOr` gates on lowercase `scMonk_stand`. Original engine case-folds action tokens via `symbol()` (`animStripMaster.txt:69-71`); port keeps case-sensitive string keys (`build_assets.ts:105-108`, `anim.ts:40-44`). The whole strip set is lost, not just stand. Fix: lowercase the action token at ingest (faithful to `symbol()`), or case-insensitive strip lookup. |

All other behavior (spellcaster AI/kiting, scSummon multistage tiers + charge ceiling, randomSummon wobble gating, level-driven tier escalation, energyBlastBullet payload, team routing, reincarnate `#fire`) is FAITHFUL.

`scMonk | DIVERGENCES=1`
