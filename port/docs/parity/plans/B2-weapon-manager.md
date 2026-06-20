# Plan B2 — `modWeaponManager` + data-driven `#attack` / charge / cooldown model

Backlog item **B2** (see [`../README.md`](../README.md); audits [`../01-ai-combat.md`](../01-ai-combat.md)
`modWeaponManager`/`objAiAttack` rows, [`../03-spells-weapons.md`](../03-spells-weapons.md) §"Charge /
weapon / limit infrastructure"). Rides on **A1** (done: `takeHit(vx,vy,attackerId,mult)` collision
vector + inertia-damped knockback) and **B1** (done: `TeamMaster`/`findTarget`/`impactMeleeAttack`,
`CpuAI` FSM). It retires the hardcoded `SPELL`/`PUNCH` constants and `hasSword`/`hasSpell` booleans
in `control.ts`, replacing them with a real weapon inventory + per-weapon cooldown counters + a
data-driven charge engine.

**Scope:** the *weapon/attack substrate* — weapon registry, current-weapon selection, per-type
cooldown counters, and the charge math (`chargeMax/Start/Speed`) resolved from `#attack` × mana
stats. Plus the A1-deferred *faithful damage-damping* decision, now that real data attack powers flow
weapon→char→bullet→victim. **Not** in scope: the C-phase spell *content* (cBlast/arcticBlast/summons),
splash/freeze status formulas (C2), GMG/magic-limiter unless trivially droppable (see §g).

---

## (a) Original mechanics (grounded in cited Lingo)

### One `#attack` prop-list, carried by a *weapon*, equipped via `modWeaponManager`

A character (`objCharacter`) mixes in `modWeaponManager`. Its state
(`modWeaponManager.txt` 13–21):
- `pWeapons` — a prop-list `weaponSym → attack` (the resolved `#attack` prop-list, **not** the
  weapon actor).
- `pCurrentWeapon` — the selected weapon symbol; `#none` until init.
- `pStartingWeapon` — the `#weapon` param (a powerup actor name, or `#none`).
- `pCooldownCounters` — a prop-list `weaponSym → Counter` (one per weapon).

**Init flow** (`init` 35–49 → `start` 53–63):
1. `init` zeroes the lists, stores `pStartingWeapon = params.weapon`.
2. `start` calls `initNaturalAttack` then `initStartingWeapon`.
   - `initNaturalAttack` (103–113): `naturalAttack = me.ID.bigMe.getAttack()` (the character's own
     `#attack` — for the player that is `#punch`, `act_player` 7–18). If non-`#none`, `addWeapon(name,
     attack)`. So **the character's natural `#attack` becomes its first weapon.**
   - `initStartingWeapon` (117–137): if `params.weapon <> #none`, look up the weapon actor's data
     (`g.actorMaster.getActorData(theWeapon).attack`) and `addWeapon`. (Most characters' real weapon
     lives on a separate weapon actor; the player has no starting weapon — only `#punch`.)

**`addWeapon(theWeapon, theAttack)`** (141–153) — the single entry point for acquiring a weapon:
```
pWeapons[theWeapon] = theAttack          -- register the attack prop-list
me.addCooldownCounter(theWeapon)         -- build its cooldown Counter
me.setCurrentWeapon(theWeapon)           -- auto-select the just-added weapon
```
This is exactly what a **pickup** triggers: `objScroll.collected → collector.newScrollCollected(char,
attack)` (`objScroll.txt` 33–39) → `objPlayerMerlinCharacter.newScrollCollected` (163–170):
`if scrollType <> #gmg: me.addWeapon(scrollType, theAttack)`. So picking up `merlinSword` (a
`#weaponMelee` `#objScroll`, `act_merlinSword`) or `energyBlast` (a `#magic` `#objScroll`,
`act_energyBlast`) **calls `addWeapon`** — it does not flip a boolean. (`#gmg` is the one special
case, → `gmgCollected`.)

### Per-weapon cooldown Counter — `inc` is the character's skill stat

`addCooldownCounter(theWeapon)` (157–203):
```
c = pCooldownCounters[theWeapon] = CounterNew()
c.tim[2] = theAttack.cooldown            -- the upper bound of the counter
c.fin    = true                          -- start ready to fire
AttackSetTypeFromAnimType(theAttack)     -- resolve #type from #animType
case theAttack.type of
  #melee:  c.inc = me.big.getAgility()
  #ranged: c.inc = me.big.getDexterity()
  #magic:  c.inc = me.big.getManaRegeneration()
```

The **Counter** primitive (`Counter ().txt`): a counter has `tim:[lo,hi]`, `inc`, `theCount`, `fin`.
- `CounterReset` (`CounterReset (theC).txt`): for `inc>0`, sets `theCount = tim[1]` (the low end, `1`
  by default from `CounterNew`), `fin=false`.
