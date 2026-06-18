property ancestor, pCollected, pNonWritingMember, pWritingMember

on new me
  ancestor = new(script("objPowerUp"))
  i = me.modifyParams(#init)
  i[#writingMember] = #nameBased
  me.addModule("modFader")
  me.addModule("modReel")
  return me
end

on init me, params
  ancestor.init(params)
  pCollected = 0
  pNonWritingMember = params.member
  me.setWritingMember(params.writingMember)
end

on addSaveData me, sd
  sd[#pCollected] = pCollected
  ancestor.addSaveData(sd)
end

on collected me, collector
  pCollected = 1
  me.displayWriting()
  me.setRecordInRoomState(0)
  me.PlaySound(me.pCollectSound)
end

on displayWriting me
  me.setMember(pWritingMember)
  me.goMode(#writing)
  me.startFade()
end

on faderFin me
  me.setDead(1)
end

on getNonWritingMember me
  return pNonWritingMember
end

on restoreFromSave me, sd
  pCollected = sd.pCollected
  if pCollected = 1 then
    me.setMember(pWritingMember)
  end if
  ancestor.restoreFromSave(sd)
end

on setWritingMember me, newMem
  if newMem = #nameBased then
    memname = me.getCharacter() & "_writing"
    newMem = member(memname, "gfx")
  end if
  pWritingMember = newMem
end

on takeHit me, collisionVect
  if pCollected then
    return 
  end if
  me.goMode(#reel)
  ancestor.takeHit(collisionVect)
end
