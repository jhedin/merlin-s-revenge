on UtilTestFloor
  reps = 10000
  timeS = [:]
  stTime = the milliSeconds
  repeat with i = 1 to reps
    var = VarFloor(3.5)
  end repeat
  fiTime = the milliSeconds
  timeS[#VarFloor] = fiTime - stTime
  stTime = the milliSeconds
  repeat with i = 1 to reps
    var = VarFloorStr(3.5)
  end repeat
  fiTime = the milliSeconds
  timeS[#VarFloorStr] = fiTime - stTime
  stTime = the milliSeconds
  repeat with i = 1 to reps
    var = VarFloorMod(3.5)
  end repeat
  fiTime = the milliSeconds
  timeS[#VarFloorMod] = fiTime - stTime
  repeat with i = 1 to timeS.count
    put timeS.getPropAt(i), ": " && timeS[i]
  end repeat
end
