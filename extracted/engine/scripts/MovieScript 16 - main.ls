global g, q, r, gErrorTrace, gFrameNum, gStageSize, gMasterCast, gMoveSpeedLimit, gLoadError, g3DMode, gBounceyWalls, gBulletsCollideWithBackground, gButtonBaseColour, gButtonHiColour, gButtonPulse, gButtonShadowedColour, gCharacterEnergyRolloverOn, gCreditsPage, gCopyProtectionContent, gCopyProtectionPage, gCopyProtectionRedirectURL, gCutSceneSpeechLayer, gEnemyEnergyMasterOn, gExitArrows, gExitArrowThickness, gGameBulletLayer, gGameCompleteEvent, gGameCompleteScript, gGameCompleteSound, gGameEnergyBarLayer, gGameObjectLayer, gGameName, gGameOverScript, gGameSaveFile, gGameSpeed, gGameTextLayer, gGameView, gGlobalDisplayLayer, gGridSelectorLayer, gIntroScript, gKeySetFileName, gNavMode, gMagicLimit, gMapBoundary, gMapBoundaryLayer, gMapLayer, gMaxEnemies, gMaxFriends, gMaxNeutrals, gMenuBaseColour, gMenuHiColour, gMenuLayer, gMenuPulse, gMenuShadowedColour, gMenuTextLayer, gPaletteLayer, gPlayerHair, gPlayerLayer, gMineLayer

on startMovie
  clearGlobals()
  the debugPlaybackEnabled = 0
  if the runMode contains "Plugin" then
    the debugPlaybackEnabled = 1
    the alertHook = script("alert")
    elseif(the runMode contains "Projector")
    the debugPlaybackEnabled = 1
    the alertHook = script("debug_projector")
    gErrorTrace = [#ROOT]
  end if
  gLoadError = 0
  errors = loadScripts()
  if errors then
    gLoadError = 1
    return 
  end if
  loader = new(script("Loader"))
  loader.loadFiles()
  loader = 0
  g = [:]
  q = QUOTE
  r = RETURN
  put r & "-- < start new movie > " & r
  go(1)
  gFrameNum = 0
  gMapLayer = 1
  gMineLayer = 25
  gGameObjectLayer = 50
  gGameBulletLayer = 75
  gPlayerLayer = 99
  gMapBoundaryLayer = 150
  gGameEnergyBarLayer = 170
  gGameTextLayer = 180
  gMenuLayer = 190
  gMenuTextLayer = 200
  gCutSceneSpeechLayer = 210
  gGlobalDisplayLayer = 220
  gPaletteLayer = 240
  gGridSelectorLayer = 250
  gMoveSpeedLimit = #none
  gStageSize = point((the stage).rect.width, (the stage).rect.height)
  defaultGameGlobals()
  GameInitGlobals()
  gMasterCast = member("structMaster").castLibNum
  createObjects()
  createMainObjects()
  initMainObjects()
  g.movieMaster.start()
end

on defaultGameGlobals
  g3DMode = 0
  gBounceyWalls = 1
  gBulletsCollideWithBackground = 1
  gButtonBaseColour = rgb(255, 255, 0)
  gButtonHiColour = rgb(255, 255, 255)
  gButtonPulse = 0
  gButtonShadowedColour = rgb(150, 150, 150)
  gCharacterEnergyRolloverOn = 0
  gCreditsPage = "mr4_credits.txt"
  gEnemyEnergyMasterOn = 1
  gExitArrows = 0
  gExitArrowThickness = 16
  gGameCompleteEvent = #mapClear
  gGameCompleteScript = #demo007Complete
  gGameCompleteSound = #none
  gGameName = #none
  gGameOverScript = #none
  gGameSaveFile = "mr4_saveGame.txt"
  gGameSpeed = 1
  gGameView = #topDown
  gKeySetFileName = "TMB_keySet.txt"
  gNavMode = 0
  gMagicLimit = 100
  gMaxEnemies = 16
  gMaxFriends = 9
  gMaxNeutrals = 99
  gMapBoundary = 0
  gMenuBaseColour = rgb(255, 255, 255)
  gMenuHiColour = rgb(100, 100, 100)
  gMenuPulse = 1
  gMenuShadowedColour = rgb(150, 150, 150)
  gPlayerHair = 1
end

on nextframe
  if gLoadError then
    return 
  end if
  gFrameNum = gFrameNum + 1
  g.updater.updatePrgs()
  if g3DMode then
    g.spriteMaster.updateSprites()
  end if
  updateStage()
end

on stopMovie
  stopMainObjects()
  put r & "-- < end of movie > " & r
end

on createObjects
  g[#objectMaster] = new(script("objectMaster"))
  g.objectMaster.init()
  g[#updater] = g.objectMaster.requestObject(#objUpdater)
  g.updater.init([#hi, #med, #lo])
end

on createMainObjects
  objects = CastGetListNames(gMasterCast)
  repeat with obj in objects
    comm = "g[#" & obj & "] = new (script " & q & obj & q & ")"
    do(comm)
    comm = "put g." & obj & "&&" & q & "created" & q
    do(comm)
  end repeat
end

on initMainObjects
  objects = CastGetListNames(gMasterCast)
  repeat with obj in objects
    comm = "g." & obj & ".init()"
    do(comm)
  end repeat
end

on stopMainObjects
  if voidp(gMasterCast) then
    return 
  end if
  objects = CastGetListNames(gMasterCast)
  repeat with obj in objects
    comm = "g." & obj & ".stop()"
    do(comm)
  end repeat
end
