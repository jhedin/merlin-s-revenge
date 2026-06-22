# Behavioral Audit: act_thunderMonk

**Actor:** thunderMonk — #objCPUCharacter, AiType #objAiCPU, #inherit #CPUCharacter
**Class:** Ranged lightning-caster (throws #thunderSticks → #thunderBlast splash bullet, plain explode damage — NO freeze/status)
**Siblings for context:** frostyMonk (identical chassis, team #ice, #freezeSticks → #freezeBlast WITH #takeFreeze); monk (#objAiCPUSpellCaster, melee #stretchyPunch + #healBlast, team #aldevar).
**Method:** Behavior DERIVED from original cast/data, then REPRODUCED in the port — throwaway vite-node probe loading the REAL `@/generated/assets.json` bundle; `spawnEnemy("thunderMonk", 300,300)` vs a stationary player target at (480,300) (180 px, inside reach 300); CollisionGrid(80,80,32), unitMap.configure(32,0,0), rebuildCombatSubstrate each tick; 250 frames; observed anim-char resolution / shots / bullet+payload / cadence / kiting / strips / facing / death. Probe deleted after the run.

---

## SECTION 1 — Derived-correct behavior (ORIGINAL)

Source: `casts/data/act_thunderMonk.txt`, `act_thunderSticks.txt`, `act_thunderBlast.txt`, `act_bullet.txt`, `act_weapon.txt`, `act_monk.txt` (sibling), `act_freezeBlast.txt`/`act_freezeSticks.txt` (sibling contrast); `act_CPUCharacter.txt`, `act_character.txt`; `casts/script_objects/objAiCPU`, `modAttack`.

| Property | Original (file:line) | Derived behavior |
|----------|----------------------|------------------|
| objType / AiType | act_thunderMonk:3-4 | #objCPUCharacter, #objAiCPU (plain CPU FSM — NOT a spellcaster, unlike `monk` which is #objAiCPUSpellCaster) |
| team | act_thunderMonk:15 | #magicalAlliance (frostyMonk = #ice) |
| energy | act_thunderMonk:9 | 150 |
| walkSpeed | act_thunderMonk:17 | 4 |
| strength | act_thunderMonk:14 | 10 — drives #fullstrength throw velocity |
| dexterity | act_thunderMonk:7 | 10 — ranged cooldown-counter inc |
| eyestrain | act_thunderMonk:11 | 50 — ranged aim scatter |
| inertia / damageSpeed | act_thunderMonk:12,6 | 50 / 3 |
| dieSound | act_thunderMonk:8 | #none (silent death) |
| weapon | act_thunderMonk:18 | #thunderSticks |
| has own #attack? | act_thunderMonk (none) | NO — uses the weapon's attack (contrast `monk` which has a melee #stretchyPunch) |
| **attack.animType** | act_thunderSticks:8 | **#weaponRanged** → ranged FSM (moveToAttack→face→fire), plays `_weaponRanged` strip |
| **attack.animframe** | act_thunderSticks:7 | **13** (single integer, NOT a list) → fires ONE bullet per attack cycle on strip frame 13 |
| attack.bullet | act_thunderSticks:9 | #thunderBlast |
| attack.firingType | act_thunderSticks:12 | #fullstrength → throw speed = strength(10), constant |
| attack.reach | act_thunderSticks:14 | 300 (GeomDist threshold) |
| attack.cooldown | act_thunderSticks:11 | 0 → anim-length-gated re-fire |
| attack.collisionLoc | act_thunderSticks:10 | point(0,-2) (muzzle) |
| attack.sound | act_thunderSticks:15 | #none |
| **bullet type** | act_thunderBlast:8 (`#type:#explode`) | **#explode** → AREA/splash resolution on land/collide |
| bullet power | act_thunderBlast:7 | 0.5 (radial falloff scale) |
| bullet explodeCharge | act_thunderBlast:6 | 100 → splash radius = explodeCharge/2 = 50 px |
| **bullet payload** | act_thunderBlast (NONE) | **plain #takeHit only** — NO #payloadFunction override → struct default `[#takeHit]`. (Contrast freezeBlast:9 `[#takeFreeze,#takeHit]`.) **NO freeze, NO glowTeal** (freezeBlast:8 sets glowTeal; thunderBlast does not.) |
| explodeSound | act_thunderBlast:18 | "spell_explode" |
| explodeEvents | act_thunderBlast:12-17 | arrivedAtTargetLoc / collidedWithTarget / landed |
| friction / weight | act_thunderBlast:19,21 | point(3,3) / 0.4 |
| **runReload (kiting)** | act_thunderMonk (unset) → false | **NO kiting** — plain #objAiCPU, weapon is #weaponRanged (not #magic), not spellcaster → stands and fires |
| faceTarget | objAiCPU (weaponRanged ≠ #magic) | DOES faceTarget before firing |
| **data #name sprite char** | act_thunderMonk:16 | **"thunderMonk"** → `thunderMonk_*` strips |
| death / grave | dieSound #none; CPUCharacter chain | reel → die → grave (silent, no reincarnate) |

**Derived summary:** A plain ranged CPU on team #magicalAlliance that walks to within reach 300 of its nearest hostile, faces it, and throws ONE thunderBlast per attack cycle (firing on strip frame 13). thunderBlast is an EXPLODE/splash bullet (radius 50) that on impact deals plain area damage (`[#takeHit]`, power 0.5 radial falloff) to every hostile in the disc — NO freeze, NO status, NO teal glow (this is the ONLY behavioral difference from frostyMonk). No kiting, no special death mechanics.

---

## SECTION 2 — Reproduced behavior (PORT, OBSERVED)

Harness: real `assets.json` bundle (617 anims), `spawnEnemy("thunderMonk",300,300)` vs stationary `spawnPlayer(480,300)` (180 px, inside reach 300), CollisionGrid(80,80,32), unitMap.configure(32,0,0), rebuildCombatSubstrate + monk.update each tick, 250 frames.

| Observation | Result |
|-------------|--------|
| team / energy | `#magicalAlliance` / `150` |
| **anim.char** | **`thunderMonk`** — resolves to the real bundled strip (`thunderMonk_stand` exists); `anim.char == blackOrc` → **false** (NO fallback) |
| Resolved weapon attack | name `#thunderSticks`, type `ranged`, animType `#weaponRanged`, **animFrame `[13]`**, bullet `#thunderBlast`, firingType `#fullstrength`, reach `300` |
| `animframe` (lowercase) parsing | read correctly as `[13]` despite the lowercase data key |
| ai.ranged / runReload(kite) / dodgesBullets | `true` / **`false`** / `false` |
| ai.reachRanged | **`300`** (NOT clamped — MAX_RANGED_REACH cap is 644; 300 < 644) |
| eyestrain / strength | `50` / `10` |
| splashBullet wired | `{attackType:#explode, explodeCharge:100, power:0.5, payload:[takeHit], freezeMult:1, glowTeal:false}` |
| bulletAttack (plain) | `null` (correct — the #explode bullet routes as splashBullet) |
| bulletChar | `thunderBlast` → `thunderBlast_fly` strip **present** |
| Strips (char `thunderMonk`) | `_stand`(1f), `_walk`(6f), **`_weaponRanged`(15f, delay 3)**, `_grave`(2f), `_reel`(2f) ALL present; `_charge`/`_release`/`_die` absent (not a spellcaster — correct) |
| FSM after 1 tick | aiMode `moveToAttack`, committed to the player target |
| **Shots over 250f** | **5 bullets, all `thunderBlast`, all splash (splash=true)** → exactly 1 per attack cycle |
| Fired bullet payload | char=`thunderBlast`, splash=true, attackType=`#explode`, **payload=`[takeHit]`**, **freezeMult=1**, **glowTeal absent**, power=0.5 |
| First bullet velocity | `(9.98, -0.57)` → speed `10.00` (= strength, #fullstrength) |
| Cadence | shots at frames 36,79,122,165,208 → steady **43-frame gap** (anim-length-gated; cooldown 0) |
| Damage | target energy 150 → 74.6 over 5 splash hits (≈15/hit at 180 px, radial falloff) — confirms splash actually lands |
| Freeze | NONE (no takeFreeze in payload) — correctly absent |
| Kiting | monk stayed at (300,300) the whole run; gap 180→180 — **NO kiting** |
| Facing | bullets reached/damaged the target → aimed/faced correctly |
| Death | energy 0 → isDead true |

---

## SECTION 3 — Comparison & divergences

| Aspect | Derived (original) | Observed (port) | Verdict |
|--------|--------------------|-----------------|---------|
| objType / AiType / FSM | plain #objAiCPU, ranged | ranged moveToAttack→fire | ✓ Faithful |
| team | #magicalAlliance | #magicalAlliance | ✓ Faithful |
| energy / strength / dexterity / eyestrain | 150 / 10 / 10 / 50 | 150 / 10 / 10 / 50 | ✓ Faithful |
| **anim char → strip** | thunderMonk_* | char=`thunderMonk`, real strips, NOT blackOrc | ✓ Faithful (no fallback) |
| #animframe → shots/cycle | 1 (frame 13, scalar) | 1 splash bullet/cycle | ✓ Faithful |
| `#animframe` lowercase key | thunderSticks uses lowercase | parsed as [13] | ✓ Faithful (no dropped key) |
| Bullet | #thunderBlast, #explode/splash | splash bullet, type #explode | ✓ Faithful |
| **Bullet payload** | `[#takeHit]` (struct default; NO freeze) | `[takeHit]`, freezeMult 1, glowTeal false | ✓ Faithful (correctly NO freeze, unlike frostyMonk) |
| bullet power / radius | 0.5 / explodeCharge 100 → r=50 | 0.5 / 100 | ✓ Faithful |
| firingType / velocity | #fullstrength = strength 10 | speed 10.00 | ✓ Faithful |
| reach 300 | GeomDist < 300 | reachRanged 300 (< cap 644) | ✓ Faithful |
| runReload (kiting) | false → stand & fire | no movement away (gap 180→180) | ✓ Faithful |
| Strips bundled | walk/stand/reel/grave/weaponRanged + thunderBlast fly/land/explode | all resolve, none fall back | ✓ Faithful |
| charge/release/die strips | absent (not a spellcaster) | absent | ✓ Faithful |
| cadence | anim-gated (cooldown 0) | 43-frame steady | ✓ Faithful approximation |
| facing / death | faces target; silent death | hit target; isDead on 0 energy | ✓ Faithful |

### DIVERGENCES: 0

No PORT bugs found. The anim char resolves to its real bundled `thunderMonk` strip (NOT blackOrc), the shot count per `#animframe` is correct (1 thunderBlast splash bullet per attack cycle), the bullet carries the right `#explode` / `[takeHit]` / power-0.5 payload with NO freeze (the correct difference from frostyMonk), it actually damages the target via splash, cadence is steady, reach is honored unclamped, and the monk correctly does NOT kite.

### Notes (candidate original-game quirks — NOT to "fix")

- **`#animframe` lowercase data key** (act_thunderSticks:7 `#animframe`, not `#animFrame`) — the port's resolveAttack reads both casings, so the single-integer 13 is not dropped (would otherwise default to a fallback frame and possibly fire 0 or many shots). Faithfully handled.
- **thunderBlast has no `#payloadFunction`** → it inherits the struct-attack default `[#takeHit]`. This is the faithful original: thunderBlast is a plain damage explosion. The teal-glow + `[#takeFreeze,#takeHit]` live only on the sibling **freezeBlast**. Correctly reproduced (port shows freezeMult 1 / glowTeal false / payload [takeHit]).

### Correction to the PRIOR audit (this file, superseded)

The previous thunderMonk audit (DIVERGENCES=0) reported **`reachRanged = 220` ("300 clamped")** and the shot at **t=37**. Both are stale/incorrect on re-run:
- The reach cap (`CpuAI.MAX_RANGED_REACH`) is **644**, not 220 — observed `reachRanged = 300` (unclamped). Conclusion (still 0 divergences) is unchanged but the value is corrected.
- First shot fires at **frame 36** (12 frame-advances × delay 3 = 36 elapsed ticks to reach 1-based frame 13), not 37.

---

## Summary

thunderMonk is a **faithful ranged lightning-caster** and the lightning twin of frostyMonk. Live reproduction (real assets bundle) confirms: anim char `thunderMonk` resolving to bundled strips (no blackOrc fallback), exactly 1 thunderBlast splash bullet per attack cycle (animframe 13), correct `#explode`/`[takeHit]`/power-0.5 payload that area-damages the target with **NO freeze/glow** (the sole, correct distinction from frostyMonk), throw speed 10 (#fullstrength=strength), steady 43-frame anim-gated cadence, reach 300 honored (well under the 644 cap), and no kiting (plain #objAiCPU). All strips bundled and resolving. The lowercase `#animframe` key is handled.

**Status: CLEAN — 0 divergences.**

thunderMonk | DIVERGENCES=0 | faithful #magicalAlliance ranged caster: char=thunderMonk (no blackOrc fallback), 1 thunderBlast splash/cycle @animframe 13, #explode/[takeHit] power-0.5 payload (NO freeze, correct vs frostyMonk), speed-10 #fullstrength, reach 300 unclamped, no kiting; prior audit's reachRanged=220/t=37 corrected to 300/t=36.
