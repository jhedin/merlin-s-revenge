# Audit: speedyGuy

**Source:** `casts/data/act_speedyGuy.txt`
**Port entry:** `port/src/entities/archetypes.ts` → `spawnEnemy("speedyGuy", …)`
**Probe:** `port/tools/_audit_speedyGuy.ts` (executed against the REAL `src/generated/assets.json`, then deleted)
**Method:** Live reproduction — loaded the real asset bundle, spawned `speedyGuy` 190px from a hostile (`#aldevar`) target in an 80×80 grid, ran 300 frames with `rebuildCombatSubstrate()` per tick. Intercepted `teamMaster.impactMeleeAttack` to count hits and read `Anim.attackFrame()`; sampled `Movement.v` while approaching; inspected sprite-char resolution, reach, cooldown, facing, and grave.

speedyGuy is a near-clone of `karateGuy` on team `#karate`: same `#naturalMelee` `#punchKick` attack, same `#animframe [5,8,12]`. It differs by lower energy (150 vs 200), faster walk (6 vs 4), lower damageMultiplier (90 vs 100), and a different `collisionLoc` (12,3 vs 4,0). Its defining trait is the high `#walkSpeed: 6`.

---

## 1. Identity

| Field | Original (cast file) | Resolved (port runtime) |
|---|---|---|
| `#name` | `"speedyGuy"` | `"speedyGuy"` |
| `#objType` | `#objCPUCharacter` | `EnemyArchetype` (CpuAI + CPU module stack) |
| `#AiType` | `#objAiCPU` | `CpuAI` (committed-target melee FSM) — `ranged=false` |
| `#inherit` | `#CPUCharacter` → `#character` → `#actor` | full chain via `registry.resolveActor` |
| `#team` | `#karate` | `#karate` (observed `Team.getTeam() == "#karate"`) |

**Team allegiance** (`casts/data/tem_karate.txt:7`):
`#karate` hates `[#aldevar, #cave, #monsterSummon, #goblins, #magicalAlliance, #ninja, #undead, #orcs, #village]`.
The player is `#aldevar`, so speedyGuy hunts the player and its allies. Reproduced: spawned vs an `#aldevar` target, the FSM acquired it on frame 0 (`findTarget → moveToAttack`) and engaged.

**Sprite char** — the actor carries no `#data` block; the sprite is resolved from `#name` by `spriteCharOr` (`anim.ts:30`). The bundle ships a full `speedyGuy` strip set, so it renders its OWN art (NOT the `blackOrc` stand-in):

```
spriteCharOr('speedyGuy') = "speedyGuy"      (NOT blackOrc)
speedyGuy_stand: frames=1  loop=true  delay=3
speedyGuy_walk:  frames=8  loop=true  delay=1
speedyGuy_naturalMelee: frames=15 loop=false delay=1   (all per-frame dela=1)
speedyGuy_grave: frames=2 loop=false delay=3
speedyGuy_reel:  frames=2 loop=false delay=3
```

---

## 2. Derived-vs-Reproduced Table

| Property | Original value | Derived expectation | REPRODUCED (runtime) | Status |
|---|---|---|---|---|
| `#energy` | `150` | `Energy.energy = max = 150` | `energy=150, max=150` | OK |
| `#strength` | `10` | `CpuAI.power = max(4, round(10/3 + atkPow=0.01)) = 4` | `power=4` | OK |
| `#walkSpeed` | `6` | `Movement.maxSpeed = 6 × 0.6 = 3.6 px/tick` | `maxSpeed=3.6`; **max walk |v| = 3.600** | OK |
| `#inertia` | `50` | `Movement.inertia = 50` | `inertia=50` | OK |
| `#damageSpeed` | `3` | `Movement.damageSpeed = 3` (wall-slam threshold) | `damageSpeed=3` | OK |
| `#dexterity` | `10` | stored; melee cooldown inc uses **agility (=default 1)**, not dexterity | inc=1 (see §3) | OK |
| `#eyestrain` | `25` | stored; ranged-only (`modifyLocWithEyestrain`) — inert for melee | inert | OK |
| `#dieSound` | `#none` | `Energy.dieSound = "#none"` → no death audio | `dieSound="#none"` | OK |
| `#experienceImWorth` | `10` | `Experience.imWorth = 10` | passed through build | OK |
| `#startingLevel` | `0` | no forced level-ups at spawn | no `forceLevelUp` | OK |
| `#weaponTechnique` | `0` | `WeaponTechnique = 0` → no anim speedup | inert | OK |
| `#attack.name` | `#punchKick` | `ca.name = "#punchKick"` | `#punchKick` | OK |
| `#attack.animType` | `#naturalMelee` | `ca.animType="#naturalMelee"`, `ca.type="melee"` | `animType=#naturalMelee, type=melee` | OK |
| `#attack.animframe` | `[5, 8, 12]` | `ca.animFrame=[5,8,12]`, **3 hits / swing** | `[5,8,12]`; **3 hits/swing observed** | OK |
| `#attack.damageMultiplier` | `90` | `ca.damageMultiplier = 90` | `90` | OK |
| `#attack.power` | `point(0.01,0)` | `atkPower = 0.01`; per-hit ≈ 0.01·10·0.18·90 ≈ 1.6 | passed through | OK |
| `#attack.collisionLoc` | `point(12,3)` | `ca.collisionLoc={x:12,y:3}`; melee reach = `clamp(12,16,90)=16` | `collisionLoc={x:12,y:3}`, `reach=16` | OK |
| `#attack.cooldown` | `0` | effective ≈ 11 (B2 re-derive: see §3) | `ca.cooldown=11` | OK (documented re-derive) |
| `#attack.hits` | `[#teamMembers,#teamBuildings]` | `ca.hits=[#teamMembers,#teamBuildings]` | matches | OK |
| `#attack.sound` | `"wizard_punch"` | `ca.sound="wizard_punch"` | `wizard_punch` | OK |
| AI FSM | `#objAiCPU` melee | `findTarget→moveToAttack→attack→attackFin` | `moveToAttack` on t=0, then in-place swing loop | OK |
| Facing | faces target | `facingLeft = dx<0` | target on the right → `facingLeft=false` | OK |
| `graveOn` | not set → leaves grave | `graveOn=true`, holds `#grave` frame | `getGraveOn()=true`, isGrave path reached | OK |
| Anim strips | stand/walk/naturalMelee/grave/reel | all 5 present for `"speedyGuy"` | all present | OK |

