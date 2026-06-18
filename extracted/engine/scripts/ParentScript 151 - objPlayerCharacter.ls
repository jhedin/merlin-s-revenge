property ancestor, pAliveWeight, pDieWeight, pDieVectY, pEnergyBar, pLeaveDir, pLeaveMode, pOverlapToLeaveRoom, pTakeHitSound
global g, gFrameNum, gNavMode

on new me
  me.ancestor = new(script("objHairCharacter"))
  i = me.modifyParams(#init)
  i.character = #playerCharacter
  i.allowScreenExit = 1
  i.flags.append(#objPlayerCharacter)
  i.flags.append(#player)
  i.energy = 100
  i[#overlapToLeaveRoom] = 14
  i[#takeHitSound] = #none
  me.addModule("modExtraLives")
  me.addModule("modNavMode")
  me.addModule("modProp")
  me.addModule("modThespian")
  return me
end

on init me, params
  pOverlapToLeaveRoom = params.overlapToLeaveRoom
  ancestor.init(params)
  pAliveWeight = params.weight
  pDieVectY = -15
  pDieWeight = 0.59999999999999998
  pLeaveDir = point(0, 0)
  pLeaveMode = #none
  pTakeHitSound = params.takeHitSound
  pEnergyBar = g.objectMaster.requestObject(#objEnergyBar)
  surroundSpr = g.spriteMaster.getSpriteWithMember(member("health_bar_surround", "gfx"))
  surroundRect = surroundSpr.rect.duplicate()
  params = pEnergyBar.getParams(#init)
  params.surroundSpr = surroundSpr
  params.surroundRect = surroundRect
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

on getVect me
  vect = ancestor.getVect()
  if me.pmode = #die then
    if vect[2] > 0 then
      vect[2] = 0
    end if
  end if
  return vect
end

on goMode me, newMode
  case newMode of
    #die:
      me.pSpr.flipH = 0
      me.pMoveXY.setVectY(pDieVectY)
      me.pMoveXY.setWeight(pDieWeight)
  end case
  ancestor.goMode(newMode)
end

on outsidePlayArea me, exitDir
  if me.pmode = #die then
    nothing()
  else
    pLeaveMode = me.getMode()
    pLeaveDir = exitDir
    me.goMode(#leaveRoom)
    ancestor.outsidePlayArea(exitDir)
  end if
end

on respawn me
  me.setWeight(pAliveWeight)
  me.goMode(#fall)
  me.pAI.restorePlayerControl()
  ancestor.respawn()
end

on takeHit me, collideVect
  if me.pmode = #die then
    return 
  end if
  speedVect = PointPositive(collideVect.duplicate())
  me.pEnergy = me.pEnergy - speedVect[1] - speedVect[2]
  me.energyChanged()
  me.PlaySound(me.pTakeHitSound)
  me.ancestor.takeHit(collideVect)
  if me.checkDead() then
    me.goMode(#die)
    me.recordRespawnPoint()
  end if
end

on update me
  gameOver = 0
  case me.pmode of
    #die:
      fin = me.updateDie()
      if fin then
        gameOver = me.attemptRespawn()
      end if
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
      ancestor.leaveRoom(moveAmount)
      me.pmode = pLeaveMode
  end case
  ancestor.update()
  if gameOver then
    g.gamemaster.gameOver()
  end if
end

on updateDie me
  if me.pMoveXY.onscreen() = 0 then
    return 1
  end if
  return 0
end
