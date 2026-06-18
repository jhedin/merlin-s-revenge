property ancestor, pAlign, pBarBorder, pBarSpr, pEnergy, pMaxBarWidth, pMaxEnergy, pParams, pSurroundRect
global g

on new me
  me.ancestor = new(script("objBasic"))
  pParams = [:]
  pParams[#init] = [#currentEnergy: #none, #maxEnergy: #none, #surroundRect: #none, #barBorder: 2, #colour: rgb(255, 255, 255), #align: #left]
  return me
end

on init me, params
  pAlign = params.align
  pEnergy = params.currentEnergy
  me.setMaxEnergy(params.maxEnergy)
  pSurroundRect = params.surroundRect
  pBarBorder = params.barBorder
  me.initBarSpr()
  me.setColour(params.colour)
end

on initBarSpr me
  pBarSpr = g.spriteMaster.requestSprite()
  if pAlign = #right then
    pBarSpr.member = member("dot_right", "gfx")
  end if
  borderChange = pBarBorder * -1
  barRect = pSurroundRect.inflate(borderChange, borderChange)
  pBarSpr.rect = barRect.duplicate()
  pMaxBarWidth = barRect.width
end

on reset me, currentEnergy, maxEnergy, colour
  me.setMaxEnergy(maxEnergy)
  me.setColour(colour)
  me.updateEnergy(currentEnergy)
end

on finish me
  g.spriteMaster.freeSprite(pBarSpr)
  me.ancestor.finish()
end

on getParams me, function
  return pParams[function]
end

on setColour me, newColour
  pBarSpr.color = newColour
end

on setMaxEnergy me, newMaxEnergy
  pMaxEnergy = newMaxEnergy
end

on updateEnergy me, newEnergy
  pEnergy = newEnergy
  percentEnergy = varPercent(pEnergy, [0, pMaxEnergy])
  barWidth = VarValRange(percentEnergy, [0, pMaxBarWidth])
  pBarSpr.width = barWidth
end
