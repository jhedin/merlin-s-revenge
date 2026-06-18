property ancestor, pChargeMode, pCurrentPayload, pCurrentPayloadNum, pPayloadFunctionBlank, pPayloadFunctionNonBlank, pResidentTeamCategory, pSpellIcons, pSpellName, pSpellPayloads, pExperienceGain, pTopAvailable
global g

on new me
  ancestor = new(script("modModule"))
  return me
end

on addModParams me
  i = me.modifyParams(#init)
  ancestor.addModParams()
end

on init me, params
  ancestor.init(params)
  pChargeMode = #none
  pCurrentPayload = #none
  pCurrentPayloadNum = 0
  pResidentTeamCategory = #none
  pSpellIcons = #none
  pSpellPayloads = []
  pExperienceGain = 0.5
  pTopAvailable = 1
end

on finish me
  ancestor.finish()
  me.finishSpellIcons()
  if me.big.getTeam() = #aldevar then
    team = g.teamMaster.pTeams[pResidentTeamCategory]
    g.reservationsMaster.cancelReservationTeam(me.big, team)
  else
    g.reservationsMaster.cancelReservation(me.big)
  end if
end

on finishSpellIcons me
  if pSpellIcons <> #none then
    pSpellIcons.finish()
    pSpellIcons = #none
  end if
end

on addSaveData me, sd
  ancestor.addSaveData(sd)
  sd[#pCurrentPayload] = pCurrentPayload
  sd[#pCurrentPayloadNum] = pCurrentPayloadNum
end

on chargeMultistage me
  me.selectPayload()
  if me.big.getAttack().explodeFunction = #summonUnit then
    me.obtainPermissionOrHalt()
  end if
  me.displayIcon()
end

on chargeReinIn me
  me.big.setCurrentCharge(pSpellPayloads[1].chargeRequired - 1)
  me.big.getAttack().payLoadFunction = [pPayloadFunctionBlank]
  me.selectPayload()
  me.eventNotify(#chargeLimited)
end

on chargeReinInToAvailable me
  me.big.setCurrentCharge(pSpellPayloads[pTopAvailable + 1].chargeRequired - 0.10000000000000001)
  me.big.getAttack().payLoadFunction = [pPayloadFunctionBlank]
  me.selectPayload()
  me.eventNotify(#chargeLimited)
end

on convertToPayloads me, multiStageData
  if multiStageData = #none then
    return []
  end if
  spellPayloads = []
  i = 1
  repeat with stageData in multiStageData
    spellPayload = g.structMaster.getStruct(#spellPayload)
    spellPayload.chargeRequired = stageData
    spellPayload.payload = multiStageData.getPropAt(i)
    i = i + 1
    spellPayloads.append(spellPayload)
  end repeat
  return spellPayloads
end

on depositMines me
  charge = me.big.getCharge()
  numMines = charge / me.big.getAttack().chargePerUnit
  possibleDistance = charge / 2
  repeat with i = 1 to numMines
    myloc = me.big.getLoc()
    mineLoc = myloc.duplicate()
    mineLoc.locH = VarRoughly(mineLoc.locH, possibleDistance)
    mineLoc.locV = VarRoughly(mineLoc.locV, possibleDistance)
    params = g.actorMaster.getParams(#newActor)
    params.typ = #energyMine
    params.startLoc = mineLoc
    params.useOffset = 0
    mine = g.actorMaster.newActor(params)
    if mine <> #none then
      mine.setOwner(me.getOwner())
    end if
  end repeat
end

on displayIcon me
  if pCurrentPayloadNum > 0 then
    me.ensureSpellIcons()
    unitAvailable = g.armyMaster.checkUnitAvailability(me.big)
    pSpellIcons.displayIconNumber(pCurrentPayloadNum, unitAvailable)
  end if
end

on doExplodeFunction me
  case me.big.getAttack().explodeFunction of
    #depositMines:
      me.big.depositMines()
    #summonUnit:
      me.summonPayload()
  end case
end

on ensureSpellIcons me
  if pSpellIcons = #none then
    pSpellIcons = g.objectMaster.requestObject(#objSpellIcons)
    params = pSpellIcons.getParams(#init)
    params.spellStrip = pSpellName
    params.spellToAttachTo = me.big
    pSpellIcons.init(params)
  end if
end

on eventNotification me, theEvent, theObj
  ancestor.eventNotification(theEvent, theObj)
  case theEvent of
    #enteringNewRoom:
      owner = me.big.getOwner()
      if owner = theObj then
        me.reobtainPermission()
      end if
  end case
end

on getPayload me
  return pCurrentPayload
end

on getResidentTeamCategory me
  return pResidentTeamCategory
end

on internalEvent me, theEvent
  ancestor.internalEvent(theEvent)
  case theEvent of
    #charge:
      me.chargeMultistage()
    #explode:
      if pSpellIcons <> #none then
        pSpellIcons.explode()
      end if
      me.doExplodeFunction()
    #restoredFromSave:
      me.obtainPermissionOrHalt()
      me.selectPayload()
      me.displayIcon()
    #registerForEvents:
      me.registerForEvents()
    #spellPropertiesSet:
      me.setMultiStageProperties()
  end case
end

on obtainPermissionOrHalt me
  if (pChargeMode = #none) and (pCurrentPayloadNum >= 1) then
    pChargeMode = #askPermission
  end if
  if pChargeMode = #askPermission then
    numToRelease = 1
    if me.big.getTeam() = #aldevar then
      team = g.teamMaster.pTeams[pResidentTeamCategory]
      Ok = g.reservationsMaster.getPermissionToReleaseTeam(me.big, numToRelease, team)
      me.updateAvailableUnits()
    else
      Ok = g.reservationsMaster.getPermissionToRelease(me.big, numToRelease)
    end if
    if Ok then
      pChargeMode = #okToSummon
    else
      me.chargeReinIn()
    end if
  end if
  if (me.big.getAttack().name = #armySummon) and (pTopAvailable < pSpellPayloads.count) then
    if (pTopAvailable <> 0) and (pCurrentPayloadNum <> 0) then
      if (pSpellPayloads[pCurrentPayloadNum].chargeRequired - pSpellPayloads[pTopAvailable].chargeRequired) >= 0 then
        me.chargeReinInToAvailable()
      end if
    else
      if pCurrentPayloadNum <> 0 then
        me.chargeReinInToAvailable()
      end if
    end if
  end if
end

on registerForEvents me
  owner = me.big.getOwner()
  me.big.keepMePosted(owner, #enteringNewRoom, #always)
end

on reobtainPermission me
  pChargeMode = #none
  me.finishSpellIcons()
  me.obtainPermissionOrHalt()
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
  pCurrentPayload = sd.pCurrentPayload
  pCurrentPayloadNum = sd.pCurrentPayloadNum
  me.updateAvailableUnits()
end

on selectPayload me
  charge = me.big.getCharge()
  pCurrentPayload = #none
  pCurrentPayloadNum = 0
  i = 1
  repeat with spellPayload in pSpellPayloads
    if spellPayload.chargeRequired <= charge then
      pCurrentPayload = spellPayload.payload
      pCurrentPayloadNum = i
    else
      exit repeat
    end if
    i = i + 1
  end repeat
  if pCurrentPayload <> #none then
    me.big.getAttack().payLoadFunction = [pPayloadFunctionNonBlank]
  end if
end

on selectLastPayload me
  if (pCurrentPayloadNum > 1) and (pCurrentPayloadNum <> 0) then
    pCurrentPayloadNum = pCurrentPayloadNum - 1
    pCurrentPayload = pSpellPayloads[pCurrentPayloadNum].payloaf
  else
    pCurrentPayload = #none
  end if
  if pCurrentPayload <> #none then
    me.big.getAttack().payLoadFunction = [pPayloadFunctionNonBlank]
  end if
end

on setMultiStageProperties me
  params = me.big.getSpellProperties()
  attack = params.attack
  pPayloadFunctionBlank = attack.payLoadFunction
  pPayloadFunctionNonBlank = attack.payloadFunctionNonBlank
  pResidentTeamCategory = attack.residentTeamCategory
  pSpellName = attack.name
  pSpellPayloads = me.convertToPayloads(attack.multistage)
  if pPayloadFunctionNonBlank = #same then
    pPayloadFunctionNonBlank = attack.payLoadFunction
  end if
end

on summonPayload me
  if pCurrentPayload = #none then
    return 
  end if
  g.armyMaster.createUnitFromSummonSpell(me.big)
  if (me.big.getTeam() = #aldevar) and (pSpellName <> #armySummon) then
    team = g.teamMaster.pTeams[pResidentTeamCategory]
    g.reservationsMaster.objectReleasedFromReservationTeam(me.big, team)
  else
    g.reservationsMaster.objectReleasedFromReservation(me.big)
  end if
  owner = me.big.getOwner()
  if owner <> #none then
    owner.gainExperience(pExperienceGain)
  end if
end

on updateAvailableUnits me
  repeat with pTopAvailable = pSpellPayloads.count down to 1
    available = g.armyMaster.lookupArmyDetails(me.big.getTeam(), pSpellPayloads[pTopAvailable].payload)
    if available <> #none then
      pTopAvailable = pTopAvailable
      exit repeat
    end if
  end repeat
end
