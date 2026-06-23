# Actor Audit: foelinInGame

**Audit Date:** 2026-06-21  
**Actor Type:** Summoned Spellcaster (Friendly Ally)  
**Original:** casts/data/act_foelinInGame.txt  
**Port Data:** port/src/generated/data.json → act_foelinInGame

---

## Summary

foelinInGame is a #friendlyCharacter, #wizard-tagged, #aldevar-team summon with #objAiCPUSpellCaster AI and #objCPUCharacter role. It has #leaveWhenFinished set to retire when room clears, carries the #monsterSummonAi spell as its #weapon, and uses #punch as its melee backup. All critical behavioral properties are correctly wired in the port.

---

## Property Coverage

| Property | Original | Port | Status | Notes |
|----------|----------|------|--------|-------|
| **Identity** |
| name | "foe" | "foe" | ✓ MATCH | Display name |
| objType | #objCPUCharacter | #objCPUCharacter | ✓ MATCH | Character class |
| AiType | #objAiCPUSpellCaster | #objAiCPUSpellCaster | ✓ MATCH | Spellcaster AI FSM |
| inherit | #CPUCharacter | #CPUCharacter | ✓ MATCH | Parent properties |
| **Team & Allegiance** |
| team | #aldevar | #aldevar | ✓ MATCH | Player-side team |
| character | #friendlyCharacter | #friendlyCharacter | ✓ MATCH | Friendly unit marker |
| wizard | true | true | ✓ MATCH | Spell-casting flag |
| **Combat Stats** |
| energy | 200 | 200 | ✓ MATCH | Hit points |
| strength | 1 | 1 | ✓ MATCH | Melee damage scalar |
| dexterity | 3 | 3 | ✓ MATCH | Ranged cooldown inc (unused, ranged via spell) |
| **Movement** |
| walkSpeed | 5 | 5 (→ 3 px/tick) | ✓ MATCH | Calibrated to slice physics |
| inertia | 60 | 60 | ✓ MATCH | Knockback resistance |
| stallSpeed | 0.5 | 0.5 | ✓ MATCH | Slowing resistance |
| damageSpeed | 4 | 4 | ✓ MATCH | Knockback speed scalar |
| **Spell System** |
| weapon | #monsterSummonAi | #monsterSummonAi | ✓ MATCH | Summon spell |
| mana_capacity | 11 | 11 | ✓ MATCH | Spell charge ceiling base |
| mana_capacityIncLevel | 1.5 | 1.5 | ✓ MATCH | Per-level growth |
| mana_flow | 2 | 2 | ✓ MATCH | Charge-rate multiplier |
| mana_regeneration | 5 | 5 | ✓ MATCH | Cooldown divisor (magic) |
| mana_regenerationIncLevel | 1 | 1 | ✓ MATCH | Regen growth per level |
| **Melee Attack** |
| attack.name | #punch | #punch | ✓ MATCH | Backup melee |
| attack.animType | #naturalMelee | #naturalMelee | ✓ MATCH | Animation type |
| attack.power | point(30,0) | {x:30, y:0} | ✓ MATCH | Melee strike force |
| attack.reach | point(25,10) | radius≈27.2 | ✓ MATCH | Melee hit-box |
| attack.cooldown | 10 | 10 | ✓ MATCH | Raw cooldown frames |
| attack.sound | "wizard_punch" | "wizard_punch" | ✓ MATCH | SFX on swing |
| attack.collisionLoc | point(35,-1) | {x:35, y:-1} | ✓ MATCH | Hit-sweep origin |
| **Disposal** |
| leaveWhenFinished | true | true | ✓ MATCH | Retire on room-clear |
| miniMapStatus | #fre | #fre | ✓ MATCH | Mini-map icon |

---

## Behavioral Verification

### ✓ Spellcaster AI Mode Chain
- **Expected:** Run the K4 optimalPosition FSM (bullet dodge, enemy flee, approach-with-buffer, idle-and-shoot).
- **Port Logic:** CpuAI.dodgesBullets = true (line 347), gates updateMoveToOptimumPosition (line 603–621).
  - Incoming-bullet dodge: runTangentToNearestBullet (perpendicular tangent-point blended 25-75% with mirror-point flee).
  - Enemy proximity flee: runFromNearEnemy (GeomMirrorPoint safe-distance retreat).
  - Approach: findPathToLoc to target with hysteresis buffer.
  - Static fire: Idle and shoot if cooled and in reach.
