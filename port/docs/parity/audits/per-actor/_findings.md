# Per-actor sweep — CONFIRMED real gaps (verified, to fix)

Only behavioral/real gaps (property-coverage non-gaps are catalogued in ../data-coverage.md and excluded).

- [x] **leaveWhenFinished not acted on for non-builders** (amotonlinInGame, berlinInGame, archer, +~10).
  objCharacter `on finish: return pLeaveWhenFinished` → a summoned ally with no remaining targets teleports
  OUT. Port handles it ONLY in the builder FSM (control.ts:778); a finished summoned wizard/ally lingers
  instead of retiring. casts/script_objects/objCharacter.txt:15,181 | port/src/components/control.ts:354,778.

- [x] **#firingType ignored (SYSTEMIC — 42 actors)** (dwarfTower #proportional; fangBunnyBaby/evilTv/
  archerBow/+38 #fullstrength). The port fired ALL bullets at a fixed speed (4.5 plain / 5 splash),
  ignoring modAttack performRangedAttack's firingType throw model. Original: #proportional →
  throwVect=distXY/10 (always arrives in ~10 frames), #fullstrength → speed=strength. FIXED: AttackData
  carries #firingType (default #proportional); control.ts attack() derives the throw velocity per type.
  Travel time only — bullet damage stays on the calibrated K1 reference (the original couples damage to
  |getVect()|, but the port's tuned damage model is a deliberate abstraction; kept stable to avoid balance
  regression). casts/script_objects/modAttack.txt:743 + master_objects/structMaster.txt:181 |
  port/src/components/weapon.ts (AttackData.firingType) + control.ts (attack).

- [x] **CPU beam attacks not executed (techMech)** — objAiCPU inherits objAiAttack.attack which dispatches
  #ranged+#beam → performBeamAttack (instant stretched beam spawned at the target). The port's CpuAI.attack()
  had no beam branch, so techMech (laserBeam) fired a travelling splash bullet. FIXED: CpuAI checks
  currentAttack.beam → performBeamAttack at the target loc. objAiAttack.txt:308 | control.ts attack ranged.

- [x] **#depositMines not implemented (player energyMines AND verdanlinInGame)** — modSpellMultistage.depositMines
  drops numMines = charge/chargePerUnit #energyMine actors scattered VarRoughly(loc, charge/2). The port's
  spellActor.explode() handled only #summonUnit and CpuAI had no mine branch, so energyMines just did the
  radial explode with NO mines deposited. FIXED: shared depositMines() helper (summon.ts) wired into
  spellActor.explode() (player) + CpuAI.attack() (CPU caster at target loc). modSpellMultistage.txt:124 |
  summon.ts + spellActor.ts + control.ts.

- [x] **#explodeSound hardcoded "spell_explode" (SYSTEMIC — all splash/spell detonations)** — the original
  plays the actor's top-level #explodeSound (structMaster default #none); the port hardcoded "spell_explode",
  so cracks (darkGolem_fire) / healBlast (heal_spell_explode) played the wrong sound and energyPulse / towerAxe
  / fire / pitMonster (#none) fired a SPURIOUS explosion sound (audible noise — energyPulse streams, pitMonster
  re-arms). FIXED: AttackData carries #explodeSound (actor top-level, ignoring the merged "#none" attack
  default); projectile.detonate + spellActor explode play it data-driven, silent on #none. (Mines already
  read it.) casts #explodeSound + structMaster.txt:177 | port/src/components/{weapon,projectile,spellActor}.ts.

- [x] **+25 collect-bonus energy missing on ALL pickups; maxikit not a full heal (SYSTEMIC — pickups)** —
  objPlayerMerlinCharacter: medikitCollected/newScrollCollected/potionCollected all end with
  `increaseEnergy(pBonusEnergy=25)` → collecting ANY medikit/scroll/sword/potion grants a flat +25 health
  (NOT maxikit/gmg). The port granted none. AND maxikit's #maxikit branch is an INSTANT FULL heal
  (increaseEnergy(maxEnergy-energy)), but the port banked it as a gradual kit like medikit. FIXED: pickup.ts
  grants +25 on every collect except maxikit/gmg, and maxikit now instant-fills to max (no bank).
  casts objPlayerMerlinCharacter.txt:152-160,166,200 | port/src/components/pickup.ts. pickup.test.ts covers both.

