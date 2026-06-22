# Per-Actor Parity Audit: `darkMage`

**Method:** Derived from `casts/data/act_darkMage.txt` + full inherit chain (`#CPUCharacter` → `#character` → `#actor`) + `objAiCPUSpellCaster.txt`, `objAiCPU.txt`, `objAiAttack.txt`, `modAttack.txt`, `modSpellMultistage.txt`, `act_darkBlast.txt`. Reproduced via `tools/_audit_darkMage.ts` (300-frame probe, real asset bundle, player + darkMage on 80×80 grid; probe deleted after audit).

---

## 1. Identity & Data

| Property | Original (`act_darkMage.txt`) | Resolved value (inherit chain) | Port (observed) | Match |
|---|---|---|---|---|
| `#objType` | `#objCPUCharacter` | `#objCPUCharacter` | `EnemyArchetype` | ✓ |
| `#AiType` | `#objAiCPUSpellCaster` | `objAiCPUSpellCaster` extends `objAiCPU` | `dodgesBullets=true`, `runReload=true`, `optimumPosition` mode | ✓ |
| `#character` | `#darkMage` | `#darkMage` | `animChar="darkMage"` | ✓ |
| `#team` | `#undead` | `#undead` | `team="#undead"` | ✓ |
| `#weapon` | `#darkBlast` | → `act_darkBlast.txt` magic spell | primary attack resolves to darkBlast; animType `#magic`, type `magic` | ✓ |
| `#strength` | `1` | `1` | `strength=1` | ✓ |
| `#dexterity` | `3` | `3` | `dexterity=3` | ✓ |
| `#energy` | `150` | `150` | `energy=150` | ✓ |
| `#inertia` | `60` | `60` | `inertia=60` | ✓ |
| `#walkSpeed` | `3.5` | `3.5` | `maxSpeed≈2.1` (3.5×0.6 slice-scale) | ✓ |
| `#damageSpeed` | `4` | `4` | `damageSpeed=4` | ✓ |
| `#chargeOffsetSide` | `#top` | `#top` | cosmetic muzzle; SpellActor defaults to `"#top"` | ✓ |
| `#experienceImWorth` | `40` | `40` | `imWorth=40` | ✓ |
| `#experienceAmountForNextLevel` | `5` | `5` | `experienceAmountForNextLevel=5` | ✓ |
| `#stallSpeed` | `0.5` | reel-recovery rate | NOT forwarded | WONTFIX (below) |
| `#miniMapStatus` | `#inf` | visible on minimap | no minimap in port | WONTFIX |
| `mana_capacity` | (inherits `act_character:10`) | `10` | `capacity=10` | ✓ |
| `mana_flow` | (inherits `1`) | `1` | `flow=1` | ✓ |
| `mana_burst` | (inherits `1`) | `1` | `burst=1` | ✓ |
| `mana_regeneration` | (inherits `1`) | `1` | `regeneration=1` | ✓ |

