property ancestor, pColour, player
global gMenuTextLayer

on new me
  ancestor = new(script("objSpriteMember"))
  i = me.modifyParams(#init)
  i[#colour] = rgb(255, 255, 255)
  i[#layer] = gMenuTextLayer
  me.addModule("modFader")
  return me
end

on init me, params
  ancestor.init(params)
  pColour = params.colour
  player = params.layer
end

on displayImageAtLoc me, theImage, theloc
  ancestor.displayImageAtLoc(theImage, theloc)
  me.setSpriteLayer(player)
  me.setSpriteColour(pColour)
end

on startFadeIn me
  me.setSpriteBlend(0)
  me.startQuickFadeIn()
end
