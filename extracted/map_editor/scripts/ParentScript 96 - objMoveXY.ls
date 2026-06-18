property ancestor, pAdjustXY, pCallingPrg, pFin, pFinIfOffscreen, pFriction, pKeepVect, pGravity, pLoc, pOldLoc, pStallCount, pSpr, pVect, pWeight
global gGameSpeed, gStageSize

on new me
  me.ancestor = new(script("objAutoUpdate"))
  return me
end

on init me, callingPrg, spr
  me.ancestor.init()
  pAdjustXY = 0
  pCallingPrg = callingPrg.id.bigMe
  pFinIfOffscreen = 1
  pFriction = point(12.5, 0)
  pKeepVect = 0
  pGravity = 0
  me.setLoc(spr.loc.duplicate())
  pSpr = spr
  pWeight = 0
  pVect = point(0.0, 0.0)
  pStallCount = CounterNew()
  pStallCount.tim = [1, 10]
  pStallCount.inc = gGameSpeed
end

on initGameChar me, callingPrg, spr
  me.init(callingPrg, spr)
  me.setAdjustXY(1)
  me.setAutoUpdate(0)
  me.setFinIfOffscreen(0)
  me.setGravity(1)
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

on finishConditionMet me
  if pStallCount.fin then
    pVect = point(0, 0)
    return 1
  end if
  if pFinIfOffscreen then
    if me.onscreen() = 0 then
      return 1
    end if
  end if
  return 0
end

on flipVect me, i
  pVect[i] = pVect[i] * -1
end

on informCallingPrg
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
  newLoc = pLoc + pVect
  me.stallUpdate(newLoc.duplicate(), pLoc.duplicate())
  pLoc = newLoc
  if pAdjustXY then
    pLoc = pCallingPrg.checkCollisions(pLoc.duplicate(), pSpr.loc.duplicate())
  end if
  pSpr.loc = pLoc.duplicate()
  me.calcFin()
end

on addVectY me, newVectY
  pVect[2] = pVect[2] + newVectY
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

on setAdjustXY me, newAdjustXY
  pAdjustXY = newAdjustXY
end

on setFinIfOffscreen me, newFinIfOffscreen
  pFinIfOffscreen = newFinIfOffscreen
end

on frictionSet me, newFric
  pFriction = newFric
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

on setLoc me, newLoc
  pLoc = newLoc.duplicate()
  pOldLoc = newLoc.duplicate()
  pVect = point(0, 0)
end

on moveLoc me, newLoc
  pLoc = newLoc.duplicate()
end

on stallUpdate me, newLoc, currentLoc
  newLoc = PointInteger(newLoc)
  currentLoc = PointInteger(currentLoc)
  if newLoc = currentLoc then
    pStallCount = counter(pStallCount)
  else
    pStallCount = CounterReset(pStallCount)
    pFin = 0
  end if
end

on vectAdd me, newVect
  pVect = pVect + newVect
  pFin = 0
end

on setFriction me, newFriction
  pFriction = newFriction
end

on setKeepVect me, newKeepVect
  pKeepVect = newKeepVect
end

on setVect me, newVect
  pVect = newVect.duplicate()
  pFin = 0
  me.calcFin()
  me.calcStart()
end

on setVectY me, newVectY
  pVect[2] = newVectY
  pFin = 0
  me.calcFin()
  me.calcStart()
end

on setWeight me, newWeight
  pWeight = newWeight
end
