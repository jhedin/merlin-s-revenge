# Merlin's Revenge — Parity Tracker

**Goal:** 100% behavioral parity between the TypeScript port (`port/`) and the original
Macromedia Director/Shockwave game (Lingo in `casts/`).

**Method (the loop):** each iteration — (1) **audit** a subsystem against the original, (2) write a
**plan**, (3) **implement** it faithfully and verify (`tsc` + `vitest` + in-browser smoke), then PR.
This tracker is the running backlog; update the status table + log each iteration.

> Iteration 0 (this doc) is the full-game audit. Five domain audits live alongside it:
> [`01-ai-combat`](01-ai-combat.md) · [`02-actors-bosses-dwellings`](02-actors-bosses-dwellings.md) ·
> [`03-spells-weapons`](03-spells-weapons.md) · [`04-player-systems`](04-player-systems.md) ·
> [`05-world-render-shell`](05-world-render-shell.md). Read those for the per-feature tables.

---

## Where we are: ~20% behavioral parity

| Domain | Coverage | One-line state |
|---|---|---|
| AI & combat engine | ~18% | Dispatch kernel faithful but near-empty; combat is scalar/imperative; 11 AI types collapsed to 1 with 4 branches |
| Spells / weapons / projectiles | ~15% | Only `energyBlast` (partial); 1 generic bullet stands in for ~18; 0 summons, 0 splash/beam/mine; no weapon manager |
| Actors / bosses / dwellings | ~22% | All 263 records parse (stats resolve); gaps are art + AI wiring + per-actor behavior; bosses ~5% |
| Player / progression / masters | ~35% | Progression math faithful; save persists only room+player; 3 of 39 masters; no army reserve |
| World / render / pipeline / shell | ~35% | Loads 1 of 47 maps; asset pipeline is a slice-copier; collision = solid-AABB only; cutscene is a reimpl |

The **data** pipeline is genuinely complete (all 263 actors → `data.json`). Almost everything missing is
*behavior and assets*, not data — consistent with "content is data, not code."

---

## THE KEYSTONE — `damage == knockback` (do first; unblocks the most)

Three independent audits (combat, spells, player-systems) **and** the original `PORTING_PLAN.md` all name
the same root problem: the port bakes damage as a **scalar at the call site** (`dmgPerUnit*charge`,
`power*2`) and applies **no knockback**. The original's load-bearing semantic is:

> A weapon's `#attack.power` is a **`point`**. The collision computes a vector; its magnitude
> (`(|vx|+|vy|)·damageMultiplier`) **is** the damage, and the same vector is applied as **knockback
> velocity** (damped by `inertia`) *before* the energy hit. Reel/recoil duration is stall-based off that
> knockback; freeze and splash read the same vector.

Until `takeHit` carries a vector and weapons flow their real data-driven `#attack` (weapon→char→bullet→
victim), every weapon's relative lethality is a guess, and reel/recoil/freeze/splash are impossible to do
faithfully. Fixing it converts **~18 bullet actors + all melee weapons** from PARTIAL→FAITHFUL with no
per-actor code. **This is iteration 1.**

---

## Dependency-ordered backlog

Status: ☐ not started · ◐ in progress · ☑ done

### Phase A — Combat keystone
- ☐ **A1. `damage == knockback` + data-driven `#attack` flow.** `takeHit(vect, attacker)`; damage from
  `(|vx|+|vy|)·damageMultiplier`; apply knockback (inertia-damped) before energy; `fireBullet`/melee carry
  each actor's real `#attack`. *(01 #1, 03 #1 — the keystone)*

