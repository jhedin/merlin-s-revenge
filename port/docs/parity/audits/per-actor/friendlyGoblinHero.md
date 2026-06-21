# Actor Audit: friendlyGoblinHero

**Audit Date:** 2026-06-21  
**Original Data:** casts/data/act_friendlyGoblinHero.txt  
**Resolved Data:** port/src/generated/data.json (act_friendlyGoblinHero)  
**Port Spawn Logic:** port/src/entities/archetypes.ts (spawnUnit → spawnEnemy)

---

## Property Coverage & Behavioral Verification

| Property | Original | Port Resolution | Verified | Notes |
|----------|----------|------------------|----------|-------|
| **objType** | #objCPUCharacter | spawnUnit routing → spawnEnemy arch | ✓ | Resolves to EnemyArchetype |
| **AiType** | #objAiCPU | Used line 171 (str("AiType")) | ✓ | Default CpuAI FSM; not special-cased |
| **inherit** | #CPUCharacter | Registry resolved in data | ✓ | Inheritance chain: CPUCharacter → character |
| **energy** | 50 | num("energy", 40) at line 264 | ✓ | Direct numeric property |
| **strength** | 8 | num("strength", 5) at line 265 | ✓ | Direct numeric property |
| **dexterity** | 10 | num("dexterity", 0.2) at line 174 | ✓ | Used as ranged cooldown counter inc |
| **team** | #village | str("team", "#monsters") at line 266 | ✓ | Routed via spawnUnit: isPlayerSide("#village")=true → e.type="ally" |
| **startingLevel** | 20 | Loop lines 313-314: `for(i=0; i<20; i++) e.send("forceLevelUp")` | ✓ | 20 pre-level-ups applied; stats scaled correctly |
| **inertia** | 50 | num("inertia", 0) at line 268 | ✓ | Knockback resistance property |
| **walkSpeed** | 4 | num("walkSpeed", 3) × 0.6 at line 263 | ✓ | Engine walk units → px/tick; 4 × 0.6 = 2.4 px/tick |
| **name** | "gar" | animChar at line 267 | ✓ | Display name |
| **weapon** | #goblinBow | resolveWeapon lines 155-162 | ✓ | No own attack → use weapon's; resolves to #weaponRanged |
| **experienceImWorth** | 100 | num("experienceImWorth", 0) at line 296 | ✓ | XP granted on death |
| **dieSound** | #none | str("dieSound", ...) at line 295 | ✓ | Death audio |
| **damageSpeed** | 3 | — | — | Catalogued non-issue |
| **eyestrain** | 5 | — | — | Catalogued non-issue |
| **weaponTechnique** | -75 | num("weaponTechnique", 0) at line 279 | ✓ | Attack-anim speedup rating; negative slows |
| **minimapStatus** | #clr | — | — | Catalogued non-issue (actor-level minimap display) |

---

## Behavioral Correctness

### 1. Ranged Weapon Classification ✓

**Original:** #weapon:#goblinBow carries #attack.animType:#weaponRanged → CPU fires at range (FSM = ranged).

**Port:**
- goblinBow.attack.animType = "#weaponRanged" (verified in port/src/generated/data.json)
- Line 169: `ranged = opts.ranged ?? (animType === "#weaponRanged" || ...)`
- ranged=true → runReload FSM engaged (line 211, ranged && !ghost)
- WeaponManager receives attack with correct reach (100 px) and bullet (#goblinArrow)

**Status:** ✓ CORRECT

### 2. Team Allegiance & Ally Routing ✓

**Original:** #team:#village → vil\_*.txt #friends:[#aldevar, #monsterSummon] → hunts #hates, not #aldevar.

**Port:**
- act_friendlyGoblinHero.data.team = "#village" (verified in data.json)
- spawnUnit line 56: `team = d["team"]` → "#village"
- Line 58: `if (game.teamMaster.isPlayerSide(team)) e.type = "ally"`
- TeamMaster.isPlayerSide line 82: `if (teamName === "#aldevar") return true; return this.team("#aldevar").friends.includes(teamName)`
- tem_aldevar.friends = ["#village", "#monsterSummon"] (verified in data.json)
- isPlayerSide("#village") = true → e.type = "ally"
- Targeting resolved correctly: #village.hates tiers drive target selection (not player)

**Status:** ✓ CORRECT

### 3. startingLevel Pre-Levelling (20 forceLevelUp) ✓

**Original:** objCPUCharacter.pStartingLevel = 20 → init runs `repeat 1 to 20: levelUp`.

**Port:**
- spawnEnemy line 313: `const startLevel = num("startingLevel", 0)`
- Returns 20 (from data)
- Lines 314: `for (let i = 0; i < 20; i++) e.send("forceLevelUp")`
- Loops 20 times, sending forceLevelUp each iteration
- Each component's levelUp handler (Energy, Experience, Mana) processes the level-up
- experienceImWorth remains 100 (NOT raised; faithful to property note)

**Status:** ✓ CORRECT

### 4. AI & Movement Logic ✓

**Original:** #objAiCPU + #walkSpeed:4 → CPU FSM hunts targets at max walk speed.

**Port:**
- EnemyArchetype includes EnemyAI component (line 36)
- EnemyAI reads runReload (true for ranged), ghost (false), dodgesBullets (false), multiAttack (false)
- CpuAI FSM: committed-target loop (findTarget → moveToAttack → dazed)
- Ranged=true → moveToAttack keeps distance (targetReach=150 at line 294); fires from range
- walkSpeed = 4 × 0.6 = 2.4 px/tick (faithfully tuned to px slice)

**Status:** ✓ CORRECT

### 5. Weapon Technique (weaponTechnique: -75) ✓

**Original:** modWeaponTechnique -75 → attack-anim speedup rating (negative = slower swing).

**Port:**
- Line 279: `weaponTechnique: num("weaponTechnique", 0)`
- Returns -75
- WeaponTechnique component applies to attack-anim duration (not flagged; catalogued non-issue)

**Status:** ✓ CATALOGUED (do not flag weaponTechnique divergence)

---

## Comparison: act_goblinHero (Enemy Version)

| Property | friendlyGoblinHero | goblinHero | Diff |
|----------|-------------------|-----------|------|
| team | #village | #goblins | allegiance |
| minimapStatus | #clr | (none) | friendly-only visibility |
| all others | identical | identical | parity ✓ |

Both share startingLevel:20, #goblinBow weapon, same stats. The only behavioral differences are team allegiance and minimap rendering (non-issue).

---

## Conclusion

**✓ CLEAN**

All properties are read and applied correctly. Behavioral parity is achieved:
- Ranged attack classification and weapon resolution work faithfully
- Team #village routes to ally type with correct hostile-targeting (hates, not aldevar)
- startingLevel:20 pre-levelling applies all 20 forceLevelUp iterations
- Movement, AI FSM, and cooldown calibration preserve original feel

No gaps detected.
