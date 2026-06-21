# smokePin Actor Parity Audit

**Actor:** smokePin  
**Type:** Bullet (fired by shrouder's pinShooter weapon)  
**Original Source:** `casts/data/act_smokePin.txt` (inherits `act_bullet.txt`)  
**Ported Source:** `port/src/generated/data.json` (smokePin object)

---

## Property Parity Table

| Property | Original | Ported | Status | Evidence |
|----------|----------|--------|--------|----------|
| **#inherit** | `#bullet` | `"#bullet"` | ✓ Faithful | Data parity; resolves correct archetype |
| **#attack.type** | `#bullet` | `"#bullet"` | ✓ Faithful | Single-target routing at `archetypes.ts:252` (`attackType !== "#explode"`) |
| **#attack.power** | `1.5` | `1.5` | ✓ Faithful | Resolved as `powerScalar` at `weapon.ts:177`; used in CpuAI calc at `control.ts:602` |
| **#attack.damageMultiplier** | `4` | `4` | ✓ Faithful | Passed as `bmult` at `control.ts:616`; applied to `fireBullet()` at `systems/bullets.ts:25` as `mult` param; consumed by `takeHit` at `projectile.ts:124` |
| **#attack.explodeCharge** | *not defined* | *not defined* | ✓ Faithful Omit | Not applicable to single-target bullet type |
| **#friction** | `point(10,10)` | `{x: 10, y: 10}` | ✓ Faithful Omit | Data loaded correctly but not applied; bullets hardcode `friction: 1` (constant velocity) at `systems/bullets.ts:19`. Original also doesn't apply friction to bullets (design: flies until expiry/hit, not until stalling). Documented deviation. |
| **#weight** | `0.6` | `0.6` | ✓ Faithful Omit | Data loaded but unused. Port has no weight-based physics; uses explicit damageMultiplier instead. Documented architectural choice. |
| **#recordInRoomState** | `false` | `false` | ✓ Faithful | Data parity; bullets pooled, not persisted (entities/actorSerial.ts:66; world/rooms.ts:193). Override of base `#bullet` default correctly preserved. |
| **#rotational** | *not defined* | *not defined* | ✓ Faithful Omit | Not applicable to port's sprite-based projectile model |
| **#reincarnateAs** | *not defined* | *not defined* | ✓ Faithful Omit | No entry in smokePin; `parseReincarnateList()` at `archetypes.ts:254` returns `[]` |
| **#payloadFunction** | *not defined* | *not defined* | ✓ Faithful | smokePin has no custom payload; `resolveAttack()` defaults to `["takeHit"]` at `weapon.ts:214`; plain bullet routed via `control.ts:616` to `fireBullet()`, which calls `Projectile.configure()` (single-target, no payload) at `systems/bullets.ts:25` |
| **#splashDamageOn** | *not defined* | *not defined* | ✓ Faithful | No splash on smokePin; `archetypes.ts:252` correctly routes to `bulletAttack` (single-target) not `splashBullet` |
| **#explodeSound** | *not defined* | *not defined* | ✓ Faithful Omit | Only #explode-type bullets use this (e.g., smoke actor uses "spell_explode"); smokePin is plain bullet |

---

## Code Path Verification

**Firing Chain (CPU ai):**
1. CpuAI resolves shrouder's attack `pinShooter` at `weapon.ts:177` → reads smokePin's attack data
2. Damage calc: `l1 = power × dexterity × scale` → `1.5 × dexterity × 0.40...` at `control.ts:602`
3. Fire at `control.ts:616`: calls `fireBullet(ownerId, x, y, dirX, dirY, speed, l1, team, maxLife, 0, bmult)` with `bmult=4`

**Projectile Configuration:**
- `systems/bullets.ts:25` → `Projectile.configure(power, team, ownerId, maxLife, freeze, mult)` with `mult=4`
- `projectile.ts:35–39` → stores `this.mult = 1` for player bolts; **mult=4 for smokePin**

**Collision Handling:**
- `projectile.ts:116–126`: On target hit, calls `e.send("takeHit", v.x, v.y, ownerId, this.mult)` with `mult=4`
- Damage applied as `(|vx|+|vy|) × mult` = `(|vx|+|vy|) × 4`

---

## Conclusion

**ACTOR=smokePin | CLEAN**

All 13 properties from the original Lingo definition are accounted for in the TypeScript port. The actor's core behavior—firing as a plain, single-target bullet with 1.5 power and 4× damage multiplier—is faithfully implemented. Two properties (#friction, #weight) are loaded in the data but intentionally not applied during flight, consistent with the original design and documented as deliberate architectural choices (constant-velocity bullets, explicit damageMultiplier model vs. weight-based physics). No functional divergence detected.

---

**Audit Date:** 2026-06-21  
**Auditor:** Claude Code  
**Files Checked:**
- `casts/data/act_smokePin.txt`
- `casts/data/act_bullet.txt`
- `port/src/generated/data.json`
- `port/src/components/weapon.ts`
- `port/src/systems/bullets.ts`
- `port/src/components/projectile.ts`
- `port/src/components/control.ts`
- `port/src/entities/archetypes.ts`
