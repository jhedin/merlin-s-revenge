property ancestor, pIsBuilt, pPercentToAddPerFrame, pPreBuilt

on new me
  ancestor = new(script("modModule"))
  return me
end

on addModParams me
  i = me.modifyParams(#init)
  i[#preBuilt] = 1
  ancestor.addModParams()
end

on init me, params
  ancestor.init(params)
  pIsBuilt = 0
  pPercentToAddPerFrame = 0
  pPreBuilt = params.preBuilt
end

on addSaveData me, sd
  ancestor.addSaveData(sd)
  sd[#pIsBuilt] = pIsBuilt
  sd[#pPercentToAddPerFrame] = pPercentToAddPerFrame
end

on advanceBuildFrame me
  me.big.frameAdvance()
  me.big.increaseEnergyByPercentage(pPercentToAddPerFrame)
  if me.big.getAnimLooped() then
    me.buildingFinished()
  end if
end

on buildingFinished me
  pIsBuilt = 1
  me.big.setMode(#stand)
  me.big.unpauseAnim()
  me.big.internalEvent(#buildingFinished)
  me.eventNotify(#buildingFinished)
end

on isUnfinishedBuilding me
  if pIsBuilt = 1 then
    return 0
  else
    return 1
  end if
end

on outOfEnergy me
  ancestor.outOfEnergy()
  me.big.unpauseAnim()
end

on goMode me, newMode
  case newMode of
    #beBuilt:
      me.startBeBuilt()
  end case
  ancestor.goMode(newMode)
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
  pIsBuilt = sd.pIsBuilt
  pPercentToAddPerFrame = sd.pPercentToAddPerFrame
end

on startBeBuilt me
  me.big.pauseAnim()
  me.big.setEnergy(1)
  lengthOfBuildAnim = me.big.getNoOfFramesInStrip(#beBuilt)
  pPercentToAddPerFrame = varPercent(1, [0, lengthOfBuildAnim])
end

on startBuilding me
  if pPreBuilt then
    me.buildingFinished()
  else
    me.big.goMode(#beBuilt)
  end if
end
