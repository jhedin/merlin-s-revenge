# E1 — `modReincarnate` → the skelitonLord cascade (bosses)

**Backlog row:** README §E1. **Audit input:** [`02-actors-bosses-dwellings.md`](../02-actors-bosses-dwellings.md)
§2 (Bosses) + §4.3 + §5. **Status going in:** bosses ~5% — skelitonLord spawns as a fat generic
enemy that just *dies*; there is no reincarnation cascade anywhere in the port.

**Thesis (confirmed against the real Lingo + data):** the "multi-part boss" is **not** a jointed body
with shared health. It is a **reincarnation cascade** — an actor, *on death in action*, spawns its
`#reincarnateAs` actor(s) at its corpse location; each spawned part may itself be reincarnation-capable,
so the boss unfolds tier by tier into a tree of independent entities. Reproducing it needs exactly **one
generic, data-driven `Reincarnate` component** + the part actors' stats/attacks (which already resolve
from data and ride the existing A1/B1/B2/C engine). No bespoke boss FSM. Building that one component
faithfully unlocks skelitonLord **and 16 other reincarnating actors** for free.

---

## (a) The `modReincarnate` mechanics — grounded in the real handlers

Source: `casts/script_objects/modReincarnate.txt` (the whole module is ~72 lines). It is mixed into
**every character** (`objCharacter.txt:54 me.addModule("modReincarnate")`) and **every bullet**
(`objBullet.txt:33`). Properties: `pReincarnateAs` (the list to come back as), `pReincarnatedMe` (last
spawned ref, for experience transfer).

### The trigger — death *in action* only

```
modReincarnate.internalEvent(theEvent):
  case theEvent of
    #leftTeam:
      if me.big.getKilledInAction() then    -- modEnergy.pKilledInAction
        me.reincarnate()
```

So the cascade rides the generic team-leave event, **gated on "killed in action."** Wiring it back to
the death sequence (all cited):

1. `modEnergy.loseEnergy` (`modEnergy.txt:187`) — on a lethal hit, `checkDead()` true ⇒
   `outOfEnergy()` + `internalEvent(#outOfEnergy)` + `eventNotify(#outOfEnergy)`, then sets
   `pEnergy = -100` and **`pKilledInAction = true`** (`:201`). *Only a real combat death sets this flag.*
   (`modEnergy.pKilledInAction` init `false` at `:44`; comment at `:11`: "whether the unit went down
   fighting (if not, it was just cleared from the screen by some other process").)
2. The death FSM runs (`objCPUCharacter.goMode(#finish)` → `drawGrave()` + `setDead(true)`,
   `:166–192`), and the object's teardown calls `finish` → **`leaveTeam`**.
3. `objGameObject.leaveTeam` (`:614`):
   ```
   on leaveTeam me
     g.teamMaster.leaveTeam(pTeam, pTeamRole, me.ID.bigMe)
     me.big.internalEvent(#leftTeam)        -- modReincarnate hears THIS
   ```
   (`finish` also fires `eventNotify(#leaveGame)` first, `:147` — that is the **B1 pub-sub** to *other*
   subscribers; `#leftTeam` is the object's **own** internal event the reincarnate module listens to.)

So the **only** path that reincarnates is: *lethal energy loss → `pKilledInAction=true` → finish →
`leaveTeam` → internal `#leftTeam` → `reincarnate()`*. A unit that leaves for any other reason
(`#leaveWhenFinished` ally retiring, room exit, screen clear) leaves `pKilledInAction=false` and does
**not** reincarnate. **This gate is load-bearing** — `monk` is a *summoned ally* with `#leaveWhenFinished`
that reincarnates into `monkGhost`; it must split only when killed, not when it retires.

### The spawn — `reincarnate()`

```
on reincarnate me
  repeat with i in pReincarnateAs
    j = 1
    if i <> #none then
      params = g.actorMaster.getParams(#newActor)
      params.typ      = i
      params.startLoc = me.big.getLoc()       -- spawn AT the corpse
      if j = 1 then params.useOffset = false else params.useOffset = true
      pReincarnatedMe = g.actorMaster.newActor(params)
      j = j + 1
      if pReincarnatedMe <> #none then me.big.internalEvent(#reincarnated)
    end if
  end repeat
```

Pinned facts:

- **One `newActor` per non-`#none` entry**, in list order. `#none` entries are skipped
  (`skelitonTorsoTank.reincarnateAs:[#skelitonHead,#none]` ⇒ one head).
- **Location = the dying parent's loc** (`me.big.getLoc()`). The `useOffset` toggle (false for the
  first, true for the rest) routes through `actorMaster.startActor` (`actorMaster.txt:204`
  `startLoc = startLoc + params.startOffset`) so multiple parts don't perfectly overlap. The actor's
  own `#startOffset` is the fan-out; `#reincarnateRadius` (40 on the Lord, 30/20 on parts) is the data's
  scatter hint for this (the module itself only flips `useOffset`).
- **Team / level are NOT inherited from the parent.** `newActor` only carries `typ` + `startLoc` +
  `useOffset`; everything else is the **child's own act-data** (`actorMaster.setParamsFromData`,
  `actorMaster.txt:280`). Each skeleton part declares `#team: #undead` and its own
  `#startingLevel` (0 for the parts) — so a part spawns at *its* default level on *its* own team, which
  for skelitonLord happens to be the same `#undead` team. (Contrast `monk → monkGhost`: monkGhost
  carries its own team; nothing is copied from the monk.)
- `#reincarnated` is fired back into the parent after each spawn — `modExperience` (`:192,:319`) uses it
  to transfer half the parent's accrued XP to `pReincarnatedMe`. *Port-optional cosmetic; out of E1
  scope unless XP parity is in play.*
- **Depth is implicit and unbounded by the module** — the spawned child runs its own
  `modReincarnate` when *it* dies. The tree's depth lives entirely in the data chain (Lord→Upper→
  TorsoTank→Head is 4 deep). There is **no cycle guard in the original**; safety comes only from the
  data being acyclic and children eventually terminating in leaves.

