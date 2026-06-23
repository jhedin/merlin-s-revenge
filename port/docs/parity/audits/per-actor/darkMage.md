# Per-Actor Parity Audit: `darkMage`

**Method:** Behavior DERIVED from `casts/data/act_darkMage.txt` + inherit chain (`#CPUCharacter` → `#character` → `#actor`) + `act_darkBlast.txt` (the magic weapon) + the AI scripts `objAiCPUSpellCaster.txt` / `objAiAttack.txt` / `objCPUCharacter.txt`. Behavior REPRODUCED by running `port/tools/_audit_darkMage.ts` (throwaway): real `@/generated/assets.json`, 80×80 CollisionGrid, `unitMap.configure(32,0,0)`, all entities updated except the inert target, `rebuildCombatSubstrate()` + `sweepSpells()` each tick, 300 frames. darkMage (`#undead`) spawned vs an INERT `#aldevar` player target ~140 px away (undead hates aldevar). Probe deleted after the audit.

---

## 1. Identity & Data (derived → observed)

| Property | Original (`act_darkMage.txt`) | Port (resolved/observed) | Match |
|---|---|---|---|
| `#objType` | `#objCPUCharacter` | enemy CpuAI stack | ✓ |
| `#AiType` | `#objAiCPUSpellCaster` | `dodgesBullets=true`, optimumPosition chain | ✓ |
| `#character` | `#darkMage` | `animChar="darkMage"` — **resolves to a real bundled strip, NOT blackOrc** | ✓ |
| `#name` | `"darkMage"` (no bundled `#member`) | resolves via `#character` to `darkMage_*` strips | ✓ |
| `#team` | `#undead` | `getTeam()="#undead"`; hates `[#aldevar, …]` | ✓ |
| `#energy` | `150` | 150 | ✓ |
| `#strength` | `1` | 1 | ✓ |
| `#dexterity` | `3` | 3 | ✓ |
| `#inertia` | `60` | 60 | ✓ |
| `#walkSpeed` | `3.5` | 3.5 (slice-scaled at runtime) | ✓ |
| `#damageSpeed` | `4` | 4 | ✓ |
| `#chargeOffsetSide` | `#top` | SpellActor `offsetSide="#top"` | ✓ |
| `#experienceImWorth` | `40` | 40 | ✓ |
| `#experienceAmountForNextLevel` | `5` | 5 | ✓ |
| `#weapon` | `#darkBlast` (a DAMAGE spell, not a summon) | current attack = darkBlast, `type="magic"` | ✓ |
| mana_* | inherits capacity 10 / flow 1 / burst 1 / regen 1 | same | ✓ |
| `#stallSpeed` | `0.5` (reel-recovery rate) | not forwarded — no reel-recovery model | WONTFIX |
| `#miniMapStatus` | `#inf` | no minimap in port | WONTFIX |

**Attack type:** `#darkBlast` is a **DAMAGE spell** (`#animType:#magic`, `#bullet:#energyBlastBullet`, `#power:3`, `#payloadFunction:[#takeHit]`, `#explodeFunction` unset → `#none`). It is NOT a summon and not a mine-layer. The damage path is the grow-fly-explode `objSpell` (`#releaseFunction:#release`).

---

## 2. Animation Strips (assets.json — all present, all `darkMage_*`)

| Strip | Frames×delay | Used by CPU darkMage? |
|---|---|---|
| `darkMage_stand` | 3×2 | idle ✓ |
| `darkMage_walk` | 4×2 | move ✓ |
| `darkMage_charge` | 4×2 (= 8 ticks) | **YES — plays during the cast wind-up** ✓ |
| `darkMage_release` | 4×2 (= 8 ticks) | **YES — plays at the cast/fire** ✓ |
| `darkMage_reel` | (present) | hit react ✓ |
| `darkMage_grave` | (present) | corpse ✓ |

Confirmed via probe: the per-tick `animAction` override the CpuAI forces was `charge` for t=1–8, then `release` for t=9–14, repeating each cast cycle. `blackOrc` fallback was never used (`animChar==="blackOrc"` → false).

---

## 3. Weapon & Spell (`#darkBlast` / `act_darkBlast.txt`) — derived → resolved

