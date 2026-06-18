property pSaveVersion
global g, gGameSaveFile

on new me
  return me
end

on init me
  pSaveVersion = 12
end

on finish me
end

on isLoadAvailable me
  available = 0
  sd = _player.getPref(gGameSaveFile)
  if sd <> VOID then
    sd = value(sd)
    if sd <> VOID then
      if sd.ver = pSaveVersion then
        return 1
      end if
    end if
  end if
  return available
end

on loadGame me
  sd = getPref(gGameSaveFile)
  sd = value(sd)
  if sd = VOID then
    return 
  end if
  currentMap = g.gamemaster.getCurrentMap()
  currentMap.restoreFromSave(sd.currentMap)
  g.potionMaster.restoreFromSave(sd.g_potionMaster)
  g.soundmaster.restoreFromSave(sd.g_soundMaster)
  g.armyMaster.restoreFromSave(sd.g_armyMaster)
  g.characterEnergyRollOverMaster.restoreFromSave()
end

on isMenuItemShadowed me, theComm
  case theComm of
    #loadGame:
      if me.isLoadAvailable() then
        shadowed = 0
      else
        shadowed = 1
      end if
  end case
  return shadowed
end

on saveGame me
  currentMap = g.gamemaster.getCurrentMap()
  sd = [:]
  sd[#ver] = pSaveVersion
  saveData = [:]
  currentMap.addSaveData(saveData)
  sd[#currentMap] = saveData
  saveData = [:]
  g.potionMaster.addSaveData(saveData)
  sd[#g_potionMaster] = saveData
  saveData = [:]
  g.soundmaster.addSaveData(saveData)
  sd[#g_soundMaster] = saveData
  saveData = [:]
  g.armyMaster.addSaveData(saveData)
  sd[#g_armyMaster] = saveData
  setPref(gGameSaveFile, string(sd))
  if me.isLoadAvailable() <> 1 then
    put "setPref failed"
  end if
end

on start me
end

on stop me
  me.finish()
end
