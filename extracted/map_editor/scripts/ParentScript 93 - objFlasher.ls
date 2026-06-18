property ancestor, pCallingPrg, pTimeCounter, pSpr

on new me
  ancestor = new(script("objAutoUpdate"))
  return me
end

on init me, callingPrg, spr, tim
  pTimeCounter = CounterNew()
  pCallingPrg = callingPrg
  pSpr = spr
  pTimeCounter.tim[2] = tim
  CounterReset(pTimeCounter)
  me.ancestor.init()
  me.calcStart()
end

on finishConditionMet me
  return pTimeCounter.fin
end

on informCallingPrg me
  pCallingPrg.flasherFinished()
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
