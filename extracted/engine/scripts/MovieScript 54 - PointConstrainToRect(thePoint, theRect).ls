on PointConstrainToRect thepoint, therect
  thepoint.locH = VarKeepInRange(thepoint.locH, therect.left, therect.right)
  thepoint.locV = VarKeepInRange(thepoint.locV, therect.top, therect.bottom)
  return thepoint
end
