property ancestor, pAliveWeight, pBonusEnergy, pDieWeight, pDieVectY, pEnergyBar, pLeaveDir, pLeaveMode, pOverlapToLeaveRoom, pLastLeaveFrameNum
global g, gFrameNum, gMapBoundaryLayer, gNavMode

on new me
  me.ancestor = new(script("objCharacter"))
  i = me.modifyParams(#init)
  i.allowScreenExit = 1
  i.character = #playerCharacter
  i.flags.append(#objPlayerCharacter)
  i.flags.append(#player)
  i.energy = 100
  i[#overlapToLeaveRoom] = 14
  me.addModule("modInvince")
  me.addModule("modMedikit")
  me.addModule("modNavMode")
  me.addModule("modProp")
  me.addModule("modStretchDeath")
  me.addModule("modSummonWizard")
  me.addModule("modThespian")
  me.addModule("modWeaponSelector")
  me.addModule("modGoldenMachineGun")
  me.addModule("modAutoSummon")
  return me
end

on init me, params
  pOverlapToLeaveRoom = params.overlapToLeaveRoom
  me.ancestor.init(params)
  pAliveWeight = params.weight
  pBonusEnergy = 25
  pDieVectY = -15
  pDieWeight = 0.59999999999999998
  pLeaveDir = point(0, 0)
  pLeaveMode = #none
  pEnergyBar = g.objectMaster.requestObject(#objMulticolourEnergyBar)
  surroundSpr = g.spriteMaster.getSpriteWithMember(member("health_bar_surround", "gfx"))
  surroundSpr.locZ = surroundSpr.locZ + gMapBoundaryLayer
  surroundRect = surroundSpr.rect.duplicate()
  params = pEnergyBar.getParams(#init)
  params.surroundRect = surroundRect
  params.surroundSpr = surroundSpr
  params.maxEnergy = me.pEnergy
  params.currentEnergy = me.pEnergy
  pEnergyBar.init(params)
end

on finish me
  pEnergyBar.finish()
  ancestor.finish()
end

on calcLeaveDir me, zoneType
  leaveDir = point(0, 0)
  case zoneType of
    #ceiling:
      leaveDir[2] = -1
    #platform:
      leaveDir[2] = 1
    #wallLeft:
      leaveDir[1] = -1
    #wallRight:
      leaveDir[1] = 1
  end case
  return leaveDir
end

on checkCollisions me, newLoc, oldloc
  newLoc = ancestor.checkCollisions(newLoc, oldloc)
  return newLoc
end

on energyChanged me
  pEnergyBar.updateEnergy(me.pEnergy)
end

on getAnimSym me, sym
  sym = ancestor.getAnimSym(sym)
  return sym
end

on goMode me, newMode
  case newMode of
    #dead:
      nothing()
    #die:
      me.startStretchDeath()
    #reel:
      newMode = me.pmode
  end case
  ancestor.goMode(newMode)
end

on internalEvent me, theEvent
  ancestor.internalEvent(theEvent)
  case theEvent of
    #maxEnergyChanged:
      pEnergyBar.setMaxEnergy(me.getMaxEnergy())
      pEnergyBar.updateEnergy(me.getEnergy())
    #stretchDeathFin:
      me.stretchDeathFin()
  end case
end

on medikitCollected me, medType
  me.startTempInvince()
  if medType = #medikit then
    ancestor.medikitCollected()
    me.increaseEnergy(pBonusEnergy)
  else
    me.increaseEnergy(me.getMaxEnergy() - me.getEnergy())
  end if
end

on newScrollCollected me, scrollType, theAttack
  if scrollType <> #gmg then
    me.addWeapon(scrollType, theAttack)
    me.increaseEnergy(pBonusEnergy)
  else
    me.gmgCollected()
  end if
  me.startTempInvince()
end

on outsidePlayArea me, exitDir
  pLeaveMode = me.getMode()
  pLeaveDir = exitDir
  me.goMode(#leaveRoom)
  ancestor.outsidePlayArea(exitDir)
  g.teamMaster.setRoomClear(0)
end

on potionCollected me, character, thePotion
  case character of
    #manaBurst:
      me.incManaBurstPotion()
    #manaCapacity:
      me.incManaCapacityPotion()
    #manaFlow:
      me.incManaFlowPotion()
    #walkSpeed:
      me.incWalkAcceleration(#potion)
  end case
  me.startTempInvince()
  me.increaseEnergy(pBonusEnergy)
  g.potionMaster.potionCollected(thePotion)
end

on respawn me
  me.setWeight(pAliveWeight)
  me.goMode(#fall)
  me.pAI.restorePlayerControl()
  ancestor.respawn()
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
end

on stretchDeathFin me
  if me.modIsInstalled(#modExtraLives) then
    gameOver = me.attemptRespawn()
  else
    gameOver = 1
  end if
  if gameOver then
    g.gamemaster.gameOver()
  end if
end

on takeHit me, collideVect, attackingObj, owner
  if me.pmode = #die then
    return 
  end if
  me.ancestor.takeHit(collideVect, attackingObj, owner)
  me.goMode(#walk)
  if me.checkDead() then
    me.goMode(#die)
    if me.modIsInstalled(#modExtraLives) then
      me.recordRespawnPoint()
    end if
  end if
end

on update me
  gameOver = 0
  case me.pmode of
    #leaveRoom:
      if gNavMode = 1 then
        me.leaveNavMode()
        g.gamemaster.leaveNavMode()
      end if
      themap = g.gamemaster.getCurrentMap()
      themap.moveRoom(pLeaveDir)
      myVect = me.getVect()
      roomSize = themap.getRoomSizeInPixels()
      moveAmount = roomSize
      moveAmount = moveAmount * (pLeaveDir * point(-1, -1))
      me.pMoveXY.setLoc(me.getLoc() + moveAmount)
      me.setVect(myVect)
      me.pmode = pLeaveMode
      me.eventNotify(#enteringNewRoom)
  end case
  ancestor.update()
end

on updateDie me
  if me.pMoveXY.onscreen() = 0 then
    return 1
  end if
  return 0
end
