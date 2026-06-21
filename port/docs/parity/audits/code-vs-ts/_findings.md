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

- [x] **NAV MODE entirely missing (objRoom.goNavMode / gNavMode=1) — SYSTEMIC, playthrough-visible** —
  GameSpecific.ls sets gNavMode=1 (verified vs the generic main.ls template; gExitArrows=1 etc. match the
  port). When a room is CLEARED, objRoom calls goNavMode -> the player's walkAcceleration swaps 2 -> 6
  (pNavModeAcceleration). With friction applied every tick (objMoveXY) the terminal velocity scales with
  accel, and the only speed clamp (gMoveSpeedLimit = ±tilesize ~31px/tick) never binds — so the player moves
  ~3x FASTER in a cleared room than in combat. Additionally objChatter (talkOnlyOnNavMode default true, no
  override) only triggers its cutscene IN nav mode — stones must not interrupt combat. The port modelled
  NONE of this (uniform player speed; chatter fired regardless of combat). FIXED: RoomManager.setExits sets
  game.navMode (=cleared); Movement applies a player-only maxSpeed x3 in nav mode; Chatter gates its trigger
  on game.navMode. extracted/.../GameSpecific.ls + objRoom.txt:209 + modNavMode.txt:48 + objMoveXY.txt:173 +
  objAiChatter.checkPossibleToTalk | port/src/world/rooms.ts + components/movement.ts + chatter.ts +
  game/context.ts. navmode.test.ts (player 3x in nav, enemies unaffected, chatter combat-gate).

- [x] **spell hotkeys 1-9 not wired — player couldn't switch spells (objAiPlayer.selectSpell)** —
  objAiPlayer:157-187 reads #spell1..#spell9 -> selectSpell(1..9), switching the current magic weapon. The
  port had WeaponManager.selectSpell(n) but NOTHING called it, so after collecting a 2nd spell (e.g.
  armySummon) the player was STUCK on it — couldn't switch back to energyBlast (the collectArmySummon cutscene
  literally instructs "press #spell1 to change back"). FIXED: PlayerControl reads number keys 1-9 ->
  selectSpell(n-1); debug save/load moved off 1/2 to F5/F9. casts objAiPlayer.txt:157-187 |
  port/src/components/control.ts + main.ts. spell_select.test.ts.

## CLEAN / non-gaps (cont.)
objAiAttack, objAiCPUSpellCaster CLEAN. objChatter gaps 2/3 (the gate sub-parts) folded into the nav-mode fix;
gap 4 (second-touch re-trigger) is a defensible one-fire (documented minor). objPlayerCharacter gap 2
(walk-speed lever) = fix #15; gap 4 (potion lever) = documented deviation.

## CONFIRMED gaps NOT yet fixed (surfaced for scope decision)
- [ ] **character energy roll-over UI missing (gCharacterEnergyRolloverOn=1)** — characterEnergyRollOverMaster
  displays a unit's health/level/XP bars when the MOUSE ROLLS OVER it (on in Merlin's Revenge per
  GameSpecific.ls; off in the generic template). The port has NO implementation (no hover-health UI). This is
  a UI-layer feature (no gameplay-mechanic effect), so it's catalogued here pending a scope decision rather
  than auto-built (it needs mouse-over hit-testing + bar rendering). casts/master_objects/characterEnergyRollOverMaster.txt.

- [x] **per-team concurrent cap not enforced (gMaxEnemies=16 / gMaxFriends=12, reservationsMaster)** —
  reservationsMaster.getPermissionToRelease caps each team at maxMembers (gMaxFriends=12 player side,
  gMaxEnemies=16 enemy; teamOverride halves a cap>5). Dwellings and summons must get permission so a team
  can't flood past its cap. The port only had a per-dwelling soft cap of 6 and NO per-team cap — so the
  player could summon UNLIMITED allies (summon.ts was explicitly "never headcount-gated") and multiple
  dwellings could overflow the enemy cap. FIXED: teamMaster.atCapacity(team, pending) (12/16, teamOverride
  halving); Dwelling.releaseOne and summonUnit gate on it. casts reservationsMaster.txt:56-65 +
  GameSpecific.ls (gMaxEnemies/gMaxFriends) | port/src/systems/teams.ts + components/dwelling.ts + summon.ts.
  team_cap.test.ts.

