on PointDistXY fromLoc, toLoc
  distxy = point(0, 0)
  distxy.locH = abs(fromLoc.locH - toLoc.locH)
  distxy.locV = abs(fromLoc.locV - toLoc.locV)
  return distxy
end
