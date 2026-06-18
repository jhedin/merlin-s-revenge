on GeomMoveVectorAccurate startLoc, endLoc, speed
  if startLoc = endLoc then
    moveVector = point(0, 0)
  else
    speed = speed
    movexy = endLoc - startLoc
    dist = GeomDist(startLoc, endLoc)
    numOfFrames = dist / speed
    moveVector = movexy / point(numOfFrames, numOfFrames)
  end if
  return moveVector
end