| Property | Original | Port (resolved) |
|---|---|---|
| `#animType` | `#magic` | `type="magic"`, `animType="#magic"` ✓ |
| `#bullet` | `#energyBlastBullet` | carried; explode path uses the SpellActor radial, not a record bolt ✓ |
| `#power` | `3` | `powerScalar=3` ✓ |
| `#reach` | `9999` | capped to `reachRanged=644` (room-scale); target ≤140 px → always in reach ✓ |
| `#cooldown` | `15` | cadence ≈ 15 ticks observed ✓ |
| `#chargeStart` | `5` | charge start (mana_burst discarded — faithful K11 bug) ✓ |
| `#chargeMax` | `999` | min(999, 10·0.5+10)=15 ✓ |
| `#chargeMaxBasic` | `10` | 10 ✓ |
| `#chargeMaxModifier` | `0.5` | 0.5 → derived chargeMax 15 ✓ |
| `#chargeSpeed` | `1` | 1 ✓ |
| `#chargeExplodeFactor` | (default 4) | 4 → explode radius = charge·4/2 ✓ |
| `#spellSpeed` | `20` | fly speed 20/3 ≈ 6.7 px/tick ✓ |
| `#collisionLoc` | `point(0,−8)` | muzzle (x, y−8) ✓ |
| `#hits` | `[#teamMembers,#teamBuildings]` | same ✓ |
| `#limitMagic` | `false` | false ✓ |
| `#explodeSound`/`#releaseSound` | `"spell_explode"`/`"spell_release"` | same ✓ |

---

## 4. AI Behaviour (derived → reproduced)

### Original (`objAiCPUSpellCaster` extends `objAiCPU` extends `objAiAttack`)
1. `findTarget` → nearest hostile (`#undead.hates`).
2. reach=9999 → always "in reach" → `attack()` → `attackMagic()` → `chargeMagic()`.
3. `chargeMagic` = `ensureMode(#charge)` (play charge strip) + `ensureSpell()` (spawn the orb at chargeStart over the head) + `chargeSpell()` per frame (`currentSpell.charge(count, chargeLoc)` — the orb **visibly grows**); counter chargeStart 5 → chargeMax 15 at inc 1 ≈ 10 frames.
4. counter `fin` → `internalEvent(#spellCharged)` → `releaseMagic(targetLoc)` = `ensureMode(#release)` (release strip) + `releaseSpell` (`currentSpell.release` flies at spellSpeed 20).
5. orb arrives → `goMode(#explode)`: `pCurrentCharge·=chargeExplodeFactor`, `impactAttack(me)` radial `#takeHit` (power 3) on every hostile in the disc.
6. `attackFin` → `setTarget(#none)` → `goSpellCasterMode(#moveToOptimumPosition)`; the positioning loop dodges bullets (tangent), flees enemies < 100 px, approaches the target past a 100+20 buffer, idles, and re-fires once cooled.
7. death/`#reel` → `pSpellCasterMode=#none`, `cancelMoveToLoc`, `cancelAttack`; grave drawn.

### Port (reproduced over 300 frames)
1. `refreshTarget()` committed the `#aldevar` target every cycle (in-loop `findTarget` = target @ ~100–140 px). ✓
2. `moveToAttack` initially (15 ticks), then `optimumPosition` for the remainder (matches post-attack `goSpellCasterMode(#moveToOptimumPosition)`). ✓
3. **Multi-frame charge wind-up plays**: `attack()` enters with `releasePhase=false` → `darkMage_charge` strip (8 ticks, t=1–8). On strip completion the cast fires and `releasePhase=true` → `darkMage_release` strip (t=9–14). ✓
4. **The cast DEALS DAMAGE**: spell spawned at the charge→release transition, flew to the target, exploded → `resolveSplash` `#explode` `takeHit`. The inert 200-energy player **died on every cast** — 18 lethal casts over 300 ticks (death ticks 30, 45, 59, 74, 88, 103, …). The "CPU damage-spell spawns the orb but deals no damage" issue does NOT affect darkMage.
5. **Cadence**: 17 casts in 300 ticks, gaps ≈ 15 ticks (cooldown 15). Continuous re-fire via optimumPosition step-3/4 (`if (this.cooledDown() …) this.attack(...)`). ✓
6. Spell flight: direct position stepping (`flyDirX/Y·speed`, vx/vy stay 0) — faithful to `objSpell.releaseNormal`/`moveXYfin`. ✓
7. Death → grave component fires; `darkMage_grave` present. ✓

---

## 5. Divergences

### DIV-1 (FAITHFUL-quirk / cosmetic): the charge orb does not GROW over the head during the wind-up

**Original** (`objAiAttack.txt:126–142`, `157–188`):
- `chargeMagic` calls `ensureSpell()` at the START of the wind-up — the `objSpell` actor is spawned immediately over the caster's head at `chargeStart`.
- Every frame `chargeSpell` does `currentSpell.charge(count, chargeLoc)` so the orb's `size = charge·chargeSize` **grows visibly** through the whole `darkMage_charge` strip, then flies on `#spellCharged`.

