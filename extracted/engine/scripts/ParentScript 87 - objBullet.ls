property ancestor, pCollideWithTarget, pLastDistXY, pPlayer, pRestoreMode, pStallSpeed, pTargetLoc, pRandomTarget, pHScale
global g, gBulletsCollideWithBackground, gGameBulletLayer

on new me
  ancestor = new(script("objGameObject"))
  i = me.modifyParams(#init)
  i[#attack] = g.structMaster.getStruct(#attack)
  i[#collideWithTarget] = 1
  i[#stallSpeed] = point(2, 2)
  pHScale = 0
  me.addModule("modAnimSet")
  me.addModule("modAttack")
  me.addModule("modExploder")
  me.addModule("modGrave")
  me.addModule("modRotational")
  me.addModule("modSplashDamage")
  me.addModule("modReincarnate")
  me.addModule("modRotator")
  me.addModule("modListNode")
  return me
end

on addModParams me
  ancestor.addModParams()
  i = me.modifyParams(#init)
  i.collisionRectType = #dynamic
  i.layerZ = gGameBulletLayer
  i[#rotational] = #once
end

on init me, params
  ancestor.init(params)
  me.setAttack(params.attack)
  pCollideWithTarget = params.collideWithTarget
  pLastDistXY = point(99999, 99999)
  pPlayer = g.actorMaster.getPlayer()
  pStallSpeed = params.stallSpeed
  pTargetLoc = #none
  pRandomTarget = #none
  me.goMode(#fly)
end

on finish me
  pPlayer = #none
  ancestor.finish()
end

on addSaveData me, sd
  ancestor.addSaveData(sd)
  sd[#bulletTargetLoc] = pTargetLoc
end

on checkCollisionWithTarget me
  myTarget = me.getRelation(#target)
  if (myTarget = #none) and (pRandomTarget <> #none) then
    if (pRandomTarget.checkDead() = 0) and (pRandomTarget.getDead() = 0) then
      myTarget = pRandomTarget
    end if
  end if
  if pCollideWithTarget = 0 then
    return 0
  end if
  if myTarget = #none then
    myTarget = g.teamMaster.findTarget(me.big).obj
    pRandomTarget = myTarget
  end if
  if myTarget <> #none then
    collided = CollisionCheck(me.big, myTarget)
  end if
  return collided
end

on checkCollisions me, newLoc, oldloc
  theloc = newLoc.duplicate()
  if gBulletsCollideWithBackground then
    updatedLoc = ancestor.checkCollisions(newLoc, oldloc)
  end if
  return theloc
end

on checkDead me
  if me.getMode() = #land then
    return 1
  end if
  return 0
end

on checkStalled me
  movevect = me.getMoveVect()
  if movevect = #none then
    return 0
  end if
  movevect = PointPositive(movevect)
  if (movevect[1] < pStallSpeed[1]) and (movevect[2] < pStallSpeed[2]) then
    return 1
  end if
  return 0
end

on collisionPlatform me
  me.goMode(#land)
end

on collisionCeiling me
  me.goMode(#land)
end

on collisionWallLeft me
  me.goMode(#land)
end

on collisionWallRight me
  me.goMode(#land)
end

on die me
  me.setDead(1)
end

on eventNotification me, theEvent, theObj
  ancestor.eventNotification(theEvent, theObj)
  case theEvent of
    #outOfEnergy, #leaveGame:
      myTarget = me.getRelation(#target)
      if theObj = myTarget then
        me.breakRelationship(theObj, #target)
      end if
  end case
end

on getAnimSym me, sym
  sym = me.getMode()
  case sym of
    #stand:
      sym = #fly
  end case
  return sym
end

on goMode me, newMode
  case newMode of
    #explode:
      me.setVect(point(0, 0))
      me.resetAnim(#explode)
    #land:
      me.setVect(point(0, 0))
      me.big.internalEvent(#land)
  end case
  ancestor.goMode(newMode)
end

on internalEvent me, theEvent
  ancestor.internalEvent(theEvent)
  case theEvent of
    #bulletLanded, #bulletArrivedAtTargetLoc:
      if me.getMode() = #fly then
        me.big.goMode(#land)
      end if
    #explodeFin:
      me.setDead(1)
  end case
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
  pTargetLoc = sd.bulletTargetLoc
end

on setBeam me, dist, distxy
  pHScale = dist + 1
  me.setSpriteWidth(pHScale)
  me.setAnimKeepSize(1)
  rot = GeomAngle(distxy)
  me.id.bigMe.setSpriteRotation(rot)
end

on setTarget me, theTarget
  if theTarget = #none then
    return 
  end if
  me.formRelationship(theTarget, #target, #exclusive)
  me.keepMePosted(theTarget, #leaveGame, #once)
  me.keepMePosted(theTarget, #outOfEnergy, #once)
  if theTarget.isGhost() then
    pCollideWithTarget = 0
  end if
end

on setTargetLoc me, theloc
  pTargetLoc = theloc
end

on takeHit me, collisionVect
  if me.getMode() = #land then
    return 
  else
    ancestor.takeHit(collisionVect)
  end if
end

on update me
  case me.getMode() of
    #land:
      fin = me.updateLand()
      if fin then
        me.setDead(1)
        me.big.reincarnate()
      end if
    #fly:
      stat = me.updateFly()
      if stat = #stalled then
        me.big.internalEvent(#bulletLanded)
      end if
      if stat = #hitCharacter then
        me.big.internalEvent(#bulletCollidedWithTarget)
      end if
      if stat = #arrived then
        me.big.internalEvent(#bulletArrivedAtTargetLoc)
      end if
  end case
  ancestor.update()
end

on updateLand me
  fin = me.getAnimLooped(#land)
  return fin
end

on updateFly me
  stat = #continu
  if me.checkStalled() then
    stat = #stalled
  end if
  if me.checkCollisionWithTarget() then
    myTarget = me.getRelation(#target)
    if myTarget = #none then
      myTarget = pRandomTarget
    end if
    collisionVect = me.calcCollisionVect(myTarget)
    myTarget.takeHit(collisionVect, me.big, me.getOwner())
    payloadFunctions = me.big.getAttack().payLoadFunction
    CallPayloadFunction(payloadFunctions, myTarget, collisionVect, me.big, me.getOwner())
    stat = #hitCharacter
  end if
  return stat
end
