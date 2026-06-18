property ancestor, pReincarnatedMe, pReincarnateAs
global g

on new me
  ancestor = new(script("modModule"))
  return me
end

on addModParams me
  i = me.modifyParams(#init)
  i[#reincarnateAs] = [#none, #none, #none]
  ancestor.addModParams()
end

on init me, params
  ancestor.init(params)
  pReincarnateAs = params.reincarnateAs
  pReincarnatedMe = #none
end

on getReincarnatedMe me
  return pReincarnatedMe
end

on internalEvent me, theEvent
  ancestor.internalEvent(theEvent)
  case theEvent of
    #leftTeam:
      if me.big.getKilledInAction() then
        me.reincarnate()
      end if
  end case
end

on reincarnate me
  repeat with i in pReincarnateAs
    j = 1
    if i <> #none then
      params = g.actorMaster.getParams(#newActor)
      params.typ = i
      params.startLoc = me.big.getLoc()
      if j = 1 then
        params.useOffset = 0
      else
        params.useOffset = 1
      end if
      pReincarnatedMe = g.actorMaster.newActor(params)
      j = j + 1
      if pReincarnatedMe <> #none then
        me.big.internalEvent(#reincarnated)
      end if
    end if
  end repeat
end
