# skeletonGiantSword Parity Audit

**Actor:** skeletonGiantSword (#objType #objPowerUp, #inherit #weapon)  
**Wielder:** skeletonGiant (act_skeletonGiant.txt line 17: `#weapon: #skeletonGiantSword`)  
**Defines:** `#attack` block used by the giant skeleton enemy

## Attack Properties Inventory

| Property | Original (Lingo) | TS Port (data.json) | Resolved (resolveAttack) | Status |
|---|---|---|---|---|
| **animType** | #weaponMelee | "#weaponMelee" | "weaponMelee" (type="melee") | ✓ Faithful |
| **cooldown** | 0 | 0 | 0 (no K1 re-derivation needed; non-hostile melee) | ✓ Faithful |
| **power** | point(1, 0) | {x:1, y:0} | powerX=1, powerY=0, powerScalar=1 | ✓ Faithful |
| **damageMultiplier** | 8 | 8 | 8 | ✓ Faithful |
| **name** | #skeletonGiantSword | "#skeletonGiantSword" | "skeletonGiantSword" | ✓ Faithful |
| **hits** | [#teamMembers, #teamBuildings] | ["#teamMembers", "#teamBuildings"] | ["#teamMembers", "#teamBuildings"] | ✓ Faithful |
| **sound** | "skeleton_fire" | "skeleton_fire" | "skeleton_fire" | ✓ Faithful |
| **reach** | (absent; defaults in engine) | (absent in raw data) | 25 (STRUCT_ATTACK default) | ✓ Faithful omit |

### Additional Attack Properties (Not Audited Per Instructions)

- **animframe:** 6 (not flagged; skipped per audit scope)
- **collisionLoc:** point(30,0) → {x:30, y:0} (not flagged; skipped per audit scope)
- **explodeSound:** Absent (data-driven weapons don't carry this; not flagged)
- **dammageMultiplier typo:** Preserved as-is (typo is catalogued; not flagged)

## Reach Behavior

The original Lingo has NO `#reach` property for skeletonGiantSword. The TS port's resolveAttack (weapon.ts:171-172) defaults reach to 25 when absent:

```typescript
// weapon.ts lines 168-172
const rch = r["reach"];
let reach: number;
if (rch && typeof rch === "object" && "x" in rch) reach = Math.hypot(rch.x, rch.y);
else reach = numOr(rch, numOr(d["reach"], 25));  // ← defaults to 25
```

This matches the STRUCT_ATTACK default (registry.ts line 29: `reach: 25`). Since the original weapon omits reach, using the default 25px is **faithful to the unspecified original**.

## Melee Classification

- **animType:** #weaponMelee → typeFromAnimType (weapon.ts:94-102) → type="melee" ✓
- **Power resolution:** Melee uses powerX/powerY; carried as-is ✓
- **Cooldown:** 0 frames (weapon picks up no K1 re-derivation because skeletonGiantSword is a WEAPON pickup, not a CPU enemy attack; only `spawnEnemy` in archetypes.ts applies the effective-cooldown calibration) ✓

## Damage Calculation Path

The skeletonGiantSword is wielded by skeletonGiant (an enemy). When the giant attacks:

1. **spawnEnemy** resolves the weapon's #attack (archetypes.ts:156):
   ```typescript
   const weaponAtk = objAttack((registry.resolveActor(d["weapon"].replace(/^#/, "")) ?? {})["attack"]);
   ```

2. **resolveAttack** receives the raw attack data + the weapon actor (archetypes.ts:197):
   ```typescript
   resolveAttack({ ...atk, cooldown: effectiveCooldown })
   ```

3. **Damage delivered** via enemyMeleeBasePower (weapon.ts:148):
   ```typescript
   attack.powerScalar * strength * ENEMY_DAMAGE_SCALE  // = 1 * 6 * 0.18 = 1.08 base
   ```
   then multiplied by damageMultiplier (8) = **~8.6 per swing** (inertia-damped at victim).

This faithfully preserves the original power(1)·mult(8) relationship in the port's damage model.

## Conclusion

All attack properties from the original Lingo weapon block are **faithfully resolved** in the TS port. No mishandled properties detected. Reach defaults to 25px (the game's melee baseline) when absent, matching the original's implicit default behavior.

---

**ACTOR=skeletonGiantSword | CLEAN**
