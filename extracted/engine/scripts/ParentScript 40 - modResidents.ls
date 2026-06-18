property ancestor, pCurrentGroupSize, pGroupInProduction, pGroupProductionCounter, pReleaseCounter, pResidentGroups, pResidentMode, pResidentsRemainingCounter, pTotalResidents, pFinished
global g

on new me
  ancestor = new(script("modModule"))
  return me
end

on addModParams me
  i = me.modifyParams(#init)
  i[#residentGroups] = []
  i[#totalResidents] = 10
  ancestor.addModParams()
end

on init me, params
  ancestor.init(params)
  pCurrentGroupSize = CounterNew()
  pCurrentGroupSize.inc = -1
  pCurrentGroupSize.tim = [0, 1]
  pGroupInProduction = #none
  pGroupProductionCounter = CounterNew()
  pReleaseCounter = CounterNew()
  pResidentGroups = params.residentGroups
  pResidentMode = #none
  pResidentsRemainingCounter = CounterNew()
  pResidentsRemainingCounter.inc = -1
  pResidentsRemainingCounter.tim = [0, params.totalResidents]
  CounterReset(pResidentsRemainingCounter)
  pTotalResidents = params.totalResidents
end

on finish me
  ancestor.finish()
  if pResidentMode = #releaseCountdown then
    g.reservationsMaster.cancelReservation(me.id.bigMe)
  end if
  pFinished = 1
end

on calculateExperienceFromResidents me
  numGroups = pResidentGroups.count
  numInGroup = pResidentsRemainingCounter.theCount / numGroups * 1.0
  totalExp = 0
  repeat with residentInfo in pResidentGroups
    residentType = residentInfo.typ
    actorData = g.actorMaster.getActorData(residentType)
    groupExp = actorData.experienceImWorth * numInGroup
    totalExp = totalExp + groupExp
  end repeat
  return totalExp
end

on checkEndOfGroup me
  return pCurrentGroupSize.fin
end

on die me
  ancestor.die()
  me.goResidentMode(#dead)
end

on getCurrentGroupSize me
  return pCurrentGroupSize.theCount
end

on getResidentTeamCategory me
  return #enemies
end

on getResidentMode me
  return pResidentMode
end

on goResidentMode me, newMode
  case newMode of
    #releaseCountdown:
      me.resetReleaseCounter()
  end case
  pResidentMode = newMode
end

on isDwelling me
  if pResidentGroups = [] then
    return 0
  else
    return 1
  end if
end

on outOfEnergy me
  ancestor.outOfEnergy()
  me.goResidentMode(#dead)
end

on postReleaseResident me
  if me.checkEndOfGroup() then
    me.produceNextGroupOrDie()
  else
    me.goResidentMode(#releaseCountdown)
  end if
end

on produceNextGroupOrDie me
  if pResidentsRemainingCounter.fin then
    me.id.bigMe.noMoreResidents()
    me.goResidentMode(#empty)
  else
    me.startProduction()
  end if
end

on releaseResident me
  params = g.actorMaster.getParams(#newActor)
  params.typ = pGroupInProduction.typ
  params.startLoc = me.id.bigMe.getLoc()
  params.useOffset = 0
  newUnit = g.actorMaster.newActor(params)
  if me.big.getExperienceLevel() > 0 then
    newUnit.setStartingLevel(random(me.big.getExperienceLevel()))
  end if
  CounterOnce(pCurrentGroupSize)
  CounterOnce(pResidentsRemainingCounter)
  g.reservationsMaster.objectReleasedFromReservation(me.big)
  me.big.levelUp()
end

on resetReleaseCounter me
  pReleaseCounter.tim[2] = VarRndRange(pGroupInProduction.releaseInterval)
  CounterReset(pReleaseCounter)
end

on startProduction me
  groupPos = VarRndRange(1, pResidentGroups.count)
  pGroupInProduction = pResidentGroups[groupPos]
  pCurrentGroupSize.tim[2] = min(VarRndRange(pGroupInProduction.groupSize), pResidentsRemainingCounter.theCount)
  CounterReset(pCurrentGroupSize)
  timeToBuildSingle = VarRndRange(pGroupInProduction.buildTime)
  productionTime = pCurrentGroupSize * timeToBuildSingle
  pGroupProductionCounter.tim[2] = productionTime
  CounterReset(pGroupProductionCounter)
  pResidentMode = #produceGroup
end

on update me
  ancestor.update()
  case pResidentMode of
    #produceGroup:
      fin = me.updateProduceGroup()
      if fin then
        me.goResidentMode(#awaitPermission)
      end if
    #awaitPermission:
      fin = me.updateAwaitPermission()
      if fin then
        me.goResidentMode(#releaseCountdown)
      end if
    #releaseCountdown:
      fin = me.updateReleaseCountdown()
      if fin then
        me.releaseResident()
        me.postReleaseResident()
      end if
  end case
end

on updateAwaitPermission me
  numToRelease = pCurrentGroupSize.theCount
  fin = g.reservationsMaster.getPermissionToRelease(me.id.bigMe, numToRelease)
  return fin
end

on updateProduceGroup me
  fin = 0
  counter(pGroupProductionCounter)
  if pGroupProductionCounter.fin then
    fin = 1
  end if
  return fin
end

on updateReleaseCountdown me
  counter(pReleaseCounter)
  fin = pReleaseCounter.fin
  return fin
end
