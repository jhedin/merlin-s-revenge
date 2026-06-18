property ancestor, pDieOnExplode, pPrimeCounter, pTriggerRadius, pDieOnExplodeNumber, pExplosions, pCheckCounter, pTriggerRadiusTile
global g, gMineLayer

on new me
  ancestor = new(script("objGameObject"))
  i = me.modifyParams(#init)
  i[#dieOnExplode] = 1
  i[#dieOnExplodeNumber] = 0
  i[#timeToPrime] = 30
  i[#triggerRadius] = 20
  i[#timeToCheck] = 3
  me.addModule("modAnimSet")
  me.addModule("modAttack")
  me.addModule("modExploder")
  return me
end

on init me, params
  ancestor.init(params)
  pDieOnExplode = params.dieOnExplode
  pPrimeCounter = CounterNew()
  pPrimeCounter.tim[2] = params.timeToPrime
  pTriggerRadius = params.triggerRadius
  pDieOnExplodeNumber = params.dieOnExplodeNumber
  pExplosions = 0
  pCheckCounter = CounterNew()
  pCheckCounter.tim[2] = params.timeToCheck
  pTriggerRadiusTile = integer(pTriggerRadius / g.teamMaster.getTileSize()) + 1
  me.setLocZ(gMineLayer)
end

on gainExperienceFromTransfer me, Xp
  return 0
end

on internalEvent me, theEvent
  ancestor.internalEvent(theEvent)
  case theEvent of
    #explodeFin:
      if pDieOnExplode then
        me.big.setDead(1)
      else
        me.resetMine()
        pExplosions = pExplosions + 1
        if (pDieOnExplodeNumber <= pExplosions) and (pDieOnExplodeNumber <> 0) then
          me.big.setDead(1)
        end if
      end if
  end case
end

on gainExperience me, theExperience
  owner = me.getOwner()
  if owner <> #none then
    owner.gainExperience(theExperience)
  end if
end

on recordKill me, theObj
  owner = me.getOwner()
  if owner <> #none then
    owner.recordKill(theObj)
  end if
end

on resetMine me
  CounterReset(pPrimeCounter)
  CounterReset(pCheckCounter)
  me.goMode(#stand)
end

on start me
  ancestor.start()
  me.resetMine()
end

on update me
  ancestor.update()
  case me.getMode() of
    #stand:
      fin = me.updatePrime()
      if fin then
        me.goMode(#primed)
      end if
    #primed:
      fin = me.updateCheck()
      if fin then
        fin = me.updateCheckCollisions()
        if fin then
          me.big.internalEvent(#mineTriggered)
        end if
      end if
  end case
end

on updateCheckCollisions me
  fin = 0
  dist = g.teamMaster.findTargetWithin(me.big, pTriggerRadiusTile).dist
  if dist < (pTriggerRadius * pTriggerRadius) then
    fin = 1
  end if
  return fin
end

on updateCheck me
  fin = pCheckCounter.fin
  if fin = 0 then
    counter(pCheckCounter)
  end if
  if fin then
    CounterReset(pCheckCounter)
  end if
  return fin
end

on updatePrime me
  fin = pPrimeCounter.fin
  if fin = 0 then
    counter(pPrimeCounter)
  end if
  return fin
end
