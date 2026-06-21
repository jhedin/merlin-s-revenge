# Lingo code-vs-TS audit — CONFIRMED real gaps (verified, fixed)

- [x] **walk speed never grew per level (modMoveToLoc.incWalkSpeedLevel)** — objCharacter:51 adds modMoveToLoc
  to ALL characters; its internalEvent #levelUp fires incWalkSpeed(0.075). Enemies move at walkSpeed
  (PointFrameMove), so they speed up per level; the player's cap rises over a playthrough. The port never
  applied it. FIXED: Movement handles #levelUp -> maxSpeed += px-converted increment (player 0.075 @1:1,
  enemy 0.045 @×0.6), fanned out from Experience.levelUp. casts modMoveToLoc.txt:255,289 |
  port/src/components/movement.ts + entities/archetypes.ts. experience.test.ts.

- [x] **collisionDetection:false / ghost units collided with terrain** — objGameObject.checkCollisions(:248)
  runs only when pCollisionDetection. bat/greyGhost/skelitonSword/summonArcher/Warrior/Orc/Golem/Boulder set
  #collisionDetection:false, and #objAiCPUGhost (monkGhost) runs modGhost.collisionDetectionOff -> all DRIFT
  THROUGH walls. The port collided them. FIXED: enemy/unit archetype maps collisionDetection:false || ghost
  -> Movement.passThrough (no moveBox). casts objGameObject.txt:248 + modGhost.txt:32 |
  port/src/entities/archetypes.ts + components/movement.ts. knockback.test.ts.

- [x] **ghost units could drift off-map (autoConstrainToPlayArea)** — autoConstrainToPlayArea(:164) sets
  constrainToPlayArea=true exactly when collisionDetection=false: a wall-ignoring ghost is still clamped to
  the room bounds. FIXED: Movement clamps passThrough UNITS (not bullets) to the grid extent (inset by box/2).
  casts objGameObject.txt:164,351 | port/src/components/movement.ts. knockback.test.ts.

## Non-gaps confirmed (catalogued, not fixed)
- objGameObject frictionReel/frictionNormal/frictionStrong mode switch: subsumed by the port's px-tuned
  knockback channel (A1 calibration: KNOCK_SCALE/MAX/FRICTION). Same reel-slide role, deliberately recalibrated.
- objGameObject exitedPlayArea #screenExit notification: no port consumer; projectiles despawn via maxLife,
  ghost units clamped. Functionally equivalent.
- modGameObject.txt: does not exist — the takeHit/inertia keystone lives in objGameObject.txt (audited).

## CLEAN
modAttack, modEnergy, modExperience, modMoveToLoc, objCharacter, objBullet, objGameObject (after fixes).

- [x] **reincarnation didn't transfer parent XP (modExperience.transferExperience)** — modReincarnate fires
  #reincarnated per child -> transferExperience -> each child gains gainExperienceFromTransfer(pExperienceGained/2),
  i.e. HALF the parent's accumulated kill-XP. The port inherited NOTHING. Usually ~0 (enemies rarely accumulate
  kill-XP), but a boss/miniboss that killed player summons passed its XP down so the next stage wasn't reset to
  level 0. FIXED: Reincarnate reads the parent's Experience.xp and sends gainXp(xp/2) to each spawned child.
  casts modReincarnate.txt:66 + modExperience.transferExperience | port/src/components/reincarnate.ts.
  reincarnate.test.ts (each child gets half; zero-XP parent transfers nothing).

## CLEAN (cont.)
objMine, objCPUCharacter, objDwelling, objSpell (orb phases via direct position-advance — non-gap).

- [x] **pickup collect didn't grant temp invincibility (startTempInvince)** — objPlayerMerlinCharacter's
  medikitCollected/newScrollCollected/potionCollected (153,170,199) all call startTempInvince ->
  pTempInvinceTime=200 frames of invincibility on collecting ANY pickup (a safety window, separate from the
  shorter post-hit i-frames). The port granted none. FIXED: Hurt.grantInvince(frames) latches the longer
  window; pickup.apply() calls grantInvince(200) on every collect. casts modInvince.txt:30,81 +
  objPlayerMerlinCharacter.txt:153,170,199 | port/src/components/hurt.ts + pickup.ts. pickup.test.ts.

## CLEAN (cont.)
modSpellMultistage, modFreeze, modHeal, objAiCPU (heal 100%-health skip ALREADY at teams.ts:132 — the
flagged "missing filter" was a shallow over-flag; verified present).
