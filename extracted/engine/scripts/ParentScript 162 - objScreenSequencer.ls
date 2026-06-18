property ancestor, pBackButton, pBackButtonTextParams, pButtonLocation, pButtonMargins, pDelayCount, pDelayType, pLoopTheSequence, pNextButton, pNextButtonTextParams, pReturnScreen, pReturnButton, pReturnButtonText, pReturnButtonTextParams, pScreenList, pTransitionList
global g, gStageSize

on new me
  ancestor = new(script("objParams"))
  i = me.modifyParams(#init)
  i[#backButtonTextParams] = g.memberMaster.getParams(#requestTextMember)
  i[#buttonMargins] = point(20, 40)
  i[#buttonLocation] = #bottom
  i[#callingPrg] = #none
  i[#delayCount] = 60
  i[#delayType] = #manual
  i[#loopTheSequence] = 0
  i[#nextButtonTextParams] = g.memberMaster.getParams(#requestTextMember)
  i[#returnButtonText] = "Return to Previous Screen"
  i[#returnButtonTextParams] = g.memberMaster.getParams(#requestTextMember)
  i[#returnScreen] = #none
  i[#screenList] = [#none]
  i[#transitionList] = [#fade]
  return me
end

on init me, params
  pBackButton = #none
  pBackButtonTextParams = params.backButtonTextParams
  pButtonLocation = params.buttonLocation
  pButtonMargins = params.buttonMargins
  pDelayCount = CounterNew()
  pDelayCount.tim[2] = params.delayCount
  pDelayCount.fin = 1
  pDelayType = params.delayType
  pLoopTheSequence = params.loopTheSequence
  pNextButton = #none
  pNextButtonTextParams = params.nextButtonTextParams
  pReturnButton = #none
  pReturnScreen = params.returnScreen
  pReturnButtonText = params.returnButtonText
  pReturnButtonTextParams = params.returnButtonTextParams
  pScreenList = g.objectMaster.requestObject(#objlist)
  pScreenList.init(params.screenList)
  pTransitionList = g.objectMaster.requestObject(#objlist)
  pTransitionList.init(params.transitionList)
end

on finish me
  me.stop()
  pScreenList.finish()
  pTransitionList.finish()
  me.finishButtons()
  ancestor.finish()
end

on finishButtons me
  if pBackButton <> #none then
    pBackButton.finish()
    pBackButton = #none
  end if
  if pNextButton <> #none then
    pNextButton.finish()
    pNextButton = #none
  end if
  if pReturnButton <> #none then
    pReturnButton.finish()
    pReturnButton = #none
  end if
end

on buttClicked me, theButt
  case theButt of
    #butt_back:
      me.goPrevScreen()
    #butt_next:
      me.goNextScreen()
    #butt_return:
      me.goScreen(pReturnScreen)
      me.finish()
  end case
end

on calcButtLoc me, which, thewidth
  buttLoc = point(0, 0)
  case pButtonLocation of
    #bottom:
      buttLoc[2] = gStageSize[2] - pButtonMargins[2]
      case which of
        #back:
          buttLoc[1] = pButtonMargins[1]
        #next:
          buttLoc[1] = gStageSize[1] - thewidth - pButtonMargins[1]
        #return:
          buttLoc[1] = (gStageSize[1] / 2) - (thewidth / 2)
      end case
  end case
  return buttLoc
end

on goNextScreen me
  if pScreenList.getLooped() then
    if pLoopTheSequence = 0 then
      me.finish()
      return 
    end if
  end if
  nScreen = pScreenList.nextValue()
  me.goScreen(nScreen)
end

on goPrevScreen me
  nScreen = pScreenList.prevValue()
  me.goScreen(nScreen)
end

on goScreen me, theScreen
  params = g.screenMaster.getParams(#goScreen)
  params.caller = me
  params.transition = pTransitionList.nextValue()
  params.screenSym = theScreen
  g.screenMaster.goScreen(params)
  if pDelayType = #manual then
    me.startButtons()
  end if
end

on goScreenFinished me
  case pDelayType of
    #automatic:
      me.start()
  end case
end

on start me
  case pDelayType of
    #automatic:
      g.updater.addPrg(me, #med)
      me.startReturnButton()
    #manual:
      me.startButtons()
      me.goNextScreen()
  end case
end

on startBackButton me
  pBackButton = g.objectMaster.requestObject(#objTextButton)
  params = pBackButton.getParams(#init)
  params.callingPrg = me
  params.commSym = #butt_back
  params.location = me.calcButtLoc(#back, pBackButtonTextParams.width)
  params.myText = "< Back"
  params.textParams = pBackButtonTextParams
  pBackButton.init(params)
  pBackButton.activate()
end

on startButtons me
  me.finishButtons()
  if pScreenList.atStart() = 0 then
    me.startBackButton()
  end if
  if pScreenList.atEnd() = 0 then
    me.startNextButton()
  end if
  me.startReturnButton()
end

on startNextButton me
  pNextButton = g.objectMaster.requestObject(#objTextButton)
  params = pNextButton.getParams(#init)
  params.callingPrg = me
  params.commSym = #butt_next
  params.location = me.calcButtLoc(#next, pNextButtonTextParams.width)
  params.myText = "Next >"
  params.textParams = pNextButtonTextParams
  pNextButton.init(params)
  pNextButton.activate()
end

on startReturnButton me
  if pReturnScreen <> #none then
    pReturnButton = g.objectMaster.requestObject(#objTextButton)
    params = pReturnButton.getParams(#init)
    params.callingPrg = me
    params.commSym = #butt_return
    params.location = me.calcButtLoc(#return, pReturnButtonTextParams.width)
    params.myText = pReturnButtonText
    params.textParams = pReturnButtonTextParams
    pReturnButton.init(params)
    pReturnButton.activate()
  end if
end

on stop me
  g.updater.removePrg(me)
end

on update me
  if pDelayCount.fin then
    me.stop()
    me.goNextScreen()
  end if
  counter(pDelayCount)
end
