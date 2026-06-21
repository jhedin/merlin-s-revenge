# Weapon Actor Parity Audit: thunderSticks

## Summary
Auditing the **thunderSticks** weapon (#objType #objPowerUp #inherit #weapon) wielded by **thunderMonk** (#objCPUCharacter #objAiCPU).

thunderSticks defines a ranged weapon attack that fires #thunderBlast, a splash/explode bullet. This audit verifies faithful resolution of the #attack block and weapon classification in the TypeScript port.

---

## Source Data

### Original Lingo (casts/data/act_thunderSticks.txt)
```
[#name: "act_thunderSticks", #type: #field]
[
#objType: #objPowerUp,
#inherit: #weapon,
#attack:
[
#animframe: 13,
#animType: #weaponRanged,
#bullet: #thunderBlast,
#collisionLoc: point(0,-2),
#cooldown: 0,
#firingType: #fullstrength,
#name: #thunderSticks,
#reach: 300,
#sound: #none
]
]
```

### Port Resolution (port/src/generated/data.json)
```json
"act_thunderSticks": {
  "header": { "name": "act_thunderSticks", "type": "#field" },
  "data": {
    "objType": "#objPowerUp",
    "inherit": "#weapon",
    "attack": {
      "animframe": 13,
      "animType": "#weaponRanged",
      "bullet": "#thunderBlast",
      "collisionLoc": { "x": 0, "y": -2 },
      "cooldown": 0,
      "firingType": "#fullstrength",
      "name": "#thunderSticks",
      "reach": 300,
      "sound": "#none"
    }
  }
}
```

### Fired Bullet (act_thunderBlast)
- **attack.type**: `#explode` (casts/data/act_thunderBlast.txt:8, port: data.json)
- **attack.explodeCharge**: 100 (both)
- **attack.power**: 0.5 (both)
- Inherits from #bullet; fires as a splash/explode projectile

---

## Attack Property Resolution

| Property | Original (Lingo) | Port (TS) | resolveAttack() Path | Status |
|----------|------------------|-----------|----------------------|--------|
| **animType** | #weaponRanged | #weaponRanged | `r["animType"]` → "weaponRanged" (weapon.ts:161) | ✓ FAITHFUL |
| **bullet** | #thunderBlast | #thunderBlast | `r["bullet"]` → "thunderBlast" (weapon.ts:182) | ✓ FAITHFUL |
| **type** (attack classification) | N/A (determined by bullet) | #explode (from thunderBlast bullet) | resolveAttack detects splashBullet via ba.attackType (archetypes.ts:252) | ✓ FAITHFUL |
| **reach** | 300 (scalar) | 300 | `numOr(r["reach"], default)` → 300px (weapon.ts:172) | ✓ FAITHFUL |
| **cooldown** | 0 | 0 | `numOr(r["cooldown"], default)` → 0 (weapon.ts:176) | ✓ FAITHFUL |
| **firingType** | #fullstrength | #fullstrength | `strOr(r["firingType"], default)` → "fullstrength" (weapon.ts:183) | ✓ FAITHFUL |
| **power** | N/A on weapon (lives on thunderBlast: 0.5) | N/A on weapon (lives on thunderBlast: 0.5) | Weapon carries no power; bullet's power is read at fire time | ✓ FAITHFUL |
| **name** | #thunderSticks | #thunderSticks | `strOr(r["name"], default)` → "thunderSticks" (weapon.ts:174) | ✓ FAITHFUL |
| **sound** | #none | #none | `strOr(r["sound"], default)` → "none" (weapon.ts:181) | ✓ FAITHFUL |
| **hits** | N/A (weapon has no hits field) | N/A (weapon has no hits field) | Uses default STRUCT_ATTACK.hits (weapon.ts:180) | ✓ FAITHFUL |
| **explodeCharge** | N/A (lives on bullet thunderBlast: 100) | N/A (lives on bullet thunderBlast: 100) | Bullet's explodeCharge resolved separately (weapon.ts:212) | ✓ FAITHFUL |

---

## Ranged Classification & Splash Bullet Handling

### animType → Attack Type
- **Original behavior**: #weaponRanged signals a ranged weapon that fires its #bullet.
- **Port behavior** (typeFromAnimType, weapon.ts:94-102):
  - `#weaponRanged` → `type = "ranged"` ✓
  - Port treats both #weaponRanged and #naturalRanged as ranged.

### Splash/Explode Bullet Detection
thunderMonk spawning (archetypes.ts:238-254):
```typescript
// SPLASH-bullet caster (C2): a ranged CPU whose #attack.bullet is a splash/explode bullet
// fires the real splash bullet — on land/collide it resolves an AREA hit through SplashDamage.
if (ranged && typeof atk["bullet"] === "string" && atk["bullet"] !== "#none") {
  const bulletActor = registry.resolveActor(atk["bullet"].replace(/^#/, ""));
  const ba = bulletActor ? resolveAttack(bulletActor["attack"], bulletActor) : undefined;
  if (ba && (ba.attackType === "#explode" || ba.splashDamageOn)) splashBullet = ba;  // ← resolves thunderBlast
  else if (ba) bulletAttack = ba;
}
```

- thunderBlast's attack.type = "#explode" (casts/act_thunderBlast.txt:8)
- Port resolves this as `attackType = "#explode"` (weapon.ts:211)
- Condition `ba.attackType === "#explode"` matches → **splashBullet assigned** ✓

### Firing Path (control.ts:553-558)
```typescript
} else if (this.splashBullet) {
  // a static turret (dwarfTower) / splash caster fires its real splash bullet (towerAxe)
  const tg = this.entity.send("getTargeting") as { hits: string[] } | undefined;
  const sb = fireSplashBullet(this.entity.id, m.x, m.y - 6, dx, dy, throwSpeed, 
    this.splashBullet, team, this.splashBullet.hits, tg?.allegiance ?? "#enemy", 140);
```

- thunderMonk fires #thunderBlast via `fireSplashBullet()` (ranged CPU + splashBullet flag)
- throwSpeed determined by firingType (#fullstrength) → `strength` instead of proportional (control.ts:544) ✓
- splashBullet carries attackType="#explode" → resolves as area-hit via resolveSplash (splash.ts:49-78)

### Splash Resolution (splash.ts:53-78)
```typescript
const explode = attack.attackType === "#explode";
const radius = explode ? attack.explodeCharge / 2 : attack.powerScalar;
```

- thunderBlast.attack.explodeCharge = 100 → radius = 50px ✓
- Hits all hostiles in disc at (cx, cy) with radial falloff (calcCollisionVectSpell) ✓

---

## Wielder Validation

**thunderMonk** (primary wielder):
- Source: casts/data/act_thunderMonk.txt / port: data.json
- Weapon reference: `#weapon: #thunderSticks` (both)
- dexterity: 10 (ranged skill stat for cooldown recovery)
- Cooldown calibration verified in thunderMonk.md (lines 84-90)

---

## Summary Table: thunderSticks Properties

| Property | Lingo Source | Port Source | Match | Notes |
|----------|--------------|-------------|-------|-------|
| #objType | #objPowerUp | #objPowerUp | ✓ | Pickup type |
| #inherit | #weapon | #weapon | ✓ | Base weapon properties |
| attack.animframe | 13 | 13 | ✓ | Animation frame (not used in gameplay) |
| attack.animType | #weaponRanged | #weaponRanged | ✓ | Ranged classification |
| attack.bullet | #thunderBlast | #thunderBlast | ✓ | Splash/explode bullet |
| attack.collisionLoc | point(0,-2) | {x:0, y:-2} | ✓ | Position offset (not used) |
| attack.cooldown | 0 | 0 | ✓ | Calibrated per dexterity at spawn |
| attack.firingType | #fullstrength | #fullstrength | ✓ | Constant-speed throw (strength-based) |
| attack.name | #thunderSticks | #thunderSticks | ✓ | Weapon symbol |
| attack.reach | 300 | 300 | ✓ | Firing range (px) |
| attack.sound | #none | #none | ✓ | Swing sound (silent) |

---

## Conclusion

**ACTOR=thunderSticks | CLEAN**

All attack properties of thunderSticks resolve faithfully between the original Lingo and TypeScript port. The weapon is correctly classified as ranged (#weaponRanged), properly fires #thunderBlast as a splash/explode projectile (attack.type=#explode), and applies splashBullet resolution through SplashDamage with the expected area radius (explodeCharge/2 = 50px) and radial falloff. Cooldown calibration per wielder's dexterity stat is accurate. No behavioral divergences detected.
