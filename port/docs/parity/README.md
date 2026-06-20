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
| World / render / pipeline / shell | ~45% | Asset pipeline complete (F1 ☑): all 10 tilesets / 171 chars / 47 maps, load-any-map, lazy per-map loading; collision = solid-AABB only (F2); cutscene is a reimpl (H1) |

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
- ☑ **A1. `damage == knockback` (collision vector).** `takeHit(vx,vy,attacker,mult)`; damage =
  `(|vx|+|vy|)·mult` (modEnergy); the same vector applied as knockback (objGameObject), inertia-damped, as
  a separate decaying impulse; melee/bullet build aimed vectors via `aimedVect`. Damage numbers preserved
  (no balance regression); inertia damps knockback only for now — faithful damage-damping pairs with real
  data attack powers under B2. See [`plans/A1-damage-knockback.md`](plans/A1-damage-knockback.md). *(01 #1, 03 #1)*

### Phase B — Targeting & AI engine
- ☑ **B1. `teamMaster` + `findTarget` + `objAiCPU` target FSM.** Data allegiance (`tem_*`), unit-map
  broad-phase, target criteria/roles, committed `#target` relationships, `impactMeleeAttack` loop. Unlocks
  every CPU enemy/ally/dwelling. Plan: [`plans/B1-targeting-ai.md`](plans/B1-targeting-ai.md). *(01 #2)*
  - ☑ **2a substrate** — `UnitMap` broad-phase, `TeamMaster` (data allegiance/cull/roster/`#leaveGame`
    pub-sub), `findTarget`, `impactMeleeAttack`, `Targeting` component. Pure + unit-tested (11 tests).
  - ☑ **2b brain swap** — `EnemyAI`→`CpuAI` FSM (committed target, 30-frame retarget throttle,
    dazed-on-reel via `characterModeChanged`, `attackFin` re-acquire, bomber un-suicided), PlayerControl
    melee/aim via `TeamMaster`, archetype/context wiring + per-tick `UnitMap`/roster rebuild
    (`combatTick.ts`). Room 1 still clears; +4 CpuAI FSM tests (90 total).
- ☑ **B2. `modWeaponManager` + data-driven charge/cooldown.** Retired hardcoded `SPELL`/`PUNCH`/`hasSword`/
  `hasSpell`; `WeaponManager` component (`pWeapons`→`AttackData`, per-weapon `Counter` cooldowns inc=agility/
  dexterity/manaRegeneration), `engine/counter.ts`, `charge.ts` (chargeMax/Start/Speed from data×mana),
  `resolveAttack`. Pickups `addWeapon` instead of flipping booleans; `getHasSpell`=owns a magic weapon.
  Player keeps dual-mode auto-melee + hold-charge (port adaptation, plan §f.6); CpuAI gates fire on the
  per-weapon counter. `damageMultiplier` flows from `#attack` into `takeHit.mult` (player melee). Plan:
  [`plans/B2-weapon-manager.md`](plans/B2-weapon-manager.md). *(01 #3, 03 #2)*

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
- ☑ **F1. Complete the asset pipeline** — all 10 tilesets (per-tileset tile size, unique-prefix match) +
  all 171 anim chars (556 anims; `seperateMembers` + per-frame `reg`/`dela`) + all 47 maps (`maps.json` +
  `loadMap(id)` load-any-map, `?map=<id>` picker) + vocabulary-driven SFX. Lazy per-map loading
  (`ensureMapAssets`) keeps first paint fast; `tilePx` resolved per-map. **Atlas baking descoped** (no
  image lib in the environment, `public/assets/` build-generated — frames stay individual PNGs, renderer
  unchanged). The lever for "load whatever the data ships." Gates D1. *(05 #1)*
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
- **Iter 1** — ☑ A1 shipped. `takeHit` now carries a collision vector (damage = L1·mult, modEnergy) and
  applies it as inertia-damped knockback (objGameObject); melee/bullet/bomber build aimed vectors. Damage
  unchanged (room 1 still clears; spell still fells rank-and-file), enemies now recoil. +4 tests (75 total).
  Next: B1 (teamMaster/findTarget) or B2 (weapon manager) — the AI/targeting engine.
- **Iter 2** — ☑ B1 fully shipped. 2a (substrate) + 2b (brain swap). `EnemyAI`→`CpuAI` is now a real
  `objAiCPU` FSM with a **committed** `#target` (acquired once via `teamMaster.findTarget`, dropped
  reactively on `#leaveGame`, forced re-eval on a 30-frame throttle) instead of a per-tick nearest re-scan —
  the cardinal behaviour change. `Hurt` broadcasts `characterModeChanged` so the brain enters `#dazed`
  (zero intent) while reeling/dying and re-finds on recovery. Melee (player + CPU) routes through
  `teamMaster.impactMeleeAttack` (team-scoped AREA loop, A1 vector per victim) — a swing knocks back a
  cluster. Bomber no longer suicides (normal attack loop). Allegiance is now fully data-driven from
  `tem_*`/`#attack.targetAllegiance` (dropped `isFriendlyTeam`/`aiKind`/`targetTypes`). `UnitMap`+roster
  rebuilt once per tick (`combatTick.ts`) before AIs run. tsc clean; 90 tests pass (+4 CpuAI FSM); room 1
  clears (`enemies:0, exitsOpen:true, errors:none`); in-browser: orcs commit to player-side targets (30/30),
  0 target flicker over 12 ticks, one swing damages a 2-enemy cluster, no pageerrors. Next: B2 (weapon
  manager) — data-driven charge/cooldown + real weapon slots.
- **Iter 3** — ☑ B2 shipped. The hardcoded `SPELL`/`PUNCH` constants and `hasSword`/`hasSpell` booleans
  are gone, replaced by a real `WeaponManager` (modWeaponManager): `pWeapons` (sym→`AttackData`),
  `pCurrentWeapon`, per-weapon cooldown `Counter`s (`engine/counter.ts`, faithful CounterNew/Counter/
  Reset/Once) whose `inc` is the per-type skill stat (melee=agility, ranged=dexterity, magic=
  manaRegeneration). `charge.ts` resolves chargeMax/Start/Speed from each weapon's `#attack` × mana
  (reproducing energyBlast's old `cap*.75+5` / `0+burst` / `1*flow` exactly, +chargeSpeedMax/StartMax
  clamps + limitMagic ×magicLimit/100). Pickups call `addWeapon` (= newScrollCollected) instead of
  flipping flags; `getHasSpell` = owns a magic weapon. **Control scheme preserved** (plan §f.6, a
  documented port adaptation of the single-current-weapon model): Merlin still auto-melees with his
  current melee weapon (#punch→#merlinSword on pickup) AND holds to charge magic once owned — both at
  once; recast/swing each gate on that weapon's own counter, `resetCooldown` on FIRE (no free shot on
  swap). `damageMultiplier` now flows from `#attack` into `takeHit.mult` for the player's weapons.
  **Calibration (corrected in review):** MELEE_SCALE=2.5 pins `#punch`=40 (the pre-B2 `round(8*4)+8`)
  exactly; merlinSword=320 (its real damageMultiplier 16; one-shots the room-1 15–300-energy band, same
  effective clear speed). [Review caught the agent's arithmetic slip — it had SCALE=3/punch=48 claiming
  =40.] Enemy melee keeps the slice's tuned scalar damage (routing enemy power·strength·mult would inflate
  lethality 5–25× and break room 1) and enemy cooldowns are re-derived to preserve the old
  `atkCooldown+(ranged?18:6)` recovery in frames — enemy feel unchanged. A1 inertia→damage coupling stays
  deferred (reason documented in the A1 plan).
  tsc clean; 116 tests pass (+26: Counter edge cases, resolveAttack, charge reproduces today,
  WeaponManager add/select/cooldown/save, melee calibration, spell-fells-300); room 1 clears
  (`enemies:0, exitsOpen:true, errors:none`); in-browser: sword pickup → both #punch+#merlinSword owned
  (sword auto-current), melee+knockback land, grant energyBlast → getHasSpell true, charge bar fills to
  ~0.96, release fires a bolt, immediate recast gated, no pageerrors. Out of scope (plan §g): GMG toggle,
  magic limiter master, spell-actor lifecycle, setMultiAttack, weaponSelector UI, C-phase spell content.
- **Iter 4** — F1 shipped (asset pipeline complete). The slice-copier `build_assets.ts` is now a
  COMPLETE bundler: **all 10 tilesets** (4 families x {Passive,Active,Objects} + menu, matched by
  longest-unique-prefix `tlk_<family><Layer>`, each with per-tileset `tile`/`cols`/`keyFile` read from
  its `_key.txt` -- 32 gameplay, 16 menu); **all 171 anim chars / 556 anims** (member name space-split
  for `seperateMembers` before the `_`-split; per-frame `reg` + `dela` recorded); **all 47 maps** copied
  to `maps/<id>.txt` (folder-qualified ids on stem collision) + a `maps.json` manifest; **vocabulary-
  driven SFX** -- the closed logical-name set scanned from `casts/data` (`#sound`/`#collectSound`/
  `#dieSound`) union engine effects, each wav de-mangled + matched (all 29 land in the vocabulary, no
  lossy regex). Builder prints: `tilesets:10 chars:171 anims:556 maps:47 sounds:29 music:8`.
  **Consumers:** `assets.ts` gains a `chars` index + **lazy per-map loading** -- only the 10 (small)
  tileset sheets load up front; char frames load on demand via `ensureChar`/`ensureMapAssets` so the
  default map paints as fast as ever (no 14 MB eager-load). `map.ts` resolves `tilePx` per-map from the
  active layer's tileset (drops the global 32) and stays graceful on unknown/foreground layers. `main.ts`
  `loadMap(id)` plays **any** of the 47 maps (resolves its tilesets + per-layer keys + `ensureMapAssets`)
  with a `?map=<id>` dev picker; default id unchanged. `anim.ts`/`cutscenePlayer.ts` skip-and-lazy-load a
  frame that isn't loaded yet (summon/cutscene chars) instead of throwing. **Atlas baking descoped** --
  no image library is available and `public/assets/` is build-generated, so frames stay individual PNGs
  (renderer draws whole frames, unchanged); the F1 win is COMPLETENESS + load-any-map, not atlasing.
  tsc clean; **132 tests pass** (+16: `pipeline.test.ts` count gate cross-checked vs a fresh source scan
  + audio vocabulary coverage + a 7-map structural load smoke incl 64x64 / 37x25 / 50x1 / 30x30 asserting
  no throw; +1 audio real-key test). Room-1 no-regression: `playthrough_smoke` ends
  `enemies:0, exitsOpen:true, errors:none` (identical). In-browser: default + `merlinart` (64x64, merlin),
  `mr4Demo` (15x15, merlinOpen), `merliniii`, `merlinartiii` (35x18) all load and fully paint with **no
  pageerrors**. Out of scope (deferred): F2 collision tile-types (keys bundled, not interpreted), F3
  render fidelity, atlasing. Next: D1 (per-enemy sprite wiring -- now unblocked) or F2.
