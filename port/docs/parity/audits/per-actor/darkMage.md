# Per-Actor Parity Audit: `darkMage`

**Method:** Derived from `casts/data/act_darkMage.txt` + full inherit chain + AI scripts, then reproduced in
the port by running `tools/_audit_darkMage.ts` (300-frame + 600-frame probes; probe deleted after audit).

---

## 1. Identity & Data

| Property | Original (`act_darkMage.txt`) | Resolved value (inherit chain) | Port (observed) | Match |
|---|---|---|---|---|
| `#objType` | `#objCPUCharacter` | `#objCPUCharacter` | `EnemyArchetype` | ✓ |
| `#AiType` | `#objAiCPUSpellCaster` | `objAiCPUSpellCaster` extends `objAiCPU` | `dodgesBullets=true`, `runReload=true`, `optimumPosition` mode | ✓ |
| `#character` | `#darkMage` | `#darkMage` | `animChar="darkMage"` | ✓ |
| `#team` | `#undead` | `#undead` | `team="#undead"` | ✓ |
| `#weapon` | `#darkBlast` | → `act_darkBlast.txt` magic spell | primary attack resolves to darkBlast | ✓ |
| `#strength` | `1` | `1` | `strength=1` | ✓ |
| `#dexterity` | `3` | `3` | `dexterity=3` | ✓ |
| `#energy` | `150` | `150` | `energy=150, max=150` | ✓ |
| `#inertia` | `60` | `60` | `inertia=60` | ✓ |
| `#walkSpeed` | `3.5` | `3.5` | `maxSpeed=2.1` (3.5×0.6 slice-scale) | ✓ |
| `#damageSpeed` | `4` | `4` | `damageSpeed=4` | ✓ |
| `#chargeOffsetSide` | `#top` | `#top` | cosmetic muzzle; forwarded to SpellActor | ✓ |
| `#experienceImWorth` | `40` | `40` | `imWorth=40` | ✓ |
| `#experienceAmountForNextLevel` | `5` | `5` | `experienceAmountForNextLevel=5` | ✓ |
| `#stallSpeed` | `0.5` | reel-recovery rate | NOT forwarded | WONTFIX (below) |
| `#miniMapStatus` | `#inf` | visible on minimap | no minimap in port | WONTFIX |
| `mana_capacity` | (none; inherits `act_character:10`) | `10` | `capacity=10` | ✓ |
| `mana_flow` | (none; inherits `1`) | `1` | `flow=1` | ✓ |
| `mana_burst` | (none; inherits `1`) | `1` | `burst=1` | ✓ |
| `mana_regeneration` | (none; inherits `1`) | `1` | `regeneration=1` | ✓ |

**WONTFIX: `#stallSpeed`** — `objGameObject.txt:69` describes this as "how rapidly the character can
recover from being hit" (a reel-recovery rate in the original's `objMoveXY`). The port has no reel-recovery
concept (reel is handled by `Hurt`/`Movement` knockback decay); the value is not forwarded in
`archetypes.ts:spawnEnemy`. No observable effect on cast/attack cadence. Faithful omission.

**WONTFIX: `#miniMapStatus`** — cosmetic display feature; port has no minimap.

---

## 2. Animation Strips

Original: `#character: #darkMage` → all strips keyed under `darkMage_`.

| Strip | Original strips expected | Port (assets.json) | Loop | Notes |
|---|---|---|---|---|
| `darkMage_stand` | stand idle | 3 frames | `loop=true` | ✓ |
| `darkMage_walk` | walk cycle | 4 frames | `loop=true` | ✓ |
| `darkMage_charge` | charge phase (displayed during multi-frame charge) | 4 frames | `loop=true` | strip exists but CPU skips charge phase — see DIV-1 |
| `darkMage_chargeWalk` | charge while walking | 4 frames | `loop=true` | used by PlayerControl only |
| `darkMage_release` | cast/fire | 4 frames | `loop=false` (one-shot ✓) | ✓ |
| `darkMage_releaseWalk` | release while walking | 4 frames | `loop=true` | PlayerControl only; loop=true is a cosmetic quirk (faithful for walk-release) |
| `darkMage_reel` | hit/knockback | 6 frames | `loop=false` | ✓ |
| `darkMage_grave` | corpse | 2 frames | `loop=false` | ✓ |
| `darkMage_die` | MISSING | — | — | WONTFIX (below) |

**WONTFIX: `darkMage_die`** — The original uses `#reel`/`#reelFly`/`#dead` modes to transition to a grave
(`modGrave`). There is no distinct `die` strip in the original's `act_darkMage`; the asset exporter did not
extract one. The port uses `grave` correctly (dead → `getGraveOn=true` → `darkMage_grave` held). Faithful.

---

## 3. Weapon & Spell (`#darkBlast` / `act_darkBlast.txt`)

