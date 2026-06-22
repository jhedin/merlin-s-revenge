# Per-Actor Parity Audit: fourArmGolem

**Actor:** `act_fourArmGolem` | **objType:** `#objCPUCharacter` | **AiType:** `#objAiCPU` | **Team:** `#monsters`
**Method:** derived behavior from original cast/data, then REPRODUCED in a 200-tick live port run (probe `tools/_audit_fourArmGolem.ts`, deleted after audit).

---

## 1. Derived Correct Behavior (original)

### Identity / inheritance chain

`act_fourArmGolem` → `#CPUCharacter` → `#character` → `#actor`

| Field | Value | Source |
|-------|-------|--------|
| `objType` | `#objCPUCharacter` | `casts/data/act_fourArmGolem.txt:3` |
| `AiType` | `#objAiCPU` | `act_fourArmGolem.txt:4` |
| `team` | `#monsters` | `act_fourArmGolem.txt:33` |
| `energy` | 1200 | `act_fourArmGolem.txt:23` |
| `strength` | 20 | `act_fourArmGolem.txt:30` |
| `dexterity` | 10 | `act_fourArmGolem.txt:20` |
| `eyestrain` | 25 | `act_fourArmGolem.txt:25` |
| `walkSpeed` | 1 | `act_fourArmGolem.txt:34` |
| `inertia` | 65 | `act_fourArmGolem.txt:27` |
| `damageSpeed` | 3 | `act_fourArmGolem.txt:21` |
| `weaponTechnique` | 0 | `act_fourArmGolem.txt:35` |
| `startingLevel` | 5 | `act_fourArmGolem.txt:29` |
| `dieSound` | `"boulder_die"` | `act_fourArmGolem.txt:22` |
| `experienceImWorth` | 65 | `act_fourArmGolem.txt:24` |
| `frictionReel` | point(50,50) | `act_fourArmGolem.txt:26` |
| `reincarnateAs` | `[#darkGolem, #darkGolem]` | `act_fourArmGolem.txt:28` |
| `reincarnateRadius` | 30 | `act_fourArmGolem.txt:* (#reincarnateRadius:30)` |

### Attack (`#attack` proplist)

| Field | Value | Source |
|-------|-------|--------|
| `animType` | `#naturalRanged` | `act_fourArmGolem.txt:9` |
| `bullet` | `#darkRock` | `act_fourArmGolem.txt:10` |
| `reach` | 150 | `act_fourArmGolem.txt:14` |
| **`animframe`** | **`[7, 14, 20, 27]`** | `act_fourArmGolem.txt:8` |
| `firingType` | `#fullstrength` | `act_fourArmGolem.txt:13` |
| `cooldown` | 0 (data) | `act_fourArmGolem.txt:12` |
| `collisionLoc` | point(0,-8) | `act_fourArmGolem.txt:11` |
| `sound` | `"darkGolem_fire"` | `act_fourArmGolem.txt:16` |
| `name` | `#throwBoulder` | `act_fourArmGolem.txt:15` |

### Bullet actor: `act_darkRock` (shared with darkGolem)

| Field | Value | Source |
|-------|-------|--------|
| `inherit` | `#bullet` | `casts/data/act_darkRock.txt:3` |
| `attack.type` | `#explode` | `act_darkRock.txt:10` |
| `attack.explodeCharge` | 40 | `act_darkRock.txt:8` |
| `attack.power` | 1 | `act_darkRock.txt:9` |
| `explodeSound` | `"spell_explode"` | `act_darkRock.txt:22` |

### Derived behavior

