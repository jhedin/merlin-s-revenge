property ancestor, pDamageSpeed, pEnergyBar, pEnergyBarColour, pFlasher, pLookCounter, pLookDelayCounter, pReelFinishSpeed, pRecoil, pRecoilCounter, pRotationCounter, pSitCounter
global g, gGameSpeed

on new me
  ancestor = new(script("objCharacter"))
  i = me.pParams.init
  i.character = #enemyCharacter
  i.energyRecoverDelay = 300
  i[#attack] = g.structMaster.getStruct(#attack)
  i[#damageSpeed] = 5
  i[#energyBarColour] = rgb(0, 255, 0)
  i[#lookTimes] = 4
  i[#lookDelay] = 10
  i[#reelFinishSpeed] = 0.29999999999999999
  i[#recoil] = 0
  i[#recoilDuration] = 0
  i[#rotationSpeed] = 10
  i[#sitTime] = 30
  return me
end

on init me, params
  ancestor.init(params)
  pDamageSpeed = params.damageSpeed
  pEnergyBarColour = params.energyBarColour
  pFlasher = #none
  pLookCounter = CounterNew()
  pLookCounter.tim[2] = params.lookTimes
  pLookDelayCounter = CounterNew()
  pLookDelayCounter.tim[2] = params.lookDelay
  pLookDelayCounter.inc = gGameSpeed
  pReelFinishSpeed = params.reelFinishSpeed
  pRecoil = params.recoil
  pRecoilCounter = CounterNew()
  pRecoilCounter.tim = [0, params.recoilDuration]
  pRotationCounter = CounterNew()
  pRotationCounter.tim[2] = 360
  pRotationCounter.inc = params.rotationSpeed
  pSitCounter = CounterNew()
  pSitCounter.tim[2] = params.sitTime
  pSitCounter.inc = gGameSpeed
end

on initEnergyBar me
  pEnergyBar = g.EnemyEnergyMaster.requestEnergyBar(me)
  if pEnergyBar <> #none then
    pEnergyBar.reset(me.pEnergy, me.pMaxEnergy, pEnergyBarColour)
  end if
end

on finish me
  g.EnemyEnergyMaster.freeEnergyBar(pEnergyBar, me)
  if me.pmode = #dead then
    pFlasher.cancel()
  end if
  ancestor.finish()
end

on collisionCeiling me
  me.collisionVertical()
  ancestor.collisionCeiling()
end

on collisionPlatform me
  me.collisionVertical()
  ancestor.collisionPlatform()
end

on collisionVertical me
  vectY = me.pMoveXY.getVectY()
  vectY = VarPositive(vectY)
  me.takeDamage(vectY)
end

on collisionWall me
  vectX = me.pMoveXY.getVectX()
  speedX = VarPositive(vectX)
  me.takeDamage(speedX)
end

on collisionWallLeft me
  me.collisionWall()
  ancestor.collisionWallLeft()
end

on collisionWallRight me
  me.collisionWall()
  ancestor.collisionWallRight()
end

on energyBarNowFree me
  me.initEnergyBar()
end

on energyChanged me
  if pEnergyBar <> #none then
    pEnergyBar.updateEnergy(me.pEnergy)
  end if
end

on flasherFinished me
  me.pDead = 1
  me.goMode(#finish)
end

on goDamageMode me
  if me.checkDead() then
    me.goMode(#reel_fly)
    return 
  end if
  if pRecoil then
    me.goMode(#recoil)
  else
    me.goMode(#reel_fly)
  end if
end

on goMode me, newMode
  case me.pmode of
    #recoil:
      me.frictionXOn()
      me.frictionYOn()
  end case
  case newMode of
    #dead:
      pFlasher = g.objectMaster.requestObject(#objFlasher)
      pFlasher.init(me, me.pSpr, 30)
    #landed, #reel_landed, #walk:
      me.pMoveXY.setVectY(0)
      me.frictionXOn()
    #look:
      CounterReset(pLookCounter)
      CounterReset(pLookDelayCounter)
    #recoil:
      me.frictionStrong()
      CounterReset(pRecoilCounter)
    #reel_fly:
      CounterReset(pRotationCounter)
      me.frictionXOff()
    #reel_sit:
      CounterReset(pSitCounter)
  end case
  ancestor.goMode(newMode)
end

on start me
  me.initEnergyBar()
  ancestor.start()
end

on takeDamage me, speed
  if me.pmode = #recoil then
    return 
  end if
  if speed > pDamageSpeed then
    me.loseEnergy(speed - pDamageSpeed)
  end if
end

on takeHit me, collisionVect
  if me.pmode <> #dead then
    if me.checkDead() = 0 then
      me.ancestor.takeHit(collisionVect)
      collSpeedX = VarPositive(collisionVect[1])
      collSpeedY = VarPositive(collisionVect[2])
      me.takeDamage(collSpeedX)
      me.takeDamage(collSpeedY)
      me.goDamageMode()
    end if
  end if
end

on update me
  case me.pmode of
    #look:
      fin = me.updateLook()
      if fin then
        me.goMode(#walk)
      end if
    #recoil:
      fin = me.updateRecoil()
      if fin then
        me.goMode(#stand)
      end if
    #reel_fly:
      me.updateReelFly()
    #reel_landed:
      fin = me.updateReelLanded()
      if fin then
        if me.checkDead() then
          me.goMode(#dead)
        else
          me.goMode(#reel_sit)
        end if
      end if
    #reel_sit:
      fin = me.updateReelSit()
      if fin then
        me.goMode(#look)
      end if
  end case
  ancestor.update()
end

on updateAI me
  me.checkCollisionsWithHair()
  ancestor.updateAI()
end

on updateLook me
  if pLookDelayCounter.fin then
    if pLookCounter.fin then
      return 1
    else
      spr = me.pSpr
      if spr.flipH then
        spr.flipH = 0
      else
        spr.flipH = 1
      end if
      counter(pLookCounter)
    end if
  end if
  counter(pLookDelayCounter)
  return 0
end

on updateRecoil me
  fin = 0
  if pRecoilCounter.fin then
    fin = 1
  end if
  counter(pRecoilCounter)
  return fin
end

on updateReelFly me
  me.pSpr.rotation = pRotationCounter.theCount
  counter(pRotationCounter)
end

on updateReelLanded me
  vectX = me.getVectX()
  speedX = VarPositive(vectX)
  if speedX < pReelFinishSpeed then
    return 1
  end if
  return 0
end

on updateReelSit me, callingPrg
  if pSitCounter.fin then
    return 1
  end if
  counter(pSitCounter)
  return 0
end
