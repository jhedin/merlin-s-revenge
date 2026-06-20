# Plan B1 — `teamMaster` + `findTarget` + `objAiCPU` target FSM

Backlog item **B1** (see [`../README.md`](../README.md), audit [`../01-ai-combat.md`](../01-ai-combat.md)
rows for `teamMaster` / `objAiCPU` / `findTarget`/relationships). This plan ports the **targeting and
CPU decision FSM**. It rides on **A1** (done: `takeHit(vx,vy,attackerId,mult)` carries the collision
vector) and stops cleanly short of **B2** (weapon manager). **Scope: targeting + the CPU decision FSM
only.** No weapons, no charge/cooldown rework, no spell-actor lifecycle.

---

## (a) Original mechanics (grounded in cited Lingo)

### Allegiance is data, resolved per-attack — not a static friend set

A team record (`casts/data/tem_*.txt`, struct `structMaster.structTeamData` lines 860–886) carries:
`#teamName`, `#category` (`#friends`/`#enemies`/`#neutrals`), `#friends` (list of team syms), `#hates`
(a **list of priority tiers**, each tier a list of team syms), `#maxMembers`, `#colour`,
`#immuneToAttack`. Examples:
- `tem_aldevar`: `#friends:[#village, #monsterSummon]`, `#hates:[[#blackSorcerer, #scarlet, …, #orcs],
  [#pitMonsters, #invisible, #collectables]]` — two priority tiers.
