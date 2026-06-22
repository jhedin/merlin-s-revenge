# Actor Audit: act_techMech

**Audit Date:** 2026-06-22
**Method:** REPRODUCED — probe (`tools/_audit_techMech.ts`, now deleted) loaded the real
`src/generated/assets.json`, spawned techMech via `spawnEnemy` with a live hostile target, ticked
~200 frames + per-attack-cycle windows, and observed Anim/CpuAI/WeaponManager/Projectile/Energy live.
**Original Spec:** `casts/data/act_techMech.txt` + inherit chain (`#CPUCharacter` → `#character` →
`#actor`), `casts/data/act_laserBeam.txt` (weapon), `casts/data/act_energyBeam.txt` (bullet),
`casts/script_objects/objAiAttack.txt` (`performAttack` beam dispatch), `casts/script_objects/modAttack.txt`
(`performBeamAttack`), `casts/script_objects/objBullet.txt` (`setBeam`),
`casts/script_objects/modWeaponTechnique.txt`.

---

## 1. What techMech IS and SHOULD do (derived from original)

**Identity / team**

| Field | Value | Source |
|-------|-------|--------|
| `#name` (sprite char) | "techMech" | act_techMech.txt:15 |
| `#team` | `#magicalAlliance` | act_techMech.txt:14 |
| `#AiType` | `#objAiCPU` (committed-target FSM) | act_techMech.txt:4 |
| `#objType` | `#objCPUCharacter` | act_techMech.txt:3 |
| `#inherit` | `#CPUCharacter` → `#character` → `#actor` | act_techMech.txt:5 |

**Stats**

| Field | Value | Source |
|-------|-------|--------|
| `#energy` | 100 | act_techMech.txt:9 |
| `#strength` | 5 | act_techMech.txt:13 |
| `#dexterity` | 10 (ranged cooldown recovery inc) | act_techMech.txt:7 |
| `#walkSpeed` | 2 (engine units) | act_techMech.txt:16 |
| `#inertia` | 45 (knockback resistance) | act_techMech.txt:11 |
| `#damageSpeed` | 3 (wall-slam bonus-damage threshold) | act_techMech.txt:6 |
| `#weaponTechnique` | 20 (positive → SPEEDS UP the attack anim) | act_techMech.txt:18 |
| `#experienceImWorth` | 10 | act_techMech.txt:10 |
| `#startingLevel` | 0 | act_techMech.txt:12 |

**Animation strips (all present in `assets.json` — NO blackOrc fallback):**

| Strip | Frames |
|-------|--------|
| `techMech_stand` | 1 |
| `techMech_walk` | 3 |
| `techMech_weaponRanged` | 6 (attack strip) |
| `techMech_grave` | 2 |
| `techMech_reel` | 2 |

**Weapon: `#laserBeam` → `act_laserBeam.txt` (a BEAM attack, not a travelling bullet)**

| Field | Value | Source |
|-------|-------|--------|
| `#animType` | `#weaponRanged` | act_laserBeam.txt:8 |
| `#animframe` | `[3,4,5]` → fires once per FRESH crossing → **up to 3 beams per attack cycle** | act_laserBeam.txt:7 |
| `#beam` | `true` | act_laserBeam.txt:14 |
| `#bullet` | `#energyBeam` | act_laserBeam.txt:9 |
| `#reach` | 150 px | act_laserBeam.txt:16 |
| `#cooldown` | 30 | act_laserBeam.txt:12 |
| `#firingType` | `#fullstrength` | act_laserBeam.txt:12 |
| `#collisionLoc` | `point(4,0)` (muzzle) | act_laserBeam.txt:10 |
| `#power` | 0.75 | act_laserBeam.txt:15 |
| `#accurate` | true | act_laserBeam.txt:17 |
| `#sound` | `#none` | act_laserBeam.txt:18 |
| `#targetRoles` | `[[#teamMembers, #teamBuildings]]` | act_laserBeam.txt:19 |

**Bullet/payload: `#energyBeam` → `act_energyBeam.txt`**

| Field | Value | Source |
|-------|-------|--------|
| `#inherit` | `#bullet` (sprite char = "energyBeam") | act_energyBeam.txt:3 |
| `#beam` | `true` | act_energyBeam.txt:23 |
| `#attack.type` | `#explode` (detonates on arrival → AREA hit) | act_energyBeam.txt:10 |
| `#attack.power` | 0.25 | act_energyBeam.txt:9 |
| `#attack.damageMultiplier` | 10 | act_energyBeam.txt:6 |
| `#attack.hits` | `[#teamMembers, #teamBuildings]` | act_energyBeam.txt:7 |
| `#explodeSound` | "spell_release" | act_energyBeam.txt:19 |
| `#friction` | point(0,0), `#weight` 0 | act_energyBeam.txt:24-25 |

**Beam mechanic (the load-bearing behavior):**
- `objAiAttack.performAttack` (objAiAttack.txt:308–312, inherited by objAiCPU): for `#ranged` +
  `#beam:true` → calls `me.big.performBeamAttack()` (NOT `performRangedAttack`).
- `modAttack.performBeamAttack` (modAttack.txt:623–718): spawns the `energyBeam` bullet **AT the
  target loc** (`params.startLoc = targetLoc`) with `params.initVect = point(0,0)` (stationary — NOT a
  travelling projectile), jittered ±10px (`random(20)-10`). It binds the bullet to `#target`
  (`setTarget`) so the hit is guaranteed, then `setBeam(distToTargetScale, distXY)`.
- `objBullet.setBeam` (objBullet.txt:239–246): stretches the sprite width to the caster→target
  distance and rotates it to `GeomAngle(distXY)` — the visual "instant laser line".
