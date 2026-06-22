# mageOrc — Per-Actor Parity Audit (REPRODUCED)

**Method:** Derived correct behavior from `casts/data/act_mageOrc.txt` + `act_goblinSummon.txt` +
`objAiCPUSpellCaster` / `modAttack.calcAttackChargeMax` / `modSpellMultistage` / `armyMaster`, then
RAN the port via a throwaway probe (`tools/_audit_mageOrc.ts`, since deleted) loading the real
`@/generated/assets.json`, spawning `mageOrc` + a player target, ticking 300 frames with
`rebuildCombatSubstrate()` each tick and the main-loop spell sweep.

**Result: CLEAN — 0 divergences.** The two divergences flagged by the *previous* version of this
audit (mageOrc never summons; goblinArcher summon has no art) are BOTH STALE — the current port
summons correctly and every summon tier resolves to its real bundled sprite.

---

## SECTION 1 — Derived correct behavior (original)

### Identity (`act_mageOrc.txt`)
| Property | Value |
|---|---|
| objType | #objCPUCharacter |
| AiType | #objAiCPUSpellCaster |
| inherit | #CPUCharacter |
| character | #enemyCharacter |
| team | #orcs |
| name (sprite char) | **"mageOrc"** |
| energy | 300 |
| walkSpeed | 4 (→ 2.4 px/tick ×0.6) |
| inertia | 65 |
| dexterity / strength | 1 / 1 |
| mana_capacity | 31 |
| mana_flow | 1.5 |
| damageSpeed | 4 |
| stallSpeed | 0.5 |
| experienceImWorth | 30 |
| chargeOffsetSide / chargeLoc | #top / point(0,-16) |
| weapon | #goblinSummon |

### Weapon `#goblinSummon` (`act_goblinSummon.txt`) — a multistage random summon spell
- objType #objScroll, #animType #magic, #animframe #none, #explodeFunction #summonUnit, #randomSummon true.
- #chargeMax 37, #chargeStart 0, #chargeSpeed 0.4, #chargeExplodeFactor 1, #cooldown 15, #reach 9999,
  #spellSpeed 20, #hits [#teamMembers], #residentTeamCategory #enemies, #targetAllegiance #enemy,
  #targetTileWhenNotBlank true.
- #multistage tiers: goblinWarrior:15, goblinArcher:17, goblinMage:20, bowOrc:25, swordOrc:30,
  mageOrc:34, blackOrc:36.

