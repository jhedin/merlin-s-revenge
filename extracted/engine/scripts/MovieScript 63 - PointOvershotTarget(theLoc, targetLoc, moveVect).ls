on PointOvershotTarget theloc, targetloc, movevect
  moveDir = PointDir(movevect)
  XReached = 0
  YReached = 0
  targetReached = 0
  if moveDir[1] = -1 then
    if theloc[1] <= targetloc[1] then
      XReached = 1
    end if
  else
    if moveDir[1] = 1 then
      if theloc[1] >= targetloc[1] then
        XReached = 1
      end if
    else
      if moveDir[1] = 0 then
        XReached = 1
      end if
    end if
  end if
  if XReached then
    targetReached = 1
  else
    if moveDir[2] = -1 then
      if theloc[2] <= targetloc[2] then
        YReached = 1
      end if
    else
      if moveDir[2] = 1 then
        if theloc[2] >= targetloc[2] then
          YReached = 1
        end if
      else
        if moveDir[2] = 0 then
          YReached = 1
        end if
      end if
    end if
    if YReached then
      targetReached = 1
    end if
  end if
  if targetReached then
    theloc[1] = targetloc[1]
    theloc[2] = targetloc[2]
  end if
  return targetReached
end
