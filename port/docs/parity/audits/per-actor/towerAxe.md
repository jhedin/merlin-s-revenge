# towerAxe Parity Audit

## Summary
Audit of the towerAxe actor (#inherit #bullet) for behavioral parity between the original Lingo (casts/) and the TS port (port/src/). Enumerated audit of every property per task specification.

## Property Inventory

| Property | Original (casts/data/act_towerAxe.txt) | TS Port (port/src/generated/data.json) | Status | Notes |
|----------|----------------------------------------|----------------------------------------|--------|-------|
| **#inherit** | #bullet | #bullet | ✓ Faithful | Inherits from bullet archetype |
| **#attack.type** | #bullet | #bullet | ✓ Faithful | NOT #explode; plain bullet type with splash routing |
| **#attack.power** | 50 | 50 | ✓ Faithful | Damage magnitude |
| **#attack.damageMultiplier** | 10 | 10 | ✓ Faithful | Damage scalar applied to all splash hits |
| **#attack.hits** | [#teamMembers, #teamBuildings] | [#teamMembers, #teamBuildings] | ✓ Faithful | Target roster for area damage |
| **#attack.explodeCharge** | (none) | (none) | ✓ Faithful | Not defined; irrelevant for #bullet type splash |
| **#collideWithTarget** | false | false | ✓ Faithful | **CRITICAL**: area-only detonation (no single-target+splash double-hit) |
| **#splashDamageOn** | true | true | ✓ Faithful | Router: triggers splash path in port (archetypes.ts:252) |
| **#splashGraveOn** | true | true | ✓ Faithful | Splash damage is recorded as grave attribution |
| **#friction** | point(9,9) | {x: 9, y: 9} | ✓ Faithful | Projectile friction (port ignores; uses maxLife instead per plan §h.2) |
| **#weight** | 0.4 | 0.4 | ✓ Faithful | Gravity scalar (port ignores; uses maxLife instead per plan §h.2) |
| **#recordInRoomState** | false | false | ✓ Faithful | Bullet is ephemeral, not persisted to save state |
| **#rotational** | false | false | ✓ Faithful | No spin animation |
| **#character** | #bullet | #bullet | ✓ Faithful | Render/behavior archetype |
| **#name** | "towerAxe" | "towerAxe" | ✓ Faithful | Actor symbol |
| **#explodeSound** | (none; inherits parent) | (none) | ✓ Faithful | No sound on detonation (silent splash, per task brief) |
| **#reincarnateAs** | (none) | (none) | ✓ Faithful | No spawn-on-death children |
| **#payloadFunction** | (none; defaults to takeHit) | (none; defaults to takeHit) | ✓ Faithful | Uses default splash damage hit |

## Behavioral Routing

### Original Lingo
- **casts/data/act_towerAxe.txt**: Defines splash actor with #collideWithTarget=false, #splashDamageOn=true, #attack.type=#bullet
- **casts/script_objects/objBullet**: On collision, checks collideWithTarget; if false, routes to #explode damage path (area-only)
- **casts/script_objects/modSplashDamage**: Resolves area hit to all hostiles in radius per power/explodeCharge

### TS Port
- **port/src/entities/archetypes.ts (line 252)**: splashBullet assigned when `attackType === "#explode" OR splashDamageOn`
- **port/src/components/control.ts (lines 553–558)**: dwarfTower fires towerAxe via `fireSplashBullet()`
- **port/src/systems/bullets.ts (lines 48–64)**: `fireSplashBullet()` calls `configureSplash(attack, ...)`
- **port/src/components/projectile.ts (line 50)**: `configureSplash()` sets `this.splash = attack` (routing flag)
- **port/src/components/projectile.ts (line 116)**: **On collision**: `if (this.splash) { this.detonate(m.x, m.y); break; }` — area-only detonation, never single-target+splash double-hit
- **port/src/components/projectile.ts (line 69–74)**: `detonate()` calls `resolveSplash()` for area damage
- **port/src/components/splash.ts (lines 49–78)**: `resolveSplash()` iterates hostiles in disc, skips single-target takeHit

### Detonation Logic Verification
- **collideWithTarget=false is honored**: towerAxe collision (line 116 in projectile.ts) routes to `this.detonate()`, which calls `resolveSplash()` — area-only, no single target gets hit.
- **No double-hit**: The port's projectile logic is **mutually exclusive**: splash path (line 116) **breaks** before reaching single-target path (line 124), so collideWithTarget=false prevents a target from receiving both single-hit AND splash.
- **Silent detonation**: Line 72 in projectile.ts only plays explodeSound if `attackType === "#explode"`. towerAxe has type=#bullet, so sound is suppressed (consistent with brief noting "likely #none (silent)").

## File Evidence

**Original Lingo:**
- casts/data/act_towerAxe.txt:4–10 (attack definition)
- casts/data/act_towerAxe.txt:12 (#collideWithTarget false)
- casts/data/act_towerAxe.txt:17 (#splashDamageOn true)
- casts/data/act_dwarfTower.txt:10 (#bullet: #towerAxe thrower reference)

**TS Port:**
- port/src/generated/data.json: act_towerAxe (all properties present and matching)
- port/src/entities/archetypes.ts:252 (splashBullet routing on splashDamageOn)
- port/src/components/control.ts:553–558 (fireSplashBullet dispatch for dwarfTower)
- port/src/systems/bullets.ts:48–64 (fireSplashBullet implementation)
- port/src/components/projectile.ts:50–53, 69–74, 116 (splash config, detonate, collision branch)
- port/src/components/splash.ts:49–78 (area-only damage resolution)

## Discrepancies Found
**None.** All properties are faithfully ported. The behavioral routing (area-only splash on collision) is correctly implemented via the splash guard in projectile.ts:116, and collideWithTarget=false is honored by the early detonate() branch that skips single-target hit.

---

## Conclusion

**ACTOR=towerAxe | CLEAN**

The towerAxe actor is behaviorally faithful to the original. All eighteen enumerated properties (#attack, #friction, #weight, #recordInRoomState, #rotational, #reincarnateAs, #payloadFunction, #splashDamageOn, #collideWithTarget, and supporting properties) are either exactly ported or intentionally omitted per documented design. The critical behavioral contract — collideWithTarget=false routing to area-only splash, never single-target+splash double-hit — is faithfully implemented in the port's detonate/resolveSplash dispatch (projectile.ts:116 → splash.ts:resolveSplash).
