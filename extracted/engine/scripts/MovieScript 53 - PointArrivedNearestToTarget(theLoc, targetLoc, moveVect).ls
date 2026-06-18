on PointArrivedNearestToTarget theloc, targetloc, lastDistXY
  targetReached = 0
  distxy = PointDistXY(theloc, targetloc)
  if (distxy.locH > lastDistXY.locH) or (distxy.locV > lastDistXY.locV) then
    targetReached = 1
  end if
  lastDistXY.locH = distxy.locH
  lastDistXY.locV = distxy.locV
  return targetReached
end
