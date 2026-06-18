property pCeilingLevel, pGroundLevel, pWalls
global gStageSize

on new me
  return me
end

on init me
  pCeilingLevel = 0
  pGroundLevel = gStageSize[2] - 40
  pWalls = [0, gStageSize[1]]
end

on checkCollisions me, callingPrg, newLoc, oldloc, spr, useMiddle
  newLoc = me.checkCollisionsCeilings(callingPrg, newLoc, spr, useMiddle)
  newLoc = me.checkCollisionsWalls(callingPrg, newLoc, spr, useMiddle)
  newLoc = me.checkCollisionsPlatforms(callingPrg, newLoc, spr, useMiddle)
  return newLoc
end

on checkCollisionsCeilings me, callingPrg, newLoc, spr, useMiddle
  if useMiddle then
    topOffset = spr.height / 2 * -1
  else
    topOffset = spr.member.regPoint[2] * -1
  end if
  newTop = newLoc[2] + topOffset
  if newTop < pCeilingLevel then
    newLoc[2] = pCeilingLevel - topOffset
    callingPrg.collisionCeiling()
  end if
  return newLoc
end

on checkCollisionsPlatforms me, callingPrg, newLoc, spr, useMiddle
  if useMiddle then
    bottomOffset = spr.height / 2
  else
    bottomOffset = spr.height - spr.member.regPoint[2]
  end if
  newBottom = newLoc[2] + bottomOffset
  if newBottom > pGroundLevel then
    newLoc[2] = pGroundLevel - bottomOffset
    callingPrg.collisionPlatform()
  else
    callingPrg.collisionNoPlatform()
  end if
  return newLoc
end

on checkCollisionsWalls me, callingPrg, newLoc, spr, useMiddle
  if useMiddle then
    rightOffset = spr.width / 2
    leftOffset = rightOffset * -1
  else
    rightOffset = spr.width - spr.member.regPoint[1]
    leftOffset = spr.member.regPoint[1] * -1
  end if
  newLeft = newLoc + leftOffset
  newRight = newLoc + rightOffset
  if newLeft < pWalls[1] then
    newLoc[1] = pWalls[1] - leftOffset
    callingPrg.collisionWallLeft()
  end if
  if newRight > pWalls[2] then
    newLoc[1] = pWalls[2] - rightOffset
    callingPrg.collisionWallRight()
  end if
  return newLoc
end

on stop me
end
