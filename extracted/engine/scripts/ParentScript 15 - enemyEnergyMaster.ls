property pBarGap, pBarHeight, pEnergyBarAssignments, pEnergyBars, pQueue, pSurroundBorder, pSurroundRect, pSurroundSprite
global g

on new me
  return me
end

on init me
  pBarGap = 1
  pBarHeight = 2
  pEnergyBarAssignments = []
  pEnergyBars = []
  pQueue = []
  pSurroundBorder = 2
end

on initEnergyBars me
  totalBarHeight = pBarGap + pBarHeight
  availableHeight = pSurroundRect.height - (pSurroundBorder * 2)
  numBars = (availableHeight + pBarGap) / totalBarHeight
  sr = pSurroundRect
  sb = pSurroundBorder
  nRect = rect(sr[1] + sb, sr[2] + sb, sr[3] - sb, sr[2] + sb + pBarHeight)
  repeat with i = 1 to numBars
    energybar = g.objectMaster.requestObject(#objEnergyBar)
    params = energybar.getParams(#init)
    params.align = #right
    params.barBorder = 0
    params.currentEnergy = 0
    params.maxEnergy = 100
    params.surroundRect = nRect.duplicate()
    params.surroundSpr = pSurroundSprite
    energybar.init(params)
    energybar.updateEnergy(0)
    pEnergyBars.append(energybar)
    pEnergyBarAssignments.append(#none)
    nRect = nRect.offset(0, totalBarHeight)
  end repeat
end

on start me
  surroundSprite = g.spriteMaster.getSpriteWithMember(member("enemy_energy_surround", "gfx"))
  pSurroundRect = surroundSprite.rect.duplicate()
  pSurroundSprite = surroundSprite
  me.init()
  me.initEnergyBars()
end

on addToQueue me, requester
  pQueue.append(requester)
end

on deleteFromQueue me, requester
  reqPos = pQueue.getPos(requester)
  if reqPos > 0 then
    pQueue.deleteAt(reqPos)
  end if
end

on finish me
  if ilk(pEnergyBars) <> #void then
    repeat with energybar in pEnergyBars
      energybar.finish()
    end repeat
  end if
end

on freeEnergyBar me, energybar, requester
  if energybar = #none then
    me.deleteFromQueue(requester)
  else
    pos = pEnergyBars.getPos(energybar)
    if pos > 0 then
      pEnergyBarAssignments[pos] = #none
      pEnergyBars[pos].resetToZero()
      me.notifyNextInQueue()
    end if
  end if
end

on getAvailableEnergyBar me, requester
  availablePos = pEnergyBarAssignments.getPos(#none)
  if availablePos > 0 then
    pEnergyBarAssignments[availablePos] = requester
    return pEnergyBars[availablePos]
  end if
  return #none
end

on notifyNextInQueue me
  if pQueue.count > 0 then
    nextInQueue = pQueue[1]
    nextInQueue.energyBarNowFree()
    pQueue.deleteAt(1)
  end if
end

on requestEnergyBar me, requester
  energybar = me.getAvailableEnergyBar(requester)
  if energybar = #none then
    me.addToQueue(requester)
  end if
  return energybar
end

on stop me
  me.finish()
end
