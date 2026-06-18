property pEnergyBar, pFakeAttack, pLevelBar, pExperienceBar, pSurroundHeight, pTeam
global g, gGameEnergyBarLayer

on new me
  return me
end

on init me
  pEnergyBar = #none
  pFakeAttack = g.structMaster.getStruct(#attack)
  pLevelBar = #none
  pSurroundHeight = 4
  pTeam = #healthRollover
  me.initEnergyBar()
  me.initFakeAttack()
  me.initLevelBar()
  me.initExperienceBar()
end

on initEnergyBar me
  pEnergyBar = g.objectMaster.requestObject(#objMoveableEnergyBar)
  params = pEnergyBar.getParams()
  params.layer = gGameEnergyBarLayer
  params.surroundHeight = 4
  pEnergyBar.init(params)
end

on initFakeAttack me
  a = pFakeAttack
  a.targetAllegiance = #enemy
  a.targetCriteria = #closestDistance
  a.targetRoles = [[#teamMembers, #teamBuildings]]
end

on initLevelBar me
  pLevelBar = g.objectMaster.requestObject(#objMoveableLevelBar)
  params = pLevelBar.getParams()
  params.layer = gGameEnergyBarLayer
  pLevelBar.init(params)
end

on initExperienceBar me
  pExperienceBar = g.objectMaster.requestObject(#objMoveableExperienceBar)
  params = pExperienceBar.getParams()
  params.layer = gGameEnergyBarLayer
  params.surroundHeight = 4
  pExperienceBar.init(params)
end

on finish me
  if ilk(pEnergyBar) <> #void then
    pEnergyBar.finish()
  end if
  if ilk(pLevelBar) <> #void then
    pLevelBar.finish()
  end if
  if ilk(pExperienceBar) <> #void then
    pExperienceBar.finish()
  end if
  g.updater.removePrg(me)
end

on checkMouseOverObj me, theObj
  mLoc = g.mouseMaster.getMouseLoc()
  objRect = theObj.getSpriteRect()
  if mLoc.inside(objRect) then
    return 1
  end if
  return 0
end

on getAttack me
  return pFakeAttack
end

on getActorType me
  return #characterEnergyRollOverMaster
end

on getLoc me
  return g.mouseMaster.getMouseLoc()
end

on getTeam me
  return pTeam
end

on leaveNavMode me
  pEnergyBar.clearTarget()
  pExperienceBar.clearTarget()
end

on restoreFromSave me
  pEnergyBar.clearTarget()
end

on start me
  g.updater.addPrg(me, #hi)
end

on stop me
  me.finish()
end

on update me
  closestChar = g.teamMaster.findTarget(me)
  obj = closestChar.obj
  if obj = #none then
    pEnergyBar.clearTarget()
    pExperienceBar.clearTarget()
    pLevelBar.clearTarget()
  else
    if me.checkMouseOverObj(obj) then
      pEnergyBar.setTarget(obj)
      pExperienceBar.setTarget(obj)
      pLevelBar.setTarget(obj)
    end if
  end if
  pEnergyBar.update()
  pLevelBar.update()
  pExperienceBar.update()
end
