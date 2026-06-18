on PointRandomInRect therect
  theloc = point(0, 0)
  theloc.locH = random(therect.width) + therect.left
  theloc.locV = random(therect.height) + therect.top
  return theloc
end