- `tem_monsters`: `#hates:[[#aldevar, #monsterSummon, …]]`, `#friends:[#goblins,#swamp]`.
- `tem_ghosts` / `tem_game`: `#friends:[]`, `#hates:[]` — true neutrals (ghosts possess, don't fight).

`teamMaster.initTeams` (lines 36–52) loads every `#objTeamData` record, merges it onto the
`#teamData` struct, and keys `pTeams[teamName]`. Each live team struct **also** holds the runtime
membership lists: `#teamMembers`, `#teamBuildings`, `#teamBullets`, `#teamMines` (populated by
`joinTeam`/`leaveTeam`, lines 1213–1253; a unit's role is `obj.getTeamRole()`).

The **target team list is computed per attack** from the attacker's `#attack.targetAllegiance`
(`#enemy`/`#friendly`), NOT from a fixed allied set:
- `calcTargetTeamsByAllegiance` (lines 136–157): `#enemy` → `team.hates` (the tiered list as-is);
  `#friendly` → `[team.friends + own team]`.
- `calcIgnoreTeamsByAllegiance` (113–134) is the inverse (used by `#all` melee path).
- `calcTargetTeamsOverride` (159–171) + `pTeamOverride`: when a "gang-up" override team is set, all
  `#enemy`-allegiance attackers retarget onto the override team (unless they're friends of it). The
  player's mouse-over probe (`getActorType()=#characterEnergyRollOverMaster`) is carved out of the
  override everywhere (e.g. `findTarget` line 874, `findRandomTarget` 645).

`cullTeamList` (173–194) drops empty teams and, when the total live count `< 5` or all target teams
are empty, prepends `#none` (signal: "fall back / nothing here"). `#collectables` is explicitly
deleted from each priority tier before searching (`deleteOne(#collectables)`).

### Broad-phase: a unit tile-map, searched in expanding shells

`teamMaster` keeps `pUnitMap` (and `pBulletMap`), an `objDataMap` sized `pRoomSize` in tile units
(`getTileLoc`, lines 78–102: world loc → tile via `(loc - playArea)/tileSize + 1`, clamped to the
room rect; default `point(18,9)` tiles of `point(32,32)`). Each occupied tile holds a `objMapNode`
linked list of the units in it.

`searchUnitMap(tileLoc, targetTeams, minShell, maxShell)` (1421–1527) walks **outward in square
shells** from the unit's tile: shell 0 (own tile) first, then rings of radius 1, 2, …. It stops as
soon as `shell > minShell AND targetList non-empty`, or at `maxShell` (hard cap 50). Each visited
`mapNode.search(targetTeams, targetList)` appends only units whose team ∈ `targetTeams`. **So the
search is O(occupied tiles in the smallest shell that contains a target)** — a true broad-phase, not
a linear scan over all entities. Empty nodes are GC'd lazily during the walk
(`getNext()=#none → finish/poke #none`).

### `findTarget`: pick the single best target

`findTarget(theObj)` (867–919):
1. `hatedTeams = override? calcTargetTeamsOverride : calcTargetTeamsByAllegiance`.
2. `targetTeams = cullTeamList(hatedTeams[1])`; if it collapses to `#none`, fall through to the
   slower `findATarget` (multi-tier scan, 691–742) or return the blank target.
3. If `targetCriteria = #lowestHealth` → delegate to `findATarget` (health-based, no spatial map).
4. Else `searchUnitMap(tileLoc, targetTeams, 0, 20)` (rollover probe uses `0,1`).
5. Among returned units, honor `targetRoles`: if `targetRoles[1]` is a single role, **filter to that
   role** (`nObj.getTeamRole() <> targetRole → skip`). Pick min `GeomDistSqr`.
6. Return a `#teamTarget` struct `{obj, dist, priorityRank}` (`structTeamTarget`, 890–902;
   blank `dist=999999`).

`findATarget` (691–742) honors **`targetRoles` as a priority list** via `findTargetInTeam`
(744–809): roles are searched in priority order; a higher-priority role short-circuits lower ones
(`if closestTarget.obj <> #none then exit repeat`). `targetCriteria` selects the comparison key —
`#closestDistance` uses `GeomDistSqr`; `#lowestHealth` **stuffs the health value into `dist`** (the
"dodgy programming" comment, 772–786) so the same min-search picks the weakest unit (healers).

Attack target fields come from the actor's `#attack` (struct `structAttack`, structMaster 185–222):
`#targetAllegiance:#enemy`, `#targetCriteria:#closestDistance`, `#targetRoles:[[#teamMembers,
#teamBuildings]]`, `#hits:[#teamMembers]`. The player's `#punch`
(`act_player`): `#hits:[#teamMembers,#teamBuildings]`. `healBlast` uses `#lowestHealth` and rejects
100%-health targets (`objAiCPU.refreshTarget` 292–296).

### `objAiCPU`: the committed target FSM (`casts/script_objects/objAiCPU.txt`)

The AI is **a referenced controller** (`objAiGameObject.pAI`, bridge file `objAiGameObject.txt`):
the character's `update` calls `pAI.update()` (`updateAI`), and after every character `goMode` the
character calls `pAI.characterModeChanged(newMode)`. The AI base (`objAi.txt`) holds `pMode`,
`pCharacterPrg` (back-ref to the character), `ensureMode`/`goMode`/`getMode`, and **mixes in
`modRelationships`**.

`objAiCPU` FSM modes (`update`, 444–468; `goMode`, 189–218):

| AI mode | Behavior |
|---|---|
| `#findTarget` | `updateFindTarget` → `refreshTarget()`; if a `#target` relation now exists, `goMode(#moveToAttack)`. On enter: `stopRunAnim` + character `ensureMode(#walk)`. |
| `#moveToAttack` | `updateMoveToAttack` (495–529): tick `pRetargetCounter` (30 frames); if target gone/dead → `#noTarget` → `clearTarget` + `goMode(#findTarget)`; if `targetInReach` → `#fin` → `attack()`; else `findPathToLoc(calcIdealAttackLoc(target.getLoc()))`. On enter: reset retarget counter. |
| `#runReload` | `updateRunReload` (555–572): tick retarget counter, `moveAwayFromLoc(targetLoc)` until `getCooldownFin()` → back to `#moveToAttack`. (Kiting-after-shot.) |
| `#dazed` | entered from `characterModeChanged` when the character is in `#reel/#recoil/#dead/#die/#look/#finish/#reelFly/#reelLanded/#reelSit` (116–135). On enter: `moveToLoc(#none)` (freeze the AI). When the character leaves those modes, AI returns to `#findTarget`. |

**Target commitment & event-driven loss** (the heart of the design):
- `refreshTarget` (273–314): only when `#target` relation is `#none`, call
  `teamMaster.findTarget(character)`. On success: `keepMePosted(newTarget, #leaveGame, #once)` +
  `formRelationship(newTarget, #target, #exclusive)`. On failure: `moveToLoc(#none)`; if
  `isTargetsDead` or `getRoomClear` → `internalEvent(#noTargetFound)` (→ army teleport-out / wizard
  off, 232–237).
- `eventNotification(#leaveGame, obj)` (144–162): if the leaver **is** my target → `clearTarget`
  (`breakRelationship`) + `refreshTarget` + `internalEvent(#targetLeft)`. So targets are dropped
  **reactively**, not by re-scanning every tick.
- `pRetargetCounter` (30 frames, `updateRetargetCounter` 545–553): periodic forced re-evaluation —
  `clearTarget` + `refreshTarget` — so a committed unit eventually switches to a closer/better target
  even while its current one lives.
- `attackFin` (42–62): after an attack completes, `clearTarget` + `refreshTarget`; if a target
  exists → `#runReload` (if `getRunReload`) or `#moveToAttack`, else `#findTarget`.
- `getTargetLoc`/`revalidateTarget` (173–187, 316–333): dead-target guard — drop + `goMode(#findTarget)`.

`calcIdealAttackLoc` (`objAiAttack` 75–94): magic/ranged → the target loc itself; melee → target loc
offset by `idealAttackLoc` mirrored toward the unit's facing (stand just out of the target's body,
on its side). `targetInReachMelee` (379–394) tests strike-points (`calcStrikePoint`) against the
target's collision rect on **both** facings (turns if needed). `targetInReachRanged` (396–415):
`reach` as a `point` → inflate rect; as integer → `GeomDistSqr < reach²` (energyBlast `reach:9999`
⇒ casters are "in reach" immediately, so `moveToAttack` no-ops and the spellcaster sub-AI drives
positioning instead).

**Subclasses** (scope-relevant):
- `objAiCPUSpellCaster` (kite): with `reach=9999`, `updateMoveToOptimumPosition` runs bullet-dodge
  (`runTangentToObjects` over `findNearestEnemyBullets`), enemy-avoid (`runFromObjects`), then
  `runTowardsObject(target)`; `attackFin` forces `setTarget(#none)` (retarget every shot).
- `objAiFlyingBomber`: **no suicide** — `updateMoveToAttack`→`#attack`→loop (ideal rect vs player
  rect), cooldowned attack. Targets the player rect directly (doesn't use `findTarget`).
- `objAiCPUGhost`: not a combatant — `findUnitOfType(#monk)` + drift + `attemptPossess`
  (`mergeExperience`+`goMode(#finish)`), no relationship/attack.

### The melee hit-resolution loop (the OTHER half of teamMaster)

`impactMeleeAttack(obj)` (1041–1123) is the **area resolution** the attack frame calls (via
`performMeleeAttack` → `teamMaster.impactMeleeAttack`): compute target teams, `searchUnitMap` around
the attacker at `calcAttackDist` radius, filter by `#hits` role, and for each candidate
`calcAttackHit(nObj)` (rect test) → `calcCollisionVect(nObj)` → `CallPayloadFunction(payloadFunction,
nObj, collisionVect, obj, owner)`. **This is what A1's vector `takeHit` plugs into** — but A1 ported
only the *resolution math* (vector→damage+knockback), not the **team-scoped area loop**; today the
port melee is "single `takeHit` on the nearest target in `tryPunch`".

---

## (b) Gap vs the port today

| Original | Port today | Gap |
|---|---|---|
| Per-attack allegiance from `targetAllegiance` over `hates`/`friends` tiers | `isFriendlyTeam` = static set (`#aldevar` + its `#friends`) built once | No `hates` tiers, no `#enemy/#friendly` allegiance, no override, no priority |
| `teamMaster.findTarget` over a **unit tile-map** in expanding shells | `nearestOfTypes` = linear scan over **all** `game.entities`, filtered by entity `type` string | Wrong filter (entity type, not team), O(n) every tick, no roles/criteria |
| Membership lists per team (`teamMembers`/`teamBuildings`) | none (entities filtered ad-hoc by `.type`) | No team roster; can't do team-died, role targeting, building vs member |
| Committed `#target` relationship + `keepMePosted #leaveGame` + 30-frame retarget | `nearestOfTypes` **every tick** in `EnemyAI.update` | Twitchy retargeting; ignores commitment, priority, retarget throttle |
| FSM `findTarget→moveToAttack→attack→attackFin`, `runReload`, `dazed` | 4 hardcoded `kind` branches (beeline/wander/kite/bomber), stateless | No modes, no `attackFin` retarget, no `runReload`, no dazed-on-reel |
| `targetCriteria #lowestHealth`, `targetRoles` priority, `healBlast` 100%-skip | none | Healers/role AIs impossible |
| `impactMeleeAttack` = team-scoped **area** resolution | `tryPunch`/`EnemyAI.attack` = single `takeHit` on the one nearest | Melee can't hit multiple, ignores `#hits` roles, no payload list |
| `characterModeChanged → #dazed` couples reel/stun to the brain | none | Stunned enemies keep steering |
| Bomber runs a normal attack loop | `bomber` self-destructs (`takeHit 999999`) | Behaviorally wrong (noted in A1 audit) |

---

## (c) Component / file-level design

**Core decision:** introduce a **`TeamMaster` system** (singleton service on `game`) that owns team
allegiance resolution + a **unit tile-map broad-phase** + `findTarget`/`impactMeleeAttack`, and a
**`CpuAI` component** (replacing `EnemyAI`) that is a real `objAiCPU` FSM with a **committed target**
and an **event bus** for `#leaveGame`. Keep `PlayerControl` mostly as-is (it's `objAiPlayer`, not a
CPU), but route its melee through `teamMaster.impactMeleeAttack` and its aim through `findTarget`.
**No weapon-manager changes** — `CpuAI` reads the same `#attack`-derived config the current `EnemyAI`
already gets from `spawnEnemy`, just split into a targeting block.

### New: `port/src/systems/teams.ts` — `TeamMaster`

A plain class, one instance on `game.teamMaster` (added to `GameContext`). State:
- `teams: Map<string, TeamRuntime>` where `TeamRuntime = { name, friends: string[], hates:
  string[][], members: Set<Entity>, buildings: Set<Entity> }`. Built lazily from
  `registry.team(name)` on first reference (mirrors `initTeams`; tolerate missing records → empty
  `hates`/`friends`). Replaces `friendlyTeams`/`isFriendlyTeam` in `archetypes.ts`.
- `unitMap: UnitMap` — a tile-bucketed index (see below).
- `teamOverride: string | null` (default null) + `setTeamOverride`. (Wire to existing gang-up
  callers later; default off = identical to no override.)

API (faithful subset — only what B1 needs):
```
register(e, team, role)            // joinTeam: members.add / buildings.add  (role: "member"|"building")
unregister(e, team, role)          // leaveTeam: remove; fire team-died hook if empty (B1: hook only)
calcTargetTeams(team, allegiance)  // calcTargetTeamsByAllegiance(+Override): returns string[][] tiers
findTarget(e): { obj: Entity|null, dist: number }   // the per-tick acquisition (criteria+roles)
impactMeleeAttack(attacker, hitFn) // searchUnitMap around attacker @ reach, role-filter, hitFn(victim)
```
- `findTarget` reads the attacker's targeting config (from a small `Targeting` component, below):
  `allegiance`, `criteria` (`closestDistance`|`lowestHealth`), `roles`
  (`["member","building"][][]` priority tiers), `reach`. Resolve `targetTeams` via
  `calcTargetTeams` + cull-empty. `closestDistance` → unit-map shell search (`searchUnitMap`) min by
  squared distance, role-filtered; `lowestHealth` → linear over rostered members of target teams,
  min by `energyFrac`, with the `healBlast` 100%-skip honored by the caller (return dist=1.0 sentinel
  ⇒ CpuAI drops it, mirroring `dist=100`).
- `impactMeleeAttack(attacker, hitFn)`: compute target teams, `searchUnitMap` at the attacker's
  `reach` radius (tiles), role-filter by `#hits`, and call `hitFn(victim)` per candidate. The caller
  (PlayerControl / CpuAI) supplies `hitFn` that builds the aimed collision vector (A1's `aimedVect`)
  and `victim.send("takeHit", vx, vy, attackerId, mult)`. **This reuses A1 untouched** — teamMaster
  only decides *who* is in the area; A1 decides *what the hit does*.

### New: `port/src/systems/unitMap.ts` — `UnitMap` (broad-phase)

Faithful to `searchUnitMap`'s shell walk, simplified to a `Map<number, Entity[]>` keyed by packed
tile `(tx<<16)|ty`. Tile size + play-area come from the current map (fallback `32×32`, room
`18×9`, matching `getTileLoc`'s defaults). Methods:
- `clear()` then `insert(e)` rebuilt **once per tick** in the AI system pass (cheaper and simpler
  than incremental poke/peek; behavior-equivalent for a frame-synchronous search). Members register
  by world loc → tile.
- `searchShells(tx, ty, targetTeamSet, minShell, maxShell, out)`: own tile, then rings 1..max; stop
  when `shell > minShell && out.length > 0` or `shell > maxShell`. Append only entities whose team ∈
  `targetTeamSet` and `!isDead`. This reproduces "nearest by shells, expand until found" — the same
  early-out semantics, so the *set* of candidates considered matches the original within a tile.

> Faithfulness note: the original lazily maintains the map across frames via poke/peek; rebuild-per-
> tick yields the same query result for a synchronous search and avoids a stateful node pool. If a
> later iteration needs the bullet-map / cross-frame node identity, swap the rebuild for incremental
> insert without changing the query API.

### New: `Targeting` component (in `combat.ts`, next to `Team`)

Holds the attacker-side targeting config resolved from `#attack` at spawn (so `findTarget`/
`impactMeleeAttack` read it generically, mirroring `obj.getAttack().target*`):
`allegiance: "enemy"|"friendly"`, `criteria: "closestDistance"|"lowestHealth"`,
`targetRoles: Role[][]`, `hits: Role[]`, `reach: number`. Handlers: `getTargeting()` query. Default
from `structAttack`: allegiance `#enemy`, criteria `#closestDistance`,
roles `[["member","building"]]`, hits `["member"]`. **No new data plumbing** — `spawnEnemy`/
`spawnPlayer` already read `#attack`; they pass these extra fields into `build`.

### `Team` component (combat.ts) — register into the roster

`Team.init` gains a `role` ("member"|"building"; buildings set it in `spawnDwelling`) and **registers
the entity** with `game.teamMaster.register(this.entity, team, role)` in a new `start`/post-build
step. Add a `leaveGame()` path: when a unit finishes/leaves (death finalize, room exit), call
`teamMaster.unregister` + broadcast `#leaveGame` to subscribers (see event bus). `getTeam` unchanged.
`getTeamRole()` query added.

### Event bus for `#leaveGame` (minimal `keepMePosted`)

`modRelationships.keepMePosted` is a pub/sub: subscriber asks to be told once when `obj` fires an
event. Port it as a tiny registry on `TeamMaster` (it already sees join/leave): `subscribe(target,
event, listener)` / on `unregister(target)` → `emit(target, "#leaveGame")` to listeners, which call
`listener.send("eventLeaveGame", target)`. `CpuAI` subscribes to its committed target and drops it
reactively. This is the **event-driven target loss** that replaces per-tick re-scan. (Scope: only
`#leaveGame`; `#outOfEnergy` is folded into it for B1 since death calls unregister.)

### Rewrite: `EnemyAI` → `CpuAI` (control.ts) — the FSM

Replace the 4-branch `EnemyAI` with an `objAiCPU` FSM. Same component slot in `EnemyArchetype`
(ordered before Movement), same `update` handler, same spawn config keys. State: `mode:
"findTarget"|"moveToAttack"|"runReload"|"dazed"`, `target: Entity|null`, `retargetCtr` (30),
`fireCd`. Logic:
- `update`: if dead → idle. Tick `retargetCtr`/`fireCd`. Dispatch on `mode`:
  - `findTarget`: `refreshTarget()`; if `target` → `mode="moveToAttack"`.
  - `moveToAttack`: retarget-counter tick (clear+refresh at 0); if no/dead target → `findTarget`;
    if `targetInReach` → `attack()` then (per `attackFin`) clear+refresh → `moveToAttack`/`findTarget`
    (B1 has no `runReload` gate unless `ranged`+cooldown, see below); else `seek` toward
    `idealAttackLoc` (reuse the existing `seek`/detour pathfinding — it's the beeline→scenic stand-in).
  - `runReload` (ranged only): move away from target until `fireCd==0` → `moveToAttack`.
  - `dazed`: zero intent (frozen); leave when un-dazed.
- `refreshTarget`: only if `target` is null/dead → `teamMaster.findTarget(this.entity)`; commit
  (store + `teamMaster.subscribe(target, "#leaveGame", this.entity)`); honor `lowestHealth`/`healBlast`
  skip via the sentinel. No target → idle.
- `eventLeaveGame(obj)` handler: if `obj===target` → drop + `refreshTarget`.
- `characterModeChanged(mode)` handler (NEW message; Hurt/death must broadcast it): reel/recoil/
  die/look → `mode="dazed"`; leaving those → `mode="findTarget"`. This is the reel↔brain coupling.
- `attack`: melee → `teamMaster.impactMeleeAttack(this.entity, hitFn)` (area, role-filtered) instead
  of single-target; ranged → `fireBullet` aimed at target (unchanged from A1). Bomber loses the
  suicide (normal attack loop), fixing the A1-noted bug. Keep `atkSound`/cooldown as today.

Wander/kite/bomber become **FSM configurations**, not separate code paths: kite = ranged +
`runReload`; bomber = ranged/melee loop targeting the player; ghost stays a **separate tiny
`GhostAI`** (possession, not combat) — but ghost is low priority and may stay as the current `wander`
approximation for B1 (call out in out-of-scope).

### `PlayerControl` (control.ts) seam

- Aim: keep cursor-first; replace `nearestEnemy` with `teamMaster.findTarget(this.entity)` (so the
  player's auto-aim uses the same allegiance/role logic as everything else).
- `tryPunch`: replace the single-nearest `takeHit` with `teamMaster.impactMeleeAttack(this.entity,
  hitFn)` so a swing hits everyone in reach (faithful melee area; preserves A1's vector per victim).
- Magic release stays direct-`fireBullet` (B2 territory). No `hasSword`/`hasSpell` changes.

### `archetypes.ts` changes

- Drop `friendlyTeams`/`isFriendlyTeam` (lines 36–45) and the `["enemy"]`/`["ally"]` `targetTypes`
  wiring. Allegiance now flows from `#attack.targetAllegiance` + team `hates`/`friends` via
  `TeamMaster`. **`spawnAlly` / `spawnUnit` set the entity's `team`** (e.g. `#aldevar` for summons)
  and **role**; the AI's enemy/friend determination is automatic. (An ally is just a unit on
  `#aldevar` whose `#attack` is `targetAllegiance:#enemy` → it hunts `#aldevar.hates`.)
- `EnemyArchetype`/`DwellingArchetype`/`PlayerArchetype`: add the `Targeting` component (after
  `Team`); register role in `Team.init` (`"building"` for dwellings).
- `spawnEnemy`/`spawnPlayer`/`spawnDwelling`: pass `targetAllegiance`/`targetCriteria`/`targetRoles`/
  `hits`/`reach` from the resolved `#attack` into `build` (defaults from `structAttack`). Drop
  `aiKind`/`targetTypes`; pass `ranged` + `runReload` (ranged ⇒ true) instead.
- `game.context`: add `teamMaster: TeamMaster`. The AI system pass rebuilds `unitMap` once per tick
  before AIs run (new step in the systems loop / wherever `update` is broadcast).

### How relationships resolve from `tem_*` (worked example)

`blackOrc` (team `#orcs`, `#attack.targetAllegiance:#enemy`) acquiring a target:
`calcTargetTeams("#orcs","enemy")` → `tem_orcs.hates = [[#aldevar,#monsterSummon,#karate,…,#village]]`
→ cull to live teams → `searchUnitMap` shells around the orc → first member of a hated team
(the player is `#aldevar`) within the nearest occupied shell, role `member`, min squared dist →
commit as `#target`. A summoned `warrior` on `#aldevar` with the same `#enemy` allegiance hunts
`tem_aldevar.hates` (the orcs) — so orc-vs-warrior melee emerges from data, no `type` strings.

---

## (d) Implementation order

1. **`unitMap.ts`** (`UnitMap`: insert + `searchShells`) + unit tests on shell early-out. Pure,
   no engine coupling.
2. **`teams.ts` `TeamMaster`**: team loading from `registry.team`, `calcTargetTeams`
   (allegiance/override/cull), `register`/`unregister`, the `#leaveGame` pub/sub. Unit tests on
   allegiance resolution against real `tem_aldevar`/`tem_orcs`/`tem_monsters`.
3. **`findTarget` + `impactMeleeAttack`** on `TeamMaster` (consume `Targeting`). Tests: nearest by
   shell, role filter, `lowestHealth`, override.
4. **`Targeting` component** + `Team` role/register + `getTeamRole`. Wire `game.teamMaster` into
   context + the per-tick `unitMap` rebuild in the systems loop.
5. **`CpuAI`** FSM (replace `EnemyAI`): port mode loop, `refreshTarget`, `eventLeaveGame`,
   `characterModeChanged`, `attack` via `impactMeleeAttack`. Broadcast `characterModeChanged` from
   `Hurt` (reel) and death finalize. Fix bomber loop.
6. **`PlayerControl`** seam: aim + `tryPunch` via teamMaster.
7. **`archetypes.ts`**: drop `isFriendlyTeam`, pass `#attack` targeting fields, set team/role on
   spawn paths, add `Targeting`.
8. Update audit `01-ai-combat.md` rows + `README.md` status log.

Each step is independently testable; 1–4 land the substrate with no behavior change to existing
fights until step 5 swaps the brain.

---

## (e) Test plan

**Unit (`vitest`):**
- `unitMap`: insert N units across tiles; assert `searchShells` returns the nearest-shell occupant
  and early-outs (doesn't scan to maxShell once found); empty-map returns `[]`; maxShell cap.
- `teamMaster.calcTargetTeams`: `#orcs`/`#enemy` → tiers from `tem_orcs.hates`; `#aldevar`/`#friendly`
  → friends+self; override redirects an enemy attacker; `#characterEnergyRollOverMaster` ignores
  override; cull drops empty/`<5` → `#none`.
- `findTarget`: orc picks the player over a farther ally; role filter picks `building` only when
  roles say so; `lowestHealth` picks the weakest; `healBlast` skips a 100% target.
- `impactMeleeAttack`: a swing at a cluster hits **all** in reach (not just nearest); role filter
  excludes wrong roles; reuses A1 vector `takeHit` (assert damage == `(|vx|+|vy|)·mult` per victim,
  knockback applied) — guards no regression of A1.
- `CpuAI` FSM: commits a target and **does not** retarget while it lives until the 30-frame counter;
  drops target on `#leaveGame` (kill the target → AI re-acquires next tick, no twitch); reel →
  `dazed` (zero intent) → recover → `findTarget`; `attackFin` → re-acquire.
- Regression: **room 1 still clears** (the README's no-balance-regression gate); damage numbers
  unchanged (B1 doesn't touch attack math).

**In-browser smoke:**
- Spawn the room-1 fight: orcs converge on Merlin and on summoned allies (E key); allies fight orcs
  (cross-team from data); a player swing knocks back a cluster; killing an enemy makes its hunters
  smoothly re-acquire (no per-tick flicker). Verify a ranged enemy kites after firing (`runReload`).
  Confirm the bomber no longer suicides. FPS unchanged (broad-phase, not O(n²)).

---

## (f) Faithfulness risks

- **Per-tick re-scan vs committed target is the cardinal behavior change.** Getting commitment +
  30-frame retarget + `#leaveGame` drop right is what makes enemies stop being twitchy. Risk: if the
  event bus misses a `#leaveGame` (e.g. pooled-entity reuse fires it late), an AI chases a corpse.
  Mitigate with the dead-target guard in `moveToAttack` (original keeps both: event **and** poll).
- **Unit-map rebuild-per-tick vs lazy poke/peek.** Query result is equivalent for a synchronous
  search, but tie-breaking among equidistant units may differ from the original's node insertion
  order. Keep the tile-bucket insertion order stable (spawn order) to minimize divergence; document
  it as an accepted micro-difference.
- **Allegiance tiers + override + cull edge cases.** `cullTeamList`'s `<5`-total `#none` prepend and
  the `#collectables` strip are easy to drop; they change whether a unit "gives up". Port them
  literally and test against `tem_aldevar`'s two-tier `hates`.
- **`lowestHealth` piggy-backing on `dist`** (healers) and the `healBlast` 100%-skip are subtle; keep
  them even though no B1 enemy uses `healBlast` yet, so C-phase healers drop in.
- **`characterModeChanged` coupling.** If reel/death don't broadcast it, dazed never triggers and
  stunned enemies keep steering — the most visible parity bug. Ensure `Hurt` (reel) emits it.
- **`tem_ghosts`/`tem_game` neutrals** (`hates:[]`): `findTarget` must return blank, not crash on an
  empty tier — ghosts must not start attacking.
- **Melee area vs single-hit.** `impactMeleeAttack` hitting a cluster is correct but raises per-swing
  damage output vs today's single hit; verify room-1 balance holds (it should — enemies rarely
  cluster tighter than reach in room 1).

---

## (g) Out of scope (explicitly)

- **B2 weapon manager / charge-cooldown / spell-actor lifecycle.** `CpuAI`/`PlayerControl` keep the
  current `#attack`-derived cooldown/reach and direct `fireBullet`; no `pWeapons`, `setCurrentWeapon`,
  `selectSpell`, `ensureSpell`/`releaseMagic`, eyestrain, attack-frame gating, or `chargeMaxModifier`.
- **A1 combat math.** Damage = knockback magnitude stays exactly as shipped; `impactMeleeAttack` only
  selects victims and calls A1's `takeHit`. No `damageSpeed`, `#recoil` damage-block, reel physics
  changes here (reel→dazed *coupling* is in scope; reel *physics* is not).
- **`modPathFinding` A*/scenic.** Keep the existing `seek`/detour heuristic as the beeline→scenic
  stand-in; no `findPathToLoc`, `moveToLoc` target-mode, or `objMoveXY` stall detection.
- **Ghost possession** (`mergeExperience`/`attemptPossess`), **chatter**, **builder/weaponSeek**,
  **hair-seek** AIs — keep ghost as the `wander` approximation; others remain MISSING.
- **`enemyEnergyMaster` / rollover / minimap / team colours** (render seams), **army reserve /
  reservationsMaster**, **save/restore of relationships** (`restoreTarget`/`restoreRelationships`) —
  B1 commits targets in-session only; round-tripping committed targets through save is deferred.
- **`bulletMap` / `findNearestEnemyBullets`** bullet-dodging — the spellcaster's tangent-run uses the
  bullet map; B1 ports the unit map only, so kiting is the simple `runReload` band, not bullet-dodge.
