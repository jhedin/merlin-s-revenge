property ancestor, pCurrentMember, pDelay, pName, pMemberList
global g, gGameSpeed

on new me
  me.ancestor = new(script("objBasic"))
  return me
end

on init me, name
  pDelay = CounterNew()
  pDelay.inc = 1 * gGameSpeed
  pDelay.tim[2] = 3
  pName = name
  pMemberList = g.objectMaster.requestObject(#objlist)
  pMemberList.init(CastGetMembersContaining(name, "gfx"))
  pCurrentMember = pMemberList.nextValue()
end

on finish me
  pMemberList.finish()
  ancestor.finish()
end

on getFin me
  return pMemberList.getFin() and pDelay.fin
end

on getFrame me
  return pMemberList.getIndex()
end

on getFrameFresh me
  return pDelay.fin
end

on getLooped me
  return pMemberList.getLooped() and pDelay.fin
end

on getMember me
  if pDelay.fin then
    pCurrentMember = pMemberList.nextValue()
  end if
  counter(pDelay)
  return pCurrentMember
end

on reset me
  CounterReset(pDelay)
  pMemberList.reset()
  pCurrentMember = pMemberList.nextValue()
end

on setDelay me, newDelay
  pDelay.tim[2] = newDelay
end
