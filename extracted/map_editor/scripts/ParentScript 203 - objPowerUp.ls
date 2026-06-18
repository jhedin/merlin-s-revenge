property ancestor, pCharacter, pFlasher, pmode, pTimeAlive, pTimeAliveCounter
global g

on new me
  ancestor = new(script("objAiGameObject"))
  i = me.pParams.init
  i[#timeAlive] = 0
  return me
end

on init me, params
  ancestor.init(params)
  pCharacter = params.character
  pFlasher = #none
  pTimeAlive = params.timeAlive
  if pTimeAlive > 0 then
    pTimeAliveCounter = CounterNew()
    pTimeAliveCounter.tim[2] = pTimeAlive
    me.goMode(#timed)
  else
    me.goMode(#norm)
  end if
end

on collected me
  player = g.actorMaster.getPlayer()
  case pCharacter of
    #hairDrop:
      player.hairDropCollected()
    #hairPowerUp:
      player.growHairSequence()
  end case
  if pFlasher <> #none then
    pFlasher.cancel()
  end if
end

on flasherFinished me
  me.setDead(1)
end

on goMode me, newMode
  case newMode of
    #dead:
      pFlasher = g.objectMaster.requestObject(#objFlasher)
      pFlasher.init(me, me.pSpr, 30)
  end case
  pmode = newMode
end

on update me
  ancestor.update()
  case me.pmode of
    #timed:
      fin = me.updateTimed()
      if fin then
        me.goMode(#dead)
      end if
  end case
end

on updateTimed me
  if pTimeAliveCounter.fin then
    return 1
  end if
  counter(pTimeAliveCounter)
end
