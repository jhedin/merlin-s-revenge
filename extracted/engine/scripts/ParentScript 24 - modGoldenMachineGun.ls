property ancestor, pGmgOn, pGmgCollected
global g

on new me
  ancestor = new(script("modModule"))
  return me
end

on addModParams me
  i = me.modifyParams(#init)
  ancestor.addModParams()
end

on init me, params
  ancestor.init(params)
  pGmgCollected = 0
  pGmgOn = 0
end

on gmgCollected me
  pGmgCollected = 1
  me.setGmg()
end

on getGmgOn me
  return pGmgOn
end

on setGmg me
  if pGmgCollected then
    if pGmgOn = 0 then
      pGmgOn = 1
    else
      pGmgOn = 0
    end if
    if pGmgOn = 1 then
      me.big.gmgOn()
      me.big.internalEvent(#gmgTurnedOn)
    else
      me.big.gmgOff()
      me.big.internalEvent(#gmgTurnedOff)
    end if
    g.gmgMaster.updateDisplay(pGmgOn)
  end if
end
