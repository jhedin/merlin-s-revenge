on GeomPointOnCircle cent, rad, angl
  theloc = point(0, 0)
  radian = angl / 180.0 * PI
  theloc[1] = cent[1] + (cos(radian) * rad)
  theloc[2] = cent[2] - (sin(radian) * rad)
  return theloc
end
