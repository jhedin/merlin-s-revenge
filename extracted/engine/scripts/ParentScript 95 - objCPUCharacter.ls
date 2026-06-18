property ancestor, pEnergyBar, pEnergyBarColour, pHitByHairSound, pLookCounter, pLookDelayCounter, pPathfinding, pRunReload, pTakeHitSound, pTakenHit
global g, gGameSpeed, gFrameNum, gPlayerHair

on new me
  ancestor = new(script("objCharacter"))
  i = me.modifyParams(#init)
  i.character = #enemyCharacter
  i.energyRecoverDelay = 300
  i.flags.append(#objEnemyCharacter)
  i[#energyBarColour] = rgb(0, 255, 0)
  i[#hitByHairSound] = #none
  i[#lookTimes] = 4
  i[#lookDelay] = 10
  i[#pathfinding] = 0
  i[#runReload] = 0
  i[#takeHitSound] = #none
  me.addModule("modFlasher")
  me.addModule("modGrave")
  return me
end

on init me, params
  ancestor.init(params)
  pEnergyBar = #none
  pEnergyBarColour = params.energyBarColour
  pLookCounter = CounterNew()
  pLookCounter.tim[2] = params.lookTimes
  pLookDelayCounter = CounterNew()
  pLookDelayCounter.tim[2] = params.lookDelay
  pLookDelayCounter.inc = gGameSpeed
  pHitByHairSound = params.hitByHairSound
  pPathfinding = params.pathfinding
  pReelFinishSpeed = params.reelFinishSpeed
  pRecoil = params.recoil
  pRecoilCounter = CounterNew()
  pRecoilCounter.tim = [0, params.recoilDuration]
  pRunReload = params.runReload
  pRotationCounter = CounterNew()
  pRotationCounter.tim[2] = 360
  pRotationCounter.inc = params.rotationSpeed
  pSitCounter = CounterNew()
  pSitCounter.tim[2] = params.sitTime
  pSitCounter.inc = gGameSpeed
  pTakeHitSound = params.takeHitSound
  pTakenHit = 0
  me.initEnergyBar()
end

on initEnergyBar me
  pEnergyBar = g.EnemyEnergyMaster.requestEnergyBar(me.id.bigMe)
  if pEnergyBar <> #none then
    pEnergyBar.reset(me.pEnergy, me.pMaxEnergy, pEnergyBarColour)
  end if
end

on finish me
  g.EnemyEnergyMaster.freeEnergyBar(pEnergyBar, me.id.bigMe)
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
  case me.big.getMode() of
    #reel, #reel_fly, #reel_land:
      me.takeDamage(vectY)
  end case
end

on collisionWall me
  vectX = me.pMoveXY.getVectX()
  speedX = VarPositive(vectX)
  case me.big.getMode() of
    #reel, #reel_fly, #reel_land:
      me.takeDamage(speedX)
  end case
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
  me.drawGrave()
  ancestor.flasherFinished()
end

on getPathFinding me
  return pPathfinding
end

on getRunReload me
  return pRunReload
end

on goMode me, newMode
  case me.pmode of
    #recoil:
      me.frictionXOn()
      me.frictionYOn()
  end case
  case newMode of
    #finish:
      me.drawGrave()
      me.setDead(1)
    #landed, #reelLanded, #walk:
      me.pMoveXY.setVectY(0)
      me.frictionNormal()
    #look:
      CounterReset(pLookCounter)
      CounterReset(pLookDelayCounter)
  end case
  ancestor.goMode(newMode)
end

on start me
  ancestor.start()
end

on takeHit me, collisionVect, attackingObj, owner
  if me.amGhost() then
    return 
  end if
  if me.pmode <> #dead then
    if me.checkDead() = 0 then
      me.PlaySound(pHitByHairSound)
      ancestor.takeHit(collisionVect, attackingObj, owner)
    end if
  end if
  pTakenHit = 1
end

on update me
  case me.pmode of
    #dead:
      fin = me.updateDead()
      if fin then
        me.goMode(#finish)
      end if
    #look:
      fin = me.updateLook()
      if fin then
        me.goMode(#walk)
      end if
  end case
  ancestor.update()
end

on updateAI me
  if gPlayerHair then
    me.checkCollisionsWithHair()
  end if
  ancestor.updateAI()
end

on updateDead me
  if me.getGraveOn() = 1 then
    me.setFlipFromDir(1)
    fin = me.getAnimLooped()
  else
    fin = 1
  end if
  return fin
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
