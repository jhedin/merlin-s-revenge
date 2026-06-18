property pTeams, pDebug, pReservations, pTeamOverride

on new me
  return me
end

on init me
  pTeams = [:]
  pDebug = 0
  pReservations = []
end

on cancelReservation me, obj
  reservation = me.getReservationForObj(obj)
  if reservation = #none then
    return 
  end if
  team = me.getTeamForObj(obj)
  team.reservedSlots = team.reservedSlots - reservation.num
  pReservations.deleteOne(reservation)
end

on cancelReservationTeam me, obj, team
  reservation = me.getReservationForObj(obj)
  if reservation = #none then
    return 
  end if
  if (team <> VOID) and (team <> #none) then
    team.reservedSlots = team.reservedSlots - reservation.num
  end if
  pReservations.deleteOne(reservation)
end

on getAvailableSlots me, teamSym
  team = pTeams[teamSym]
  return team.maxMembers - team.currentMembers - team.reservedSlots
end

on getPermissionToRelease me, obj, numToRelease
  permission = 0
  teamName = obj.getTeam()
  team = pTeams[teamName]
  maxMembers = team.maxMembers
  if pTeamOverride and (maxMembers > 5) then
    maxMembers = maxMembers / 2
  end if
  if (team.currentMembers + team.reservedSlots + numToRelease) <= maxMembers then
    permission = 1
    team.reservedSlots = team.reservedSlots + numToRelease
    me.makeReservation(obj, numToRelease)
    me.printReport(team)
  end if
  return permission
end

on getPermissionToReleaseTeam me, obj, numToRelease, team
  permission = 0
  teamName = team.teamName
  if pTeams[teamName] = VOID then
    team[#currentMembers] = 0
    team[#reservedSlots] = 0
    pTeams[teamName] = team
  end if
  team = pTeams[teamName]
  maxMembers = team.maxMembers
  if pTeamOverride and (maxMembers > 5) then
    maxMembers = maxMembers / 2
  end if
  if (team.currentMembers + team.reservedSlots + numToRelease) <= maxMembers then
    permission = 1
    team.reservedSlots = team.reservedSlots + numToRelease
    me.makeReservation(obj, numToRelease)
    me.printReport(team)
  end if
  return permission
end

on getReservationForObj me, obj
  reservationPos = ListGetPosByProp(pReservations, #obj, obj)
  if reservationPos = 0 then
    return #none
  end if
  reservation = pReservations[reservationPos]
  return reservation
end

on getTeamForObj me, obj
  teamName = obj.getTeam()
  team = pTeams[teamName]
  return team
end

on makeReservation me, obj, num
  newRes = [#obj: obj, #num: num]
  pReservations.append(newRes)
end

on objectJoined me, team, teamRole, obj
  teamName = team.teamName
  if pTeams[teamName] = VOID then
    pTeams[teamName] = team
    team[#currentMembers] = 0
    team[#reservedSlots] = 0
  end if
  if teamRole = #teamMembers then
    team.currentMembers = team.currentMembers + 1
    me.printReport(team)
  end if
end

on objectLeft me, team, teamRole, obj
  if teamRole <> #teamMembers then
    return 
  end if
  team.currentMembers = team.currentMembers - 1
  me.printReport(team)
end

on objectReleasedFromReservation me, obj
  team = me.getTeamForObj(obj)
  team.reservedSlots = team.reservedSlots - 1
  reservation = me.getReservationForObj(obj)
  reservation.num = reservation.num - 1
  if reservation.num < 1 then
    pReservations.deleteOne(reservation)
  end if
end

on objectReleasedFromReservationTeam me, obj, theTeam
  theTeam.reservedSlots = theTeam.reservedSlots - 1
  reservation = me.getReservationForObj(obj)
  reservation.num = reservation.num - 1
  if reservation.num < 1 then
    pReservations.deleteOne(reservation)
  end if
end

on printReport me, team
  if pDebug then
    put "Team " & team.teamName & " : " & team.currentMembers & " mems, " & team.reservedSlots & " res, " & team.maxMembers & " max."
  end if
end

on setTeamOverride me, theState
  pTeamOverride = theState
end

on start me
  nothing()
end

on stop me
  nothing()
end