- The bullet's `#explode` `#attack` detonates at the target on the first frame → an INSTANT hit, not a
  bullet that flies and lands.

---

## 2. Derive vs. REPRODUCED table

Every row was verified live by spawning techMech and ticking the port.

| Property | Expected (original) | REPRODUCED (port) | Match? |
|----------|---------------------|-------------------|--------|
| `#name` sprite char | "techMech" | "techMech" (NOT blackOrc) | ✓ |
| all 5 anim strips present | stand/walk/weaponRanged/grave/reel | all found in assets.json | ✓ |
| `team` | `#magicalAlliance` | `#magicalAlliance` | ✓ |
| `AiType` | `#objAiCPU` (committed FSM) | findTarget→moveToAttack observed | ✓ |
| `energy` | 100 | 100 | ✓ |
| `maxSpeed` (walkSpeed×0.6) | 2 → 1.2 px/tick | 1.2 | ✓ |
| `strength` | 5 | 5 | ✓ |
| `dexterity` | 10 | 10 (cooldown inc) | ✓ |
| `inertia` | 45 | 45 | ✓ |
| `damageSpeed` | 3 | 3 | ✓ |
| `weaponTechnique` | 20 (attack-anim speedup) | 20 (WeaponTechnique.technique) | ✓ |
| `ranged` | true (`#weaponRanged`) | true | ✓ |
| `reachRanged` | 150 | 150 | ✓ |
| attack `#beam` | true | `getCurrentAttack().beam === true` | ✓ |
| fires a BEAM (instant, at target) | yes — spawned AT target loc, stationary | beam bullets at x≈460, **vx=vy=0** | ✓ |
| travelling bullets fired | none | **0** travelling bullets observed | ✓ |
| `#animframe` | `[3,4,5]` | `attackFrames = [3,4,5]` during attack | ✓ |
| beams per attack cycle | up to 3 (fresh crossing each frame) | **[3,3,3,3]** (3 per cycle) | ✓ |
| `firingType` | `#fullstrength` | `#fullstrength` | ✓ |
| `bullet` | `#energyBeam` (`#explode`) | `splashBullet.attackType = #explode` | ✓ |
| bullet sprite char | "energyBeam" | "energyBeam" | ✓ |
| beam damage applied on hit | power 0.25 × mult 10 (area `resolveSplash`) | ~21.8 dmg/hit applied to victim | ✓ |
| beam `hits` | `[#teamMembers, #teamBuildings]` | `splashBullet.hits` = same | ✓ |
| death | `#die` → dead, no fallback char | isDead=true, char stays "techMech" | ✓ |
| grave | `techMech_grave` strip | present, resolved | ✓ |
| target acquisition | hunts a hostile (player side) | acquired + attacked target | ✓ |

---

## 3. DIVERGENCES

**None (real port bugs).**

A prior thin audit claimed "CPU beam attacks not executed — techMech fired a travelling bullet — FIXED."
This reproduction **confirms the fix holds**: techMech fires INSTANT beams spawned at the target loc
with zero velocity (`vx=vy=0`), 3 per attack cycle per `#animframe [3,4,5]`, never a travelling bullet.
The earlier "0 beam / 10 travelling" reading in this audit's first pass was a **probe artifact** (an ESM
`require()` for the Projectile class failed silently, mis-flagging every beam as non-beam); after
switching to a top-level import the count was 10/10 beams, 0 travelling — i.e. the port is correct, the
probe was wrong. (Probe-API FAIL, not a port divergence — verified before reporting, as instructed.)

### Candidate ORIGINAL-GAME / documented-deviation notes (NOT bugs, do NOT "fix")

**N-1 — Beam aim jitter clamped ±6 (port) vs ±10 (original).**
- **Original** (`casts/script_objects/modAttack.txt:632–636`): `modx/mody = random(20)-10` → ±10px
  scatter on the beam target loc, but the bullet is then **bound to its `#target`** via
  `bulletObj.setTarget(...)` (objBullet.txt:248), so the explode still resolves on the target regardless
  of the visual jitter.
- **Port** (`port/src/systems/bullets.ts:78`): jitter clamped to ±6px because the port's area model has
  no `#target`-binding — the beam relies on the `resolveSplash` disc catching the target, so the jitter
  is kept inside the hit range. Explicitly documented in-code (plan §g.2). Faithful intent, deliberate
  abstraction; no gameplay divergence (the hit still lands — verified, ~21.8 dmg applied).

**N-2 — Beam damage is a calibrated area-resolve (`resolveSplash`), not the original's
direct-takeHit + payload double-application.**
- **Original** `objBullet.updateFly` applies the collision vector takeHit AND iterates the
  `payloadFunction` ([#takeHit]) — a known original double-damage path. The port routes the energyBeam's
  `#explode` `#attack` through `resolveSplash` once (power 0.25 × mult 10 at the area scale). This is the
  port-wide bullet-damage abstraction (same as every other actor); kept stable so balance/tests don't
  shift. Documented; consistent with the rest of the port. Not a techMech-specific divergence.

---

## Summary

techMech is **faithfully reproduced**. The anim char resolves to its real bundled `techMech_*` strips
(no blackOrc fallback), it fires an **instant stretched BEAM at the target** (spawned at target loc,
vx=vy=0, NOT a travelling bullet), **3 beams per attack cycle** matching `#animframe [3,4,5]`, beam
`#explode` damage (power 0.25 × mult 10) lands on the target (~21.8/hit), reach 150, team
`#magicalAlliance`, and all forwarded stats (energy 100, walkSpeed→1.2, strength 5, dexterity 10,
inertia 45, damageSpeed 3, weaponTechnique 20) match the data. Death + grave resolve correctly.
The two notes above are documented port-wide abstractions, not techMech bugs.