**WONTFIX: `#stallSpeed`** — `objGameObject.txt:69` describes this as the rate of recovery from reel (a reel-recovery rate in the original's `objMoveXY`). The port has no reel-recovery concept; the value is not forwarded in `archetypes.ts:spawnEnemy`. No observable effect on cast/attack cadence. Faithful omission.

**WONTFIX: `#miniMapStatus`** — cosmetic display feature; port has no minimap.

---

## 2. Animation Strips

Original: `#character: #darkMage` → all strips keyed under `darkMage_`.

| Strip | Expected | Port (assets.json) | Loop | Notes |
|---|---|---|---|---|
| `darkMage_stand` | idle | 3 frames | `loop=true` | ✓ present |
| `darkMage_walk` | walk cycle | 4 frames | `loop=true` | ✓ present |
| `darkMage_charge` | charge phase orb growing | 4 frames | `loop=true` | ✓ present in assets; **CPU never plays it** (DIV-1) |
| `darkMage_chargeWalk` | charge while walking | 4 frames | `loop=true` | PlayerControl only |
| `darkMage_release` | cast/fire | 4 frames | `loop=false` | ✓ CPU plays this during attack window |
| `darkMage_releaseWalk` | release while walking | 4 frames | `loop=true` | PlayerControl only |
| `darkMage_reel` | hit/knockback | 6 frames | `loop=false` | ✓ present |
| `darkMage_grave` | corpse | 2 frames | `loop=false` | ✓ present |

Cast strip fallback logic (`control.ts:544-549`): `animAction()` for a `#magic` caster checks `assets.anims["darkMage_release"]` first; falls back to `"darkMage_charge"`. Since `darkMage_release` exists, the port correctly resolves to `"release"` — no stand-fallback.

---

## 3. Weapon & Spell (`#darkBlast` / `act_darkBlast.txt`)

| Property | Original | Port (observed) |
|---|---|---|
| `#animType` | `#magic` | `animType="#magic"`, `type="magic"` ✓ |
| `#reach` | `9999` | `reach=9999`; capped to `reachRanged=220` in `CpuAI` init ✓ |
| `#cooldown` | `15` | effective cooldown ≈33 frames (`ceil((15−1)/1)+18+1`, manaRegen=1) ✓ |
| `#chargeMax` | `999` | raw `chargeMax=999` |
| `#chargeMaxBasic` | `10` | `chargeMaxBasic=10` ✓ |
| `#chargeMaxModifier` | `0.5` | `chargeMaxModifier=0.5` ✓ |
| Derived `chargeMax` | `min(999, 10×0.5+10) = 15` | computed `15` ✓ |
| `#chargeStart` | `5` | `chargeStart=5`; +manaBurst(1) → effective start 6 |
| `#chargeSpeed` | `1` | `chargeSpeed=1` per tick |
| `#chargeSize` | (structMaster default `1`) | `chargeSize=1` ✓ |
| `#chargeExplodeFactor` | (structMaster default `4`) | `chargeExplodeFactor=4` ✓ |
| `#spellSpeed` | `20` | `spellSpeed=20` → fly speed `20/3≈6.7 px/tick` ✓ |
| `#power` | `3` | `powerScalar=3` ✓ |
| `#bullet` | `#energyBlastBullet` | `bullet="#energyBlastBullet"` ✓ |
| `#collisionLoc` | `point(0,−8)` | `collisionLoc={x:0,y:−8}` → muzzle at `(m.x, m.y−8)` ✓ |
| `#hits` | `[#teamMembers,#teamBuildings]` | `hits=["#teamMembers","#teamBuildings"]` ✓ |
| `#limitMagic` | `false` | `limitMagic=false` ✓ |
| `#randomSummon` | `false` | `randomSummon=false` ✓ |
| `releaseFunction` | (not set → structMaster `#none`) | `releaseFunction="#release"` (not `#fireBullets` → non-streaming) ✓ |
| `explodeFunction` | (not set → `#none`) | `explodeFunction="#none"` → bolt damage path ✓ |
| `payloadFunction` | (structMaster → `[takeHit]`) | `payloadFunction=["takeHit"]` ✓ |
| `#explodeSound` | `"spell_explode"` | `explodeSound="spell_explode"` ✓ |
| `#releaseSound` | `"spell_release"` | `releaseSound="spell_release"` ✓ |

---

## 4. AI Behavior (Derived vs Reproduced)

### Original (`objAiCPUSpellCaster` extends `objAiCPU` extends `objAiAttack`)

1. **findTarget** → nearest hostile via `teamMaster.findTarget`.
2. **moveToAttack** → reach=9999 → always in reach → immediately calls `attack()` → `chargeMagic()`.
3. **Multi-frame charge phase**: `chargeMagic()` calls `ensureMode(#charge)` on the character (plays `darkMage_charge` looping strip), then `ensureSpell()` (spawns `objSpell` charge actor), then `chargeSpell()` every frame: increments counter by 1. From start=6 to max=15 → ~9 frames at speed=1.
4. **`#spellCharged` event** → `releaseMagic(targetLoc)` → `ensureMode(#release)` plays `darkMage_release` strip → `releaseSpell()` → spell flies at speed 20, explodes radially on arrival.
5. **Post-attack**: `attackFin` → `setTarget(#none)` → `goSpellCasterMode(#moveToOptimumPosition)`.
6. **optimumPosition loop**: 1) dodge enemy bullets tangent, 2) flee enemies within 100px, 3) approach target beyond 100px+20px buffer, 4) idle when close enough; fires again once cooldown recovers.
7. **Death**: `pSpellCasterMode=#none`, `cancelAttack()` (cancel any in-progress spell), grave spawns.

