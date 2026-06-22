# Per-Actor Parity Audit: ninja

**Date:** 2026-06-22
**Method:** Probe spawned + ticked 200 frames with a player target. Real `assets.json` loaded so missing art falls back visibly. Original behavior derived from `casts/data/act_ninja.txt`, `act_ninjaSword.txt`, `casts/script_objects/objAiCPU.txt`, `objAiAttack.txt`, `modAttack.txt`, `modWeaponManager.txt`, `objCPUCharacter.txt`.

---

## Identity & Derived Correct Behavior

| Property | Original value / behavior |
|---|---|
| Name / char | `"ninja"` / sprite char `ninja` |
| Team | `#ninja` (enemies; hates #aldevar + most other teams per `tem_ninja.txt`) |
| AiType | `#objAiCPU` — committed-target FSM (findTarget → moveToAttack → attack → attackFin) |
| ObjType | `#objCPUCharacter` — grave on death |
| Energy | 120 |
| Strength | 12 |
| WalkSpeed | 5 (→ 3.0 px/tick in port, ×0.6 conversion) |
| Inertia | 60 (heavy; resists knockback) |
| Dexterity | 3 (ranged cooldown counter inc) |
| Eyestrain | 30 (aim scatter at range) |
| ExperienceImWorth | 10 |
| StartingLevel | 0 |
| WeaponTechnique | 20 (attack-anim speedup) |
| **multiAttack** | `true` — 2-weapon range-based switch (K6) |
| **Weapon 1 (primary, ranged)** | Natural attack: `#naturalRanged`, bullet `#shuriken`, `#animframe:12`, reach 200, firingType `#fullstrength`, collisionLoc `(0,−2)`, cooldown 0, sound `#none` |
| **Weapon 2 (melee, close)** | `#ninjaSword` (via `#weapon`): `#weaponMelee`, `#animframe:13`, collisionLoc `(15,0)`, idealAttackLoc `(15,0)`, power `(0.7,0)`, damageMultiplier 4, hits `[#teamMembers,#teamBuildings]`, sound `skeleton_fire` |
| **multiAttack switch rule** | `bufferDist=100`; beyond buffer → shuriken; within buffer: if target's attack is `#melee` AND dist²>20 AND w2 is `#melee` → stay on shuriken (poke from range); else switch to ninjaSword. (`modWeaponManager.txt:343–388`) |
| Animations | `ninja_stand` (1f), `ninja_walk` (8f), `ninja_naturalRanged` (18f), `ninja_weaponMelee` (16f), `ninja_reel` (1f), `ninja_grave` (2f) — all present in `assets.json` |
| Shuriken bullet | `act_shuriken`: friction `(1,1)`, weight 0.4, rotational false, attack power 0.5, damageMultiplier 5, type `#bullet` |
| Death / grave | `#objCPUCharacter` → `modGrave`: leaves `ninja_grave` sprite at death loc, facing right |
| No reincarnation | No `#reincarnateAs` / `#reincarnateInto` |
| No runReload | No kiting; original `pRunReload` default false |

---

## Reproduced (Port Observed) vs Derived Table

| Attribute | Original (derived) | Port (observed) | Match? |
|---|---|---|---|
| Team | `#ninja` | `#ninja` | ✓ |
| Energy | 120 | 120 | ✓ |
| WalkSpeed (px/tick) | 3.0 | 3.0 (Movement.maxSpeed) | ✓ |
| Inertia | 60 | 60 | ✓ |
| Eyestrain | 30 | 30 | ✓ |
| Dexterity | 3 | 3 | ✓ |
| Ranged (primary FSM) | true | true | ✓ |
| multiAttack flag | true | true | ✓ |
| RunReload | false | false | ✓ |
| Ghost | false | false | ✓ |
| WeaponManager: weapon 1 | `#shuriken`, ranged, animFrame [12], reach 200, `#fullstrength` | ✓ all fields match | ✓ |
| WeaponManager: weapon 2 | `#ninjaSword`, melee, animFrame [13], collisionLoc {15,0}, power 0.7, mult 4, hits `[#teamMembers,#teamBuildings]` | ✓ all fields match | ✓ |
| Shuriken bullet art | `shuriken_fly` present | `shuriken_fly` present | ✓ |
| ninja_stand/walk/reel/grave | all present | all present | ✓ |
| ninja_naturalRanged (18f) | frames 1–18, fires on frame 12 | 18 frames, frame 12 in range | ✓ |
| ninja_weaponMelee (16f) | fires on frame 13 | 16 frames, frame 13 in range | ✓ |
| multiAttack weapon switch | TARGET's attack type → choice | **SELF passed as targetObj** | ✗ |
| Switch behavior vs melee target | Stay on shuriken if target is melee AND dist>20 | Switches to ninjaSword (wrong) | ✗ |
| Cooldown cadence | ~18 frames/shot (framesWanted=18, inc=3 → hi=55, recovery=18f) | ~21 frames/shot (observed) | ~close |
| Grave | `ninja_grave`, 2 frames | present, drawn on death | ✓ |

---

## DIVERGENCES

### DIV-1 (Bug): `setMultiAttack` passes `self` instead of the committed `target` as `targetObj`

**Original** (`casts/script_objects/modWeaponManager.txt:355–356`):
```lingo
targetObj = me.ID.bigMe.pAi.getRelation(#target)  -- the ninja's committed TARGET
```
Then `targetObj.getAttack().type` determines whether to stay on weapon 1 or switch to weapon 2.

**Port** (`port/src/components/control.ts:647`):
```ts
this.entity.get(WeaponManager).setMultiAttack(this.entity, tp.x, tp.y, m.x, m.y, this.bufferDist);
//                                             ^^^^^^^^^^^
//                                             passes self (the ninja), NOT this.target
```
**Port** (`port/src/components/weapon.ts:344–351`):
```ts
const targetType = (targetObj.send("getTargeting") as ...) ? this.targetAttackType(targetObj) : "melee";
```
When `targetObj === ninja` (self), `targetAttackType` reads the ninja's own current weapon type, not the player's.

**Observable effect (reproduced by probe):**
- Close-range scenario (20px): weapons oscillate every ~16 frames — `#shuriken→#ninjaSword@1, #ninjaSword→#shuriken@16, #shuriken→#ninjaSword@33, ...`
- Mid-range scenario (43px within bufferDist=100, melee target): port switches to ninjaSword when it should stay on shuriken (original: `if distToTarget > 20 and pWeapons[2].type = #melee then setCurrentWeapon(pWeapons[1].name)`)

**Correct behavior:** When within `bufferDist` and target's attack type is `#melee` and dist²>20 and weapon-2 is melee → stay on weapon 1 (ranged shuriken). The port does the inverse — always switches to weapon 2 (ninjaSword) for any non-melee reading of self's current weapon.

**Fix sketch:** In `control.ts:647`, pass `this.target` instead of `this.entity`:
```ts
this.entity.get(WeaponManager).setMultiAttack(this.target, tp.x, tp.y, m.x, m.y, this.bufferDist);
```
This affects ALL multiAttack actors (ninja and shrouder). Both share the same `updateMoveToAttack` code path.

---

### DIV-2 (Minor): `melee reach` clamp in `syncWeaponMode` uses structAttack `#reach` default (25), not `#collisionLoc.x` (15)

**Original** (`objAiCPU.targetInReachMelee`): melee reach is the strike point `loc + collisionLoc·dir`, where ninjaSword `#collisionLoc.x = 15`. With a 14px target box the effective approach distance is ~25px.

**Port** (`port/src/components/control.ts:661`):
```ts
this.reach = Math.max(16, Math.min(40, ca.reach));
```
`ca.reach` for ninjaSword = 25 (structAttack default, no explicit `#reach` in `act_ninjaSword.txt`). Result: `Math.max(16, Math.min(40, 25)) = 25`. Numerically close to the original's effective ~25px, so no observable combat difference. Not filed as a divergence affecting gameplay but noted for completeness.

---

### DIV-3 (Confirmed minor): Shot cadence is ~21 frames rather than the theoretical ~18

**Original:** `#cooldown:0`, `#dexterity:3`. Counter hi = `round(18 × 3 + 1) = 55`; recovery = `ceil(54/3) = 18` frames.

**Port (observed by probe):** Inter-shot intervals 17, 21, 21, 21, ... — first interval 17f (attack starts immediately), subsequent ~21f. The extra 3 frames are the `attackT` safety window overhead (`ATTACK_FRAMES + strip_ticks + 2`): the 18-frame `ninja_naturalRanged` strip + 2 safety ticks = 20f attack window, during which the cooldown partially recovers; the counter finishes its last tick on re-entry to `moveToAttack`. This is a compounded rounding effect, not a logic error. The 3-frame discrepancy (21 vs 18) is within the expected implementation tolerance given the animation-window integration.

---

## Non-Divergences (Verified Correct)

- All 6 expected animation strips present in `assets.json` with correct frame counts; no fallback to blackOrc.
- `#shuriken` bullet actor resolves correctly: `shuriken_fly` strip present; `damageMultiplier:5`, `power:0.5`.
- `#hits: ["#teamMembers"]` on the shuriken attack (structAttack default) correctly forwarded.
- `#hits: ["#teamMembers","#teamBuildings"]` on ninjaSword correctly forwarded.
- `Targeting.allegiance = "#enemy"`, `Targeting.criteria = "#closestDistance"` (structAttack defaults).
- `Grave.graveOn = true` (no `#ghost`); `ninja_grave` (2 frames) will render at death loc.
- `ranged=true` → committed-target FSM uses `reachRanged=200` for approach gating.
- `runReload=false` → ninja does NOT kite; it stays to attack after firing.
- `eyestrain=30` stored in `CpuAI`; used by `aimWithEyestrain` to scatter ranged shots at distance.
- `weaponTechnique=20` forwarded to `WeaponTechnique` component (attack-strip speedup).
- `inertia=60` forwarded to `Movement`; ninja resists knockback correctly.
- Shuriken fires on `animframe:12` of the 18-frame `naturalRanged` strip — frame 12 exists; will fire once per strip play per attack.
- NinjaSword fires on `animframe:13` of the 16-frame `weaponMelee` strip — frame 13 exists.
