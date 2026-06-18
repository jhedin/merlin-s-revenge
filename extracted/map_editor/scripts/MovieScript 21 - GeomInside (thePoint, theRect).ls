on GeomInside thepoint, therect
  pointInside = 0
  if VarInRange(thepoint[1], [therect[1], therect[3]]) and VarInRange(thepoint[2], [therect[2], therect[4]]) then
    pointInside = 1
  end if
  return pointInside
end