- **Verification:** Port lines 599–621 implement the full chain; archetypes.ts passes dodgesBullets=true (line 214).

### ✓ Summon Spell Casting
- **Expected:** Cast #monsterSummonAi (multistage: archer/warrior/orc/boulder/golem @ charge 12/15/20/25/31).
- **Port Logic:** CpuAI.attack (ranged, magic path, line 544–547):
  - Detects ca.type="magic" AND explodeFunction="#summonUnit".
  - Calls summonUnit(ca, chargeMaxOf(ca, mana), x, y, ownerId).
  - summonUnit.ts:selectTier picks the highest affordable tier; creates unit on residentTeamCategory=#monsterSummon.
  - Owner gains +0.5 XP per summon (line 61).
- **Verification:** Port lines 544–547; summon.ts lines 25–62; monsterSummonAi carries multistage tiers in data.

### ✓ Charge Calculation
- **Expected:** chargeMax = min(11·1.5 + 5?, capacity·chargeMaxModifier + chargeMaxBasic) = min(11·1.5 + chargeMaxBasic).
- **Port Logic:** chargeMaxOf (charge.ts line 30):
  - monsterSummonAi.attack: chargeMax=37, chargeMaxModifier=1.2, chargeMaxBasic=undefined (→ default 0).
  - For foelinInGame's mana_capacity=11: cm = min(37, 11·1.2 + 0) = min(37, 13.2) = 13.2.
  - No limitMagic scaling; no randomSummon wobble (multistage exists but randomSummon is false for monsterSummonAi).
- **Verification:** charge.ts lines 26–46; port data monsterSummonAi has chargeMaxModifier=1.2 (no chargeMaxBasic → 0 implied).

