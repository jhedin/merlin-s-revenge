# Parity Audit 02 — Actor Roster: Enemies, Bosses, Dwellings/Structures

Domain owner: agent 2. Scope: the actor catalog (characters, bosses, dwellings/structures),
their stats/animations/special scripts, and the port's spawn path
(`port/src/components/dwelling.ts`, `port/src/entities/archetypes.ts`, `port/src/world/rooms.ts`).

Out of domain (catalogued for seams only): the AI decision engine (agent 1), spell/weapon/summon
*effect* actors and bullets (agent 3), player/progression/masters (agent 4), world/render/shell
(agent 5).

Everything below is grounded in `casts/data/act_*.txt` (263 records), the system scripts
(`casts/script_objects/`, `casts/master_objects/`), the shipped slice map
(`map_to_play/tvsDemo.txt`), and the port's bundled assets (`port/src/generated/assets.json`).

---

## 1. Roster summary (by `#objType`, 263 `act_*` records)

| Category | `#objType` | Count | Owner | Port status |
|---|---|---|---|---|
| **Characters** (enemies, allies, bosses, summon-units, "InGame" army) | `#objCPUCharacter` | **97** | **agent 2** | data resolves for all; ~9 of slice's enemies spawn **generic** (blackOrc fallback art + generic beeline/kite AI) |
| **Dwellings / structures / portals** | `#objDwelling` | **18** | **agent 2** | faithful resident-wave loop in `dwelling.ts`; gaps below |
| Player leaf | `#objPlayerMerlinCharacter` | 1 | agent 4 | done (`spawnPlayer`) |
| Powerups (weapon/stat pickups) | `#objPowerUp` | 24 | agent 3/4 | partial (pickup tiles only) |
| Scrolls (spell grants) | `#objScroll` | 19 | agent 3 | energyBlast only |
| Mines | `#objMine` | 8 | agent 3 | missing |
| Medikit / Potion / Star / Spell / Magic / Music / TeamOverride / Chatter / Weapon / Bullet / ActorPlayer | various | 11 | agents 3/4/5 | mixed |
| **Base/abstract** (no `#objType`: `actor`, `character`, `CPUCharacter`, `dwelling`, `weapon`, `bullet`, weapons, bullets, effects, `*Stones`, music, cutscene leads `berlin`/`king`/`ulin`) | — | **85** | shared / agents 3-5 | `#inherit` parents resolve in data |

**The 97 characters break down (by `#team`)**: `#undead` 17, `#monsters` 15, **`#aldevar` 14**
(player-side: the 11 `*InGame` summonable heroes + dwarf/warrior/archer army units),
`#scarlet` 8, `#village` 6, `#goblins` 6, `#monsterSummon` 5, `#swamp`/`#magicalAlliance`/`#karate`/`#cave` 4 each,
`#orcs`/`#ninja` 3, `#ice` 2, `#ghosts`/`#blackSorcerer` 1.
So ~14 of the 97 are **allies** (summon/army), ~83 are **hostiles**.