## GameSpecific globals cross-check (extracted/.../GameSpecific.ls)
- gNavMode=1 -> FIXED (#20). gCharacterEnergyRolloverOn=1 -> catalogued UI gap (unbuilt). gMaxEnemies/
  gMaxFriends -> FIXED (#22). gBounceyWalls=0 -> matches (both off; non-gap). gMapBoundary=128 -> a visual
  play-area boundary line; render/UI scope, deferred. gBulletsCollideWithBackground=0 -> matches (bullets
  pass through walls). g3DMode=0 -> matches. gExitArrows=1 -> port has exit arrows.

- [x] **ghost damage immunity missing (objCPUCharacter.takeHit amGhost gate)** — objCPUCharacter.takeHit:200
  `if me.amGhost() then return` — a true #ghost (monkGhost, #ghost:true) takes NO hit from attacks; it's
  INVULNERABLE and ends only by possessing a monk. The port's ghosts took normal damage (killable). FIXED:
  Movement.takeHit ignores external attacks for a ghost (attackerId != self), while the possession
  self-finish (CpuAI sends takeHit with attackerId == its own id) still lands. greyGhost/bat are
  collisionDetection:false (pass walls) but NOT #ghost, so they stay damageable. casts objCPUCharacter.txt:198-200
  | port/src/components/movement.ts + entities/archetypes.ts. knockback.test.ts (monkGhost immune to external,
  dies to self-finish; greyGhost damageable).

## CLEAN (cont.)
objAiCPUGhost, objAiCPUSummoner, actorMaster, structMaster (48 #attack defaults all match).

## CONFIRMED gaps NOT yet fixed (surfaced for scope decision)
- [ ] **extra-life pickup accumulation not ported (modExtraLives.lifePowerUpCollected)** — collecting
  #lifePowerUp (=#hairGem) powerups accumulates toward an extra life (numPowerUpsPerLife=100). objPowerUp.txt:67
  calls player.lifePowerUpCollected(); the port has addExtraLife (direct) but not the 100-per-life FSM.
  REACHABILITY UNCERTAIN: gPlayerHair=0 (GameSpecific) — confirm whether #hairGem actually spawns before
  building the accumulator. Core lives/respawn/game-over flow is CLEAN (modExtraLives audit). Deferred.

## CLEAN (cont.)
modCharacterAttackProperties (all per-level stat growth faithful incl. the walkSpeed fix), cutSceneMaster
(all 31 cutscene verbs implemented), armyMaster (bank/withdraw/re-field reserve faithful).

- [x] **room-cleared sound missing (objRoom.attemptOpenExits pRoomClearedSound)** — on the FIRST clear of a
  non-final room the original plays pRoomClearedSound ("end_screen"); the port's markCleared was silent.
  FIXED: RoomManager.markCleared plays "end_screen" on first clear unless that clear wins the map (a
  game-complete sound plays then, matching `if not isMapClear`). "end_screen" is a shipped asset.
  casts objRoom.txt:64,200-207 | port/src/world/rooms.ts (markCleared).

## NON-GAPS — different game (Rapunzel's Escape, same engine), out of scope for Merlin's Revenge
- modExtraLives lifePowerUpCollected (100 #hairGem powerups -> 1 life): a Rapunzel feature; gPlayerHair=0 in
  Merlin's GameSpecific and NO Merlin pickup is a #hairGem. Core lives/respawn/game-over is CLEAN.
- objPowerUp hair powerups (hairGem/hairPotion/etc.) and timed expiration (#timeAlive): hair = Rapunzel;
  timeAlive defaults 0 and NO Merlin pickup sets it -> Merlin pickups never auto-vanish (port faithful).

## CLEAN (cont.)
objRoom (after sound fix), modScreenExits, mapMaster, collisionMaster, objPowerUp (Merlin-relevant paths).
