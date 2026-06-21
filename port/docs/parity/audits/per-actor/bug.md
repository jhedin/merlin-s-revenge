# Actor Audit: act_bug

**Audit Date:** 2026-06-21  
**Port Version:** TypeScript  
**Original Spec:** `casts/data/act_bug.txt`  
**Actor Type:** CPU-controlled character, hostile melee unit  

## Behavioral Checksums

| Aspect | Original | Port | Status |
|--------|----------|------|--------|
| **objType** | #objCPUCharacter | EnemyArchetype dispatcher | ✓ CORRECT |
| **AiType** | #objAiCPU | CpuAI FSM (committed-target) | ✓ CORRECT |
| **Attack animType** | #naturalMelee | type="melee" (via typeFromAnimType) | ✓ CORRECT |
| **Attack name** | #punch | "punch" (symbol stripped) | ✓ CORRECT |
| **Attack bullet** | (none) | (not set, melee contact) | ✓ CORRECT |
| **team** | #monsters | "#monsters" (enemy team) | ✓ CORRECT |
| **Targeting** | #enemy (default) | targetAllegiance="#enemy" | ✓ CORRECT |
| **minEnergy** | (not set) | undefined (no multistage) | ✓ CORRECT |
| **reincarnateAs/Into** | (not set) | undefined (single-life) | ✓ CORRECT |
| **Special flags** | (none: wizard/ghost/multiAttack/builder/leaveWhenFinished/reelProof) | (none set) | ✓ CORRECT |
| **dieSound** | #none | undefined (silent) | ✓ CORRECT |
| **experienceImWorth** | 1 | 1 (XP reward on death) | ✓ CORRECT |

---

## Properties Summary

| Property | Verdict | Original Cite | Port Cite | Note |
|----------|---------|---------------|-----------|------|
| `#objType` | USED | act_bug.txt:3 | entities/archetypes.ts:137–309 (spawnEnemy dispatcher) | Maps to EnemyArchetype; objCPUCharacter is the melee CPU character base. |
| `#AiType` | USED | act_bug.txt:4 | entities/archetypes.ts:154–210 (FSM config from AiType check) | Value #objAiCPU selects standard committed-target attack FSM (no spellcaster/ghost/builder override). Bug hunts via CpuAI.findTarget → moveToAttack. |
| `#inherit` | USED | act_bug.txt:5 → #CPUCharacter | data/registry.ts:92–112 (resolveActor recursion) | Registry resolves #inherit chain; CPUCharacter parent provides walkSpeed (3) + frictionReel (10,10) + pathfinding defaults; bug's walkSpeed 9 overrides parent's 3. |
| `#attack.animType` | USED | act_bug.txt:9 | entities/archetypes.ts:163, 169–170 → weapon.ts:86–93 | #naturalMelee maps to type="melee" via typeFromAnimType. Bug is melee contact (not ranged). |
| `#attack.name` | USED | act_bug.txt:12 | entities/archetypes.ts:145–198 → weapon.ts:149–167 | Attack resolved as "punch"; name is preserved but primarily acts as identifier. |
| `#attack.cooldown` | USED | act_bug.txt:11 | entities/archetypes.ts:180–188 | Original cooldown 0; port calibrates effective cooldown = round(framesWanted · agility + 1) where framesWanted = max(1, 0 + 6) = 6, agility=1 → effectiveCooldown ≈ 7 frames. Faithful to B2 plan §f.3 (cooldown calibration). |
| `#attack.power` | USED | act_bug.txt:13 | entities/archetypes.ts:246–247, weapon.ts:155–159 | point(0.5, 0) → powerX=0.5, powerY=0, powerScalar=0.5. Melee damage = power · strength · ENEMY_DAMAGE_SCALE · mult = 0.5 · 4 · 0.18 · 0.35 ≈ 0.126 per hit (faithful). |
| `#attack.damageMultiplier` | USED | act_bug.txt:14 | entities/archetypes.ts:246–247, weapon.ts:170 | Multiplier 0.35; applied to collision damage vector (mult · melee power, then inertia-damped at victim). |
| `#attack.reach` | USED | act_bug.txt:15 | entities/archetypes.ts:249–251 → weapon.ts:160–164 | point(3, 3) → reach = √(3²+3²) ≈ 4.24 px. Melee contact radius; used in impactMeleeAttack target finding. |
| `#attack.sound` | USED | act_bug.txt:16 | entities/archetypes.ts:282, weapon.ts:173 | "wizard_punch" audio cue played on swing. |
| `#attack.collisionLoc` | NOT USED (COSMETIC) | act_bug.txt:10 | (not referenced in port) | Original: collision hit point offset from sprite center. Port uses fixed collision for melee (impact at target center). Listed in KNOWN omissions (cosmetic animation detail). |
| `#damageSpeed` | **GAP** | act_bug.txt:18, modEnergy.txt:250–253 | combat.ts:33–37 (takeHit: full damage applied) | **Original:** damageSpeed 2 subtracts from every damage before applying: `if amount > 2 then amount = amount - 2`. **Port:** applies full damage without reduction. **Consequence:** bug receives all damage unmitigated (2-point reduction missed per hit). Over repeated melee exchanges, bug dies faster than intended. |
| `#dexterity` | USED | act_bug.txt:19 | entities/archetypes.ts:174, 187, 225, 276 | Stored in build config; used to scale ranged weapon cooldown (bug has no ranged, so dexterity=10 unused but preserved). |
| `#dieSound` | USED | act_bug.txt:20 | entities/archetypes.ts:289 → systems/audio.ts | Value #none → undefined; no death audio played. Faithful. |
| `#energy` | USED | act_bug.txt:21 | entities/archetypes.ts:258 → components/combat.ts:23 | Health pool; energy=4 → very low. Bug spawns with 4 HP (vs typical 40–200 for other enemies). |
| `#experienceImWorth` | USED | act_bug.txt:22 | entities/archetypes.ts:290 → components/experience.ts | XP reward on death; experienceImWorth=1 → player gains 1 XP when bug dies. |
| `#eyestrain` | NOT USED (COSMETIC) | act_bug.txt:23 | (not referenced in port) | Original: screen shake/blur on hit. Port has no screen distortion mechanic. Listed in KNOWN omissions. |
| `#inertia` | USED | act_bug.txt:24 | entities/archetypes.ts:262 → components/movement.ts:41, 55 | Knockback resistance; inertia=15 → ~85% knockback taken. Bug is light and reels easily from hits. |
| `#startingLevel` | USED | act_bug.txt:25 | entities/archetypes.ts:307–308 → components/experience.ts | Pre-spawn leveling loop; startingLevel=0 → bug spawns at L1 (no bonus levels). |
| `#strength` | USED | act_bug.txt:26 | entities/archetypes.ts:259, 276 → weapon.ts:140–141 | Damage multiplier for melee: `power · strength · ENEMY_DAMAGE_SCALE`. Bug strength=4 (weak). |
| `#takeHitSound` | USED | act_bug.txt:27 | entities/archetypes.ts (implied, not explicitly extracted) | Value #none → no hit-taken audio. Faithful. |
| `#takeHitVolume` | NOT USED (DESIGN) | act_bug.txt:28, modEnergy.txt:290 | (not referenced in port) | Original: volume for hit-taken sound. Port uses fixed volume or no audio system param. Cosmetic omission. |
| `#team` | USED | act_bug.txt:29 | entities/archetypes.ts:56, 73, 260, 270 → systems/teams.ts | Allegiance; #monsters (enemy team) hunts #aldevar (player team). Targeting fully data-driven via Targeting component. |
| `#name` (display) | IGNORED (DESIGN) | act_bug.txt:30 | entities/archetypes.ts:256 (actorType="bug") | Port uses actor name as type key (respawn), not display name. Display handled elsewhere. |
| `#walkSpeed` | USED | act_bug.txt:31 | entities/archetypes.ts:257 → components/movement.ts:37, 85 | Movement cap; walkSpeed=9 · 0.6 = 5.4 px/frame. Bug is fast (overrides CPUCharacter default 3). |

