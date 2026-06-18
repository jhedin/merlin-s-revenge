property ancestor, pActorType, pAllowScreenExit, pCreateOnSolid, pCharacter, pCollisionDetection, pCollisionUseMiddle, pConstrainToPlayArea, pDead, pFrictionReel, pFrictionX, pFrictionY, pInertia, pmode, pMoveXY, pMinCollisionSpeed, pParams, pPreviousMode, pRecordInRoomState, pSpr, pTeam, pTeamRole, pTransColor
global g, gGameObjectLayer, gBounceyWalls, gGameView

on new me
  ancestor = new(script("objAutoUpdate"))
  friction = point(50, 50)
  i = me.modifyParams(#init)
  i.flags.append(#objGameObject)
  i[#actorType] = #gameObject
  i[#allowScreenExit] = 0
  i[#character] = #gameObject
  i[#collisionDetection] = 1
  i[#collisionUseMiddle] = 0
  i[#constrainToPlayArea] = #auto
  i[#createOnSolid] = 0
  i[#friction] = friction
  i[#frictionReel] = point(10, 10)
  i[#inertia] = 0
  i[#initFaceDir] = 1
  i[#initLoc] = point(100, 100)
  i[#initMode] = #stand
  i[#initVect] = point(0, 0)
  i[#keepVect] = 0
  i[#layerZ] = gGameObjectLayer
  i[#name] = #none
  i[#masterPrg] = #none
  i[#member] = #none
  i[#minCollisionSpeed] = 5
  i[#recordInRoomState] = 1
  i[#stallSpeed] = 0.20000000000000001
  i[#startOffset] = point(0, 0)
  i[#team] = #none
  i[#teamRole] = #teamMembers
  i[#weight] = 0.20000000000000001
  i[#wizard] = 0
  me.addModule("modCollisionRect")
  me.addModule("modColourTransform")
  me.addModule("modRelationships")
  me.addModule("modSoundFX")
  return me
end

on init me, params
  pActorType = params.actorType
  pAllowScreenExit = params.allowScreenExit
  pCharacter = params.character
  pCreateOnSolid = params.createOnSolid
  pCollisionDetection = params.collisionDetection
  pCollisionUseMiddle = params.collisionUseMiddle
  pConstrainToPlayArea = params.constrainToPlayArea
  me.autoConstrainToPlayArea()
  pDead = 0
  pFrictionReel = params.frictionReel
  pFrictionX = params.friction[1]
  pFrictionY = params.friction[2]
  pInertia = params.inertia
  pRecordInRoomState = params.recordInRoomState
  pSpr = g.spriteMaster.requestSprite(me.id.bigMe)
  pSpr.loc = params.initLoc.duplicate()
  pSpr.locZ = params.layerZ
  pTeam = params.team
  pTeamRole = params.teamRole
  pTransColor = #none
  pMinCollisionSpeed = params.minCollisionSpeed
  pPreviousMode = #none
  pmode = params.initMode
  pMoveXY = g.objectMaster.requestObject(#objMoveXY)
  moveXYparams = pMoveXY.getParams(#init)
  moveXYparams.callingPrg = me
  moveXYparams.spr = pSpr
  pMoveXY.initGameChar(moveXYparams)
  pMoveXY.setFriction(params.friction)
  pMoveXY.setStallSpeed(params.stallSpeed)
  pMoveXY.setKeepVect(params.keepVect)
  pMoveXY.setVect(params.initVect)
  pMoveXY.setWeight(params.weight)
  if params.member <> #none then
    SpriteSetMember(me.pSpr, params.member)
  end if
  me.setSpriteFlipFromDir(params.initFaceDir)
  ancestor.init(params)
  me.joinTeam()
  if params.wizard = 1 then
    g.wizardMaster.newWizardFound(pActorType)
  end if
end

on finish me
  me.eventNotify(#leaveGame)
  me.leaveTeam()
  if pMoveXY <> #none then
    pMoveXY.finish()
    pMoveXY = #none
  end if
  if pSpr <> #none then
    g.spriteMaster.freeSprite(pSpr)
    pSpr = #none
  end if
  ancestor.finish()
end

on autoConstrainToPlayArea me
  if pConstrainToPlayArea = #auto then
    if pCollisionDetection = 1 then
      pConstrainToPlayArea = 0
    else
      pConstrainToPlayArea = 1
    end if
  end if
end

on calcCollisionRegPoint me
  if pCollisionUseMiddle then
    reg = point(0, 0)
    reg[1] = me.getSprite().width / 2
    reg[2] = me.getSprite().height / 2
  else
    reg = me.getMember().regPoint
  end if
  return reg
end

on addSaveData me, sd
  ancestor.addSaveData(sd)
  me.addToSaveData(sd)
  sd[#pmode] = pmode
  sd[#pPreviousMode] = pPreviousMode
  sd[#pRecordInRoomState] = pRecordInRoomState
  saveData = [:]
  pMoveXY.addSaveData(saveData)
  sd[#pMoveXY] = saveData
end

on addToArmyDetails me
  ad = me.getArmyDetails()
  me.addToSaveData(ad)
end

on addToSaveData me, sd
  sd[#pActorType] = pActorType
  sd[#pCollisionDetection] = pCollisionDetection
  sd[#pTeam] = pTeam
  sd[#spriteHeight] = pSpr.height
  sd[#spriteWidth] = pSpr.width
end

on calcEdgeOffset me
  edgeOffset = rect(0, 0, 0, 0)
  reg = me.calcCollisionRegPoint()
  edgeOffset[1] = reg[1] * -1
  edgeOffset[2] = reg[2] * -1
  edgeOffset[3] = reg[1]
  edgeOffset[4] = reg[2]
  return edgeOffset
end

on calcNewRect me, newLoc
  newRect = rect(0, 0, 0, 0)
  edgeOffset = me.calcEdgeOffset()
  newRect[1] = newLoc[1] + edgeOffset[1]
  newRect[2] = newLoc[2] + edgeOffset[2]
  newRect[3] = newLoc[1] + edgeOffset[3]
  newRect[4] = newLoc[2] + edgeOffset[4]
  newRect[2] = newRect[2] + 4
  rectInfo = g.structMaster.getStruct(#rectInfo)
  rectInfo.rect = newRect
  rectInfo.edgeOffset = edgeOffset
  return rectInfo
end

on checkCollisions me, newLoc
  if pCollisionDetection then
    newLoc = g.collisionMaster.checkCollisions(me.big, newLoc)
  end if
  if pConstrainToPlayArea then
    newLoc = g.collisionMaster.constrainToPlayArea(me.big, newLoc)
  end if
  return newLoc
end

on checkCollisionsWithHair me
  player = g.actorMaster.getPlayer()
  collideVect = player.checkHairCollisions(me.id.bigMe.getRect(), pMinCollisionSpeed)
  if collideVect <> 0 then
    me.takeHit(collideVect)
  end if
end

on checkForCollisionWithPlayer me
  return CollisionCheck(me.big, g.actorMaster.getPlayer())
end

on collisionCeiling me
  pMoveXY.setVectY(0)
end

on collisionDetectionOff me
  pCollisionDetection = 0
end

on collisionDetectionOn me
  pCollisionDetection = 1
end

on collisionPlatform me
  pMoveXY.setVectY(0)
end

on collisionNoPlatform me
end

on collisionWallLeft me
  case gBounceyWalls of
    1:
      pMoveXY.bounceRight()
    0:
      pMoveXY.setVectX(0)
  end case
end

on collisionWallRight me
  case gBounceyWalls of
    1:
      pMoveXY.bounceLeft()
    0:
      pMoveXY.setVectX(0)
  end case
end

on collisionWithZone me, zoneType
  case zoneType of
    #ceiling:
      me.id.bigMe.collisionCeiling()
    #platform:
      me.id.bigMe.collisionPlatform()
    #wallLeft:
      me.id.bigMe.collisionWallLeft()
    #wallRight:
      me.id.bigMe.collisionWallRight()
  end case
end

on exitedPlayArea me, newLoc
  if pAllowScreenExit then
    g.collisionMaster.notifyOfScreenExit(me.id.bigMe, newLoc)
  else
    newLoc = g.collisionMaster.constrainLocToPlayArea(newLoc)
  end if
  return newLoc
end

on finishConditionMet me
  return pDead
end

on frictionXOff me
  pMoveXY.setFrictionX(5)
end

on frictionXOn me
  pMoveXY.setFrictionX(pFrictionX)
end

on frictionYOff me
  pMoveXY.setFrictionY(0)
end

on frictionYOn me
  pMoveXY.setFrictionY(pFrictionY)
end

on frictionNormal me
  me.frictionXOn()
  me.frictionYOn()
end

on frictionReel me
  pMoveXY.setFriction(pFrictionReel.duplicate())
end

on frictionSet me, newFriction
  pMoveXY.frictionSet(newFriction)
end

on frictionStrong me
  pMoveXY.setFriction(point(20, 20))
end

on getActorType me
  return pActorType
end

on getAIPlatformDrop me
  return 0
end

on getCharacter me
  return pCharacter
end

on getCollisionDetection me
  return pCollisionDetection
end

on getCollisionUseMiddle me
  return pCollisionUseMiddle
end

on getDead me
  return pDead
end

on getFlip me
  return pSpr.flipH
end

on getFlipAsDir me
  if pSpr.flipH then
    return -1
  else
    return 1
  end if
end

on getLoc me
  return PointInteger(pMoveXY.pLoc.duplicate())
end

on getLocZ me
  return pSpr.locZ
end

on getImage me
  return pSpr.member.image
end

on getMember me
  return pSpr.member
end

on getMemberSize me
  memSize = point(0, 0)
  memSize.locH = pSpr.member.width
  memSize.locV = pSpr.member.height
  return memSize
end

on getMemberType me
  return pSpr.member.type
end

on getMode me
  return pmode
end

on getMoveVect me
  return pMoveXY.getMoveVect()
end

on getMoveXYFin me
  return pMoveXY.getFin()
end

on getMoveXYParams me, function
  return pMoveXY.getParams(function)
end

on getNewLoc me
  return pMoveXY.pLoc.duplicate()
end

on getOldLoc me
  return pMoveXY.pOldLoc.duplicate()
end

on getOldRect me
  return pMoveXY.getOldRect()
end

on getPreviousMode me
  return pPreviousMode
end

on getRadius me
  return me.getWidth() / 2
end

on getRect me
  return SpriteGetRect(pSpr)
end

on getRecordInRoomState me
  return pRecordInRoomState
end

on getRegPoint me
  return pSpr.member.regPoint
end

on getStalled me
  return pMoveXY.getStalled()
end

on getSprite me
  return pSpr
end

on getSpriteColor me
  return pSpr.color
end

on getSpriteHeight me
  return pSpr.height
end

on getSpriteSize me
  return point(pSpr.width, pSpr.height)
end

on getSpriteRect me
  return pSpr.rect.duplicate()
end

on getSpriteWidth me
  return me.getWidth()
end

on getTargetDetails me
  if me.getDead() or me.checkDead() then
    return g.structMaster.getStruct(#targetDetails)
  end if
  targetDetails = g.structMaster.getStruct(#targetDetails)
  targetDetails.team = pTeam
  targetDetails.teamRole = pTeamRole
  targetDetails.sprloc = me.getLoc()
  return targetDetails
end

on getTeam me
  return pTeam
end

on getTeamRole me
  return pTeamRole
end

on getVect me
  return pMoveXY.getVect()
end

on getVectX me
  return pMoveXY.getVectX()
end

on getWidth me
  return pSpr.width
end

on goMode me, newMode
  ancestor.goMode(newMode)
  pPreviousMode = pmode
  pmode = newMode
end

on incSpriteHeight me, addition
  newHeight = pSpr.height + addition
  me.setSpriteHeight(newHeight)
end

on incStallSpeed me, amount
  pMoveXY.incStallSpeed(amount)
end

on informCallingPrg me
end

on internalEvent me, theEvent
  ancestor.internalEvent(theEvent)
  case theEvent of
    #addToArmyDetails:
      me.addToArmyDetails()
    #restoreFromArmyDetails:
      me.restoreFromArmyDetails()
  end case
end

on joinTeam me
  g.teamMaster.joinTeam(pTeam, pTeamRole, me.id.bigMe)
end

on leaveTeam me
  g.teamMaster.leaveTeam(pTeam, pTeamRole, me.id.bigMe)
  me.big.internalEvent(#leftTeam)
end

on moveLoc me, newLoc
  pMoveXY.moveLoc(newLoc)
end

on moveToTarget me, params
  pMoveXY.moveToTarget(params)
end

on outsidePlayArea me, amount
end

on paws me
  pMoveXY.paws()
  if pTransColor <> #none then
    pTransColor.paws()
  end if
  ancestor.paws()
end

on recordInRoomState me
  return pRecordInRoomState
end

on resetStallCounter me
  me.pMoveXY.resetStallCounter()
end

on restoreFromArmyDetails me
  ad = me.getArmyDetails()
  me.restoreFromSaveData(ad)
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
  pmode = sd.pmode
  pPreviousMode = sd.pPreviousMode
  pRecordInRoomState = sd.pRecordInRoomState
  pMoveXY.restoreFromSave(sd.pMoveXY)
  me.restoreFromSaveData(sd)
end

on restoreFromSaveData me, sd
  pActorType = sd.pActorType
  pCollisionDetection = sd.pCollisionDetection
  pTeam = sd.pTeam
  me.setSpriteHeight(sd.spriteHeight)
  me.setSpriteWidth(sd.spriteWidth)
end

on setCheckStalled me, newVal
  pMoveXY.setCheckStalled(newVal)
end

on setDead me, newDead
  pDead = newDead
end

on setFlip me, newFlip
  if (pSpr <> #none) and (pSpr <> #void) then
    pSpr.flipH = newFlip
  end if
end

on setFlipFromDir me, Dir
  me.setSpriteFlipFromDir(Dir)
end

on setKeepVect me, newVal
  pMoveXY.setKeepVect(newVal)
end

on setLocX me, newX
  myloc = me.getLoc()
  me.setLoc(point(newX, myloc.locV))
end

on setLocY me, newY
  myloc = me.getLoc()
  me.setLoc(point(myloc.locH, newY))
end

on setLocZ me, newZ
  pSpr.locZ = newZ
end

on setLoc me, newLoc
  pMoveXY.setLoc(newLoc)
end

on setMember me, newMember
  SpriteSetMember(me.pSpr, newMember)
end

on setMode me, newVal
  pmode = newVal
end

on setRecordInRoomState me, newVal
  pRecordInRoomState = newVal
end

on setSpriteColour me, newColour
  pSpr.color = newColour
end

on setSpriteFlipFromDir me, thedir
  if thedir = 1 then
    me.setFlip(0)
  else
    if thedir = -1 then
      me.setFlip(1)
    end if
  end if
end

on setSpriteLayer me, newLayer
  pSpr.locZ = newLayer
end

on setSpriteHeight me, theheight
  pSpr.height = theheight
end

on setSpriteRotation me, theAngle
  pSpr.rotation = theAngle
end

on setSpriteWidth me, thewidth
  pSpr.width = thewidth
end

on setTeam me, newTeam
  me.leaveTeam()
  pTeam = newTeam
  me.joinTeam()
end

on setVect me, newVect
  pMoveXY.setVect(newVect)
end

on setWeight me, newWeight
  pMoveXY.setWeight(newWeight)
end

on start me
  ancestor.start()
  pMoveXY.setAutoUpdate(1)
  pMoveXY.calcStart()
  pMoveXY.setAutoUpdate(0)
end

on takeHit me, collideVect, attackingObj, owner
  percent = 100 - pInertia
  collideVect[1] = VarValRange(percent, [0, collideVect[1]])
  collideVect[2] = VarValRange(percent, [0, collideVect[2]])
  me.pMoveXY.vectAdd(collideVect)
  ancestor.takeHit(collideVect, attackingObj, owner)
end

on unpaws me
  pMoveXY.unpaws()
  if pTransColor <> #none then
    pTransColor.unpaws()
  end if
  ancestor.unpaws()
end

on update me
  ancestor.update()
end

on updateAI me
end
