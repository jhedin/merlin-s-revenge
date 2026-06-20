# Plan K1 — faithful damage coupling (inertia damps damage; real `power·strength·mult`)

Backlog item **K1** (the keystone deferral; see [`K-deferred-backlog.md`](K-deferred-backlog.md) Tier 1).
Rides on **A1** (vector `takeHit`, knockback) and **B2** (data-driven `#attack`/`AttackData`/`WeaponManager`).
Closes the two coupled deferrals A1 §4 (inertia damps **knockback only**, not damage) and B2 §f.1 (enemy
melee kept on the tuned `this.power` scalar; player melee already on `power·strength·mult·MELEE_SCALE`).

**Thesis (the reconciliation).** The original is self-consistent: real energies, real powers, real inertia,
all balanced together. The port already uses **real `#energy`** (200 player / 300 orc / 1200 blackOrc …) and
already routes the **player** melee through the faithful `power·strength·damageMultiplier` formula scaled by a
single global `MELEE_SCALE = 2.5` (B2). The only un-faithful seams left are: (1) inertia is damped into
knockback but *not* damage; (2) **enemy** melee still uses a tuned `this.power` scalar instead of
`power·strength·mult`; (3) enemy **bullets** use a tuned `power·2` instead of `speed·power·mult`. K1 adopts the
faithful coupling for all three **on the scale the player is already calibrated to** — proving that scale is the
single consistent one — and turns inertia-damps-damage on, recalibrating only where the data forces it.

---

## (a) The evidence — measured real numbers vs the port's current de-facto balance

All numbers RESOLVED from `port/src/generated/data.json` by walking the `inherit` chain (verified, not guessed).
Base struct defaults (`act_character`): `strength 1, agility 1, dexterity 1, mana_capacity 10, mana_flow 1,
mana_burst 1, mana_regeneration 1`. `inertia`/`energy`/`walkSpeed` are always per-actor (no inheritance).
Player: `energy 200, strength 8, agility 1, dexterity 0.2, mana_regeneration 30`; **player has no `inertia`**.

### Roster — the raw data

