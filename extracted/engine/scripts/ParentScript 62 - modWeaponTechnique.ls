property ancestor, pAdditionalFramesCounter, pFrameValue, pWeaponTechnique, pWeaponTechniqueCache, pWeaponTechniqueInc

on new me
  ancestor = new(script("modModule"))
  return me
end

on addModParams me
  i = me.modifyParams(#init)
  i[#weaponTechnique] = 0
  ancestor.addModParams()
end

on init me, params
  ancestor.init(params)
  pAdditionalFramesCounter = CounterNew()
  pAdditionalFramesCounter.tim[2] = 1
  pFrameValue = 100
  pWeaponTechnique = params.weaponTechnique
  pWeaponTechniqueCache = 0
  pWeaponTechniqueInc = 2
end

on addFramesForWeaponTechnique me
  repeat while pWeaponTechniqueCache < (pFrameValue * -1)
    delayAmount = 1
    me.big.frameExtendDelay(delayAmount)
    pAdditionalFramesCounter.tim[2] = pAdditionalFramesCounter.tim[2] + 1
    pWeaponTechniqueCache = pWeaponTechniqueCache + pFrameValue
  end repeat
end

on addSaveData me, sd
  ancestor.addSaveData(sd)
  me.addToSaveData(sd)
end

on addToArmyDetails me
  ad = me.big.getArmyDetails()
  me.addToSaveData(ad)
end

on addToSaveData me, sd
  sd[#pWeaponTechnique] = pWeaponTechnique
end

on exchangeWeaponTechniqueForFrames me
  if pWeaponTechniqueCache > pFrameValue then
    me.skipFramesForWeaponTechnique()
  end if
  if pWeaponTechniqueCache < (pFrameValue * -1) then
    me.addFramesForWeaponTechnique()
  end if
end

on internalEvent me, theEvent
  ancestor.internalEvent(theEvent)
  case theEvent of
    #addToArmyDetails:
      me.addToArmyDetails()
    #levelUp:
      me.increaseWeaponTechnique()
    #restoreFromArmyDetails:
      me.restoreFromArmyDetails()
  end case
end

on increaseWeaponTechnique me
  pWeaponTechnique = pWeaponTechnique + pWeaponTechniqueInc
end

on increaseWeaponTechniqueCache me
  pWeaponTechniqueCache = pWeaponTechniqueCache + pWeaponTechnique
end

on restoreFromArmyDetails me
  ad = me.big.getArmyDetails()
  me.restoreFromSaveData(ad)
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
  me.restoreFromSaveData(sd)
end

on restoreFromSaveData me, sd
  pWeaponTechnique = sd.pWeaponTechnique
end

on skipFramesForWeaponTechnique me
  repeat while pWeaponTechniqueCache > pFrameValue
    me.big.internalEvent(#attackFrameSkipped)
    me.big.frameAdvance()
    pWeaponTechniqueCache = pWeaponTechniqueCache - pFrameValue
  end repeat
end

on update me
  ancestor.update()
  aiMode = me.big.getAI().getMode()
  case aiMode of
    #attack:
      me.updateWeaponTechnique()
  end case
end

on updateWeaponTechnique me
  if pAdditionalFramesCounter.fin then
    pAdditionalFramesCounter.tim[2] = 1
    CounterReset(pAdditionalFramesCounter)
    me.increaseWeaponTechniqueCache()
    me.exchangeWeaponTechniqueForFrames()
  else
    CounterOnce(pAdditionalFramesCounter)
  end if
end
