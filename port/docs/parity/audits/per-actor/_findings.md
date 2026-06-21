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

- [x] **#runReload data property ignored** (bat, caveBat, evilTv, vultureGuard — all #objAiCPU+#naturalRanged).
  Original gates kiting purely on the #runReload data flag (objCPUCharacter getRunReload, default false);
  the port DERIVED runReload from AiType only, so these 4 explicit kiters stood still after firing instead
  of retreating. FIXED additively: archetypes.ts:206 now ORs `d["runReload"]===true` with the existing
  AiType approximations (spellcaster/magic/flyingbomber), so the 4 kite without disturbing those.
  casts/script_objects/objCPUCharacter.txt:30,162 | port/src/entities/archetypes.ts:206.
