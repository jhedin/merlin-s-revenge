global g

on new me
  return me
end

on init me
end

on experienceStar me, theObj
  params = g.actorMaster.getParams(#newActor)
  params.typ = #experienceStar
  params.initVect = point(0, -2)
  params.startLoc = theObj.getLoc()
  params.useOffset = 0
  star = g.actorMaster.newActor(params)
  theObjLocZ = theObj.getLocZ()
  star.setLocZ(theObjLocZ - 1)
end

on markerStar me, where
  star = g.actorMaster.newActor(#star, where)
  star.setWeight(0)
  star.setLifeCount(1)
end

on starBurstX me, where, strength
  if strength = VOID then
    strength = 3
  end if
  dirs = [point(-1, -1), point(-1, 1), point(1, -1), point(1, 1)]
  params = g.actorMaster.getParams(#newActor)
  params.typ = #star
  params.startLoc = where
  repeat with i = 1 to 4
    star = g.actorMaster.newActor(params)
    star.setVect(dirs[i] * strength)
  end repeat
end

on stop me
end
