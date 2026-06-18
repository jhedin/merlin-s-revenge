property ancestor, pCurr, pFirstFrame, pTarget, pCallingPrg, pCallingPrgHistory, pFin, pInitialValue, pPingPong, pSpeed
global gGameSpeed

on new me
  me.ancestor = new(script("objAutoUpdate"))
  i = me.modifyParams(#init)
  i.callingPrgMessage = #transformFin
  i[#callingPrg] = #none
  i[#initialValue] = #none
  i[#pingpong] = 0
  i[#speed] = 10 * gGameSpeed
  i[#targetValue] = #none
  pCallingPrgHistory = []
  return me
end

on init me, params
  me.ancestor.init(params)
  pCurr = params.initialValue
  pInitialValue = params.initialValue
  pTarget = params.targetValue
  pCallingPrg = params.callingPrg
  pFin = 0
  pFirstFrame = 1
  pPingPong = params.pingpong
  pSpeed = params.speed
end

on addSaveData me, sd
  sd[#pCurr] = pCurr
  sd[#pFin] = pFin
  sd[#pFirstFrame] = pFirstFrame
  sd[#pInitialValue] = pInitialValue
  sd[#pPingPong] = pPingPong
  sd[#pSpeed] = pSpeed
  sd[#pTarget] = pTarget
  ancestor.addSaveData(sd)
end

on finishConditionMet me
  if pPingPong then
    if pCurr = pTarget then
      pTarget = pInitialValue
      pInitialValue = pCurr
    end if
  else
    return pCurr = pTarget
  end if
end

on isFirstFrame me
  first = pFirstFrame
  pFirstFrame = 0
  return first
end

on getCallingPrg me
  return pCallingPrg
end

on restoreFromSave me, sd
  pCurr = sd.pCurr
  pFin = sd.pFin
  pFirstFrame = sd.pFirstFrame
  pInitialValue = sd.pInitialValue
  pPingPong = sd.pPingPong
  pSpeed = sd.pSpeed
  pTarget = sd.pTarget
  ancestor.restoreFromSave(sd)
end

on setCallingPrg me, callingPrg
  pCallingPrg = callingPrg
end

on setCurrent me, curr
  pCurr = curr
  me.calcFin()
  me.calcStart()
end

on setTarget me, targ
  pTarget = targ
  me.calcFin()
  me.calcStart()
end

on setSpeed me, speed
  pSpeed = speed * gGameSpeed
end

on update me
  if me.isFirstFrame() then
    me.id.bigMe.updateAttribute()
    return 
  end if
  pCurr = VarToward(pCurr, pTarget, pSpeed)
  me.id.bigMe.updateAttribute()
  me.calcFin()
end
