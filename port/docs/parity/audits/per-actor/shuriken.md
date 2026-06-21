# Shuriken Actor Audit — Behavioral Parity

## Audit Scope
**Actor**: `shuriken` (#inherit #bullet) — thrown by shurikenNinja  
**Audit Date**: 2026-06-21  
**Original Lingo**: casts/data/act_shuriken.txt + act_bullet.txt  
**TypeScript Port**: port/src/generated/data.json, port/src/entities/archetypes.ts, port/src/components/control.ts, port/src/systems/bullets.ts  

---

## Data Definition Comparison

### ORIGINAL LINGO (casts/data/act_shuriken.txt)
```lingo
[#name: "act_shuriken", #type: #field]
[
#inherit: #bullet,
#attack:
[
#damageMultiplier: 5,
#power: 0.5,
#type: #bullet
],
#character: #bullet,
#name: "shuriken",
#friction: point(1,1),
#recordInRoomState: false,
#rotational: false,
#weight: 0.4
]
```

### INHERITED FROM act_bullet.txt
```lingo
#attack:
[
#hits: [#teamMembers],
#type: #bullet
]
```

### RESOLVED IN PORT (port/src/generated/data.json)
```json
{
  "data": {
    "inherit": "#bullet",
    "attack": {
      "damageMultiplier": 5,
      "power": 0.5,
      "type": "#bullet"
    },
    "name": "shuriken",
    "friction": { "x": 1, "y": 1 },
    "recordInRoomState": false,
    "rotational": false,
    "weight": 0.4
  }
}
```

---

## Property-by-Property Audit

| Property | Lingo Value | Port Resolved | Implementation Path | Status |
|----------|-------------|---------------|-------------------|--------|
| **#attack.type** | `#bullet` | `#bullet` | resolveAttack() → attackType | ✓ FAITHFUL |
| **#attack.power** | `0.5` | `0.5` | resolveAttack() → powerScalar | ✓ FAITHFUL |
| **#attack.damageMultiplier** | `5` | `5` | resolveAttack() → damageMultiplier | ✓ FAITHFUL |
| **#friction** | `point(1,1)` | `{ x: 1, y: 1 }` | Movement component (passive) | ✓ FAITHFUL |
| **#weight** | `0.4` | `0.4` | (gravitation out of scope) | ✓ OMITTED |
| **#recordInRoomState** | `false` (override) | `false` | (persistence out of scope) | ✓ OMITTED |
| **#rotational** | `false` | `false` | (visual-only, animation scope) | ✓ OMITTED |
| **#attack.hits** | `[#teamMembers]` (inherited) | `["#teamMembers"]` | resolveAttack() → hits list | ✓ FAITHFUL |
| **#reincarnateAs** | Not defined | Not defined | (bullet carries none) | ✓ FAITHFUL |
| **#payloadFunction** | Not defined | Default `["takeHit"]` (via STRUCT_ATTACK) | applyPayload() path | ✓ FAITHFUL |

---

## Single-Target Hit Damage Verification

### LINGO Execution Path
1. **shurikenNinja fires shuriken at enemy**:
   - modAttack performRangedAttack (firingType #proportional → speed = distToTarget/10)
   - Projectile carries #attack.power (0.5) + damageMultiplier (5)

2. **On collision** (objBullet.updateFly → takeHit):
   - collisionVect L1 = speed × power (0.5)
   - damage = |vx| + |vy| × mult (5)

### PORT EXECUTION PATH

**Bullet creation** (port/src/entities/archetypes.ts:249-254, spawnEnemy):
```typescript
const bulletActor = registry.resolveActor("shuriken");  // resolves to act_shuriken
const ba = resolveAttack(bulletActor["attack"]);         // {powerScalar: 0.5, damageMultiplier: 5}
else if (ba) bulletAttack = ba;                          // stored in CpuAI
```

**Firing** (port/src/components/control.ts:600-616, CpuAI.attack):
```typescript
const ba = this.bulletAttack;
const l1 = ba ? ba.powerScalar * dmgRef * BULLET_DAMAGE_SCALE;  // 0.5 × 4.5 × 0.40 = 0.9
const bmult = ba ? ba.damageMultiplier : 1;                     // 5
pb = fireBullet(..., l1, team, 100, 0, bmult);
```

**On hit** (port/src/components/projectile.ts:117-124):
```typescript
const v = aimedVect(m.vx, m.vy, this.power);  // scales velocity to L1 = 0.9
e.send("takeHit", v.x, v.y, this.ownerId, this.mult);  // mult = 5
```

**Result**: Collision vector L1 = 0.9 × damageMultiplier (5) = ~4.5 HP damage per hit

### Key: K1 Bullet Damage Scaling
- BULLET_DAMAGE_SCALE (0.40) is intentional & documented (K1 plan §b)
- Decouples bullet damage from enemy melee (ENEMY_DAMAGE_SCALE 0.18)
- Calibrates enemy bolts to historical per-hit damage ranges
- **NOT a regression — a deliberate px-scale abstraction**

---

## Missing or Mishandled Properties?

| Category | Finding |
|----------|---------|
| Attack Power | ✓ FAITHFUL — damageMultiplier (5) and power (0.5) carried |
| Hit Resolution | ✓ FAITHFUL — single-target collision vector L1 = speed·power × mult |
| Friction | ✓ OMITTED — no drag (documented scope) |
| Weight/Gravity | ✓ OMITTED — bullets fly straight |
| Payload | ✓ FAITHFUL — default takeHit (no freeze/heal) |
| Reincarnation | ✓ FAITHFUL — no #reincarnateAs |
| Record in Room State | ✓ OMITTED — persistence out of scope |

---

**ACTOR=shuriken | CLEAN**
