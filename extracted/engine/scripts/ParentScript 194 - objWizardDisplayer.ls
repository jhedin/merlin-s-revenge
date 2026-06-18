property ancestor, pDisplayLoc, pEnergyBar, pEnergyBarRect, pEnergyBarWidth, pLastActive, pLastEnergy, pOffMember, pOnMember, pSpacer, pWizardOn, pOutline
global g, gGlobalDisplayLayer, gGridSelectorLayer

on new me
  ancestor = new(script("objSpriteMember"))
  i = me.modifyParams(#init)
  i.layer = gGlobalDisplayLayer
  i[#displayLoc] = point(0, 0)
  return me
end

on init me, params
  ancestor.init(params)
  pDisplayLoc = params.displayLoc
  pEnergyBarWidth = 6
  pLastActive = #none
  pSpacer = 1
  pOutline = g.objectMaster.requestObject(#objBox)
  boxParams = pOutline.getParams(#init)
  boxParams.color = rgb(255, 255, 0)
  boxParams.layer = gGridSelectorLayer
  boxParams.member = member("wizard_on", "gfx")
  pOutline.init(boxParams)
  pOutline.offscreen()
end

on initEnergyBar me
  energyBarRect = me.calcEnergyBarRect()
  pEnergyBar = g.objectMaster.requestObject(#objEnergyBar)
  params = pEnergyBar.getParams()
  params.barBorder = 1
  params.surroundRect = energyBarRect
  params.colour = rgb(0, 200, 0)
  params.currentEnergy = 0
  params.layer = gGlobalDisplayLayer
  params.maxEnergy = 100
  params.orientation = #vertical
  pEnergyBar.init(params)
  pEnergyBarRect = energyBarRect
end

on finish me
  ancestor.finish()
  if (pEnergyBar <> #none) and (pEnergyBar <> VOID) then
    pEnergyBar.finish()
    pEnergyBar = #none
  end if
  if (pOutline <> #none) and (pOutline <> VOID) then
    pOutline.finish()
    pOutline = #none
  end if
end

on calcEnergyBarRect me
  ebRect = rect(0, 0, 0, 0)
  ebRect.left = pDisplayLoc.locH + pOnMember.width + pSpacer
  ebRect.right = ebRect.left + pEnergyBarWidth
  ebRect.top = pDisplayLoc.locV
  ebRect.bottom = ebRect.top + pOnMember.height
  return ebRect
end

on setWizardOn me
  pWizardOn = 1
  pOutline.setRect(rect(pDisplayLoc.locH, pDisplayLoc.locV, pDisplayLoc.locH + 16, pDisplayLoc.locV + 16))
end

on setWizardOff me
  pWizardOn = 1
  pOutline.offscreen()
end

on updateDisplayFromObj me, theImage
  me.displayImageAtLoc(theImage.image, pDisplayLoc)
end

on updateActive me, Active
  if Active then
    currentMember = pOnMember
  else
    currentMember = pOffMember
  end if
  me.displayImageAtLoc(currentMember.image, pDisplayLoc)
end

on updateEnergy me, energy, theObj
  maxEnergy = theObj.getMedikitMaxHitpoints()
  pEnergyBar.setMaxEnergy(maxEnergy)
  pEnergyBar.updateEnergy(energy)
end
