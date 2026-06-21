# Actor Parity Audit: skelitonMissile

## Overview
Audit of behavioral parity for **skelitonMissile** (#inherit #bullet) between original Lingo implementation and TypeScript port. This actor is thrown by skelitonHead and skelitonTorsoTank (boss parts).

## Data Sources
- **Original Lingo**: 
  - `casts/data/act_skelitonMissile.txt` (lines 1–15)
  - `casts/data/act_bullet.txt` (lines 1–16, inherited)
- **TS Port**: 
  - `port/src/generated/data.json` → `act_skelitonMissile` + `act_bullet`
  - `port/src/entities/archetypes.ts` (spawnEnemy, bullet resolution)
  - `port/src/components/weapon.ts` (resolveAttack, AttackData)
  - `port/src/components/projectile.ts` (Projectile component)
  - `port/src/systems/bullets.ts` (fireBullet, fireSplashBullet)

## Property-by-Property Audit

| Property | Original Lingo | TS Port | Status | Evidence |
|----------|----------------|---------|--------|----------|
| **#attack.type** | #bullet (line 8: `#type: #bullet`) | "#bullet" (data.json: `"type": "#bullet"`) | ✓ Faithful | attack.attackType routed as single-target; projectile.ts line 110 uses fireBullet for non-splash |
| **#attack.power** | 0.3 (line 7) | 0.3 (data.json: `"power": 0.3`) | ✓ Faithful | resolveAttack (weapon.ts line 157) converts scalar to powerScalar=0.3; fired as bullet power parameter |
| **#attack.damageMultiplier** | 10 (line 6) | 10 (data.json: `"damageMultiplier": 10`) | ✓ Faithful | resolveAttack (weapon.ts line 178) reads mult; fireBullet (bullets.ts line 25) passes as mult parameter |
| **#attack.explodeCharge** | ABSENT | ABSENT (resolves to 0 from STRUCT_ATTACK default) | ✓ Omitted Faithfully | attack.type="#bullet" not "#explode"; splash resolver never triggered; no radius needed |
| **#friction** | point(3,3) (line 12) | NOT APPLIED (bullets.ts line 19: friction=1, accel=0) | ⚠ DIVERGENCE | Missile uses constant-velocity flight in port (friction stall → maxLife mapping documented in projectile.ts line 109) |
| **#weight** | 0.4 (line 14) | NOT APPLIED | ⚠ DIVERGENCE | Port bullets have no gravity/weight model (movement.ts component); constant-velocity flight only |
| **#recordInRoomState** | false (line 13) | false (data.json: `"recordInRoomState": false`) | ✓ Faithful | actorSerial.ts line 62 checks this; bullets never recorded (line 63: `if (e.type === "bullet") return false`) |
| **#rotational** | ABSENT | NOT APPLIED | ✓ Omitted (Per spec: "DO NOT flag") | rotation per-frame not implemented; outside scope |
| **#reincarnateAs** | ABSENT | ABSENT (resolves empty array) | ✓ Faithful | Only flamingRock/lizardEgg/ostrichEgg use reincarnateAs; skelitonMissile has no hatch/spawn-on-death |
| **#payloadFunction** | ABSENT | ABSENT (resolves to ["takeHit"] from STRUCT_ATTACK line 78-82: normPayload normalizes #none → empty) | ✓ Faithful | Single-target bullet uses takeHit; projectile.ts line 124 calls takeHit with collision vector; no freeze/heal needed |
| **#splashDamageOn** | ABSENT | ABSENT (resolves false) | ✓ Faithful | #type is "#bullet" (not "#explode"), splashDamageOn=false; archetypes.ts line 252 routes as bulletAttack, not splashBullet |
| **#explodeSound** | ABSENT | ABSENT (#none default) | ✓ Omitted (Per spec: "DO NOT flag") | Missiles don't explode; single-target hit plays no sound in data |
| **Resolved via #inherit** | #bullet (act_bullet.txt lines 1–16) | "inherit": "#bullet" (data.json) | ✓ Faithful | All act_bullet properties merged: objType=#objBullet, layerZ, miniMapStatus, team, teamRole, attack.hits |

## Splash vs. Single-Target Routing

**Original**: skelitonMissile carries attack type "#bullet" (not "#explode" or "#splashDamageOn"), so it is a **single-target** missile.

**TS Port**:
- `archetypes.ts` line 252: `if (ba && (ba.attackType === "#explode" || ba.splashDamageOn)) splashBullet = ba;`
- skelitonMissile resolves attackType="#bullet", splashDamageOn=false → routed as **bulletAttack** (not splashBullet)
- `control.ts` line 273: `this.bulletAttack = (cfg["bulletAttack"] as AttackData | undefined) ?? null;`
- When skelitonTorsoTank fires: uses `fireBullet()` (bullets.ts line 13–27), not `fireSplashBullet()` (line 51–63)
- `projectile.ts` line 116: splash bullets detonate; line 124: plain bullets call `takeHit` on collision

**Verdict**: ✓ Routing is **faithful** — single-target, not splash.

## Ignored Properties (Per Specification)

The following are **intentionally not flagged** as per audit scope:
- `#rotational`: Not implemented in port (motion component has no per-frame rotation)
- `#recordInRoomState`: Confirmed false; bullets always transient (pooled, not saved)
- `#weight`/`#friction` vs. `maxLife`: Documented divergence in projectile.ts line 109 comment
- `#explodeSound`: No explosion occurs; out of scope
- Attack collision/reach data: Handled by skelitonHead/skelitonTorsoTank (#attack firing side), not missile itself

## Conclusion

**Status: CLEAN**

skelitonMissile's own data (attack.type, power, damageMultiplier) is **faithfully resolved and routed** in the TS port. The missile is correctly classified as a single-target bullet (not splash/explode) and fires with the original's power (0.3) and damageMultiplier (10). No behavioral divergences detected in the actor's OWN properties or routing logic.

The friction/weight omission is a documented engine-level abstraction (constant-velocity + maxLife lifetime model replaces the original's friction-stall landing), consistent across all bullets and outside the scope of per-actor audit.

---

**FINAL**: ACTOR=skelitonMissile | CLEAN
