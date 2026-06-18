property ancestor, pBuildAmount, pBuildingSituation
global g

on new me
  ancestor = new(script("objAICPU"))
  pBuildDie = 0
  return me
end

on init me, params
  ancestor.init(params)
  pBuildingSituation = #none
end

on alignToBuilding me
  building = me.getBuilding()
  me.pCharacterPrg.setBuilding(building)
end

on clearBuilding me
  myBuilding = me.getBuilding()
  if myBuilding = #none then
    return 
  end if
  myBuilding.finish()
  me.pCharacterPrg.setBuilding(#none)
  me.breakRelationship(myBuilding, #building)
end

on continueBuilding me, objBuilding
  pBuildingSituation = #unfinished
  me.setBuilding(objBuilding)
  pBuildAmount = 0
  me.alignToBuilding()
end

on eventNotification me, theEvent, theObj
  ancestor.eventNotification(theEvent, theObj)
  case theEvent of
    #buildingFinished:
      building = me.getBuilding()
      if theObj = building then
        me.setBuilding(#none)
        me.goMode(#findTarget)
        if me.pCharacterPrg.getBuildDie() = 1 then
          me.pCharacterPrg.moveToLoc(point(theObj.big.pMoveXY.pLoc.locH, theObj.big.pMoveXY.pLoc.locV))
          me.pCharacterPrg.big.setDead(1)
          me.setMode(#dead)
        end if
      end if
    #outOfEnergy:
      building = me.getBuilding()
      if theObj = building then
        me.setBuilding(#none)
        myMode = me.getMode()
        if (myMode = #walkToBuilding) or (myMode = #lookForBuilding) or (myMode = #build) then
          me.goMode(#findTarget)
        end if
      end if
  end case
end

on getBuilding me
  return me.getRelation(#building)
end

on getUnfinishedBuilding me
  unfinishedBuilding = #none
  building = g.teamMaster.getBuildingOfType(me.big, me.pCharacterPrg.getUnitToBuild())
  if building <> #none then
    if building.isUnfinishedBuilding() = 1 then
      unfinishedBuilding = building
    else
      unfinishedBuilding = #complete
    end if
  end if
  return unfinishedBuilding
end

on goMode me, newMode
  case newMode of
    #walkToBuilding:
      buildingOk = me.startBuilding()
      if buildingOk = 0 then
        newMode = #findTarget
      end if
  end case
  ancestor.goMode(newMode)
end

on internalEvent me, theEvent
  ancestor.internalEvent(theEvent)
  case theEvent of
    #buildingFinished:
      me.big.goMode(#lookForBuilding)
    #clearDefaultBuildings:
      if pBuildingSituation = #startedNew then
        me.clearBuilding()
      end if
    #relationshipsRestored:
      myBuilding = me.getBuilding()
      if myBuilding <> #none then
        me.keepMePosted(myBuilding, #buildingFinished)
        me.keepMePosted(myBuilding, #outOfEnergy)
      end if
      me.pCharacterPrg.setBuilding(myBuilding)
  end case
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
end

on restoreRelationships me
  ancestor.restoreRelationships()
end

on setBuilding me, newBuilding
  if newBuilding = #none then
    building = me.getBuilding()
    if building <> #none then
      me.breakRelationship(building, #building)
    end if
  else
    me.formRelationship(newBuilding, #building, #exclusive)
    me.keepMePosted(newBuilding, #buildingFinished)
    me.keepMePosted(newBuilding, #outOfEnergy)
  end if
  me.pCharacterPrg.setBuilding(newBuilding)
end

on start me
  ancestor.start()
end

on startBuilding me
  unfinishedBuilding = me.getUnfinishedBuilding()
  if unfinishedBuilding <> #none then
    if unfinishedBuilding <> #complete then
      me.continueBuilding(unfinishedBuilding)
      constructionOk = 1
    else
      if me.pCharacterPrg.getBuildOne() = 0 then
        constructionOk = me.startNewConstruction()
      end if
    end if
  else
    constructionOk = me.startNewConstruction()
  end if
  if constructionOk then
    me.pCharacterPrg.goMode(#build)
  end if
  return constructionOk
end

on startNewConstruction me
  constructionOk = 0
  pBuildingSituation = #startedNew
  building = me.pCharacterPrg.getUnitToBuild()
  params = g.actorMaster.getParams(#newActor)
  params.preBuilt = 0
  params.typ = building
  params.startLoc = me.getLoc() + point(32, 0)
  params.useOffset = 0
  objBuilding = g.actorMaster.newActor(params)
  if objBuilding <> #none then
    me.continueBuilding(objBuilding)
    constructionOk = 1
  end if
  return constructionOk
end

on update me
  ancestor.update()
  case me.pmode of
    #build:
      me.updateBuild()
    #lookForBuilding:
      teleMode = me.pCharacterPrg.getTeleportMode()
      if teleMode = #none then
        me.goMode(#walkToBuilding)
      end if
    #walkToBuilding:
      fin = me.updateWalkToBuilding()
      if fin then
        me.goMode(#build)
      end if
  end case
end

on updateBuild me
  buildRate = me.pCharacterPrg.getBuildRate()
  pBuildAmount = pBuildAmount + buildRate
  noOfFrames = pBuildAmount / 100
  remaining = pBuildAmount mod 100
  pBuildAmount = remaining
  repeat with i = 1 to noOfFrames
    building = me.getBuilding()
    if building = #none then
      exit repeat
    end if
    building.advanceBuildFrame()
  end repeat
end

on updateWalkToBuilding me
  fin = me.pCharacterPrg.checkMyBuildingInRange()
  return fin
end
