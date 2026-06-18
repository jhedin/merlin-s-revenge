property ancestor, pCallingPrg, pTimeCounter, pSpr

on new me
  ancestor = new(script("objAutoUpdate"))
  i = me.modifyParams(#init)
  i[#callingPrg] = #none
  i[#spr] = #none
  i[#time] = 10
  return me
end

on init me, params
  pTimeCounter = CounterNew()
  pCallingPrg = params.callingPrg.id.bigMe
  pSpr = params.spr
  pTimeCounter.tim[2] = params.time
  CounterReset(pTimeCounter)
  me.ancestor.init(params)
  me.calcStart()
end

on addSaveData me, sd
  ancestor.addSaveData(sd)
  sd[#pTimeCounter] = pTimeCounter
end

on finish me
  pSpr = #none
  ancestor.finish()
end

on finishConditionMet me
  return pTimeCounter.fin
end

on informCallingPrg me
  pCallingPrg.flasherFinished()
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
  pTimeCounter = sd.pTimeCounter
end

on setCallingPrg me, newVal
  pCallingPrg = newVal
end

on setSprite me, newSpr
  pSpr = newSpr
end

on update me
  if pSpr.blend = 0 then
    pSpr.blend = 100
  else
    pSpr.blend = 0
  end if
  counter(pTimeCounter)
  me.ancestor.calcFin()
end
