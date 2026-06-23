# Per-Actor Parity Audit: `pitMonster`

Method: REPRODUCED in the port engine against the real bundled `assets.json` (throwaway probe
`tools/_audit_pitMonster.ts`, since deleted). Spawned the mine + a hated target (blackOrc/#monsters)
30px away, ticked 250 frames, observed the FSM, hit, anim and cadence.

`pitMonster` is a **stationary re-arming pit trap** — an `#objMine` (`objMine.txt` + `modAttack` +
`modExploder`). It sits on its tile, primes, and every few frames checks for a hostile inside its
trigger disc; on a hit it runs an `#explode` area attack at its own loc, plays its emerge/explode
strip, then **re-arms** (it never dies — `dieOnExplode:false`, `dieOnExplodeNumber:0`).

> Supersedes the prior "CLEAN" audit, which only diffed data + FSM and never checked the
> `#primed`/`#explode` mode→strip presentation. The reproduction below shows those strips never play.

---

## SECTION 1 — Derived from the original cast/data

Source: `casts/data/act_pitMonster.txt`, `casts/data/tem_pitMonsters.txt`,
`casts/script_objects/objMine.txt`, `modExploder.txt`, `modAttack.txt`, `modAnimSet.txt`,
`objAnimSet.txt`, `master_objects/animStripMaster.txt`, `master_objects/teamMaster.txt`.

| Property | Original value | Meaning |
|---|---|---|
| `#inherit` / `#objType` | `#actor` / `#objMine` | mine archetype (objMine + modAnimSet + modAttack + modExploder) |
| `#team` / `#teamRole` | `#pitMonsters` / `#teamMines` | own hostile team; mine role (does not gate room-clear) |
| allegiance (`tem_pitMonsters`) | hates `#aldevar,#monsterSummon,#cave,#goblins,#ice,#ninja,#magicalAlliance,#monsters,#swamp,#undead,#village,#scarlet,#orcs`; no friends | hits almost everyone; everyone hates it back |
| movement | none — `#friction point(9,9)`, `#weight 0.4`, `#rotational false`, `#collideWithTarget false` | **stationary** trap |
| `#character` | `#mine` | passed to modAnimSet but UNUSED for strips (see below) |
| `#name` (sprite key) | `"pitMonster"` | `objAnimSet.init` keys strips by `params.name` → strips are `anm_pitMonster_*` |
| `#timeToPrime` | 120 | frames stand→primed |
| `timeToCheck` | (default 3) | frames between collision checks while primed |
| `#triggerRadius` | 50 (px) | proximity disc to trigger |
| `#dieOnExplode` | **false** | re-arm after each blast |
| `#dieOnExplodeNumber` | 0 | never die from a blast count |
| `#explodeEvents` | `[#mineTriggered]` | the event modExploder explodes on |
| `#explodeSound` / `#explodeVolume` | `#none` / 50 | silent |
| `#recordInRoomState` | true | persisted in the room |
| `#attack.type` | `#explode` | area disc, resolved once at trigger time |
| `#attack.explodeCharge` | 100 | explode radius = charge/2 = **50** |
| `#attack.power` | 0.05 | radial collision-vector scale (falloff) |
| `#attack.damageMultiplier` | 40 | takeHit dmg = L1(vector)·40 |
| `#attack.hits` | `[#teamMembers]` | hits team **members** only (NOT buildings) |
| energy | unset → `#actor` default (no `#energy` in chain) | mine isn't killed via energy; it self-detonates / re-arms |

**Sprite-char key (important).** `modAnimSet.init` → `pAnimSet.init(params.name, params.character)`;
`objAnimSet.init` calls `g.animStripMaster.getStripDefs(name)` with **`name = "pitMonster"`** — the
`#character: #mine` argument is passed but never used in `getStripDefs`. `animStripMaster.extractData`
keys strips by the member-name token `<chr>` from `anm_<chr>_<anim>_...`, and the original gfx members
are `anm_pitMonster_stand/_primed/_explode_*`. So the sprite character IS `pitMonster`, not `mine`.
(Confirmed in the port's bundled assets: `pitMonster_stand`, `pitMonster_primed`, `pitMonster_explode`
exist as distinct chars.)

**Original FSM + mode→strip (the load-bearing part the port differs on).**
- `objMine.update`: `#stand` → `updatePrime`; when `pPrimeCounter` fins → `goMode(#primed)`. `#primed`
  → `updateCheck` (every 3f) → `updateCheckCollisions` (`findTargetWithin(triggerRadiusTile).dist <
  triggerRadius²`) → on a hostile → `internalEvent(#mineTriggered)`.
- `modExploder.internalEvent(#mineTriggered)` → `explode`: `g.teamMaster.impactAttack(me.big)` (the
  **single** disc sweep — `#explode` damage is applied ONCE here, NOT per anim frame; pitMonster's
  `#attack` has no `#animFrame`), then `me.big.goMode(#explode)`.
- `modExploder.goMode(#explode)` → `me.big.resetAnim(#explode)` (replays the explode strip from frame 0).
  `modAnimSet.getAnimSym` maps `getMode()` directly: `#stand`→stand, `#primed`→primed, `#explode`→explode.
  So the original VISIBLY plays `pitMonster_stand` → `pitMonster_primed` → `pitMonster_explode` (the
  monster emerging).
- `modExploder.update`: while in `#explode`, `updateExplode` returns `getAnimLooped(#explode)` — i.e. it
  waits for the **48-frame** explode strip to play through — THEN fires `#explodeFin`.
- `objMine.internalEvent(#explodeFin)`: `dieOnExplode=false` → `resetMine()` (back to `#stand`, re-prime),
  `pExplosions++`; `dieOnExplodeNumber=0` so it **never dies**.

**Derived cadence (original):** 120 (prime) + 48 (explode strip plays out) + ~3 (check granularity) ≈
**~171 frames** between detonations.

---

## SECTION 2 — Observed in the port (probe, real assets.json)

Harness: `game.assets={index:assets.json, images:Map, img:()=>null, ensureChar:async()=>{}}`;
`game.grid=new CollisionGrid(80,80,32)`; `teamMaster.unitMap.configure(32,0,0)`; spawned mine +
hated blackOrc target 30px away; ticked all entities except the inert target; `rebuildCombatSubstrate()`
each tick.

```
PROBE assets pitMonster strips: pitMonster_stand, pitMonster_primed, pitMonster_explode
PROBE mine anim char: pitMonster -> isBlackOrc? false      <-- resolves to a REAL bundled strip
PROBE mine team #pitMonsters role #teamMines type mine
PROBE target blackOrc team #monsters type enemy energyFrac0 1
  t=119 mine mode stand -> primed                          (timeToPrime=120 ✓)
  t=122 mine mode primed -> stand   +  DETONATION #1  +  target dmg 1.000 -> 0.989
  t=242 mine mode stand -> primed
  t=245 mine mode primed -> stand   +  DETONATION #2
SUMMARY: detonations=2/250 ticks, mine dead? false, target died? no
         explode strip ever shown? FALSE     primed strip ever shown? FALSE
         mine anim final action: stand
```

Observed conclusions:
- **anim char** resolves to `pitMonster` (NOT blackOrc) — `spriteCharOr` finds `pitMonster_stand`. ✓
- **FSM** prime→check→detonate fires at the right frames; primes at 120, detonates ~3f later. ✓
- **hit lands** once per detonation on the hated target; **#explode is a single sweep**, not per-frame. ✓
- **re-arms forever** (`dieOnExplode:false`, mine never dead). ✓
- damage/blast: ~13/blast on a 1200-HP orc at 30px — radial vector (62−30)·0.05=1.6, L1·40=64 before
  Movement's universal inertia/weight damping → matches the engine-wide collision-vector path (not a
  pitMonster-specific number). ✓
