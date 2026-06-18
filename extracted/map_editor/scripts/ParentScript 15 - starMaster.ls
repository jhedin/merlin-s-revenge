global g

on new me
  return me
end

on init me
end

on markerStar me, where
  star = g.actorMaster.newActor(#star, where)
  star.setWeight(0)
  star.setLifeCount(1)
end

on starBurstX me, where, strength
  if strength = VOID then
    strength = 6
  end if
  dirs = [point(-1, -1), point(-1, 1), point(1, -1), point(1, 1)]
  repeat with i = 1 to 4
    star = g.actorMaster.newActor(#star, where)
    star.setVect(dirs[i] * strength)
  end repeat
end

on stop me
end
