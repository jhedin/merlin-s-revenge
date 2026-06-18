property ancestor, pEnergyBar, pSurroundHeight, pTarget
global g

on new me
  ancestor = new(script("objSpriteMember"))
  i = me.modifyParams(#init)
  i[#surroundHeight] = 4
  return me
end

on init me, params
  ancestor.init(params)
  pEnergyBar = #none
  pSurroundHeight = params.surroundHeight
  pTarget = #none
end

on finish me
  me.finishEnergyBar()
  ancestor.finish()
end

on finishEnergyBar me
  if pEnergyBar <> #none then
    pEnergyBar.finish()
    pEnergyBar = #none
    pTarget = #none
  end if
end

on calcSurroundRect me
  energyRect = pTarget.calcEnergyRectBottom()
  surroundRectBottom = energyRect.bottom + pSurroundHeight
  surroundRect = rect(energyRect.left, energyRect.bottom, energyRect.right, surroundRectBottom)
  return surroundRect
end

on displayTargetEnergy me
  surroundRect = me.calcSurroundRect()
  me.setSpriteRect(surroundRect)
  me.updateEnergyBar(surroundRect)
end

on ensureEnergyBar me
  if pEnergyBar = #none then
    pEnergyBar = g.objectMaster.requestObject(#objEnergyBar)
    params = pEnergyBar.getParams(#init)
    params.barBorder = 1
    params.surroundSpr = me.getSprite()
    pEnergyBar.init(params)
  end if
end

on clearTarget me
  me.targetDead()
end

on setTarget me, theObj
  pTarget = theObj
  me.ensureSpriteAndMember()
  me.ensureEnergyBar()
  targetTeamColour = g.teamMaster.getTeamColour(pTarget.getTeam())
  pEnergyBar.reset(pTarget.getEnergy(), pTarget.getMaxEnergy(), targetTeamColour)
end

on targetDead me
  pTarget = #none
  me.finishEnergyBar()
  me.offscreen()
end

on update me
  if pTarget <> #none then
    if (pTarget.checkDead() = 0) and (pTarget.getDead() = 0) then
      me.displayTargetEnergy()
    else
      me.targetDead()
    end if
  end if
end

on updateEnergyBar me, surroundRect
  pEnergyBar.setSurroundRect(surroundRect)
  pEnergyBar.updateBarOnSurround()
  pEnergyBar.updateEnergy(pTarget.getEnergy())
end
