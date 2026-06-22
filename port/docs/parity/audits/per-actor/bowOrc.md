# Actor Audit: act_bowOrc

**Audit Date:** 2026-06-22
**Port Version:** TypeScript
**Original Spec:** `casts/data/act_bowOrc.txt`
**Actor Type:** CPU-controlled hostile ranged unit (orc archer)
**Method:** Derived behavior from original cast + inherit chain, then REPRODUCED in port via live probe
(`port/test/_audit_bowOrc.test.ts` — 11 tests all passing).

---

## 1. Derived Correct Behavior (from Original)

### Identity / Team
- `#name: "bowOrc"`, `#team: #orcs` (hostile to `#aldevar`)
- `#objType: #objCPUCharacter`, `#AiType: #objAiCPU` (standard committed-target FSM)
- `#inherit: #CPUCharacter → #character → #actor` (no own `#attack`; weapon supplies it)

### Stats
- `#energy: 300`, `#strength: 8`, `#dexterity: 10` (ranged cooldown recovery)
- `#walkSpeed: 6` → port px `6 * 0.6 = 3.6 px/tick`
- `#inertia: 55` (moderate knockback resistance)
- `#damageSpeed: 2` (wall-slam threshold: takes impact − 2 damage when reeling into a wall above speed 2)
- `#eyestrain: 50` (large aim scatter at range)
- `#weaponTechnique: -5` (slows attack animation)
- `#experienceImWorth: 30`, `#startingLevel: 0`, `#dieSound: #none`

### Weapon: `#crossBow` (act_crossBow.txt)
- `#animType: #weaponRanged` → ranged FSM branch
- `#animframe: [2, 4, 6]` → **3 shots per attack** (fires on strip frames 2, 4, and 6)
- `#bullet: #crossBolt` → spawns `crossBolt` projectile
- `#collisionLoc: point(0, -2)` → bullet fires from `(x, y−2)` in original
- `#cooldown: 8`
- `#firingType: #fullstrength` → bullet speed = attacker strength = 8 px/tick
- `#reach: 100` → attack when within 100 px
- `#sound: "orc_fire"` → plays on attack

### Bullet: `#crossBolt` (act_crossBolt.txt)
- `#attack.damageMultiplier: 4`, `#attack.power: 0.7`, `#attack.type: #bullet`
- `#name: "crossBolt"` → sprite char `crossBolt` → `crossBolt_fly` strip
- `#weight: 1.6`, `#friction: point(5,5)`

### Art Strips (all bundled as `bowOrc_*`)
- `bowOrc_stand`: 1 frame
- `bowOrc_walk`: 8 frames, delay 2
- `bowOrc_weaponRanged`: 10 frames (total 28 ticks), delays [2,3,3,3,3,3,2,3,4,2]; firing frames 2,4,6
- `bowOrc_grave`: 2 frames (death → grave, modGrave)
- No `bowOrc_die` strip (correct; enemies use the grave strip, not a separate die strip)

### AI Behavior
- FSM: `findTarget → moveToAttack → attack → attackFin` (standard `#objAiCPU`)
- Does NOT kite (`#runReload` absent from data; `#AiType` is `#objAiCPU`, not `#objAiCPUSpellCaster`)
- `#pathfinding: true` (inherited from `#CPUCharacter`), enables scenic pathfinding
- Retargets every 30 frames; dazed on reel/recoil/die
- `weaponTechnique: -5` → `WeaponTechnique` accumulates negative cache → `frameExtendDelay` → attack anim slows down during sustained firing

---

## 2. Reproduce vs. Observed (Port)

All 11 probe tests pass. Results from `port/test/_audit_bowOrc.test.ts`:

| Property | Derived (Original) | Observed (Port) | Match |
|---|---|---|---|
| `team` | `#orcs` | `#orcs` | ✅ |
| `energy` | 300 | 300 | ✅ |
| `walkSpeed` | 6 → 3.6 px/tick | 3.6 px/tick (`m.maxSpeed`) | ✅ |
| `inertia` | 55 | 55 | ✅ |
| `weaponTechnique` | -5 | -5 | ✅ |
| `anim.char` | `"bowOrc"` | `"bowOrc"` (not blackOrc fallback) | ✅ |
| `bowOrc_stand` | 1 frame | 1 frame | ✅ |
| `bowOrc_walk` | 8 frames | 8 frames | ✅ |
| `bowOrc_weaponRanged` | 10 frames | 10 frames | ✅ |
| `bowOrc_grave` | 2 frames | 2 frames | ✅ |
| `ai.ranged` | true | true | ✅ |
| `ai.reachRanged` | 100 | 100 | ✅ |
| `ai.runReload` | false | false | ✅ |
| `atk.animType` | `#weaponRanged` | `#weaponRanged` | ✅ |
| `atk.animFrame` | `[2,4,6]` | `[2,4,6]` | ✅ |
| `atk.firingType` | `#fullstrength` | `#fullstrength` | ✅ |
| `atk.bullet` | `#crossBolt` | `#crossBolt` | ✅ |
| `atk.sound` | `"orc_fire"` | `"orc_fire"` | ✅ |
| `ai.bulletChar` | `"crossBolt"` | `"crossBolt"` | ✅ |
| `ai.bulletAttack.powerScalar` | 0.7 | 0.7 | ✅ |
| `ai.bulletAttack.damageMultiplier` | 4 | 4 | ✅ |
| shots per attack | 3 (frames 2,4,6) | **3** (observed 15 attacks × 3 shots) | ✅ |
| bullet speed | 8 px/tick (`#fullstrength`, strength 8) | **8.000 px/tick** | ✅ |
| `ai.eyestrain` | 50 | 50 | ✅ |
| technique cache | negative (slows anim) | −35 after 100 ticks | ✅ |
| `runReload` mode seen | never | never observed | ✅ |
| `atk.cooldown` | 261 (calibrated: (8+18)×10+1) | 261 | ✅ |
| `damageSpeed` (wall-slam threshold) | **2** | **5** (wrong — default, not forwarded) | ❌ |
| bullet fire position | `(x, y−2)` via `collisionLoc: point(0,−2)` | `(x, y−6)` (hardcoded offset) | ❌ |