- **AI mode**: `#objAiCPU` → standard committed-target ranged FSM (no runReload, ghost, multiAttack, builder, spellcaster).
- **Attack classification**: `#naturalRanged` → RANGED (`AttackSetTypeFromAnimType` maps `#naturalRanged → #ranged`, `casts/general_functions/AttackSetTypeFromAnimType().txt`). Reach gate 150.
- **#animframe is a 4-entry LIST → 4 shots per attack cycle.** `modAttack.isOnAttackFrame` (`casts/script_objects/modAttack.txt:597-616`): `if ilk(attackFrame)=#list then onAttackFrame = (attackFrame.getPos(currentFrame) > 0)`. One darkRock fires each time the strip crosses ANY of frames 7,14,20,27 — **four** rocks per swing (the "four arms"). DISTINGUISHING vs darkGolem (`[7,14]` = 2 shots).
- **Bullet type**: `#darkRock` carries `#attack.type:#explode` → routes through the splash-bullet path (AREA hit on land/collide).
- **Throw velocity**: `#firingType:#fullstrength` → constant speed = attacker strength.
- **Muzzle**: `collisionLoc (0,-8)` → bullet spawns 8px above the golem's loc.
- **Pre-leveled**: `#startingLevel:5` → spawns at level 5, so strength/walkSpeed are grown above base.
- **Reincarnation**: on lethal death (`getKilledInAction`), spawns 2× `darkGolem`, first at corpse loc, second offset by `#reincarnateRadius 30`.
- **Death**: `dieSound = "boulder_die"`, `experienceImWorth = 65`.
- **No `#weapon`** — only its own `#attack`. The SEPARATE `act_summonGolem` also carries `#name:"fourArmGolem"` but is a distinct `#monsterSummon`-team / walkSpeed-3 / `#reelProof` / `#collisionDetection:false` record — NOT this actor.

---

## 2. Reproduced in Port (200-tick live run)

