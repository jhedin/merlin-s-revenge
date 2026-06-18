property pCopyProtectionStatus, pScriptPerformer
global g, gFrameNum, gGameCompleteEvent, gGameCompleteSound, gGameName, gGameOverScript

on new me
  return me
end

on init me
  pCopyProtectionStatus = #Ok
  pScriptPerformer = #none
end

on buttClicked me, theButt
  case theButt of
    #butt_resumeGame:
      me.resumeGame()
    #butt_mr3Link:
      gotoNetPage("http://www.themetalbox.com/?page=merlin_3")
      put "merlin 3 button pressed"
  end case
end

on cheat me, theCheat
  case theCheat of
    #invincibility:
      thePlayer = g.actorMaster.getPlayer()
      thePlayer.invinceToggle()
    #killall:
      me.killall()
    #medikit:
      thePlayer = g.actorMaster.getPlayer()
      thePlayer.medikitCollected()
  end case
end

on displayInstructions me
  g.screenMaster.screenOn(#instructions, me)
end

on displayChooseKeys me
  g.screenMaster.screenOn(#chooseKeysScreen, me)
end

on enemyDied me
  currentRoom = me.getCurrentRoom()
  currentRoom.attemptOpenExits()
end

on escapePressed me
  me.pauseGame()
  g.screenMaster.screenOn(#ingameMenu, me)
end

on finishGame me
  g.actorMaster.finishActors()
  g.EnemyEnergyMaster.finish()
  currentMap = me.getCurrentMap()
  if currentMap <> #none then
    currentMap.finish()
  end if
end

on gameComplete me
  me.finishGame()
  g.movieMaster.gameComplete()
  if gGameName = #rapunzel then
    me.runRapunzelEndSequence()
  end if
  if gGameCompleteSound <> #none then
    g.soundmaster.PlaySound(gGameCompleteSound)
  end if
end

on gameEvent me, theEvent
  if gGameCompleteEvent = theEvent then
    me.gameComplete()
  end if
end

on gameOver me
  if gGameOverScript = #none then
    me.quitToTitle()
    return 
  end if
  me.finishGame()
  g.movieMaster.goScreen(#animScreenGameOver, #gameOver)
end

on getCurrentMap me
  mapController = g.controllerMaster.getController(#map)
  themap = mapController.getObject()
  return themap
end

on getCurrentRoom me
  themap = me.getCurrentMap()
  if themap <> #none then
    return themap.getCurrentRoom()
  else
    return #none
  end if
end

on goNavMode me
  g.actorMaster.getPlayer().goNavMode()
  me.getCurrentMap().goNavMode()
end

on goScreen me, theScreen
  params = g.screenMaster.getParams(#goScreen)
  params.caller = me
  params.screenSym = theScreen
  params.transition = #fade
  g.screenMaster.goScreen(params)
end

on goScreenFinished me
end

on isMenuItemShadowed me, theComm
  if theComm = #saveGame then
    if g.cutSceneMaster.isScriptBeingPerformed() then
      return 1
    end if
  end if
  return 0
end

on killall me
  g.teamMaster.killEnemyTeams(#aldevar)
end

on leaveNavMode me
  g.characterEnergyRollOverMaster.leaveNavMode()
  me.getCurrentMap().leaveNavMode()
end

on menuOptionSelected me, theOption, theMenu
  g.screenMaster.screenOff(#ingameMenu)
  case theOption of
    #back:
      g.screenMaster.backAScreen()
    #instructions:
      me.displayInstructions()
    #chooseKeys:
      me.displayChooseKeys()
    #loadGame:
      g.saveMaster.loadGame()
    #options:
    #quitToTitle:
      me.quitToTitle()
    #resumeGame:
      me.resumeGame()
    #saveGame:
      g.saveMaster.saveGame()
      me.resumeGame()
    #showArmy:
      g.screenMaster.screenOn(#showArmy, g.showArmyMaster)
    #soundOff:
      g.soundmaster.toggle(0)
      g.screenMaster.screenOn(#ingameMenu, me)
    #soundOn:
      g.soundmaster.toggle(1)
      g.screenMaster.screenOn(#ingameMenu, me)
  end case
end

on newMapStarted me
  g.collisionMaster.initPlayArea()
end

on pauseGame me
  g.actorMaster.pauseGameObjects()
end

on performScript me, scriptSym
  theScript = g.collectionsMaster.getObj(#objScript, scriptSym)
  scriptPerformer = g.objectMaster.requestObject(#objScriptPerformer)
  params = scriptPerformer.getParams(#init)
  params.caller = me
  params.theScript = theScript
  scriptPerformer.init(params)
  scriptPerformer.startPerformance()
  pScriptPerformer = scriptPerformer
end

on quitToTitle me
  me.finishGame()
  g.movieMaster.goScreen(#titleScreen)
end

on resumeGame me
  me.unpauseGame()
end

on runRapunzelEndSequence me
  screenSeq = g.objectMaster.requestObject(#objScreenSequencer)
  params = screenSeq.getParams(#init)
  b = params.backButtonTextParams
  b.alignment = #left
  b.font = "Dauphin *"
  b.fontSize = 16
  b.width = 50
  n = params.nextButtonTextParams
  n.alignment = #right
  n.font = "Dauphin *"
  n.fontSize = 16
  n.width = 50
  n = params.returnButtonTextParams
  n.alignment = #center
  n.font = "Dauphin *"
  n.fontSize = 16
  n.width = 150
  params.callingPrg = me
  params.delayCount = 600
  params.returnScreen = #titleScreen
  params.returnButtonText = "Quit to Title Screen"
  params.screenList = [#outroScreen_01, #outroScreen_02, #outroScreen_03, #outroScreen_04, #outroScreen_05, #outroScreen_06, #outroScreen_07, #outroScreen_08]
  screenSeq.init(params)
  screenSeq.start()
  pScreenSequencer = screenSeq
end

on scriptFinished me
  pScripPerformer = #none
end

on start me
  if pCopyProtectionStatus = #invalid then
    g.movieMaster.redirectMovie()
    return 
  end if
  g.armyMaster.clearArmy()
  gFrameNum = 0
  g.collisionMaster.initPlayArea()
  g.actorMaster.start()
  g.updater.addPrg(me, #med)
end

on teamDied me, teamName
  currentRoom = me.getCurrentRoom()
  if currentRoom <> #none then
    exitsOpen = currentRoom.attemptOpenExits()
    if exitsOpen then
      currentMap = me.getCurrentMap()
      if currentMap <> #none then
        isEndRoom = currentMap.isEndRoom()
        if isEndRoom then
          me.gameEvent(#mapClear)
        end if
      end if
    end if
  end if
end

on unpauseGame me
  g.actorMaster.unpauseGameObjects()
end

on update me
  g.keyMaster.checkKeys()
  g.mouseMaster.checkMouse()
end

on updateCopyProtectionStatus me, newStatus
  pCopyProtectionStatus = newStatus
  if newStatus = #invalid then
    me.finishGame()
    me.goScreen(#licence)
  end if
end

on stop me
end