| Actor | energy | strength | inertia | attack source | power (raw) | power L1 | dmgMult | animType |
|---|---|---|---|---|---|---|---|---|
| **player `#punch`** (inline) | 200 | 8 | — | natural | `point(2,0)` | **2** | 1 (default) | #naturalMelee |
| **merlinSword** | — | — | — | weapon | `point(.5,.5)` | **1** | **16** | #weaponMelee |
| **energyPunch** (I4) | — | — | — | weapon | `point(3,1)` | **4** | 1.75 | #magicMelee |
| **energyBlast** | — | — | — | magic | `0.75` (scalar) | 0.75 | 1 (default) | #magic |
| **warrior** | 300 | 12 | **60** | `#warriorSword` | `point(.5,0)` | **0.5** | **3** | #weaponMelee |
| **swordOrc** | 300 | 3 | **70** | `#orcSword` | `point(1,0)` | **1** | **8** | #weaponMelee |
| **blackOrc** | 1200 | 30 | **80** | `#blackAxe` | `point(1,0)` | **1** | **3** | #weaponMelee |
| **archer** | 200 | 10 | **60** | `#archerBow` → `#archerArrow` | bullet `0.6` (scalar) | 0.6 | **4** | #weaponRanged |
| **mageOrc** | 300 | 1 | **65** | `#goblinSummon` (#magic) | `1` (scalar) | 1 | 1 | #magic |
| **dwarfTower** | 100 | 15 | 95 | `#towerAxe` (splash) | bullet `50` (scalar) | 50 | **10** | #naturalRanged |
| **skelitonLord** (boss) | 750 | 14 | **75** | `#skelitonLordSword` | `point(3,0)` | **3** | **12** | #weaponMelee |
| **skelitonSword** (boss part) | 200 | 6 | 80 | inline `#naturalMelee` | `point(3,4)` | **7** | 0.7 | #naturalMelee |

Note: `#energyBlastBullet` (what energyBlast/mageOrc fire) **has no actor record** — the fired bolt's damage
comes from the casting spell's `power` at runtime, not a static bullet. Bullets that *do* exist carry **scalar**
power (archerArrow 0.6×4, towerAxe 50×10, skelitonMissile 0.3×10).

### FAITHFUL per-hit damage = `(power_L1 · strength) · damageMultiplier · (100 − inertia)/100`

(Melee. The original's `objGameObject.takeHit` damps the vector by `(100−inertia)/100` *before* `modEnergy`
reads it — verified: `VarValRange(percent,[0,vect])` = `vect·percent/100`. So inertia cuts damage too.)
These are in the **engine's native units** (no scale factor) — they are NOT directly comparable to the port's
energy values; they show the *shape* of the real curve. Inertia is the attacker's-victim's; here shown as the
*victim's* damping when each is hit.

| Hit | raw `power·str·mult` (engine units) | × (100−inertia_victim)/100 → vs each victim |
|---|---|---|
| player `#punch` → orc(inertia 60-80) | 2·8·1 = **16** | warrior(60): 6.4 · swordOrc(70): 4.8 · blackOrc(80): 3.2 |
| merlinSword → orc | 1·8·16 = **128** | warrior: 51 · swordOrc: 38 · blackOrc: 26 |
| warrior → player(inertia 0) | 0.5·12·3 = **18** | player: 18 (player undamped) |
| swordOrc → player | 1·3·8 = **24** | player: 24 |
| blackOrc → player | 1·30·3 = **90** | player: 90 |
| skelitonLordSword → player | 3·14·12 = **504** | player: 504 |
| archerArrow → player (bullet `speed·power·mult`) | speed·0.6·4 | depends on bolt speed (≈ a few/hit) |

The melee energy ratios are internally consistent (a 200-energy player survives ~8 swordOrc hits, ~2 blackOrc
hits; a 300-energy orc takes ~6 punches at native-undamped, ~47 once damped by inertia 70 — the original wants
the SWORD, not the punch, to clear orcs). **This is the calibrated relationship K1 must preserve in shape.**

### The port's CURRENT de-facto balance (what the room-1 gate locks)

| Hit | port today | per-hit dmg | hits to kill |
|---|---|---|---|
| player `#punch` → 300-energy orc | `meleeBasePower = powerScalar·str·MELEE_SCALE(2.5)·mult` = 2·8·2.5·1 | **40** | 8 (but inertia NOT applied → same vs all) |
| merlinSword → orc | 1·8·2.5·16 | **320** | **1** (one-shots the 15–300 band) |
| merlinSword → blackOrc (1200) | 320 | 320 | 4 |
| **warrior → player** (tuned `this.power`, mult 1) | `max(4, round(12/3 + 0))` = 4 | **4** | 50 |
| **swordOrc → player** | `max(4, round(3/3))` = 4 | **4** | 50 |
| **blackOrc → player** | `round(30/3)` = 10 | **10** | 20 |
| **archer/mageOrc bullet → player** | CpuAI `this.power·2`, mult 1 (`this.power`=`max(4,round(str/3))`) | archer 4·2=**8**, mageOrc 4·2=**8** | 25 |
| player spell (energyBlast, base charge ~12.5) | `dmgPerUnit(26)·charge` ≈ 26·12.5 | ≈ **325** | 1 (fells a rank-and-file) |

**The two scales today.** Player melee = `power·str·2.5·mult` (the faithful formula, scale 2.5). Enemy melee =
a tuned `this.power` (≈ `strength/3`) with **mult discarded** and **inertia not applied** — a completely
different, deliberately-flattened model so a swordOrc deals 4, not 60. This is exactly the mix the keystone names:
**real energies + real player powers + tuned enemy damage**, internally inconsistent.

### The reconciliation arithmetic — applying the player's scale (2.5) to enemies

`DAMAGE_SCALE = 2.5` (= today's `MELEE_SCALE`) applied to the FAITHFUL enemy formula
`power·str·mult·2.5·(100−inertia_target)/100`, target = player (inertia 0, so undamped):

| Enemy → player | `power·str·mult·2.5` | hits to kill (player 200) | vs today | inflation |
|---|---|---|---|---|
| warrior | 0.5·12·3·2.5 = **45** | 4–5 | (was 50) | **11×** |
| swordOrc | 1·3·8·2.5 = **60** | 3–4 | (was 50) | **15×** |
| blackOrc | 1·30·3·2.5 = **225** | <1 (**one-shot**) | (was 20) | **22×** |
| skelitonLordSword | 3·14·12·2.5 = **1260** | instakill | — | huge |

**This is the landmine.** The same scale that pins the PLAYER correctly (punch 40, sword 320) makes ENEMIES
11–22× too lethal — a swordOrc would kill the player in 3 hits, a blackOrc in one. The player's `MELEE_SCALE=2.5`
was reverse-engineered from the player's `power(2)·str(8)` so `#punch=40`; it has no obligation to also balance
the enemies' very different `power·str·mult` products (orc mults of 3–16 vs the player's natural mult of 1 are
what blow it up). **A single global scale cannot reconcile both sides** because the original's balance is carried
by the *combination* of native powers AND inertia AND energies, and the port's energies are real but its scale
factor was fit to the player alone.

### Why inertia-damps-damage alone does NOT save it

Player inertia = **absent (0)** — every enemy hit on the player is undamped. So turning on inertia-damps-damage
does nothing to the enemy→player numbers above (the lethal direction). It only changes player→enemy and
enemy→enemy (orcs have inertia 60–80). On the player→enemy side it makes hits *weaker* against tanky orcs
(punch 40 → 40·0.3 = 12 vs blackOrc), which is the faithful "heavy actors are tanky" but pushes more clears onto
the sword. Conclusion: inertia-damping is necessary for fidelity but is **not** the balance lever for the
enemy→player explosion; the **scale** is.

---

## (b) The chosen scale reconciliation — Option (b)+ : keep the player calibrated, give the enemy side its own consistent scale, and turn the coupling on for both

Recommend **Option (b)** (keep the player's calibrated outputs; fix only the enemy side + the inertia coupling),
made *whole-matrix* consistent by introducing **one enemy-side scale** so the entire enemy→player /
enemy→enemy / splash matrix moves together, instead of per-actor tuned scalars.

### Constants

```ts
// weapon.ts
export const DAMAGE_SCALE       = 2.5;    // player melee — UNCHANGED (= today's MELEE_SCALE; pins #punch=40, sword=320)
export const ENEMY_DAMAGE_SCALE = 0.18;   // NEW: the single enemy-side scale on power·strength·mult
export const BULLET_DAMAGE_SCALE = 0.40;  // NEW: scale on speed·power·mult for enemy/spell bullets
// movement.ts — knockback unchanged (KNOCK_SCALE 0.06, KNOCK_MAX 5, KNOCK_FRICTION 0.78)
```

`ENEMY_DAMAGE_SCALE` is chosen to **hold today's enemy→player hit-counts** under the faithful formula, computed
against the player (inertia 0, undamped) so it's the worst case:

| Enemy → player | faithful `power·str·mult` | × 0.18 | per-hit (today) | hits (player 200) |
|---|---|---|---|---|
| warrior | 18 | **3.2** | (4) | ~60 (today ~50) ✓ in-band |
| swordOrc | 24 | **4.3** | (4) | ~46 (today 50) ✓ |
| blackOrc | 90 | **16.2** | (10) | ~12 (today 20) — tankier orc hits harder, faithfully, but NOT one-shot ✓ |
| skelitonLordSword | 504 | **91** | n/a (boss, not in room-1 band) | 2–3 (a boss SHOULD threaten) ✓ |

The single scale 0.18 keeps the rank-and-file (warrior/swordOrc) within a few percent of today's 4-per-hit and,
crucially, restores the **faithful relative ordering** the tuned model erased: blackOrc (mult 3, str 30) now hits
*harder* than swordOrc (16 vs 4) — which is faithful (a black orc is a heavy hitter) and was wrong before
(both flattened to 4). No enemy one-shots the player; the boss part threatens as a boss should. The scale is the
*ratio* `0.18 / 2.5 ≈ 0.072` between the two sides — a deliberate, documented px-scale decoupling (the same kind
A1 already took for knockback), and the price of the port's player-only `MELEE_SCALE` fit.

> **Why not one global scale (Option a)?** Shown in (a): a single 2.5 inflates enemies 11–22×. To pull enemies
> back you'd have to *lower* the global scale, which would then under-power the player (punch < 40, sword < 320)
> and fail the room-1 gate. The two sides genuinely need two scales because the port's energies are real but its
> one calibrated constant (MELEE_SCALE) was fit to the player. Option (b)+ is the minimal-drift choice that makes
> the WHOLE matrix self-consistent (player↔enemy, enemy↔enemy, splash, magicMelee) on faithful formulas.

### Hit-count parity preserved (the gate)

- **Room-1 clears at ~the same speed:** player punch = 40 (unchanged), merlinSword = 320 one-shots the 15–300
  band (unchanged) — the smoke grabs the sword and clears identically.
- **The spell still fells a rank-and-file:** energyBlast path unchanged in this plan (see §c — spell stays on its
  calibrated `dmgPerUnit·charge`; recoupling the radial `(charge/2+r−d)·power` magic vector is **K2 territory**,
  noted in §g).
- **Enemies don't become unkillable or instakill the player:** warrior/swordOrc ≈ 3–4/hit (today 4), blackOrc 16
  (today 10, faithfully tankier-hitting, not 225), no one-shots.

### magicMelee (energyPunch, I4) lands faithfully for free

`calcCollisionVectMelee` `#magicMelee` term = `power·(strength + 1.5·manaCapacity)/1.5`. The port already applies
this in `tryMelee` (the `effStrength` branch). With `DAMAGE_SCALE` unchanged it stays on the player's scale —
correct, since energyPunch is a player weapon.

---

## (c) File-level changes

### `movement.ts` — inertia damps the vector BEFORE Energy reads it (the coupling)

This is the cardinal change. Today `Movement.takeHit` damps a *copy* into knockback (`kvx/kvy`) and passes the
**un-damped** `(vx,vy)` to `next()`. Make it pass the **damped** vector downstream so Energy/Freeze/Heal all read
the inertia-reduced vector — exactly `objGameObject.takeHit` → `ancestor.takeHit`:

```ts
takeHit(next, vx=0, vy=0, attackerId=-1, mult=1) {
  const d = (100 - this.inertia) / 100;
  const dvx = vx * d, dvy = vy * d;                 // the damped collision vector (modGameObject)
  if (!this.entity.send("isReelProof")) {           // #reelProof: no knockback (but still takes damage)
    let kx = dvx * KNOCK_SCALE, ky = dvy * KNOCK_SCALE;
    const km = Math.hypot(kx, ky);
    if (km > KNOCK_MAX) { kx = kx/km*KNOCK_MAX; ky = ky/km*KNOCK_MAX; }
    this.kvx += kx; this.kvy += ky;
  }
  return next(dvx, dvy, attackerId, mult);          // <- damped vector to Energy/Freeze/Heal (the coupling)
}
```

Note the knockback now scales off the *damped* vector too (it always logically did — knockback was
`vect·(100−inertia)/100`); behavior for inertia-0 actors is unchanged. `isReelProof` still suppresses only the
impulse, not the damage (faithful — reelProof units still lose energy).

### `combat.ts` (Energy) — no change to the formula, but it now reads a damped vector

`takeHit` already computes `(|vx|+|vy|)·mult`. After the Movement change `(vx,vy)` arrive inertia-damped, so
`damage` is automatically inertia-reduced — **no edit needed in Energy** beyond updating the comment (the "damped
upstream" note becomes literally true). `takeHeal`/`takeFreeze` (combat.ts/freeze.ts) likewise now see the damped
vector — faithful (the original damps the vector once, in objGameObject, for every modEnergy/modFreeze/heal read).

### `weapon.ts` — add the two enemy scales; keep `meleeBasePower`/`MELEE_SCALE` (alias `DAMAGE_SCALE`)

- Rename/alias `MELEE_SCALE → DAMAGE_SCALE` (keep `MELEE_SCALE` export as `= DAMAGE_SCALE` for the existing test).
- Add `ENEMY_DAMAGE_SCALE` and `BULLET_DAMAGE_SCALE`.
- Add `enemyMeleeBasePower(attack, strength) = attack.powerScalar · strength · ENEMY_DAMAGE_SCALE` (the enemy
  twin of `meleeBasePower`). `meleeBasePower` (player) unchanged.

### `control.ts` — `CpuAI.attack` : retire the tuned `this.power` melee; route bullets faithfully

- **Enemy melee** (the `else` branch, line ~457): replace
  `meleeHitFn(this.entity, this.entity.id, this.power)` with the faithful vector —
  `meleeHitFn(this.entity, this.entity.id, enemyMeleeBasePower(ca, this.strength), ca.damageMultiplier)`
  where `ca = WeaponManager.getCurrentAttack()`. Now enemy melee = `power·strength·mult·ENEMY_DAMAGE_SCALE`,
  damage-multiplier data-driven, inertia-damped at the victim — **unified with the player path** (both call
  `impactMeleeAttack` → `meleeHitFn` → A1 vector `takeHit`; only the scale constant differs).
- **Enemy bullets** (the `fireBullet(... this.power*2 ...)` arm, line ~446): replace the tuned `this.power*2` L1
  with the faithful `speed·power·mult` carried as the bullet's L1. Simplest faithful form: pass the bullet's real
  `power·BULLET_DAMAGE_SCALE` as L1 and `mult` from the bullet's `damageMultiplier`. Resolve the firing weapon's
  `#attack.bullet` actor once at spawn (spawnEnemy already resolves `splashBullet`; resolve a plain `bulletAttack`
  the same way) and store `{ powerScalar, damageMultiplier }`; fire
  `fireBullet(... speed, bulletAttack.powerScalar·speed·BULLET_DAMAGE_SCALE, team, …, mult=bulletAttack.damageMultiplier)`.
  (For the `#energyBlastBullet`-no-record case, fall back to the caster spell's `power`.) The current
  `fireBullet` signature carries no `mult`; thread `mult` through `Projectile.configure` (it already stores
  `mult` — just wire it from `fireBullet`).
- `CpuAI.power` and the `atkPower` plumbing can stay as the **bullet fallback** for record-less bullets, but melee
  no longer reads it. (Keeping it avoids a wider archetype churn; it's now only the energyBlastBullet fallback.)

### `splash.ts` — already on the A1 vector scale; only the magic side shifts with the coupling

`resolveSplash` already builds the radial vector `(hitRange−dist)·power` / `CollisionCalcVect(...,power)` and runs
it through `takeHit` → Energy. After the Movement change those vectors are inertia-damped at each victim too
(faithful). **No formula edit**; verify the splash unit tests (centre-lethality band, falloff) still pass — they
will, because splash victims in room-1 content are inertia-0/low, and the change only damps high-inertia victims.
The towerAxe (power 50·mult 10) splash is unchanged in magnitude (it's an explode bullet on its own radius, not
on `ENEMY_DAMAGE_SCALE`); confirm it stays in its tested 85-dmg-centre band.

### `archetypes.ts` (`spawnEnemy`) — resolve the plain bullet `#attack` for the faithful bullet damage

Alongside the existing `splashBullet` resolution, resolve the firing weapon's plain `#attack.bullet` actor into a
`bulletAttack: { powerScalar, damageMultiplier }` and pass it to `CpuAI` (a new cfg field). Melee enemies pass
none. This is the only archetype change; `strength`/`attack`/`inertia` already flow.

---

## (d) Step order — each independently testable, gated

1. **Damping coupling (movement.ts).** Pass the damped vector to `next()`. Add a unit test: a hit on an
   inertia-80 actor deals `0.2×` the damage of the same hit on an inertia-0 actor (damage, not just knockback).
   Run the room-1 gate — must still pass (room-1 orcs that the player fights have inertia 60–80, so player→orc
   damage now *drops* against them; verify the **sword** still one-shots: 320·(100−80)/100 = 64 vs a 15-energy
   rank-and-file still kills; vs a 300-energy named orc 64 → 5 hits — confirm the smoke still clears, and if it
   regresses, this is the signal that the player-melee numbers must rise to compensate, see risk §f.1).
2. **Enemy melee → `power·str·mult·ENEMY_DAMAGE_SCALE` (control.ts/weapon.ts).** Retire `this.power` melee. Unit
   test each rank-and-file matchup hits within tolerance of today's 4/hit (warrior 3.2, swordOrc 4.3, blackOrc
   16.2). Re-run the gate.
3. **Enemy bullets → `speed·power·mult·BULLET_DAMAGE_SCALE` (control.ts/bullets.ts/projectile.ts/archetypes.ts).**
   Thread `mult` through `fireBullet`→`Projectile.configure`. Unit test archer/mageOrc bullet ≈ today's 8/hit.
4. **Spell — NO change here** (energyBlast stays on `dmgPerUnit·charge`). Document that the faithful radial magic
   vector recouple is K2 (spell-actor lifecycle) — see §g. Re-assert "spell fells a 300-energy enemy".
5. **Recalibrate the constants.** With all three faithful formulas live, sweep `ENEMY_DAMAGE_SCALE`/
   `BULLET_DAMAGE_SCALE` (and, if step 1 regressed player clears, a small bump to `DAMAGE_SCALE` or the sword)
   so the per-matchup table matches today within ±15%. Pin each in a unit test.
6. **Gate + multi-map sanity.** Room-1 no-regression smoke (`enemies:0, exitsOpen:true, errors:none`) +
   in-browser on `?map=` merlinart / mr4Demo / merliniii to confirm no map became unkillable or instakill.

Steps 1–3 each flip one faithful formula and are independently revertable; step 5 is the one balance-sensitive
tuning pass, isolated behind the unit tests step 2–4 establish.

---

## (e) Test plan

**Unit (`vitest`) — per-matchup damage:**
- **Inertia-damps-damage:** `takeHit` of the same vector on inertia-0 vs inertia-80 entities → damage ratio 1.0
  vs 0.2 (NEW; today both equal because damage is undamped). Plus the existing knockback-ratio test still holds.
- **Player melee unchanged:** `#punch` (str 8) = 40, `merlinSword` = 320 (the B2 calibration test — must stay
  green; if step 1 forces a player bump, update the expected value with the new constant + a comment).
- **Enemy melee faithful:** warrior `0.5·12·3·0.18 ≈ 3.2`, swordOrc `1·3·8·0.18 ≈ 4.3`, blackOrc
  `1·30·3·0.18 ≈ 16.2`; assert each within ±15% of the pre-K1 per-hit (4/4/10) AND assert the faithful ORDER
  (blackOrc > swordOrc ≈ warrior), which the tuned model violated.
- **Enemy bullet faithful:** archerArrow `speed·0.6·4·BULLET_SCALE`, mageOrc bolt — assert ≈ today's 8/hit.
- **Boss part doesn't instakill:** skelitonLordSword vs player ≈ 91/hit → ≥2 hits (a boss threatens, not 1-shots).
- **Splash regression guard:** energyPulse centre ≈ 85, towerAxe in its band — unchanged (re-run the C2 tests).
- **magicMelee:** energyPunch uses the mana term on the player scale (re-run the I4/J2 test).

**Room-1 no-regression gate (`tools/playthrough_smoke.ts`):** grab sword → auto-melee until clear →
`after.enemies === 0`, `exitsOpen === true`, `errors === none`. The sword one-shots the rank-and-file even after
inertia-damping (320·0.2 = 64 > a 15-energy enemy), so the clear speed holds; if a *named* 300-energy orc gates,
that's the step-1/step-5 calibration signal.

**Multi-map sanity (in-browser, `?map=`):** merlinart, mr4Demo, merliniii — spawn-and-fight a few enemies of
each type; assert no enemy one-shots the player and no enemy is unkillable; no pageerrors.

---

## (f) Risks

1. **The whole-game rebalance (headline).** Every map's difficulty shifts: enemy melee gains real
   `damageMultiplier` ordering (heavy hitters hit harder), and inertia now damps *player* damage against tanky
   orcs (blackOrc inertia 80 → player punch 40 becomes 8 against it; the sword becomes the answer, faithfully).
   Room-1 is pinned by the gate, but rooms with high-energy + high-inertia orcs (or the boss parts) will play
   differently. **Mitigation:** the constants are global single levers; the multi-map sanity sweep + the
   per-matchup unit table catch the worst breaks; ship behind the same gate every prior phase used.
2. **Player has no inertia (0) — the lethal direction is uncoupled.** Turning on inertia-damps-damage does
   nothing to protect the player; only `ENEMY_DAMAGE_SCALE` does. If a later actor pass gives the player inertia,
   re-tune. (Documented so it isn't mistaken for a balance lever.)
3. **px-scale knockback vs damage decoupling persists.** Knockback keeps its own `KNOCK_SCALE` (0.06) and now two
   damage scales (2.5 player / 0.18 enemy / 0.40 bullet) exist. The *semantics* are faithful (knockback ∝ damage
   ∝ inertia-damped vector, same direction); only the px magnitudes are scaled — the same deliberate adaptation
   A1 took. The two-sided damage scale is the cost of the port's player-only `MELEE_SCALE` fit; a truly single
   scale would require re-deriving the player's `MELEE_SCALE` from the engine's native units AND re-checking every
   pickup/level-up number — out of scope, noted as a possible future "true unit normalization."
4. **Step 1 may regress the room-1 sword clear** if a named 300-energy orc gates (sword 64/hit → 5 hits). If the
   smoke fails, raise `DAMAGE_SCALE` (or the sword's effective power) just enough to restore the clear — the
   isolated step-1 gate surfaces this immediately.

---

## (g) Genuinely can't be made fully faithful here (noted)

- **The spell's faithful radial magic vector** (`calcCollisionVectSpell`: `(charge/2 + targetRadius − dist)·power`
  aimed self→target, inertia-damped) is **not** adopted in K1 — the port fires an instant `fireBullet` with
  `dmgPerUnit·charge`. Recoupling magic damage to the real radial vector requires the **live `objSpell` actor**
  that grows over the caster and converts to bullets on release — that is **K2** (spell-actor live-growth
  lifecycle). K1 leaves the spell on its calibrated scalar and flags the recouple for K2 so the spell rescale
  lands *with* the lifecycle, not before it. (energyBlast/cBlast/dark are plain bolts where `dmgPerUnit·charge`
  is an acceptable stand-in; the radial falloff only matters for the live-growing spell.)
- **`#energyBlastBullet` has no data record** — its damage must derive from the caster's `power` at runtime (the
  fallback in §c). This is faithful to the original (the bullet is spawned from the spell), but means the
  "bullet scale" for these specific bolts piggybacks the caster, not a static bullet.
- **A truly single global damage scale** is impossible without re-normalizing the player's `MELEE_SCALE` to the
  engine's native units and re-validating every downstream player number (pickups, level-up growth, the HUD
  charge bar). K1 deliberately keeps the player calibrated and gives the enemy side its own consistent scale —
  self-consistent across the whole enemy matrix, which is the achievable parity goal.
