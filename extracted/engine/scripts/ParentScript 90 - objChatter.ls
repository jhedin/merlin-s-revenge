property ancestor, pPerformed, pScriptToPerform, pTalkingMember, pTalkOnlyOnNavMode, pWaitingMember
global g

on new me
  ancestor = new(script("objPowerUp"))
  i = me.modifyParams(#init)
  i.flags.append(#player)
  i[#scriptToPerform] = #none
  i[#talkingMember] = #none
  i[#talkOnlyOnNavMode] = 1
  me.addModule("modProp")
  me.addModule("modThespian")
  return me
end

on init me, params
  ancestor.init(params)
  pScriptToPerform = params.scriptToPerform
  pTalkingMember = params.talkingMember
  pTalkOnlyOnNavMode = params.talkOnlyOnNavMode
  pWaitingMember = params.member
  pPerformed = 0
end

on checkDead me
  return 0
end

on collected me
  if pPerformed = 0 then
    me.goMode(#talking)
    if pScriptToPerform <> #none then
      g.cutSceneMaster.playCutScene(pScriptToPerform)
    end if
    pPerformed = 1
  else
    if me.pmode = #talking then
      me.goMode(#finishedTalking)
    end if
  end if
end

on getEnergy me
  return 10
end

on getMaxEnergy me
  return 10
end

on getTalkOnlyOnNavMode me
  return pTalkOnlyOnNavMode
end

on goMode me, newMode
  case newMode of
    #talking:
      if pTalkingMember <> #none then
        me.setMember(pTalkingMember)
      end if
    #finishedTalking:
      me.setMember(pWaitingMember)
  end case
  ancestor.goMode(newMode)
end
