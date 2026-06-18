property pDelayCount, pScreenList, pTransitionList
global g

on new me
  return me
end

on init me
  pDelayCount = CounterNew()
  pDelayCount.tim[2] = 30
  pDelayCount.fin = 1
  pScreenList = g.objectMaster.requestObject(#objlist)
  pScreenList.init([#merlinScreen, #steveScreen, #newScreen, #titleScreen])
  pTransitionList = g.objectMaster.requestObject(#objlist)
  pTransitionList.init([#overlay, #blast])
end

on goNextScreen me
  nScreen = pScreenList.nextValue()
  params = g.screenMaster.getParams(#goScreen)
  params.caller = me
  params.transition = pTransitionList.nextValue()
  params.screenSym = nScreen
  g.screenMaster.goScreen(params)
end

on goScreenFinished me
  me.start()
end

on start me
  g.updater.addPrg(me, #med)
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
