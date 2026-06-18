property pActorList
global g

on new me
  return me
end

on init me
end

on gameOver me
  g.actorMaster.finishActors()
  g.EnemyEnergyMaster.finish()
  params = g.screenMaster.getParams(#goScreen)
  params.caller = me
  params.screenSym = #titleScreen
  params.transition = #fade
  g.screenMaster.goScreen(params)
end

on goScreenFinished me
end

on start me
  g.actorMaster.start()
  g.updater.addPrg(me, #med)
end

on update me
  g.keyMaster.checkKeys()
end

on stop me
end
