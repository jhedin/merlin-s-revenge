property ancestor, pcolor, pLocLength, pLocX, pLocY, pThickness
global gGridSelectorLayer

on new me
  ancestor = new(script("objSpriteMember"))
  i = me.modifyParams(#init)
  i[#color] = rgb(255, 255, 0)
  i[#locLength] = [10, 20]
  i[#locx] = #none
  i[#locy] = #none
  i[#thickness] = 2
  return me
end

on init me, params
  ancestor.init(params)
  pcolor = params.color
  pLocLength = params.locLength
  pLocX = params.locx
  pLocY = params.locy
  pThickness = params.thickness
end

on calcDisplayRect me
  displayRect = rect(0, 0, 0, 0)
  locThickness = me.calcLocThickness()
  if pLocY <> #none then
    displayRect.left = pLocLength[1]
    displayRect.right = pLocLength[2]
    displayRect.top = locThickness[1]
    displayRect.bottom = locThickness[2]
  else
    displayRect.left = locThickness[1]
    displayRect.right = locThickness[2]
    displayRect.top = pLocLength[1]
    displayRect.bottom = pLocLength[2]
  end if
  return displayRect
end

on calcLocThickness me
  locThickness = [0, 0]
  halfThickness = pThickness / 2
  midLoc = me.calcMidLoc()
  locThickness[1] = midLoc - halfThickness
  locThickness[2] = midLoc + halfThickness
  return locThickness
end

on calcMidLoc me
  if pLocX <> #none then
    midLoc = pLocX
  else
    midLoc = pLocY
  end if
  return midLoc
end

on display me
  me.requestSprite()
  me.setSpriteColor(pcolor)
  me.setSpriteLayer(gGridSelectorLayer)
  me.setSpriteRect(me.calcDisplayRect())
end