**Summon-unit emitters (agent 3 owns the spell; agent 2 owns the spawned units' configs):**
`armySummon, goblinSummon, monsterSummon(Ai), scSummon, skelitonSummon, undeadSummon` — each
`#explodeFunction:#summonUnit` with a `#multistage` table of unit→charge-cost. `skelitonSummon` is the
skelitonUpper's weapon (it summons skeleton infantry mid-fight); this is the boss's add-spawn loop.

**AI-type spread (agent 1's machinery; agent 2 owns which actor selects which):** `#objAiCPU` 74,
`#objAiPowerUp` 20, `#objAiCPUSpellCaster` 20, `#objAiCPUBuilder` 2 (goblinBuilder + one more),
`#objAiCPUGhost`/`#objAiFlyingBomber`/`#objAiChatter`/`#objAiAttack` 1 each.

### Spawn fidelity buckets (characters)

- **Spawnable + faithful art/AI** (23 chars have bundled `_stand` art in `assets.json`):
  archer, ber(berlin), blackOrc, bowOrc, druid, dwarf, kongFuChicken, mageOrc, monk, ninja,
  ochreWizard, scw, shurikenNinja, **skelitonLord**, swordOrc, vultureGuard, warrior, uli, tv(evilTv)
  + the player (mer). Dwelling art: goblinHut, orcHouse, dojo, tv.
- **Spawn-but-generic** — resolves stats/attack from data but renders as **blackOrc** and uses a
  coarse AI bucket: every other hostile, including the slice's own enemies
  (goblinWarrior, greyGhost, skeletonArcher/Comando/Thrower/Warrior, undeadDragon, townWatch, farmer).
- **Missing** (no spawn path at all): mines, scrolls (except energyBlast), most powerups, chatter
  NPCs, music/loreStone props.

### What the shipped slice (`tvsDemo`, 4×1 rooms) actually places

Object-layer symbols in the slice: `player`; enemies `goblinWarrior, greyGhost,
skeletonArcher/Comando/Thrower/Warrior, undeadDragon, townWatch, farmer, evilTv`; the dwelling
`tvBox` (→ spawns evilTv); allies/army `dwarf, warrior, archer, kingInGame, flaetorlinInGame,
foelinInGame`; pickups `manaBurst/Capacity/Flow, walkSpeed, healBlast, energyBeamSpell`.
**No boss (skelitonLord/berlin/king) and no goblin/orc dwelling appear in this map** — those live in
unshipped maps. The closest in-slice set-pieces are `undeadDragon` (ranged flyer mini-boss) and the
`tvBox` dwelling.

---

## 2. Coverage table — Bosses & Dwellings (the deep audit)

Status legend: ✅ faithful · ◑ partial/generic · ✗ missing. Effort: S ≤ ½ day, M ~1-2 days, L = multi-day.

### Bosses

There is **no dedicated boss-AI script** in the source. Both major bosses are built from generic
modules + data, which is good news for the port — they are config + a few wiring features, not
bespoke engines.

| Boss item | Original behavior (from data) | Port status | Gap | Effort |
|---|---|---|---|---|
| **skelitonLord** (`act_skelitonLord`) | `#objCPUCharacter` / `#objAiCPU`, energy 750, str 14, `#weapon:#skelitonLordSword` (dmgMult 12), `#team:#undead`. The set-piece: **`#reincarnateAs:[#skelitonUpper,#skelitonLowerLeg,#skelitonSword]`** + `#reincarnateRadius:40`. On death the generic `modReincarnate` spawns those 3 parts at the corpse. | ☑ **E1** — generic `Reincarnate` component splits the Lord into its 3 parts at the corpse loc (verified in-browser on works_mr4Demo + mr4Demo: Lord→Upper+LowerLeg+Sword, fires once, no pageerrors); has bundled `skelitonLord` art | — | done |
| ↳ **skelitonUpper** | `#objAiCPUSpellCaster`, energy 220, `#weapon:#skelitonSummon` (summons infantry), reincarnates → `[skelitonTorsoTank, skelitonArm, skelitonArm]`. Casts + spawns adds. | ☑ reincarnates → TorsoTank+2 Arms (re-arms its own Reincarnate). Caster *summon* fire-loop deferred (plan §g — AI wiring, not a mechanic) | summon cast loop (§g) | S |
| ↳ **skelitonTorsoTank** | energy 200, ranged `#bullet:#skelitonMissile` reach 200, reincarnates → `[skelitonHead]`. | ☑ reincarnates → Head; ranged via C2 bullet path | — | done |
| ↳ **skelitonHead** | energy 10, ranged missile reach **600**, `#reelProof:true`, `#fireMissle`. The "final" flying head. | ☑ `#reelProof` honored (no knockback/reel, still takes damage); ranged via C2 | — | done |
| ↳ **skelitonArm** | energy 110, melee `#swordSwipe` power(3,0). | ☑ generic melee leaf | — | done |
| ↳ **skelitonLowerLeg** | energy 120, `#highKick` (dmgMult 1.5), reincarnates → `[skelitonFootSoldier ×2]`. | ☑ reincarnates → 2 FootSoldiers | — | done |
| ↳ **skelitonFootSoldier** | energy 90, melee infantry leaf (no reincarnate). | ☑ generic melee leaf | — | done |
| ↳ **skelitonSword / skelitonMissile** | `skelitonSword` = a CPU melee body (energy 200, `#collisionDetection:false`); `skelitonMissile` = the bullet (agent 3). | ☑ skelitonSword melee leaf (dead content — reachable only via cascade, unit-tested) / skelitonMissile bullet (C2) | `#collisionDetection:false` pass-through deferred (F2) | S |
| **berlin** — title villain "Merlin's Revenge" (`act_berlin`, "ber") | `#inherit:#actorPlayer`, **no `#objType`** → a **cutscene/scripted actor**, not a free-roaming CPU enemy. Driven via `modThespian` in cutscenes (`scr_*`), `#speechColor`, `#initFaceDir:-1`. Has bundled `ber` art. | ◑ data resolves; art present | berlin-as-villain is a **cutscene set-piece (agent 6/5 seam)**, not an arena boss. The fightable analogue does not exist as an enemy record. | M (cutscene-driven, cross-agent) |
| **berlinInGame** | THIS is the in-game berlin: an **ally** Merlin *summons* (`modSummonBerlin` → `armyMaster.createUnit`). `#objAiCPUSpellCaster`, `#team:#aldevar`, `#weapon:#energyBlast`, `#wizard:true`, `#leaveWhenFinished`. | ✗ | summon-berlin command + army-master path (agent 4 seam) | M |
| **king / kingInGame** | same pattern: `act_king` = cutscene lead; `kingInGame` = summonable `#aldevar` ally (energy 300, str 15, `#kingSword`). kingInGame IS placed in the slice. | ◑ kingInGame spawns generic ally | art + summon semantics | S |

> **Key finding:** the "multi-part boss" is a **reincarnation tree**, not a jointed body with shared
> health. skelitonLord → 3 children → each child → more children, forming a cascade of independent
> entities. Reproducing it requires only the generic `modReincarnate` (one component) + wiring the 8
> part actors' stats/attacks — all of which already resolve from data. No bespoke boss FSM needed.

### Dwellings / structures (18 total; `dwelling.ts` is the port impl)

| Dwelling | Residents (`#residentGroups`) | Team | Port status | Gap | Effort |
|---|---|---|---|---|---|
| **goblinHut** | goblinArcher, goblinWarrior | #goblins | ✅ data-driven loop; has art | — (faithful) | — |
| **goblinMageHut** | goblinMage | #goblins | ✅ | art falls back | S |
| **goblinHouse** | goblinArcher/Warrior/Mage/**goblinBuilder** | #goblins | ◑ | goblinBuilder = `#objAiCPUBuilder` (builds new dwellings, `modBuilder`) — unmodeled | M |
| **orcHouse** | bowOrc, swordOrc, mageOrc | #goblins | ✅ has art | — | — |
| **dojo** | karateGuy, kongFuChicken, **SpeedyGuy** | #karate | ◑ | SpeedyGuy has no `act_` record → filtered out (port already drops it) | S |
| **tvBox** (in slice) | evilTv | #monsters | ✅ spawns; `tv` art present | — | — |
| **skeletonDwelling** | skeletonArcher/Thrower/Warrior/Giant/Comando | #undead | ◑ | spawns generic units | S |
| **fangBunnyPortal** | fangBunny, **fangBunnyBaby** | #cave | ◑ | fangBunnyBaby filtered (no `act_` resolve?) | S |
| **magicPortal** | bombMage, thunderMonk | #magicalAlliance | ◑ | hostile-vs-ally routing by team | S |
| **friendlyGoblinHut** | friendlyGoblinArcher/Warrior | **#village** | ◑ | spawns ALLIES (port routes by team ✅) | S |
| **friendlyGoblinMageHut** | friendlyGoblinMage | #village | ◑ | ally routing ✅ | S |
| batTree, boulderCave, cocoon, darkCave, mysteriousCloud, orcInvasion, undeadInvasion | misc resident tables | various | ◑/✗ | not placed in slice; data resolves; some residents lack art | S each |

**Port dwelling fidelity vs `modResidents` + `objDwelling`:**

What the port (`dwelling.ts`) gets **right**: pick a random group → spend `groupSize × buildTime` in
production → release units one-by-one spaced by `releaseInterval` → next group → stop when the
lifetime `#totalResidents` budget is spent. Reads real `#residentGroups`, `#totalResidents`,
`#dieSound`, `#energy`, `#team` from each building's own data. Routes residents by team (a `#village`
hut produces allies). This is a **faithful translation of the modResidents state machine.**

What the port **misses** (gaps, all S unless noted):

1. **Emptied dwelling does not self-destroy.** Original `modResidents.produceNextGroupOrDie` →
   `noMoreResidents()` → `objDwelling.startDeath()`: a building that exhausts its budget **dies on
   its own**. The port's `Dwelling.update` goes to `"empty"` mode and **stays alive** (must be killed
   manually). Visible behavioral drift. **S.**
2. **No per-resident leveling.** `modResidents.releaseResident` calls `me.big.levelUp()` on every
   release and `newUnit.setStartingLevel(random(buildingLevel))` — buildings get tougher and spawn
   higher-level units over time. Port spawns flat level-1 units and the building never levels. **M.**
3. **`reservationsMaster` cap replaced by a hard `aliveCap=6`.** Original throttles via a global
   reservation system (`updateAwaitPermission`) shared across all dwellings + the army cap. Port uses
   a per-building soft cap. Acceptable stand-in for the slice; **M** for full fidelity (cross-agent
   with army reserve / agent 4).
4. **Budget clamped to 12** (`Math.min(12, totalResidents)`) and residents-alive filter — a slice
   guard, diverges from real totals (e.g. fangBunnyPortal 12, but goblinHut defaults to 10 with no
   cap). **S.**
5. **`modConstruction` "be built" ramp ignored.** Dwellings/units placed on the map are `#preBuilt`;
   ones spawned by a builder ramp energy through a `beBuilt` animation. Port spawns fully built
   always. Only matters once `goblinBuilder`/`modBuilder` exists. **M** (depends on builder).
6. **No `modGrave`/`drawGrave`** — dead dwellings leave a grave sprite + block the tile in the
   original; agent 5 render seam. **S.**

**Structure/economy systems NOT in the port (agent-2-adjacent, mostly unstarted):**
`modBuilder` + `objAICPUBuilder` (the goblinBuilder dynamically constructs new huts mid-battle —
enemy economy), `modConstruction` (build-up ramp), `structMaster` (attack/blank-room template
registry — also data-pipeline/agent 4). These gate goblinHouse/builder fidelity and any
player-built-structure feature.

---

## 3. Headline coverage for this domain

**~22% behavioral parity for actors/bosses/dwellings.**

- **Dwellings:** ~65% — the core resident-wave engine is faithful; the gaps are self-death, leveling,
  reservations, construction, builders. (18 dwellings, all data-resolvable; ~6 fully faithful in
  behavior, the rest spawn-but-generic.)
- **Generic enemies/allies:** ~30% — all 97 character records resolve stats/attack/team and *spawn*,
  but only ~23 have bundled art and AI is bucketed into beeline/kite/wander/bomber. The breadth is
  "wired but generic," not faithful per-type.
- **Bosses:** ~55% (was ~5%) — **E1 ☑**: the generic `Reincarnate` component (modReincarnate) gives
  skelitonLord its full reincarnation cascade (Lord→Upper+LowerLeg+Sword→…→8 part types, 4 deep) and
  unlocks all 17 `#reincarnateAs` actors (hydras, golems, eggs, monk→monkGhost, sc-units, garTower,
  iceRock, …) for free. Still absent: skelitonUpper's *summon* cast-loop (AI wiring, plan §g),
  berlinInGame/kingInGame summon allies (G2/agent-4 seam), and the berlin cutscene villain (H).

Weighted across the domain (dwellings are a small slice of the catalog; the 97 characters dominate),
the headline lands at **~22%**.

---

## 4. Prioritized build targets

1. **[Cheap breadth — S, do first] Per-type art + AI/stat wiring for the slice's own enemies.**
   goblinWarrior, greyGhost, skeletonArcher/Comando/Thrower/Warrior, undeadDragon, townWatch, farmer
   all currently render as **blackOrc** and use coarse AI. They already pull correct stats/attacks
   from data — they just need bundled sprite sheets + `spriteCharOr` resolving to their real char, and
   the spellcaster/ranged AI buckets refined. Biggest visible-parity win per hour; unblocks the
   shipped map looking right. Mostly an **asset-pipeline + mapping** task, not new engine code.

2. **[S–M] Close the four dwelling fidelity gaps.** (a) emptied dwelling self-destructs
   (`noMoreResidents → startDeath`); (b) per-release `levelUp()` + `setStartingLevel(random(level))`;
   (c) real `#totalResidents` (drop the `min(12,…)` clamp once reservations exist); (d) grave on death.
   `dwelling.ts` is already 80% there — these are small, surgical edits to a faithful base.

3. **[L] skelitonLord multi-part boss.** Build the generic `modReincarnate` component (fires on
   death via the `leftTeam`+`killedInAction` path, spawns `#reincarnateAs` units at
   `#reincarnateRadius`), then wire the 8 part actors (Upper/TorsoTank/Head/Arm/LowerLeg/FootSoldier/
   Sword + the skelitonSummon weapon for the summoner phase). This is the headline set-piece and the
   single largest item. It also unlocks **11 other reincarnating actors for free**
   (doubleDarkGolem, fourArmGolem, hydra1/2/3, monk→monkGhost, lizardEgg, ostrichEgg, garTower,
   iceRock, flamingRock, scArcher/scMonk/scWarrior→fire) — the whole `#reincarnateAs` family.

(Deferred / cross-agent: berlinInGame & kingInGame summon path → `modSummonBerlin`/`armyMaster`
needs agent 4; berlin-the-villain is a cutscene → agent 6; goblinBuilder economy →
`modBuilder`/`objAICPUBuilder`, agent 1 + agent 2.)

---

## 5. Faithfulness risks

- **`modReincarnate` cascade depth & timing.** The skeliton tree is multi-level
  (Lord → Upper → TorsoTank → Head). If reincarnation spawns are not also reincarnation-capable, the
  boss collapses to one tier. Reincarnation also fires from the generic `leftTeam`/`killedInAction`
  event — getting that teardown-order right matters (the part must spawn *before* the parent frees
  itself; see PLAN_REVIEW §1 teardown bug). Risk of either no-split or infinite/duplicated spawns.
- **Resident leveling drift.** Without `levelUp()`-per-release and `setStartingLevel(random(level))`,
  late-game dwellings are far weaker than the original — a balance divergence that compounds across a
  long room.
- **`reservationsMaster` vs the local cap.** The original gates ALL dwellings + the army through one
  global reservation budget; the port's per-building `aliveCap=6` can over- or under-flood a room with
  multiple dwellings vs the original's shared ceiling. Affects pacing parity, not just visuals.
- **Generic-art conflation.** Falling back to `blackOrc` for ~9 distinct slice enemies means the
  player can't visually distinguish a farmer from a skeleton warrior from an undead dragon — a
  significant readability/parity gap even though stats are correct underneath.
- **berlin identity confusion.** Three distinct "berlin" records (`act_berlin` cutscene lead,
  `act_berlinInGame` summonable ally, `act_berlinTV` chatter prop) must not be collapsed. The brief's
  "title villain berlin" is the **cutscene** actor, not a fightable arena boss — the only fightable
  undead set-piece in the data is **skelitonLord**. Mis-scoping berlin as an arena boss would chase a
  fight that doesn't exist in the records.
- **Dwelling team-routing edge cases.** `#village`/`magicalAlliance` dwellings produce allies; the
  port routes by `isFriendlyTeam`, which depends on `tem_aldevar.#friends` being correct. If that team
  data is wrong, friendly huts spawn hostiles (or vice-versa).
