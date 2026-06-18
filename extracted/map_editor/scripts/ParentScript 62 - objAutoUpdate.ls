property ancestor, pAutoUpdate, pAutoUpdatePrg, pAutoUpdatePrior, pFin
global gGameSpeed, g

on new me
  me.ancestor = new(script("objParams"))
  i = me.modifyParams(#init)
  i[#autoUpdate] = 1
  i[#autoUpdatePrg] = g.updater
  i[#autoUpdatePrior] = #lo
  return me
end

on init me, params
  pAutoUpdate = params.autoUpdate
  pAutoUpdatePrg = params.autoUpdatePrg
  pAutoUpdatePrior = params.autoUpdatePrior
  pFin = 0
end

on cancel me
  me.finish()
end

on calcFin me
  if me.id.bigMe.finishConditionMet() then
    pFin = 1
    if pAutoUpdate then
      me.id.bigMe.finish()
    end if
  else
    pFin = 0
  end if
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

on finish me
  me.deactivate()
  me.id.bigMe.informCallingPrg()
  ancestor.finish()
end

on setAutoUpdate me, which
  pAutoUpdate = which
end
