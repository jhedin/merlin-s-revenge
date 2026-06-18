property ancestor, pTeleportCaller, pTeleportCeiling, pTeleportFadeStep, pTeleportFloorLoc, pTeleportFrames, pTeleportHeight, pTeleportHeightStep, pTeleportMode, pTeleportXLoc

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
  pTeleportCaller = #none
  pTeleportCeiling = #none
  pTeleportFloorLoc = #none
  pTeleportFrames = 15
  pTeleportHeight = 1000
  pTeleportMode = #none
  pTeleportXLoc = #none
  pTeleportHeightStep = pTeleportHeight / pTeleportFrames
  pTeleportFadeStep = 100 / pTeleportFrames
end

on addSaveData me, sd
  ancestor.addSaveData(sd)
  me.addToSaveData(sd)
end

on addToArmyDetails me
  ad = me.big.getArmyDetails()
end

on addToSaveData me, sd
  sd[#pTeleportCaller] = pTeleportCaller
  sd[#pTeleportCeiling] = pTeleportCeiling
  sd[#pTeleportFadeStep] = pTeleportFadeStep
  sd[#pTeleportFloorLoc] = pTeleportFloorLoc
  sd[#pTeleportFrames] = pTeleportFrames
  sd[#pTeleportHeight] = pTeleportHeight
  sd[#pTeleportHeightStep] = pTeleportHeightStep
  sd[#pTeleportMode] = pTeleportMode
  sd[#pTeleportXLoc] = pTeleportXLoc
end

on getTeleportMode me
  return pTeleportMode
end

on goTeleportMode me, newMode
  pTeleportMode = newMode
end

on internalEvent me, theEvent
  ancestor.internalEvent(theEvent)
  case theEvent of
    #addToArmyDetails:
      me.addToArmyDetails()
    #restoreFromArmyDetails:
      me.restoreFromArmyDetails()
  end case
end

on restoreFromArmyDetails me
  ad = me.big.getArmyDetails()
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
  me.restoreFromSaveData(sd)
end

on restoreFromSaveData me, sd
  pTeleportCaller = sd.pTeleportCaller
  pTeleportCeiling = sd.pTeleportCeiling
  pTeleportFadeStep = sd.pTeleportFadeStep
  pTeleportFloorLoc = sd.pTeleportFloorLoc
  pTeleportFrames = sd.pTeleportFrames
  pTeleportHeight = sd.pTeleportHeight
  pTeleportHeightStep = sd.pTeleportHeightStep
  pTeleportMode = sd.pTeleportMode
  pTeleportXLoc = sd.pTeleportXLoc
end

on teleportFinished me
  me.id.bigMe.setAnimKeepSize(0)
  me.goTeleportMode(#none)
end

on teleportInAt me, theloc
  pTeleportXLoc = theloc.locH
  pTeleportFloorLoc = theloc.locV
  pTeleportCeiling = pTeleportFloorLoc - pTeleportHeight
  me.id.bigMe.setAnimKeepSize(1)
  me.id.bigMe.setSpriteHeight(pTeleportHeight)
  me.goTeleportMode(#teleportInStretch)
  me.invisible()
  me.startTransBlend(pTeleportFadeStep, #in)
end

on teleportOut me, callerSym, teleportFloorLoc
  bigMe = me.id.bigMe
  pTeleportCaller = callerSym
  pTeleportXLoc = bigMe.getLoc().locH
  pTeleportFloorLoc = teleportFloorLoc
  pTeleportCeiling = pTeleportFloorLoc - pTeleportHeight
  bigMe.setAnimKeepSize(1)
  me.goTeleportMode(#teleportOutStretch)
  me.startTransBlend(pTeleportFadeStep, #out)
end

on update me
  ancestor.update()
  case pTeleportMode of
    #teleportInStretch:
      fin = me.updateTeleportInStretch()
      if fin then
        me.teleportFinished()
        me.id.bigMe.teleportInFinished()
        me.big.internalEvent(#teleportInFinished)
      end if
    #teleportOutStretch:
      fin = me.updateTeleportOutStretch()
      if fin then
        me.teleportFinished()
        me.id.bigMe.teleportOutFinished(pTeleportCaller)
        me.big.internalEvent(#teleportOutFinished)
      end if
  end case
end

on updateTeleportInStretch me
  fin = 0
  me.id.bigMe.incSpriteHeight(-pTeleportHeightStep)
  if me.id.bigMe.getSpriteHeight() < me.id.bigMe.getMemberHeight() then
    me.id.bigMe.setSpriteHeight(me.id.bigMe.getMemberHeight())
    fin = 1
  end if
  yLoc = me.id.bigMe.positionEdge(#bottom, pTeleportFloorLoc)
  me.id.bigMe.setLoc(point(pTeleportXLoc, yLoc))
  return fin
end

on updateTeleportOutStretch me
  fin = 0
  bigMe = me.id.bigMe
  bigMe.incSpriteHeight(pTeleportHeightStep)
  if bigMe.getSpriteHeight() > pTeleportHeight then
    fin = 1
  end if
  yLoc = me.id.bigMe.positionEdge(#bottom, pTeleportFloorLoc)
  bigMe.setLoc(point(pTeleportXLoc, yLoc))
  return fin
end
