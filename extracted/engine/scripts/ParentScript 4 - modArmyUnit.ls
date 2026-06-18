property ancestor, pArmyDetails, pTeleportable, pTeleportOutStarted
global g

on new me
  ancestor = new(script("modModule"))
  return me
end

on addModParams me
  i = me.modifyParams(#init)
  i[#teleportable] = 1
  ancestor.addModParams()
end

on init me, params
  ancestor.init(params)
  pArmyDetails = #none
  pTeleportable = params.teleportable
  pTeleportOutStarted = 0
  if params[#ghost] = 1 then
    pTeleportable = 0
  end if
end

on addSaveData me, sd
  ancestor.addSaveData(sd)
  me.addToSaveData(sd)
end

on addToArmyDetails me
  ad = me.big.getArmyDetails()
  me.addToSaveData(ad)
end

on addToSaveData me, sd
  sd[#pTeleportOutStarted] = pTeleportOutStarted
end

on armyTeleportIn me
  me.big.collisionDetectionOff()
  me.big.frameAdvance()
  me.big.teleportInAt(me.getLoc())
end

on armyTeleportOut me
  if pTeleportable = 0 then
    return 
  end if
  if pTeleportOutStarted then
    return 
  end if
  pTeleportOutStarted = 1
  me.big.collisionDetectionOff()
  stageFloor = me.big.getRect().bottom
  me.big.teleportOut(#none, stageFloor)
end

on generateArmyDetails me
  pArmyDetails = [:]
  me.big.internalEvent(#addToArmyDetails)
  return pArmyDetails
end

on getArmyDetails me
  return pArmyDetails
end

on internalEvent me, theEvent
  ancestor.internalEvent(theEvent)
  case theEvent of
    #addToArmyDetails:
      me.addToArmyDetails()
    #restoreFromArmyDetails:
      me.restoreFromArmyDetails()
    #teleportInFinished:
      me.big.collisionDetectionOn()
    #teleportOutFinished:
      if pTeleportOutStarted = 1 then
        pTeleportOutStarted = 0
        g.armyMaster.recordUnitDetails(me.big)
        me.big.leaveGame()
        me.big.eventNotify(#leaveGame)
      end if
  end case
end

on restoreArmyDetails me, armyDetails
  pArmyDetails = armyDetails
  me.internalEvent(#restoreFromArmyDetails)
end

on restoreFromArmyDetails me
  ad = me.big.getArmyDetails()
  me.restoreFromSaveData(ad)
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
  me.restoreFromSaveData(sd)
end

on restoreFromSaveData me, sd
  pTeleportOutStarted = sd.pTeleportOutStarted
end
