property ancestor, pCharacter, pCollectSound, pFlasher, pmode, pTimeAlive, pTimeAliveCounter
global g

on new me
  ancestor = new(script("objAiGameObject"))
  i = me.modifyParams(#init)
  i[#timeAlive] = 0
  i[#collectSound] = #none
  return me
end

on init me, params
  ancestor.init(params)
  pCharacter = params.character
  pCollectSound = params.collectSound
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

on finish me
  me.finishFlasher()
  ancestor.finish()
end

on finishFlasher me
  if pFlasher <> #none then
    pFlasher.cancel()
    pFlasher = #none
  end if
end

on collected me
  player = g.actorMaster.getPlayer()
  me.PlaySound(pCollectSound)
  case pCharacter of
    #hairConditioner:
      player.hairConditionerCollected()
    #hairDrop:
      player.hairDropCollected()
    #hairGem:
      player.lifePowerUpCollected()
      player.increaseEnergy(2)
    #hairPowerUp:
      player.hairPotionCollected()
    #hairPotion:
      player.hairPotionCollected()
    #superHairConditioner:
      g.gamemaster.gameComplete()
  end case
  me.finishFlasher()
  me.setDead(1)
end

on flasherFinished me
  me.setDead(1)
  pFlasher = #none
end

on getAnimMember me
  return me.getMember()
end

on goMode me, newMode
  case newMode of
    #dead:
      pFlasher = g.objectMaster.requestObject(#objFlasher)
      params = pFlasher.getParams(#init)
      params.callingPrg = me
      params.spr = me.pSpr
      params.time = 30
      pFlasher.init(params)
  end case
  ancestor.goMode(newMode)
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