- `Counter` (`Counter ().txt`): each call adds `inc` to `theCount`; when `theCount >= tim[2]` it
  clamps and sets `fin=true`. (Edge case: if `tim[1]==tim[2]` — i.e. `cooldown<=1` — it's instantly
  `fin`, e.g. `merlinSword cooldown:0`.)
- `CounterOnce` (`CounterOnce().txt`): advance the counter **only while not finished** (no looping).

`modWeaponManager.update → updateCooldowns` (321–341): every frame, `CounterOnce(eachCounter)` — so
each weapon's counter creeps from `1` toward `cooldown` by `inc` per frame, then latches `fin=true`.
**Recovery time ≈ `cooldown / inc`** (frames). `resetCooldown` (253–257) = `CounterReset` on the
current weapon's counter — called when a shot is fired, restarting the climb. `getCooldownFin`
(207–211) reads `pCooldownCounters[pCurrentWeapon].fin` — the "ready to fire?" gate.

So **higher skill stat = faster recast**: a melee weapon recovers in `cooldown/agility` frames, ranged
in `cooldown/dexterity`, magic in `cooldown/manaRegeneration`. For the player's energyBlast
(`cooldown:30`, `mana_regeneration:30` at base) that's `30/30 ≈ 1` — i.e. magic is recast-limited
almost entirely by `manaRegeneration`, growing faster as `manaRegeneration` does. This is exactly the
"energyBlast recast = cooldown/manaRegeneration" already noted in `mana.ts` (`regeneration ->
cooldown divisor`) — but in the original it is a *per-weapon Counter on the manager*, not inline.

### `setCurrentWeapon` / `selectSpell` / `getWeapons`

`setCurrentWeapon(theWeapon)` (305–317):
```
if pWeapons[theWeapon].animType <> #magic then me.ID.bigMe.cancelAttack()  -- abort any in-flight non-magic swing
pCurrentWeapon = theWeapon
attack = pWeapons[theWeapon].duplicate()
me.ID.bigMe.setAttack(attack)            -- push the attack into modAttack (pAttack)
```
`setAttack` (`modAttack.txt` 813–847) duplicates the attack into `pAttack`, resolves `#type` from
`#animType` (`AttackSetTypeFromAnimType`), and fires `#attackSet`. **Selecting a weapon = setting the
character's live `#attack`.** `getWeapons(theType)` (223–249) returns the weapon symbols of a given
type, filtered by `weaponIsOfType` (393–415: `#magic` ⇒ `animType=#magic`; `#nonMagic` ⇒
`animType<>#magic`). `selectSpell(num)` (287–303): `getWeapons(#magic)[num] → setCurrentWeapon` — the
1–9 spell hotkeys (`objAiPlayer` 158–186).

`setMultiAttack` (343–389) is range-based auto weapon-switching for *CPUs* with 2 weapons (ranged
weapon 1 + melee weapon 2): pick weapon 1 when `distToTarget > bufferDist²` else weapon 2 (with a
melee-vs-melee nuance). Out of scope for B2 (no reachable 2-weapon CPU in the room-1 slice; §g).

### Charge math — `modAttack`, from `#attack` × mana stats (NO resource pool)

`modAttack` holds `pChargeMax/pChargeSpeed/pChargeStart/pChargeSpeedMax`. These are seeded from the
attack's data (the `gmgOff` path, 856–861, is the "normal" seeding: `pChargeMax = pAttack.chargeMax`,
etc.). The *live per-cast* values come from three handlers (all reading the **character's mana
getters**):
- `calcAttackChargeMax` (83–119):
  `characterMax = getManaCapacity()*chargeMaxModifier + chargeMaxBasic`;
  `chargeMax = min(pAttack.chargeMax, characterMax)`;
  if `limitMagic`: `chargeMax = chargeMax * magicLimitMaster.getMagicLimit()/100`;
  `randomSummon` wobble (summon-only). → **the charge ceiling grows with `manaCapacity`.**
- `calcAttackChargeStart` (123–157): `chargeStart = pChargeStart + getManaBurst()`, clamped to
  `chargeMax` and `chargeStartMax`. → **bigger starting charge with `manaBurst`.**
- `calcAttackChargeSpeed` (161–181): `chargeSpeed = pChargeSpeed * getManaFlow()`, clamped to
  `chargeSpeedMax` (`#unlimited` ⇒ no clamp). → **faster charging with `manaFlow`.**

For `act_energyBlast`: `chargeMax:999`, `chargeMaxModifier:0.75`, `chargeMaxBasic:5`, `chargeStart:0`,
`chargeSpeed:1`, `chargeSpeedMax:#unlimited` (default), `cooldown:30`, `limitMagic:true`, `power:0.75`,
`bullet:#energyBlastBullet`, `spellSpeed:20`. This is **the exact formula `control.ts` already
inlines** for the one spell — B2 generalizes it to read these fields from the resolved `#attack`
instead of the `SPELL` constant.