- **`pitMonster_primed` and `pitMonster_explode` strips are NEVER shown** — only `stand` (and `grave`
  on death). And the detonate→re-arm is **instant** (no 48-frame explode pause). ✗ (see PORT-BUG).

---

## SECTION 3 — Dual tree: FAITHFUL vs PORT-BUG

```
pitMonster spawn
├─ data resolve (objType #objMine → spawnMine)
│   ├─ team #pitMonsters / role #teamMines ............................ FAITHFUL ✓
│   ├─ triggerRadius 50, timeToPrime 120, timeToCheck 3 ................ FAITHFUL ✓
│   ├─ dieOnExplode false, dieOnExplodeNumber 0 (re-arms forever) ...... FAITHFUL ✓
│   ├─ attack #explode charge 100→r50, power .05, mult 40 ............. FAITHFUL ✓
│   ├─ hits [#teamMembers] only (not buildings) ....................... FAITHFUL ✓
│   ├─ explodeSound #none (silent) .................................... FAITHFUL ✓
│   └─ energy unset → port default 50 (mine self-detonates; unused) ... FAITHFUL ✓ (cosmetic)
├─ anim char (objAnimSet keys by #name "pitMonster") ................... FAITHFUL ✓ (real strips, not blackOrc)
├─ FSM
│   ├─ stand→primed @120 .............................................. FAITHFUL ✓
│   ├─ primed→check every 3f → findHostileWithin(r50) → detonate ...... FAITHFUL ✓
│   ├─ #explode resolved ONCE per trigger (single disc sweep) ......... FAITHFUL ✓
│   └─ #explodeFin: re-arm (resetMine), explosions++, never dies ...... FAITHFUL ✓
└─ presentation / cadence
    ├─ play pitMonster_primed while primed ............................ PORT-BUG ✗  (only `stand` shown)
    └─ play pitMonster_explode (48f) + GATE re-arm on it playing out .. PORT-BUG ✗  (strip never shown;
        re-arm is instant → cadence ~123f vs original ~171f; no visible "monster emerges" tell)
```

