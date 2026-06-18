global g3DMode, gBounceyWalls, gBulletsCollideWithBackground, gButtonBaseColour, gButtonHiColour, gButtonPulse, gCharacterEnergyRolloverOn, gEnemyEnergyMasterOn, gExitArrows, gGameCompleteScript, gGameCompleteSound, gGameName, gGameOverScript, gGameSaveFile, gGameView, gKeySetFileName, gIntroScript, gNavMode, gMapBoundary, gMaxEnemies, gMaxFriends, gMenuBaseColour, gMenuHiColour, gMenuPulse, gMenuShadowedColour, gPlayerHair

on GameInitGlobals
  g3DMode = 0
  gBounceyWalls = 0
  gBulletsCollideWithBackground = 0
  gButtonBaseColour = rgb(100, 100, 100)
  gButtonHiColour = rgb(255, 255, 255)
  gButtonPulse = 0
  gCharacterEnergyRolloverOn = 1
  gEnemyEnergyMasterOn = 0
  gExitArrows = 1
  gGameCompleteScript = #cut_scene_to_play_at_end
  gGameCompleteSound = "end_level"
  gGameName = #merlin_3
  gGameOverScript = #cut_scene_to_play_when_wasted
  gGameSaveFile = "mr4_saveGame_0_03.txt"
  gGameView = #topDown
  gKeySetFileName = "MerlinsRevengeKeys.txt"
  gNavMode = 1
  gMapBoundary = 128
  gMaxEnemies = 16
  gMaxFriends = 12
  gMenuBaseColour = rgb(0, 0, 0)
  gMenuHiColour = gButtonHiColour
  gMenuPulse = gButtonPulse
  gMenuShadowedColour = rgb(100, 100, 100)
  gPlayerHair = 0
end