### Phase B — Targeting & AI engine
- ☐ **B1. `teamMaster` + `findTarget` + `objAiCPU` target FSM.** Data allegiance (`tem_*`), unit-map
  broad-phase, target criteria/roles, committed `#target` relationships, `impactMeleeAttack` loop. Unlocks
  every CPU enemy/ally/dwelling. *(01 #2)*
- ☐ **B2. `modWeaponManager` + data-driven charge/cooldown.** Retire hardcoded `SPELL`/`PUNCH`/`hasSword`/
  `hasSpell`; real weapon slots so enemies get ranged/magic and spells plug in. *(01 #3, 03 #2)*

### Phase C — Spell / weapon breadth (rides on A+B)
- ☐ **C1. `modAttack` charge engine generalized** → cBlast/darkBlast/cBlastAi group + faithful
  `energyBlast`; GMG toggle + magic limiter drop in cheaply. *(03 #2)*
- ☐ **C2. `modSplashDamage` + `#explode`** → energyPulse, thunderBlast, freezeBlast, towerAxe, beams, mine
  triggers; pair with `takeFreeze` + `#takeHeal`/healBlast status formulas. *(03 #3)*
- ☐ **C3. Summons** — armySummon, monsterSummon, skelitonSummon, summonArcher/Warrior/Orc/Golem/Boulder,
  `tem_monsterSummon`. *(03)*

### Phase D — Content breadth (art + wiring; gated on F1)
- ☐ **D1. Per-enemy sprite sheets + `spriteCharOr` wiring** — ~74 of 97 chars render as the `blackOrc`
  fallback; stats already correct. Biggest visible win/hour. *(02 #1)*
- ☐ **D2. Dwelling fidelity** — emptied dwelling self-destroys, per-release `levelUp()`/random start level,
  real `#totalResidents` (drop `min(12)`), death grave. *(02 #2)*

### Phase E — Bosses
- ☐ **E1. `modReincarnate` component → skelitonLord cascade** (Lord→3→more, 8 actors); also unlocks ~11
  other reincarnating actors (hydras, golems, eggs). `berlin` is a **cutscene** lead, not an arena boss.
  *(02 #3)*

### Phase F — World / render / pipeline
- ☐ **F1. Complete the asset pipeline** — atlas baking + all 10 tilesets / 171 anim chars / 47 maps (vs
  3/26/1 today). The lever for "load whatever the data ships." Gates D1. *(05 #1)*
- ☐ **F2. Collision tile-type breadth** — `#platform`/`#ceiling`/`#wallLeft`/`#wallRight`, per-edge merge,
  corner detection, directional collision events (golden tests first). *(05 #2)*
- ☐ **F3. Render/anim fidelity** — `modColourTransform` tint/glow (not binary white flash), per-sprite
  alpha/blend, `#foregroundPassive` layer, 5-state minimap, configurable tile size. *(05)*

### Phase G — Systems & persistence
- ☐ **G1. Full save/load tree** — cascade `currentMap → pRooms[] → pRoomObjects[]` so all actors/dwellings/
  room-clear flags round-trip, + potion/sound/army master slices. *(04 #1)*
- ☐ **G2. `armyMaster` + reserve persistence** — teleport-to-reserve, re-summon at saved level; the
  defining world-progression feature. *(04 #2)*
- ☐ **G3. Real medikit stockpile + `potionMaster` counter** — gradual heal + HUD + save. *(04 #3)*

### Phase H — Shell & flow
- ☐ **H1. Cutscene engine over real actors** — `modThespian` ~30 verbs, props, goMode, frame-timed lines,
  `#key` interpolation (vs the ~10-verb presentational reimpl). Gates game-over/complete/wasted. *(05 #3)*
- ☐ **H2. Scene FSM + `objMenu` menus + death/respawn/reincarnate flow.**
- ☐ **H3. `#endRoom` win condition + live room-state restore on re-entry.**

### Out of scope
- **Map editor** — ships as a *separate executable* (`map_editor.exe`); `mapEditMaster` is editor-only.
  Maps are externally authored data, not a parity requirement. *(05)*

---

## Status log
- **Iter 0** — Full-game audit via 5 parallel agents; this tracker + five domain docs. Overall ~20%.
  Keystone identified: `damage == knockback` (A1).
