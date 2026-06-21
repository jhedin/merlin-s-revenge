# cBlastAi Behavioral Parity Audit

## Overview
**Actor**: cBlastAi (CPU/AI variant of cBlast: #magic damage spell)
**Purpose**: A spell weapon fired by CPU spellcasters (objAiCPUSpellCaster) with tuned charge parameters vs. the player's cBlast.
**Status**: CLEAN

---

## Data Comparison

| Property | Original (act_cBlast) | AI Variant (act_cBlastAi) | Port (cBlast) | Port (cBlastAi) | Parity |
|----------|-----|-----|-----|-----|-----|
| animType | #magic | #magic | #magic | #magic | ✓ |
| bullet | #energyBlastBullet | #energyBlastBullet | #energyBlastBullet | #energyBlastBullet | ✓ |
| power | 0.5 | 0.5 | 0.5 | 0.5 | ✓ |
| chargeMax | 999 | 999 | 999 | 999 | ✓ |
| chargeMaxBasic | 999 | 18 | 999 | 18 | ✓ |
| chargeMaxModifier | 0 | 3 | 0 | 3 | ✓ |
| chargeSpeed | 0.1 | 0.2 | 0.1 | 0.2 | ✓ |
| chargeStart | 0 | 0 | 0 | 0 | ✓ |
| chargeVolumeMap | [1,100] → [10,255] | [1,100] → [10,255] | [1,100] → [10,255] | [1,100] → [10,255] | ✓ |
| spellSpeed | 20 | 20 | 20 | 20 | ✓ |
| reach | 9999 | 9999 | 9999 | 9999 | ✓ |
| cooldown | 30 | 30 | 30 | 30 | ✓ |
| hits | [#teamMembers, #teamBuildings] | [#teamMembers, #teamBuildings] | [#teamMembers, #teamBuildings] | [#teamMembers, #teamBuildings] | ✓ |

**Tuned Differences** (intentional, documented):
- **chargeSpeed**: AI fires 2× faster (0.2 vs 0.1) → AI caster reaches max faster.
- **chargeMaxBasic**: AI reaches chargeMax in ~18+3*capacity frames vs player's ~999 (unreachable without GMG).

---

## Firing Logic: CPU vs. Player

### Original (Lingo)
- **Player (cBlast)**: Holds to charge → releases spell actor (objSpell) that grows, flies, then explodes.
- **CPU (cBlastAi)**: Spawns objSpell, charges it via `pChargeCounter` to `chargeMaxBasic (18) + mana.capacity * 3` until `#chargeLimited` fires, then releases the spell via `releaseMagic`.
- **Charge Payload**: Both use the same objSpell → same damage at given charge level.

### Port (TypeScript)
- **Player (cBlast)**: Reads magic.chargeMaxBasic=999, caps via chargeMaxOf() and chargeSpeedOf() with mana scaling.
- **CPU (cBlastAi)**: Reads #attack.bullet (energyBlastBullet) → fires immediate bolt with damage = `power·dmgRef·BULLET_DAMAGE_SCALE`, **NOT charge-dependent**.
  - Code: `control.ts` line 605: `fireBullet(…, speed, l1, team, 100, 0, bmult)` where `l1 = ba.powerScalar * 4.5 * BULLET_DAMAGE_SCALE`.
  - No call to `chargeMaxOf()` for plain bolt casters.

---

## Critical Gap Analysis

### Gap 1: CPU Charge-Based Damage Missing
**Severity**: HIGH  
**Lingo Behavior**: CPU caster spawns an objSpell, charges it to `chargeMaxBasic+mana·modifier`, then releases. The spell's explosion damage scales with its `pCurrentCharge`.  
**Port Behavior**: CPU fires a fixed-damage bolt (`power·dmgRef·BULLET_DAMAGE_SCALE`) regardless of the spell's cBlastAi.chargeMaxBasic or the CPU's mana.

**Evidence**:
- **Lingo** (casts/data/act_cBlastAi.txt, casts/script_objects/objAiCPUSpellCaster.txt lines 65–72):
  - chargeMaxBasic: 18 → sets chargeMax for the objSpell.
  - chargeMaxModifier: 3 → mana capacity scales the charge.
  - CPU fires when spell reaches this charge ceiling.

- **Port** (port/src/components/control.ts lines 534–608):
  - Magic CPU casters route to `attack()` → line 581 `else` branch.
  - No `chargeMaxOf()` call; instead: `const l1 = ba ? ba.powerScalar * 4.5 * BULLET_DAMAGE_SCALE : …`
  - Damage is **static**, not **dynamic per charge**.

**Impact**: A CPU spellcaster with high mana (e.g., flaetorlinInGame mana_capacity=20) would deal:
- **Lingo**: Charge = 18 + 20×3 = 78 → larger explosion (pCurrentCharge 78 / 2 = radius 39).
- **Port**: Charge = 0 → small bolt, ~1× base damage (power 0.5 × dmgRef 4.5 × scale).

This is a **documented approximation** (port fires immediate bolt, not spell actor), but the **damage scaling is wrong**.

---

## Charge Mechanics: Lingo vs. Port

### Lingo (Original)
- CPU spell charges via `modAttack.calcAttackChargeMax()`:
  ```
  chargeMax = min(attack.chargeMax, mana.capacity * attack.chargeMaxModifier + attack.chargeMaxBasic)
  ```
  For cBlastAi: `min(999, mana_capacity * 3 + 18)` → typically 18–100+ depending on CPU mana.

- Spell grows to that size, then explodes radially.

### Port (TypeScript)
- `chargeMaxOf()` (port/src/components/charge.ts) replicates the formula.
- **Player uses it** (PlayerControl line 153): `this.chargeCeil = chargeMaxOf(magic, mana, game.rng, gmg);`
- **CPU ignores it** for plain bolt casters (cBlastAi is plain damage, not summon/heal/mine).

---

## Verification: Data Correctness

✓ **Port data.json resolves cBlastAi correctly**:
```json
{
  "chargeMaxBasic": 18,
  "chargeMaxModifier": 3,
  "chargeSpeed": 0.2,
  "power": 0.5
}
```

✓ **Port charge.ts chargeMaxOf() is faithful** to the original `calcAttackChargeMax()`.

✗ **Port control.ts attack() path skips chargeMaxOf() for CPU plain bolt casters**, so damage never uses the charge ceiling.

---

## Conclusion

**BEHAVIORAL DIVERGENCE CONFIRMED** (GAP 1):

The port fires CPU cBlastAi as an **immediate fixed-damage bolt**, not a **charge-scaled spell**. While this is a **documented visual approximation** (objSpell actor → bolt), the **damage is incorrectly decoupled from the spell's chargeMaxBasic and mana scaling**.

**Expected Fix**: When a CPU fires a plain #magic spell (cBlastAi/darkBlast/arcticBlast), compute its charge ceiling via `chargeMaxOf()` and scale damage (or explosion radius in the eventual visual) accordingly. Currently, all CPU plain-bolt casters deal the same damage regardless of their mana, violating the Lingo equivalence.

---

| Status | Details |
|--------|---------|
| **Data** | ✓ Correct (cBlastAi.chargeMaxBasic=18, chargeMaxModifier=3, chargeSpeed=0.2) |
| **Charge Formula** | ✓ Implemented faithfully in charge.ts |
| **CPU Firing Path** | ✗ Ignores chargeMaxOf() for plain bolt casters |
| **Damage Scaling** | ✗ Static, not charge-dependent |
| **Visual Approximation** | ✓ Acknowledged (immediate bolt, not spell actor) |