`gmgOn/Off` (849–861) swap `pChargeMax/Speed/Start/SpeedMax` to the `gmg*` fields (auto-fire machine
gun). `act_player` carries `#gmgChargeLoc`; `act_energyBlast` carries `gmgChargeMax:15/Speed:5/Start:5/
gmgAutoFire:true`. GMG is **collected** (`#gmg` scroll → `gmgCollected`, not a weapon) — deferred (§g).

### Damage path with real powers (the A1-deferred coupling)

`modAttack.calcCollisionVect*` build the vector A1's `takeHit` consumes:
- **Melee** (`calcCollisionVectMelee` 463–519): for a `point` power, `vect = calcAttackPower() *
  strength` (`#magicMelee`: `* (strength + 1.5*manaCapacity)/1.5`). So melee damage = `power · strength
  · damageMultiplier` (`#power` is a `point`, e.g. `#punch point(2,0)`, `merlinSword point(.5,.5)`
  with `damageMultiplier:16`).
- **Bullet** (`calcCollisionVectBullet`/`calcAttackPowerBullet` 437–459, 347–355): `vect =
  bulletVelocity · power` → damage = `(speed·power)·damageMultiplier`.
- **Spell** (`calcCollisionVectSpell` 523–567): radial `(charge/2 + targetRadius − dist) · power`,
  aimed along the spell→target line.

