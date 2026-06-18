property pCollisionMap, pCollisionWithPlatform, pPlayAreaRect, pPlayAreaRectToFindLeaveDir, pExitsOpen
global g, gStageSize

on new me
  return me
end

on init me
  pCollisionMap = #none
  pCollisionWithPlatform = 0
  pExitsOpen = 0
  me.initPlayArea()
end

on initPlayArea me
  currentMap = g.gamemaster.getCurrentMap()
  if currentMap = #none then
    pPlayAreaRect = rect(0, 0, gStageSize[1], 288)
  else
    pPlayAreaRect = currentMap.getSpriteRect()
  end if
  pPlayAreaRectToFindLeaveDir = pPlayAreaRect.inflate(-1, -1)
end

on checkCollisions me, callingPrg, newLoc
  vect = callingPrg.getVect()
  Dir = PointDirPoint(point(0, 0), vect)
  newLoc = pCollisionMap.checkCollisions(callingPrg, newLoc, Dir)
  if pExitsOpen then
    newLoc = me.checkLeaveScreen(callingPrg, newLoc)
  end if
  return newLoc
end

on checkCollisionsNewObject me, theObj
  collisionsOk = 1
  if theObj.getCollisionDetection() = 0 then
    return collisionsOk
  end if
  objLoc = theObj.getLoc()
  if objLoc.inside(pPlayAreaRect) then
    objVect = theObj.getVect()
    theObj.setVect(point(1, 1))
    newLoc = me.checkCollisions(theObj, objLoc.duplicate())
    if newLoc <> objLoc then
      collisionsOk = 0
    end if
    theObj.setVect(point(-1, -1))
    newLoc = me.checkCollisions(theObj, objLoc.duplicate())
    if newLoc <> objLoc then
      collisionsOk = 0
    end if
    theObj.setVect(objVect)
  end if
  return collisionsOk
end

on checkLeaveScreen me, callingPrg, newLoc
  if inside(newLoc, pPlayAreaRect) then
    nothing()
  else
    newLoc = callingPrg.exitedPlayArea(newLoc)
  end if
  return newLoc
end

on constrainToPlayArea me, theObj, newLoc
  collisionRect = theObj.calcCollisionRect(theObj.getLoc())
  edgeOffset = collisionRect.edgeOffset
  modifiedPlayArea = pPlayAreaRect.duplicate()
  modifiedPlayArea.left = modifiedPlayArea.left - edgeOffset.left
  modifiedPlayArea.top = modifiedPlayArea.top - edgeOffset.top
  modifiedPlayArea.right = modifiedPlayArea.right - edgeOffset.right
  modifiedPlayArea.bottom = modifiedPlayArea.bottom - edgeOffset.bottom
  return PointConstrainToRect(newLoc, modifiedPlayArea)
end

on constrainLocToPlayArea me, newLoc
  return PointConstrainToRect(newLoc, pPlayAreaRect)
end

on getPlayArea me
  return pPlayAreaRect.duplicate()
end

on notifyOfScreenExit me, callingPrg, newLoc
  exitDir = PointDirRect(newLoc, pPlayAreaRectToFindLeaveDir)
  exitDir = exitDir * -1
  callingPrg.outsidePlayArea(exitDir)
end

on setCollisionMap me, themap
  pCollisionMap = themap
end

on setCollisionWithPlatform me, newVal
  pCollisionWithPlatform = newVal
end

on setExitsOpen me, newVal
  pExitsOpen = newVal
end

on stop me
end
