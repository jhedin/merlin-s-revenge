on PointDirRect fromPoint, torect
  Dir = point(0, 0)
  dir1 = PointDirPoint(fromPoint, point(torect[1], torect[2]))
  dir2 = PointDirPoint(fromPoint, point(torect[3], torect[4]))
  Dir = dir1 + dir2
  Dir[1] = VarKeepInRange(Dir[1], -1, 1)
  Dir[2] = VarKeepInRange(Dir[2], -1, 1)
  return Dir
end