Then (A1, verified): `objGameObject.takeHit` applies the vector as **inertia-damped knockback**
(`knock = vect·(100−inertia)/100`) and **passes the damped vector to `modEnergy.takeHit`**, where
`damage = (|vx|+|vy|)·damageMultiplier`. **Inertia damps damage AND knockback together** — the single
coupling A1 deliberately left out (it damped *knockback only*, keeping the port's current damage
numbers, because the real per-weapon powers weren't flowing yet). B2 is where they flow, so B2 owns
the decision to (re)couple — see §c.4 and §f.

---

## (b) Gap vs the port today

| Original | Port today (`control.ts`/`mana.ts`/`pickup.ts`) | Gap |
|---|---|---|
| `pWeapons` registry (`sym → #attack`), `pCurrentWeapon`, `setCurrentWeapon/selectSpell` | `hasSword`/`hasSpell` booleans + inline `SPELL`/`PUNCH` consts; one spell, one punch | No inventory, no selection, no second spell possible |
| `addWeapon` on pickup (`newScrollCollected → addWeapon`) | `Pickup.apply`: `equipSword()` flips `hasSword`+`power+160`; `grantSpell()` flips `hasSpell` | Pickups mutate flags, not a weapon list; sword power is a flat `+160`, not `power·strength·mult` |
| Per-weapon cooldown **Counter**, `inc = agility/dexterity/manaRegeneration` | scalar `fireCd`/`meleeCd` per component; magic uses `cooldown/regeneration`; melee `PUNCH.cooldown`=20 flat | No per-weapon counters; melee/ranged cooldowns don't scale by agility/dexterity; only magic scales |
| Charge math reads `#attack.chargeMax/Modifier/Basic/Start/Speed/SpeedMax` × mana getters | `SPELL` constant hardcodes energyBlast's fields; `chargeMaxOf = capacity*0.75+5`; no `chargeSpeedMax`/`chargeStartMax` clamps; `limitMagic` ignored | Charge engine bound to one spell; any 2nd spell diverges; clamps/limiter absent |
| Damage = `power·strength·damageMultiplier` (melee) / `(speed·power)·mult` (bullet), from data | `power = round(strength*4)+8` (+160 sword); spell `dmgPerUnit*charge`; enemy `power*2`; `mult` rarely set | Damage pre-baked at call site; `damageMultiplier` not read from `#attack`; sword bonus is a magic number |
| Inertia damps damage + knockback (coupled) | A1 damps **knockback only**; damage passes undamped | The A1-deferred coupling, gated on real powers (this plan) |
| CPUs drive attacks through the same manager (`getAttack().type` dispatch) | `CpuAI` has its own `ranged`/`power`/`cooldownMax`/`atkPower` scalars from `spawnEnemy` | CPU & player attack paths diverge; no shared weapon/attack object |

`spawnEnemy`/`spawnPlayer` **already resolve the real `#attack`** (animType, cooldown, reach, power,
target* fields) — B2's job is to route that through a shared component instead of fanning it into
ad-hoc scalars on `CpuAI`/`PlayerControl`.

---

## (c) Component / file-level design

**Core decision:** introduce a **`WeaponManager` component** (`modWeaponManager`) on every combatant
that owns `pWeapons` (resolved `#attack`s), `pCurrentWeapon`, and `pCooldownCounters`, plus a
**`charge.ts` helper** (`modAttack` charge math) that resolves `chargeMax/Start/Speed` from the
current weapon's `#attack` × the entity's `Mana` stats. `PlayerControl` and `CpuAI` become **drivers**
that read the current weapon and its cooldown from `WeaponManager` and dispatch by attack `#type`
(melee → `impactMeleeAttack`; ranged/magic → charged `fireBullet`) — they stop holding their own
cooldown/reach/power scalars. Pickups call `weaponManager.addWeapon(sym, attack)` instead of flipping
booleans. **`Mana` stays exactly as-is** (it's the faithful charge tuner; `WeaponManager`/`charge.ts`
read its getters).

This mirrors B1's shape: a substrate (the `WeaponManager` + `charge` helper, pure-ish, unit-tested)
lands first; the brain-swap (PlayerControl/CpuAI driving through it) lands last.

### New: `port/src/components/weapon.ts` — `WeaponManager`

A `Component` on `PlayerArchetype`/`EnemyArchetype`/`DwellingArchetype`, ordered **before** the
control/AI component (so a driver can read the current weapon the same tick) and after `Mana` (so it
can read mana getters at `addWeapon`/charge time). State:
- `weapons: Map<string, AttackData>` — `pWeapons` (the resolved `#attack` as a plain object).
- `current: string | null` — `pCurrentWeapon`.
- `counters: Map<string, Counter>` — `pCooldownCounters`. `Counter` is a tiny port of the Lingo
  primitive (`{ count, lo, hi, inc, fin }` + `reset()`/`once()`), in `engine/counter.ts` (pure,
  unit-tested) — faithful to `CounterNew/Counter/CounterReset/CounterOnce`.

`AttackData` = the subset of `#attack` the drivers need, resolved once at spawn/acquire:
`{ name, animType, type: "melee"|"ranged"|"magic", cooldown, power, damageMultiplier, reach, hits,
sound, bullet, spellSpeed, chargeMax, chargeMaxModifier, chargeMaxBasic, chargeStart, chargeSpeed,
chargeSpeedMax, chargeStartMax, limitMagic }` with `structAttack` defaults
(`structMaster.structAttack`: `damageMultiplier 1`, `cooldown 0`, `chargeMax 5`, `chargeMaxModifier 1`,
`chargeMaxBasic 0`, `chargeStart 1`, `chargeSpeed 1`, `chargeSpeedMax unlimited`, `chargeStartMax
none`, `power point(5,-1)`, `reach 25`, `hits [#teamMembers]`). `type` from `animType`
(`AttackSetTypeFromAnimType`: `naturalMelee/weaponMelee/magicMelee → melee`; `weaponRanged → ranged`;
`magic → magic`).

Handlers / API (faithful subset):
```
init(cfg)                       // store the natural attack from cfg (cfg.attack), build it as weapon 0
start()/post-build              // initNaturalAttack + initStartingWeapon (if cfg.startingWeapon)
addWeapon(sym, attack)          // register + addCooldownCounter + setCurrentWeapon
setCurrentWeapon(sym)           // set current; getCurrentAttack() now returns this attack
selectSpell(n)                  // getWeapons("magic")[n] -> setCurrentWeapon (player hotkeys)
getCurrentAttack(): AttackData  // what the driver attacks with this tick
getCooldownFin(): boolean       // counters.get(current).fin  (ready to fire?)
resetCooldown()                 // counters.get(current).reset() on fire
update(next)                    // updateCooldowns: counters.forEach(once)  (ordered each tick)
getWeapons(type)                // symbols filtered by type (magic / nonMagic)
addSaveData/restoreFromSave     // persist weapons/current/counters (replaces the hasSword/hasSpell blob)
```

`addCooldownCounter(sym)`: `c = new Counter(); c.hi = attack.cooldown; c.fin = true; c.inc =
{melee: agility, ranged: dexterity, magic: manaRegeneration}[attack.type]` — reading the entity's
stats via `Mana`/`PlayerControl` getters (`getAgility`/`getDexterity`/`getManaRegeneration`). **Agility
and dexterity** are currently not modelled as stats — add them to the entity (default from
`act_player`: `agility:1`, `dexterity:0.2`; enemies default `1`) so melee/ranged cooldowns scale
faithfully. Cheapest home: small numeric fields on `WeaponManager` (or `Mana`), seeded from cfg
(`spawnPlayer`/`spawnEnemy` already pass `strength`/`mana_*`; add `agility`/`dexterity`).

> **Counter equivalence note.** `updateCooldowns` calls `CounterOnce` every frame on every weapon's
> counter (whether or not it's current). Recovery ≈ `cooldown/inc` frames; the port's `Counter.once()`
> reproduces this exactly (add `inc`, clamp at `hi`, latch `fin`). The driver gates a shot on
> `getCooldownFin()` and calls `resetCooldown()` after firing — **identical semantics** to the current
> `fireCd/meleeCd` countdowns, but per-weapon and stat-scaled.

### New: `port/src/components/charge.ts` (or a method block on `WeaponManager`) — `modAttack` charge

A small pure helper resolving the live per-cast charge values from `(attack, mana)`:
```
chargeMax(attack, mana)   = min(attack.chargeMax, mana.capacity*attack.chargeMaxModifier + attack.chargeMaxBasic)
                            * (attack.limitMagic ? magicLimit/100 : 1)     // magicLimit defaults 100 (no limiter) — §g
chargeStart(attack, mana) = min(attack.chargeStart + mana.burst, chargeMax, attack.chargeStartMax ?? ∞)
chargeSpeed(attack, mana) = attack.chargeSpeedMax==="unlimited" ? attack.chargeSpeed*mana.flow
                                                                : min(attack.chargeSpeed*mana.flow, attack.chargeSpeedMax)
```
This **is** `control.ts`'s current `chargeMaxOf` generalized — energyBlast's `0.75/5/0/1` become
`attack.chargeMaxModifier/Basic/chargeStart/chargeSpeed`, read from data. `PlayerControl` calls these
each charging tick against `getCurrentAttack()`. (`randomSummon` wobble = summon content, C-phase, §g.)

### `control.ts` — `PlayerControl` drives through `WeaponManager`

Remove: `hasSword`, `hasSpell`, `equipSword`, `grantSpell`, `getHasSpell`, the `SPELL`/`PUNCH`
constants, `power`/`meleeReach` scalars, and the weapons save-blob. Replace with reads of
`WeaponManager`:
- **Attack dispatch by current weapon `#type`** (mirrors `objAiPlayer.playerAttackCharge/Release`):
  - `type === "magic"`: hold-to-charge (charge from `chargeStart` by `chargeSpeed` to `chargeMax`,
    all via `charge.ts`), release → `castMagic` fires `bullet` at `spellSpeed`. Cast gate is
    `getCooldownFin()` (replaces the `fireCd` ad-hoc) → `resetCooldown()` after firing. **`getHasSpell`
    becomes "does the player have any `magic` weapon?"** (`getWeapons("magic").length > 0`) — the HUD
    charge-bar gate.
  - `type === "melee"`: auto-swing when `getCooldownFin()` and a target's in `reach`
    (`getCurrentAttack().reach`) → `impactMeleeAttack` (unchanged from B1, but `reach`/`power`/`mult`
    now come from the weapon's `#attack`, not `meleeReach`/`power` scalars).
  - `type === "ranged"`: (no reachable player ranged weapon in the slice; the dispatch arm exists for
    parity but is exercised by CPUs).
- **Damage** = the weapon's real `#attack`: melee `vect = aimedVect(dir, basePower) ·
  damageMultiplier` where `basePower = |power.x|+|power.y|` (the `point` L1) scaled by strength;
  `merlinSword` becomes `point(.5,.5)` L1 `1.0 · strength · 16` instead of the flat `+160`. **This is
  the calibration risk (§f) — tune so room 1 still clears.**
- `chargeFrac` reads `charge / chargeMax(getCurrentAttack(), mana)`. `levelUp` no longer rescales a
  `power` scalar (melee power derives from the weapon × current strength at swing time).
- The summon-on-`E` keybind stays as-is (ad-hoc ally spawn; summon *spells* are C3).

### `pickup.ts` — `addWeapon` instead of booleans

`Pickup.apply`:
- `"sword"` → `player.get(WeaponManager).addWeapon("#merlinSword", merlinSwordAttack)` where the
  attack is `registry.resolveActor("merlinSword").attack` (resolved `AttackData`). This **is**
  `newScrollCollected → addWeapon` — auto-selects the sword as current weapon.
- `"spell"` → `addWeapon("#energyBlast", energyBlastAttack)` (from `act_energyBlast.attack`).
- Mana/heal/speed pickups unchanged.

Effect→attack resolution lives in a tiny `pickupAttacks` map (or `registry.resolveActor(name).attack`)
so the pickup carries the real `#attack`, not a synthetic one.

### `control.ts` — `CpuAI` drives through `WeaponManager` too

`CpuAI` currently holds `ranged`/`power`/`cooldownMax`/`reach`/`reachRanged`/`atkSound`/`runReload`
scalars seeded from `spawnEnemy`. B2 moves the *weapon facts* (cooldown, reach, power, sound, bullet,
type) onto the enemy's `WeaponManager` (built from the same resolved `#attack` `spawnEnemy` already
has). `CpuAI` then reads `getCurrentAttack()` for `reach`/`type`/`bullet`/`sound` and `getCooldownFin()`
for the fire gate, calling `resetCooldown()` on fire. The FSM (findTarget/moveToAttack/runReload/dazed)
is **unchanged** — only the source of the attack scalars moves. `runReload` (kite) still keys off
`getCooldownFin()`. This unifies the player and CPU attack paths on one component (the audit's "CPUs
get real data-driven attacks" win) and is what lets future weapon/spell content plug into any unit.

> Keep B2's CPU change *minimal*: the cooldown counter now scales by agility/dexterity (was a flat
> `cooldownMax`), and reach/power/sound read from the weapon. No `setMultiAttack`, no spell-actor
> lifecycle — those stay out (§g).

### `archetypes.ts` — wire the manager + new stats

- Add `WeaponManager` to `PlayerArchetype`/`EnemyArchetype`/`DwellingArchetype`, ordered after `Mana`
  and before the control/AI component.
- `spawnPlayer`: pass the resolved `#punch` as `cfg.attack` (the natural attack) + `agility:1`,
  `dexterity:0.2` (`act_player`). Drop the separate `targetReach`/`hits` plumbing that duplicated the
  attack (still needed by `Targeting` from B1 — keep `Targeting`, but it can read the same resolved
  attack).
- `spawnEnemy`: pass the resolved weapon `#attack` as `cfg.attack` + `agility`/`dexterity`
  (defaults `1`). The existing `atkPower`/`atkReach`/`atkCooldown`/`atkSound` fan-out is replaced by
  the single `cfg.attack` the `WeaponManager` consumes; `CpuAI.init` reads from `getCurrentAttack()`.
- `DwellingArchetype`: dwellings have no attack (no `WeaponManager` driver) — only add the component
  if a dwelling carries an `#attack` (towers, C2); otherwise omit to avoid dead state. (Room-1
  dwellings don't attack.)

### Worked example — picking up the sword

Player starts with `pWeapons = {#punch}` (natural, `agility:1` ⇒ counter recovers in `20/1=20`
frames). Walk onto the `merlinSword` pickup → `addWeapon("#merlinSword", {animType:#weaponMelee,
power:point(.5,.5), damageMultiplier:16, reach:point(12,5), cooldown:0})` → counter `hi=0` ⇒ instantly
`fin` (no cooldown), `setCurrentWeapon` makes it current. Now a swing uses `reach = hypot(12,5)≈13`,
`damage = (|.5|+|.5|)·strength·16 = strength·16` per victim (vs `#punch`'s `strength·2`). Press a spell
hotkey later (once energyBlast is owned) → `selectSpell(1)` → current weapon = energyBlast (magic),
charge engine engages.

---

## (d) Implementation order (substrate-first, behavior-swap-last)

1. **`engine/counter.ts`** — port `Counter` (`new/reset/once`, `lo/hi/inc/count/fin`). Pure;
   unit-tested against the Lingo edge cases (`hi==lo` instant-fin; recovery ≈ `cooldown/inc`; `once`
   no-loop). No engine coupling.
2. **`AttackData` resolver** — a function `resolveAttack(raw): AttackData` (structAttack defaults +
   `type` from `animType`), in `weapon.ts` or `data.ts`. Unit-tested against real `act_player` `#punch`,
   `act_merlinSword`, `act_energyBlast`.
3. **`charge.ts`** charge math (`chargeMax/Start/Speed` from `(attack, mana)`), pure + unit-tested
   against energyBlast's numbers (must reproduce today's `capacity*0.75+5`, `chargeStart 0+burst`,
   `chargeSpeed 1*flow`). `magicLimit` stubbed to `100` (no-op) — §g.
4. **`WeaponManager` component** — `pWeapons`/`current`/`counters`, `addWeapon`/`setCurrentWeapon`/
   `selectSpell`/`getCurrentAttack`/`getCooldownFin`/`resetCooldown`/`update`/`getWeapons`, save/restore.
   Add `agility`/`dexterity` stat fields. Unit-tested (add → current set, counter inc by right stat,
   selectSpell filters magic, save round-trip).
5. **Wire into archetypes** — add `WeaponManager` to the three archetypes; `spawnPlayer`/`spawnEnemy`
   pass `cfg.attack` + `agility`/`dexterity`. **No behavior change yet** (drivers still use their own
   scalars; the manager just exists alongside, exercised by tests).
6. **Swap `PlayerControl`** to drive through `WeaponManager`/`charge.ts`: remove `SPELL`/`PUNCH`/
   `hasSword`/`hasSpell`, dispatch by `getCurrentAttack().type`, gate on `getCooldownFin()`. Update
   `getHasSpell`→"owns a magic weapon". **Calibrate melee/spell damage** so room 1 still clears
   (§f).
7. **Swap `pickup.ts`** sword/spell to `addWeapon(sym, resolvedAttack)`. Remove `equipSword`/
   `grantSpell`.
8. **Swap `CpuAI`** to read weapon facts from `WeaponManager` (`getCurrentAttack`/`getCooldownFin`/
   `resetCooldown`); drop the `ranged`/`power`/`cooldownMax`/`reach*`/`atkSound` scalars it duplicated.
   FSM untouched.
9. **Fold the A1 damage-damping decision** (§c.4 / §f) — apply the chosen coupling in `movement.ts`/
   `combat.ts`; re-run the room-1 gate.
10. Update audit rows (`01`/`03` `modWeaponManager`/`modAttack`/charge rows → FAITHFUL/PARTIAL) +
    `README.md` status log.

Steps 1–5 are pure substrate (no fight changes); 6–9 are the brain-swap, each independently testable;
step 9 is the one balance-sensitive change, isolated and gated.

---

## (e) Test plan

**Unit (`vitest`):**
- `Counter`: `hi==lo` ⇒ instant `fin`; from reset, `ceil(hi/inc)` `once()` calls to latch `fin`;
  `once` doesn't loop after `fin`; `inc` = the stat (recovery `30/manaRegeneration`).
- `resolveAttack`: `#punch` → `{type:"melee", cooldown:20, power L1=2, mult:1, reach≈12}`;
  `merlinSword` → `{type:"melee", cooldown:0, mult:16, power L1=1}`; `energyBlast` →
  `{type:"magic", chargeMax:999, chargeMaxModifier:.75, chargeMaxBasic:5, cooldown:30, spellSpeed:20,
  limitMagic:true}`; defaults fill from `structAttack`.
- `charge`: energyBlast against `capacity:10/flow:1/burst:1` ⇒ `chargeMax = min(999, 10*.75+5)=12.5`,
  `chargeStart = min(0+1, 12.5)=1`, `chargeSpeed = 1*1=1` — **matches the current `SPELL` math**
  (guards no charge regression); `chargeSpeedMax`/`chargeStartMax` clamps; `limitMagic` no-op at 100.
- `WeaponManager`: `addWeapon` registers + sets current + builds a `fin` counter; `addWeapon` twice ⇒
  `getWeapons("magic")` returns only magic syms; `selectSpell(2)` picks the 2nd magic; `getCooldownFin`
  false right after `resetCooldown`, true after `cooldown/inc` ticks; save/restore round-trips
  weapons+current+counters (replaces the `hasSword/hasSpell` save test).
- Driver dispatch: a player with a melee current attack swings via `impactMeleeAttack` (reuses B1
  test); with a magic current attack, holding charges to `chargeMax` then `castMagic` fires a bullet
  with `dmg` from `power·charge` and `speed = spellSpeed`-derived; cooldown gates the next cast.
- **No-regression assertions:** melee damage for `#punch` (strength 8) and `merlinSword` equal today's
  values within tolerance after calibration (§f); spell base-charge damage fells a 300-energy enemy
  (the `SPELL.dmgPerUnit` invariant).

**Room-1 no-regression gate (`tools/playthrough_smoke.ts`):**
- The smoke grabs the `merlinSword` pickup then teleports adjacent and auto-punches until clear. After
  B2, the sword is `addWeapon`'d (current weapon = sword) and the swing damage comes from
  `power·strength·16`. **Gate: `after.enemies === 0`, `exitsOpen === true`, `errors === none`** — same
  as B1. Tune the melee damage scale so kills-per-swing match today (no slower/faster clears).
- (Magic isn't reachable in room 1 — the spell-path calibration is guarded by the unit "fells a
  300-energy enemy" test, not the smoke.)

**In-browser smoke:**
- Pick up the sword → `getWeapons("nonMagic")` shows `#punch` + `#merlinSword`, current = sword; swing
  knocks back a cluster (B1 area melee intact) for the new damage. Grant energyBlast (debug) →
  `getHasSpell` true, charge bar fills to `chargeMax`, release fires `energyBlastBullet`-equivalent;
  recast gated by `cooldown/manaRegeneration`. Enemy ranged unit still kites (`runReload` off
  `getCooldownFin`). FPS unchanged. No pageerrors.

---

## (f) Faithfulness risks

1. **Damage-damping recalibration (the headline risk).** Real powers now flow, so the original's
   inertia-couples-damage-and-knockback can finally be honored. **Recommendation (§c.4): keep A1's
   *knockback-only* damping for B2** — do NOT recouple damage to inertia in this iteration. Rationale:
   the port's enemy energies and the player's melee/spell powers are still *slice-tuned* (e.g.
   `power·strength·16` for the sword is calibrated to clear room 1, not to the engine's 9999-unit
   scale), so re-introducing inertia-damping of *damage* would silently de-rate every hit against
   heavy (high-`inertia`) actors and risk a balance regression with no faithfulness payoff yet (room-1
   orcs have `inertia:0`, so the coupling is a no-op *there* but a landmine elsewhere). Instead: (a)
   make `damageMultiplier` flow from `#attack` into `takeHit`'s `mult` for *every* weapon (it already
   plumbs through — just populate it from `AttackData` instead of defaulting `1`), so relative
   lethality is now data-driven; (b) leave the inertia→damage coupling as an **explicit C-phase item**
   to land *with* a holistic damage-rescale to the engine's native power units (where the original
   numbers are calibrated for the coupling). Document this in the A1 plan's "deferred" note as
   *still* deferred, now with the reason it can't land safely until the power-scale is faithful.
   **Mitigation:** the room-1 gate + the "fells a 300-energy enemy" unit test pin balance; the
   `damageMultiplier`-from-data change is asserted to reproduce today's `#punch`/`merlinSword` numbers.
2. **Sword damage rewrite (`+160` → `power·strength·mult`).** The flat `+160` is a tuned magic number;
   `point(.5,.5)·strength·16 = strength·16` (=128 at strength 8) is close but not identical. **Must
   calibrate** the melee `power` scale factor so `merlinSword` and `#punch` land at today's effective
   damage (else room 1 clears slower/faster). This is the single most likely smoke-test breaker.
3. **Agility/dexterity introduced as stats.** Melee/ranged cooldowns now scale by `agility`/`dexterity`
   (was flat). Player `agility:1` ⇒ `#punch` recovers in `20/1=20` (matches today's `PUNCH.cooldown=20`
   — no change). Enemies default `1` ⇒ their cooldowns equal `attack.cooldown` (vs today's
   `atkCooldown + 18/6` fudge). **Risk:** the `+18`/`+6` fudge in `CpuAI.init` exists to slow enemy
   attacks to the slice's feel; dropping it for the faithful `cooldown/agility` may speed enemy
   attacks. Calibrate (raise default enemy `cooldown` or keep a small additive) and re-run the gate.
4. **Per-weapon counter vs scalar countdown.** Equivalence holds (`Counter.once` ≈ a countdown), but
   the *latch-on-acquire* (`c.fin=true` initially) means a freshly picked-up weapon can fire
   immediately — matches the original. Ensure `resetCooldown` is called on *fire*, not on select, or a
   weapon-swap could grant a free instant shot (the original cancels non-magic on select, not the
   counter).
5. **`getHasSpell` semantics.** The HUD gates the charge bar on it. Redefining it as "owns a magic
   weapon" must stay false until energyBlast is acquired (room 6) — verify the natural `#punch` (melee)
   doesn't count, and that a player with only `#punch`+`#merlinSword` still reports no spell.
6. **`setCurrentWeapon` auto-selects the just-added weapon.** Picking up the sword makes the sword
   current (correct — original `addWeapon → setCurrentWeapon`). But picking up energyBlast then makes
   *magic* current, so the player auto-charges instead of punching. Faithful (the original does this),
   but a behavior change from today (where magic and punch coexist via `hasSpell`); the player
   re-selects punch via... there's no weapon-cycle key in the slice. **Decision:** keep the original's
   auto-select; if the slice needs punch-after-spell, that's the weapon-selector (`modWeaponSelector`,
   out of scope §g) — note it, don't build it. (In practice the cursor-hold-to-charge vs tap-to-melee
   distinction may need a small adaptation; flag for the implementer.)