### Bullets reincarnate too

`objBullet.txt:282` calls `me.big.reincarnate()` directly when a bullet finishes its `#hit` phase
(not via `#leftTeam`). No shipped bullet in the data sets `#reincarnateAs`, so this is a latent path; E1
scopes **character** reincarnation. (`skelitonMissile` is a plain bullet, no reincarnateAs.)

### ⚠ The cardinal teardown-order risk (audit §5, PLAN_REVIEW §1)

`reincarnate()` reads `me.big.getLoc()` **during** `leaveTeam`, which is **inside** the parent's
finish/teardown. The part must be spawned **before** the parent's sprite/position is freed, or the
spawn loc is garbage and/or the cascade collapses. In the original the ordering is safe because
`leaveTeam` (which fires `#leftTeam` → `reincarnate`) runs *before* `objGameObject.finish` frees the
sprite (`finish` calls `leaveTeam` at `:149`, then frees `pSpr` at `:156`). **The port must reproduce
this edge: capture the death position and spawn the children at the same instant death is finalized,
strictly before the parent entity's position becomes invalid or the entity is recycled.**

---

## The skelitonLord tree (read from `casts/data/act_skeliton*.txt`, all 11 files)

> Audit corrections found while reading the real files: the part is **`skelitonUpper`** (not
> "skelitonUpperLeg"); files use **one L** (`skeliton`, e.g. `act_skelitonLord.txt`); the Lord's field
> is **`#reincarnateAs`** (not `#reincarnateAs:[#skelitonUpper,#skelitonLowerLeg,#skelitonSword]` mislabeled
> "reincarnateAs" — confirmed exactly that list).

