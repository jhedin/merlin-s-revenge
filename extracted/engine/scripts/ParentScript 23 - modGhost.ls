property ancestor, pGhost, pTeamWhenAlive

on new me
  ancestor = new(script("modModule"))
  return me
end

on addModParams me
  i = me.modifyParams(#init)
  i[#ghost] = 0
  i[#teamWhenAlive] = #ghosts
  ancestor.addModParams()
end

on init me, params
  ancestor.init(params)
  pGhost = params.ghost
  pTeamWhenAlive = params.teamWhenAlive
  if pGhost then
    me.initGhost()
  end if
end

on initGhost me
  me.big.collisionDetectionOff()
end

on amGhost me
  return pGhost
end

on isGhost me
  return pGhost
end

on getTeamWhenAlive me
  return pTeamWhenAlive
end
