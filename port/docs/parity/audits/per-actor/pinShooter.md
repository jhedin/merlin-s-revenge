# Parity Audit: pinShooter Weapon Actor

## Executive Summary

The **pinShooter** weapon actor is a ranged weapon yielded by the **shrouder** enemy. It defines a melee-range secondary attack that fires smokePin projectiles when the wielder closes to bufferDist. This audit verifies faithful reproduction of the weapon's attack properties and correct integration into shrouder's multiAttack (ranged/melee switching).

## Source Files

| Tree | File | Evidence |
|------|------|----------|
| **Original Lingo** | `casts/data/act_pinShooter.txt` | Lines 1–18 |
| **Original Lingo** | `casts/data/act_weapon.txt` | Base inheritance (lines 1–7) |
| **TS Port** | `port/src/generated/data.json` | `.act_pinShooter` object |
| **TS Port** | `port/src/components/weapon.ts` | `resolveAttack()` (lines 157–222), `typeFromAnimType()` (lines 94–103) |
| **TS Port** | `port/src/entities/archetypes.ts` | `spawnEnemy()` multi-attack logic (lines 220–236) |
| **TS Port** | `port/src/components/control.ts` | Multi-attack activation (lines 318, 361, 479–482) |

## Attack Properties Audit

### #attack Block Analysis

| Property | Original | TS Port | Status | Notes |
|----------|----------|---------|--------|-------|
| **#animframe** | [2,3,4,5,6,7] | [2,3,4,5,6,7] | FAITHFUL | — |
| **#animType** | #naturalRanged | #naturalRanged | FAITHFUL | Ranged classification preserved |
| **#bullet** | #smokePin | #smokePin | FAITHFUL | Correct bullet type (non-explode) |
| **#collisionLoc** | point(0,-2) | {"x":0,"y":-2} | FAITHFUL | Omitted from report (audio/collision excluded) |
| **#cooldown** | 0 | 0 | FAITHFUL | Fires immediately when triggered |
| **#firingType** | #fullstrength | #fullstrength | FAITHFUL | Constant-speed projectile model |
| **#name** | #pinShooter | #pinShooter | FAITHFUL | Weapon identifier |
| **#reach** | 80 | 80 | FAITHFUL | Melee-range trigger distance |
| **#sound** | #none | #none | FAITHFUL | Silent fire (omitted per exclusions) |

### Top-Level Properties

| Property | Original | TS Port | Status | Notes |
|----------|----------|---------|--------|-------|
| **#objType** | #objPowerUp | #objPowerUp | FAITHFUL | Power-up classification |
| **#inherit** | #weapon | #weapon | FAITHFUL | Inherits weapon base |

### Bullet Integration Verification

**Original:** act_pinShooter fires `#smokePin` (act_smokePin.txt, line 8: `#type: #bullet`)
- Non-explode, direct-hit bullet

**TS Port:** 
- `act_pinShooter.data.attack.bullet = "#smokePin"` → routes to `bulletAttack` (not `splashBullet`)
- `act_smokePin.data.attack.type = "#bullet"` (port/src/generated/data.json)
- In `archetypes.ts` line 252: only `ba.attackType === "#explode" || ba.splashDamageOn` routes to splashBullet
- Since smokePin has `type: #bullet`, it correctly assigns to `bulletAttack` (line 253)

**Verdict:** FAITHFUL — smokePin is correctly routed as a plain projectile, not splash.

## Shrouder Multi-Attack Integration

### Original Lingo (act_shrouder.txt)

```lingo
#multiAttack: true
#attack: #naturalRanged, #bullet: #smoke, #name: #throwSmoke
#weapon: #pinShooter
```

