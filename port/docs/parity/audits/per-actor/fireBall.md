# fireBall Actor Parity Audit

**Audited Actor:** `act_fireBall` — a bullet (#inherit #bullet) thrown by fireDragon and fireLizard via the flameThrower weapon.

**Sources:**
- Original Lingo: `casts/data/act_fireBall.txt` + `casts/data/act_bullet.txt` (base)
- TS Port: `port/src/generated/data.json` (fireBall resolved data) + implementation in `port/src/components/projectile.ts`, `port/src/components/weapon.ts`, `port/src/components/control.ts`, `port/src/systems/bullets.ts`

---

## Property Audit Table

| Property | Original (Lingo) | Port (TS) | Status | Notes |
|----------|------------------|-----------|--------|-------|
| `#inherit` | `#bullet` | `#bullet` | ✓ CLEAN | Inherited chain preserved |
| `#attack.type` | `#bullet` | `#bullet` | ✓ CLEAN | Single-target bullet attack type |
| `#attack.power` | `0.2` | `0.2` | ✓ CLEAN | Damage power scalar faithfully ported |
| `#attack.damageMultiplier` | `6` | `6` | ✓ CLEAN | Damage multiplier faithful |
| `#friction` | `point(4,4)` | `{x:4, y:4}` | ✓ CLEAN | Friction point resolved correctly |
| `#weight` | `0.4` | `0.4` | ✓ CLEAN | Weight property preserved |
| `#recordInRoomState` | `false` | `false` | ✓ CLEAN | Bullet does not persist in room state |
| `#character` | `#bullet` | `#bullet` | ✓ CLEAN | Character type set |
| `#name` | `"fireBall"` | `"fireBall"` | ✓ CLEAN | Actor name matches |
| `#attack.explodeCharge` | *(not set; inherited #none)* | *(not set; default 0)* | ✓ CLEAN | Not an explode bullet; no charge radius |
| `#attack.payloadFunction` | *(not set; single-target)* | *(not set; defaults to [#takeHit])* | ✓ CLEAN | Plain single-target damage payload |
| `#splashDamageOn` | *(not set; false)* | *(not set; false)* | ✓ CLEAN | Not a splash bullet |
| `#reincarnateAs` | *(not set; none)* | *(not set; none)* | ✓ CLEAN | No child actors spawned on death |
| `#rotational` | *(not set; inherited default)* | *(omitted; documented scope exclusion)* | ✓ OMITTED | Rotation properties out of scope per audit spec |
| `#miniMapStatus` | *(inherited from #bullet: #clr)* | *(inherited from #bullet: #clr)* | ✓ CLEAN | Bullet not shown on minimap |
| `#eyestrain` | *(not on bullet; actor property)* | *(omitted; documented scope exclusion)* | ✓ OMITTED | Visual/audio properties out of scope |
| `#explodeSound` | *(not set; #none)* | *(not set; defaults to #none)* | ✓ CLEAN | Plain bullet has no explosion sound; data-driven sound resolves correctly (weapon.ts line 188) |

---

## Behavioral Parity Analysis

### Firing Path (fireDragon → flameThrower → fireBall)

**Original Lingo Flow:**
1. fireDragon carries weapon `#flameThrower`
2. flameThrower.attack.bullet = `#fireBall`
3. On attack, objBullet spawns with fireBall's resolved data (power 0.2, mult 6, single-target)
4. Bullet flies straight, dies on collision or lifetime expiry
5. On hit: single-target takeHit damage = `|vx|+|vy| * damageMultiplier`

**TS Port Flow (control.ts line 544–616):**
1. CpuAI reads fireDragon's current weapon attack (flameThrower.attack resolved)
2. Line 544: `isFullStrength = (ftAttack?.firingType ?? "#proportional").toLowerCase() === "#fullstrength"`
   - flameThrower.firingType = `#fullstrength` → throwSpeed = `max(1, strength)` = fireDragon's strength
3. Line 553–559: **NOT splashBullet path** — fireBall.attack.type is `#bullet`, not `#explode` → line 560 onwards
4. Line 601–603: bulletAttack (fireBall.attack) resolved; damage L1 = `power(0.2) * dmgRef(4.5) * BULLET_DAMAGE_SCALE(0.40)` = 0.36
5. Line 616: `fireBullet()` called (systems/bullets.ts line 13–28)
   - Power passed as L1 magnitude; mult = damageMultiplier(6)
   - Projectile.configure() stores power + mult → on collision, takeHit gets (|vx|+|vy|)*mult
6. **Reincarnation:** Line 618: `if (this.bulletReincarnate.length)` → fireBall has **NO** reincarnateAs, skipped ✓

### Single-Target vs Splash Correctness

**fireBall is NOT a splash bullet:**
- Original: `#attack.type = #bullet` (not #explode) → single-target takeHit on collision
- Port: 
  - Projectile.ts line 20: `private splash: AttackData | null = null` (NOT set for fireBall)
  - Line 116: `if (this.splash)` branch skipped → line 117: `aimedVect()` + line 124: single-target `takeHit()`
  - Projectile.ts line 110: On lifetime expiry, `this.splash` is null → `this.finish()`, no area detonation

**Evidence of faithfulness:**
- Splash resolution only fires if `attackType === "#explode"` OR `splashDamageOn` (splash.ts line 53–54)
- fireBall has neither → single-target pathway ✓
- Reincarnate.ts lines 64–73: Only triggers on death with `getKilledInAction()` — bullets never KIA, so even if fireBall had reincarnateAs, it would NOT spawn (correct scope)

---

## No Divergences Found

All enumerated properties are faithfully ported. The bullet's travel, collision, damage calculation, and single-target payload are verified across three critical paths:

1. **Data resolution:** Generated JSON matches Lingo original (attack.power, damageMultiplier, type).
2. **Spawn configuration:** CpuAI.attack() / control.ts routes fireBall as a plain bullet (line 616), not splash (line 553 skipped).
3. **Collision behavior:** Projectile.update() single-target path (line 117–127) handles fireBall damage faithfully.

---

## Conclusion

**ACTOR=fireBall | CLEAN**

All properties verified faithful. No splash confusion, reincarnation not triggered (fireBall has no children and bullets don't KIA), and damage/collision logic correct for a single-target projectile.
