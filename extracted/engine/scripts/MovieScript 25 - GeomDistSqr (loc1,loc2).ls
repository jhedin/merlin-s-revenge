on GeomDistSqr loc1, loc2
  distxy = loc2 - loc1
  return (distxy.locH * distxy.locH) + (distxy.locV * distxy.locV)
end
