# Boulder Actor Parity Audit

**Actor**: `#boulder` (projectile fired by boulderMonster via #throwBoulder)  
**Scope**: Data properties + logic routing (single-target vs splash determination)

## Data Properties

| Property | Casts (act_boulder.txt) | Port (data.json) | Status |
|----------|--------------------------|------------------|--------|
| #inherit | #bullet | "inherit": "#bullet" | ✓ Faithfully carried |
| #attack.type | #bullet | "type": "#bullet" | ✓ Faithfully carried |
| #attack.power | 2 | 2 | ✓ Faithfully carried |
| #attack.damageMultiplier | 1 | 1 | ✓ Faithfully carried |
| #friction | point(4.5,4.5) | {"x": 4.5, "y": 4.5} | ✓ Faithfully carried |
| #weight | 2 | 2 | ✓ Faithfully carried |
| #character | #bullet | "#bullet" | ✓ Faithfully carried |
| #recordInRoomState | false | false | ✓ Faithfully carried |
| #splashDamageOn | (none) | (none) | ✓ Faithfully omitted |
| #explodeCharge | (none) | (none) | ✓ Faithfully omitted |
| #reincarnateAs | (none) | (none) | ✓ Faithfully omitted |
| #payloadFunction | (none — implicit #takeHit) | (none — implicit #takeHit) | ✓ Faithfully omitted |

## Logic Routing

**Port routing logic** (entities/archetypes.ts:249-253):
```typescript
if (ranged && typeof atk["bullet"] === "string" && atk["bullet"] !== "#none") {
  const bulletActor = registry.resolveActor(atk["bullet"].replace(/^#/, ""));
  const ba = bulletActor ? resolveAttack(bulletActor["attack"], bulletActor) : undefined;
  if (ba && (ba.attackType === "#explode" || ba.splashDamageOn)) splashBullet = ba;
  else if (ba) bulletAttack = ba;  // boulder routes here
}
```

**Boulder resolution**:
- Caster (boulderMonster) has #attack.bullet = #boulder
- Boulder actor resolves to: attackType="#bullet", splashDamageOn=false
- Condition `(ba.attackType === "#explode" || ba.splashDamageOn)` → FALSE
- **Boulder assigned to `bulletAttack`** (single-target path) ✓

**Firing path** (components/control.ts:616):
```typescript
pb = fireBullet(this.entity.id, m.x, m.y - 6, dx, dy, speed, l1, team, 100, 0, bmult);
```
- Calls `fireBullet()` (systems/bullets.ts:13-27), not `fireSplashBullet()`
- Creates a plain Projectile via `configure()` (components/projectile.ts:35-39)
- On impact: executes single-target `takeHit()` (projectile.ts:124), not `detonate()` splash

## Conclusion

Boulder is a **pure single-target bullet** with no splash/area damage. The port:
1. Correctly omits all splash-damage properties (splashDamageOn, explodeCharge, etc.)
2. Correctly routes boulder's #attack.type="#bullet" to the single-target bullet path
3. Correctly fires via `fireBullet()`, not `fireSplashBullet()`
4. Correctly applies damage via single-target `takeHit()`, not area `resolveSplash()`

All required data properties consumed faithfully. All omissions faithful to the original. Routing logic correct.

**Status: CLEAN**