---

## 3. DIVERGENCES

### D-1: `damageSpeed` not forwarded — port uses default 5 instead of 2

**Original** (`casts/data/act_bowOrc.txt:6`):
```
#damageSpeed: 2
```

**Original behavior** (`casts/script_objects/modEnergy.txt:249–253` + `objCPUCharacter.txt:103–115`):
When the bowOrc is in `#reel` / `#reel_fly` / `#reel_land` mode and collides with a wall or ceiling,
`takeDamage(impactSpeed)` is called. `modEnergy.takeDamage` applies damage only when
`impactSpeed > pDamageSpeed`, subtracting `pDamageSpeed` from the hit:
```
if amount > pDamageSpeed then
  amount = amount - pDamageSpeed
  me.loseEnergy(amount)
```
With `pDamageSpeed = 2`, the bowOrc takes wall-slam damage at very low impact speeds (threshold 2).

**Port behavior** (`port/src/components/movement.ts:67`, line 188–192):
```typescript
this.damageSpeed = typeof cfg["damageSpeed"] === "number" ? cfg["damageSpeed"] : 5;
```
`damageSpeed` IS correctly read from `cfg` in Movement, but `spawnEnemy` in
`port/src/entities/archetypes.ts` never includes `damageSpeed` in the `e.build({...})` call
(lines 284–347 — the property is absent). The Movement component therefore always gets the default 5.

**Confirmed** by probe:
```
damageSpeed: 5   (should be 2)
```

**Effect:** bowOrc takes wall-slam damage only above speed 5 (port) instead of speed 2 (original).
Any reel with impact ≤ 5 deals no bonus damage; impacts between 2–5 that should deal `speed − 2` damage
are lost. The bowOrc survives wall-slamming knockbacks more easily than intended.

**Fix sketch:**
In `port/src/entities/archetypes.ts`, add `damageSpeed` to the `e.build({...})` config:
```typescript
damageSpeed: num("damageSpeed", 5),   // wall-slam threshold (modEnergy.takeDamage)
```
This passes the data value through to `Movement.init`, which already reads it correctly.

---

### D-2: Bullet fire position uses hardcoded `y − 6` instead of `collisionLoc: point(0, −2)`

**Original** (`casts/data/act_crossBow.txt:11`):
```
#collisionLoc: point(0, -2)
```

**Original behavior** (`casts/script_objects/modAttack.txt:185–199` `calcAttackLoc`):
```
on calcAttackLoc me
  dir = SpriteGetFlipHAsDir(me.pSpr)
  attackLoc = pAttack.collisionLoc.duplicate()
  attackLoc[1] = attackLoc[1] * dir
  attackLoc = me.pCharacterPrg.getLoc() + attackLoc
  return attackLoc
```
The crossBolt spawns at `(x + 0 × dir, y + (−2)) = (x, y − 2)`.

**Port behavior** (`port/src/components/control.ts:822`):
```typescript
pb = fireBullet(this.entity.id, m.x, m.y - 6, ...);
```
The bullet always spawns at `(x, y − 6)`, a fixed 6-pixel vertical offset. The `collisionLoc` field
is stored in `AttackData` (resolved by `resolveAttack`) but never read in the ranged attack dispatch.

**Effect:** The crossBolt spawns 6 px below the bowOrc's origin (port) instead of 2 px below (original).
This is a cosmetic difference (bullet emerges slightly lower). It does not affect targeting, damage, or
reach — only the visual spawn point of the bolt. At typical frame rates this is barely perceptible.

**Fix sketch:**
In `CpuAI.performAttack` (ranged branch), replace the hardcoded `m.y - 6` with:
```typescript
const atk = wm.getCurrentAttack();
const colY = atk ? (atk as any).collisionLocY ?? -6 : -6; // from resolveAttack
pb = fireBullet(this.entity.id, m.x, m.y + colY, ...);
```
Requires exposing `collisionLoc.y` as a field in `AttackData` (currently stored but not named).
Low priority (cosmetic only).

---

## Notes (not divergences)

- **`bowOrc_die` strip absent**: Correct. Enemies use the `_grave` strip via `modGrave.drawGrave`;
  no `_die` strip is expected for CPU characters.
- **`#runReload` correctly false**: The old audit (2026-06-21) incorrectly listed "runReload" as a
  behavior of bowOrc — it does not kite. Confirmed by probe (no `runReload` mode observed).
- **`#collisionLoc point(0,-2)` x-axis**: The x-component is 0 (center of the actor), so the facing
  direction flip has no effect on the bolt origin (x doesn't shift either way). Only the y offset matters.
- **`weaponTechnique: -5`** (initial) vs. the **`weaponTechniqueInc`** gap identified in `archer.md`:
  The bowOrc carries an explicit negative initial `#weaponTechnique: -5` (slows anim from frame 1),
  not `#weaponTechniqueInc`. The port correctly reads this as the initial value. The
  `WeaponTechnique.INC = 2` hardcoding affects per-level growth but bowOrc starts at level 0 and
  rarely levels, so this is a very minor concern.
- **`damageSpeed` is a systemic gap**: The same missing-forward affects every actor with a
  non-default `damageSpeed` (e.g., `archer: 4`, `swordOrc: 2`, `bug: 2`). bowOrc is one instance.
  The fix in archetypes.ts (D-1 above) would resolve it for all actors simultaneously.
