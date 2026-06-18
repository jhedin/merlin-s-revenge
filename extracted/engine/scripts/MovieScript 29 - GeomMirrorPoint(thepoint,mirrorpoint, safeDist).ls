on GeomMirrorPoint thepoint, mirrorpoint, safeDist
  destPoint = point(0, 0)
  safeDist = safeDist * 20
  mirvect = thepoint - mirrorpoint
  destVect = vector(mirvect.locH, mirvect.locV, 0)
  destVect.normalize()
  mirvect.locH = destVect.x * safeDist
  mirvect.locV = destVect.y * safeDist
  destPoint = thepoint - mirvect
  return destPoint
end