```
skelitonLord            energy 750  str 14  #weapon #skelitonLordSword (melee, dmgMult 12, power(3,0))
│   AI #objAiCPU · team #undead · #reincarnateRadius 40
│   reincarnateAs → [ skelitonUpper , skelitonLowerLeg , skelitonSword ]
│
├─ skelitonUpper        energy 220  #AiType #objAiCPUSpellCaster   ← CASTER (C-phase)
│  │   #weapon #skelitonSummon  (summons skeleton infantry mid-fight) · radius 30
│  │   reincarnateAs → [ skelitonTorsoTank , skelitonArm , skelitonArm ]
│  │
│  ├─ skelitonTorsoTank energy 200  ranged  #bullet #skelitonMissile reach 200 (cooldown 10)  ← RANGED (C-phase bullet)
│  │  │   #fireMissile · graveOn true
│  │  └─ reincarnateAs → [ skelitonHead , #none ]   (one head; #none skipped)
│  │     │
│  │     └─ skelitonHead  energy 10  ranged  #skelitonMissile reach 600 (cooldown 30)  ← long-range flying head
│  │            #reelProof:true (knockback-immune) · dexterity 10 · LEAF (no reincarnateAs)
│  │
│  ├─ skelitonArm  ×2    energy 110  melee #swordSwipe power(3,0) dmgMult 1   · LEAF
│  └─ (the 2nd arm, identical)
│
├─ skelitonLowerLeg     energy 120  melee #highKick power(3,-2) dmgMult 1.5 · radius 20
│  └─ reincarnateAs → [ skelitonFootSoldier , skelitonFootSoldier ]
│     └─ skelitonFootSoldier ×2  energy 90  melee #swordSwipe power(3,0) dmgMult 1 · LEAF
│
└─ skelitonSword        energy 200  melee #swordSwipe power(3,4) dmgMult 0.7
       #collisionDetection:false (passes through terrain) · LEAF (no reincarnateAs)
```

