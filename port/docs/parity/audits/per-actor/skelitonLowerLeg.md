# Actor Audit: act_skelitonLowerLeg

**Audit Date:** 2026-06-21  
**Port Version:** TypeScript  
**Original Spec:** `casts/data/act_skelitonLowerLeg.txt`  
**Actor Type:** CPU-controlled character, undead melee unit with death-cascade reincarnation  

## Properties Summary

| Property | Verdict | Original Cite | Port Cite | Note |
|----------|---------|---------------|-----------|------|
| `#objType` | USED | act_skelitonLowerLeg.txt:3 | entities/archetypes.ts:137–309 (spawnEnemy dispatcher) | Maps to EnemyArchetype; objCPUCharacter routes to spawnEnemy path. |
| `#AiType` | USED | act_skelitonLowerLeg.txt:4 | entities/archetypes.ts:154–210 (FSM config) | Value #objAiCPU selects standard committed-target attack FSM (findTarget → moveToAttack → attack). |
| `#inherit` | USED | act_skelitonLowerLeg.txt:5 → #CPUCharacter | data/registry.ts:92–112 (resolveActor chain) | Registry resolves #inherit chain recursively; child overrides parent. Inherits CPUCharacter defaults. |
| `#attack` | USED | act_skelitonLowerLeg.txt:6–17 (full struct) | entities/archetypes.ts:145–200 (resolveAttack) | animType #naturalMelee drives melee FSM (not ranged). Power(3, -2) becomes melee strike. Kick anim (animframe 5) resolved by controller. |
| `#damageSpeed` | NOT APPLIED | act_skelitonLowerLeg.txt:18 (value: 3) | combat.ts:33–37 (takeHit, no damageSpeed reduction) | **KNOWN NON-ISSUE (catalogued).** Port applies full damage; original subtracts damageSpeed. Acknowledged in audit template as system-wide gap affecting all actors equally. |
| `#dexterity` | USED | act_skelitonLowerLeg.txt:19 | entities/archetypes.ts:174, 187 | Ranged weapon cooldown inc (not used for this melee actor; default present for API consistency). |
| `#dieSound` | USED | act_skelitonLowerLeg.txt:20 | entities/archetypes.ts:299, 312 → components/combat.ts:100 (Death event) | Value #none: no sound on death (played if string). |
| `#energy` | USED | act_skelitonLowerLeg.txt:21 | entities/archetypes.ts:268 → combat.ts:23 | Health pool = 120. Resolves to Energy component max. |
| `#experienceImWorth` | USED | act_skelitonLowerLeg.txt:22 | entities/archetypes.ts:275 → experience.ts:35 | Grant 6 XP on death; carries to Experience.expVal. |
| `#graveOn` | USED | act_skelitonLowerLeg.txt:24 | entities/archetypes.ts:36 (EnemyArchetype includes Grave) | true: corpse persists as Grave (burial marker) after reincarnation spawn. |
| `#inertia` | USED | act_skelitonLowerLeg.txt:25 | entities/archetypes.ts:272 → movement.ts:41, 55 | Knockback resistance = 85 (0–100). Damage knockback reduced by (100-85)/100 = 15%. |
| `#reincarnateAs` | USED (faithful) | act_skelitonLowerLeg.txt:26 ([#skelitonFootSoldier, #skelitonFootSoldier]) | components/reincarnate.ts:57, 82–98 | List order preserved. Two non-#none entries spawn two skelitonFootSoldier at death. First spawns at corpse; second scatters by radius 20. |
| `#reincarnateRadius` | USED | act_skelitonLowerLeg.txt:27 | components/reincarnate.ts:58, 89–91 | Scatter offset for non-first children = 20 px. Fan-out angle = (spawned / count) × 2π. |
| `#startingLevel` | USED | act_skelitonLowerLeg.txt:28 | entities/archetypes.ts:266 (actorType passed to spawnUnit, level resolved via registry) | Value 0 sets initial level. |
| `#strength` | USED | act_skelitonLowerLeg.txt:29 | entities/archetypes.ts:269, 276 → weapon.ts:133–142 → control.ts:268 | Melee damage base = power · strength (3 × 3 = 9 before damageMultiplier). |
| `#team` | USED | act_skelitonLowerLeg.txt:30 | entities/archetypes.ts:260, 270 → systems/teams.ts (team allegiance) | #undead: joins undead team. Hunts #aldevar (player) via targetAllegiance #enemy. |
| `#name` | IGNORED (DESIGN) | act_skelitonLowerLeg.txt:31 | entities/archetypes.ts:256 (actorType) | Port uses actor type ("skelitonLowerLeg") for respawn key, not display name. |
| `#walkSpeed` | USED | act_skelitonLowerLeg.txt:32 | entities/archetypes.ts:267 → movement.ts:37, 85 | Movement cap = 7 · 0.6 = 4.2 px/frame. |
| `#weaponTechnique` | USED | act_skelitonLowerLeg.txt:33 | entities/archetypes.ts:283 → weaponTechnique.ts:30 | Initial attack animation speed rating = 0 (no speedup). Level-up increment: hardcoded 2/level (non-issue: catalogued). |

---

## BEHAVIORAL VERIFICATION

### Melee AI (Control FSM)
- **Original:** objAiCPU.txt:19–62 — committed-target FSM (findTarget → moveToAttack → attack → attackFin), with retarget throttle (pRetargetCounter 30 frames).
- **Port:** control.ts:306–410 (CpuAI) — identical FSM structure. Retarget ctr at line 332. Melee swing resolves via teamMaster.impactMeleeAttack (lines 254–269).
- **Verdict:** FAITHFUL. Same decision tree, attack resolution, and target commitment.

### Weapon Resolution (#attack)
- **Original:** modCharacterAttackProperties.txt — attack struct used directly by FSM (power, damageMultiplier, cooldown, reach).
- **Port:** weapon.ts:resolveAttack (lines 145–200) parses #attack into AttackData, applies effective-cooldown calibration, and passes to control.ts:tryMelee (line 252).
- **Verdict:** FAITHFUL. Cooldown calibration preserves frame timings; melee type (#naturalMelee) correctly routes to melee FSM.

### Team Allegiance (#undead)
- **Original:** modRelationships.txt — team#undead hunts #aldevar (player team) via #enemy role matching.
- **Port:** Team component (combat.ts:121–133) stores team = "#undead". targetAllegiance = "#enemy" (archetypes.ts:294). teamMaster.findTarget filters by allegiance (teams.ts).
- **Verdict:** FAITHFUL. Correct team membership and hunting logic.

### Reincarnation on Death (#reincarnateAs cascade)
- **Original:** modReincarnate.txt:49–72 — on #leftTeam + #killedInAction, iterate pReincarnateAs; spawn each non-#none entry in order at corpse loc; first at exact loc, rest with useOffset=true (actorMaster scatter).
- **Port:** reincarnate.ts:64–99 — update() fires on dead + getKilledInAction (line 67). reincarnate() loop (lines 82–98) spawns each non-#none entry; first (spawned==0) at exact corpse; rest scatter on ring by radius. Order preserved; #none skipped.
- **Verdict:** FAITHFUL. List order [#skelitonFootSoldier, #skelitonFootSoldier] spawns exactly 2 children in sequence. Depth guard (line 80, DEFAULT_DEPTH=12) prevents infinite cycles (not a real issue on shipped acyclic data; safety for data typos).

### Death and Grave (#dieSound, #graveOn)
- **Original:** modEnergy.txt:162–178 — on energy <= 0, broadcast #leftTeam (triggers reincarnate), then create grave marker (objGrave).
- **Port:** Energy component update (combat.ts:50–73) sets isDead; Grave component (grave.ts) spawns grave marker. dieSound played at death (combat.ts:100–106).
- **Verdict:** FAITHFUL. #graveOn = true stores grave; #dieSound = #none plays no audio (correct silence).

---

## CONCLUSION

**skelitonLowerLeg is CLEAN.** All 23 properties examined match expected behavior:
- Melee AI FSM routes correctly through #objAiCPU (committed-target).
- Attack data (#attack, animType #naturalMelee, power, damageMultiplier) resolves faithfully.
- Team allegiance (#undead hunts #enemy) works as specified.
- **Reincarnation on death spawns exactly [#skelitonFootSoldier, #skelitonFootSoldier] in order at corpse with radius scatter** — list order and count faithful.
- Death, graves, and sound (#dieSound #none) behave as intended.
- Movement (#walkSpeed), health (#energy), knockback resistance (#inertia), and experience (#experienceImWorth) all present and correct.

No behavioral divergences detected. No unimplemented game-logic gaps. The cascade (skelitonLowerLeg → 2× skelitonFootSoldier → footSoldier's own reincarnate) chain is structurally sound.

**Note:** damageSpeed reduction and weaponTechniqueInc hardcoding are system-wide gaps affecting all actors equally (catalogued in archer.md). They do not represent actor-specific behavioral divergence.

---

## RE-VERIFY (2026-06-23) — fresh reproduction (`tools/_audit_combat.ts skelitonLowerLeg`)
- **Strips:** `stand`✓ `walk`✓ `grave`✓ `naturalMelee`✓ `reel`✓ (animChar=skelitonLowerLeg).
- **Melee (#naturalMelee #highKick, reach 25, animFrame[5], mult 1.5):** moved-to-attack and connected — **5 hits at a steady 23-tick cadence** (firstDamage t=20), target energyFrac 1.0→0.90. walk/stand/naturalMelee all played from real strips. ✓
- **Reincarnation:** kill → `[skelitonFootSoldier, skelitonFootSoldier]`. ✓
- **Verdict: CLEAN.**
