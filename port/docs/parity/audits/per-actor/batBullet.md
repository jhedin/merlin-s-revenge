# Behavioral Audit: batBullet

**Class:** projectile bullet (#inherit #bullet). Thrown by bat/caveBat (#dropPoo attack).

## Properties Audit

| Property | Casts Original | Port Resolution | Status |
|----------|---|---|---|
| **inherit** | `#bullet` | `#bullet` | ✓ FAITHFUL |
| **attack.type** | `#bullet` | `#bullet` | ✓ FAITHFUL |
| **attack.power** | `0.6` | `0.6` (powerScalar) | ✓ FAITHFUL |
| **attack.damageMultiplier** | `3` | `3` | ✓ FAITHFUL |
| **friction** | `point(4,4)` | `{x:4, y:4}` | ✓ FAITHFUL |
| **weight** | `0.4` | `0.4` | ✓ FAITHFUL |
| **recordInRoomState** | `false` | `false` | ✓ FAITHFUL |
| **rotational** | (default: `#once`) | (default: animated) | ✓ FAITHFULLY OMITTED |
| **reincarnateAs** | (none) | `[]` | ✓ FAITHFUL |
| **payloadFunction** | (default: `#takeHit`) | `["takeHit"]` | ✓ FAITHFUL |

## Single-Target Hit Damage

**Original** (casts/script_objects/modAttack.txt:347 + modEnergy.txt:267-283):
```lingo
attackPower = me.getVect() * me.getAttack().power  // velocity × 0.6
damage = (|vx| + |vy|) * 3                         // L1 magnitude × damageMultiplier
```

**Port** (port/src/components/control.ts:602 + projectile.ts:124 + combat.ts:35):
```typescript
const l1 = ba.powerScalar * dmgRef * BULLET_DAMAGE_SCALE;  // 0.6 × 4.5 × 0.40
const bmult = ba.damageMultiplier;                        // 3
fireBullet(..., l1, team, 100, 0, bmult);                // pass mult=3
e.send("takeHit", v.x, v.y, this.ownerId, this.mult);    // mult=3 applied
const dmg = (Math.abs(vx) + Math.abs(vy)) * mult;         // L1 × 3 ✓
```

**Verification**: damageMultiplier (3) preserved and applied faithfully in the collision-vector L1 scale at hit time. K1 px-scale calibration applied at spawn; multiplier path unchanged.

## Firing Chain

1. **bat/caveBat ranged attack**: #attack.bullet = #batBullet, #power = 0.6, #damageMultiplier = 3
2. **resolveAttack**: bat's attack data merged with batBullet's attack data (data.json act_batBullet)
3. **EnemyAI fire**: control.ts:594-616 reads resolved ba.powerScalar (0.6) + ba.damageMultiplier (3)
4. **fireBullet**: bullets.ts:25 → Projectile.configure(power, team, ownerId, maxLife, freeze, mult=3)
5. **Collision**: projectile.ts:124 passes mult=3 to takeHit; combat.ts applies damage = (|vx|+|vy|) × 3 ✓

## Conclusion

**Status: CLEAN**

All properties and the single-target hit damage formula are consumed faithfully. damageMultiplier is preserved and applied correctly throughout the firing → collision → damage chain. No behavioral divergence detected.
