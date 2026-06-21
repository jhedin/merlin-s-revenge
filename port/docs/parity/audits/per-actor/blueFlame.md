# Behavioral Parity Audit: blueFlame

**Actor:** blueFlame  
**Type:** Bullet (single-target, non-splash)  
**Fired by:** undeadDragon  
**Audit Date:** 2026-06-21

---

## Data Properties Table

| Property | Lingo (casts/) | Port (port/src/generated/) | Status | Notes |
|---|---|---|---|---|
| **#inherit** | #bullet | #bullet | ✓ MATCH | Base bullet type inherited |
| **#attack.type** | #bullet | #bullet | ✓ MATCH | Single-target bullet, not #explode |
| **#attack.power** | 0.2 | 0.2 | ✓ MATCH | Scalar power value |
| **#attack.damageMultiplier** | 15 | 15 | ✓ MATCH | Damage scalar |
| **#friction** | point(4,4) | {x:4, y:4} | ✓ MATCH | Movement damping |
| **#weight** | 0.4 | 0.4 | ✓ MATCH | Gravity scalar |
| **#recordInRoomState** | false | false | ✓ MATCH | Bullets not serialized |
| **#character** | #bullet | (inherited) | ✓ MATCH | Character type from parent |
| **#name** | blueFlame | blueFlame | ✓ MATCH | Actor symbol |

---

## Splash/Explode Analysis

| Property | Lingo | Port | Status |
|---|---|---|---|
| **#type** | #bullet (not #explode) | #bullet (not #explode) | ✓ MATCH |
| **#splashDamageOn** | (absent, defaults false) | false | ✓ MATCH |
| **#explodeCharge** | (absent, defaults none) | none | ✓ MATCH |
| **Splash Behavior** | Single-target on hit | Single-target on hit | ✓ MATCH |

blueFlame carries NO splash/area damage; it hits one target and dies (B2 plainbullet branch).

---

## Reincarnation Analysis

| Property | Lingo | Port | Status |
|---|---|---|---|
| **#reincarnateAs** | (absent, defaults [#none, #none, #none]) | (absent, defaults []) | ✓ MATCH |
| **Leave-behind** | None | None | ✓ MATCH |

blueFlame does NOT spawn children or leave fire/effects behind on death.

---

## Payload/Effects Analysis

| Property | Lingo | Port | Status |
|---|---|---|---|
| **#payloadFunction** | (absent, inherited from #bullet) | takeHit (default) | ✓ MATCH |
| **Burn/Fire Effect** | None | None | ✓ MATCH |

No special burn behavior; standard melee damage payload.

---

## Firing Context (undeadDragon)

Verify the port correctly resolves blueFlame as undeadDragon's bullet:

| Field | Lingo | Port | Status |
|---|---|---|---|
| **#attack.bullet** | #blueFlame | #blueFlame | ✓ MATCH |
| **Firing Type** | #naturalRanged | #naturalRanged (resolved) | ✓ MATCH |

Port archetypes.ts line 250–251 resolves the bulletActor's attack data:
```typescript
const bulletActor = registry.resolveActor(atk["bullet"].replace(/^#/, ""));
const ba = bulletActor ? resolveAttack(bulletActor["attack"] as Record<string, any>, bulletActor) : undefined;
```

blueFlame is resolved as a plain bullet (ba.attackType === "#bullet", not "#explode"), so splashBullet is NOT set, and bulletAttack receives the full attack data (power 0.2, mult 15). ✓

---

## Component Logic Mapping

**Lingo (casts/script_objects/):**
- `objBullet.txt` (lines 27–33): adds modAnimSet, modAttack, modExploder, modGrave, modRotational, modSplashDamage, modReincarnate, modRotator, modListNode
- `objBullet.update()` (lines 284–289): flies until stalled/collides; on collision: calls PayloadFunction, dies via finish()
- `modReincarnate.reincarnate()` (lines 49–72): iterates pReincarnateAs; for non-#none entries, spawns reincarnated actor

**Port (port/src/components/):**
- `projectile.ts` Projectile component: single-target path (line 124) calls `takeHit(v.x, v.y, ownerId, mult)` for plain bullets
- `projectile.ts#finish()` (lines 78–87): idempotent death, spawns reincarnateAs children if any
- archetypes.ts (line 254): extracts bulletReincarnate via `parseReincarnateList(bulletActor?.["reincarnateAs"] ?? bulletActor?.["reincarnateInto"])`

blueFlame: no reincarnateAs, so finish() spawns nothing. ✓

---

## Non-Issues (Flagged in Briefing)

- **audio/volume:** Not part of this audit
- **rotational:** Present in both; #rotational:#once set by objBullet.addModParams (line 48)
- **recordInRoomState:** Explicitly false in both; documented N/A for bullets
- **weight/gravity:** 0.4 in both; matched
- **friction-stall vs maxLife:** Port maxLife (projectile.ts line 110) replaces friction-stall landing; friction still decelerates; documented as equivalent
- **attack.collisionLoc:** Handled via firing offset; not part of bullet actor data
- **miniMapStatus:** Inherited from parent; #clr = not shown
- **firingType:** Handled in control.ts; not part of bullet actor data
- **eyestrain:** Player->target angle correction; not bullet-specific

---

## Conclusion

**blueFlame demonstrates PERFECT BEHAVIORAL PARITY** across all properties:

1. **Data resolution:** All attack/physics properties match exactly (power, mult, friction, weight)
2. **Attack type:** Correctly identified as single-target (#bullet), not splash (#explode)
3. **Reincarnation:** Absent in both; no leave-behind fire
4. **Payload:** Standard takeHit damage; no special burn behavior
5. **Lifecycle:** Port Projectile component faithfully replicates objBullet single-target path

No divergences detected. The port's bullet resolution logic (archetypes.ts 249–255) correctly reads the bullet actor data and routes blueFlame to the plain-bullet single-target handler, matching the original Lingo behavior.

**Status: CLEAN**
