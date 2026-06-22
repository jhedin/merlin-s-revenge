# Behavioral Audit: act_frostyMonk

**Actor:** frostyMonk — #objCPUCharacter, AiType #objAiCPU, #inherit #CPUCharacter
**Class:** Ranged freeze-caster (throws #freezeSticks → #freezeBlast splash bullet w/ #takeFreeze)
**Sibling for context:** thunderMonk (identical chassis, team #magicalAlliance, #thunderSticks → #thunderBlast — NO freeze)
**Method:** Behavior DERIVED from original cast/data, then REPRODUCED in the port (vitest harness loading the real `@/generated/assets.json` bundle; spawnEnemy("frostyMonk") vs a player target; 250-frame tick; observed shots / bullet / freeze / cadence / kiting / strips). Probe file deleted after the run.

---

## SECTION 1 — Derived-correct behavior (ORIGINAL)

Source: `casts/data/act_frostyMonk.txt`, `act_freezeSticks.txt`, `act_freezeBlast.txt`, `act_CPUCharacter.txt`, `act_character.txt`, `act_bullet.txt`; `casts/script_objects/objAiCPU.txt`, `modAttack.txt`, `modFreeze.txt`, `objCPUCharacter.txt`.

| Property | Original (file:line) | Derived behavior |
|----------|----------------------|------------------|
| objType / AiType | act_frostyMonk:3-4 | #objCPUCharacter, #objAiCPU (plain CPU FSM — NOT spellcaster, NOT bomber) |
| team | act_frostyMonk:15 | #ice (thunderMonk = #magicalAlliance) |
| energy | act_frostyMonk:9 | 150 |
| walkSpeed / walkType | act_frostyMonk:17, act_CPUCharacter:7-8 | 4, #anyDirSpeed (pathfinding true) |
| strength | act_frostyMonk:14 | 10 — drives #fullstrength throw velocity |
| dexterity | act_frostyMonk:7 | 10 — ranged cooldown-counter inc |
| eyestrain | act_frostyMonk:11 | 50 — aim scatter |
| dieSound | act_frostyMonk:8 | #none |
| weapon | act_frostyMonk:18 | #freezeSticks |
| **attack.animType** | act_freezeSticks:8 | **#weaponRanged** → ranged FSM (moveToAttack→fire), plays the `_weaponRanged` strip |
| **attack.animframe** | act_freezeSticks:7 | **13** (single integer, NOT a list) → fires ONE bullet per attack cycle on strip frame 13 (modAttack.isOnAttackFrame:597-611) |
| attack.bullet | act_freezeSticks:9 | #freezeBlast |
| attack.firingType | act_freezeSticks:12 | #fullstrength → throwVect speed = strength(10) (modAttack:753-771) |
| attack.reach | act_freezeSticks:14 | 300 (GeomDistSqr threshold — targetInReachRanged, objAiCPU:407-412) |
| attack.cooldown | act_freezeSticks:11 | 0 → can re-fire as soon as the attack strip completes |
| **bullet type** | act_freezeBlast:10 (`#type:#explode`) | **#explode** → AREA/splash resolution on land/collide, not single-target |
| **bullet payload** | act_freezeBlast:9 | **[#takeFreeze, #takeHit]** — freezes AND damages every hostile in the disc |
| bullet power | act_freezeBlast:8 | 0.25 (low — this is a control/CC weapon, not a damage weapon) |
| **freezeMultiplier** | act_freezeBlast:11 | **3** → freezeTime = (|vx|+|vy|)·3·4 ticks (modFreeze.takeFreeze:85-87); 0.5× speed while frozen |
| glowTeal | act_freezeBlast:8 | true → teal status overlay on freeze (modFreeze:77-80) |
| explodeEvents | act_freezeBlast:15-20 | arrivedAtTargetLoc / collidedWithTarget / landed |
| friction / weight | act_freezeBlast:22,24 | point(3,3) / 0.4 |
| **runReload (kiting)** | objCPUCharacter:30 default false; frostyMonk sets none | **NO kiting** — frostyMonk is a plain #objAiCPU (not spellcaster), so it stands and fires; getRunReload()=false (objAiCPU.attackFin:53) |
| faceTarget | objAiCPU.attack:33-39 | weaponRanged attackType ≠ #magic → it DOES faceTarget before firing |
| death / grave | dieSound #none; CPUCharacter chain | reel → die → grave (no death sound, no reincarnate) |

**Derived summary:** A plain ranged CPU that walks to within reach 300 of its nearest hostile, faces it, and throws ONE freezeBlast per attack cycle (firing on strip frame 13). The freezeBlast is an EXPLODE/splash bullet that on impact freezes (mult 3, 0.5× speed, teal glow) + lightly damages every hostile in its radius. No kiting, no special death mechanics.

---

## SECTION 2 — Reproduced behavior (PORT, OBSERVED)

Harness: real `assets.json` bundle, `spawnEnemy("frostyMonk", 300,300)` vs `spawnPlayer(500,300)` (200 px, inside reach 300), CollisionGrid(80,80,32), unitMap.configure(32,0,0), rebuildCombatSubstrate each tick, 250 frames.

| Observation | Result |
|-------------|--------|
| Resolved weapon attack | animType `#weaponRanged`, type `ranged`, animFrame `[13]`, bullet `#freezeBlast`, reach `300`, firingType `#fullstrength` |
| `animframe` (lowercase) parsing | **Read correctly as [13]** — resolveAttack reads `r["animframe"] ?? r["animFrame"]` (weapon.ts:181), so the lowercase data key is NOT dropped despite STRUCT_ATTACK using camelCase |
| Anim char / strips | char=`frostyMonk`; `frostyMonk_walk`(6f), `_stand`(1f), `_reel`(2f), `_grave`(2f), **`_weaponRanged`(15f)** — ALL resolve to real bundled strips (frame 13 exists in the 15-frame attack strip) |
| Bullet strips | `freezeBlast_fly` OK, `freezeBlast_explode` OK, `freezeBlast_land` **MISSING** (faithful — original freezeBlast ships no land strip; thunderBlast does) |
| FSM after 1 tick | aiMode `moveToAttack`, committed to the player target |
| **Shots over 250f** | **5 bullets, all `freezeBlast`, all splash (0 plain)** → exactly 1 per attack cycle |
| Fired bullet payload | char=`freezeBlast`, splash=true, attack.type=`#explode`, **payloadFunction=[takeFreeze, takeHit]**, **freezeMultiplier=3**, **glowTeal=true**, power=0.25, splashHits=[#teamMembers], splashAllegiance=#enemy |
| Cadence | shots at frames 36,79,122,165,208 → steady **43-frame gap** (= ~15-frame strip × dela 3 + recovery; cooldown 0 means anim-length-gated) |
| Freeze effect | target frozen **110 of 250 ticks** (takeFreeze applied via splash→applyPayload) |
| Damage | target energy 200 → 183.5 (low, as expected for a CC weapon, power 0.25) |
| Kiting | monk stayed at (300,300) the whole run — **NO kiting** (matches derived: runReload false for plain #objAiCPU) |
| Facing | bullets reached/froze the target → aimed/faced correctly |
| Death | energy 0 → isDead true |

---

## SECTION 3 — Comparison & divergences

| Aspect | Derived (original) | Observed (port) | Verdict |
|--------|--------------------|-----------------|---------|
| FSM / AiType | plain #objAiCPU, ranged | ranged moveToAttack→fire | ✓ Faithful |
| #animframe → shots/cycle | 1 (frame 13, scalar) | 1 splash bullet/cycle | ✓ Faithful |
| `#animframe` lowercase key | freezeSticks uses lowercase | parsed (weapon.ts:181) | ✓ Faithful (no dropped key) |
| Bullet | #freezeBlast, #explode/splash | splash bullet, type #explode | ✓ Faithful |
| Freeze payload | [#takeFreeze,#takeHit], mult 3, glowTeal | applied via splash→applyPayload; mult 3, teal | ✓ Faithful (target froze) |
| firingType / velocity | #fullstrength = strength 10 | #fullstrength throw | ✓ Faithful |
| reach 300 | GeomDist < 300 | reachRanged 300 (< cap 644) | ✓ Faithful |
| runReload (kiting) | false → stand & fire | no movement away | ✓ Faithful |
| Strips | walk/stand/reel/grave/weaponRanged + freezeBlast fly/explode | all resolve, none fall back | ✓ Faithful |
| freezeBlast land strip | absent in original | MISSING (no fallback used) | ✓ Faithful original quirk |
| cadence | anim-gated (cooldown 0) | 43-frame steady | ✓ Faithful approximation |

### DIVERGENCES: 0

No PORT bugs found. Every action resolves to a real bundled strip, the shot count per `#animframe` is correct (1), the freeze bullet carries the right explode/[takeFreeze,takeHit]/mult-3/teal payload and actually freezes the target, cadence is steady, and the monk correctly does NOT kite.

### Notes (candidate original-game quirks — NOT to "fix")
- **freezeBlast has no `_land` strip** (only `_fly` + `_explode`); thunderBlast has `_land`. This is in the original cast — the explode strip stands in. Faithfully reproduced (no fallback fired).
- **getCurrentAttack() returns mult 1 / [takeHit] / glowTeal false** for the WEAPON (freezeSticks) attack — the freeze payload lives on the BULLET (freezeBlast), resolved separately as the `splashBullet` AttackData (archetypes.ts:283-284). This is correct layering, not a divergence; the bullet's resolved attack carries mult 3 / [takeFreeze,takeHit] / glowTeal true (verified at the fired bullet).

### Documentation nit (not a bug)
- control.ts:849-858 comment describes routing freezeBlast's #takeFreeze through the **plain-bullet** `else` (`fireBulletPayload`) branch. In practice freezeBlast is `#type:#explode`, so archetypes.ts:284 classifies it as `splashBullet`, and it fires via `fireSplashBullet` (the splash branch, control.ts:801) — the freeze is applied through `resolveSplash → applyPayload`, not the plain-bullet path. Behavior is correct; only the inline comment's example is slightly misleading.

---

## Summary

frostyMonk is a **faithful ranged freeze-caster**. Reproduction confirms: 1 freezeBlast splash bullet per attack cycle (animframe 13), correct #explode/[takeFreeze,takeHit]/freezeMultiplier-3/glowTeal payload that freezes the target (110/250 ticks), steady anim-gated cadence, no kiting (plain #objAiCPU), all sprite strips bundled and resolving with no fallback. The lowercase `#animframe` data key is handled. thunderMonk shares the identical chassis minus the freeze (thunderBlast carries no payload/freeze).

**Status: CLEAN — 0 divergences.**
