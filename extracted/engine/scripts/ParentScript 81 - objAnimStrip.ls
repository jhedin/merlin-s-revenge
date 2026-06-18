property ancestor, pCurrentMember, pDelay, pDelayList, pName, pMemberList
global g, gGameSpeed

on new me
  me.ancestor = new(script("objBasic"))
  return me
end

on init me, stripDef, name
  delayValues = ListExtractByProp(stripDef, #dela)
  memberValues = ListExtractByProp(stripDef, #mem)
  pName = name
  pDelayList = g.objectMaster.requestObject(#objlist)
  pDelayList.init(delayValues)
  pMemberList = g.objectMaster.requestObject(#objlist)
  pMemberList.init(memberValues)
  pDelay = CounterNew()
  pDelay.inc = 1 * gGameSpeed
  me.moveNextFrame()
end

on finish me
  pMemberList.finish()
  pDelayList.finish()
  ancestor.finish()
end

on addSaveData me, sd
  ancestor.addSaveData(sd)
  sd[#pDelay] = pDelay
  sd[#pDelayList_index] = pDelayList.getIndex()
  sd[#pMemberList_index] = pMemberList.getIndex()
end

on extendDelay me, delayAmount
  pDelay.tim[2] = pDelay.tim[2] + delayAmount
  CounterReset(pDelay)
end

on getCurrentMember me
  return pCurrentMember
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

on getImage me
  return pCurrentMember.image
end

on getLooped me
  return pMemberList.getLooped() and pDelay.fin
end

on getMember me
  if pDelay.fin then
    me.moveNextFrame()
  end if
  counter(pDelay)
  return pCurrentMember
end

on getMemberAt me, frameNum
  return pMemberList.getValueAt(frameNum)
end

on getNoOfFrames me
  return pDelayList.getSumOfValues()
end

on gotoAnimFrame me, theFrameNum
  pMemberList.gotoValuePos(theFrameNum)
  pDelayList.gotoValuePos(theFrameNum)
  me.moveNextFrame()
  CounterReset(pDelay)
end

on moveNextFrame me
  pCurrentMember = pMemberList.nextValue()
  pDelay.tim[2] = pDelayList.nextValue()
end

on reset me
  pDelayList.reset()
  pMemberList.reset()
  me.moveNextFrame()
  CounterReset(pDelay)
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
  pDelayList.setIndex(sd.pDelayList_index)
  pMemberList.setIndex(sd.pMemberList_index)
  pDelay = pDelayList.nextValue()
  pDelay = sd.pDelay
  pCurrentMember = pMemberList.nextValue()
end

on setDelay me, newDelay
  pDelay.tim[2] = newDelay
end
