property ancestor, pAutoTurn, pBasicTimePerLine, pCaller, pLightsDownFunction, pLightsUpFunction, pPlayers, pTheScript, pTimeBetweenLines, pTimePerLetter, pWaitingForPlayers, pWingsLoc
global g

on new me
  ancestor = new(script("objParams"))
  i = me.modifyParams(#init)
  i[#autoTurn] = 1
  i[#basicTimePerLine] = 50
  i[#caller] = #none
  i[#theScript] = #none
  i[#timePerLetter] = 1.39999999999999991
  i[#timeBetweenLines] = 12
  return me
end

on init me, params
  ancestor.init(params)
  pAutoTurn = params.autoTurn
  pBasicTimePerLine = params.basicTimePerLine
  pCaller = params.caller
  pLightsDownFunction = #startSlowFadeOut
  pLightsUpFunction = #startSlowFadeIn
  pTheScript = params.theScript
  pTimeBetweenLines = params.timeBetweenLines
  pTimePerLetter = params.timePerLetter
  pWaitingForPlayers = 0
  pWingsLoc = point(-100, -100)
  pPlayers = #none
end

on acquirePlayers me
  pPlayers = g.objectMaster.getPlayers(pTheScript.getPlayers())
  me.createMissingPlayers()
end

on actorToWings me, actorID
  player = me.getPlayerByActorID(actorID)
  me.putPlayerIntoWings(player)
end

on calcDisplayTimeForLine me, theLine
  if theLine.theCommand <> #speakLine then
    return 0
  end if
  displayTime = pBasicTimePerLine
  letterTime = theLine.args.chars.count * pTimePerLetter
  displayTime = displayTime + letterTime
  return displayTime
end

on createMissingPlayers me
  repeat with nPlayer in pPlayers
    if nPlayer.obj = #none then
      params = g.actorMaster.getParams(#newActor)
      params.forceCreate = 1
      params.typ = nPlayer.objCharacter
      params.startLoc = pWingsLoc
      params.useOffset = 0
      nPlayer.obj = g.actorMaster.newActor(params)
      nPlayer.createdForScript = 1
      nPlayer.obj.frameAdvance()
    end if
  end repeat
end

on finishAllPlayers me
  repeat with player in pPlayers
    if player.obj <> #none then
      player.obj.finish()
      player.obj = #none
    end if
  end repeat
end

on finishPlayersInWings me
  repeat with player in pPlayers
    if player.obj.getLoc() = pWingsLoc then
      player.obj.finish()
      player.obj = #none
    end if
  end repeat
end

on lineFinished me
  me.performNextLine()
end

on getLeftOrRightmostPlayerLocX me, typ
  extremePlayerLocX = g.cutSceneMaster.getCenterStage()
  repeat with player in pPlayers
    if me.playerIsInWings(player) then
      next repeat
    end if
    playerLocX = player.obj.getLoc().locH
    case typ of
      #left:
        if playerLocX < extremePlayerLocX then
          extremePlayerLocX = playerLocX
        end if
      #right:
        if playerLocX > extremePlayerLocX then
          extremePlayerLocX = playerLocX
        end if
    end case
  end repeat
  return extremePlayerLocX
end

on getStageLeftOnLoc me
  return me.getStageEntranceOnLoc(#left)
end

on getStageRightOnLoc me
  return me.getStageEntranceOnLoc(#right)
end

on getStageEntranceOnLoc me, typ
  extremePlayerLocX = me.getLeftOrRightmostPlayerLocX(typ)
  case typ of
    #left:
      stageEdge = g.cutSceneMaster.getStageLeft()
    #right:
      stageEdge = g.cutSceneMaster.getStageRight()
  end case
  entranceLoc = VarHalfWay(stageEdge, extremePlayerLocX)
  return entranceLoc
end

on getPlayer me, thePlayer
  pos = ListGetPosByProp(pPlayers, #objCharacter, thePlayer)
  return pPlayers[pos].obj
end

on getPlayerByActorID me, theActorID
  player = pPlayers[theActorID]
  return player
end

on getWingsLoc me
  return pWingsLoc
end

on introduceMeToPlayers me
  playerID = 1
  repeat with player in pPlayers
    nObj = player.obj
    nObj.setScriptPerformer(me.id.bigMe)
    nObj.setScriptPerformerActorID(playerID)
    if pCaller = g.cutSceneMaster then
      speechDisplayMode = g.cutSceneMaster.getSpeechDisplayMode()
      nObj.setSpeechDisplayMode(speechDisplayMode)
    end if
    playerID = playerID + 1
  end repeat
end

on lightsChange me, Dir
  pWaitingForPlayers = 0
  repeat with player in pPlayers
    case Dir of
      #up:
        function = pLightsUpFunction
        if player.objCharacter = #ulin then
          nothing()
        end if
      #down:
        function = pLightsDownFunction
    end case
    call(function, player.obj)
    pWaitingForPlayers = pWaitingForPlayers + 1
  end repeat
end

on lightsDown me
  me.lightsChange(#down)
end

on lightsUp me
  me.lightsChange(#up)
end

on makeLinePackage me, theLine
  linePackage = g.structMaster.getStruct(#linePackage)
  linePackage.args = theLine.args
  linePackage.caller = me
  linePackage.theCommand = theLine.theCommand
  linePackage.delayTime = pTimeBetweenLines
  linePackage.displayTime = me.calcDisplayTimeForLine(theLine)
  linePackage.obj = me.translateObjCharacterToObj(theLine.objCharacter)
  linePackage.objCharacter = theLine.objCharacter
  return linePackage
end

on makePlayersInvisible me
  repeat with player in pPlayers
    player.obj.invisible()
  end repeat
end

on performNextLine me
  nextLine = pTheScript.getNextLine()
  if nextLine = #finished then
    me.scriptFinished()
    return 
  end if
  linePackage = me.makeLinePackage(nextLine)
  linePackage.obj.performLine(linePackage)
  if linePackage.theCommand = #speakLine then
    if pAutoTurn then
      me.turnPlayersToFace(linePackage.objCharacter)
    end if
  end if
end

on playerFaderFin me
  pWaitingForPlayers = pWaitingForPlayers - 1
  if pWaitingForPlayers = 0 then
    me.lineFinished()
  end if
end

on playerIsInWings me, player
  if player.obj.getLoc() = me.getWingsLoc() then
    return 1
  end if
  return 0
end

on playMusic me, args
  g.soundmaster.playMusic(args.memberToPlay, args.volumeLevel)
  me.lineFinished()
end

on PlaySound me, args
  g.soundmaster.PlaySound(args.memberToPlay, args.volumeLevel)
  me.lineFinished()
end

on putCreatedPlayersIntoWings me
  repeat with player in pPlayers
    if player.createdForScript = 1 then
      me.putPlayerIntoWings(player)
    end if
  end repeat
end

on putPlayerIntoWings me, player
  player.obj.at(pWingsLoc)
end

on putPlayersIntoCharacter me
  repeat with player in pPlayers
    player.obj.goThespianMode()
  end repeat
end

on putPlayersOutOfCharacter me
  repeat with player in pPlayers
    player.obj.leaveThespianMode()
  end repeat
end

on putPlayersIntoWalkMode me, Dir
  case Dir of
    #left:
      comm = #startWalkScrollLeft
    #right:
      comm = #startWalkScrollRight
    #stop:
      comm = #stopWalkScroll
  end case
  repeat with player in pPlayers
    if me.playerIsInWings(player) = 0 then
      call(comm, player.obj)
    end if
  end repeat
end

on putPlayersIntoWings me
  repeat with player in pPlayers
    me.putPlayerIntoWings(player)
  end repeat
end

on scriptCancelled me
  me.scriptFinished()
end

on scriptFinished me
  me.putCreatedPlayersIntoWings()
  me.putPlayersOutOfCharacter()
  me.finishPlayersInWings()
  if pCaller <> #none then
    pCaller.scriptFinished()
  end if
  me.finish()
end

on startPerformance me
  me.acquirePlayers()
  me.introduceMeToPlayers()
  me.putPlayersIntoCharacter()
  pTheScript.reset()
  me.performNextLine()
end

on translateObjCharacterToObj me, objCharacter
  repeat with player in pPlayers
    if player.objCharacter = objCharacter then
      return player.obj
    end if
  end repeat
  return g.cutSceneMaster
end

on turnPlayersToFace me, objCharacter
  repeat with player in pPlayers
    nChar = player.objCharacter
    if nChar <> objCharacter then
      player.obj.turnToFace(objCharacter)
    end if
  end repeat
end
