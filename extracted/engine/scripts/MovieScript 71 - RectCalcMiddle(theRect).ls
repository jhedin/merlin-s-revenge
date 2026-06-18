on RectCalcMiddle therect
  theloc = point(0, 0)
  theloc.locH = (therect.left + therect.right) / 2
  theloc.locV = (therect.top + therect.bottom) / 2
  return theloc
end
