on geomPixelDist loc1, loc2
  diffx = VarDiff(loc1[1], loc2[1])
  diffy = VarDiff(loc1[2], loc2[2])
  dist = max(diffx, diffy)
  return dist
end
