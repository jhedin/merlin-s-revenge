property ancestor, pBoundingRect, player, pStarsImage, pStarsRect, pUnitRect, pUnitToDisplay, pYGap
global g, gGlobalDisplayLayer

on new me
  ancestor = new(script("objModules"))
  i = me.modifyParams(#init)
  i[#layer] = gGlobalDisplayLayer
  me.addModule("modSpriteMembers")
  return me
end

on init me, params
  ancestor.init(params)
  pBoundingRect = #none
  player = params.layer
  pStarsImage = #none
  pUnitRect = #none
  pUnitToDisplay = #none
  pYGap = 4
end

on calcBoundingRect me, theUnit, theloc
  pUnitToDisplay = theUnit
  levelBar = g.armyMaster.getLevelBar()
  unitLevel = theUnit.pExperienceLevel
  pStarsImage = levelBar.drawStarsImage(unitLevel)
  pStarsRect = rect(0, 0, 0, 0)
  pStarsRect.right = pStarsImage.width
  pStarsRect.bottom = pStarsImage.height + levelBar.getYGap()
  pUnitRect = rect(0, 0, 0, 0)
  pUnitRect.top = pStarsRect.bottom
  pUnitRect.right = theUnit.width
  pUnitRect.bottom = pUnitRect.top + theUnit.height + pYGap
  pBoundingRect = rect(0, 0, 0, 0)
  pBoundingRect.right = max(pStarsRect.width, pUnitRect.width)
  pBoundingRect.bottom = pStarsRect.height + pUnitRect.height
  boundingRectOffset = pBoundingRect + rect(theloc, theloc)
  return boundingRectOffset
end

on displayUnit me, theloc
  theloc.locV = theloc.locV - pBoundingRect.height
  boundingRectOffset = pBoundingRect + rect(theloc, theloc)
  newSprMem = me.newSpriteMember()
  newSprMem.displayImageAtLoc(pStarsImage, point(boundingRectOffset.left, boundingRectOffset.top))
  newSprMem.centerAlign(boundingRectOffset.left, boundingRectOffset.right)
  unitImage = pUnitToDisplay.member.image
  newSprMem = me.newSpriteMember()
  newSprMem.displayImageAtLoc(unitImage, point(boundingRectOffset.left, boundingRectOffset.top + pUnitRect.top))
  newSprMem.setSpriteFlipFromDir(-1)
  newSprMem.setSpriteHeight(pUnitToDisplay.height)
  newSprMem.setSpriteWidth(pUnitToDisplay.width)
  newSprMem.centerAlign(boundingRectOffset.left, boundingRectOffset.right)
end

on getBoundingRect me
  return pBoundingRect
end

on getLayer me
  return player
end
