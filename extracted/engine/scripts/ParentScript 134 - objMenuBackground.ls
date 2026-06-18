property ancestor, pDefinition

on new me
  ancestor = new(script("objMenu"))
  i = me.modifyParams(#init)
  i[#definition] = #none
  return me
end

on init me, params
  ancestor.init(params)
  pDefinition = params.definition
end

on calcMenuHeight me
  return pDefinition.height
end

on calcMenuWidth me
  return pDefinition.width
end

on display me
  me.initTileMap()
  me.plotTileMapOutline()
  myImage = me.getImage()
  me.displayInSprite(myImage)
end
