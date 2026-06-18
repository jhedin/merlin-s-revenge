property pCurrentTotals, pMaxNumbers, pReservations, pReservedTotals
global g, gMaxEnemies, gMaxFriends, gMaxNeutrals

on new me
  return me
end

on init me
  pCurrentTotals = g.structMaster.getStruct(#teamCategories)
  pMaxNumbers = g.structMaster.getStruct(#teamCategories)
  pReservations = [:]
  pReservedTotals = g.structMaster.getStruct(#teamCategories)
  me.initMaxNumbers()
end

on initMaxNumbers me
  mn = pMaxNumbers
  mn.enemies = gMaxEnemies
  mn.friends = gMaxFriends
  mn.neutrals = gMaxNeutrals
end

on finish me
end

on countReservations me, typ
  total = 0
  repeat with res in pReservations[typ]
    total = total + res.num
  end repeat
  return total
end

on cancelReservation me, obj
  typ = obj.getResidentTeamCategory()
  if pReservations[typ] = VOID then
    return 
  end if
  pos = me.getReservationPos(obj)
  if pos > 0 then
    res = pReservations[typ][pos]
    pReservedTotals[typ] = pReservedTotals[typ] - res.num
    pReservations[typ].deleteAt(pos)
  end if
end

on getPermissionToRelease me, obj, numToRelease
  permission = 0
  typ = obj.getResidentTeamCategory()
  if (pCurrentTotals[typ] + pReservedTotals[typ] + numToRelease) <= pMaxNumbers[typ] then
    permission = 1
    me.makeReservation(obj, numToRelease)
  end if
  return permission
end

on getReservationPos me, obj
  typ = obj.getResidentTeamCategory()
  pos = ListGetPosByProp(pReservations[typ], #obj, obj)
  return pos
end

on makeReservation me, obj, numOfReservations
  newReservation = g.structMaster.getStruct(#reservation)
  newReservation.obj = obj
  newReservation.num = numOfReservations
  newReservation.typ = obj.getResidentTeamCategory()
  typ = newReservation.typ
  if pReservations[typ] = VOID then
    pReservations[typ] = []
  end if
  pReservations[typ].append(newReservation)
  pReservedTotals[typ] = pReservedTotals[typ] + numOfReservations
end

on objectIsValid me, teamRole, obj
  valid = 0
  if teamRole = #teamMembers then
    if obj.hasFlag(#objCharacter) then
      valid = 1
    end if
  end if
  return valid
end

on objectJoined me, theTeam, teamRole, obj
  if me.objectIsValid(teamRole, obj) then
    pCurrentTotals[theTeam.category] = pCurrentTotals[theTeam.category] + 1
  end if
end

on objectLeft me, theTeam, teamRole, obj
  if me.objectIsValid(teamRole, obj) then
    pCurrentTotals[theTeam.category] = pCurrentTotals[theTeam.category] - 1
  end if
end

on objectReleasedFromReservation me, obj
  typ = obj.getResidentTeamCategory()
  resPos = me.getReservationPos(obj)
  if resPos = 0 then
    return 
  end if
  res = pReservations[typ][resPos]
  objobj = 0
  if res.obj = obj then
    objobj = 1
    pReservedTotals[typ] = pReservedTotals[typ] - 1
    res.num = res.num - 1
    if res.num = 0 then
      pReservations[typ].deleteAt(resPos)
    end if
  else
    put "reservationsMaster.objectReleasedFromReservation(): Error, object should not have released!"
    MovieGoDebug()
  end if
end

on roomClear me
  if pReservedTotals[#enemies] <> 0 then
    nothing()
  else
    put "no enemy reservations"
  end if
end

on start me
end

on stop me
  me.finish()
end
