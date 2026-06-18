on PointFrameMove fromPoint, toPoint, speed
  disttotarget = SineDist(fromPoint, toPoint)
  distSpeedRatio = disttotarget / speed
  distxy = toPoint - fromPoint
  if (speed > disttotarget) and (speed > -disttotarget) then
    framemove = distxy
  else
    if distSpeedRatio = 0 then
      framemove = point(0, 0)
    else
      framemove = distxy / point(distSpeedRatio, distSpeedRatio)
    end if
  end if
  return framemove
end
