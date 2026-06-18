on SineDist loc1, loc2
  distxy = loc1 - loc2
  if distxy.locH = 0 then
    dist = distxy.locV * 1.0
  else
    theta = atan(distxy.locV / distxy.locH)
    if theta = 0 then
      dist = distxy.locH * 1.0
    else
      dist = distxy.locV / sin(theta)
    end if
  end if
  if dist < 0 then
    dist = -dist
  end if
  return dist
end
