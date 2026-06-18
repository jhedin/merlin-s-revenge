on GeomTangentPoint thepoint, mirrorpoint, Dir, safeDist
  destPoint = point(0, 0)
  dir1 = 1
  dir2 = 1
  if Dir > 0 then
    dir1 = -1
  else
    dir2 = -1
  end if
  mirvect = thepoint - mirrorpoint
  destVect = vector(mirvect.locH, mirvect.locV, 0)
  destVect.normalize()
  mirvect.locH = destVect.y * safeDist * 2 * dir1
  mirvect.locV = destVect.x * safeDist * 2 * dir2
  mirvect.locH = mirvect.locH + (destVect.x * safeDist / 5)
  mirvect.locV = mirvect.locV + (destVect.y * safeDist / 5)
  destPoint = thepoint - mirvect
  return destPoint
end