- [x] **energyMine re-armed forever (objMine dieOnExplode default wrong)** — objMine default
  i[#dieOnExplode]=true (single-shot, e.g. energyMine); only the re-arming mines (fire/pitMonster/auras) set
  it false. The port's spawnMine + Mine.init used `=== true`, so an UNSET dieOnExplode became false →
  energyMine (which sets none) re-armed forever instead of being consumed after one blast. FIXED: default
  TRUE when unset (`!== false`) in both spots; re-arming mines (explicit false) unaffected.
  casts/script_objects/objMine.txt:18 | port/src/entities/objTypes.ts:45 + components/mine.ts:42.

- [x] **Dwelling residents over-levelled (SYSTEMIC — all dwellings)** — modResidents.setStartingLevel(
  random(dwelling experienceLevel)); a dwelling's level = its #startingLevel (dwellings gain no XP) and NO
  shipped dwelling sets one → level 0 → 0 level-ups. The port gave each resident a flat 50% chance of +1
  level, making them stronger than the original. FIXED: residents emerge at random(dwellingLevel) (0 for all
  shipped level-0 dwellings). casts modResidents.txt:160 | port/src/components/dwelling.ts.
  (NOT changed: resident spawn ±30px offset = a deliberate anti-overlap-with-solid choice; original uses
  exact loc but staggered release + collision make these equivalent — documented minor deviation.)

- [x] **CPU damage-caster damage decoupled from charge (user-approved "fully faithful")** (energyBlast/
  darkBlast/cBlastAi/arcticBlast casters: berlin/goblinMage/friendlyGoblinMage/darkMage/garonlin/flaetorlin/
  amotonlin). objAiCPUSpellCaster releases the SAME objSpell the player does — explode damage scales with the
  charge ceiling (mana_capacity·chargeMaxModifier + chargeMaxBasic). The port fired a FIXED per-actor bolt, so
  CPU caster damage didn't grow with mana/level. FIXED: CPU #release magic damage/status casters now release a
  real spell actor (grow-fly-explode) toward the target via spawnSpell+SpellActor.release at full charge,
  unifying with the player's castMagic — radial damage + takeFreeze now charge-scaled. casts objAiCPUSpellCaster
  + modAttack calcCollisionVectSpell | port/src/components/control.ts (attack magic-#release branch).

- [x] **#randomSummon tier-wobble never invoked (SYSTEMIC — all summoners)** (mageOrc/goblinMage →
  goblinSummon, necromancer/greyGhost → undeadSummon, sc/skeleton summon). calcAttackChargeMax wobbles the
  charge ceiling per cast for #randomSummon spells so a summoner doesn't always reach the TOP tier. The port's
  chargeMaxOf implements it but only when passed an rng — and NO caller passed one, so every summon was the
  deterministic top tier. FIXED: the CpuAI summon release passes game.rng (one-shot, cooldown-gated → no
  jitter); the player charge caches a per-cast wobbled ceiling (calcAttackChargeMax fires once, not per-frame
  — also more faithful: the ceiling no longer drifts with mid-charge mana regen). casts modAttack
  calcAttackChargeMax | port/src/components/control.ts (attack + player charge) + charge.ts.

- [x] **bullet #reincarnateAs dropped (SYSTEMIC — flamingRock + eggs)** (lavaDarkGolem/lavaGolem flamingRock;
  lizard lizardEgg; ostrich ostrichEgg). objBullet.reincarnate spawns the bullet's #reincarnateAs at its death
  loc — flamingRock leaves a #fire mine, lizardEgg HATCHES a #bug, ostrichEgg HATCHES a #babyOstrich. The
  port's pooled BulletArchetype had no reincarnation, so flaming rocks left no fire and eggs never hatched.
  FIXED: Projectile carries #reincarnateAs and its death choke-point (finish) spawns each child via
  spawnFromSymbol; threaded from the bullet actor's data through archetypes/EnemyAI. casts/data/act_flamingRock.txt:23,
  act_lizardEgg.txt, act_ostrichEgg.txt + objBullet.txt:282 | port/src/components/projectile.ts + control.ts + archetypes.ts.

