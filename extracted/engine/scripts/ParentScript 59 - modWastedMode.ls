property ancestor, pWastedModeBlend, pWastedModeBlendOff, pWastedModeHeight, pWastedModeIsOn

on new me
  ancestor = new(script("modModule"))
  return me
end

on addModParams me
  i = me.modifyParams(#init)
  ancestor.addModParams()
end

on init me, params
  ancestor.init(params)
  pWastedModeBlend = 30
  pWastedModeBlendOff = 100
  pWastedModeHeight = 60
  pWastedModeIsOn = 0
end

on finish me
  ancestor.finish()
end

on wastedModeOn me
  bigMe = me.id.bigMe
  bigMe.setBlend(pWastedModeBlend)
  bigMe.setAnimKeepSize(1)
  bigMe.setSpriteHeight(pWastedModeHeight)
  pWastedModeIsOn = 1
end

on wastedModeOff me
  bigMe = me.id.bigMe
  bigMe.setBlend(pWastedModeBlendOff)
  bigMe.setAnimKeepSize(0)
  pWastedModeIsOn = 0
end
