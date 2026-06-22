# Behavioral Audit: act_necromancer

**Method:** Full derive-from-source + reproduce-in-port. Node harness (`tools/_audit_necromancer.ts`, deleted)
loaded the real `src/generated/assets.json` bundle, spawned the necromancer + an `#aldevar` warrior target,
ran `rebuildCombatSubstrate()` + per-entity `update()` for 320 frames, and observed every anim action, every
summon (type + loc), death/grave, and the static charge math.
**Date:** 2026-06-22 (re-audit; supersedes the prior pass — its D1/D2 are corrected below)

---

## 1. Identity

| Property | Value | Source |
|---|---|---|
| Name | necromancer | act_necromancer.txt:23 |
| objType | #objCPUCharacter | :3 |
| AiType | #objAiCPUSpellCaster | :4 |
| Team | #undead (hates #aldevar et al — tem_undead) | :22 |
| Weapon | #undeadSummon | :25 |
| animChar | necromancer | derived; `necromancer_stand` is bundled |

---

## 2. Derived Correct Behavior (from the ORIGINAL)

### Stats (act_necromancer.txt)
energy 50 (:12), walkSpeed 4 (:24), inertia 75 (:14), damageSpeed 4 (:10), dexterity 1 (:11),
strength 1 (:21), mana_capacity 26 (:15), mana_flow 4 (:16), mana_capacityIncLevel 1.75 (:17),
mana_regeneration 0.75 (:18), stallSpeed 0.5 (:20), experienceImWorth 25 (:13),
chargeOffsetSide #top (:7), chargeLoc point(0,-8) (:8).

### AI (objAiCPUSpellCaster + objAiCPU)
- reach 9999 → always "in reach"; FSM findTarget → moveToAttack → attack(charge) → on `#spellCharged`
  release → attackFin → optimumPosition (dodge bullets/flee enemies, pBulletSafeDistance/pEnemySafeDistance
  = 100). runReload kite after each cast.

### Weapon #undeadSummon (act_undeadSummon.txt:6-47)
animType #magic, animframe **#none**, bullet #energyBlastBullet, chargeExplodeFactor 1, chargeSize 2,
chargeSpeed 0.6 (×manaFlow, capped chargeSpeedMax 0.8), chargeStart 0, chargeMax 36, cooldown 25,
explodeFunction **#summonUnit**, explodeSound spell_explode, hits [#teamMembers], limitMagic false,
**randomSummon true**, power 2, payloadFunction #takeHit, reach 9999, releaseSound spell_release,
residentTeamCategory #enemies, **spellSpeed 25**, targetAllegiance #enemy, **targetTileWhenNotBlank true**.

### Charge math (modAttack.calcAttackChargeMax)
chargeMax = min(36, capacity·chargeMaxModifier + chargeMaxBasic) = min(36, 26·1+0) = **26**. limitMagic
false → no scaling. randomSummon wobble fires (tier2=17 < 26): `tempMax = 26·random(20)/17 + random(15);
cm = min(26, tempMax) + random(2)-1` → per-cast ceiling ≈ **[~1.5 .. 27]** (verified samples in §3).

### Multistage tiers (act_undeadSummon.txt:27-36) — affordable at ceiling ≤27
skeletonWarrior 15 ✓, skeletonArcher 17 ✓, skeletonThrower 20 ✓, greyGhost 25 ✓, undeadDragon 29 ✗,
necromancer 33 ✗, darkMage 35 ✗, skelitonLord 38 ✗. → summons skeleton*/greyGhost; never the higher tiers
(ceiling never reaches 29). Casts whose wobbled ceiling < 15 summon **nothing** (selectPayload returns none).

### Release lifecycle (objAiCPU #spellCharged → objAiAttack.releaseMagic → objSpell.release)
On full charge the spell is released toward **`calcSpellTargetLoc()`** — the target's loc, snapped to the
**centre of the target's tile** (`targetTileWhenNotBlank:true`, objAiCPU.txt:78-100). releaseFunction defaults
to **#release** → the orb FLIES at spellSpeed 25, explodes on arrival, and `doExplodeFunction`/`summonPayload`
fields the unit **AT the landing loc (= near the target)**. The explosion also resolves the radial `#takeHit`
(power 2) and the spell carries an `energyBlastBullet`. So in the original the undead appear **around the
player**, plus a small damage pulse.

### Animation strips
The port's caster anim picks `<char>_charge` if present, else `<char>_release` (control.ts:560-564). The
necromancer ships `necromancer_charge` (+ chargeWalk, stand, walk, grave) — so the wind-up animates on the
`charge` strip. `necromancer_release` is **absent**, but it is **never needed** (charge is preferred).

---

## 3. Reproduced Behavior (320-frame harness, real bundle)

```
chargeMaxOf (no rng): 26
chargeMaxOf wobble samples (rng): [26,26,16.1,27,27,15.6,27,27,17.3,19.6,11.2,26,13.5,11.5,27,27,...]
STRIP COVERAGE: stand PRESENT, walk PRESENT, charge PRESENT, chargeWalk PRESENT, release MISSING, grave PRESENT
necro resolved char: necromancer | targeting {allegiance:#enemy, reach:9999} | mana cap 26 flow 4
actions seen: ["stand","charge","walk"]   charge strip entered: true
frames resolving to a MISSING necromancer strip: 0 (none)
total summons: 12 by char: {greyGhost,skeletonThrower,skeletonArcher,skeletonWarrior} (skeleton*/greyGhost only)
summon locs: ALL at the necromancer's own loc (e.g. f16 (400,400); after it kited to (284,400) → f79 (284,400))
after death -> action: grave | graveOn: true | grave strip present: true   reachRanged 644
```

