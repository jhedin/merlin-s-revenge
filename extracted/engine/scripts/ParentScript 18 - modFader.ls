property ancestor, pTransBlend
global g

on new me
  ancestor = new(script("modModule"))
  return me
end

on init me, params
  ancestor.init(params)
  pTransBlend = #none
end

on addModParams me
  i = me.modifyParams(#init)
  ancestor.addModParams()
end

on finish me
  me.cancelTransblend()
  ancestor.finish()
end

on addSaveData me, sd
  if pTransBlend <> #none then
    saveData = [:]
    pTransBlend.addSaveData(saveData)
    sd[#pTransBlend] = saveData
  else
    sd[#pTransBlend] = #none
  end if
  ancestor.addSaveData(sd)
end

on cancelTransblend me
  if pTransBlend <> #none then
    pTransBlend.finish()
    pTransBlend = #none
  end if
end

on invisible me
  me.cancelTransblend()
  me.id.bigMe.setBlend(0)
end

on paws me
  ancestor.paws()
  if pTransBlend <> #none then
    pTransBlend.paws()
  end if
end

on restoreFromSave me, sd
  me.cancelTransblend()
  if sd.pTransBlend <> #none then
    pTransBlend = g.objectMaster.requestObject(#objTransBlend)
    pTransBlend.setCallingPrg(me.big)
    pTransBlend.setSprite(me.big.getSprite())
    pTransBlend.restoreFromSave(sd.pTransBlend)
  end if
  ancestor.restoreFromSave(sd)
end

on setBlend me, val
  spr = me.id.bigMe.getSprite()
  spr.blend = val
end

on startFade me
  me.startTransBlend(2, #out)
end

on startSlowFadeIn me
  me.startTransBlend(2, #in)
end

on startSlowFadeOut me
  me.startTransBlend(2, #out)
end

on startMediumFadeIn me
  me.startTransBlend(4, #in)
end

on startMediumFadeOut me
  me.startTransBlend(4, #out)
end

on startQuickFade me
  me.startTransBlend(10, #out)
end

on startQuickFadeIn me
  me.startTransBlend(10, #in)
end

on startTransBlend me, speed, Dir
  me.cancelTransblend()
  case Dir of
    #in:
      targetValue = 100
    #out:
      targetValue = 0
  end case
  pTransBlend = g.objectMaster.requestObject(#objTransBlend)
  params = pTransBlend.getParams(#init)
  params.callingPrg = me.id.bigMe
  params.targetValue = targetValue
  params.speed = speed
  params.spr = me.getSprite()
  pTransBlend.init(params)
  pTransBlend.calcStart()
end

on transBlendFin me
  me.id.bigMe.faderFin()
  me.big.internalEvent(#transBlendFin)
  pTransBlend = #none
end

on unpaws me
  ancestor.unpaws()
  if pTransBlend <> #none then
    pTransBlend.unpaws()
  end if
end
