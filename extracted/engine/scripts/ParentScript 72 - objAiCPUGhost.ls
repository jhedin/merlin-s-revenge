property ancestor, pPossessDistance, pTargetLoc, pTargetType
global g

on new me
  ancestor = new(script("objAi"))
  i = me.modifyParams(#init)
  i[#targetType] = #monk
  return me
end

on init me, params
  ancestor.init(params)
  pPossessDistance = 10
  pTargetType = params.targetType
end

on addSaveData me, sd
  ancestor.addSaveData(sd)
  sd[#pTargetLoc] = pTargetLoc
end

on attemptPossess me
  myTarget = me.getRelation(#target)
  if myTarget = #none then
    me.goMode(#findTarget)
  else
    if geomPixelDist(me.getLoc(), myTarget.getLoc()) < pPossessDistance then
      me.pCharacterPrg.mergeExperience(myTarget)
      me.pCharacterPrg.goMode(#finish)
    else
      me.goMode(#findTarget)
    end if
  end if
end

on eventNotification me, theEvent, theObj
  ancestor.eventNotification(theEvent, theObj)
  case theEvent of
    #leaveGame, #outOfEnergy:
      if theObj = me.getRelation(#target) then
        me.breakRelationship(theObj, #target)
      end if
  end case
end

on getAttack me
  return #none
end

on goToLoc me
  myTarget = me.getRelation(#target)
  if myTarget = #none then
    me.pCharacterPrg.moveToLoc(pTargetLoc)
  else
    me.pCharacterPrg.moveToLoc(myTarget.getLoc())
  end if
  me.goMode(#goToLoc)
end

on internalEvent me, theEvent
  ancestor.internalEvent(theEvent)
  case theEvent of
    #buildingFinished:
      me.goMode(#findTarget)
  end case
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
  pTargetLoc = sd.pTargetLoc
end

on update me
  ancestor.update()
  case me.pmode of
    #findTarget:
      fin = me.updateFindTarget()
      if fin then
        me.goToLoc()
      end if
    #goToLoc:
      fin = me.updateGoToLoc()
      if fin then
        me.attemptPossess()
      end if
  end case
end

on updateFindTarget me
  myTeam = me.pCharacterPrg.getTeamWhenAlive()
  myTarget = g.teamMaster.findUnitOfType(pTargetType, myTeam)
  if myTarget = #none then
    currentMap = g.gamemaster.getCurrentMap()
    mapRect = currentMap.getSpriteRect()
    pTargetLoc = PointRandomInRect(mapRect)
  else
    me.setTarget(myTarget)
    pTargetLoc = myTarget.getLoc()
  end if
  return 1
end

on updateGoToLoc me
  fin = 0
  if geomPixelDist(me.getLoc(), pTargetLoc) < pPossessDistance then
    fin = 1
  end if
  return fin
end
