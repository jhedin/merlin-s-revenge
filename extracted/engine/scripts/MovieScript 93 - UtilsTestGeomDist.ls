on UtilsTestGeomDist
  global g
  pm = g.profileMaster
  reps = 10000
  point1 = point(30, 30)
  point2 = point(256, 256)
  pm.setTitle("GeomDist, Sine Dist, Geom Pixel Dist, Geom Dist Squared, and Add Dist")
  pm.startProfile(#GeomDist)
  repeat with i = 1 to reps
    dist = GeomDist(point1, point2)
  end repeat
  pm.stopProfile(#GeomDist)
  pm.startProfile(#SineDist)
  repeat with i = 1 to reps
    dist = SineDist(point1, point2)
  end repeat
  pm.stopProfile(#SineDist)
  pm.startProfile(#geomPixelDist)
  repeat with i = 1 to reps
    dist = geomPixelDist(point1, point2)
  end repeat
  pm.stopProfile(#geomPixelDist)
  pm.startProfile(#GeomDistSqr)
  repeat with i = 1 to reps
    dist = GeomDistSqr(point1, point2)
    dist = 100 * 100
  end repeat
  pm.stopProfile(#GeomDistSqr)
  pm.startProfile(#AddDist)
  repeat with i = 1 to reps
    dist = AddDist(point1, point2)
  end repeat
  pm.stopProfile(#AddDist)
  pm.writeReport()
end
