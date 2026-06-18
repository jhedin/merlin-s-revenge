property ancestor, pAdjustXY, pCallingPrg, pCheckStalled, pFin, pFinIfOffscreen, pFinReason, pFriction, pKeepVect, pGravity, pLoc, pMoveToTarget, pMoveVect, pOldLoc, pOldRect, pOldSpriteLoc, pStallCount, pStallSpeed, pSpr, pTargetLoc, pVect, pWeight
global gFrameNum, gGameSpeed, gMoveSpeedLimit, gStageSize, gGameView, g

on new me
  me.ancestor = new(script("objAutoUpdate"))
  i = me.modifyParams(#init)
  i[#spr] = #none
  i[#callingPrg] = #none
  i[#callingPrgMessage] = #moveXYFin
  m = me.modifyParams(#moveToTarget)
  m[#targetloc] = point(100, 100)
  m[#speed] = 10
  return me
end

on init me, params
  me.ancestor.init(params)
  pAdjustXY = 0
  pCallingPrg = params.callingPrg.id.bigMe
  pCheckStalled = 1
  pFinIfOffscreen = 1
  pFriction = point(12.5, 0)
  pKeepVect = 0
  pGravity = 0
  pMoveToTarget = 0
  pMoveVect = #none
  pSpr = params.spr
  pWeight = 0
  pVect = point(0.0, 0.0)
  pStallCount = CounterNew()
  pStallCount.tim = [1, 10]
  pStallCount.inc = gGameSpeed
  pStallSpeed = 0.20000000000000001
  pTargetLoc = #none
  pLoc = pSpr.loc.duplicate()
  me.setLoc(pSpr.loc.duplicate())
  pOldSpriteLoc = pSpr.loc.duplicate()
end

on initGameChar me, callingPrg, spr
  me.init(callingPrg, spr)
  me.setAdjustXY(1)
  me.setAutoUpdate(0)
  me.setFinIfOffscreen(0)
  me.setWeight(0.20000000000000001)
end

on bounceLeft me
  if pVect[1] > 0 then
    me.flipVect(1)
  end if
end

on bounceRight me
  if pVect[1] < 0 then
    me.flipVect(1)
  end if
end

on calcStart me
  me.ancestor.calcStart()
end

on checkTargetReached me
  return PointArrivedAtTarget(pLoc, pTargetLoc, pVect)
end

on finishConditionMet me
  fin = 0
  if pCheckStalled then
    if pStallCount.fin then
      fin = 1
      pFinReason = #stalled
    end if
  end if
  if pFinIfOffscreen then
    if me.onscreen() = 0 then
      fin = 1
      pFinReason = #offscreen
    end if
  end if
  if pMoveToTarget then
    fin = me.checkTargetReached()
    if fin then
      pFinReason = #targetReached
    end if
  end if
  if fin then
    pMoveToTarget = 0
    pVect = point(0, 0)
  end if
  return fin
end

on flipVect me, i
  pVect[i] = pVect[i] * -1
end

on incStallSpeed me, amount
  pStallSpeed = pStallSpeed + amount
end

on informCallingPrg me
  pCallingPrg.moveXYFin()
end

on onscreen me
  stagerect = rect(0, 0, gStageSize[1], gStageSize[2])
  if pSpr.loc.inside(stagerect) then
    return 1
  end if
  sprRect = pSpr.rect
  intRect = sprRect.intersect(stagerect)
  if intRect = rect(0, 0, 0, 0) then
    return 0
  end if
  return 1
end

on update me
  if pAdjustXY then
    pCallingPrg.updateAI()
  end if
  if pKeepVect then
    pVect = pLoc - pOldLoc
    pOldLoc = pLoc.duplicate()
  end if
  speed = PointPositive(pVect.duplicate())
  lostSpeed = PointValRange(pFriction, [point(0.0, 0.0), speed])
  lostSpeed = lostSpeed * gGameSpeed
  GravWeightSpeed = pGravity * pWeight * gGameSpeed
  pVect[2] = pVect[2] + GravWeightSpeed
  pVect = PointTowardZero(pVect, lostSpeed)
  mvVect = pVect.duplicate()
  if gMoveSpeedLimit <> #none then
    mvVect = PointConstrainToRect(mvVect, gMoveSpeedLimit)
  end if
  newLoc = pLoc + mvVect
  me.stallUpdate(newLoc.duplicate(), pLoc.duplicate())
  if pAdjustXY then
    newLoc = pCallingPrg.checkCollisions(newLoc)
  end if
  me.moveLoc(newLoc)
  me.calcFin()
  pSpr.loc = pLoc.duplicate()
  pMoveVect = pSpr.loc - pOldSpriteLoc
  pOldSpriteLoc = pSpr.loc.duplicate()
end

on addSaveData me, sd
  sd[#pFriction] = pFriction
  sd[#pLoc] = pLoc
  sd[#pMoveToTarget] = pMoveToTarget
  sd[#pMoveVect] = pMoveVect
  sd[#pOldSpriteLoc] = pOldSpriteLoc
  sd[#pStallSpeed] = pStallSpeed
  sd[#pTargetLoc] = pTargetLoc
  sd[#pVect] = pVect
  sd[#pSpr_flipH] = pSpr.flipH
  ancestor.addSaveData(sd)
end

on addVectY me, newVectY
  pVect[2] = pVect[2] + newVectY
end

on getFin me
  return pFin
end

on getFinReason me
  return pFinReason
end

on getMoveVect me
  if pMoveVect = #none then
    return pMoveVect
  else
    return pMoveVect.duplicate()
  end if
end

on getOldRect me
  return pOldRect.duplicate()
end

on getStalled me
  return pStallCount.fin
end

on getVect me
  return pVect.duplicate()
end

on getVectX me
  return pVect[1]
end

on getVectY me
  return pVect[2]
end

on moveLoc me, newLoc
  pLoc = newLoc.duplicate()
end

on moveToTarget me, params
  pTargetLoc = params.targetloc
  movevect = GeomMoveVector(pLoc, pTargetLoc, params.speed)
  me.setVect(movevect)
  pMoveToTarget = 1
end

on resetStallCounter me
  CounterReset(pStallCount)
end

on restoreFromSave me, sd
  pFriction = sd.pFriction
  pLoc = sd.pLoc
  pMoveToTarget = sd.pMoveToTarget
  pOldSpriteLoc = sd.pOldSpriteLoc
  pSpr.flipH = sd.pSpr_flipH
  pStallSpeed = sd.pStallSpeed
  pTargetLoc = sd.pTargetLoc
  pVect = sd.pVect
  ancestor.restoreFromSave(sd)
end

on setAdjustXY me, newAdjustXY
  pAdjustXY = newAdjustXY
end

on setCheckStalled me, newVal
  pCheckStalled = newVal
end

on setFinIfOffscreen me, newFinIfOffscreen
  pFinIfOffscreen = newFinIfOffscreen
end

on frictionSet me, newFric
  pFriction = newFric
end

on setFriction me, newFriction
  pFriction = newFriction
end

on setFrictionX me, newFricX
  pFriction[1] = newFricX
end

on setFrictionY me, newFricY
  pFriction[2] = newFricY
end

on setGravity me, newGravity
  pGravity = newGravity
end

on setKeepVect me, newKeepVect
  pKeepVect = newKeepVect
end

on setLoc me, newLoc
  pOldLoc = newLoc.duplicate()
  pVect = point(0, 0)
  me.moveLoc(newLoc)
end

on setStallSpeed me, newVal
  pStallSpeed = newVal
end

on setVect me, newVect
  pVect = newVect.duplicate()
end

on setVectX me, newVectX
  pVect[1] = newVectX
end

on setVectY me, newVectY
  pVect[2] = newVectY
end

on setWeight me, newWeight
  pWeight = newWeight
end

on stallUpdate me, newLoc, currentLoc
  if pMoveVect = #none then
    return 
  end if
  speed = PointPositive(pMoveVect.duplicate())
  speed = speed.locH + speed.locV
  if speed <= pStallSpeed then
    CounterOnce(pStallCount)
  else
    pStallCount = CounterReset(pStallCount)
    pFin = 0
  end if
end

on vectAdd me, newVect
  pVect = pVect + newVect
end

on updateOldRect me
  iLoc = PointInteger(pLoc.duplicate())
  oldRectInfo = pCallingPrg.calcNewRect(iLoc)
  pOldRect = oldRectInfo.rect
end