---

## (g) Out of scope (explicitly)

- **GMG toggle** (`modGoldenMachineGun`/`gmgMaster`/`modAttack.gmgOn/Off`) — `#gmg` is a *collected
  toggle*, not a weapon, and is **not placed in the merlin4 map**. The `gmg*` fields are parsed into
  `AttackData` (cheap) but the on/off swap + auto-fire + HUD are deferred (audit 03 §3 T2 follow-on).
  Only build if `gmgCollected` turns out reachable in the room-1 slice (it isn't).
- **Magic limiter** (`magicLimitMaster.getMagicLimit`) — `charge.ts` reads it but it defaults to `100`
  (no-op). The limiter master + `objMagicLimit` are unbuilt (audit 03); `limitMagic:true` on
  energyBlast is honored *structurally* (the multiply is there) but always ×1 until the master exists.
- **Spell-actor lifecycle** (`objAiAttack.ensureSpell`/`chargeSpell`/`releaseMagic` as a *live actor*
  that grows and converts to bullets; `getCurrentCharge`, `calcChargeLoc`, `isOnAttackFrame`
  attack-frame gating, eyestrain) — the port keeps the instant `fireBullet`-on-release (acceptable per
  the B1/A1 precedent). `chargePerUnit`/multistage/streaming-release (`modFireBullets`) is C-phase.
- **`setMultiAttack`** (range-based 2-weapon auto-switch for CPUs) — no reachable 2-weapon CPU in the
  slice; the FSM uses a single current weapon.
- **C-phase spell *content*** — cBlast/cBlastAi/darkBlast (C1, just data once the engine is generic),
  arcticBlast/freezeBlast/healBlast (C2 status formulas: `takeFreeze` vect·multiplier, `#takeHeal`,
  payload-*lists*), all summon spells + `randomSummon` wobble + `modSpellMultistage`/reservations
  (C3). B2 builds the *engine* they plug into, not the spells.
- **`weaponSelector` / weapon-cycle HUD** (`modWeaponSelector`) — the 1–9 `selectSpell` hotkeys are
  wired (cheap), but the weapon-selector overlay UI is a render seam.
- **A1 inertia→damage coupling** — recommended *still deferred* (see §f.1); lands with a holistic
  power-scale pass in C-phase, not here. B2's contribution is making `damageMultiplier` data-driven.
- **`modWeaponTechnique`** (attack-anim speedup accumulator) — separate small module, not part of the
  weapon registry; deferred.
