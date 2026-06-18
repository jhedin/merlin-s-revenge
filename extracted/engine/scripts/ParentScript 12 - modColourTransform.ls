property ancestor, pCurrentTransform, pLastFinishingColour, pNextTransform, pTransColor
global g

on new me
  ancestor = new(script("modModule"))
  return me
end

on addModParams me
  i = me.modifyParams(#init)
  c = me.modifyParams(#colourTransform)
  c[#startColor] = #current
  c[#targetColor] = rgb(255, 255, 0)
  c[#speed] = 10
  ancestor.addModParams()
end

on init me, params
  ancestor.init(params)
  pCurrentTransform = #none
  pNextTransform = #none
  pTransColor = #none
end

on addSaveData me, sd
  ancestor.addSaveData(sd)
  if pTransColor = #none then
    sd[#pTransColor] = #none
  else
    saveData = [:]
    pTransColor.addSaveData(saveData)
    sd[#pTransColor] = saveData
  end if
  sd[#pCurrentTransform] = pCurrentTransform
  sd[#pNextTransform] = pNextTransform
end

on finish me
  me.cancelTransColor()
  ancestor.finish()
end

on cancelTransColor me
  if pTransColor <> #none then
    pTransColor.cancel()
    pTransColor = #none
    if me.id.bigMe.getSprite() <> #none then
      pLastFinishingColour = me.big.getSpriteColor()
      me.id.bigMe.setSpriteColour(rgb(0, 0, 0))
    end if
    pCurrentTransform = #none
  end if
end

on colourTransform me, inParams
  params = me.newTransColor()
  params.startColor = inParams.startColor
  params.targetColor = inParams.targetColor
  params.speed = inParams.speed
  pTransColor.init(params)
end

on fadeBlack me
  params = me.newTransColor()
  params.startColor = pLastFinishingColour
  params.targetColor = rgb(0, 0, 0)
  params.speed = 10
  pTransColor.init(params)
  pCurrentTransform = #fadeBlack
end

on fadeGoldBlack me
  params = me.newTransColor()
  params.startColor = rgb(255, 201, 57)
  params.targetColor = rgb(0, 0, 0)
  params.speed = 10
  pTransColor.init(params)
  pCurrentTransform = #fadeGoldBlack
end

on flashWhite me
  params = me.newTransColor()
  params.startColor = rgb(255, 255, 255)
  params.targetColor = rgb(0, 0, 0)
  pTransColor.init(params)
  pCurrentTransform = #flashWhite
end

on flickWhite me
  params = me.newTransColor()
  params.startColor = rgb(255, 255, 255)
  params.targetColor = rgb(0, 0, 0)
  params.speed = 33
  pTransColor.init(params)
  pCurrentTransform = #flickWhite
end

on glowPink me
  params = me.newTransColor()
  params.targetColor = rgb(255, 200, 200)
  params.speed = 10
  pTransColor.init(params)
  pCurrentTransform = #glowPink
  pNextTransform = #fadeBlack
end

on glowGold me
  params = me.newTransColor()
  params.targetColor = rgb(255, 201, 57)
  params.speed = 10
  pTransColor.init(params)
  pCurrentTransform = #glowGold
  pNextTransform = #fadeGoldBlack
end

on glowRed me
  if (pCurrentTransform = #glowTeal) or (pCurrentTransform = #glowRedAndTeal) then
    me.glowRedAndTeal()
  else
    params = me.newTransColor()
    params.targetColor = rgb(255, 0, 0)
    params.speed = 10
    params.pingpong = 1
    pTransColor.init(params)
    pCurrentTransform = #glowRed
  end if
end

on glowTeal me
  if (pCurrentTransform = #glowRed) or (pCurrentTransform = #glowRedAndTeal) then
    me.glowRedAndTeal()
  else
    params = me.newTransColor()
    params.targetColor = rgb(0, 255, 255)
    params.speed = 100
    params.pingpong = 0
    pTransColor.init(params)
    pCurrentTransform = #glowTeal
  end if
end

on glowRedAndTeal me
  params = me.newTransColor()
  params.startColor = rgb(0, 255, 255)
  params.targetColor = rgb(255, 0, 0)
  params.speed = 10
  params.pingpong = 1
  pTransColor.init(params)
  pCurrentTransform = #glowRedAndTeal
end

on newTransColor me
  me.cancelTransColor()
  pNextTransform = #none
  pTransColor = g.objectMaster.requestObject(#objTransColor)
  params = pTransColor.getParams(#init)
  params.callingPrg = me
  params.spr = me.id.bigMe.getSprite()
  params.transformTarget = me.id.bigMe.getMemberType()
  return params
end

on paws me
  ancestor.paws()
  if pTransColor <> #none then
    pTransColor.paws()
  end if
end

on pulseWhite me
  params = me.newTransColor()
  params.pingpong = 1
  params.targetColor = rgb(0, 0, 0)
  params.startColor = rgb(255, 255, 255)
  pTransColor.init(params)
  pCurrentTransform = #pulseWhite
end

on pulseWhiteStop me
  me.stopPulseWhite()
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
  me.cancelTransColor()
  if sd.pTransColor <> #none then
    pTransColor = g.objectMaster.requestObject(#objTransColor)
    params = pTransColor.getParams()
    params.callingPrg = me.big
    params.spr = me.big.getSprite()
    params.transformTarget = #bitmap
    pTransColor.init(params)
    pTransColor.restoreFromSave(sd.pTransColor)
  end if
  pCurrentTransform = sd.pCurrentTransform
  pNextTransform = sd.pNextTransform
end

on stopGlowRed me
  if pCurrentTransform = #glowRed then
    me.cancelTransColor()
  else
    if pCurrentTransform = #glowRedAndTeal then
      me.cancelTransColor()
      me.glowTeal()
    end if
  end if
end

on stopGlowTeal me
  if pCurrentTransform = #glowTeal then
    me.cancelTransColor()
  else
    if pCurrentTransform = #glowRedAndTeal then
      me.cancelTransColor()
      me.glowRed()
    end if
  end if
end

on stopPulseWhite me
  if pCurrentTransform = #pulseWhite then
    me.cancelTransColor()
    me.setSpriteColour(rgb(0, 0, 0))
  end if
end

on transColorFin me
  if pNextTransform = #none then
    pCurrentTransform = #none
    pTransColor = #none
    me.id.bigMe.colourTransformFin()
    me.internalEvent(#colourTransformFin)
    me.eventNotify(#colourTransformFin)
  else
    nextTransform = pNextTransform
    pNextTransform = #none
    call(nextTransform, me)
  end if
end

on unpaws me
  ancestor.unpaws()
  if pTransColor <> #none then
    pTransColor.unpaws()
  end if
end
