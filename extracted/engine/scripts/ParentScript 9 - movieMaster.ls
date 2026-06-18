property pGoScreenAction, pScreenSequencer
global g, g3DMode, gCopyProtectionRedirectURL, gErrorTrace, gIntroScript, gGameCompleteScript, gGameName, gGameOverScript, gMapLoaded

on new me
  return me
end

on init me
  pScreenSequencer = #none
end

on start me
  if g3DMode = 1 then
    g.spriteMaster.init3DWorld()
  end if
  g.frameTimer.start()
  me.goScreen(#titleScreen)
end

on finish me
  me.finishScreenSequencer()
end

on finishScreenSequencer me
  if (ilk(pScreenSequencer) <> #void) and (pScreenSequencer <> #none) then
    pScreenSequencer.finish()
    pScreenSequencer = #none
  end if
end

on buttClicked me, theButt
  if string(theButt) contains "screen" then
    case theButt of
      #butt_animScreen:
        theScreen = #animScreen
      #butt_creditsScreen:
        g.cutSceneMaster.finish()
        theScreen = #creditsScreen
      #butt_gameScreen:
        g.cutSceneMaster.finish()
        theScreen = #gameScreen
      #butt_instructionsScreen:
        theScreen = #instructionsScreen
      #butt_titleScreen:
        g.cutSceneMaster.finish()
        theScreen = #titleScreen
    end case
    me.goScreen(theScreen, #none)
  else
    case theButt of
      #butt_copyright:
        gotoNetPage("http://www.themetalbox.com")
        put "copyright button pressed"
      #butt_intro:
        me.goSequence(#intro)
      #butt_longHairLink:
        gotoNetPage("http://www.longhairlovers.com")
        put "longHair button pressed"
      #butt_reloadGame:
        g.cutSceneMaster.finish()
        me.goScreen(#gameScreen, #loadGame)
      #butt_tmbLink:
        gotoNetPage("http://www.themetalbox.com")
        put "theMetalBox button pressed"
    end case
  end if
end

on cutSceneFinished me, theScene
  case theScene of
    gIntroScript:
      if gMapLoaded then
        me.goScreen(#gameScreen)
      else
        me.goScreen(#titleScreen)
      end if
    gGameCompleteScript:
      me.goScreen(#creditsScreen)
    gGameOverScript:
      me.goScreen(#gameScreen, #loadGame)
  end case
end

on gameComplete me
  me.goScreen(#animScreenEnd, #gameComplete)
end

on goScreen me, theScreen, theAction
  pGoScreenAction = theAction
  params = g.screenMaster.getParams(#goScreen)
  params.caller = me
  params.screenSym = theScreen
  params.transition = #fade
  g.screenMaster.goScreen(params)
end

on goScreenAction me
  case pGoScreenAction of
    #loadGame:
      g.saveMaster.loadGame()
    #gameComplete:
      g.cutSceneMaster.playCutScene(gGameCompleteScript)
    #gameOver:
      g.cutSceneMaster.playCutScene(gGameOverScript)
    #playLoadedCutScene:
      g.cutSceneMaster.playCutScene(gIntroScript)
    #startGame:
      g.cutSceneMaster.playCutScene(gIntroScript)
  end case
end

on goScreenFinished me, theScreen
  me.goScreenAction()
end

on goSequence me, sequence
  case sequence of
    #intro:
      if gGameName = #rapunzel then
        me.goSequenceRapunzelIntro()
      end if
  end case
end

on goSequenceRapunzelIntro me
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
  params.returnButtonText = "Back to Title Screen"
  params.screenList = [#introScreen_01, #introScreen_02, #introScreen_03, #introScreen_04, #introScreen_05]
  screenSeq.init(params)
  screenSeq.start()
  pScreenSequencer = screenSeq
end

on menuOptionSelected me, theComm, theMenu
  case theComm of
    #back:
      g.screenMaster.backAScreen()
    #chooseKeys:
      me.goScreen(#chooseKeysScreen)
    #creditsScreen:
      me.goScreen(#creditsScreen)
    #loadGame:
      me.goScreen(#gameScreen, #loadGame)
    #instructionsScreen:
      me.goScreen(#instructions)
    #startGame:
      if gIntroScript <> #none then
        if gMapLoaded then
          me.goScreen(#animScreen, #startGame)
        else
          me.goScreen(#animScreenSingleCutScene, #playLoadedCutScene)
        end if
      else
        me.goScreen(#gameScreen)
      end if
  end case
end

on redirectMovie me
  gotoNetPage(gCopyProtectionRedirectURL)
  put "movieMaster.redirectMovie  going to " & gCopyProtectionRedirectURL
end

on stop me
  me.finish()
end
