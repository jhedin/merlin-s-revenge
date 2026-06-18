property ancestor, pDownChain, pHairLength, pHairAdjustmentRect, pGrowHair, pGrowHairNum, pGrowHairTarget, pmode, pParasite, pPosInChain, pStartLocOffset, pUpChain
global g, gPlayerLayer

on new me
  me.ancestor = new(script("objGameObject"))
  i = me.pParams.init
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
  pParasite = #none
  pStartLocOffset = params.startLocOffset
  SpriteSetMember(me.pSpr, member("raphair"))
  me.goMode(#norm)
end

on calcStartLoc me
  upLoc = pUpChain.getHairLoc()
  startLoc = upLoc + pStartLocOffset
  return startLoc
end

on checkCollisions me, newLoc, oldloc
  newLoc = ancestor.checkCollisions(newLoc, oldloc)
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
    g.actorMaster.newActor(#hairPowerUp, me.getLoc())
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
    if GeomDist(hairLoc, newLoc) > pHairLength then
      newLoc = GeomPointOnCircle(hairLoc, pHairLength, 360 - hairAngle)
    end if
    me.pSpr.rotation = VarChangeinRange(hairAngle, 1, 360, 180)
  end if
  return newLoc
end

on cutOff me
  me.goMode(#cutOff)
  if pParasite <> #none then
    pParasite.targetGone()
  end if
  pUpChain.downChainGone()
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

on finish me
  if pParasite <> #none then
    pParasite.targetGone()
  end if
  pUpChain.downChainGone()
  ancestor.finish()
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
  return me.pSpr.loc.duplicate()
end

on getRect me
  myRect = ancestor.getRect()
  myRect = myRect + pHairAdjustmentRect
  return myRect
end

on goMode me, newMode
  case newMode of
    #cutOff:
      pUpChain.downChainGone()
  end case
  pmode = newMode
end

on growHair me
  if pDownChain = #none then
    pDownChain = g.actorMaster.newActor(#hair, me.getHairLoc())
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

on setPosInChain me, pos
  pPosInChain = pos
  me.pSpr.locZ = gPlayerLayer + pos
end

on setUpChain me, obj
  pUpChain = obj
  startLoc = me.calcStartLoc()
  me.setLoc(startLoc)
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