- [x] **audio channel leak on missing/#none buffer (engine bug, side-find from hydra1)** — Audio.play()
  claimed a channel (busy=true) but never attached onended when the buffer was #none/not-loaded, so the
  channel leaked permanently; after SOUND_CHANNELS such calls (many actors carry dieSound #none) every real
  SFX is dropped. FIXED: #none/empty name is a no-op (claims no channel, faithful to soundMaster filtering
  #none); a genuine missing-buffer miss frees the channel. port/src/systems/audio.ts.

- [x] **CPU/enemy passive energy regen missing — energyRecoverDelay defaulted 0, not 300 (SYSTEMIC, ~98 CPU
  actors)** — objCharacter sets i[#energyRecoverDelay]=30 but objCPUCharacter OVERRIDES it to 300
  (objCPUCharacter.txt:22): every AI unit trickles +1 energy per 300 ticks (modEnergy.recoverEnergy:216,
  increaseEnergy(1)) unless its data overrides. NO shipped enemy sets it, so 300 is the live default. The
  port's enemy archetype defaulted to 0 (`num("energyRecoverDelay",0) || undefined`) → enemies NEVER healed
  passively (player path was already correct at 30). FIXED: enemy archetype defaults energyRecoverDelay to 300
  (an explicit data value still wins). casts objCPUCharacter.txt:22 + modEnergy.txt:216 |
  port/src/entities/archetypes.ts:302. hurt.test.ts (wounded swordOrc heals +1 on the 300th tick).

- [x] **Dwelling inertia / energyIncPercentage / per-release level-up dropped (SYSTEMIC — all dwellings)** —
  act_dwelling inherits #inertia 80 and #energyIncPercentage -1, and modResidents.releaseResident:170 calls
  me.big.levelUp() after EACH resident release. So a dwelling (a) resists knockback (inertia 80), (b) levels
  up once per release → successive residents emerge progressively stronger (setStartingLevel(random(level)),
  random(n)∈1..n), and (c) its own max energy decays 1%/level (energyIncPercentage -1). resolveActor merges
  inertia/energyIncPercentage onto every dwelling, but spawnDwelling forwarded neither, and Dwelling.releaseOne
  never levelled the building (it pinned level at #startingLevel=0 → all residents level 0 — my earlier fix #8
  was INCOMPLETE here). FIXED: spawnDwelling passes inertia(80)/energyIncPercentage(-1)/startingLevel;
  releaseOne increments the dwelling level and fans out #levelUp per release; Energy.levelUp now applies a
  NEGATIVE increment (was guarded inc>0, silently dropping the dwelling decay; floored at max≥1). casts
  act_dwelling.txt + modResidents.txt:159-170 + modEnergy levelUpEnergy | port/src/entities/archetypes.ts
  (spawnDwelling) + components/dwelling.ts (releaseOne) + components/combat.ts (levelUp). dwelling.test.ts
  (resident escalation: first level 0, later escalate, level≤release index).

- [x] **Chatter trigger reach hardcoded ±320 — ignored per-actor #collisionRect (kingStones/armySummonStones/
  berlinTV)** — objChatter fires via checkForCollisionWithPlayer → CollisionCheck(me.big, player)
  (objGameObject.txt:271), testing the player against the chatter's OWN #collisionRect (expanded by the
  player's edge). The stones carry rect(-320,-320,320,320), but kingStones is rect(-100,-50,100,50),
  armySummonStones rect(-16,-16,16,16), berlinTV rect(-100,-1,100,100) — DIFFERENT trigger zones. The port's
  Chatter hardcoded TRIGGER_REACH=320 for ALL of them, so kingStones/armySummonStones would have fired their
  cutscene from ~3–20x too far away (out of context). FIXED: Chatter derives per-axis reach from the actor's
  #collisionRect half-extent + the player edge (12); falls back to ±320 only if an actor carries no rect.
  Threaded collisionRect through spawnChatter. casts/general_functions/CollisionCheck().txt + objGameObject.txt:271 |
  port/src/components/chatter.ts + entities/objTypes.ts (spawnChatter). phase_k_shell.test.ts kingStones case.

- [x] **#runReload data property ignored** (bat, caveBat, evilTv, vultureGuard — all #objAiCPU+#naturalRanged).
  Original gates kiting purely on the #runReload data flag (objCPUCharacter getRunReload, default false);
  the port DERIVED runReload from AiType only, so these 4 explicit kiters stood still after firing instead
  of retreating. FIXED additively: archetypes.ts:206 now ORs `d["runReload"]===true` with the existing
  AiType approximations (spellcaster/magic/flyingbomber), so the 4 kite without disturbing those.
  casts/script_objects/objCPUCharacter.txt:30,162 | port/src/entities/archetypes.ts:206.
