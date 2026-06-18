property ancestor, pFlasher, pFlasherTime
global g

on new me
  ancestor = new(script("modModule"))
  return me
end

on init me, params
  pFlasher = #none
  pFlasherTime = params.flasherTime
  ancestor.init(params)
end

on addModParams me
  i = me.modifyParams(#init)
  i[#flasherTime] = 30
  ancestor.addModParams()
end

on finish me
  me.finishFlasher()
  ancestor.finish()
end

on acquireFlasher me
  if pFlasher = #none then
    pFlasher = g.objectMaster.requestObject(#objFlasher)
  end if
end

on addSaveData me, sd
  ancestor.addSaveData(sd)
  if pFlasher = #none then
    sd[#pFlasher] = #none
  else
    saveData = [:]
    pFlasher.addSaveData(saveData)
    sd[#pFlasher] = saveData
  end if
end

on finishFlasher me
  if pFlasher <> #none then
    pFlasher.finish()
    pFlasher = #none
  end if
end

on flasherFinished me
  pFlasher = #none
end

on paws me
  ancestor.paws()
  if pFlasher <> #none then
    pFlasher.paws()
  end if
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
  me.finishFlasher()
  if sd.pFlasher <> #none then
    me.acquireFlasher()
    pFlasher.setCallingPrg(me.big)
    pFlasher.setSprite(me.big.getSprite())
    pFlasher.restoreFromSave(sd.pFlasher)
  end if
end

on startFlasher me
  me.acquireFlasher()
  params = pFlasher.getParams(#init)
  params.callingPrg = me.id.bigMe
  params.spr = me.getSprite()
  params.time = pFlasherTime
  pFlasher.init(params)
  pFlasher.calcStart()
end

on unpaws me
  ancestor.unpaws()
  if pFlasher <> #none then
    pFlasher.unpaws()
  end if
end