**~8 distinct actor types** (Lord, Upper, TorsoTank, Head, Arm, LowerLeg, FootSoldier, Sword) +
`skelitonLordSword` (the Lord's weapon, a `#weapon` powerup record) + `skelitonMissile` (bullet) +
`skelitonSummon` (the Upper's summon spell). Tree depth = **4** (Lord→Upper→TorsoTank→Head).

**Engine reuse — every part is just a CPU character on the built engine:**
- Melee parts (Arm, FootSoldier, LowerLeg, Sword, Lord) → A1 `takeHit(vx,vy,…)` + B2 `#attack` numbers,
  routed through `teamMaster.impactMeleeAttack`. Nothing new.
- `skelitonTorsoTank` + `skelitonHead` → C-phase **ranged**: `#bullet #skelitonMissile` via the existing
  `Projectile`/bullet path (`#naturalRanged`, `#reach`, `#cooldown`). `skelitonMissile` (`act_skelitonMissile.txt`:
  `#attack [#damageMultiplier 10, #power 0.3]`) is a normal bullet — already supported.
- `skelitonUpper` → C3 **summon**: its `#weapon #skelitonSummon` is `#explodeFunction:#summonUnit` with a
  `#multistage` table (`act_skelitonSummon.txt`: footSoldier@10 … skelitonLord@35, `#randomSummon:true`,
  `#residentTeamCategory:#enemies`). This is exactly the C3 `summonUnit` path — *the boss's add-spawn
  loop is the summon engine already shipped.* It only needs the spellcaster AI to fire it (B1 caster
  bucket exists; see (g)).
- `skelitonHead.#reelProof:true` → must suppress knockback/reel on that part (a one-flag check in Hurt).

**How the fight ends:** there is no aggregate boss HP. The room-clear condition is the generic one —
`rooms.ts:111` counts `enemy && !isDead`. The Lord dying *adds* enemies (its parts); the room clears
only when **every leaf in the whole tree is dead**. The cascade naturally produces the "kill the boss,
it splits, keep killing" feel with zero special-casing.

---

## (b) Gap vs the port today

| Aspect | Original | Port today |
|---|---|---|
| Reincarnation | every char on `#leftTeam`+killedInAction spawns `#reincarnateAs` | **absent** — killing any actor just leaves it dead/grave |
| skelitonLord | splits into a 4-deep tree of ~8 part types | spawns as one fat generic `#undead` enemy, dies once, done |
| Caster phase | skelitonUpper casts `#skelitonSummon` (adds) | the summon weapon + caster fire-loop not wired to it |
| Ranged parts | TorsoTank/Head fire `skelitonMissile` | bullet path exists (C2); part actors not wired/placed |
| `#reelProof` | skelitonHead immune to knockback | flag ignored |
| Team/level on spawn | from child's own data (not parent) | n/a (no spawn) |
| ~16 other reincarnators | hydras, golems, eggs, monk, sc-units split on death | none split |

The port already has the **spawn primitive** (`game.spawnUnit`/`spawnEnemy`, `archetypes.ts`), the
**death edge** (`combat.ts` Energy.dead, `combatTick` death-finalize), and the **team-leave pub-sub**
(`teams.ts emitLeave`). E1 is the missing **death→spawn glue**, made generic.

---

## (c) Concrete design — one `Reincarnate` component

### Component (`port/src/components/reincarnate.ts`, new — the ONLY new file)

```
class Reincarnate (handles ["update","getKilledInAction"]):
  reincarnateAs: string[]   // normalized from #reincarnateAs (see parsing below)
  done = false              // fire-once latch
  update():
    if done) return
    if (!entity.send("isDead")) return        // not dead yet
    // death finalize edge — equivalent to leftTeam + getKilledInAction
    if (!entity.send("getKilledInAction")) return   // gate: only "killed in action"
    done = true                               // latch BEFORE spawning (no re-entry / dup)
    pos = entity.send("getPos")               // capture corpse loc while still valid
    for (let i=0; i<reincarnateAs.length; i++):
      typ = reincarnateAs[i]; if (typ === "#none" || !typ) continue
      off = i === 0 ? {x:0,y:0} : fanOut(i, radius)   // useOffset = (i>0)
      game.spawnUnit(typ, pos.x+off.x, pos.y+off.y, {})  // existing spawn path
```

- **Parsing (`reincarnateAs`).** Normalize the data field to a `string[]`: a **bare symbol**
  (`hydra3 #reincarnateAs: #hydra2`) → `["#hydra2"]`; a **list** stays a list; `#none` entries kept
  in place then skipped at spawn (preserves "one child" for `[#head,#none]`). Strip the leading `#` to
  the spawn-path's actor key as `spawnUnit` expects.
- **Team & level inheritance: none from the parent — by design.** `spawnUnit(typ,…)` resolves the
  child's *own* act-data, so team comes from the child's `#team` and level from its `#startingLevel`
  (mirrors `actorMaster.newActor` carrying only `typ`/`startLoc`). For the skeleton tree every child is
  `#undead` and `startingLevel:0`, so the cascade stays on the boss's team automatically. **Do not copy
  parent team/level** — `monk(#aldevar) → monkGhost` would be mis-teamed if we did.
- **`getKilledInAction`.** Add a tiny accessor on the death path. In the port, `Energy.dead` is set on a
  lethal `takeHit` (combat.ts:34–36) — that *is* "killed in action." Room exit / `#leaveWhenFinished`
  retirement remove the entity **without** setting `dead` via a lethal hit, so they naturally read
  false. Concretely: `getKilledInAction` returns `Energy.dead && diedFromHit` — set a `killedInAction`
  flag inside `Energy.takeHit` when energy crosses ≤0 from damage (NOT from `leaveGame`/cull). This is
  the faithful translation of `modEnergy.pKilledInAction` (set only in `loseEnergy`, never in `finish`).
- **Fire-once / teardown order.** Latch `done=true` *before* the spawn loop (kills duplication if
  `update` is hit twice in the death frame). Spawn happens on the **first tick the entity reads
  dead+killedInAction**, while the corpse entity is still in `game.entities` with a valid `getPos` —
  i.e. *before* any despawn. (Dead enemies aren't removed from `game.entities` in the port today — they
  persist as graves, anim.ts:33 — so position stays valid; but we still spawn at the death edge, not
  lazily, to match the original's "spawn during leaveTeam" timing and to be robust if E later adds
  corpse cleanup.)

### Composition with shipped systems

- **B1 `#leaveGame`/teamMaster.** Unchanged. When the parent dies, `combatTick` unregisters it (firing
  `eventLeaveGame` to *its* hunters, who drop it) on the same/next tick; the freshly spawned parts are
  un-registered combatants and get `joinTeam`'d by `combatTick` step 2 next tick — they enter the
  roster and become targetable automatically. No special hook into the pub-sub; reincarnate is the
  *dying entity's own* behavior, exactly like the module being mixed into the character.
- **B1 death (`isDead`) + `characterModeChanged`.** Reincarnate keys off the same `isDead` the rest of
  the engine uses; no change to Hurt/the death FSM beyond the `killedInAction` flag.
- **C3 summons.** `skelitonUpper`'s adds are *not* reincarnation — they are the C3 `summonUnit` path
  fired by the caster AI from `#skelitonSummon`. Reincarnate and summon are orthogonal; the boss uses
  both (Upper *summons* infantry while alive, and *reincarnates* into TorsoTank+2 Arms when it dies).
- **`#reelProof`.** One guard in `Hurt`/knockback: if the actor's data has `#reelProof:true`, skip the
  knockback impulse + reel mode (still takes energy damage). Needed by skelitonHead; trivially generic.

---

## (d) Step-by-step build order

1. **Generic `Reincarnate` component** (`reincarnate.ts`) + `getKilledInAction` plumbing in
   `combat.ts` (`Energy.takeHit` sets a `killedInAction` flag on lethal *damage* only). Add it to the
   enemy/ally archetype module list, reading `#reincarnateAs` (normalized) from act-data; no-op when the
   field is absent. **This alone makes every reincarnator split.** Unit-test against a synthetic 3-tier
   chain.
2. **skelitonLord wiring & verification.** Confirm all 8 part actors resolve stats/attack from data
   (they do — audit §2). Wire: (a) `skelitonHead.#reelProof` guard; (b) `skelitonTorsoTank`/`Head`
   ranged `skelitonMissile` via the C2 bullet path; (c) `skelitonUpper` as a spellcaster firing
   `#skelitonSummon` via the C3 `summonUnit` path (depends on the B1 caster fire-loop being live for an
   enemy caster — see (g)). Add bundled art mappings where missing (Lord has art; parts fall back to
   blackOrc until D1 — acceptable, stats/cascade are correct).
3. **The other ~16 reincarnators** — *free* once step 1 lands, since they are pure data. Spot-check the
   bare-symbol (`hydra2/3`) and multi-child (`lizardEgg:[#bug×3]`, `doubleDarkGolem:[#darkGolem×2]`)
   shapes, and the multistage `#minEnergy` parts (hydra dies at `minEnergy 1000`, not 0 — verify the
   death threshold honors `#minEnergy` so the hydra chain triggers; if the port hardwires death at ≤0,
   add `#minEnergy` support — small, but needed for hydra parity).

The complete `#reincarnateAs` family (17 actors, grepped from `casts/data`):

| Parent | reincarnateAs | shape |
|---|---|---|
| skelitonLord | [skelitonUpper, skelitonLowerLeg, skelitonSword] | 3-child |
| skelitonUpper | [skelitonTorsoTank, skelitonArm, skelitonArm] | 3-child |
| skelitonTorsoTank | [skelitonHead, #none] | 1 (+#none) |
| skelitonLowerLeg | [skelitonFootSoldier, skelitonFootSoldier] | 2-child |
| hydra3 | **#hydra2** | bare symbol |
| hydra2 | **#hydra1** | bare symbol |
| doubleDarkGolem | [darkGolem, darkGolem] | 2-child |
| fourArmGolem | [darkGolem, darkGolem] | 2-child |
| lizardEgg | [bug, bug, bug] | 3-child |
| ostrichEgg | [babyOstrich] | 1-child |
| iceRock | [boulderMonster] | 1-child |
| garTower | [goblinArcher] | 1-child |
| monk | [monkGhost] | 1-child (ALLY, #leaveWhenFinished — gated!) |
| scArcher | [fire] | 1-child |
| scMonk | [fire] | 1-child |
| scWarrior | [fire] | 1-child |
| flamingRock | [fire] | 1-child |

---

## (e) Test plan

**Unit (vitest, pure):**
1. *3-tier chain spawns in order.* Synthetic actors A→[B,C], B→[D]. Kill A (lethal hit) ⇒ B,C spawn at
   A's loc, B first (no offset), C offset. Kill B ⇒ D spawns. Kill C,D ⇒ no further spawns. Assert spawn
   **count, types, order, and loc** (children at parent's death pos).
2. *Fight ends when all dead.* Drive the skelitonLord tree to completion in a headless room; assert the
   room-clear predicate (`enemy && !isDead` == 0) is false until **every leaf** is dead, true after.
3. *killedInAction gate.* An actor removed by room-exit / `#leaveWhenFinished` (not a lethal hit) ⇒
   `getKilledInAction()` false ⇒ **no** reincarnation. A lethal `takeHit` ⇒ true ⇒ reincarnates. (Pins
   the monk-retires-vs-monk-killed distinction.)
4. *Fire-once / no duplication.* Two `update` calls in the death frame spawn the parts **once**.
5. *Parsing shapes.* bare symbol `#hydra2`→one child; `[#head,#none]`→one child; `[#bug,#bug,#bug]`→three.
6. *Team/level not inherited.* monk(`#aldevar`)→monkGhost spawns on **monkGhost's** team, not the
   monk's parent ref; skeleton parts land on `#undead` from their own data.

**In-browser (post-F1, `?map=`):** load **`?map=works_mr4Demo`** (the canonical boss map — places
skelitonLord ×13 + the full part roster), kill a Lord, watch it cascade Lord→Upper+LowerLeg+Sword,
then Upper→TorsoTank+2 Arms, TorsoTank→Head, LowerLeg→2 FootSoldiers; confirm the Upper *summons*
infantry while alive and the room clears only when the whole tree is down. (`?map=monster_summon`
isolates a single skelitonLord for a clean repro; `?map=TeamOverrideTest`/`AutoSummonTest` are smaller
skeleton set-pieces.)

---

## (f) Faithfulness risks

1. **Teardown order / cascade collapse / duplication — THE cardinal risk** (audit §5).
   The part must spawn at the **death-finalize edge** with a still-valid corpse position, **fire-once**.
   Mitigations: capture `getPos` and spawn synchronously on the first dead+killedInAction tick; latch
   `done` *before* the spawn loop. Failure modes to guard in tests: (a) no split (gate or edge missed),
   (b) infinite/duplicated spawn (latch missing), (c) spawn at (0,0)/stale loc (position read after
   teardown).
2. **Cascade depth.** If a spawned part doesn't *also* carry `Reincarnate`, the boss collapses to one
   tier (Lord→3 and stops). The component is on the archetype, so any spawned actor with `#reincarnateAs`
   re-arms automatically — but the test must walk the **full 4-deep** chain to prove it.
3. **`killedInAction` gate fidelity.** Getting this wrong either (a) makes retiring allies/room-exits
   wrongly split (monkGhost spam on every map transition), or (b) suppresses real deaths. Pin it to
   "lethal *damage* only," never `leaveGame`/cull — exactly `modEnergy.pKilledInAction`.
4. **Team/level inheritance.** Must come from the **child's own data**, never copied from the parent.
   Copying would mis-team `monk→monkGhost` and mis-level the tree.
5. **`#minEnergy` multistage threshold.** hydra3/hydra2 declare `#minEnergy` (1000) — they "die"
   (and reincarnate down a tier) at `minEnergy`, not 0. If the port only dies at ≤0, the hydra chain
   never triggers. Verify/add `#minEnergy` to the death check (modEnergy comment `:13`: "the amount of
   energy below which the unit will die (usually used for multistage enemies)").
6. **No infinite-reincarnate guard in the original.** Safety is data-only (the chains are acyclic, ending
   in leaves). The port should **not** add an artificial depth cap (that would diverge); but a test-only
   sanity assert (the shipped data is acyclic) is worth keeping to catch a future data typo.
7. **`#reelProof` & `#collisionDetection:false`.** skelitonHead is reel-immune; skelitonSword passes
   through terrain. Both are one-flag generic behaviors, not boss-specific — wire them generically.

---

## (g) Explicit out of scope

- **berlin as an arena boss — does not exist.** Confirmed by reading `act_berlin.txt`:
  `#inherit:#actorPlayer`, **no `#objType`, no `#AiType`** → a cutscene/scripted lead driven by
  `modThespian`, not a free-roaming CPU enemy. `berlinInGame` is a *summonable ally*; `berlinTV` is a
  chatter prop. There is **no fightable berlin record**. The only fightable undead set-piece in the data
  is **skelitonLord**. (Audit §2 + §5 "berlin identity confusion.")
- **Boss-specific cutscenes** (the berlin/king villain scenes) → **Phase H** (cutscene engine over real
  actors, `modThespian`). Not E.
- **The spellcaster enemy fire-loop for `skelitonUpper`'s adds.** The summon *content* is shipped (C3
  `summonUnit` + `#skelitonSummon` multistage); what's needed is the B1 **enemy caster** firing it on a
  cooldown. If the live caster bucket doesn't yet drive an enemy `#objAiCPUSpellCaster` weapon, that AI
  wiring is a small dependency to confirm/finish in step 2 (it is *AI wiring*, not new mechanics) — name
  it so it isn't silently assumed.
- **`#reincarnated` XP transfer** (`modExperience` half-XP to the spawned child) — cosmetic
  progression detail; defer unless XP parity is being chased.
- **Bullet reincarnation** (`objBullet.txt:282`) — latent path; no shipped bullet sets `#reincarnateAs`.
  E1 scopes character reincarnation only.
- **D1 per-part art.** Parts without bundled sheets render as blackOrc until D1; stats + cascade are
  correct underneath. Not an E blocker.

---

## Reachability (grepped: all 47 port maps, objects layer tile-IDs → the objects tileset's `_key`)

Method: each map's `#layerDefinitions` names one objects tileset (`merlin{Open,'',4}Objects`); each
room's `#objects` grid holds 1-based tile-IDs indexing that tileset's `_key.txt` (line N = actor
symbol, `0` = empty). Scanned every objects grid in all 47 bundled maps.

**skelitonLord is placed in 6 maps** — E is in-game testable post-F1:
- **`works_mr4Demo`** (×13) and **`new_mr4Demo`** (×13) — the canonical boss maps: full skeleton roster
  present (Lord, Upper×36/45, Head×49, LowerLeg×45, Arm, FootSoldier) + hydras + golems. **Primary repro.**
- **`very_big_map`** (×11), **`Scarlet_Castle`** (×10, + Upper×9/Arm/hydra/fourArmGolem),
  **`TeamOverrideTest`** (×2), **`monster_summon`** (×1 — cleanest single-Lord isolate),
  **`AutoSummonTest`** (×4).

**Other reincarnators with map placements (live content, unlocked free):** `monk` (450 placements
across ~20 maps — every-map ally), `fourArmGolem` (169), `hydra1/2/3` (93/92/42), `iceRock` (86),
`scWarrior/scArcher/scMonk` (25/20/9), `doubleDarkGolem` (14), `garTower` (11). Skeleton parts also
placed standalone: `skelitonUpper` 97, `skelitonHead` 101, `skelitonLowerLeg` 93, `skelitonArm` 30,
`skelitonFootSoldier` 9.

**Dead content (0 direct placements — reachable ONLY as reincarnation spawns):** `skelitonSword`,
`skelitonTorsoTank`, `flamingRock`, `lizardEgg`, `ostrichEgg`. (skelitonSword/TorsoTank only ever appear
*via* the Lord/Upper cascade — which is exactly why the cascade mechanic, not map placement, is what
makes them reachable. Build-for-completeness; unit-test them, don't expect them in a map.)
