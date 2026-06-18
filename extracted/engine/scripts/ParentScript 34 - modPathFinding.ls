property ancestor, pPathFindingCounter, pPathFindingDistance, pPathFindingLoc, pPathFindingMode, pStallCounter, pTargetLoc
global g

on new me
  ancestor = new(script("modModule"))
  return me
end

on addModParams me
  i = me.modifyParams(#init)
  i[#pathFindingTime] = 60
  i[#pathFindingStallTime] = 5
  ancestor.addModParams()
end

on init me, params
  ancestor.init(params)
  pPathFindingCounter = CounterNew()
  pPathFindingCounter.tim[2] = params.pathFindingTime
  pPathFindingDistance = 100
  pPathFindingLoc = #none
  pPathFindingMode = #beeline
  pStallCounter = CounterNew()
  pStallCounter.tim[2] = params.pathFindingStallTime
  pTargetLoc = #none
end

on addSaveData me, sd
  ancestor.addSaveData(sd)
  sd[#pPathFindingCounter] = pPathFindingCounter
  sd[#pPathFindingLoc] = pPathFindingLoc
  sd[#pPathFindingMode] = pPathFindingMode
  sd[#pStallCounter] = pStallCounter
  sd[#pTargetLoc] = pTargetLoc
end

on findPathToLoc me, targetloc
  pTargetLoc = targetloc
  case pPathFindingMode of
    #beeline:
      stalled = me.updateBeeline()
      if stalled then
        me.goPathFindingMode(#scenic)
      end if
    #scenic:
      fin = me.updateScenic()
      if fin then
        me.goPathFindingMode(#beeline)
      end if
  end case
end

on goPathFindingMode me, newMode
  case newMode of
    #scenic:
      pPathFindingLoc = PointRoughly(me.big.pCharacterPrg.getLoc(), pPathFindingDistance)
  end case
  pPathFindingMode = newMode
end

on internalEvent me, theEvent
  ancestor.internalEvent(theEvent)
  case theEvent of
    #arrivedAtAttackLoc:
      CounterReset(pStallCounter)
      me.big.pCharacterPrg.moveToLoc(#none)
    #targetLeft:
      me.big.pCharacterPrg.moveToLoc(#none)
  end case
end

on restoreFromSave me, sd
  pPathFindingCounter = sd.pPathFindingCounter
  pPathFindingLoc = sd.pPathFindingLoc
  pPathFindingMode = sd.pPathFindingMode
  pStallCounter = sd.pStallCounter
  pTargetLoc = sd.pTargetLoc
end

on updateBeeline me
  stalled = 0
  me.big.pCharacterPrg.moveToLoc(pTargetLoc)
  stalled = me.updateStallCount()
  return stalled
end

on updateScenic me
  fin = 0
  me.big.pCharacterPrg.moveToLoc(pPathFindingLoc)
  stalled = me.updateStallCount()
  if stalled then
    fin = 1
  end if
  return fin
end

on updateStallCount me
  stalled = 0
  if me.big.pCharacterPrg.pMoveXY.getMoveVect() = point(0, 0) then
    counter(pStallCounter)
    if pStallCounter.fin then
      CounterReset(pStallCounter)
      stalled = 1
    end if
  else
    CounterReset(pStallCounter)
  end if
  return stalled
end