### Port (reproduced, 300-frame simulation)

**REAL BUNDLE CONFIRMED WORKING**: spell spawned at frame 7, flew to player at (400,400) via direct position stepping (`flyDirX/Y × speed`; not velocity), player dead at frame 28. `spellSeen=true`, entity count grew from 2→3.

1. **findTarget** → `refreshTarget()` ✓ — player found on frame 0
2. **moveToAttack** → reachRanged=220 (capped from 9999), player at 140px → in reach on frame 0 → enters attack ✓
3. **Attack (instant)**: `performAttack()` calls `spawnSpell` + `sa.setCharge(chargeMaxOf=15)` + `sa.release()` in ONE frame (frame 7 after cooldown). No per-frame charge ramp. — **DIV-1**
4. **Attack animation**: `attackAction()` returns `"release"` for the full `attackT` window. `darkMage_charge` never plays for CpuAI. — **DIV-1**
5. **Spell flies correctly**: `SpellActor.mode="fly"`, position steps by `flyDirX×speed` each frame (vel stays 0; direct step, faithful to `objSpell.releaseNormal` `moveXYfin`). Arrival → explode → player killed ✓
6. **Post-attack**: `attackFin` → `dodgesBullets=true` → `goMode("optimumPosition")` ✓
7. **optimumPosition**: bullet-tangent dodge + enemy-flee + approach/idle loop ✓; FSM stays in mode until target lost (player dead → findTarget, target=null)
8. **Cast cadence**: effective cooldown 33 frames. Original: ~9 charge + 4 release + 15 cooldown ≈ 28 frames. Port fires faster per cycle but the overall cadence difference is a secondary consequence of DIV-1.
9. **Death + grave**: `darkMage_grave` exists ✓; grave component fires on death ✓

---

## 5. Divergences

### DIV-1: CPU spellcaster skips the multi-frame charge phase — `darkMage_charge` never plays

**Original** (`casts/script_objects/objAiAttack.txt:126–142`, `objAiCPU.txt:444–468`):
- `attack()` → `chargeMagic()` → `ensureMode(#charge)` (character enters charge mode, plays `darkMage_charge` looping strip) → `ensureSpell()` (spawns objSpell over head) → `chargeSpell()` per frame.
- Each frame: counter increments by 1; from start=6 to max=15 → ~9 frames.
- When counter reaches max: `internalEvent(#spellCharged)` → `releaseMagic(targetLoc)` → `ensureMode(#release)` plays `darkMage_release` → spell released.

**Port** (`port/src/components/control.ts:807–818`):
- `CpuAI.performAttack()` calls `spawnSpell(...)`, `sa.setCharge(chargeMaxOf=15)`, `sa.release(...)` in ONE frame.
- `attackAction()` returns `"release"` for the whole `attackT` window.
- The `darkMage_charge` strip is NEVER played for CPU darkMage (it only plays for `PlayerControl`).

**Proof**: `tools/_audit_darkMage.ts` probe frame log:
- `t=1 animAction="release"` (attack already entered, showing release strip immediately)
- `t=7: spell spawned — pos=(540,384.5) vel=(0,0)` (spawned+released in same frame)
- `t=28: player dead` (spell flew correctly, killed player)
- `darkMage_charge` strip never appeared in animAction log.