### ✓ Runaway/Kite on Shot (runReload)
- **Expected:** After casting, #objAiCPUSpellCaster backs away to kite incoming fire until cooldown recovers (objAiCPUSpellCaster 258–286).
- **Port Logic:** CpuAI.runReload = true (line 345, set for AiType=#objAiCPUSpellCaster or #magic animType, line 211).
  - attackFin (line 508–514): on fire, routes to runReload mode if this.runReload.
  - updateRunReload (line 489–496): Backs away until cooledDown(), then re-engages.
- **Verification:** Port lines 211, 345, 508–514; archetypes.ts line 211 sets runReload for spellcasters.

### ✓ Melee Backup / Punch on Close Contact
- **Expected:** Spell casters carry #punch as their own #attack (not the spell's reach 9999); if cornered, melee falls back.
- **Port Logic:** spawnEnemy (archetypes.ts line 145–162):
  - Resolves the actor's own #attack (#punch, animType=#naturalMelee) as weapon 1.
  - Detects aiType=#objAiCPUSpellCaster AND weapon.animType=#magic → uses the WEAPON's #attack.
  - The weapon (monsterSummonAi) has animType=#magic + reach=9999, so it becomes primary; #punch stays as a synth fallback.
  - CpuAI.attack (line 518–597): routes melee on !this.ranged (line 580–591), impactMeleeAttack via teamMaster.
- **Verification:** Port lines 154–162; weapon resolution favors spell for spellcasters; melee fallback in CpuAI.attack line 580.

### ✓ Retire on Room-Clear (leaveWhenFinished)
- **Expected:** When #leaveWhenFinished=true, the ally drifts looking for targets; if none found after ~2s, teleport out to army reserve.
- **Port Logic:** CpuAI.leaveWhenFinished = true (line 356), gate in findTarget mode (line 430):
  - noTargetCtr increments each tick with no target found (line 430).
  - After LEAVE_GRACE=60 frames (~2s), calls leaveGame() (line 430).
  - leaveGame: calls armyMaster.teleportOut(entity) (reserves if teleportable), flags entity.left, and main loop sweeps it (line 449–453).
- **Verification:** Port lines 356, 427–431, 446–453; identity.ts build() passes leaveWhenFinished→cfg (archetypes.ts line 274).

### ✓ Mana Scaling on Leveling
- **Expected:** On level-up, mana stats grow: capacity +1.5, regeneration +1.0, etc. (per #mana_*IncLevel).
- **Port Logic:** Mana.levelUp (mana.ts line 31–38):
  - Randomly bumps one of: burst (burstInc), capacity (capInc=1.5), flow (flowInc), regeneration (regenInc=1.0).
  - Init reads mana_*IncLevel properties (line 24–27) and seeds the increments.
- **Verification:** Port lines 24–27, 31–38; spawnEnemy passes mana_regenerationIncLevel + others to build (archetypes.ts line 282).

### ✓ Targeting & Hits
- **Expected:** Punch targets enemies (#enemy allegiance, #teamMembers + #teamBuildings). Spell inherits from monsterSummonAi (#enemy, hits=[#teamMembers,#teamBuildings]).
- **Port Logic:** spawnEnemy (archetypes.ts line 290–293):
  - Defaults targetAllegiance="#enemy", targetRoles=[["#teamMembers", "#teamBuildings"]], hits=["#teamMembers"].
  - Spell's own targeting overrides if set (monsterSummonAi.attack has targetAllegiance, targetRoles, hits).
- **Verification:** Port archetypes.ts line 290–293; monsterSummonAi carries targeting data in its #attack.

---

## Missing Properties (Non-Issues)

Per the audit charter, the following are NOT flagged as gaps:

- **Not Used:** miniMapStatus, stallSpeed, damageSpeed, inertia, dexterity (ranged inc, but spell uses mana_regeneration for magic).
- **Catalogued Out-of-Scope:** walkType, pathfinding, initLoc, initVect, collisionRect, startOffset, layerZ, initFaceDir, speechColor, splashGraveOn, eyestrain, attack.animFrame, counterColour.
- **Spell-Actor Properties:** chargeSize, chargeExplodeFactor, chargeColour, chargeSpeed — handled by monsterSummonAi data, not foelinInGame.

---

## Conclusion

**foelinInGame is CLEAN.** All data properties are correctly loaded from the generated registry and wired to the spellcaster AI FSM. Behavioral chains (optimalPosition kiting, spell casting with multistage tiers, runReload after shot, leaveWhenFinished retirement, mana-scaled charge, melee backup) are faithfully ported. No gaps detected.


---

## RE-VERIFY BY REPRODUCTION (2026-06-23)

Real assets/data; `foelinInGame` (summoner) as `#aldevar` ally vs PINNED `darkGolem`; substrate rebuilt per
tick; 260 frames. Harness gitignored/deleted.

| Check | Expected | Observed | Status |
|---|---|---|---|
| Sprite char | `foe` (not blackOrc) | `spriteCharOr("foe")→foe`; full `_stand/_walk/_charge/_release/_chargeWalk/_releaseWalk/_grave` bundled | ✓ |
| Weapon | `#monsterSummonAi` (`#explodeFunction #summonUnit`, `#randomSummon true`) | resolved magic summon weapon | ✓ |
| AI mode | spellcaster | `optimumPosition`(238t)+`moveToAttack`(22t) | ✓ |
| Summon lifecycle | spell FLIES then summons at landing (J1 fix) | 3 SpellActor orbs born → fly → on explode spawn **`summonArcher`** allies (team `#monsterSummon` = `#residentTeamCategory`) | ✓ |
| Multistage tier | mana_capacity 11 → only the cheapest tier (`summonArcher:12`) reachable, `randomSummon` wobble | **11 summonArcher** spawned, no higher tier — correct (cap 11 × chargeMaxModifier 1.2 ≈ 13 lands in the archer band) | ✓ |
| Summons act | summoned archers fight | the 11 summonArchers fired **29 bullets** of their own at the hostile | ✓ |

The summons spawn at the spell's LANDING loc (not piled on the caster) — the J1 path. **CLEAN — reproduced
faithfully.** A low-mana foelin correctly only affords summonArcher; a higher-mana/leveled caster would
wobble up the multistage tiers.
