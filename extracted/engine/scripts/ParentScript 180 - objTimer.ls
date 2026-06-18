property ancestor, pTimeCounter

on new me
  ancestor = new(script("objAutoUpdate"))
  i = me.modifyParams(#init)
  i.callingPrgMessage = #timerFinished
  i[#framesTime] = 30
  return me
end

on init me, params
  ancestor.init(params)
  pTimeCounter = CounterNew()
  pTimeCounter.tim[2] = params.framesTime
  CounterReset(pTimeCounter)
  me.calcStart()
end

on finish me
  ancestor.finish()
  pTimeCounter = #none
end

on finishConditionMet me
  return pTimeCounter.fin
end

on update me
  CounterOnce(pTimeCounter)
  ancestor.update()
end