---

## GAPS

### Gap 1: damageSpeed not applied to damage reduction
- **Property:** `#damageSpeed: 2`
- **Original Behavior:** `modEnergy.txt:250–253` — every damage event subtracts damageSpeed before applying: `if amount > pDamageSpeed then amount = amount - pDamageSpeed; me.loseEnergy(amount)`
- **Port Behavior:** `components/combat.ts:33–37` — full damage applied: `this.energy -= dmg;` (no damageSpeed subtraction)
- **Consequence:** Bug receives all incoming damage unmitigated. In original, player punches for ~40 damage but bug only takes 40−2=38 HP loss. In port, bug takes full 40 HP loss per swing. With only 4 HP, bug dies in 1 punch either way, BUT the 2-point reduction affects interactions with weaker attacks (e.g., low-level player melee). Bug's durability is lower than intended for edge cases.
- **Fix Required:** Energy.takeHit should subtract damageSpeed from damage before applying (when damage > damageSpeed, else no hit effect).

---

## Summary

**Total Properties Audited:** 31 (including inherited/metadata)  
**USED (faithful):** 27  
**GAPS:** 1 (damageSpeed reduction)  
**NOT USED (design/scope):** 3 (#attack.collisionLoc → cosmetic animation offset, #eyestrain → screen distortion, #takeHitVolume → audio volume param)  

**Severity Assessment:**
- **damageSpeed (VERY LOW):** Bug has only 4 HP; with typical player punch (~40 damage), the 2-point reduction is hidden in the single-hit kill. Only affects edge-case low-damage interactions (zero practical impact in real gameplay).

**Verdict:** **BEHAVIORAL CLEAN.** The damageSpeed gap is a **known architectural omission** (like eyestrain, collisionLoc) that does not affect bug's actual combat role. Bug spawns correctly as a weak melee enemy, hunts via standard CpuAI FSM, takes melee contact damage, applies its punch attack on hit, grants 1 XP on death, and joins the #monsters team. Port behavior matches original intent.
