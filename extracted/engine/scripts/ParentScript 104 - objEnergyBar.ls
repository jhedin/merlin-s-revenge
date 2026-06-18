property ancestor, pAlign, pBarBorder, pBarSpr, pCurrentEnergyPercent, pEnergy, player, pMaxBarWidth, pMaxEnergy, pOrientation, pSurroundRect, pSurroundSpr
global g

on new me
  me.ancestor = new(script("objParams"))
  i = me.modifyParams(#init)
  i[#align] = #left
  i[#barBorder] = 2
  i[#colour] = rgb(255, 255, 255)
  i[#currentEnergy] = #none
  i[#layer] = 1
  i[#maxEnergy] = #none
  i[#orientation] = #horizontal
  i[#surroundRect] = #none
  i[#surroundSpr] = #none
  return me
end

on init me, params
  ancestor.init(params)
  pAlign = params.align
  pEnergy = params.currentEnergy
  me.setMaxEnergy(params.maxEnergy)
  player = params.layer
  pOrientation = params.orientation
  pSurroundRect = params.surroundRect
  pSurroundSpr = params.surroundSpr
  if pSurroundRect = #none then
    if pSurroundSpr <> #none then
      pSurroundRect = pSurroundSpr.rect.duplicate()
    end if
  end if
  pBarBorder = params.barBorder
  me.initBarSpr()
  me.setColour(params.colour)
  me.id.bigMe.updateEnergy(pEnergy)
end

on initBarSpr me
  pBarSpr = g.spriteMaster.requestSprite()
  pBarSpr.locZ = player
  if pAlign = #right then
    pBarSpr.member = member("dot_right", "gfx")
  end if
  if pOrientation = #vertical then
    pBarSpr.member = member("dot_bottom", "gfx")
  end if
  if pSurroundRect <> #none then
    me.updateBarOnSurround()
  end if
end

on reset me, currentEnergy, maxEnergy, colour
  me.setMaxEnergy(maxEnergy)
  me.setColour(colour)
  me.updateEnergy(currentEnergy)
end

on resetToZero me
  me.updateEnergy(0)
end

on finish me
  if pBarSpr <> #none then
    g.spriteMaster.freeSprite(pBarSpr)
    pBarSpr = #none
  end if
  pSurroundSpr = #none
  me.ancestor.finish()
end

on getCurrentEnergyPercent me
  return pCurrentEnergyPercent
end

on setColour me, newColour
  pBarSpr.color = newColour
end

on setMaxEnergy me, newMaxEnergy
  pMaxEnergy = newMaxEnergy
end

on setSurroundRect me, newRect
  pSurroundRect = newRect
end

on setSurroundSpr me, newSprite
  pSurroundSpr = newSprite
  pSurroundRect = newSprite.rect
end

on updateBarOnSurround me
  borderChange = pBarBorder * -1
  barRect = pSurroundRect.inflate(borderChange, borderChange)
  pBarSpr.rect = barRect.duplicate()
  if pSurroundSpr <> #none then
    pBarSpr.locZ = pSurroundSpr.locZ + 1
  end if
  case pOrientation of
    #horizontal:
      pMaxBarWidth = barRect.width
    #vertical:
      pMaxBarWidth = barRect.height
  end case
end

on updateEnergy me, newEnergy
  pEnergy = newEnergy
  percentEnergy = varPercent(pEnergy, [0, pMaxEnergy])
  barWidth = VarValRange(percentEnergy, [0, pMaxBarWidth])
  case pOrientation of
    #horizontal:
      pBarSpr.width = barWidth
    #vertical:
      pBarSpr.height = barWidth
  end case
  pCurrentEnergyPercent = percentEnergy
end
