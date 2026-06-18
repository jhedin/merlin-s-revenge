on GeomAngle slope
  deltaH = slope[1]
  deltaV = slope[2]
  if deltaH <> 0 then
    slope = float(deltaV) / deltaH
    angle = atan(slope)
    if deltaH < 0 then
      angle = angle + PI
    end if
  else
    if deltaV > 0 then
      angle = PI / 2
    else
      if deltaV < 0 then
        angle = 3 * PI / 2
      else
        angle = 0
      end if
    end if
  end if
  angle = angle * 180 / PI
  if angle < 0 then
    angle = 360 + angle
  end if
  return angle
end
