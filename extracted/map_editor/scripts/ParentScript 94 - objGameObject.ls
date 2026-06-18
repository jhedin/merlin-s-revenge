property ancestor, pAnimSet, pCharacter, pCollisionUseMiddle, pDead, pFrictionX, pFrictionY, pMoveXY, pMinCollisionSpeed, pParams, pSpr, pTransColor
global g, gGameObjectLayer

on new me
  ancestor = new(script("objAutoUpdate"))
  pParams = [#init: [:]]
  i = pParams.init
  i[#character] = #gameObject
  i[#collisionUseMiddle] = 0
  i[#friction] = point(12.5, 0)
  i[#initLoc] = point(100, 100)
  i[#initMode] = #stand
  i[#initVect] = point(0, 0)
  i[#keepVect] = 0
  i[#layerZ] = gGameObjectLayer
  i[#name] = #none
  i[#masterPrg] = #none
  i[#member] = #none
  i[#minCollisionSpeed] = 5
  i[#weight] = 0.20000000000000001
  return me
end

on init me, params
  pCharacter = params.character
  pCollisionUseMiddle = params.collisionUseMiddle
  pDead = 0
  pFrictionX = params.friction[1]
  pFrictionY = params.friction[2]
  pSpr = g.spriteMaster.requestSprite()
  pSpr.loc = params.initLoc.duplicate()
  pSpr.locZ = params.layerZ
  pTransColor = #none
  pMinCollisionSpeed = params.minCollisionSpeed
  pMoveXY = g.objectMaster.requestObject(#objMoveXY)
  pMoveXY.initGameChar(me, pSpr)
  pMoveXY.setFriction(params.friction)
  pMoveXY.setKeepVect(params.keepVect)
  pMoveXY.setVect(params.initVect)
  pMoveXY.setWeight(params.weight)
  me.pFlags.append(#objGameObject)
  if params.member <> #none then
    SpriteSetMember(me.pSpr, params.member)
  end if
  ancestor.init()
end

on finish me
  me.cancelTransColor()
  pMoveXY.finish()
  g.spriteMaster.freeSprite(pSpr)
  ancestor.finish()
end

on cancelTransColor me
  if pTransColor <> #none then
    pTransColor.cancel()
  end if
end

on checkCollisions me, newLoc, oldloc
  newLoc = g.collisionMaster.checkCollisions(me.id.bigMe, newLoc, oldloc, pSpr, pCollisionUseMiddle)
  return newLoc
end

on checkCollisionsWithHair me
  player = g.actorMaster.getPlayer()
  collideVect = player.checkHairCollisions(me.id.bigMe.getRect(), pMinCollisionSpeed)
  if collideVect <> 0 then
    me.takeHit(collideVect)
  end if
end

on checkForCollisionWithPlayer me
  myRect = me.getRect()
  if myRect = rect(-1, -1, 0, 0) then
    return 0
  end if
  player = g.actorMaster.getPlayer()
  playerRect = player.getRect()
  playerRect = playerRect.inflate(myRect.width / 2, myRect.height / 2)
  if inside(me.getLoc(), playerRect) then
    return 1
  end if
  return 0
end

on collisionCeiling me
  pMoveXY.setVectY(0)
end

on collisionPlatform me
  pMoveXY.setVectY(0)
end

on collisionNoPlatform me
end

on collisionWallLeft me
  pMoveXY.bounceRight()
end

on collisionWallRight me
  pMoveXY.bounceLeft()
end

on finishConditionMet me
  return pDead
end

on frictionXOff me
  pMoveXY.setFrictionX(5)
end

on frictionXOn me
  pMoveXY.setFrictionX(pFrictionX)
end

on frictionYOff me
  pMoveXY.setFrictionY(0)
end

on frictionYOn me
  pMoveXY.setFrictionY(pFrictionY)
end

on frictionStrong me
  pMoveXY.setFriction(point(20, 20))
end

on flashWhite me
  me.cancelTransColor()
  pTransColor = g.objectMaster.requestObject(#objTransColor)
  params = pTransColor.getParams(#init)
  params.callingPrg = me
  params.spr = pSpr
  params.transformTarget = #spr
  params.startColor = rgb(255, 255, 255)
  params.targetColor = rgb(0, 0, 0)
  pTransColor.init(params)
end

on getAnimFrame me
  return me.id.bigMe.pAnimSet.getFrame(me.id.bigMe.getAnimSym(#none))
end

on getAnimFrameFresh me
  return me.id.bigMe.pAnimSet.getFrameFresh(me.id.bigMe.getAnimSym(#none))
end

on getAnimLooped me
  return me.id.bigMe.pAnimSet.getLooped(me.id.bigMe.getAnimSym(#none))
end

on getCharacter me
  return pCharacter
end

on getFlip me
  return pSpr.flipH
end

on getLoc me
  return pSpr.loc.duplicate()
end

on getParams me, function
  return pParams[function].duplicate()
end

on getRect me
  return pSpr.rect.duplicate()
end

on getVect me
  return pMoveXY.getVect()
end

on getVectX me
  return pMoveXY.getVectX()
end

on informCallingPrg me
end

on moveLoc me, newLoc
  pMoveXY.moveLoc(newLoc)
end

on moveXYFin me
end

on setDead me, newDead
  pDead = newDead
end

on setFlip me, newFlip
  pSpr.flipH = newFlip
end

on setKeepVect me, newVal
  pMoveXY.setKeepVect(newVal)
end

on setLoc me, newLoc
  pMoveXY.setLoc(newLoc)
end

on setVect me, newVect
  pMoveXY.setVect(newVect)
end

on setWeight me, newWeight
  pMoveXY.setWeight(newWeight)
end

on start me
  me.ancestor.calcStart()
  pMoveXY.setAutoUpdate(1)
  pMoveXY.calcStart()
  pMoveXY.setAutoUpdate(0)
end

on takeHit me, collideVect
  me.pMoveXY.vectAdd(collideVect)
end

on transformFin me
  pTransColor = #none
end

on update me
  ancestor.calcFin()
end

on updateAI me
end