---

## 3. Reproduction — What Was Observed

### Sprite / blackOrc check
`spriteCharOr("speedyGuy")` → `"speedyGuy"`; the live `Anim.char == "speedyGuy"`, and all five action strips resolve from the real bundle. **No blackOrc fallback.** (`anim.ts:42` — `anims["speedyGuy_stand"]` exists, so the `#name` branch returns the real char.)

### Movement speed (the defining trait)
While in `moveToAttack` closing the 190px gap, peak `|v| = 3.600 px/tick` — exactly `walkSpeed 6 × 0.6` (`archetypes.ts:335`). 50% faster than karateGuy's 2.4, faithfully preserving the data ratio (6 vs 4).

### Melee combo — 3 hits per swing, verified
The `#naturalMelee` strip is 15 frames, one-shot, all `dela=1`. Over 300 frames the unit ran 17 swings; **16 of 17 fired exactly 3 hits at frames [5, 8, 12]** (the 1 outlier is a truncated first/last window at the trace boundary):

```
swing 1: 3 hits at frames [5,8,12]
swing 2: 3 hits at frames [5,8,12]
swing 3: 3 hits at frames [5,8,12]
swing 4: 3 hits at frames [5,8,12]
hits-per-swing distribution: [3,3,3,3,3,3,3,3,3,3,3,3]
```

`Anim.frameFresh() && attackFrames.includes(attackFrame())` (`control.ts:754`) fires once per fresh crossing at indices 5/8/12 — matching the original `isOnAttackFrame` (`modAttack`).

### Reach
Melee reach derives from the strike point `|collisionLoc.x| = 12`, clamped to `[16,90]` → **16** (`archetypes.ts:329`, `control.ts:508`). Observed `CpuAI.reach == 16`. (`#reach` is ranged-only and absent here.)

### Cooldown / cadence (B2 re-derive)
`#cooldown: 0` ("as fast as the strip allows"). The port back-solves an effective cooldown (`archetypes.ts:216-234`): inc = **agility (default 1)** for melee (NOT `#dexterity 10`); fire-frame offset = sum of per-frame `dela` before the gating frame 12 = 11; `framesWanted = max(1, ceil((0-1)/1) + 11) = 10`; `effectiveCooldown = round(10·1 + 1) = 11`. Observed `ca.cooldown == 11`. The counter recovers in ~10 ticks, well inside the ~15-tick strip, so cadence is **strip-bound** — the unit swings back-to-back, which is the felt behavior of a `#cooldown:0` brawler. Same calibration mechanism as karateGuy (`karateGuy.md:45`).

### Death / grave
On lethal energy, `getGraveOn() == true` (no `#graveOn:false` in data) and the sprite resolver reaches the `isGrave` branch (`anim.ts:194`). The probe's `sprite()` returned `null` ONLY because the harness loads no image bitmaps (`images` Map is empty → `anim.ts:200` skips the frame); this is a **probe-harness artifact**, not a port divergence — the grave-selection logic is correct.

---

## 4. Divergences

**None (port behavior).** Every property from `act_speedyGuy.txt` is correctly read, resolved, and applied. The high walkSpeed (3.6 px/tick), the 3-hit `[5,8,12]` punchKick combo, melee reach 16, `#karate` allegiance, facing, and grave all reproduce faithfully. The sprite resolves to the real bundled `speedyGuy` strip, not `blackOrc`.

### Faithful re-derivations (NOT bugs)
- **Effective cooldown 11** from `#cooldown:0` — the B2 §f.3 calibration; the original's "fire as fast as the strip allows" maps to a counter that recovers inside the strip. Strip-bound cadence is preserved.
- **Reach clamped 12 → 16** — `collisionLoc.x=12` is below the `[16,90]` floor; the unit stands where its strike area still overlaps the target rather than requiring pixel overlap.
- **`#dexterity 25`/`#eyestrain 25`** are stored but inert for a melee unit (both read only on the ranged aim path). Faithful — they have no melee effect in the original either.

### Corrections to the PRIOR version of this audit (doc-only, the earlier pass was code-read, not reproduced)
- It claimed melee reach clamps to **[16, 40]** → reach. The actual clamp is **[16, 90]** (`control.ts:508`), giving **16**, not a 40-derived value.
- It claimed cooldown "**effective 19 frames @ agility=10**". speedyGuy has **no `#agility`** (defaults to 1); the `10` is `#dexterity`, which melee does not use. The reproduced effective cooldown is **11**, recovering in ~10 ticks.

These were errors in the previous write-up, not behavioral divergences in the port.

---

speedyGuy | DIVERGENCES=0
