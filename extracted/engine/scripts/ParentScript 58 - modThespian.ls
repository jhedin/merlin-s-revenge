property ancestor, pFrameCounter, pExitingStage, pMyLayer, pPreviousAIMode, pScriptPerformer, pScriptPerformerActorID, pSkipCounter, pSpeechBackgroundColor, pSpeechBackgroundBlend, pSpeechBackgroundBorder, pSpeechBackgroundSprite, pSpeechCharWidth, pSpeechColor, pSpeechDisplayMode, pSpeechOffset, pSpeechStyle, pSpeechWidth, pSpeechWidthCutscene, pTextMember, pTextSprite, pTheLine, pThespMode, pTurnToFaceLocked
global g, gGameTextLayer, gCutSceneSpeechLayer

on new me
  ancestor = new(script("modModule"))
  return me
end

on addModParams me
  i = me.modifyParams(#init)
  i.flags.append(#player)
  i[#skipDuration] = 30
  i[#speechBackgroundColor] = rgb(0, 0, 0)
  i[#speechBackgroundBlend] = 80
  i[#speechBackgroundBorder] = rect(-10, -10, 10, 10)
  i[#speechCharWidth] = 6
  i[#speechColor] = rgb(255, 255, 255)
  i[#speechDisplayMode] = #ingame
  i[#speechOffset] = point(-75, -20)
  i[#speechStyle] = [#bold]
  i[#speechWidth] = 150
  i[#speechWidthCutscene] = 300
  ancestor.addModParams()
end

on init me, params
  pExitingStage = 0
  pFrameCounter = CounterNew()
  pMyLayer = gGameTextLayer
  pPreviousAIMode = #none
  pScriptPerformer = #none
  pScriptPerformerActorID = #none
  pSkipCounter = CounterNew()
  pSkipCounter.tim[2] = params.skipDuration
  pSpeechBackgroundColor = params.speechBackgroundColor
  pSpeechBackgroundBlend = params.speechBackgroundBlend
  pSpeechBackgroundBorder = params.speechBackgroundBorder
  pSpeechBackgroundSprite = #none
  pSpeechCharWidth = params.speechCharWidth
  pSpeechColor = params.speechColor
  pSpeechDisplayMode = params.speechDisplayMode
  pSpeechOffset = params.speechOffset
  pSpeechStyle = params.speechStyle
  pSpeechWidth = params.speechWidth
  pSpeechWidthCutscene = params.speechWidthCutscene
  pTextMember = #none
  pTheLine = #none
  pTurnToFaceLocked = 0
  me.goThespMode(#waitForNextLine)
  ancestor.init(params)
end

on finish me
  me.freeTextMember()
  ancestor.finish()
end

on acquireTextMember me
  me.freeTextMember()
  pSpeechBackgroundSprite = g.spriteMaster.requestSprite()
  pSpeechBackgroundSprite.color = pSpeechBackgroundColor
  pSpeechBackgroundSprite.blend = pSpeechBackgroundBlend
  pSpeechBackgroundSprite.locZ = pMyLayer
  case pSpeechDisplayMode of
    #ingame:
      speechWidth = pSpeechWidth
    #cutscene:
      speechWidth = pSpeechWidthCutscene
  end case
  params = g.memberMaster.getParams(#requestTextMember)
  params.name = "thespian_speech"
  params.font = "Verdana"
  params.fontSize = 10
  params.fontStyle = pSpeechStyle
  params.color = pSpeechColor
  params.width = speechWidth
  pTextMember = g.memberMaster.requestTextMember(params)
  pTextSprite = g.spriteMaster.requestSprite()
  pTextSprite.locZ = pMyLayer
  SpriteSetMember(pTextSprite, pTextMember)
end

on AIisTryingToMove me
  if pSkipCounter.fin then
    g.cutSceneMaster.scriptCancelled()
  end if
end

on at me, theloc
  atLoc = me.interpretLoc(theloc)
  me.setLoc(atLoc)
end

on atPlayer me, playerName
  playerToAppearAt = pScriptPerformer.getPlayer(playerName)
  locToAppearAt = playerToAppearAt.getLoc()
  xLoc = locToAppearAt.locH
  me.at(xLoc)
end

on calcStageLeftOffLoc me
  leftStage = g.cutSceneMaster.getStageLeft()
  offLoc = leftStage - (me.getWidth() / 2)
  return offLoc
end

on calcStageRightOffLoc me
  rightStage = g.cutSceneMaster.getStageRight()
  offLoc = rightStage + (me.getWidth() / 2)
  return offLoc
end

on calcTeleportFloor me
  env = g.cutSceneMaster.getEnvironment()
  if env = #cutscene then
    teleportFloor = g.cutSceneMaster.getStageFloor()
  else
    teleportFloor = me.big.getRect().bottom
  end if
  return teleportFloor
end

on cancelMoveTo me
  myMode = me.id.bigMe.getMode()
  if myMode = #moveToLoc then
    me.id.bigMe.goMode(#walk)
  end if
end

on displaySpeech me, theSpeech
  case pSpeechDisplayMode of
    #ingame:
      me.displaySpeechInGame(theSpeech)
    #cutscene:
      me.displaySpeechCutScene(theSpeech)
  end case
end

on displaySpeechCutScene me, theSpeech
  pTextMember.text = theSpeech
  speechFloor = g.cutSceneMaster.getSpeechFloor()
  leftStage = g.cutSceneMaster.getStageLeft()
  rightStage = g.cutSceneMaster.getStageRight()
  textBoxHeight = pTextMember.height
  yLoc = speechFloor - textBoxHeight
  textHalfWidth = pTextMember.width / 2
  xLoc = me.id.bigMe.getLoc().locH - textHalfWidth
  charWidth = theSpeech.chars.count * pSpeechCharWidth
  if charWidth > pTextMember.width then
    charWidth = pTextMember.width
  end if
  edgeToCharGap = (pTextMember.width - charWidth) / 2
  charLeft = xLoc + edgeToCharGap
  charRight = xLoc + pTextMember.width - edgeToCharGap
  if charLeft < leftStage then
    xLoc = leftStage - edgeToCharGap
  end if
  if charRight > rightStage then
    xLoc = rightStage - charWidth - edgeToCharGap
  end if
  pTextSprite.loc = point(xLoc, yLoc)
end

on displaySpeechInGame me, theSpeech
  pTextMember.text = theSpeech
  speechLoc = me.id.bigMe.getLoc() + pSpeechOffset
  speechLoc.locV = speechLoc.locV - pTextMember.height
  pTextSprite.loc = speechLoc
  if theSpeech = EMPTY then
    pSpeechBackgroundSprite.rect = rect(-1, -1, 0, 0)
  else
    backWidth = theSpeech.chars.count * pSpeechCharWidth
    if backWidth > pTextMember.width then
      backWidth = pTextMember.width
    end if
    centreX = me.id.bigMe.getLoc()[1]
    backRect = rect(centreX - (backWidth / 2), speechLoc[2], centreX + (backWidth / 2), speechLoc[2] + pTextMember.height)
    backRect = backRect + pSpeechBackgroundBorder
    pSpeechBackgroundSprite.rect = backRect
  end if
end

on enterStageLeft me
  stageOnLoc = me.pScriptPerformer.getStageLeftOnLoc()
  me.at(me.calcStageLeftOffLoc())
  me.walkTo(stageOnLoc)
end

on enterStageRight me
  stageOnLoc = me.pScriptPerformer.getStageRightOnLoc()
  me.at(me.calcStageRightOffLoc())
  me.walkTo(stageOnLoc)
end

on fadeDown me
  me.big.startSlowFadeOut()
end

on faderFin me
  if pScriptPerformer <> #none then
    pScriptPerformer.playerFaderFin()
  end if
end

on freeTextMember me
  if pTextMember <> #none then
    g.memberMaster.freeMember(pTextMember)
    pTextMember = #none
    g.spriteMaster.freeSprite(pTextSprite)
    pTextSprite = #none
  end if
  if pSpeechBackgroundSprite <> #none then
    g.spriteMaster.freeSprite(pSpeechBackgroundSprite)
    pSpeechBackgroundSprite = #none
  end if
end

on goThespianMode me
  CounterReset(pSkipCounter)
  me.acquireTextMember()
  me.pAI.goThespianMode()
end

on goThespMode me, newMode
  case newMode of
    #displayLine:
      pFrameCounter.tim[2] = pTheLine.displayTime
      CounterReset(pFrameCounter)
      pTheLine.args = me.interpretSpeechVariables(pTheLine.args)
      me.displaySpeech(pTheLine.args)
    #delayAfterLine:
      pFrameCounter.tim[2] = pTheLine.delayTime
      CounterReset(pFrameCounter)
      me.displaySpeech(EMPTY)
  end case
  pThespMode = newMode
end

on gotoWings me
  pScriptPerformer.actorToWings(pScriptPerformerActorID)
end

on internalEvent me, theEvent
  ancestor.internalEvent(theEvent)
  case theEvent of
    #moveToLocFinished:
      me.moveToLocFinished()
  end case
end

on interpretLoc me, theloc
  if ilk(theloc, #point) then
    return theloc
  else
    stageFloor = g.cutSceneMaster.getStageFloor()
    yLoc = me.id.bigMe.positionEdge(#bottom, stageFloor)
    return point(theloc, yLoc)
  end if
end

on interpretSpeechVariables me, theSpeechText
  repeat with i = theSpeechText.words.count down to 1
    nWord = theSpeechText.word[i]
    if nWord = "#key" then
      currentKey = g.keyMaster.getKeyFor(value(theSpeechText.word[i + 1]))
      theSpeechText = theSpeechText.word[1..i - 1] && QUOTE & currentKey & QUOTE && theSpeechText.word[i + 2..theSpeechText.words.count]
    end if
  end repeat
  return theSpeechText
end

on leaveThespianMode me
  me.goThespMode(#waitForNextLine)
  me.freeTextMember()
  me.pAI.leaveThespianMode()
end

on lineFinished me
  me.goThespMode(#waitForNextLine)
  pScriptPerformer.lineFinished()
end

on lockTurnToFace me
  pTurnToFaceLocked = 1
end

on moveXYFin me
  if pThespMode = #slideExit then
    me.gotoWings()
  end if
end

on moveToLocFinished me
  me.unlockTurnToFace()
  if pExitingStage = 1 then
    me.gotoWings()
  end if
end

on performLine me, theLine
  pTheLine = theLine
  case theLine.theCommand of
    #at:
      me.at(pTheLine.args)
      me.lineFinished()
    #atPlayer:
      me.atPlayer(pTheLine.args)
      me.lineFinished()
    #dropProp:
      me.big.dropProp()
      me.lineFinished()
    #enterStageLeft:
      pExitingStage = 0
      me.enterStageLeft()
      me.lineFinished()
    #enterStageRight:
      pExitingStage = 0
      me.enterStageRight()
      me.lineFinished()
    #exitStageLeft:
      pExitingStage = 1
      me.walkTo(me.calcStageLeftOffLoc())
      me.lineFinished()
    #exitStageRight:
      pExitingStage = 1
      me.walkTo(me.calcStageRightOffLoc())
      me.lineFinished()
    #fadeDown:
      me.fadeDown()
      me.lineFinished()
    #goMode:
      me.big.goMode(pTheLine.args)
      me.lineFinished()
    #gotoWings:
      me.gotoWings()
      me.lineFinished()
    #goWastedMode:
      me.id.bigMe.wastedModeOn()
      me.reAlignToStageFloor()
      me.lineFinished()
    #propAt:
      me.big.setPropStatus(#prop)
      me.at(pTheLine.args)
      me.lineFinished()
    #produceProp:
      me.produceProp()
      me.lineFinished()
    #putAwayProp:
      me.big.putAwayProp()
      me.lineFinished()
    #speakLine:
      me.speakLine()
    #teleportInAt:
      me.id.bigMe.teleportInAt(me.interpretLoc(pTheLine.args))
      me.lineFinished()
    #teleportOut:
      me.id.bigMe.teleportOut(#modThespian, me.calcTeleportFloor())
      me.lineFinished()
    #turnToFace:
      me.turnToFace(pTheLine.args)
      me.lineFinished()
    #walkTo:
      pExitingStage = 0
      me.walkTo(pTheLine.args)
      me.lineFinished()
    #walkToPlayer:
      pExitingStage = 0
      me.walkToPlayer(pTheLine.args)
      me.lineFinished()
  end case
end

on produceProp me
  bigMe = me.id.bigMe
  propCharacter = pTheLine.args
  propObj = pScriptPerformer.getPlayer(propCharacter)
  bigMe.carryProp(propObj)
  propObj.beProducedAsProp(bigMe)
end

on reAlignToStageFloor me
  stageFloor = g.cutSceneMaster.getStageFloor()
  bigMe = me.id.bigMe
  xLoc = bigMe.getLoc().locH
  yLoc = bigMe.positionEdge(#bottom, stageFloor)
  bigMe.setLoc(point(xLoc, yLoc))
end

on setScriptPerformer me, newVal
  pScriptPerformer = newVal
end

on setScriptPerformerActorID me, newVal
  pScriptPerformerActorID = newVal
end

on setSpeechDisplayMode me, newVal
  pSpeechDisplayMode = newVal
  case pSpeechDisplayMode of
    #ingame:
      pMyLayer = gGameTextLayer
    #cutscene:
      pMyLayer = gCutSceneSpeechLayer
  end case
end

on speakLine me
  me.goThespMode(#displayLine)
end

on teleportOutFinished me, caller
  ancestor.teleportOutFinished(caller)
  if caller = #modThespian then
    me.gotoWings()
  end if
end

on turnToFace me, objCharacter
  if pTurnToFaceLocked then
    return 
  end if
  if me.big.getPropStatus() = #prop then
    return 
  end if
  playerToFace = pScriptPerformer.getPlayer(objCharacter)
  locToFace = playerToFace.getLoc()
  dirToFace = PointDirPoint(me.id.bigMe.getLoc(), locToFace)
  me.id.bigMe.setSpriteFlipFromDir(dirToFace[1])
end

on startWalkScrollLeft me
  if me.big.getPropStatus() = #notAProp then
    me.cancelMoveTo()
    me.lockTurnToFace()
    me.setSpriteFlipFromDir(-1)
    me.moveHorizReaction(-1)
  else
    me.big.propExitStageRight()
  end if
end

on startWalkScrollRight me
  if me.big.getPropStatus() = #notAProp then
    me.cancelMoveTo()
    me.lockTurnToFace()
    me.setSpriteFlipFromDir(1)
    me.moveHorizReaction(1)
  else
    me.big.propExitStageLeft()
  end if
end

on stopWalkScroll me
  if me.big.getPropStatus() = #notAProp then
    me.unlockTurnToFace()
    me.moveHorizReaction(0)
  else
    me.big.stopPropExit()
  end if
end

on unlockTurnToFace me
  pTurnToFaceLocked = 0
end

on update me
  if pSkipCounter.fin = 0 then
    counter(pSkipCounter)
  end if
  case pThespMode of
    #displayLine:
      fin = me.updateFrameWait()
      if fin then
        me.goThespMode(#delayAfterLine)
      end if
    #delayAfterLine:
      fin = me.updateFrameWait()
      if fin then
        me.lineFinished()
      end if
  end case
  ancestor.update()
end

on updateFrameWait me
  if pFrameCounter.fin then
    return 1
  end if
  counter(pFrameCounter)
  return 0
end

on walkTo me, theloc
  me.lockTurnToFace()
  theloc = me.interpretLoc(theloc)
  me.id.bigMe.moveToLoc(theloc)
end

on walkToPlayer me, thename
  playerToWalkTo = pScriptPerformer.getPlayer(thename)
  locToWalkTo = playerToWalkTo.getLoc()
  xLoc = locToWalkTo.locH
  me.walkTo(xLoc)
end
