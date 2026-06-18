on PointDirPoint fromPoint, toPoint
  dirX = VarMoreLess(fromPoint[1], toPoint[1])
  dirY = VarMoreLess(fromPoint[2], toPoint[2])
  Dir = point(dirX, dirY)
  return Dir
end
