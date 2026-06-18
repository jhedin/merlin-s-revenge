property ancestor, pHealAmount, pHealDelayCounter, pRemainingHitpoints, pMedikitActive, pNumOfMedikits, pUpdateMedikitDisplay
global g

on new me
  ancestor = new(script("modModule"))
  return me
end

on addModParams me
  i = me.modifyParams(#init)
  i[#updateMedikitDisplay] = 1
  ancestor.addModParams()
end

on init me, params
  ancestor.init(params)
  pHealAmount = 1
  pHealDelayCounter = CounterNew()
  pHealDelayCounter.tim[2] = 5
  pRemainingHitpoints = 0
  pNumOfMedikits = 0
  pUpdateMedikitDisplay = params.updateMedikitDisplay
end

on addSaveData me, sd
  ancestor.addSaveData(sd)
  sd[#pHealDelayCounter] = pHealDelayCounter
  sd[#pRemainingHitpoints] = pRemainingHitpoints
  sd[#pMedikitActive] = pMedikitActive
  sd[#pNumOfMedikits] = pNumOfMedikits
  sd[#pUpdateMedikitDisplay] = pUpdateMedikitDisplay
end

on attemptHeal me
  counter(pHealDelayCounter)
  if pHealDelayCounter.fin then
    if pRemainingHitpoints > 0 then
      pRemainingHitpoints = pRemainingHitpoints - pHealAmount
      me.id.bigMe.addToEnergy(pHealAmount)
      pMedikitActive = 1
      me.updateMedikitDisplay()
    else
      pMedikitActive = 0
      me.nextMedikit()
      me.updateMedikitDisplay()
    end if
  end if
end

on getMedikitActive me
  return pMedikitActive
end

on getMedikitRemainingHitpoints me
  return pRemainingHitpoints
end

on getMedikitMaxHitpoints me
  return me.id.bigMe.getMaxEnergy()
end

on getNumOfMedikits me
  numOfMedikits = pNumOfMedikits
  if pRemainingHitpoints > 0 then
    numOfMedikits = numOfMedikits + 1
  end if
  return numOfMedikits
end

on nextMedikit me
  if pNumOfMedikits > 0 then
    pNumOfMedikits = pNumOfMedikits - 1
    pRemainingHitpoints = me.getMedikitMaxHitpoints()
    pMedikitActive = 1
  end if
end

on medikitCollected me
  pNumOfMedikits = pNumOfMedikits + 1
  me.updateMedikitDisplay()
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
  pHealDelayCounter = sd.pHealDelayCounter
  pRemainingHitpoints = sd.pRemainingHitpoints
  pMedikitActive = sd.pMedikitActive
  pNumOfMedikits = sd.pNumOfMedikits
  pUpdateMedikitDisplay = sd.pUpdateMedikitDisplay
  me.updateMedikitDisplay()
end

on update me
  ancestor.update()
  if me.id.bigMe.checkEnergyIsAtMax() = 0 then
    me.attemptHeal()
  else
    pMedikitActive = 0
    me.updateMedikitDisplay()
  end if
end

on updateMedikitDisplay me
  if pUpdateMedikitDisplay then
    g.medikitMaster.updateDisplay(me.id.bigMe)
  end if
end
