property ancestor, pCharacterPrg, pmode, pMoveVector, pPreviousMode, pSpr

on new me
  ancestor = new(script("objModules"))
  me.addModule("modRelationships")
  return me
end

on init me, params
  ancestor.init(params)
  me.recordMoveVector(point(0, 0))
  pmode = #none
end

on initCharacterInfo me, characterPrg, spr
  pCharacterPrg = characterPrg.id.bigMe
  pSpr = spr
end

on addSaveData me, sd
  ancestor.addSaveData(sd)
  sd[#pmode] = pmode
end

on characterModeChanged me, newMode
end

on ensureMode me, newMode
  if pmode <> newMode then
    me.id.bigMe.goMode(newMode)
  end if
end

on getCharacter me
  return pCharacterPrg.getCharacter()
end

on getLoc me
  return pCharacterPrg.getLoc()
end

on getFlip me
  return pCharacterPrg.getFlip()
end

on getMode me
  return pmode
end

on getOwner me
  return pCharacterPrg
end

on getPlatformDrop me
  return pMoveVector[2] = 1
end

on getTeam me
  return pCharacterPrg.getTeam()
end

on goMode me, newMode
  pmode = newMode
end

on goThespianMode me
  pPreviousMode = me.getMode()
  me.goMode(#freeze)
end

on leaveThespianMode me
  me.goMode(pPreviousMode)
end

on unpaws me
end

on recordMoveVector me, newVal
  pMoveVector = newVal.duplicate()
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
  pmode = sd.pmode
end

on setMode me, theMode
  pmode = theMode
end

on start me
end

on walkToLoc me, targetloc
  pCharacterPrg.walkToLoc()
end
