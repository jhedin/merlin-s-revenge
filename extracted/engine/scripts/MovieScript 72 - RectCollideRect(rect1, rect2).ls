on RectCollideRect rect1, rect2
  if (rect1.left <= rect2.right) and (rect1.right >= rect2.left) then
    if (rect1.top <= rect2.bottom) and (rect1.bottom >= rect2.top) then
      return 1
    end if
  end if
  return 0
end
