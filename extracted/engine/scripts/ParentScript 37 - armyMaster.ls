property pDisplayRect, pLevelBar, pReserveArmy, pSpriteMembers, pTeamToDisplay, pTitle, pTitleText, pYGap, pRestoreList
global g, gGlobalDisplayLayer

on new me
  return me
end

on init me
  pDisplayRect = #none
  pLevelBar = #none
  pReserveArmy = [:]
  pSpriteMembers = []
  pTeamToDisplay = #aldevar
  pTitle = #none
  pTitleText = "NEXT"
  pYGap = 4
end

on finish me
  if (ilk(pLevelBar) <> #void) and (pLevelBar <> #none) then
    pLevelBar.finish()
    pLevelBar = #none
  end if
  if (ilk(pTitle) <> #void) and (pTitle <> #none) then
    pTitle.finish()
    pTitle = #none
  end if
  me.finishSpriteMembers()
end

on finishSpriteMembers me
  if ilk(pSpriteMembers) <> #void then
    repeat with sprMem in pSpriteMembers
      sprMem.finish()
    end repeat
  end if
  pSpriteMembers = []
end

on addSaveData me, sd
  sd[#pReserveArmy] = pReserveArmy
end

on clearArmy me
  pReserveArmy = [:]
end

on checkUnitAvailability me, summonSpell
  unitAvailable = 1
  if summonSpell.pSpellProperties.attack.name = #armySummon then
    team = summonSpell.getTeam()
    typ = summonSpell.getPayload()
    armyDetails = me.lookupArmyDetails(team, typ)
    if armyDetails = #none then
      unitAvailable = 0
    end if
  end if
  return unitAvailable
end

on createUnit me, team, typ, startLoc, spellName
  armyDetails = me.lookupArmyDetails(team, typ)
  if (spellName = #armySummon) and (armyDetails = #none) then
    return #none
  end if
  params = g.actorMaster.getParams(#newActor)
  params.typ = typ
  params.startLoc = startLoc
  params.useOffset = 0
  newActor = g.actorMaster.newActor(params)
  if newActor <> #none then
    if armyDetails <> #none then
      newActor.restoreArmyDetails(armyDetails)
      newActor.armyTeleportIn()
      armyDetails = me.restoreUnitToCombat(team, typ)
      me.displayNextSummons()
    end if
  end if
  return newActor
end

on createUnitNum me, team, typ, startLoc, num
  armyDetails = pReserveArmy[team][typ][num]
  params = g.actorMaster.getParams(#newActor)
  params.typ = typ
  params.startLoc = startLoc
  params.useOffset = 0
  newActor = g.actorMaster.newActor(params)
  if newActor <> #none then
    if armyDetails <> #none then
      newActor.restoreArmyDetails(armyDetails)
      newActor.armyTeleportIn()
      armyDetails = me.restoreUnitToCombatNum(team, typ, num)
    end if
  end if
  return newActor
end

on createUnitFromSummonSpell me, summonSpell
  team = summonSpell.getTeam()
  typ = summonSpell.getPayload()
  startLoc = summonSpell.getLoc()
  spellName = summonSpell.pSpellProperties.attack.name
  me.createUnit(team, typ, startLoc, spellName)
end

on displayNextSummons me
  me.finishSpriteMembers()
  yLoc = pDisplayRect.top
  me.displayTitle(yLoc)
  yLoc = yLoc + pTitle.getImageHeight() + pYGap
  army = pReserveArmy[pTeamToDisplay]
  if army = VOID then
    return 
  end if
  repeat with unitList in army
    pos = ListGetPosOfMaxByProp(unitList, #pExperienceLevel)
    if pos = #none then
      next repeat
    end if
    unitToDisplay = unitList[pos]
    newSprMem = me.newSprMem()
    unitLevel = unitToDisplay.pExperienceLevel
    starsImage = pLevelBar.drawStarsImage(unitLevel)
    newSprMem.displayImageAtLoc(starsImage, point(pDisplayRect.left, yLoc))
    newSprMem.centerAlign(pDisplayRect.left, pDisplayRect.right)
    pSpriteMembers.append(newSprMem)
    yLoc = yLoc + starsImage.height + pLevelBar.getYGap()
    newSprMem = me.newSprMem()
    unitImage = unitToDisplay.member.image
    newSprMem.displayImageAtLoc(unitImage, point(pDisplayRect.left, yLoc))
    newSprMem.setSpriteFlipFromDir(-1)
    newSprMem.setSpriteHeight(unitToDisplay.height)
    newSprMem.setSpriteWidth(unitToDisplay.width)
    newSprMem.centerAlign(pDisplayRect.left, pDisplayRect.right)
    pSpriteMembers.append(newSprMem)
    yLoc = yLoc + unitToDisplay.height + pYGap
  end repeat
end

on displayTitle me, yLoc
  x1 = pDisplayRect.left
  x2 = pDisplayRect.right
  pTitle.displayCentered(x1, x2, yLoc)
end

on ensureLists me, team, typ
  if pReserveArmy[team] = VOID then
    pReserveArmy[team] = [:]
  end if
  teamList = pReserveArmy[team]
  if teamList[typ] = VOID then
    teamList[typ] = []
  end if
end

on getLevelBar me
  return pLevelBar
end

on getReserveArmy me
  return pReserveArmy
end

on getReserveArmyTeam me, team
  return pReserveArmy[team]
end

on getTeamToDisplay me
  return pTeamToDisplay
end

on isMenuItemShadowed me, theComm
  case theComm of
    #showArmy:
      return pReserveArmy = [:]
  end case
end

on lookupArmyDetails me, team, typ
  armyDetails = #none
  me.ensureLists(team, typ)
  unitList = pReserveArmy[team][typ]
  pos = ListGetPosOfMaxByProp(unitList, #pExperienceLevel)
  if pos <> #none then
    armyDetails = unitList[pos]
  end if
  return armyDetails
end

on newSprMem me
  newSprMem = g.objectMaster.requestObject(#objSpriteMember)
  params = newSprMem.getParams(#init)
  params.layer = gGlobalDisplayLayer
  newSprMem.init(params)
  return newSprMem
end

on recordUnitDetails me, obj
  armyDetails = obj.generateArmyDetails()
  standMember = obj.getAnimMemberFromStrip(#stand)
  armyDetails[#height] = standMember.height
  armyDetails[#member] = standMember
  armyDetails[#width] = standMember.width
  me.ensureLists(armyDetails.pTeam, armyDetails.pActorType)
  teamList = pReserveArmy[armyDetails.pTeam]
  teamList[armyDetails.pActorType].append(armyDetails)
  me.displayNextSummons()
end

on restoreFromSave me, sd
  pReserveArmy = sd.pReserveArmy
  me.displayNextSummons()
end

on restoreUnitToCombat me, team, typ
  armyDetails = #none
  me.ensureLists(team, typ)
  unitList = pReserveArmy[team][typ]
  pos = ListGetPosOfMaxByProp(unitList, #pExperienceLevel)
  if pos <> #none then
    armyDetails = unitList[pos]
    unitList.deleteAt(pos)
  end if
  return armyDetails
end

on restoreUnitToCombatNum me, team, typ, num
  armyDetails = #none
  me.ensureLists(team, typ)
  unitList = pReserveArmy[team][typ]
  if (unitList[num] <> #none) and (unitList[num] <> #void) then
    armyDetails = unitList[num]
    unitList.deleteAt(num)
  end if
  return armyDetails
end

on start me, theloc, theMark
  pDisplayRect = RectCalcFromMark(theMark)
  me.startLevelBar()
  me.startTitle()
end

on startLevelBar me
  pLevelBar = g.objectMaster.requestObject(#objMoveableLevelBar)
  params = pLevelBar.getParams(#init)
  pLevelBar.init(params)
end

on startTitle me
  pTitle = g.objectMaster.requestObject(#objTextImage)
  params = pTitle.getParams(#init)
  params.colour = rgb(0, 0, 0)
  params.font = #smallgrey
  params.text = pTitleText
  pTitle.init(params)
end

on stop me
  me.finish()
end