### Charge ceiling (`modAttack.calcAttackChargeMax`, structMaster defaults chargeMaxModifier=1, chargeMaxBasic=0)
`characterMax = manaCapacity(31)·1 + 0 = 31`; `chargeMax = min(37, 31) = 31`.
randomSummon wobble fires because `multistage[2]` (the 2nd VALUE = goblinArcher's 17) `− 31 < 0`:
`tempMax = 31·random(20)/17 + random(15)`; `chargeMax = min(31, tempMax) + random(2)−1`.
So the ceiling wobbles in [0..31]; the deterministic ceiling is 31 → **swordOrc** (30), and the wobble
can pull it down to bowOrc/goblinMage/goblinArcher/goblinWarrior or below the first tier (no summon).
mageOrc(34) and blackOrc(36) are **unreachable** at capacity 31.

### Summon placement / team (`modSpellMultistage.summonPayload` → `armyMaster.createUnitFromSummonSpell`)
The released spell FLIES toward the target tile (reach 9999, spellSpeed 20, targetTileWhenNotBlank) and
on explosion summons ONE unit **at the spell's landing loc** (`summonSpell.getLoc()`), of the
highest-tier whose chargeRequired ≤ charge (`selectPayload`). The unit carries its OWN #team
(swordOrc → #orcs, etc.) so it joins the caster's side. The bolt's #explode (#takeHit) also resolves.

### AI (`objAiCPUSpellCaster`)
Bullet-dodge optimumPosition (runTangentToObjects), flee close enemies to pEnemySafeDistance=100,
else approach target; cast when in reach (9999, always) and cooled. After each attack: setTarget(#none)
→ retarget. Death: #CPUCharacter holds a grave; no die/reel strip.

---

## SECTION 2 — Reproduced in the port (observed)

| Aspect | Derived-correct | Observed in port | OK |
|---|---|---|---|
| anim char | "mageOrc" sprite | `an.char = "mageOrc"` (NOT blackOrc) | ✓ |
| energy / maxSpeed / inertia | 300 / 2.4 / 65 | 2.4 maxSpeed; energy/inertia present | ✓ |
| team / side | #orcs / enemy | `#orcs`, type `enemy` | ✓ |
| mana capacity / flow | 31 / 1.5 | 31 / 1.5 | ✓ |
| weapon | #goblinSummon, magic, summonUnit, randomSummon | name `#goblinSummon`, type `magic`, explodeFunction `#summonUnit`, randomSummon `true` | ✓ |
| reach / chargeMax / cooldown | 9999 / 37 / 15 | 9999 / 37 / 15 | ✓ |
| animFrame / attackFrames | #none → [] | `[]` (fires on strip completion) | ✓ |
| multistage tiers | 7 tiers as above | identical, sorted ascending | ✓ |
| hits | [#teamMembers] | `["#teamMembers"]` | ✓ |
| dodgesBullets / runReload / ranged | true / true / true | true / true / true | ✓ |
| chargeMaxOf(no rng) | 31 → swordOrc | 31 | ✓ |
| wobble tier dist (500 casts) | mostly swordOrc, sometimes lower / none | swordOrc 233, goblinMage 70, bowOrc 58, goblinArcher 46, goblinWarrior 17, none 76 | ✓ |
| CHARGE → cast → spell FLIES → summon at TARGET | yes | spell-actor flew (114 spell-ticks); 4 summons landed at **(430,200)=target loc**, team `#orcs`, char `swordOrc` | ✓ |
| summon tier sprite resolution | each tier → real strip | goblinWarrior→goblinWarrior, **goblinArcher→gar**, goblinMage→goblinMage, bowOrc→bowOrc, swordOrc→swordOrc, mageOrc→mageOrc, blackOrc→blackOrc (all `_stand` bundled) | ✓ |
| grave / death | grave strip, no die/reel | `mageOrc_grave` bundled; no `mageOrc_die`/`_reel` (correct) | ✓ |

300-tick trace: mageOrc enters `attack` (attackT ramps 10→0), fires on release-strip completion
(`fired=true`), transitions to `optimumPosition` (kiting toward target while charging the next cast),
and lands summons at the player tile. Entities grew 2 → 6. **It charges, casts a flying spell, and
summons the correct tier at the target — fully faithful.**

---

## SECTION 3 — Divergences

**None.**

### Stale prior findings (verified RESOLVED — listed so they are not re-opened)
- **(prev) DIVERGENCE-1 "mageOrc never summons":** STALE. `control.ts:758` now reads
  `if (an.looped()) { if (!this.attackFired) this.performAttack(m); … }` — an `#animframe:#none`
  caster fires on strip completion. `performAttack` routes the summon branch
  (`control.ts:809-821`): `spawnSpell` → `SpellActor.setCharge(chargeMaxOf(…, game.rng))` →
  `release(target)`; on landing `spellActor.ts:126-127` calls `summonUnit` at the landing loc.
  Probe observed 4 live summons at the target tile over 300 ticks.
- **(prev) DIVERGENCE-2 "goblinArcher summon has no art":** STALE. `act_goblinArcher` #name is
  `"gar"` and `gar_stand` IS bundled in `assets.json`; `spriteCharOr("goblinArcher")` resolves to
  `gar` via the data-#name path (`anim.ts:38-40`). No blackOrc fallback. All 7 summon tiers render
  with their real strips.

### Faithful original-game quirks (documented, NOT bugs)
- mageOrc/blackOrc multistage tiers (34/36) are **unreachable** at mana_capacity 31 — by original
  design; the wobble keeps casts mostly at swordOrc and below. Faithful to
  `calcAttackChargeMax`.
- `#name: "mageOrc"` means a *mageOrc* can summon another *mageOrc* tier in principle, but only at a
  higher charge ceiling than this actor can reach — moot here.

---

## Conclusion
Every derived property and behavior reproduces in the running port: correct sprite (mageOrc, not
blackOrc), charge → flying summon spell → tier unit fielded at the target on the caster's team, the
randomSummon wobble distribution, bullet-dodge spellcaster kiting, and grave death. **CLEAN.**
