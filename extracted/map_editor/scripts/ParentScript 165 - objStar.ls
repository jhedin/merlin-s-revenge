property ancestor, pLifeCount

on new me
  ancestor = new(script("objGameObject"))
  return me
end

on init me, params
  ancestor.init(params)
  pLifeCount = CounterNew()
  pLifeCount.tim[2] = 10
end

on checkCollisions me, newLoc, oldloc
  return newLoc
end

on setLifeCount me, newLifeCount
  pLifeCount.tim[2] = newLifeCount
end

on update me
  if pLifeCount.fin then
    me.pDead = 1
  end if
  if me.pMoveXY.onscreen() = 0 then
    me.pDead = 1
  end if
  counter(pLifeCount)
  ancestor.update()
end
