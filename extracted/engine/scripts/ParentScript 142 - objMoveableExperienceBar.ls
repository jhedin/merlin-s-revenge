property ancestor, pExperienceBar, pSurroundHeight, pTarget
global g

on new me
  ancestor = new(script("objSpriteMember"))
  i = me.modifyParams(#init)
  i[#surroundHeight] = 4
  return me
end

on init me, params
  ancestor.init(params)
  pExperienceBar = #none
  pSurroundHeight = params.surroundHeight
  pTarget = #none
end

on finish me
  me.finishExperienceBar()
  ancestor.finish()
end

on finishExperienceBar me
  if pExperienceBar <> #none then
    pExperienceBar.finish()
    pExperienceBar = #none
    pTarget = #none
  end if
end

on calcSurroundRect me
  ExperienceRect = pTarget.calcEnergyRectBottom()
  surroundRectBottom = ExperienceRect.bottom + pSurroundHeight
  surroundRect = rect(ExperienceRect.left, ExperienceRect.bottom + 3, ExperienceRect.right, surroundRectBottom + 3)
  return surroundRect
end

on displayTargetExperience me
  if pTarget.getExperienceData().expPnts > 0 then
    surroundRect = me.calcSurroundRect()
    me.setSpriteRect(surroundRect)
    me.updateExperienceBar(surroundRect)
  else
    me.clearTarget()
  end if
end

on ensureExperienceBar me
  if pExperienceBar = #none then
    pExperienceBar = g.objectMaster.requestObject(#objExperienceBar)
    params = pExperienceBar.getParams(#init)
    params.barBorder = 1
    params.surroundSpr = me.getSprite()
    pExperienceBar.init(params)
  end if
end

on clearTarget me
  me.targetDead()
end

on setTarget me, theObj
  pTarget = theObj
  me.ensureSpriteAndMember()
  me.ensureExperienceBar()
  levelData = pTarget.getExperienceData()
  if (levelData.expToNxtLvl > 0) and (levelData.expPnts > 0) then
    targetTeamColour = g.teamMaster.getTeamColour(pTarget.getTeam())
    pExperienceBar.reset(levelData, targetTeamColour)
  else
    me.clearTarget()
  end if
end

on targetDead me
  pTarget = #none
  me.finishExperienceBar()
  me.offscreen()
end

on update me
  if pTarget <> #none then
    if (pTarget.checkDead() = 0) and (pTarget.getDead() = 0) then
      me.displayTargetExperience()
    else
      me.targetDead()
    end if
  end if
end

on updateExperienceBar me, surroundRect
  pExperienceBar.setSurroundRect(surroundRect)
  pExperienceBar.updateBarOnSurround()
  pExperienceBar.updateExp(pTarget.getExperienceData())
end
