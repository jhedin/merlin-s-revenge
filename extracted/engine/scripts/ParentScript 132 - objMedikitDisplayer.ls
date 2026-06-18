property ancestor, pDisplayCounter, pDisplayLoc, pEnergyBar, pEnergyBarRect, pEnergyBarWidth, pLastActive, pLastEnergy, pOffMember, pOnMember, pSpacer, pVerticalSpacerForDisplayCounter
global g, gGlobalDisplayLayer

on new me
  ancestor = new(script("objSpriteMember"))
  i = me.modifyParams(#init)
  i.layer = gGlobalDisplayLayer
  i[#displayLoc] = point(0, 0)
  i[#onMember] = #none
  i[#offMember] = #none
  return me
end

on init me, params
  ancestor.init(params)
  pDisplayLoc = params.displayLoc
  pEnergyBarWidth = 6
  pLastActive = #none
  pOffMember = params.offMember
  pOnMember = params.onMember
  pSpacer = 1
  pVerticalSpacerForDisplayCounter = 3
  me.initEnergyBar()
  me.initDisplayCounter()
end

on initDisplayCounter me
  displayLoc = me.calcDisplayCounterLoc()
  pDisplayCounter = g.objectMaster.requestObject(#objDisplayCounter)
  params = pDisplayCounter.getParams(#init)
  params.displayLoc = displayLoc
  pDisplayCounter.init(params)
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
  if pDisplayCounter <> #none then
    pDisplayCounter.finish()
    pDisplayCounter = #none
  end if
  if pEnergyBar <> #none then
    pEnergyBar.finish()
    pEnergyBar = #none
  end if
end

on calcDisplayCounterLoc me
  dcLoc = point(0, 0)
  dcLoc.locV = pDisplayLoc.locV + pVerticalSpacerForDisplayCounter
  dcLoc.locH = pEnergyBarRect.right + pSpacer
  return dcLoc
end

on calcEnergyBarRect me
  ebRect = rect(0, 0, 0, 0)
  ebRect.left = pDisplayLoc.locH + pOnMember.width + pSpacer
  ebRect.right = ebRect.left + pEnergyBarWidth
  ebRect.top = pDisplayLoc.locV
  ebRect.bottom = ebRect.top + pOnMember.height
  return ebRect
end

on updateDisplayFromObj me, theObj
  Active = theObj.getMedikitActive()
  energy = theObj.getMedikitRemainingHitpoints()
  numOfMedikits = theObj.getNumOfMedikits()
  if Active <> pLastActive then
    me.updateActive(Active)
    pLastActive = Active
  end if
  if energy <> pLastEnergy then
    me.updateEnergy(energy, theObj)
    pLastEnergy = energy
  end if
  me.updateDisplayCounter(numOfMedikits)
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

on updateDisplayCounter me, numOfMedikits
  pDisplayCounter.updateValue(numOfMedikits)
end
