property ancestor, pGraveOn
global g

on new me
  ancestor = new(script("modModule"))
  return me
end

on addModParams me
  i = me.modifyParams(#init)
  i[#graveOn] = 1
  ancestor.addModParams()
end

on init me, params
  ancestor.init(params)
  pGraveOn = params.graveOn
  if params[#ghost] = 1 then
    pGraveOn = 0
  end if
end

on drawGrave me
  if pGraveOn = 0 then
    return 
  end if
  me.big.setFlipFromDir(1)
  currentRoom = g.gamemaster.getCurrentRoom()
  currentRoom.drawAndRecordGrave(me.id.bigMe)
end

on getGraveMember me
  return me.big.getAnimMemberFromStrip(#grave)
end

on getGraveOn me
  return pGraveOn
end
