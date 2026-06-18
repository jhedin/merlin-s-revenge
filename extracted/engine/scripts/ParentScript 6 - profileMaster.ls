property pLastStarted, pMinTime, pMinTimeProfile, pReportTitle, pProfiles
global g

on new me
  return me
end

on init me
  pLastStarted = #none
  pMinTime = 0
  pMinTimeProfile = 1
  pReportTitle = "Timing Report"
  pProfiles = [:]
end

on finish me
end

on f me, profile
  me.stopProfile(profile)
end

on t me, newTitle
  me.setTitle(newTitle)
end

on s me, profile
  me.startProfile(profile)
end

on w me
  me.writeReport()
end

on setMinTime me, newTime, profile
  if profile = VOID then
    profile = 1
  end if
  pMinTime = newTime
  pMinTimeProfile = profile
end

on setReportTitle me, newVal
  me.init()
  pReportTitle = newVal
end

on setTitle me, newVal
  me.setReportTitle(newVal)
end

on start me
end

on startProfile me, profile
  if pProfiles[profile] = VOID then
    newProfile = g.structMaster.getStruct(#timerProfile)
    pProfiles[profile] = newProfile
  end if
  pProfiles[profile].stTime = the milliSeconds
  pLastStarted = profile
end

on stopProfile me, profile
  if profile = VOID then
    profile = pLastStarted
  end if
  theP = pProfiles[profile]
  theP.finTime = the milliSeconds
  theP.totalTime = theP.totalTime + (theP.finTime - theP.stTime)
end

on writeReport me
  if pProfiles[pMinTimeProfile].totalTime < pMinTime then
    return 
  end if
  put "<" & pReportTitle & ">"
  repeat with i = 1 to pProfiles.count
    nProfile = pProfiles.getPropAt(i)
    nTime = pProfiles[i].totalTime
    put nProfile & " = " & nTime
  end repeat
  put "</" & pReportTitle & ">"
  put EMPTY
end

on stop me
  me.finish()
end