### Confirmed faithful
- Charges then summons; tiers wobble across skeletonWarrior..greyGhost, never undeadDragon+ (ceiling ≤27). ✓
- Summoned units join `#undead`, type enemy, and engage the warrior. ✓
- Every necro action (stand/walk/charge) resolves to a **real bundled strip** — 0 fallbacks; grave on death. ✓
- AI flags: ranged true, runReload true, dodgesBullets true, reachRanged 644 (room-scaled, not the old 220);
  necro kites away (400→284) while casting. ✓
- mana_capacity 26, flow 4, regeneration 0.75, energy 50, walkSpeed 4 all forwarded. ✓

---

## 4. Divergences

### D1 — Summoned units appear at the CASTER, not at the target's tile (REAL PORT BUG)
- **Original**: `objAiCPU` releases on `#spellCharged` toward `calcSpellTargetLoc()` (objAiCPU.txt:245-248,
  78-100) — the **target's tile centre** (`targetTileWhenNotBlank:true`). objSpell flies (spellSpeed 25,
  releaseFunction #release) and `summonPayload` (modSpellMultistage.txt:372-377) fields the unit **at the
  landing loc**. Undead therefore spawn **around the player**.
- **Port**: the CPU summon branch short-circuits the flying spell:
  `summonUnit(ca, chargeMaxOf(ca, mana, rng), m.x, m.y, this.entity.id)` — **at the caster's own loc**
  (`port/src/components/control.ts:809-815`, comment "summon at the caster's loc"). `summonUnit`
  (`port/src/components/summon.ts:55-85`) spawns at the passed (x,y) with no fly/landing step.
- **Evidence**: harness — all 12 summons appeared at the necromancer's loc (f16 (400,400); after kiting to
  (284,400), f79/f87/f130… all (284–294,400)), never near the warrior at (470,400).
- **Impact**: gameplay — the necromancer builds its undead pile next to itself (behind its kite line) instead
  of dropping them onto the player. The player-cast path is faithful (spellActor flies + summons at landing,
  `spellActor.ts:117-127`); only the **CPU** path diverges.

### D2 — CPU summon cast deals NO damage / fires no bolt (REAL PORT BUG, minor)
- **Original**: the undeadSummon spell, besides summoning, explodes with a radial `#takeHit` (power 2,
  payloadFunction #takeHit) at the landing loc and carries `#energyBlastBullet` — selectPayload keeps the
  payload non-blank, so a summon cast also damages.
- **Port**: the CPU branch calls ONLY `summonUnit(...)` (control.ts:809-815) — no `resolveSplash`, no bullet.
  (The player path's `spellActor.explode` does both summon + radial damage, but the CPU path skips it.)
- **Impact**: low — the necromancer's own offensive output is near-zero (power 2 is tiny anyway); its threat
  is the summoned units. Documented for completeness.

### D3 — `stallSpeed: 0.5` unimplemented (FAITHFUL-quirk / cosmetic — do NOT fix)
- act_necromancer.txt:20. A min-speed anim-timing stall, not read anywhere in Movement/Anim. Pure cosmetic;
  movement + animation are correct without it. Out of scope.

### Corrections to the PRIOR audit (NOT divergences)
- **Prior "D1: missing `necromancer_release` → falls back to stand" is FALSE.** The port prefers the
  `necromancer_charge` strip (control.ts:560-564), which IS bundled; the harness observed 0 fallback frames.
  No release strip is needed. Removed.
- **Prior "D2: `mana_capacityIncLevel` not forwarded" is RESOLVED.** archetypes.ts:129/349 now forwards it
  (necromancer's 1.75 reaches the Mana component). Removed.

---

## 5. Derive-vs-Reproduced

| Property | Expected (original) | Reproduced (port) | Status |
|---|---|---|---|
| Team / animChar | #undead / necromancer | #undead / necromancer | PASS |
| AI mode | spellcaster + dodge + kite | ranged+runReload+dodgesBullets, kites | PASS |
| Charges then summons | yes, #undeadSummon multistage | yes, 12 summons in 320f | PASS |
| Summon tiers (cap≤27) | skeletonWarrior..greyGhost | skeleton*/greyGhost only | PASS |
| randomSummon wobble | yes (ceiling ~1.5..27) | yes (samples 11.2..27) | PASS |
| Sub-tier-1 cast → no summon | yes | (implicit; low ceilings summon none) | PASS |
| chargeMax effective | 26 | 26 | PASS |
| All actions → real strips | yes | 0 fallbacks (stand/walk/charge/grave) | PASS |
| Grave on death | necromancer_grave | grave, graveOn true | PASS |
| energy/walkSpeed/mana | 50 / 4 / 26·4·0.75 | 50 / 4 / 26·4·0.75 | PASS |
| **Summon location** | **target's tile centre (flies)** | **caster's own loc** | **FAIL (D1)** |
| **Cast damage/bolt** | **radial #takeHit + energyBlastBullet** | **none (summon only)** | **FAIL (D2)** |
| stallSpeed | 0.5 | unimplemented | quirk (D3) |