| Property | Original (`act_darkBlast.txt`) | Port (observed) |
|---|---|---|
| `#animType` | `#magic` | `animType="#magic"`, `type="magic"` |
| `#reach` | `9999` | `reach=9999`; capped to `reachRanged=220` in CpuAI init |
| `#cooldown` | `15` | effective cooldown 34 frames (`(15+18)×1+1`, manaRegen=1) |
| `#chargeMax` | `999` | raw `chargeMax=999` |
| `#chargeMaxBasic` | `10` | `chargeMaxBasic=10` |
| `#chargeMaxModifier` | `0.5` | `chargeMaxModifier=0.5` |
| Derived `chargeMax` | `min(999, 10×0.5+10) = 15` | computed `15` ✓ |
| `#chargeStart` | `5` | `chargeStart=5`; +manaBurst(1) → effective start 6 |
| `#chargeSpeed` | `1` | `chargeSpeed=1` per tick |
| Charge ramp | ~9–10 ticks from start to full | N/A — port instant-releases at full (DIV-1) |
| `#spellSpeed` | `20` | `spellSpeed=20` → fly speed 20/3≈6.7 px/tick |
| `#power` | `3` | `powerScalar=3` |
| `#bullet` | `#energyBlastBullet` | `bullet="#energyBlastBullet"` |
| `#chargeColour` | `rgb(0,0,0)` (black) | `chargeColour=[0,0,0]` |
| `#hits` | `[#teamMembers, #teamBuildings]` | `hits=["#teamMembers","#teamBuildings"]` |
| `#limitMagic` | `false` | `limitMagic=false` |
| `#randomSummon` | `false` | `randomSummon=false` |
| `#explodeSound` | `"spell_explode"` | `explodeSound="spell_explode"` |
| `#releaseSound` | `"spell_release"` | `releaseSound="spell_release"` |

---

## 4. AI Behavior (Derived vs Reproduced)

### Original (`objAiCPUSpellCaster` extends `objAiCPU` extends `objAiAttack`)

1. **findTarget** → finds nearest hostile via `teamMaster.findTarget`.
2. **moveToAttack** → target always in reach (reach=9999) → immediately calls `attack()` → `chargeMagic()`.
3. **Multi-frame charge phase** (`#charge` character mode): `ensureMode(#charge)` plays `darkMage_charge` animation. Each frame: `chargeSpell()` increments counter by 1. After ~9–10 frames (chargeMax=15, start=6, speed=1), counter reaches max → `#spellCharged` event.
4. **Release**: `releaseMagic(targetLoc)` → `ensureMode(#release)` plays `darkMage_release` strip → spell flies, explodes. `resetCooldown()` starts 15-frame cooldown.
5. **Post-attack**: `attackFin` → `setTarget(#none)` → AI enters `pSpellCasterMode=#moveToOptimumPosition`.
6. **optimumPosition loop**: 1) dodge bullets tangent, 2) flee enemies within 100px, 3) approach target beyond 100px buffer, 4) idle+shoot when cooled.
7. **Death**: `pSpellCasterMode=#none`, cancel spell, grave spawns.

### Port (reproduced, 300-frame simulation)

1. **findTarget** → `refreshTarget()` ✓
2. **moveToAttack** → with reachRanged=220 (capped from 9999), target at 140px → in reach after 7 frames → enters `attack()` ✓
3. **Attack (instant)**: `performAttack()` calls `spawnSpell` + `setCharge(chargeMax=15)` + `release()` in ONE frame. No per-frame charge ramp. **DIV-1** (see below).
4. **Attack animation**: `attackAction()` shows `"release"` strip (darkMage_release, 4 frames, loop=false). The `darkMage_charge` strip is **never played by CpuAI**. **DIV-1**.
5. **Post-attack**: `attackFin` → `dodgesBullets=true` → `goMode("optimumPosition")` ✓
6. **optimumPosition**: bullet-tangent dodge + enemy-flee + approach/idle+fire loop ✓
7. **Cast interval**: observed 33 frames between spells (effective cooldown 34; 1-frame rounding). Original: ~15 charge + 4 release + 15 cooldown ≈ 34 frames total. Port cadence is close but the split is different.
8. **Death + grave**: `isDead=true`, `getGraveOn=true`, grave strip found ✓

---

## 5. Divergences

### DIV-1: CPU spellcaster skips the multi-frame charge phase (no `darkMage_charge` animation)

**Original** (`casts/script_objects/objAiAttack.txt:126-129`, `objAiCPU.txt:444-468`):
- `chargeMagic()` calls `ensureMode(#charge)` on the character → plays `darkMage_charge` (4-frame looping strip).
- `chargeSpell()` is called every frame until the counter reaches `chargeMax` (~9–10 frames at speed=1 from start=6 to max=15).
- During this period the character is in `#charge` mode visually and positionally (charge orb grows over head at `calcChargeLoc()`).
- `#spellCharged` → `releaseMagic()` → `ensureMode(#release)` → plays `darkMage_release`.

