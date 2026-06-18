property ancestor, pAlign, pBarBorder, pBarSpr, pCurrentExperiencePercent, pExperience, player, pMaxBarWidth, pMaxExperience, pOrientation, pSurroundRect, pSurroundSpr, pColour
global g

on new me
  me.ancestor = new(script("objParams"))
  i = me.modifyParams(#init)
  i[#align] = #left
  i[#barBorder] = 2
  i[#colour] = rgb(244, 216, 11)
  i[#currentExperience] = #none
  i[#layer] = 1
  i[#maxExperience] = #none
  i[#orientation] = #horizontal
  i[#surroundRect] = #none
  i[#surroundSpr] = #none
  return me
end

on init me, params
  ancestor.init(params)
  pAlign = params.align
  pExperience = params.currentExperience
  me.setMaxExperience(params.maxExperience)
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
  pColour = rgb(244, 216, 11)
  me.setColour(pColour)
  me.id.bigMe.updateExperience(pExperience)
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

on reset me, levelData, colour
  me.setMaxExperience(levelData.expToNxtLvl)
  me.updateExperience(levelData.expPnts)
end

on resetToZero me
  me.updateExperience(0)
end

on finish me
  if pBarSpr <> #none then
    g.spriteMaster.freeSprite(pBarSpr)
    pBarSpr = #none
  end if
  pSurroundSpr = #none
  me.ancestor.finish()
end

on getCurrentExperiencePercent me
  return pCurrentExperiencePercent
end

on setColour me, newColour
  pBarSpr.color = newColour
end

on setMaxExperience me, newMaxExperience
  pMaxExperience = newMaxExperience
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

on updateExperience me, newExperience
  pExperience = newExperience
  percentExperience = varPercent(pExperience, [0, pMaxExperience])
  barWidth = VarValRange(percentExperience, [0, pMaxBarWidth])
  case pOrientation of
    #horizontal:
      pBarSpr.width = barWidth
    #vertical:
      pBarSpr.height = barWidth
  end case
  pCurrentExperiencePercent = percentExperience
end

on updateExp me, levelData
  pExperience = levelData.expPnts
  barWidth = VarValRange(levelData.percentToNxt * 100, [0, pMaxBarWidth])
  case pOrientation of
    #horizontal:
      pBarSpr.width = barWidth
    #vertical:
      pBarSpr.height = barWidth
  end case
  pCurrentExperiencePercent = levelData.percentToNxt
end
