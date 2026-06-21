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

- [x] **#runReload data property ignored** (bat, caveBat, evilTv, vultureGuard — all #objAiCPU+#naturalRanged).
  Original gates kiting purely on the #runReload data flag (objCPUCharacter getRunReload, default false);
  the port DERIVED runReload from AiType only, so these 4 explicit kiters stood still after firing instead
  of retreating. FIXED additively: archetypes.ts:206 now ORs `d["runReload"]===true` with the existing
  AiType approximations (spellcaster/magic/flyingbomber), so the 4 kite without disturbing those.
  casts/script_objects/objCPUCharacter.txt:30,162 | port/src/entities/archetypes.ts:206.