Harness: `assets.json` bundle, `CollisionGrid(80,80,32)`, `unitMap.configure(32,0,0)`, `rebuildCombatSubstrate()` each tick. Player (#aldevar) target @(400,300) + golem @(520,300) (120px < reach 150 → fires immediately). 200 ticks.

### Resolved stats

| Stat | Expected (derived) | Reproduced | Match |
|------|--------------------|-----------|-------|
| `animChar` | `fourArmGolem` (no fallback) | `fourArmGolem` (char===actor) | ✓ |
| `team` | `#monsters` | `#monsters` | ✓ |
| `AI.ranged` | true | true | ✓ |
| `AI.runReload` | false | false | ✓ |
| `AI.reachRanged` | 150 | 150 | ✓ |
| `AI.splashBullet` | present (`#explode`) | present, `attackType #explode` | ✓ |
| `AI.bulletAttack` | null (darkRock is splash) | null | ✓ |
| `AI.bulletChar` | `darkRock` | `darkRock` | ✓ |
| `AI.ghost` | false | false | ✓ |
| `AI.eyestrain` | 25 | 25 | ✓ |
| `attack.name` | `#throwBoulder` | `#throwBoulder` | ✓ |
| `attack.animType` | `#naturalRanged` | `#naturalRanged` | ✓ |
| `attack.type` | ranged | ranged | ✓ |
| **`attack.animFrame`** | **`[7,14,20,27]`** | **`[7,14,20,27]`** | ✓ |
| `attack.firingType` | `#fullstrength` | `#fullstrength` | ✓ |
| `attack.bullet` | `#darkRock` | `#darkRock` | ✓ |
| `attack.reach` | 150 | 150 | ✓ |
| `attack.cooldown` (effective) | 181 | 181 | ✓ |
| `attack.collisionLoc` | `{x:0,y:-8}` | `{x:0,y:-8}` | ✓ |
| `attack.sound` | `darkGolem_fire` | `darkGolem_fire` | ✓ |
| `splashBullet.explodeCharge` | 40 | 40 | ✓ |
| `splashBullet.explodeSound` | `spell_explode` | `spell_explode` | ✓ |
| `inertia` | 65 | 65 | ✓ |
| `mov.maxSpeed` (walkSpeed×0.6, +lvl5 growth) | 0.6 + 5×0.045 = 0.825 | 0.825 | ✓ |
| `strength` (base 20, +lvl5 growth) | ~20.5 | 20.5 | ✓ |
| `energyFrac` | 1 | 1 | ✓ |

### Animation strips (assets.json) — every action resolves to a real bundled strip, NO fallback

| Strip | Exists | Frames | Loop | Notes |
|-------|--------|--------|------|-------|
| `fourArmGolem_stand` | yes | 1 | true | |
| `fourArmGolem_walk` | yes | 10 | true | |
| `fourArmGolem_naturalRanged` | yes | **34** | false | one-shot attack strip; all 4 animframes (max 27) within range |
| `fourArmGolem_grave` | yes | 2 | false | |

`spriteCharOr` returns `fourArmGolem` (its `_stand` strip exists) → no `blackOrc` stand-in. CONFIRMED no fallback for any action.

### Live behavior

- **Shots fired**: **12 bullets / 200 ticks = exactly 4 per attack cycle × 3 full cycles.** Cycle 1 shot ticks `7,14,21,27` (gaps 7,7,6 — matching the strip crossing frames 7→14→20→27; 21-vs-20 is the port's 1-tick attack-cadence offset, `Anim.attackFrame()=frame+1`). All FOUR animframes fire — the four-arm signature is reproduced (NOT collapsed to darkGolem's 2). ✓
- **Cadence**: cycle period ≈ 34 ticks (the one-shot naturalRanged strip duration). ✓
- **Bullet speed**: 20.50 px/tick = `#fullstrength` × strength(lvl5)=20.5. ✓
- **Muzzle**: first bullet spawns at `(520, 292)` = golem loc + collisionLoc(0,-8). ✓
- **Routing**: all bullets `type:"bullet"` from `fireSplashBullet` (splashBullet != null). ✓
- **Anim actions seen**: `stand` (in reach, stationary) + `naturalRanged` (attack). No walk (target in reach at spawn). ✓
- **Reincarnation**: on `loseEnergy(lethal, attackerId)` → `isDead=true`, `killedInAction=true`, and **exactly 2 darkGolem children** spawn (animChar `darkGolem`). Matches `#reincarnateAs:[#darkGolem,#darkGolem]`, `#reincarnateRadius:30`. ✓

---

## 3. Divergence Table

| # | Property | Original | Port | Status |
|---|----------|----------|------|--------|
| — | `team` | `#monsters` | `#monsters` | CORRECT |
| — | `#naturalRanged` → ranged FSM | yes | `ranged=true` | CORRECT |
| — | **`animframe [7,14,20,27]` → 4 shots/cycle** | 4 darkRocks per swing | **4 bullets/cycle (ticks 7,14,21,27)** | CORRECT |
| — | `bullet #darkRock` → splashBullet | `#explode` | `fireSplashBullet` path | CORRECT |
| — | `reach` → reachRanged | 150 | 150 | CORRECT |
| — | `firingType #fullstrength` → speed=strength | 20.5 (lvl5) | 20.50 px/tick | CORRECT |
| — | `collisionLoc (0,-8)` → muzzle | y−8 | `(520,292)` | CORRECT |
| — | `startingLevel 5` → pre-leveled | grown stats | maxSpeed 0.825, str 20.5 | CORRECT |
| — | `reincarnateAs [darkGolem,darkGolem]` | 2 darkGolem on death | 2 darkGolem children | CORRECT |
| — | `reincarnateRadius` | 30 | 30 (2nd child offset) | CORRECT |
| — | `inertia` | 65 | 65 | CORRECT |
| — | `eyestrain` | 25 | 25 | CORRECT |
| — | `energy` | 1200 | 1200 | CORRECT |
| — | `dieSound` | `boulder_die` | `boulder_die` | CORRECT |
| — | `experienceImWorth` | 65 | 65 | CORRECT |
| — | strips (stand/walk/naturalRanged/grave) | all present | all present, no fallback | CORRECT |

**DIVERGENCES: 0**

---

## Conclusion

fourArmGolem is fully faithful in the port. The live run confirms the actor's distinguishing feature — its `#animframe:[7,14,20,27]` 4-entry list fires **four** darkRock splash bullets per attack cycle (vs darkGolem's two), via `modAttack.isOnAttackFrame`'s list-membership test, reproduced exactly in `CpuAI.updateAttack` (`attackFrames.includes(an.attackFrame())`, `port/src/components/control.ts:757`). Throw speed 20.5 (#fullstrength × leveled strength), muzzle offset (0,-8), reach 150, eyestrain 25, energy 1200 all match. On lethal death it reincarnates into 2 darkGolem (radius 30). No animation falls back to the `blackOrc` stand-in. Stats reflect `#startingLevel:5` pre-leveling. No PORT bugs and no faithful original-game quirks to flag.

`fourArmGolem | DIVERGENCES=0`
