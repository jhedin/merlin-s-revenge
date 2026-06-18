property ancestor, pDownChain, pHairLength, pHairAdjustmentRect, pGrowHair, pGrowHairNum, pGrowHairTarget, pmode, pParasite, pPosInChain, pStartLocOffset, pUpChain
global g, gPlayerLayer

on new me
  me.ancestor = new(script("objGameObject"))
  i = me.modifyParams(#init)
  i.character = #hair
  i.flags.append(#objHair)
  i[#hairAdjustmentRect] = rect(3, 0, -10, 0)
  i[#hairLength] = 14
  i[#startLocOffset] = point(10, 0)
  return me
end

on init me, params
  ancestor.init(params)
  pDownChain = #none
  pGrowHair = 0
  pGrowHairNum = 0
  pGrowHairTarget = 2
  pHairAdjustmentRect = params.hairAdjustmentRect
  pHairLength = params.hairLength
  pUpChain = #none
  pParasite = #none
  pStartLocOffset = params.startLocOffset
  SpriteSetMember(me.pSpr, member("raphair"))
  me.goMode(#norm)
end

on finish me
  me.sayGoodbye()
  ancestor.finish()
end

on calcStartLoc me
  upLoc = pUpChain.getHairLoc()
  startLoc = upLoc + pStartLocOffset
  return startLoc
end

on checkCollisions me, newLoc, oldloc
  if pmode = #cutOff then
    newLoc = ancestor.checkCollisions(newLoc, oldloc)
  end if
  newLoc = me.constrainHair(newLoc)
  return newLoc
end

on checkHairCollisions me, therect, minCollisionSpeed
  myloc = me.getHairLoc()
  if inside(myloc, therect) then
    hairSpeed = PointPositive(me.getVect())
    if (hairSpeed[1] > minCollisionSpeed) or (hairSpeed[2] > minCollisionSpeed) then
      return me.getVect()
    end if
  end if
  if pDownChain = #none then
    return 0
  else
    return pDownChain.checkHairCollisions(therect, minCollisionSpeed)
  end if
end

on checkHairCollisionsObj me, theloc
  myRect = me.getRect()
  if inside(theloc, myRect) then
    return me
  else
    if pDownChain = #none then
      return #none
    else
      return pDownChain.checkHairCollisionsObj(theloc)
    end if
  end if
end

on collisionCeiling me
end

on collisionNoPlatform me
end

on collisionPlatform me
  if pmode = #cutOff then
    params = g.actorMaster.getParams(#newActor)
    params.typ = #hairPowerUp
    params.startLoc = me.getLoc()
    params.useOffset = 0
    g.actorMaster.newActor(params)
    me.goMode(#dead)
  end if
end

on collisionWallLeft me
end

on collisionWallRight me
end

on constrainHair me, newLoc
  if pmode = #norm then
    hairLoc = pUpChain.getHairLoc()
    newLocInt = PointInteger(newLoc.duplicate())
    hairAngle = GeomAngle(newLocInt - hairLoc)
    if GeomDistSqr(hairLoc, newLoc) > (pHairLength * pHairLength) then
      newLoc = GeomPointOnCircle(hairLoc, pHairLength, 360 - hairAngle)
    end if
    me.pSpr.rotation = VarChangeinRange(hairAngle, 1, 360, 180)
  end if
  return newLoc
end

on cutOff me
  me.goMode(#cutOff)
  me.sayGoodbye()
  if pDownChain = #none then
    nothing()
  else
    pDownChain.cutOff()
  end if
end

on downChainGone me
  pDownChain = #none
end

on finishConditionMet me
  return 0
end

on getHairAtPos me, thePos, upPos
  mypos = upPos + 1
  if mypos = thePos then
    return me
  else
    return pDownChain.getHairAtPos(thePos, mypos)
  end if
end

on getHairLength me, len
  len = len + 1
  if pDownChain = #none then
    return len
  else
    return pDownChain.getHairLength(len)
  end if
end

on getHairLoc me
  hairLoc = me.getNewLoc()
  hairLoc = PointInteger(hairLoc)
  return hairLoc
end

on getRect me
  myRect = ancestor.getRect()
  myRect = myRect + pHairAdjustmentRect
  return myRect
end

on goMode me, newMode
  pmode = newMode
end

on growHair me
  if pDownChain = #none then
    params = g.actorMaster.getParams(#newActor)
    params.typ = #hair
    params.startLoc = me.getHairLoc()
    pDownChain = g.actorMaster.newActor(params)
    pDownChain.setUpChain(me)
    pDownChain.setPosInChain(pPosInChain + 1)
  else
    pDownChain.growHair()
  end if
end

on growHairSequence me
  me.flashWhite()
  pGrowHair = 1
  pGrowHairNum = pGrowHairNum + 1
end

on growHairSequencePass me
  repeat with i = 1 to pGrowHairNum
    if pDownChain = #none then
      me.growHair()
      next repeat
    end if
    pDownChain.growHairSequence()
  end repeat
  pGrowHairNum = 0
end

on informCallingPrg me
  nothing()
end

on leaveRoom me, moveAmount
  myVect = me.getVect()
  me.pMoveXY.setLoc(me.getLoc() + moveAmount)
  me.setVect(myVect)
  if pDownChain = #none then
  else
    pDownChain.leaveRoom(moveAmount)
  end if
end

on moveXYFin me
end

on registerParasite me, obj
  if pParasite = #none then
    pParasite = obj
    return #success
  else
    return #noSpace
  end if
end

on sayGoodbye me
  if pParasite <> #none then
    pParasite.targetGone()
    pParasite = #none
  end if
  if pUpChain <> #none then
    pUpChain.downChainGone()
    pUpChain = #none
  end if
  me.removeFlag(#objHair)
end

on setPosInChain me, pos
  pPosInChain = pos
  me.pSpr.locZ = gPlayerLayer + pos
end

on setUpChain me, obj
  pUpChain = obj
  startLoc = me.calcStartLoc()
  me.setLoc(startLoc)
  g.starMaster.starBurstX(startLoc)
end

on trimHair me
  if pDownChain = #none then
    me.finish()
  else
    pDownChain.trimHair()
  end if
end

on unregisterParasite me, obj
  if pParasite = obj then
    pParasite = #none
  end if
end

on update me
  case pmode of
    #norm:
      if pGrowHair = pGrowHairTarget then
        me.growHairSequencePass()
        pGrowHair = 0
      else
        if pGrowHair > 0 then
          pGrowHair = pGrowHair + 1
        end if
      end if
    #cutOff:
    #dead:
      me.finish()
  end case
end

on updateAI me
end