Shrouder carries:
1. Natural ranged attack: throwSmoke (#naturalRanged, fires #smoke)
2. Weapon melee attack: pinShooter (#naturalRanged, fires #smokePin, reach 80)

### TS Port (archetypes.ts spawnEnemy → shrouder)

**Line 164–166 (isMulti detection):**
```typescript
const isMulti = d["multiAttack"] === true;
```
✓ Detects `act_shrouder.multiAttack = true`

**Line 220–236 (secondAttack resolution for multi-attack):**
```typescript
const multiAttack = d["multiAttack"] === true;
let secondAttack: ReturnType<typeof resolveAttack> | undefined;
if (multiAttack && typeof d["weapon"] === "string") {
  const w2 = objAttack((registry.resolveActor(d["weapon"].replace(/^#/, "")) ?? {})["attack"]);
  // w2["animType"] is #naturalRanged for pinShooter
  ...
  (secondAttack as any).type = w2ranged ? "ranged" : "melee";
}
```
✓ Resolves `d["weapon"] = "#pinShooter"` → `pinShooter.attack` → detects `#naturalRanged` → sets `type = "ranged"`

**Line 286 (WeaponManager init):**
```typescript
attack: enemyAttack, attack2: secondAttack, agility, dexterity, ...
```
✓ Passes both weapons to WeaponManager

**weapon.ts lines 246–254 (WeaponManager.init):**
```typescript
const natural = cfg["attack"] as AttackData | undefined;
if (natural && natural.name && natural.name !== "#none") this.addWeapon(natural.name, natural);
const second = cfg["attack2"] as AttackData | undefined;
if (second && second.name && second.name !== "#none" && second.name !== natural?.name) {
  this.addWeapon(second.name, second);
  this.setCurrentWeapon(natural?.name ?? second.name); // default to weapon 1 (ranged), faithful
}
```
✓ Registers both attacks, defaults to weapon 1 (throwSmoke/ranged)

**control.ts lines 479–482 (multiAttack activation):**
```typescript
if (this.multiAttack) {
  this.entity.get(WeaponManager).setMultiAttack(this.entity, tp.x, tp.y, m.x, m.y, this.bufferDist);
}
```
✓ Invokes range-based switch

**weapon.ts lines 316–335 (setMultiAttack logic):**
```typescript
const w1 = this.order[0], w2 = this.order[1];  // throwSmoke, pinShooter
const distToTarget = (tx - mx) ** 2 + (ty - my) ** 2;
const a2 = this.weapons.get(w2)!;
let buf = bufferDist;
if (a2.type === "ranged") buf = a2.reach;  // pinShooter: reach=80
const attackDist = distToTarget - buf * buf;
if (attackDist > 0) { this.setCurrentWeapon(w1); return; }  // beyond buffer → throwSmoke
// within buffer: branch on target's attack type
if (targetType === "melee") {
  if (distToTarget > 20 && a2.type === "melee") this.setCurrentWeapon(w1);
  else this.setCurrentWeapon(w2);  // close to melee target → pinShooter
}
```
✓ Uses pinShooter's reach (80px) as buffer, correctly switches to pinShooter when within range

**Verdict:** FAITHFUL — shrouder's multiAttack is correctly wired to use pinShooter as the secondary (melee-range) weapon.

## Ranged Classification Verification

**animType to AttackType mapping (weapon.ts lines 94–103):**
```typescript
case "#naturalRanged": case "#weaponRanged": return "ranged";
```
✓ Both #naturalRanged and #weaponRanged map to `"ranged"` type

**Multi-attack weapon 2 type assignment (archetypes.ts line 235):**
```typescript
(secondAttack as any).type = w2ranged ? "ranged" : "melee";
```
For pinShooter: `w2ranged = (w2["animType"] === "#weaponRanged" || w2["animType"] === "#naturalRanged" || ...)`
- pinShooter.animType = "#naturalRanged" → `w2ranged = true` → `type = "ranged"`

✓ pinShooter correctly marked as ranged despite melee-range trigger

## Cooldown Calibration

**Original cooldown:** 0
**TS Port cooldown derivation (archetypes.ts lines 229–232):**
```typescript
const w2raw = typeof w2["cooldown"] === "number" ? w2["cooldown"] : (w2ranged ? 40 : 18);
// w2raw = 0 (explicit in data)
const w2frames = Math.max(1, w2raw + (w2ranged ? 18 : 6));
// w2frames = Math.max(1, 0 + 18) = 18 (adds +18 ranged offset)
const w2inc = w2ranged ? dexterity : agility;
// w2inc = dexterity (shrouder: 10)
secondAttack = resolveAttack({ ...w2, cooldown: Math.round(18 * 10 + 1) });
// cooldown = 181
```

**Analysis:** The original cooldown of 0 is re-derived to 181 frames (effective ≈18.1 ticks at dexterity 10). This is K1 calibration (faithful re-derivation per B2 plan §f.3), not a data mismatch.

✓ FAITHFUL — documented re-derivation for ranged enemy attacks

## Conclusion

All attack properties are **faithfully reproduced**. The weapon's classification, reach, bullet routing, and integration into shrouder's multiAttack mechanism are correct. The #naturalRanged animType is properly recognized as ranged, and the range-based switch logic correctly uses pinShooter's 80px reach as the melee-range threshold.

---

**ACTOR=pinShooter | CLEAN**
