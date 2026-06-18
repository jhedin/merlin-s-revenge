property ancestor, pAutoUpdate, pAutoUpdatePrg, pAutoUpdatePrior, pCallingPrg, pCallingPrgMessage, pFin, pLastFin
global gGameSpeed, g

on new me
  ancestor = new(script("objModules"))
  i = me.modifyParams(#init)
  i[#autoUpdate] = 1
  i[#autoUpdatePrior] = #lo
  i[#callingPrg] = #none
  i[#callingPrgMessage] = #autoUpdateFinished
  return me
end

on init me, params
  ancestor.init(params)
  pAutoUpdate = params.autoUpdate
  pAutoUpdatePrg = g.updater
  pAutoUpdatePrior = params.autoUpdatePrior
  pCallingPrg = params.callingPrg
  pCallingPrgMessage = params.callingPrgMessage
  pLastFin = 0
  pFin = 0
end

on addSaveData me, sd
  sd[#pAutoUpdate] = pAutoUpdate
  sd[#pAutoUpdatePrior] = pAutoUpdatePrior
  sd[#pCallingPrgMessage] = pCallingPrgMessage
  sd[#pFin] = pFin
  sd[#pLastFin] = pLastFin
  ancestor.addSaveData(sd)
end

on cancel me
  me.id.bigMe.finish()
end

on calcFin me
  if me.id.bigMe.finishConditionMet() then
    pFin = 1
    me.eventNotify(pCallingPrgMessage)
    if pAutoUpdate then
      me.id.bigMe.finished()
    end if
    if pLastFin = 0 then
      me.id.bigMe.informCallingPrg()
    end if
  else
    pFin = 0
  end if
  pLastFin = pFin
end

on calcStart me
  if pAutoUpdate and not pFin then
    pAutoUpdatePrg.addPrg(me.id.bigMe, pAutoUpdatePrior)
  end if
end

on deactivate me
  pAutoUpdatePrg.removePrg(me.id.bigMe)
end

on activate me
  me.calcStart()
end

on finished me
  me.id.bigMe.finish()
end

on finish me
  me.deactivate()
  ancestor.finish()
end

on informCallingPrg me
  if pCallingPrg <> #none then
    call(pCallingPrgMessage, pCallingPrg)
  end if
end

on paws me
  pAutoUpdatePrg.removePrg(me.id.bigMe)
  ancestor.paws()
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
  pAutoUpdate = sd.pAutoUpdate
  pAutoUpdatePrg = g.updater
  pAutoUpdatePrior = sd.pAutoUpdatePrior
  pCallingPrgMessage = sd.pCallingPrgMessage
  pFin = sd.pFin
  pLastFin = sd.pLastFin
  me.calcStart()
end

on setAutoUpdate me, which
  pAutoUpdate = which
end

on start me
  me.calcStart()
  ancestor.start()
end

on update me
  ancestor.update()
  me.calcFin()
end

on unpaws me
  pAutoUpdatePrg.addPrg(me.id.bigMe, pAutoUpdatePrior)
  ancestor.unpaws()
end