### PORT-BUG (single divergence, two symptoms — same root cause)
The port's `Mine` archetype (`objTypes.ts` `MineArchetype` = Identity, Movement, Anim, Energy, Mine,
Team, Targeting) has **no component that drives `animAction`**. `Anim.pickAction` resolves only
dead→`grave`, an `animAction` override, or moving→`walk`/`stand` — and a mine never moves and (until
detonation) is never dead, so it is **permanently `stand`**. The original instead maps `getMode()`
(`#stand`/`#primed`/`#explode`) → strip via `modAnimSet.getAnimSym`. Consequences:
1. `pitMonster_primed` (armed/lurking) is never shown.
2. `pitMonster_explode` (the 48-frame monster-emerges blast) is never shown, AND because the port's
   `Mine.detonate` re-arms synchronously (`resolveSplash` → immediate `resetMine`) it does **not** wait
   for that explode strip (original `updateExplode` gates `#explodeFin` on `getAnimLooped(#explode)`).
   So the re-arm cadence is ~123f instead of ~171f, and there is no visual "pit monster" tell at all —
   the trap looks like a static tile that silently chips nearby units every ~2s.

Fix sketch (NOT applied — out of audit scope): give the Mine an `animAction` returning `"primed"` while
`getMineMode()==="primed"` and `"explode"` for the duration of the explode strip after a detonation, and
gate the re-arm/`resetMine` on the explode strip having looped (mirror `modExploder.updateExplode` →
`#explodeFin`). This restores both the emerge visual and the ~171f cadence. (Note: this is shared `Mine`
code — fire + the five auras carry the same `#explode` strips and would benefit identically.)

### FAITHFUL (verified, no action)
Team/allegiance, stationary movement, prime/check timing, trigger radius, the single-sweep `#explode`
damage (resolveSplash) with mult 40 / radius 50 / hits #teamMembers, the universal collision-vector
damping, the silent re-arming-forever behaviour, and the correct (non-blackOrc) sprite-char resolution
all reproduce the original.

---

`pitMonster | DIVERGENCES=1` — port never plays `pitMonster_primed`/`_explode` strips (Mine has no
`animAction`), so no emerge visual + detonate re-arms instantly (~123f vs original ~171f explode-gated cadence).
