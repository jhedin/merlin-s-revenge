on PointFloor aPoint
  bPoint = aPoint.duplicate()
  bPoint[1] = VarFloor(bPoint[1])
  bPoint[2] = VarFloor(bPoint[2])
  return bPoint
end
