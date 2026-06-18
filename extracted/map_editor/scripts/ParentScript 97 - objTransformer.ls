property ancestor, pCurr, pTarget, pCallingPrg, pFin, pInitialValue, pPingPong, pSpeed
global gGameSpeed

on new me
  me.ancestor = new(script("objAutoUpdate"))
  i = me.modifyParams(#init)
  i[#callingPrg] = #none
  i[#initialValue] = #none
  i[#pingpong] = 0
  i[#speed] = 10 * gGameSpeed
  i[#targetValue] = #none
  return me
end

on init me, params
  me.ancestor.init(params)
  pCurr = params.initialValue
  pInitialValue = params.initialValue
  pTarget = params.targetValue
  pCallingPrg = params.callingPrg
  pFin = 0
  pPingPong = params.pingpong
  pSpeed = params.speed
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

on informCallingPrg me
  pCallingPrg.transformFin()
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
  pCurr = VarToward(pCurr, pTarget, pSpeed)
  me.id.bigMe.updateAttribute()
  me.calcFin()
end
