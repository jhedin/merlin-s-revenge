property ancestor, pInvinceActive, pInvinceLockOn, pTempInvinceCounter, pTempInvinceTime

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
  pInvinceActive = 0
  pInvinceLockOn = 0
  pTempInvinceTime = 200
  pTempInvinceCounter = CounterNew()
  pTempInvinceCounter.tim[2] = pTempInvinceTime
end

on addSaveData me, sd
  ancestor.addSaveData(sd)
  sd[#pInvinceActive] = pInvinceActive
  sd[#pInvinceLockOn] = pInvinceLockOn
  sd[#pTempInvinceCounter] = pTempInvinceCounter
end

on getInvinceActive me
  return pInvinceActive
end

on invinceOn me
  pInvinceActive = 1
  me.id.bigMe.pulseWhite()
end

on invinceOff me
  pInvinceActive = 0
  me.id.bigMe.pulseWhiteStop()
end

on invinceToggle me
  if pInvinceActive then
    me.invinceOff()
    pInvinceLockOn = 0
  else
    me.invinceOn()
    pInvinceLockOn = 1
  end if
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
  pInvinceActive = sd.pInvinceActive
  pInvinceLockOn = sd.pInvinceLockOn
  pTempInvinceCounter = sd.pTempInvinceCounter
end

on startTempInvince me
  CounterReset(pTempInvinceCounter)
  if pInvinceLockOn = 0 then
    me.invinceOn()
  end if
end

on update me
  ancestor.update()
  if pInvinceActive then
    me.updateTempInvince()
  end if
end

on updateTempInvince me
  if pInvinceLockOn = 0 then
    CounterOnce(pTempInvinceCounter)
    if pTempInvinceCounter.fin then
      me.invinceOff()
    end if
  end if
end
