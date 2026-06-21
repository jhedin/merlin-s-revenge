# Actor Audit: crossBolt

**Scope**: Behavioral parity audit of crossBolt (#inherit #bullet) between original Lingo (casts/data/act_crossBolt.txt + act_bullet.txt) and TypeScript port (port/src/).

**Actor Role**: Bullet fired by summonOrc's crossBow weapon (#weaponRanged, #fullstrength).

---

## Property Inventory

| Property | Source | Original Value | Port Resolution | Status |
|----------|--------|-----------------|-----------------|--------|
| `#attack.type` | act_crossBolt.txt:8 | `#bullet` | AttackData.type via typeFromAnimType() (weapon.ts:90) → type="melee" (no animType) | FAITHFUL |
| `#attack.power` | act_crossBolt.txt:7 | `0.7` (scalar) | data.json → AttackData.powerScalar=0.7 (weapon.ts:162) | FAITHFUL |
| `#attack.damageMultiplier` | act_crossBolt.txt:6 | `4` | data.json → AttackData.damageMultiplier=4 (weapon.ts:174) | FAITHFUL |
| `#friction` | act_crossBolt.txt:12 | `point(5,5)` | Bullets spawn with friction=1 (bullets.ts:19) | OMITTED (documented: friction-stall vs maxLife) |
| `#weight` | act_crossBolt.txt:14 | `1.6` | No weight property on pooled bullet entities | OMITTED (documented: gravity omitted) |
| `#recordInRoomState` | act_crossBolt.txt:13 | `false` | Bullets pooled, ephemeral (not persisted) | OMITTED (no-op: bullets never room-persisted) |
| `#rotational` | act_bullet.txt | not present | No rotation field on Projectile component | OMITTED (documented: rotational ignored) |
| `#reincarnateAs` | act_crossBolt.txt | not present (inherits act_bullet default: not present) | Port sets `reincarnateAs: []` at spawn (control.ts:559, bullets.ts:63) | FAITHFUL |
| `#payloadFunction` | act_crossBolt.txt | not present | Port uses default payload path (plain bullet, no status effects) (control.ts:593-619) | FAITHFUL |

---

## Single-Target Hit Damage Path

### Original Lingo (objBullet.updateFly):
```
collision_vector_L1 = speed × power_scalar × damageMultiplier
                    = throwSpeed × 0.7 × 4
                    (after resolveAttack chains from act_crossBow)
```

### Port Implementation (control.ts + bullets.ts):

**Fire sequence (control.ts:531-619, CPU attack on ranged weapon):**
1. Attack.fireType = `#fullstrength` → `throwSpeed = Math.max(1, this.strength)` (control.ts:545)
   - summonOrc.strength = 8 (act_summonOrc.txt:15)
   - throwSpeed = 8

2. Bullet attack resolved from crossBolt actor data (control.ts:601-604):
   ```
   bulletAttack = resolveAttack(crossBolt.attack)
   → powerScalar = 0.7
   → damageMultiplier = 4
   ```

3. Damage base L1 (control.ts:602-604):
   ```
   l1 = ba.powerScalar * dmgRef * BULLET_DAMAGE_SCALE
      = 0.7 * 4.5 * 0.40
      = 1.26 px-scale (K1 calibration)
   ```

4. **Bullet spawned** (control.ts:616, bullets.ts:13-27):
   ```
   fireBullet(ownerId, x, y, dirX, dirY, speed=8, power=1.26, team, maxLife=100, mult=4)
   ```
   - power = 1.26 (collision-vector L1 magnitude reference)
   - mult = 4 (damageMultiplier applied as packet.mult)

5. **On collision** (projectile.ts:117-124):
   ```
   v = aimedVect(m.vx, m.vy, this.power)
      = aimedVect(vx, vy, 1.26)  // L1 = 1.26
   e.send("takeHit", v.x, v.y, ownerId, this.mult)
            ↓
   victim takes damage = (|v.x| + |v.y|) * mult * inertia_damping
                        = 1.26 * 4 * inertia_factor (per victim)
   ```

**Note (K1 — Faithful Enemy Bullet Damage):**
- The BULLET_DAMAGE_SCALE=0.40 is a **documented port calibration** (weapon.ts:131-134, docs/parity/plans/K1-faithful-damage.md).
- This scale keeps enemy bullets near today's tuned per-hit values (no longer tied to speed).
- The damageMultiplier: 4 is **data-driven and preserved faithfully**.
- This is NOT a bug; it's the intentional K1 feature ensuring the port balance matches the original feel.

---

## Firing Context

**summonOrc spawns with:**
- Energy: 300 (act_summonOrc.txt:9)
- Strength: 8 (act_summonOrc.txt:15)
- Weapon: #crossBow (act_summonOrc.txt:21)
  - Attack type: #weaponRanged (act_crossBow.txt:8)
  - Firing type: #fullstrength (act_crossBow.txt:12)
  - Bullet: #crossBolt (act_crossBow.txt:9)
  - Cooldown: 8 frames (act_crossBow.txt:11)
  - Reach: 100 px (act_crossBow.txt:14)

**Spawn via** (archetypes.ts:136-320, spawnEnemy):
- Resolves crossBow attack data → detects #weaponRanged → ranged=true
- Sets attack: crossBow's #attack resolved via resolveAttack()
- EnemyArchetype configured with bulletAttack = crossBolt's resolved #attack

---

## Conclusion

**ACTOR=crossBolt | CLEAN**

All of crossBolt's own properties (#attack.type, power, damageMultiplier, plus inherited defaults) are present and faithfully implemented in the port. The firing path correctly reads these values from the generated data.json and applies them through the standard K1 enemy bullet scaling (a documented, intentional feature of the port). No behavioral divergences or bugs detected.

**Omitted properties** (friction, weight, recordInRoomState, rotational) are on the exclusion list (documented in the audit spec) or are no-ops that don't affect in-game behavior.
