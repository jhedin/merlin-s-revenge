# LASER Bullet Actor Parity Audit

## Overview

**Bullet**: laser (thrown by quadranid)  
**Category**: plain, single-target bullet (attack.type: #bullet)  
**Original**: casts/data/act_laser.txt (+inherit act_bullet.txt)  
**Port Data**: port/src/generated/data.json → act_laser  
**Port Behavior**: port/src/components/control.ts:601–616, port/src/systems/bullets.ts, port/src/components/projectile.ts

---

## Data Audit Table

| Property | Original | Port | Match | Notes |
|----------|----------|------|-------|-------|
| #inherit | #bullet | #bullet | ✓ | Parent chain resolved |
| #attack.type | #bullet | #bullet | ✓ | Single-target routing confirmed |
| #attack.power | 0.3 | 0.3 | ✓ | Scalar, directly used as L1 magnitude |
| #attack.damageMultiplier | 10 | 10 | ✓ | Applied as mult in fireBullet |
| #attack.explodeCharge | N/A | N/A | ✓ | Not present (not #explode type) |
| #friction | point(3,3) | {x:3, y:3} | ✓ | Format change (point → object), value faithful |
| #weight | 0.4 | 0.4 | ✓ | Present and unchanged |
| #recordInRoomState | false | false | ✓ | Overrides parent's true |
| #rotational | N/A | N/A | — | Excluded (spec: don't flag) |
| #reincarnateAs | — | — | ✓ | Not present (no hatch behavior) |
| #payloadFunction | — | — | ✓ | Not present (no status effects) |
| #splashDamageOn | — | — | ✓ | Not present (plain bullet) |
| #explodeSound | — | — | ✓ | Not present (laser is #bullet, not #explode) |

---

## Behavioral Verification

### Firing Path (control.ts:601–616)

Laser is fired as a **plain bullet**:

```typescript
const ba = this.bulletAttack;                           // resolveAttack(laser.attack)
const l1 = ba.powerScalar * 4.5 * BULLET_DAMAGE_SCALE; // 0.3 * 4.5 * scale
const bmult = ba.damageMultiplier;                     // 10
const status = ba && (...takeFreeze || ...takeHeal);   // false (laser has none)
if (status && ba) { /* payload route */ }
else {
  pb = fireBullet(..., l1, team, 100, 0, bmult);       // plain bullet path
}
```

**Result**: Laser routes to `fireBullet()` (systems/bullets.ts:13–28) with:
- power L1 magnitude: 0.3 * 4.5 * BULLET_DAMAGE_SCALE
- mult (damageMultiplier): 10
- No payload/freeze
- No splash

### Collision Handling (projectile.ts:96–132)

On spawn:
```typescript
b.get(Projectile).configure(power, team, ownerId, maxLife, freeze, mult);
// this.splash = null (plain bullet configuration)
// this.payload = null
```

On collision (line 115–128):
```typescript
if (Math.abs(p.x - m.x) < 12 && Math.abs(p.y - m.y) < 12) {
  if (this.splash) { /* detonate */ }  // false for laser
  const v = aimedVect(m.vx, m.vy, this.power);
  if (this.payload) { /* payload */ }   // false for laser
  else {
    // SINGLE-TARGET TAKEHI T (plain bullet path):
    e.send("takeHit", v.x, v.y, this.ownerId, this.mult); // mult=10
    if (this.freeze > 0) e.send("takeFreeze", ...);       // false
  }
  this.finish(m.x, m.y);
  break;
}
```

**Result**: Laser hits a single target with:
- Collision vector: aimedVect (velocity scaled by power L1)
- Damage multiplier: 10
- No freeze/heal payload
- No reincarnate spawning

### Splash vs Single-Target Routing

Routing decision (archetypes.ts:249–253):

```typescript
if (ranged && typeof atk["bullet"] === "string") {
  const bulletActor = registry.resolveActor("laser");
  const ba = resolveAttack(bulletActor.attack, bulletActor);
  if (ba && (ba.attackType === "#explode" || ba.splashDamageOn)) {
    splashBullet = ba;  // laser: false (type is #bullet, not #explode)
  } else if (ba) {
    bulletAttack = ba;  // laser: routes here ✓
  }
}
```

**Confirmed**: Laser is **single-target**, not splash.

---

## Excluded Properties (Per Spec)

These properties are intentionally NOT flagged even if they differ:

- **audio/volume**: Not present in laser data
- **rotational**: Excluded (spec directive)
- **recordInRoomState**: Excluded (spec directive)
- **weight/gravity**: Present and faithful (excluded)
- **friction-stall vs maxLife**: friction is hard-coded to 1 in fireBullet, not data-driven (maxLife=100)
- **attack.collisionLoc**: Not in laser data
- **miniMapStatus**: Inherited from parent (excluded)
- **eyestrain**: Not in laser data
- **firingType**: Not in laser data (defaults to #proportional)
- **#explodeSound**: Not in laser data (laser is #bullet type)

---

## Conclusion

**LASER DATA PARITY**: All laser-specific properties are faithfully resolved and migrated to the port. The data.json entry matches the original Lingo definitions exactly (accounting for format changes like point → {x, y}).

**LASER BEHAVIORAL PARITY**: Laser fires as a plain, single-target bullet with power=0.3 and damageMultiplier=10, hitting via single-target takeHit on collision. The routing decision (plain vs splash) is correct. No splash detonation, no reincarnate spawning, no payload effects.

**VERDICT**:  
result: ACTOR=laser | CLEAN
