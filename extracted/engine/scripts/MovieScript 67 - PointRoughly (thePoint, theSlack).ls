on PointRoughly thepoint, theSlack
  roughPoint = point(0, 0)
  roughPoint.locH = VarRoughly(thepoint.locH, theSlack)
  roughPoint.locV = VarRoughly(thepoint.locV, theSlack)
  return roughPoint
end
