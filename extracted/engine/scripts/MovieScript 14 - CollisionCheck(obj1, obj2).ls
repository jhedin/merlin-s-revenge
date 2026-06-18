on CollisionCheck obj1, obj2
  obj1Rect = obj1.calcCollisionRect(obj1.getLoc()).rect
  obj2RectInfo = obj2.calcCollisionRect(obj2.getLoc())
  if (obj1Rect = rect(-1, -1, 0, 0)) or (obj2RectInfo.rect = rect(-1, -1, 0, 0)) then
    return 0
  end if
  obj1Rect = obj1Rect + obj2RectInfo.edgeOffset
  if inside(obj2.getLoc(), obj1Rect) then
    return 1
  end if
  return 0
end
