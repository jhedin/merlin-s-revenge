# Behavioral Audit: act_skeletonBow

**Class:** weapon (#objType #objPowerUp #inherit #weapon). Defines the #attack its wielder (skeletonArcher) uses when firing.

**Wielder:** skeletonArcher (act_skeletonArcher.txt, line 20: #weapon: #skeletonBow)

**Scope:** #attack block + top-level properties (`#animType`, `#bullet`, `#reach`, `#cooldown`, `#firingType`, `#power`, `#name`, `#sound`, `#hits`).

---

## Data Comparison

### Original (casts/data/act_skeletonBow.txt)

```lingo
[#name: "act_skeletonBow", #type: #field]
[
#objType: #objPowerUp,
#inherit: #weapon,
#attack:
[
#animframe: 7,
#animType: #weaponRanged,
#bullet: #goblinArrow,
#collisionLoc: point(5,2),
#cooldown: 0,
#firingType: #fullstrength,
#name: #fireArrow,
#reach: 160,
#sound: "goblin_fire"
]
]
```

### Port (port/src/generated/data.json)

```json
{
  "header": { "name": "act_skeletonBow", "type": "#field" },
  "data": {
    "objType": "#objPowerUp",
    "inherit": "#weapon",
    "attack": {
      "animframe": 7,
      "animType": "#weaponRanged",
      "bullet": "#goblinArrow",
      "collisionLoc": { "x": 5, "y": 2 },
      "cooldown": 0,
      "firingType": "#fullstrength",
      "name": "#fireArrow",
      "reach": 160,
      "sound": "goblin_fire"
    }
  }
}
```

---

## Property-by-Property Audit

| Property | Original | Port | Classification | Evidence |
|---|---|---|---|---|
| **#animType** | #weaponRanged | #weaponRanged | **FAITHFUL** | casts/data/act_skeletonBow.txt:8; port/src/generated/data.json (attack.animType). Classification in port/src/components/weapon.ts:94-103 (`typeFromAnimType`): #weaponRanged → "ranged" attack type. |
| **#bullet** | #goblinArrow | #goblinArrow | **FAITHFUL** | casts/data/act_skeletonBow.txt:9; port/src/generated/data.json (attack.bullet). Resolves to act_goblinArrow.txt in both. |
| **#reach** | 160 | 160 | **FAITHFUL** | casts/data/act_skeletonBow.txt:14; port/src/generated/data.json (attack.reach). Port/src/components/weapon.ts:171-172 normalizes point→radius; scalar 160 passes through unchanged. Port/src/entities/archetypes.ts:260-261 computes `targetReach` from #reach for enemy targeting. |
| **#cooldown** | 0 | 0 | **FAITHFUL** | casts/data/act_skeletonBow.txt:11; port/src/generated/data.json (attack.cooldown). Port/src/entities/archetypes.ts:180 reads raw cooldown; line 188 derives `effectiveCooldown = Math.round(framesWanted * counterInc + 1)` where counterInc = dexterity (10 for skeletonArcher, casts/data/act_skeletonArcher.txt:7) and framesWanted = max(1, rawCooldown + 18) = 18 (since rawCooldown=0, ranged→+18). Result: Math.round(18*10 + 1) = 181 frames. Faithfully re-derived per B2 plan §f.3. |
| **#firingType** | #fullstrength | #fullstrength | **FAITHFUL** | casts/data/act_skeletonBow.txt:12; port/src/generated/data.json (attack.firingType). Port/src/components/control.ts:544 classifies as fullstrength. Line 545: `throwSpeed = Math.max(1, this.strength)` = 11 (skeletonArcher strength). Faithful to original (constant-speed projectile). |
| **#power** | (inherited from #weapon, defaults to structAttack {x:5, y:-1}) | {x:5, y:-1} | **FAITHFULLY OMITTED** | casts/data/act_skeletonBow.txt: no #power override (inherits structAttack default). Port/src/data/registry.ts:27 (STRUCT_ATTACK): power default {x:5, y:-1}. Port/src/components/weapon.ts:163-167: powerScalar computed as L1(5,1)=6. Enemy melee only; ranged uses bullet's power (goblinArrow.power=0.5). |
| **#name** | #fireArrow | #fireArrow | **FAITHFUL** | casts/data/act_skeletonBow.txt:13; port/src/generated/data.json (attack.name). Weapon name for cooldown tracking. |
| **#sound** | "goblin_fire" | "goblin_fire" | **FAITHFUL** | casts/data/act_skeletonBow.txt:15; port/src/generated/data.json (attack.sound). Port/src/entities/archetypes.ts:292 forwards as atkSound to WeaponManager; port/src/components/control.ts: sound not replayed here (audio out of scope for B2 per PORTING_PLAN). |
| **#hits** | (structAttack default ["#teamMembers"]) | ["#teamMembers"] | **FAITHFULLY OMITTED** | casts/data/act_skeletonBow.txt: no override. Port/src/data/registry.ts:27 default. Port/src/entities/archetypes.ts:297 applies: ranged enemy fires at ["#teamMembers"]. |

---

## Firing Behavior Verification

### Original (Lingo — modAttack.performRangedAttack)
- Ranged attack reads #firingType to determine throw velocity.
- #fullstrength → speed = attacker's strength (skeletonArcher strength=11).
- Bullet fired: #goblinArrow (act_goblinArrow.txt).
- Reach: 160 px (melee distance threshold).

### Port Implementation
**File: port/src/components/control.ts:530–620**

1. **Ranged classification** (line 534): `if (this.ranged)` — set during spawn (archetypes.ts:169).
2. **Firing type dispatch** (line 544): 
   ```ts
   const isFullStrength = (ftAttack?.firingType ?? "#proportional").toLowerCase() === "#fullstrength";
   const throwSpeed = isFullStrength ? Math.max(1, this.strength) : Math.max(0.5, throwDist / 10);
   ```
   For skeletonBow: isFullStrength=true, throwSpeed=11.
3. **Bullet fired** (line 616): `fireBullet(…, speed, l1, team, 100, 0, bmult)` where `speed=throwSpeed` (11), `l1=goblinArrow.power*dmgRef*BULLET_DAMAGE_SCALE` = 0.5*4.5*0.40 ≈ 0.9.
4. **No splash logic invoked** (lines 546–559 skipped): goblinArrow has no #splashDamageOn or #explode.
5. **Cooldown gate** (line 533): `if (!wm.getCooldownFin()) return;` — cooldown counter managed per weapon.

**Ranged classification at spawn** (archetypes.ts:169–170):
```ts
const ranged = opts.ranged ?? (animType === "#weaponRanged" || animType === "#magic"
  || animType === "#naturalRanged");
```
✓ animType=#weaponRanged → ranged=true.

**Reach used for targeting distance** (archetypes.ts:260–261, 298):
```ts
const targetReach = typeof rch === "number" ? rch
  : (rch && typeof rch === "object" && "x" in rch ? Math.hypot(rch.x, rch.y) : undefined);
...
targetReach: targetReach ?? (ranged ? 150 : 22),
```
✓ reach=160 → ranged enemy uses it (not the 150 default).

---

## Conclusion

**ACTOR=skeletonBow | CLEAN**

All audited attack properties resolve faithfully:
- Ranged classification correct (animType=#weaponRanged).
- Bullet correctly fired (#goblinArrow).
- Firing type honored (#fullstrength → constant speed = strength 11).
- Reach correctly passed (160 px for engage distance).
- Cooldown faithfully re-derived per B2 plan (raw 0 + ranged +18 = 18 frames, ×dexterity 10 = 181 frames).

No divergences detected between original act_skeletonBow.txt and port implementation in archetypes.ts/weapon.ts/control.ts.