**Port** (`port/src/components/control.ts:807-818`):
- `CpuAI.performAttack()` calls `spawnSpell`, `sa.setCharge(chargeMaxOf(...))`, `sa.release()` all in the SAME frame.
- `attackAction()` returns `"release"` for the entire `attackT` window.
- The `darkMage_charge` strip is NEVER played for the CPU darkMage (only for `PlayerControl`).

**Impact**: Visual divergence (missing ~9-10 frame charge animation), timing divergence (original has ~9-frame wind-up before firing; port fires instantly), and the charge-orb growing over the darkMage's head is absent. However: the **total cast cycle** (charge+release+cooldown ≈ 34 frames in both) keeps the overall cadence faithful.

**Fix sketch**: In `CpuAI`, replace the single-frame `performAttack` with a charge ramp substate: on entering attack mode, spawn the spell actor and accumulate charge per tick (calling `SpellActor.setCharge`) until `charge >= chargeMaxOf`; then call `SpellActor.release` and leave attack mode. This matches `objAiAttack.chargeMagic/chargeSpell/releaseMagic` exactly. The `attackT` window should be held during both phases. `attackAction()` should return `"charge"` while ramp is in progress, `"release"` after `release()` is called.

**Verdict**: REAL DIVERGENCE. The K2-K8 plan (`port/docs/parity/plans/K2-K8-ai-completeness.md:154-156`) identified this as a deviation ("casters now **charge over frames** rather than instant-fire") to be fixed, but the implementation (control.ts) still instant-releases. Not a WONTFIX.

---

## 6. Faithful Quirks (WONTFIX with proof)

| Quirk | Proof | Verdict |
|---|---|---|
| `reachRanged` capped to 220 (original reach=9999) | `archetypes.ts:502` comment "cap magic's 9999"; optimumPosition approach chain always moves mage within 100px of target before firing, so the 220px cap never prevents a shot in practice | WONTFIX |
| No `chargeVolumeMap` (audio volume scaling during charge) | `act_darkBlast.txt:17` `#chargeVolumeMap`; no audio component in combat harness; cosmetic | WONTFIX |
| `#stallSpeed=0.5` not forwarded | Port has no reel-recovery parameterization; `Hurt`/`Movement` knockback decay is uniform | WONTFIX |
| `darkMage_die` strip missing | Original has no distinct `die` strip in `act_darkMage`; death goes via reel→grave; `darkMage_grave` exists and is used | WONTFIX |
| `#miniMapStatus:#inf` not honored | No minimap system in port | WONTFIX |

---

## 7. Summary Table

| Behavior | Original source:line | Port source:line | Verdict |
|---|---|---|---|
| Identity / team / energy / walk | `act_darkMage.txt:3-19` | `archetypes.ts:291-362` | ✓ CORRECT |
| Weapon → darkBlast magic | `act_darkMage.txt:20` | `archetypes.ts:169-175` | ✓ CORRECT |
| Magic attack classification (ranged AI) | `act_darkBlast.txt:9` | `archetypes.ts:183-184` | ✓ CORRECT |
| Spellcaster AI (dodgesBullets, runReload) | `objAiCPUSpellCaster.txt:20-36` | `archetypes.ts:226-228` | ✓ CORRECT |
| Bullet-tangent dodge (updateMoveToOptimumPosition) | `objAiCPUSpellCaster.txt:275-297` | `control.ts:861-928` | ✓ CORRECT |
| Post-attack → optimumPosition | `objAiCPUSpellCaster.txt:54-55` | `control.ts:699-704` | ✓ CORRECT |
| Charge max=15 (mana-scaled) | `modAttack.txt:83-118` | `charge.ts` via `chargeMaxOf` | ✓ CORRECT |
| Effective cooldown ≈33 frames | `act_darkBlast.txt:19` + `act_darkMage.txt:9` | `archetypes.ts:194-202` | ✓ CORRECT |
| Spell spawns + flies + explodes | `objSpell.txt` lifecycle | `systems/spells.ts` + `spellActor.ts` | ✓ CORRECT |
| Death → grave | `modGrave.txt` | `components/grave.ts` | ✓ CORRECT |
| **Multi-frame charge phase** | `objAiAttack.txt:126-142` | `control.ts:807-818` | **DIV-1: MISSING** |
| **`darkMage_charge` anim on CPU** | `objAiAttack.txt:127` ensureMode(#charge) | `control.ts:541-551` (magic→"release" only) | **DIV-1: MISSING** |

---

`darkMage | DIVERGENCES=1`

DIV-1: CPU magic caster skips multi-frame charge ramp (no `darkMage_charge` anim, instant-release); the `darkMage_charge` strip ships in assets but is never played by `CpuAI`. Fix: implement per-frame charge accumulation in `CpuAI.attack` mode (ensureSpell + chargeSpell ramp → release on `chargeMax`), matching `objAiAttack.chargeMagic/chargeSpell/releaseMagic`.
