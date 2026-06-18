on AddDist loc1, loc2
  diffx = abs(loc1[1] - loc2[1])
  diffy = abs(loc1[2] - loc2[2])
  dist = diffx + diffy
  return dist
end
