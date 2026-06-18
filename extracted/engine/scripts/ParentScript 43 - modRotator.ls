property ancestor, pRotator, pRotationSpeed
global g

on new me
  ancestor = new(script("modModule"))
  return me
end

on init me, params
  pRotator = #none
  pRotationSpeed = params.rotationSpeed
  ancestor.init(params)
end

on addModParams me
  i = me.modifyParams(#init)
  i[#rotationSpeed] = 20
  ancestor.addModParams()
end

on finish me
  me.finishRotator()
  ancestor.finish()
end

on acquireRotator me
  if pRotator = #none then
    pRotator = g.objectMaster.requestObject(#objTransRotate)
  end if
end

on finishRotator me
  if pRotator <> #none then
    pRotator.finish()
    pRotator = #none
  end if
end

on cancelRotator me
  if pRotator <> #none then
    pRotator.cancel()
    pRotator = #none
  end if
end

on paws me
  if pRotator <> #none then
    pRotator.paws()
  end if
  ancestor.paws()
end

on startRotator me
  me.acquireRotator()
  params = pRotator.getParams(#init)
  params.callingPrg = me.id.bigMe
  params.speed = pRotationSpeed
  params.spr = me.getSprite()
  pRotator.init(params)
  pRotator.calcStart()
end

on transformFin me
end

on unpaws me
  if pRotator <> #none then
    pRotator.unpaws()
  end if
  ancestor.paws()
end
