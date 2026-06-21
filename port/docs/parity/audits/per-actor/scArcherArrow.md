# Behavioral Audit: act_scArcherArrow

**Actor:** plain bullet | #inherit #bullet  
**Firing sources:** scArcherBow (weapon of scArcher enemy) + garTower direct #attack  
**Class:** BULLET — single-target ranged projectile with faithful power/mult damage

---

## Data Property Audit

### Original Definition
**File:** `casts/data/act_scArcherArrow.txt:1-15`

```
#inherit: #bullet
#attack:
  #damageMultiplier: 5
  #power: 0.9
  #type: #bullet
#character: #bullet
#name: "scArcherArrow"
#friction: point(5,5)
#recordInRoomState: false
#weight: 0.4
```

### Resolved Data (Port)
**File:** `port/src/generated/data.json` (searchable: `act_scArcherArrow.data`)

```json
{
  "inherit": "#bullet",
  "attack": {
    "damageMultiplier": 5,
    "power": 0.9,
    "type": "#bullet"
  },
  "character": "#bullet",
  "name": "scArcherArrow",
  "friction": { "x": 5, "y": 5 },
  "recordInRoomState": false,
  "weight": 0.4
}
```

### Property Comparison

| Property | Original | Port | Status | Notes |
|---|---|---|---|---|
| `#inherit` | `#bullet` | `"#bullet"` | ✓ Faithful | Base inheritance preserved |
| `#attack.damageMultiplier` | 5 | 5 | ✓ Faithful | Resolved exactly |
| `#attack.power` | 0.9 | 0.9 | ✓ Faithful | Bullet power scalar, resolved exactly |
| `#attack.type` | `#bullet` | `"#bullet"` | ✓ Faithful | Single-target type (not explode/splash) |
| `#character` | `#bullet` | `"#bullet"` | ✓ Faithful | Animation character |
| `#name` | `"scArcherArrow"` | `"scArcherArrow"` | ✓ Faithful | Actor identifier |
| `#friction` | `point(5,5)` | `{x:5, y:5}` | ✓ Faithful | Movement damping |
| `#recordInRoomState` | `false` | `false` | ✓ Faithful | Bullets don't persist across room transitions |
| `#weight` | 0.4 | 0.4 | ✓ Faithful | Gravity/knockback scaling |
| `#rotational` | (inherited #once) | (not in data) | ✓ Omitted | Documented: rotational/audio omitted (visual/audio only) |
| `#reincarnateAs` | (inherited, empty) | (not in data) | ✓ Omitted | Arrow does not spawn children on death (unlike flamingRock/lizardEgg) |
| `#payloadFunction` | (inherited, empty) | (not in data) | ✓ Omitted | Arrow is pure #bullet, no status payload (no freeze/heal) |

---

## Single-Target Hit Damage Path

### Firing Mechanism
scArcherArrow is fired by:
1. **scArcherBow** (`casts/data/act_scArcherBow.txt:9`) — weapon with `#bullet: #scArcherArrow`, `#firingType: #fullstrength`
2. **garTower** (`casts/data/act_garTower.txt:10`) — direct attack with same `#bullet` and firingType

Both use `#fullstrength` firingType, meaning projectile velocity = attacker's strength (not distance-proportional).

### Damage Calculation (Port)

**Firing entry point:** `port/src/components/control.ts:594-616` (CpuAI.attack, ranged branch)

```
const speed = throwSpeed;                    // #fullstrength → strength value
const dmgRef = 4.5;                          // calibrated K1 damage reference
const ba = resolveAttack(bulletActor.attack) // = {powerScalar: 0.9, damageMultiplier: 5, ...}
const l1 = ba.powerScalar * dmgRef * BULLET_DAMAGE_SCALE
         = 0.9 * 4.5 * 0.40
         = 1.62

const bmult = ba.damageMultiplier  // = 5
pb = fireBullet(id, x, y, dx, dy, speed, l1, team, 100, 0, bmult)
```

**File:** `port/src/components/weapon.ts:138` — `BULLET_DAMAGE_SCALE = 0.40`

### Projectile Impact

**File:** `port/src/components/projectile.ts:115-127`

```typescript
if (Math.abs(p.x - m.x) < 12 && Math.abs(p.y - m.y) < 12) {
  if (this.splash) { 
    this.detonate(m.x, m.y); break; 
  }
  const v = aimedVect(m.vx, m.vy, this.power);  // this.power = 1.62
  if (this.payload) {
    applyPayload(this.payload.payloadFunction, e, v.x, v.y, ...);
  } else {
    // plain bullet: collision vector L1 = this.power (1.62), multiplied by mult (5)
    e.send("takeHit", v.x, v.y, this.ownerId, this.mult);  // mult = 5
  }
  this.finish(m.x, m.y);
  break;
}
```

**Damage vector:** `aimedVect(vx, vy, 1.62)` — velocity scaled to L1 magnitude 1.62  
**Multiplier:** `this.mult = 5` — passed to `takeHit` as 4th param  
**Result:** Single hit with vector carrying damage reference 1.62, multiplied by factor 5

---

## Firing Source Verification

### scArcherBow (scArcher's weapon)

**Original:** `casts/data/act_scArcherBow.txt`
```
#bullet: #scArcherArrow
#firingType: #fullstrength
#cooldown: 0
```

**Port resolved:** `act_scArcherBow.data.attack`
```json
{
  "bullet": "#scArcherArrow",
  "firingType": "#fullstrength",
  "cooldown": 0
}
```

**Port consumption:** `archetypes.ts:249-253` — resolves `bulletActor` to scArcherArrow, extracts `bulletAttack`

### garTower (defensive tower)

**Original:** `casts/data/act_garTower.txt:6-17`
```
#attack: [
  #bullet: #scArcherArrow
  #firingType: #fullstrength
  ...
]
```

**Port resolved:** `act_garTower.data.attack` (same structure)

**Port consumption:** `archetypes.ts:249-253` — same bulletAttack path

✓ **Both firing sources resolve scArcherArrow identically** — the bullet carries `powerScalar=0.9, damageMultiplier=5`

---

## Class-Level Coverage

This actor is a **plain #bullet** (no splash, no payload, no reincarnation). Class-level verification:

| Aspect | Location (Lingo) | Location (Port) | Status |
|---|---|---|---|
| **Bullet spawning** | `modAttack.performRangedAttack` | `control.ts:614-616` (fireBullet) | ✓ Both resolve `bulletAttack` once at fire time |
| **Flight & collision** | `objBullet.updateFly` | `projectile.ts:96-132` | ✓ Flies straight, hits on proximity, calls `takeHit` |
| **Damage on single-target hit** | `objBullet.updateFly:317-319` (direct `takeHit` call) | `projectile.ts:124` (e.send("takeHit", v.x, v.y, ownerId, mult)) | ✓ Vector magnitude = power, mult applied as 4th param |
| **Velocity direction** | `objMoveXY` drift frame-by-frame | `movement.ts` + `projectile.ts:96-132` | ✓ Linear movement per tick |
| **Lifetime expiry** | `#stallSpeed` friction-based stall (documented divergence) | `maxLife=100` frames | ✓ Documented: fixed timer replaces friction-stall |
| **Reincarnation** | None for scArcherArrow | Handled generically by `projectile.ts:80-86` | ✓ Empty list = no children spawned |

---

## Conclusion

**ACTOR=scArcherArrow | CLEAN**

All explicitly defined properties (**#attack.damageMultiplier, #attack.power, #attack.type, #friction, #weight, #recordInRoomState**) resolve faithfully in the port. Inherited defaults (#rotational, #reincarnateAs, #payloadFunction) are correctly omitted—this is a plain bullet with no special effects. Single-target damage pathway is preserved: power scalar 0.9 × reference 4.5 × scale 0.40 = 1.62, multiplied by factor 5 on impact. Both firing sources (scArcherBow and garTower) correctly reference and fire scArcherArrow without divergence.
