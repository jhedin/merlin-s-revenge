on PointDirRectProportional fromPoint, torect
  Dir = point(0, 0)
  dir1 = PointDirPoint(fromPoint, point(torect[1], torect[2]))
  dir2 = PointDirPoint(fromPoint, point(torect[3], torect[4]))
  Dir = dir1 + dir2
  Dir[1] = VarKeepInRange(Dir[1], -1, 1)
  Dir[2] = VarKeepInRange(Dir[2], -1, 1)
  rectX = (torect.left + torect.right) / 2
  rectY = (torect.top + torect.bottom) / 2
  distX = fromPoint.locH - rectX
  distY = fromPoint.locV - rectY
  if distY = 0 then
    ratio = 22
  else
    ratio = 1.0 * VarPositive(distX) / VarPositive(distY)
  end if
  total = ratio + 1.0
  Dir[1] = Dir[1] * (ratio / total)
  Dir[2] = Dir[2] * (1 / total)
  return Dir
end