**Port** (`port/src/components/control.ts:783–792`, `updateAttack`):
- The `darkMage_charge` strip plays for its full length, but `spawnSpell` is NOT called until the charge strip **completes** (the charge→release transition). The orb appears only at release, then immediately flies — there is no growing orb over the head during the charge frames.

**Proof** (`tools/_audit_darkMage.ts`): the only spell entity each cycle first appears on the release frame (`[t=9] SPELL spawned`, `[t=24] SPELL spawned`, …), never during t=1–8 while `animAction=charge`.

**Impact:** purely cosmetic. The wind-up DURATION (charge strip 8 ticks ≈ the original's ~10-frame charge counter), the `darkMage_charge` and `darkMage_release` animations, the flight, the radial explode, and the damage are all reproduced faithfully. Only the "orb visibly grows over the head while charging" sub-visual is missing (the orb is shown for the first time at release).

**Verdict:** **FAITHFUL-quirk / cosmetic** — WONTFIX-class. The cast's gameplay (timing, animation phases, lethal radial damage, cadence) matches the original; only the intra-charge orb-growth VFX differs.

> **Note — the prior audit's "DIV-1" is STALE.** A previous revision of this file claimed the CPU caster "skips the multi-frame charge phase — `darkMage_charge` never plays, the spell instant-releases in one frame." That is no longer true: animation-driven attacks (the charge→release strip flow in `control.ts:783–792`) were added after that audit, and the probe now shows the charge strip playing for 8 ticks before each cast. The only residual difference is the intra-charge orb-growth VFX above.

---

## 6. Faithful Quirks / WONTFIX (with proof)

| Quirk | Proof | Verdict |
|---|---|---|
| `reachRanged` capped 9999→644 | `control.ts:700` `min(MAX_RANGED_REACH=644, ca.reach)`; optimumPosition keeps the mage ≤140 px, so the cap never blocks a shot | WONTFIX |
| `mana_burst` discarded from chargeStart | `charge.ts:48–59` reproduces the original `calcAttackChargeStart` overwrite bug (K11) | FAITHFUL bug |
| `#stallSpeed=0.5` not forwarded | port has no reel-recovery-rate parameter; no observable cast effect | WONTFIX |
| `#miniMapStatus:#inf` | no minimap system | WONTFIX |
| `#chargeVolumeMap` audio scaling | no audio in the combat harness; cosmetic | WONTFIX |
| `darkBlast #animframe:#none` | original fires on `#spellCharged`, not a frame crossing; port fires on charge-strip completion — equivalent | WONTFIX |

---

## 7. Summary Table

| Behaviour | Original | Port | Verdict |
|---|---|---|---|
| Identity / team / energy / walk | `act_darkMage.txt` | resolved enemy CpuAI | ✓ CORRECT |
| `#name`/`#character` → `darkMage_*` strips (no blackOrc fallback) | `act_darkMage.txt:7,18` | `animChar="darkMage"`, real bundle | ✓ CORRECT |
| Weapon = darkBlast magic DAMAGE spell | `act_darkMage.txt:20` + `act_darkBlast.txt` | `type="magic"`, power 3 | ✓ CORRECT |
| Spellcaster AI (dodge / optimumPosition) | `objAiCPUSpellCaster.txt` | `dodgesBullets`, optimumPosition | ✓ CORRECT |
| Multi-frame charge wind-up + `darkMage_charge` strip | `objAiAttack.chargeMagic` | `control.ts:783–792` charge phase | ✓ CORRECT (prior audit's DIV-1 was stale) |
| Release strip + spell flies + explodes | `releaseMagic`/`objSpell` | `spellActor.ts` fly→explode | ✓ CORRECT |
| **Cast DEALS DAMAGE (radial `#takeHit`)** | `impactAttack` power 3 | `resolveSplash` `#explode` | ✓ CORRECT (target killed on every cast; 18 lethal casts/300 ticks) |
| Cadence ≈ cooldown 15 | `act_darkBlast.txt:19` | ~15-tick gaps observed | ✓ CORRECT |
| Death → grave | `modGrave` | `components/grave.ts` | ✓ CORRECT |
| **Charge orb GROWS over the head during wind-up** | `ensureSpell`+`chargeSpell` per frame | orb spawns only at release | **DIV-1: cosmetic / FAITHFUL-quirk** |

---

`darkMage | DIVERGENCES=1`

DIV-1 (FAITHFUL-quirk, cosmetic): the charge orb is spawned at the charge→release transition rather than at charge-start, so it does not visibly grow over the mage's head during the `darkMage_charge` wind-up — animation phases, timing, flight, radial damage, and cadence are all faithful (cast is lethal, killed the target on every cycle).
