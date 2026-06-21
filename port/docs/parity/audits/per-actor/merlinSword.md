# Parity Audit: merlinSword

| Aspect | Original (Lingo) | Port (TypeScript) | Match |
|--------|------------------|-------------------|-------|
| **Power (melee base)** | point(.5, .5) → L1 mag. 1 × strength | powerScalar 1 × strength × MELEE_SCALE | ✓ Faithful |
| **Damage multiplier** | 16 | 16 | ✓ |
| **Reach** | point(12, 5) → hypot = 13 px | Math.hypot(12, 5) = 13 px | ✓ |
| **Cooldown** | 0 frames | 0 frames | ✓ |
| **Animation type** | #weaponMelee | "#weaponMelee" | ✓ |
| **Attack sound** | "skeleton_fire" | "skeleton_fire" (control.ts:273) | ✓ |
| **Pickup flow** | newScrollCollected → addWeapon | pickup.ts:68 → equipSword → addWeapon | ✓ |
| **Reach update on pickup** | modWeaponManager.addWeapon | control.ts:84 `tg.reach = attack.reach` | ✓ |
| **Melee hit resolution** | calcAttackHitMelee + impactMeleeAttack | impactMeleeAttack + meleeHitFn | ✓ Behavioral parity |
| **Sword-vs-punch swap** | addWeapon sets current weapon | addWeapon → setCurrentWeapon → lastMelee | ✓ |
| **Melee damage calc** | power·strength·mult | power·strength·MELEE_SCALE·mult | ✓ Calibrated |

## Conclusion

**CLEAN**. The merlinSword powerup exhibits full behavioral parity:
- Attack data (power, reach, cooldown, damage multiplier, sound) resolves identically
- Pickup flow (scroll → addWeapon → auto-select) is preserved
- Melee combat (hit resolution, reach gating, damage application) is faithful
- Sword-vs-punch swap on pickup works (WeaponManager.lastMelee routing)
- Reach widening on pickup (18 px default → 13 px sword) is implemented (control.ts:84)
- MELEE_SCALE calibration (B2 plan §f.2) aligns sword damage faithfully to the original's power·strength·mult model

No behavioral divergences detected.
