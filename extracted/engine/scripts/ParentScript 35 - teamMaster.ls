property pRequestingObj, pTeams, pTeamThatDied, pRoomClear, pTeamOverride, pUnitMap, pBulletMap, pRoomSize, pTileSize, pPlayAreaRect, pUnitMapLoaded
global g

on new me
  return me
end

on init me
  pTeamThatDied = #none
  pRoomClear = 0
  me.initTeams()
  pTeamOverride = #none
  pUnitMap = #none
  pBulletMap = #none
  pRoomSize = #none
  pTileSize = #none
  pPlayAreaRect = #none
  pUnitMapLoaded = 0
end

on initTeams me
  pTeams = [:]
  teamDatas = g.collectionsMaster.getCollection(#objTeamData)
  if teamDatas = #none then
    return 
  end if
  repeat with nDataObj in teamDatas
    nTeam = g.structMaster.getStruct(#teamData)
    ListsMerge(nTeam, nDataObj.getData())
    pTeams[nTeam.teamName] = nTeam
  end repeat
end

on getFrontNode me, locXY, typ
  case typ of
    #unit:
      mapNode = pUnitMap.peek(locXY)
      if mapNode = #none then
        mapNode = g.objectMaster.requestObject(#objMapNode)
        params = mapNode.getParams(#init)
        mapNode.init(params)
        pUnitMap.poke(locXY, mapNode)
      end if
    #bullet:
      mapNode = pBulletMap.peek(locXY)
      if mapNode = #none then
        mapNode = g.objectMaster.requestObject(#objMapNode)
        params = mapNode.getParams(#init)
        mapNode.init(params)
        pBulletMap.poke(locXY, mapNode)
      end if
    otherwise:
      nothing()
  end case
  return mapNode
end

on getTileLoc me, objLoc
  if pUnitMapLoaded = 0 then
    currentMap = g.gamemaster.getCurrentMap()
    if currentMap <> #none then
      pUnitMapLoaded = 1
      pRoomSize = currentMap.pRoomSize.duplicate()
      pTileSize = currentMap.pTileSets[1].getTileSize()
      pPlayAreaRect = currentMap.getSpriteRect()
    else
      pRoomSize = point(18, 9)
      pTileSize = point(32, 32)
      pPlayAreaRect = rect(0, 0, 0, 0)
    end if
    pUnitMap = g.objectMaster.requestObject(#objDataMap)
    params = pUnitMap.getParams(#init)
    params.mapSize = pRoomSize.duplicate()
    params.blankEntry = #none
    pUnitMap.init(params)
    pBulletMap = g.objectMaster.requestObject(#objDataMap)
    pBulletMap.init(params)
  end if
  tileLoc = point(((objLoc.locH - pPlayAreaRect.left) / pTileSize[1]) + 1, ((objLoc.locV - pPlayAreaRect.top) / pTileSize[2]) + 1)
  tileLoc = PointConstrainToRect(tileLoc, rect(1, 1, pRoomSize.locH, pRoomSize.locV))
  return tileLoc
end

on addObjectToCurrentRoom me, obj
  currentRoom = g.gamemaster.getCurrentRoom()
  if currentRoom <> #none then
    currentRoom.addRoomObject(obj)
  end if
end

on calcIgnoreTeamsByAllegiance me, obj
  targetAllegiance = obj.getAttack().targetAllegiance
  teamSym = obj.getTeam()
  team = pTeams[teamSym]
  case targetAllegiance of
    #enemy:
      if (team[#friends] <> #void) and (team[#friends] <> #none) then
        temp = team.friends.duplicate()
        temp.add(teamSym)
        ignoreTeams = [temp]
      else
        ignoreTeams = [[teamSym]]
      end if
    #friendly:
      ignoreTeams = team.hates.duplicate()
  end case
  return ignoreTeams
end

on calcTargetTeamsByAllegiance me, obj
  targetAllegiance = obj.getAttack().targetAllegiance
  teamSym = obj.getTeam()
  team = pTeams[teamSym]
  case targetAllegiance of
    #enemy:
      targetTeams = team.hates.duplicate()
    #friendly:
      if (team.friends <> #void) and (team.friends <> #none) then
        temp = team.friends.duplicate()
        temp.add(teamSym)
        targetTeams = [temp]
      else
        targetTeams = [[teamSym]]
      end if
  end case
  return targetTeams
end

on calcTargetTeamsOverride me, obj
  targetAllegiance = obj.getAttack().targetAllegiance
  teamSym = obj.getTeam()
  team = pTeams[teamSym]
  if (teamSym <> pTeamOverride) and (targetAllegiance = #enemy) and (team.friends.getPos(pTeamOverride) = 0) then
    temp = pTeams[pTeamOverride].friends.duplicate()
    temp.add(pTeamOverride)
    targetTeams = [temp]
    return targetTeams
  else
    return me.calcTargetTeamsByAllegiance(obj)
  end if
end

on cullTeamList me, teamList
  runningCount = 0
  teams = []
  repeat with teamName in teamList
    addToList = 0
    team = pTeams[teamName]
    sum = team.teamBuildings.count + team.getaProp(#currentMembers)
    if sum > 0 then
      runningCount = runningCount + sum
      addToList = 1
    end if
    if addToList then
      teams.append(teamName)
    end if
  end repeat
  if (count(teams) = 0) or (runningCount < 5) then
    teams.addAt(1, #none)
  end if
  return teams
end

on findNearestEnemyBullets me, obj
  return me.findNearest(obj, #enemy, #teamBullets, 2, pBulletMap)
end

on findNearestEnemies me, obj
  return me.findNearest(obj, #enemy, #teamMembers, 2, pUnitMap)
end

on findNearestFriends me, obj
  return me.findNearest(obj, #friendly, #teamMembers, 2, pUnitMap)
end

on findANearest me, obj, allegiance, role, num, targetTeams
  teamSym = obj.getTeam()
  team = pTeams[teamSym]
  location = obj.getLoc()
  currentClosest = #none
  repeat with priorityTeams in targetTeams
    priorityTeams.deleteOne(#collectables)
    repeat with teamToSearch in priorityTeams
      closestInfo = me.findNearestInTeam(teamToSearch, role, num, location, obj)
      if currentClosest = #none then
        currentClosest = closestInfo
        next repeat
      end if
      if closestInfo <> #none then
        repeat with closestInfoItem in closestInfo.closestList
          currentClosestList = currentClosest.closestList
          furthestPos = currentClosest.furthestPos
          currentFurthestDist = currentClosestList[furthestPos].dist
          if closestInfoItem.dist < currentFurthestDist then
            currentClosestList[furthestPos] = closestInfoItem
            closestPos = ListGetPosOfMinByProp(currentClosestList, #dist)
            furthestPos = ListGetPosOfMaxByProp(currentClosestList, #dist)
            currentClosest.closestPos = closestPos
            currentClosest.furthestPos = furthestPos
          end if
        end repeat
      end if
    end repeat
    if currentClosest <> #none then
      exit repeat
    end if
  end repeat
  return currentClosest
end

on findNearestInTeam me, team, role, num, location, obj
  noneFound = 1
  closestList = []
  repeat with i = 1 to num
    closestList.append(g.structMaster.getStruct(#teamTarget))
  end repeat
  posOfFurthest = ListGetPosOfMaxByProp(closestList, #dist)
  furthestDist = closestList[posOfFurthest].dist
  teamToSearch = pTeams[team]
  objectsToSearch = teamToSearch[role]
  repeat with objectToCompare in objectsToSearch
    if objectToCompare.getDead() or objectToCompare.checkDead() then
      next repeat
    end if
    objLoc = objectToCompare.getLoc()
    objDist = AddDist(location, objLoc)
    if (objDist < furthestDist) and (objectToCompare <> obj) then
      closeObj = g.structMaster.getStruct(#teamTarget)
      closeObj.dist = objDist
      closeObj.obj = objectToCompare
      closestList[posOfFurthest] = closeObj
      posOfFurthest = ListGetPosOfMaxByProp(closestList, #dist)
      furthestDist = closestList[posOfFurthest].dist
      noneFound = 0
    end if
  end repeat
  if noneFound then
    return #none
  end if
  closestInfo = g.structMaster.getStruct(#teamClosestInfo)
  closestInfo.closestPos = ListGetPosOfMinByProp(closestList, #dist)
  closestInfo.furthestPos = ListGetPosOfMaxByProp(closestList, #dist)
  closestInfo.closestList = closestList
  return closestInfo
end

on findNearest me, obj, allegiance, role, num, objMap
  teamSym = obj.getTeam()
  team = pTeams[teamSym]
  location = obj.getLoc()
  character = obj.getActorType()
  override = pTeamOverride
  if override <> #none then
    if (teamSym <> pTeamOverride) and (allegiance = #enemy) and (team.friends.getPos(pTeamOverride) = 0) then
      temp = pTeams[pTeamOverride].friends.duplicate()
      temp.add(pTeamOverride)
      hatedTeams = [temp]
    else
      case allegiance of
        #enemy:
          hatedTeams = team.hates.duplicate()
        #friendly:
          if (team.friends <> #void) and (team.friends <> #none) then
            temp = team.friends.duplicate()
            temp.add(teamSym)
            hatedTeams = [temp]
          else
            hatedTeams = [[teamSym]]
          end if
      end case
    end if
  else
    case allegiance of
      #enemy:
        hatedTeams = team.hates.duplicate()
      #friendly:
        if (team.friends <> #void) and (team.friends <> #none) then
          temp = team.friends.duplicate()
          temp.add(teamSym)
          hatedTeams = [temp]
        else
          hatedTeams = [[teamSym]]
        end if
    end case
  end if
  targetTeams = me.cullTeamList(hatedTeams[1])
  if targetTeams[1] = #none then
    if targetTeams.count() = 1 then
      return #none
    else
      targetTeams.deleteAt(1)
    end if
  end if
  tileLoc = me.getTileLoc(location)
  targetList = me.searchObjMap(tileLoc, targetTeams, 0, 3, objMap)
  if targetList.count = 0 then
    return #none
  end if
  targetCriteria = obj.getAttack().targetCriteria
  found = 0
  closestList = []
  repeat with i = 1 to num
    closestList.append(g.structMaster.getStruct(#teamTarget))
  end repeat
  posOfFurthest = ListGetPosOfMaxByProp(closestList, #dist)
  furthestDist = closestList[posOfFurthest].dist
  found = 0
  repeat with nObj in targetList
    if nObj.getTeamRole() <> role then
      next repeat
    end if
    if nObj = obj then
      next repeat
    end if
    objLoc = nObj.getLoc()
    objDist = AddDist(location, objLoc)
    if objDist < furthestDist then
      objDist = SineDist(location, objLoc)
      if objDist < furthestDist then
        found = 1
        closeObj = g.structMaster.getStruct(#teamTarget)
        closeObj.dist = objDist
        closeObj.obj = nObj
        closestList[posOfFurthest] = closeObj
        found = 1
        posOfFurthest = ListGetPosOfMaxByProp(closestList, #dist)
        furthestDist = closestList[posOfFurthest].dist
      end if
    end if
  end repeat
  closestInfo = g.structMaster.getStruct(#teamClosestInfo)
  closestInfo.closestPos = ListGetPosOfMinByProp(closestList, #dist)
  closestInfo.furthestPos = ListGetPosOfMaxByProp(closestList, #dist)
  closestInfo.closestList = closestList
  if found then
    return closestInfo
  else
    return #none
  end if
end

on findNearestTarget me, obj, allegiance, role, num
  teamSym = obj.getTeam()
  team = pTeams[teamSym]
  location = obj.getLoc()
  character = obj.getActorType()
  override = pTeamOverride
  if override <> #none then
    if (teamSym <> pTeamOverride) and (allegiance = #enemy) and (team.friends.getPos(pTeamOverride) = 0) then
      temp = pTeams[pTeamOverride].friends.duplicate()
      temp.add(pTeamOverride)
      hatedTeams = [temp]
    else
      case allegiance of
        #enemy:
          hatedTeams = team.hates.duplicate()
        #friendly:
          if (team.friends <> #void) and (team.friends <> #none) then
            temp = team.friends.duplicate()
            temp.add(teamSym)
            hatedTeams = [temp]
          else
            hatedTeams = [[teamSym]]
          end if
      end case
    end if
  else
    case allegiance of
      #enemy:
        hatedTeams = team.hates.duplicate()
      #friendly:
        if (team.friends <> #void) and (team.friends <> #none) then
          temp = team.friends.duplicate()
          temp.add(teamSym)
          hatedTeams = [temp]
        else
          hatedTeams = [[teamSym]]
        end if
    end case
  end if
  targetTeams = me.cullTeamList(hatedTeams[1])
  if targetTeams[1] = #none then
    if targetTeams.count() = 1 then
      return #none
    else
      targetTeams.deleteAt(1)
      hatedTeams[1] = targetTeams
      return me.findANearest(obj, allegiance, role, num, hatedTeams)
    end if
  end if
  tileLoc = me.getTileLoc(location)
  targetList = me.searchUnitMap(tileLoc, targetTeams, 1, 7)
  if targetList.count = 0 then
    hatedTeams[1] = targetTeams
    return me.findANearest(obj, allegiance, role, num, hatedTeams)
  end if
  targetCriteria = obj.getAttack().targetCriteria
  found = 0
  closestList = []
  repeat with i = 1 to num
    closestList.append(g.structMaster.getStruct(#teamTarget))
  end repeat
  posOfFurthest = ListGetPosOfMaxByProp(closestList, #dist)
  furthestDist = closestList[posOfFurthest].dist
  repeat with nObj in targetList
    if nObj.getTeamRole() <> role then
      next repeat
    end if
    if nObj = obj then
      next repeat
    end if
    objLoc = nObj.getLoc()
    objDist = AddDist(location, objLoc)
    if objDist < furthestDist then
      found = 1
      closeObj = g.structMaster.getStruct(#teamTarget)
      closeObj.dist = objDist
      closeObj.obj = nObj
      closestList[posOfFurthest] = closeObj
      posOfFurthest = ListGetPosOfMaxByProp(closestList, #dist)
      furthestDist = closestList[posOfFurthest].dist
    end if
  end repeat
  closestInfo = g.structMaster.getStruct(#teamClosestInfo)
  closestInfo.closestPos = ListGetPosOfMinByProp(closestList, #dist)
  closestInfo.furthestPos = ListGetPosOfMaxByProp(closestList, #dist)
  closestInfo.closestList = closestList
  return closestInfo
end

on findRandomInTeam me, theTeam
  teamToCheck = pTeams[theTeam]
  isMembers = teamToCheck[#teamMembers].count > 0
  isBuildings = teamToCheck[#teamBuildings].count > 0
  if isBuildings and isMembers then
    lookInMembers = random(2) - 1
  else
    if isBuildings then
      lookInMembers = 0
    else
      lookInMember = 1
    end if
  end if
  if lookInMembers then
    targetList = teamToCheck[#teamMembers]
  else
    targetList = teamToCheck[#teamBuildings]
  end if
  numTargets = targetList.count
  theTarget = targetList[random(numTargets)]
  return theTarget
end

on findRandomTarget me, theObj
  randomTarget = #none
  teamSym = theObj.getTeam()
  team = pTeams[teamSym]
  attack = theObj.getAttack()
  roles = attack.hits
  if team = #healthRollover then
    override = #none
  else
    override = pTeamOverride
  end if
  if override <> #none then
    hatedTeams = me.calcTargetTeamsOverride(theObj)
  else
    hatedTeams = me.calcTargetTeamsByAllegiance(theObj)
  end if
  potentialTargets = []
  repeat with priorityTeams in hatedTeams
    priorityTeams.deleteOne(#collectables)
    repeat with team in priorityTeams
      teamToCheck = pTeams[team]
      repeat with role in roles
        targets = teamToCheck[role]
        if targets.count > 0 then
          repeat with targit in targets
            potentialTargets.append(targit)
          end repeat
        end if
      end repeat
    end repeat
    if potentialTargets.count > 0 then
      exit repeat
    end if
  end repeat
  if potentialTargets.count > 0 then
    pos = random(potentialTargets.count)
    randomTarget = potentialTargets[pos]
  end if
  return randomTarget
end

on findATarget me, theObj, hatedTeams
  objLoc = theObj.getLoc()
  pRequestingObj = theObj
  character = theObj.getActorType()
  closestTarget = g.structMaster.getStruct(#teamTarget)
  targetCriteria = theObj.getAttack().targetCriteria
  targetRoles = theObj.getAttack().targetRoles
  repeat with priorityTeams in hatedTeams
    priorityTeams.deleteOne(#collectables)
    repeat with nTeam in priorityTeams
      closestInTeam = me.findTargetInTeam(nTeam, objLoc, targetCriteria, targetRoles)
      if closestInTeam.dist < closestTarget.dist then
        if closestInTeam.priorityRank <= closestTarget.priorityRank then
          closestTarget = closestInTeam
        end if
      end if
    end repeat
    if closestTarget.obj <> #none then
      exit repeat
    end if
  end repeat
  if targetCriteria <> #lowestHealth then
    closestTarget.dist = sqrt(closestTarget.dist)
  end if
  return closestTarget
end

on findTargetInTeam me, teamSym, theloc, targetCriteria, targetRoles
  if teamSym = #none then
    closestTarget = g.structMaster.getStruct(#teamTarget)
    return closestTarget
  else
    closestTarget = g.structMaster.getStruct(#teamTarget)
    teamToSearch = pTeams[teamSym]
    priorityRank = 0
    repeat with priorityRoles in targetRoles
      priorityRank = priorityRank + 1
      repeat with roleSym in priorityRoles
        objs = teamToSearch[roleSym]
        repeat with nObj in objs
          if nObj.getDead() or nObj.checkDead() then
            next repeat
          end if
          case targetCriteria of
            #closestDistance:
              nLoc = nObj.getLoc()
              nDist = GeomDistSqr(theloc, nLoc)
            #lowestHealth:
              nDist = nObj.getHealth()
          end case
          if nDist < closestTarget.dist then
            closestTarget.dist = nDist
            closestTarget.obj = nObj
            closestTarget.priorityRank = priorityRank
          end if
        end repeat
      end repeat
      if closestTarget.obj <> #none then
        exit repeat
      end if
    end repeat
    return closestTarget
  end if
end

on findRandomTargetInTeam me, teamSym, theloc, targetCriteria, targetRoles
  closestTarget = g.structMaster.getStruct(#teamTarget)
  teamToCheck = pTeams[teamSym]
  isMembers = teamToCheck[#teamMembers].count > 0
  if targetRoles[1].getPos(#teamMembers) = 0 then
    isMembers = 0
  end if
  isBuildings = teamToCheck[#teamBuildings].count > 0
  if targetRoles[1].getPos(#teamBuildings) = 0 then
    isBuildings = 0
  end if
  if isBuildings and isMembers then
    lookInMembers = random(2) - 1
  else
    if isBuildings then
      lookInMembers = 0
    else
      if isMembers then
        lookInMembers = 1
      else
        return closestTarget
      end if
    end if
  end if
  if lookInMembers then
    targetList = teamToCheck[#teamMembers]
  else
    targetList = teamToCheck[#teamBuildings]
  end if
  numTargets = targetList.count
  nObj = targetList[random(numTargets)]
  randCount = 0
  repeat while nObj.getDead() or nObj.checkDead()
    nObj = targetList[random(numTargets)]
    randCount = randCount + 1
    if randCount > numTargets then
      exit repeat
    end if
  end repeat
  case targetCriteria of
    #closestDistance:
      nLoc = nObj.getLoc()
      nDist = AddDist(theloc, nLoc)
    #lowestHealth:
      nDist = nObj.getHealth()
  end case
  closestTarget.dist = nDist
  closestTarget.obj = nObj
  closestTarget.priorityRank = random(2)
  return closestTarget
end

on findTarget me, theObj
  closestTarget = g.structMaster.getStruct(#teamTarget)
  objLoc = theObj.getLoc()
  pRequestingObj = theObj
  character = theObj.getActorType()
  if (character <> #characterEnergyRollOverMaster) and (pTeamOverride <> #none) then
    hatedTeams = me.calcTargetTeamsOverride(theObj)
  else
    hatedTeams = me.calcTargetTeamsByAllegiance(theObj)
  end if
  targetTeams = me.cullTeamList(hatedTeams[1])
  if targetTeams[1] = #none then
    if targetTeams.count() = 1 then
      return closestTarget
    else
      targetTeams.deleteAt(1)
      hatedTeams[1] = targetTeams
      return me.findATarget(theObj, hatedTeams)
    end if
  end if
  targetCriteria = theObj.getAttack().targetCriteria
  if targetCriteria = #lowestHealth then
    hatedTeams[1] = targetTeams
    return me.findATarget(theObj, hatedTeams)
  end if
  tileLoc = me.getTileLoc(objLoc)
  if character = #characterEnergyRollOverMaster then
    targetList = me.searchUnitMap(tileLoc, targetTeams, 0, 1)
  else
    targetList = me.searchUnitMap(tileLoc, targetTeams, 0, 20)
  end if
  targetRoles = theObj.getAttack().targetRoles
  targetRole = #none
  if targetRoles[1].count = 1 then
    targetRole = targetRoles[1][1]
  end if
  repeat with nObj in targetList
    if targetRole <> #none then
      if nObj.getTeamRole() <> targetRole then
        next repeat
      end if
    end if
    nLoc = nObj.getLoc()
    nDist = GeomDistSqr(objLoc, nLoc)
    if nDist < closestTarget.dist then
      closestTarget.dist = nDist
      closestTarget.obj = nObj
    end if
  end repeat
  return closestTarget
end

on findTargetWithin me, theObj, maxDist
  closestTarget = g.structMaster.getStruct(#teamTarget)
  objLoc = theObj.getLoc()
  if pTeamOverride <> #none then
    hatedTeams = me.calcTargetTeamsOverride(theObj)
  else
    hatedTeams = me.calcTargetTeamsByAllegiance(theObj)
  end if
  targetTeams = me.cullTeamList(hatedTeams[1])
  if targetTeams[1] = #none then
    if targetTeams.count() = 1 then
      return closestTarget
    else
      targetTeams.deleteAt(1)
    end if
  end if
  tileLoc = me.getTileLoc(objLoc)
  targetList = me.searchUnitMap(tileLoc, targetTeams, 0, maxDist)
  targetRoles = theObj.getAttack().targetRoles
  targetRole = #none
  if targetRoles[1].count = 1 then
    targetRole = targetRoles[1][1]
  end if
  repeat with nObj in targetList
    if targetRole <> #none then
      if nObj.getTeamRole() <> targetRole then
        next repeat
      end if
    end if
    nLoc = nObj.getLoc()
    nDist = GeomDistSqr(objLoc, nLoc)
    if nDist < closestTarget.dist then
      closestTarget.dist = nDist
      closestTarget.obj = nObj
    end if
  end repeat
  return closestTarget
end

on findUnitOfType me, theUnitType, theTeam
  unitOfType = #none
  team = pTeams[theTeam]
  roles = [#teamMembers, #teamBuildings]
  repeat with role in roles
    unitList = team[role]
    repeat with unit in unitList
      actorType = unit.getActorType()
      if actorType = theUnitType then
        unitOfType = unit
        exit repeat
      end if
    end repeat
    if unitOfType <> #none then
      exit repeat
    end if
  end repeat
  return unitOfType
end

on getBuildingOfType me, obj, theType
  building = #none
  teamSym = obj.getTeam()
  team = pTeams[teamSym]
  teamBuildings = team.teamBuildings
  repeat with teamBuilding in teamBuildings
    buildingType = teamBuilding.getActorType()
    if buildingType = theType then
      building = teamBuilding
      exit repeat
    end if
  end repeat
  return building
end

on getStandingOnUnfinishedBuilding me, obj
  unfinishedBuilding = #none
  teamSym = obj.getTeam()
  team = pTeams[teamSym]
  teamBuildings = team.teamBuildings
  repeat with teamBuilding in teamBuildings
    if teamBuilding.isUnfinishedBuilding() then
      if CollisionCheck(obj, teamBuilding) then
        unfinishedBuilding = teamBuilding
      end if
    end if
  end repeat
  return unfinishedBuilding
end

on getTileSize me
  return pTileSize
end

on impactAttack me, obj
  me.impactMeleeAttack(obj)
end

on impactMeleeAttack me, obj
  teamSym = obj.getTeam()
  team = pTeams[teamSym]
  if pTeamOverride <> #none then
    hatedTeams = me.calcTargetTeamsOverride(obj)
  else
    hatedTeams = me.calcTargetTeamsByAllegiance(obj)
  end if
  if hatedTeams.getPos(#all) > 0 then
    nothing()
  end if
  targetTeams = me.cullTeamList(hatedTeams[1])
  hatedTeams[1] = targetTeams
  objLoc = obj.getLoc()
  if targetTeams[1] = #none then
    if targetTeams.count() = 1 then
      return 
    else
      targetTeams.deleteAt(1)
      hatedTeams[1] = targetTeams
      repeat with priorityTeams in hatedTeams
        repeat with nTeam in priorityTeams
          me.impactMeleeAttackOnTeam(nTeam, obj)
        end repeat
      end repeat
      return 
    end if
  end if
  tileLoc = me.getTileLoc(objLoc)
  attackRad = obj.calcAttackDist(pTileSize)
  targetList = me.searchUnitMap(tileLoc, targetTeams, attackRad + 1, attackRad + 1)
  targetRoles = obj.getAttack().hits
  targetRole = #none
  if targetRoles.count = 1 then
    targetRole = targetRoles[1]
  end if
  repeat with nObj in targetList
    if targetRole <> #none then
      if nObj.getTeamRole() <> targetRole then
        next repeat
      end if
    end if
    if obj.calcAttackHit(nObj) then
      collisionVect = obj.calcCollisionVect(nObj)
      payloadFunctions = obj.getAttack().payLoadFunction
      owner = obj.getOwner()
      if owner = #none then
        owner = obj
      end if
      CallPayloadFunction(payloadFunctions, nObj, collisionVect, obj, owner)
    end if
  end repeat
end

on impactMeleeAttackOnTeam me, teamSym, attackingObj
  if teamSym = #none then
    return 
  end if
  team = pTeams[teamSym]
  hits = attackingObj.getAttack().hits
  repeat with teamObjectType in hits
    objs = team[teamObjectType]
    repeat with nObj in objs
      if attackingObj.calcAttackHit(nObj) then
        collisionVect = attackingObj.calcCollisionVect(nObj)
        payloadFunctions = attackingObj.getAttack().payLoadFunction
        owner = attackingObj.getOwner()
        if owner = #none then
          owner = attackingObj
        end if
        CallPayloadFunction(payloadFunctions, nObj, collisionVect, attackingObj, owner)
      end if
    end repeat
  end repeat
end

on isTargetsDead me, obj
  objTeam = obj.getTeam()
  targetTeams = me.calcTargetTeamsByAllegiance(obj)
  repeat with nPriority in targetTeams
    repeat with nTeam in nPriority
      if me.isTeamDead(nTeam) = 0 then
        return 0
      end if
    end repeat
  end repeat
  return 1
end

on isTeamDead me, teamName
  team = pTeams[teamName]
  roles = [#teamMembers, #teamBuildings]
  totalAlive = 0
  repeat with role in roles
    totalAlive = totalAlive + team[role].count
  end repeat
  if totalAlive = 0 then
    return 1
  end if
  return 0
end

on isPlayerEnemiesDead me
  obj = g.actorMaster.getPlayer()
  if obj = #none then
    return 0
  end if
  objTeam = obj.getTeam()
  repeat with nTeam in pTeams
    if nTeam.teamName <> objTeam then
      if nTeam.hates = [] then
        next repeat
      end if
      nHates = nTeam.hates[1]
      if nHates.getPos(objTeam) or nHates.getPos(#all) then
        if me.isTeamDead(nTeam.teamName) = 0 then
          return 0
        end if
      end if
    end if
  end repeat
  return 1
end

on joinTeam me, teamName, teamRole, obj
  if teamName = #none then
    return 
  end if
  mems = pTeams[teamName][teamRole]
  if mems.getPos(obj) = 0 then
    mems.append(obj)
    g.reservationsMaster.objectJoined(pTeams[teamName], teamRole, obj)
  end if
  me.addObjectToCurrentRoom(obj)
  obj.linkIn()
end

on leaveTeam me, teamName, teamRole, obj
  if teamName = #none then
    return 
  end if
  mems = pTeams[teamName][teamRole]
  pos = mems.getPos(obj)
  if pos > 0 then
    mems.deleteAt(pos)
    g.reservationsMaster.objectLeft(pTeams[teamName], teamRole, obj)
  end if
  me.removeObjectFromCurrentRoom(obj)
  if me.isTeamDead(teamName) then
    if obj.getDead() then
      pTeamThatDied = teamName
      me.tellTeamDied()
    end if
  end if
  obj.linkOut()
end

on getTeamColour me, theTeam
  return pTeams[theTeam].colour.duplicate()
end

on killEnemyTeams me, theTeam
  team = pTeams[theTeam]
  hates = team.hates
  repeat with priorityTeams in hates
    repeat with hatedTeam in priorityTeams
      me.killTeam(hatedTeam)
    end repeat
  end repeat
end

on killTeam me, theTeam
  team = pTeams[theTeam]
  roles = [#teamMembers, #teamBuildings]
  repeat with role in roles
    teamMembers = team[role]
    repeat with teamMember in teamMembers
      teamMember.die()
    end repeat
  end repeat
end

on removeObjectFromCurrentRoom me, obj
  currentRoom = g.gamemaster.getCurrentRoom()
  if currentRoom <> #none then
    currentRoom.removeRoomObject(obj)
  end if
end

on restoreTarget me, targetDetails
  team = targetDetails.team
  theloc = targetDetails.sprloc
  teamRole = targetDetails.teamRole
  targetRoles = [[teamRole]]
  restoredTarget = me.findTargetInTeam(team, theloc, #closestDistance, targetRoles)
  return restoredTarget.obj
end

on tellTeamDied me
  g.updater.addPrg(me, #hi)
end

on searchObjMap me, locXY, targetTeams, minShell, maxshell, objMap
  targetList = []
  shell = 1
  if maxshell > 50 then
    maxshell = 50
  end if
  mapSize = objMap.pMapSize
  mapNode = objMap.peek(locXY)
  if mapNode <> #none then
    if mapNode.getNext() = #none then
      mapNode.finish()
      objMap.poke(locXY, #none)
    else
      mapNode.search(targetTeams, targetList)
    end if
  end if
  repeat while 1
    if ((shell > minShell) and (count(targetList) > 0)) or (shell > maxshell) then
      exit repeat
    end if
    j = locXY.locV - shell
    if j >= 1 then
      repeat with i = locXY.locH - shell to locXY.locH + shell
        if i < 1 then
          next repeat
        end if
        if i > mapSize.locH then
          exit repeat
        end if
        mapNode = objMap.peek(point(i, j))
        if mapNode <> #none then
          if mapNode.getNext() = #none then
            mapNode.finish()
            objMap.poke(point(i, j), #none)
            next repeat
          end if
          mapNode.search(targetTeams, targetList)
        end if
      end repeat
    end if
    j = locXY.locV + shell
    if j <= mapSize.locV then
      repeat with i = locXY.locH - shell to locXY.locH + shell
        if i < 1 then
          next repeat
        end if
        if i > mapSize.locH then
          exit repeat
        end if
        mapNode = objMap.peek(point(i, j))
        if mapNode <> #none then
          if mapNode.getNext() = #none then
            mapNode.finish()
            objMap.poke(point(i, j), #none)
            next repeat
          end if
          mapNode.search(targetTeams, targetList)
        end if
      end repeat
    end if
    i = locXY.locH - shell
    if i >= 1 then
      repeat with j = locXY.locV - shell + 1 to locXY.locV + shell - 1
        if j < 1 then
          next repeat
        end if
        if j > mapSize.locV then
          exit repeat
        end if
        mapNode = objMap.peek(point(i, j))
        if mapNode <> #none then
          if mapNode.getNext() = #none then
            mapNode.finish()
            objMap.poke(point(i, j), #none)
            next repeat
          end if
          mapNode.search(targetTeams, targetList)
        end if
      end repeat
    end if
    i = locXY.locH + shell
    if i <= mapSize.locH then
      repeat with j = locXY.locV - shell + 1 to locXY.locV + shell - 1
        if j < 1 then
          next repeat
        end if
        if j > mapSize.locV then
          exit repeat
        end if
        mapNode = objMap.peek(point(i, j))
        if mapNode <> #none then
          if mapNode.getNext() = #none then
            mapNode.finish()
            objMap.poke(point(i, j), #none)
            next repeat
          end if
          mapNode.search(targetTeams, targetList)
        end if
      end repeat
    end if
    shell = shell + 1
  end repeat
  return targetList
end

on searchUnitMap me, locXY, targetTeams, minShell, maxshell
  targetList = []
  shell = 1
  if maxshell > 50 then
    maxshell = 50
  end if
  mapSize = pUnitMap.pMapSize
  mapNode = pUnitMap.peek(locXY)
  if mapNode <> #none then
    if mapNode.getNext() = #none then
      mapNode.finish()
      pUnitMap.poke(locXY, #none)
    else
      mapNode.search(targetTeams, targetList)
    end if
  end if
  repeat while 1
    if ((shell > minShell) and (count(targetList) > 0)) or (shell > maxshell) then
      exit repeat
    end if
    j = locXY.locV - shell
    if j >= 1 then
      repeat with i = locXY.locH - shell to locXY.locH + shell
        if i < 1 then
          next repeat
        end if
        if i > mapSize.locH then
          exit repeat
        end if
        mapNode = pUnitMap.peek(point(i, j))
        if mapNode <> #none then
          if mapNode.getNext() = #none then
            mapNode.finish()
            pUnitMap.poke(point(i, j), #none)
            next repeat
          end if
          mapNode.search(targetTeams, targetList)
        end if
      end repeat
    end if
    j = locXY.locV + shell
    if j <= mapSize.locV then
      repeat with i = locXY.locH - shell to locXY.locH + shell
        if i < 1 then
          next repeat
        end if
        if i > mapSize.locH then
          exit repeat
        end if
        mapNode = pUnitMap.peek(point(i, j))
        if mapNode <> #none then
          if mapNode.getNext() = #none then
            mapNode.finish()
            pUnitMap.poke(point(i, j), #none)
            next repeat
          end if
          mapNode.search(targetTeams, targetList)
        end if
      end repeat
    end if
    i = locXY.locH - shell
    if i >= 1 then
      repeat with j = locXY.locV - shell + 1 to locXY.locV + shell - 1
        if j < 1 then
          next repeat
        end if
        if j > mapSize.locV then
          exit repeat
        end if
        mapNode = pUnitMap.peek(point(i, j))
        if mapNode <> #none then
          if mapNode.getNext() = #none then
            mapNode.finish()
            pUnitMap.poke(point(i, j), #none)
            next repeat
          end if
          mapNode.search(targetTeams, targetList)
        end if
      end repeat
    end if
    i = locXY.locH + shell
    if i <= mapSize.locH then
      repeat with j = locXY.locV - shell + 1 to locXY.locV + shell - 1
        if j < 1 then
          next repeat
        end if
        if j > mapSize.locV then
          exit repeat
        end if
        mapNode = pUnitMap.peek(point(i, j))
        if mapNode <> #none then
          if mapNode.getNext() = #none then
            mapNode.finish()
            pUnitMap.poke(point(i, j), #none)
            next repeat
          end if
          mapNode.search(targetTeams, targetList)
        end if
      end repeat
    end if
    shell = shell + 1
  end repeat
  return targetList
end

on getRoomClear me
  return pRoomClear
end

on setRoomClear me, cleared
  pRoomClear = cleared
end

on setTeamOverride me, theTeam
  pTeamOverride = theTeam
  if pTeamOverride <> #none then
    override = 1
  else
    override = 0
  end if
  g.reservationsMaster.setTeamOverride(override)
end

on finish me
end

on stop me
  me.finish()
end

on update me
  g.gamemaster.teamDied(pTeamThatDied)
  pTeamThatDied = #none
  g.updater.removePrg(me)
end
