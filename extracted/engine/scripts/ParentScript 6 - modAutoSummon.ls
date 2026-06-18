property ancestor, pArmyMembers
global g

on new me
  ancestor = new(script("modModule"))
  return me
end

on addModParams me
  i = me.modifyParams(#init)
  i[#armyMembers] = []
  ancestor.addModParams()
end

on init me, params
  ancestor.init(params)
  pArmyMembers = params.armyMembers
end

on addSaveData me, sd
  ancestor.addSaveData(sd)
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
end

on summonArmy me
  team = me.big.getTeam()
  availableSlots = g.reservationsMaster.getAvailableSlots(team)
  if availableSlots = 0 then
    return 
  end if
  reserveTeam = g.armyMaster.getReserveArmyTeam(team)
  if (reserveTeam = #none) or (reserveTeam = VOID) then
    return 
  end if
  membersNum = pArmyMembers.count()
  if availableSlots >= membersNum then
    slotsPerUnit = availableSlots / membersNum
  else
    slotsPerUnit = availableSlots / (membersNum - 2)
  end if
  if slotsPerUnit = 0 then
    slotsPerUnit = 1
  end if
  startLoc = g.mouseMaster.getMouseLoc()
  SummonLoc = startLoc
  repeat with typ in pArmyMembers
    if reserveTeam[typ] = VOID then
      exit
    end if
    slotsForTyp = slotsPerUnit
    unitsAvailable = reserveTeam[typ].count()
    if unitsAvailable < slotsForTyp then
      slotsForTyp = unitsAvailable
    end if
    if availableSlots < slotsForTyp then
      slotsForTyp = availableSlots
    end if
    repeat with i = slotsForTyp down to 1
      if availableSlots = 0 then
        exit
      else
        if unitsAvailable = 0 then
          next repeat
        end if
      end if
      SummonLoc.locV = startLoc.locV + random(30) - 15
      SummonLoc.locV = startLoc.locV + random(30) - 15
      unit = g.armyMaster.createUnitNum(team, typ, SummonLoc, unitsAvailable)
      if unit <> #none then
        availableSlots = availableSlots - 1
        unitsAvailable = unitsAvailable - 1
        next repeat
      end if
      exit
    end repeat
    if availableSlots = 0 then
      exit
    end if
  end repeat
  g.armyMaster.displayNextSummons()
end
