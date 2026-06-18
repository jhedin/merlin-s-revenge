property ancestor, pFlipWithMovement, pMoveHoriz, pMoveVert, pMoveToLocArrivalDistance, pMoveToLocTarget, pMoveTowardsLocFunction, pVerticalLeeway, pWalkAcceleration, pWalkSpeed, pWalkSpeedInc, pWalkSpeedIncLevel
global g, gGameView

on new me
  ancestor = new(script("modModule"))
  return me
end

on addModParams me
  i = me.modifyParams(#init)
  i[#verticalLeeway] = 8
  i[#walkAcceleration] = 0.5
  i[#walkSpeed] = 0
  i[#walkSpeedInc] = 0.075
  i[#walkSpeedIncLevel] = 0.075
  ancestor.addModParams()
end

on init me, params
  ancestor.init(params)
  pFlipWithMovement = 1
  pMoveToLocArrivalDistance = 5
  pMoveToLocTarget = #none
  pMoveHoriz = 0
  pMoveVert = 0
  pVerticalLeeway = params.verticalLeeway
  pWalkAcceleration = params.walkAcceleration
  pWalkSpeed = params.walkSpeed
  pWalkSpeedInc = params.walkSpeedInc
  pWalkSpeedIncLevel = params.walkSpeedIncLevel
  pMoveTowardsLocFunction = #moveTowardsLocSpeed
  if params[#ghost] = 1 then
    pMoveTowardsLocFunction = #moveTowardsLocAccelerated
  end if
  me.big.keepMePosted(me.big.pMoveXY, #moveXYFin, #always)
end

on addSaveData me, sd
  ancestor.addSaveData(sd)
  me.addToSaveData(sd)
  sd[#pMoveToLocTarget] = pMoveToLocTarget
end

on addToArmyDetails me, ad
  ad = me.big.getArmyDetails()
  me.addToSaveData(ad)
end

on addToSaveData me, sd
  sd[#pWalkAcceleration] = pWalkAcceleration
  sd[#pWalkSpeed] = pWalkSpeed
end

on cancelMoveToLoc me
  pMoveToLocTarget = #none
end

on faceObject me, theObj
  locToFace = theObj.getLoc()
  dirToFace = PointDirPoint(me.id.bigMe.getLoc(), locToFace)
  me.id.bigMe.setSpriteFlipFromDir(dirToFace[1])
end

on getMoving me
  moving = 0
  if pMoveHoriz or pMoveVert then
    moving = 1
  end if
  return moving
end

on getMoveHoriz me
  return pMoveHoriz
end

on getWalkSpeed me
  return pWalkSpeed
end

on getMoveVert me
  return pMoveVert
end

on incWalkSpeed me, amount
  pWalkSpeed = pWalkSpeed + amount
end

on incWalkSpeedLevel me
  me.incWalkSpeed(pWalkSpeedIncLevel)
end

on incWalkSpeedPotion me
  me.incWalkSpeed(pWalkSpeedInc)
end

on internalEvent me, theEvent
  ancestor.internalEvent(theEvent)
  case theEvent of
    #addToArmyDetails:
      me.addToArmyDetails()
    #levelUp:
      me.incWalkSpeedLevel()
    #restoreFromArmyDetails:
      me.restoreFromArmyDetails()
  end case
end

on moveAwayFromLoc me, targetloc
  destinationLoc = GeomMirrorPoint(targetloc, me.big.getLoc())
  me.moveToLoc(destinationLoc)
end

on moveHoriz me, Dir
  me.pMoveXY.vectAdd(point(pWalkAcceleration * Dir, 0))
  me.moveHorizReaction(Dir)
end

on moveHorizReaction me, Dir
  if Dir < 0 then
    me.pSpr.flipH = 1
    pMoveHoriz = 1
  else
    if Dir > 0 then
      me.pSpr.flipH = 0
      pMoveHoriz = 1
    else
      if Dir = 0 then
        pMoveHoriz = 0
      end if
    end if
  end if
end

on moveToLoc me, theTarget
  pMoveToLocTarget = theTarget
end

on moveTowardsLoc me, theTarget
  call(pMoveTowardsLocFunction, me.big, theTarget)
end

on moveTowardsLocAccelerated me, targetloc
  moveVector = PointDirPoint(me.getLoc(), targetloc)
  if VarDiff(targetloc[2], me.getLoc()[2]) < pVerticalLeeway then
    moveVector[2] = 0
  end if
  if moveVector[2] = 0 then
  end if
  if me.pmode = #landed then
    moveVector[2] = 0
  end if
  me.moveHoriz(moveVector[1])
  me.moveVert(moveVector[2])
  me.pAI.recordMoveVector(moveVector)
end

on moveTowardsLocSpeed me, targetloc
  if pWalkSpeed = 0 then
    return 
  end if
  myloc = me.getLoc()
  moveVector = PointFrameMove(myloc, targetloc, pWalkSpeed)
  me.pMoveXY.setVect(moveVector)
  moveDir = PointDir(PointInteger(moveVector))
  me.moveHorizReaction(moveDir[1])
  me.moveVertReaction(moveDir[2])
end

on moveVert me, Dir
  me.pMoveXY.vectAdd(point(0, pWalkAcceleration * Dir))
  me.moveVertReaction(Dir)
end

on moveVertReaction me, Dir
  if Dir <> 0 then
    pMoveVert = 1
  else
    if Dir = 0 then
      pMoveVert = 0
    end if
  end if
end

on resetMoveReaction me
  me.moveVertReaction(0)
  me.moveHorizReaction(0)
end

on restoreFromArmyDetails me, ad
  ad = me.big.getArmyDetails()
  me.restoreFromSaveData(ad)
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
  pMoveToLocTarget = sd.pMoveToLocTarget
end

on restoreFromSaveData me, sd
  pWalkAcceleration = sd.pWalkAcceleration
  pWalkSpeed = sd.pWalkSpeed
end

on setWalkAcceleration me, newVal
  pWalkAcceleration = newVal
end

on setWalkSpeed me, newVal
  pWalkSpeed = newVal
end

on stopMoving me
  me.moveToLoc(#none)
  me.big.setVect(point(0, 0))
  me.stoppedMoving()
end

on stopRunAnim me
  me.resetMoveReaction()
end

on stoppedMoving me
  me.resetMoveReaction()
end

on update me
  ancestor.update()
  me.resetMoveReaction()
  if pMoveToLocTarget <> #none then
    fin = me.updateMoveToLoc(pMoveToLocTarget)
    if fin then
      me.stoppedMoving()
      me.internalEvent(#moveToLocFinished)
      me.moveToLoc(#none)
    end if
  end if
end

on updateMoveToLoc me, targetloc
  fin = 0
  me.moveTowardsLoc(targetloc)
  disttotarget = GeomDistSqr(me.big.getLoc(), targetloc)
  if disttotarget <= (pMoveToLocArrivalDistance * pMoveToLocArrivalDistance) then
    fin = 1
  end if
  return fin
end