**Impact**: Visual divergence (missing ~9-frame charge animation where orb grows over darkMage's head); timing divergence (original has ~9-frame wind-up before casting; port instant-releases). Total cast cycle is roughly equivalent (port compensates via cooldown calibration) but the sub-phases differ. The `darkMage_charge` asset ships in `assets.json` and is wired in `attackAction()` fallback but CpuAI never reaches that state.

**Fix sketch**: In `CpuAI.attack()` / `updateAttack()`, implement a two-phase magic-attack flow:
1. **charge phase**: call `spawnSpell(...)`, hold `SpellActor` reference; each tick call `sa.setCharge(charge += chargeSpeedOf(...))` and return `animAction="charge"`. Stop when `charge >= chargeMaxOf`.
2. **release phase**: call `sa.release(targetX, targetY, speed)`, switch `attackT` to count down the release strip, return `animAction="release"`. Call `attackFin` when strip completes.
This matches `objAiAttack.chargeMagic` → `chargeSpell` (per-frame) → `#spellCharged` → `releaseMagic` → `updateRelease` exactly.

**Verdict**: REAL DIVERGENCE — not WONTFIX.

---

## 6. Faithful Quirks (WONTFIX with proof)

| Quirk | Proof | Verdict |
|---|---|---|
| `reachRanged` capped to 220 (original reach=9999) | `archetypes.ts:666` `Math.min(220, ...)` comment; optimumPosition approach chain moves mage within 100px of target before firing, so 220px cap never blocks a shot | WONTFIX |
| No `chargeVolumeMap` audio scaling | `act_darkBlast.txt:17` `#chargeVolumeMap`; no audio component in combat harness; cosmetic | WONTFIX |
| `#stallSpeed=0.5` not forwarded | Port has no reel-recovery parameterization; `Hurt`/`Movement` knockback decay is uniform | WONTFIX |
| `darkMage_die` strip absent | Original has no distinct `die` strip in `act_darkMage`; death goes via reel→grave; `darkMage_grave` exists and is used ✓ | WONTFIX |
| `#miniMapStatus:#inf` not honored | No minimap system in port | WONTFIX |
| `darkBlast` `#animframe: #none` | Original `modAttack.isOnAttackFrame` with `#none` yields no frame-crossing hits (magic fires on `#spellCharged`, not an animframe). Port's empty `animFrame=[]` → same: fires on strip completion, not frame crossing (`control.ts:737–740`). Faithful. | WONTFIX |

---

## 7. Summary Table

| Behavior | Original source | Port source | Verdict |
|---|---|---|---|
| Identity / team / energy / walk | `act_darkMage.txt:3–19` | `archetypes.ts:303–363` | ✓ CORRECT |
| Weapon → darkBlast magic | `act_darkMage.txt:20` | `archetypes.ts:169–175` | ✓ CORRECT |
| Magic attack classification (ranged AI) | `act_darkBlast.txt:9` | `archetypes.ts:183–184` | ✓ CORRECT |
| Spellcaster AI (dodgesBullets, runReload) | `objAiCPUSpellCaster.txt:20–36` | `archetypes.ts:237–240` | ✓ CORRECT |
| Bullet-tangent dodge (updateMoveToOptimumPosition) | `objAiCPUSpellCaster.txt:275–297` | `control.ts` optimumPosition | ✓ CORRECT |
| Post-attack → optimumPosition | `objAiCPUSpellCaster.txt:54–55` | `control.ts:699–704` | ✓ CORRECT |
| Charge max=15 (mana-scaled) | `modAttack.txt:83–118` + `act_darkBlast.txt:14–16` | `charge.ts` via `chargeMaxOf` | ✓ CORRECT |
| Effective cooldown ≈33 frames | `act_darkBlast.txt:19` + `act_darkMage.txt:9` | `archetypes.ts:194–207` | ✓ CORRECT |
| Spell spawns + flies + explodes | `casts/script_objects/objSpell.txt` lifecycle | `systems/spells.ts` + `spellActor.ts` | ✓ CORRECT |
| Spell kills player (radial damage) | `objSpell.txt:145–161` impactAttack | `spellActor.ts:117–147` resolveSplash | ✓ CORRECT (player died frame 28) |
| Cast strip = "release" (not fallback "stand") | `objAiAttack.txt:127` ensureMode(#release) | `control.ts:544–549` | ✓ CORRECT |
| Death → grave | `modGrave.txt` | `components/grave.ts` | ✓ CORRECT |
| **Multi-frame charge phase + `darkMage_charge` anim** | `objAiAttack.txt:126–142` | `control.ts:807–818` (instant) | **DIV-1: MISSING** |
| **Charge orb grows over head (per-frame setCharge)** | `objAiAttack.txt:127` ensureMode(#charge) | never entered by CpuAI | **DIV-1: MISSING** |

---

`darkMage | DIVERGENCES=1`

DIV-1: CPU magic caster skips multi-frame charge ramp — `darkMage_charge` strip never plays, spell instant-releases in one frame. Fix: two-phase attack in `CpuAI` (charge-ramp returning `animAction="charge"`, then release returning `"release"`), matching `objAiAttack.chargeMagic/chargeSpell/#spellCharged/releaseMagic`.
