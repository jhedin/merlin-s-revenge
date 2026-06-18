on CollisionCalcVect attackLoc, targetloc, attackPower
  dist = SineDist(attackLoc, targetloc)
  distxy = targetloc - attackLoc
  if dist = 0 then
    dist = 1.0
    distxy = point(0, 1)
  end if
  outputPower = attackPower - dist
  if outputPower <= 0 then
    collisionVect = point(0, 0)
  else
    numOfFrames = dist / outputPower
    initialFrameMove = distxy / point(numOfFrames, numOfFrames)
    collisionVect = initialFrameMove
  end if
  return collisionVect
end
