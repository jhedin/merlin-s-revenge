property ancestor, pBuilding, pBuildRate, pBuildRateInc, pBuildRange, pUnitToBuild, pBuildDie, pBuildOne

on new me
  ancestor = new(script("modModule"))
  return me
end

on addModParams me
  i = me.modifyParams(#init)
  i[#unitToBuild] = [#none, #none, #none, #none]
  i[#buildRate] = 100
  i[#buildRateInc] = 50
  i[#buildDie] = 0
  i[#buildOne] = 1
  ancestor.addModParams()
end

on init me, params
  ancestor.init(params)
  pBuilding = #none
  pBuildRate = params.buildRate
  pBuildRateInc = params.buildRateInc
  pBuildRange = 50
  pUnitToBuild = params.unitToBuild
  pBuildDie = params.buildDie
  pBuildOne = params.buildOne
end

on addSaveData me, sd
  ancestor.addSaveData(sd)
  me.addToSaveData(sd)
end

on addToArmyDetails me
  ad = me.big.getArmyDetails()
  me.addToSaveData(ad)
end

on getBuildDie me
  return pBuildDie
end

on getBuildOne me
  return pBuildOne
end

on addToSaveData me, sd
  sd[#pBuildRate] = pBuildRate
end

on alignToBuilding me
  buildingRect = pBuilding.getRect()
  faceDir = 1
  case faceDir of
    (-1):
      xLoc = me.big.positionLeftEdge(buildingRect.right)
    1:
      xLoc = me.big.positionRightEdge(buildingRect.left)
  end case
  yLoc = me.big.positionBottomEdge(buildingRect.bottom)
  pBuilding.getLocZ()
  me.big.moveTowardsLoc(point(xLoc, yLoc))
  me.big.faceObject(pBuilding)
  buildingLocZ = pBuilding.getLocZ()
  me.big.setLocZ(buildingLocZ + 1)
end

on checkBuildingInRange me, theBuilding
  inrange = 0
  if theBuilding <> #none then
    buildRange = me.getBuildRange()
    distToBuilding = GeomDistSqr(me.getLoc(), theBuilding.getLoc())
    if distToBuilding <= (buildRange * buildRange) then
      inrange = 1
    end if
  end if
  return inrange
end

on checkMyBuildingInRange me
  return me.checkBuildingInRange(pBuilding)
end

on getBuildRate me
  return pBuildRate
end

on getBuildRange me
  return pBuildRange
end

on getUnitToBuild me
  return pUnitToBuild[random(pUnitToBuild.count)]
end

on goMode me, newMode
  ancestor.goMode(newMode)
end

on incBuildRate me
  pBuildRate = pBuildRate + pBuildRateInc
end

on internalEvent me, theEvent
  ancestor.internalEvent(theEvent)
  case theEvent of
    #addToArmyDetails:
      me.addToArmyDetails()
    #levelUp:
      me.incBuildRate()
    #restoreFromArmyDetails:
      me.restoreFromArmyDetails()
  end case
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
  me.restoreFromSaveData(sd)
end

on restoreFromArmyDetails me
  ad = me.big.getArmyDetails()
  me.restoreFromSaveData(ad)
end

on restoreFromSaveData me, sd
  pBuildRate = sd.pBuildRate
end

on setBuilding me, newValue
  pBuilding = newValue
end

on update me
  ancestor.update()
  case me.big.pmode of
    #build:
      me.alignToBuilding()
  end case
end
