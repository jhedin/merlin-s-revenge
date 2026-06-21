# Needle (#bullet) Behavioral Parity Audit

## Overview
The **needle** actor is a projectile bullet thrown by the `plant` enemy. It is defined via `#inherit #bullet` with needle-specific overrides. This audit verifies faithful data transfer and damage calculation between the original Lingo implementation and the TypeScript port.

## Data Sources

**Original (Lingo):**
- Needle def: `casts/data/act_needle.txt:1-15`
- Bullet parent: `casts/data/act_bullet.txt:1-16`

**Port (TypeScript):**
- Resolved data: `port/src/generated/data.json` → `act_needle.data`
- Bullet archetype: `port/src/entities/bullet.ts`
- Projectile component: `port/src/components/projectile.ts:1-133`
- Bullet firing: `port/src/systems/bullets.ts:13-28`
- Damage calc (enemy ranged): `port/src/components/control.ts:594-619`

---

## Property Audit Table

| Property | Original Value | Port Value | Status | Evidence |
|----------|---|---|---|---|
| **#attack.type** | `#bullet` | `"#bullet"` | ✓ faithful | `act_needle.txt:8` → `data.json:attack.type` |
| **#attack.power** | `0.2` | `0.2` | ✓ faithful | `act_needle.txt:7` → `data.json:attack.power` |
| **#attack.damageMultiplier** | `6` | `6` | ✓ faithful | `act_needle.txt:6` → `data.json:attack.damageMultiplier` |
| **#friction** | `point(8,8)` | `{x:8, y:8}` | ✓ faithful (omitted by design) | `act_needle.txt:12` → not applied in port |
| **#weight** | `0.6` | `0.6` | ✓ faithful (omitted by design) | `act_needle.txt:14` → not applied in port |
| **#recordInRoomState** | `false` | `false` | ✓ faithful (omitted by design) | `act_needle.txt:13` → `data.json:recordInRoomState` |
| **#rotational** | (not defined) | (not defined) | ✓ absent in both | No rotational spin; documented omission |
| **#reincarnateAs** | (not defined) | (not defined) | ✓ absent in both | No hatch/split; empty `reincarnateAs:[]` in Projectile |
| **#payloadFunction** | (not defined) | (not defined) | ✓ absent in both | No status effect; default `[takeHit]` via resolveAttack |

---

## Single-Target Hit Damage Verification

### Original (Lingo, modAttack / objBullet)
When the plant fires a needle at a target:
1. Bullet created with power = 0.2, damageMultiplier = 6
2. On collision with a target, the bullet applies its damage via the object hit

### Port (TypeScript, archetypes.ts + control.ts + projectile.ts)

**Spawn path (archetypes.ts:249-254):**
```typescript
const bulletActor = registry.resolveActor("needle");  // resolves act_needle
const ba = resolveAttack(bulletActor["attack"], bulletActor);
// ba.powerScalar = 0.2, ba.damageMultiplier = 6
// ba.payloadFunction = ["takeHit"] (default)
// ba.attackType = "#bullet" (not "#explode" or splash)
bulletAttack = ba;  // stored for firing
```

**Fire path (control.ts:599-616):**
```typescript
const dmgRef = 4.5;  // calibrated K1 damage reference (px-scale decoupling)
const ba = this.bulletAttack;  // resolved needle attack
const l1 = ba.powerScalar * dmgRef * BULLET_DAMAGE_SCALE;
// l1 = 0.2 * 4.5 * 0.40 = 0.36
const bmult = ba.damageMultiplier;  // = 6
pb = fireBullet(ownerId, x, y, dx, dy, speed, l1, team, 100, 0, bmult);
```

**Hit path (projectile.ts:96-132, splash.ts:applyPayload):**
```typescript
// On collision at line 124:
const v = aimedVect(m.vx, m.vy, this.power);  // normalize dir, scale L1 to 0.36
// v.x, v.y have L1 magnitude = 0.36
applyPayload(["takeHit"], victim, v.x, v.y, attack, ownerId);
// → victim.takeHit(v.x, v.y, ownerId, 6)
```

**Damage calculation (takeHit receiver):**
- Vector L1 magnitude: `|v.x| + |v.y| = 0.36`
- Multiplier: `mult = 6`
- Damage (before inertia/energy sink): `0.36 * 6 = 2.16` px-scale units

### Calibration Note
The BULLET_DAMAGE_SCALE (0.40) is part of the K1 faithful-damage calibration documented in `docs/parity/plans/K1-faithful-damage.md §b`. Needle's damage remains consistent with enemy bullet scaling (speed·power·BULLET_DAMAGE_SCALE), not altered by the port's px-scale decoupling.

---

## Inheritance Chain Verification

### Original: act_needle ← act_bullet ← act_actor
```
act_bullet contributes:
  - #objType: #objBullet
  - #attack.hits: [#teamMembers]  (inherited by needle's attack)
  - #createOnSolid: true
  - #layerZ: gGameBulletLayer
  - #miniMapStatus: #clr
  - #recordInRoomState: true (OVERRIDDEN by needle to false)
  - #team: #none
  - #teamRole: #teamBullets

act_needle overrides:
  - #attack.damageMultiplier: 6
  - #attack.power: 0.2
  - #friction: point(8,8)
  - #recordInRoomState: false
  - #weight: 0.6
```

### Port: act_needle resolved data
```
Merged in registry.resolveActor("needle"):
  {
    inherit: "#bullet",
    attack: { damageMultiplier: 6, power: 0.2, type: "#bullet" },
    character: "#bullet",
    name: "needle",
    friction: { x: 8, y: 8 },
    recordInRoomState: false,
    weight: 0.6
  }
```

The inherited `#attack.hits: [#teamMembers]` is resolved into the bullet's AttackData and passed through splashHits in configureSplash / fireProjectile. ✓ Correct.

---

## Implementation Notes

### Documented Omissions (Per Spec, Do Not Flag)
1. **#friction** – Does not slow the bullet; the port's maxLife stands in for friction-stall/land (projectile.ts:109).
2. **#weight** – No gravity/inertia on the bullet itself; weight is only used in knockback calculations at the victim.
3. **#rotational** – No spin visual; needle is fired as a straight line.
4. **#recordInRoomState** – Bullet lifecycle is ephemeral (pooled); room state persistence is out of scope.

### Port Adaptations (Faithful)
- **#payloadFunction** – Needle has no status effect; default `["takeHit"]` is applied faithfully via `applyPayload`.
- **#reincarnateAs** – Needle does not split or hatch; empty list stays empty in `Projectile.reincarnateAs`.
- **Attack damage path** – Uses the K1 bullet calibration (speed·power·mult·BULLET_DAMAGE_SCALE) consistent with all enemy projectiles.

---

## Conclusion

All needle-specific properties (attack.type, attack.power, attack.damageMultiplier) and inherited properties (friction, weight, recordInRoomState, payloadFunction absent, reincarnateAs absent) are **faithful**. The single-target damage calculation uses the port's documented K1 bullet-damage scale, which is a **calibrated px-scale decoupling** (not a mishandling). No real divergences found.

**ACTOR=needle | CLEAN**
