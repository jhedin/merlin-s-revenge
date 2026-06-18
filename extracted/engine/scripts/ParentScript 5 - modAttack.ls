property ancestor, pAttack, pRangedVectOffset, pChargeMax, pChargeSpeed, pChargeStart, pChargeSpeedMax
global g, gGameView

on new me
  ancestor = new(script("modModule"))
  return me
end

on addModParams me
  i = me.modifyParams(#init)
  i[#attack] = #none
  ancestor.addModParams()
end

on init me, params
  ancestor.init(params)
  pRangedVectOffset = 0
  me.setAttack(params.attack)
end

on calcAttackChargeMax me
  characterMax = me.pCharacterPrg.getManaCapacity() * pAttack.chargeMaxModifier
  characterMax = characterMax + pAttack.chargeMaxBasic
  chargeMax = min(pChargeMax, characterMax)
  if pAttack.limitMagic then
    magicLimit = g.magicLimitMaster.getMagicLimit()
    chargeMax = chargeMax * magicLimit / 100
  end if
  if pAttack[#randomSummon] then
    if (pAttack[#multistage][2] - chargeMax) < 0 then
      tempMax = (chargeMax * random(20) / 17) + random(pAttack[#multistage][1])
      chargeMax = min(chargeMax, tempMax)
      chargeMax = chargeMax + random(2) - 1
    end if
  end if
  return chargeMax
end

on calcAttackChargeStart me
  chargeStart = pChargeStart + me.pCharacterPrg.getManaBurst()
  chargeStart = min(chargeStart, me.calcAttackChargeMax())
  if pAttack[#chargeStartMax] = VOID then
    pAttack[#chargeStartMax] = #none
    put "modAttack.calcAttackChargeStart() chargeStartMax added"
  end if
  if pChargeStart <> #none then
    chargeStart = min(pChargeStart, pAttack.chargeStartMax)
  end if
  return chargeStart
end

on calcAttackChargeSpeed me
  chargeSpeed = pChargeSpeed * me.pCharacterPrg.getManaFlow()
  if pChargeSpeedMax <> #unlimited then
    if pChargeSpeedMax < chargeSpeed then
      chargeSpeed = pChargeSpeedMax
    end if
  end if
  return chargeSpeed
end

on calcAttackLoc me
  Dir = SpriteGetFlipHAsDir(me.pSpr)
  attackLoc = pAttack.collisionLoc.duplicate()
  attackLoc[1] = attackLoc[1] * Dir
  attackLoc = me.pCharacterPrg.getLoc() + attackLoc
  return attackLoc
end

on calcAttackDist me, tilesize
  dist = 0
  case me.getAttack().type of
    #melee:
      nothing()
    #explode, #magic:
      dist = integer(me.big.getCurrentCharge() / (2 * tilesize[1]))
    #bullet:
      if me.hasSplashDamage() then
        dist = integer(me.calcAttackDistSplash() / tilesize[1])
      end if
    otherwise:
      nothing()
  end case
  return dist
end

on calcAttackHit me, targetObj
  hit = 0
  case me.getAttack().type of
    #melee:
      hit = me.calcAttackHitMelee(targetObj)
    #explode, #magic:
      hit = me.calcAttackHitMagic(targetObj)
    #bullet:
      hit = me.calcAttackHitSplash(targetObj)
    otherwise:
      nothing()
  end case
  return hit
end

on calcAttackHitMagic me, targetObj
  hit = 0
  targetRadius = targetObj.getRadius()
  myRadius = me.big.getCurrentCharge() / 2
  dist = GeomDistSqr(me.getLoc(), targetObj.getLoc())
  hitRange = myRadius + targetRadius
  if dist < (hitRange * hitRange) then
    hit = 1
  end if
  return hit
end

on calcAttackHitMelee me, targetObj
  hit = 0
  targetRect = targetObj.getRect()
  if me.calcAttackLoc().inside(targetRect) then
    hit = 1
  end if
  return hit
end

on calcAttackPower me
  attackPower = point(0, 0)
  attackType = me.calcAttackType()
  case attackType of
    #bullet:
      attackPower = me.calcAttackPowerBullet()
    #melee:
      attackPower = me.calcAttackPowerMelee()
    #explode, #magic, #Spell:
      attackPower = me.calcAttackPowerSpell()
  end case
  return attackPower
end

on calcAttackPowerBullet me
  attackPower = me.getVect() * me.getAttack().power
  return attackPower
end

on calcAttackPowerMelee me
  Dir = SpriteGetFlipHAsDir(me.pSpr)
  attackPower = pAttack.power.duplicate()
  attackPower[1] = attackPower[1] * Dir
  return attackPower
end

on calcAttackPowerSpell me
  return pAttack.power
end

on calcAttackType me
  aType = pAttack.type
  attackType = aType
  return attackType
end

on calcCollisionVect me, targetObj
  collisionVect = point(0, 0)
  attackType = me.calcAttackType()
  case attackType of
    #bullet:
      collisionVect = me.calcCollisionVectBullet(targetObj)
    #melee:
      collisionVect = me.calcCollisionVectMelee(targetObj)
    #explode, #magic, #Spell:
      collisionVect = me.calcCollisionVectSpell(targetObj)
  end case
  return collisionVect
end

on calcCollisionVectBullet me, targetObj
  collisionVect = point(0, 0)
  if me.big.hasSplashDamage() then
    collisionVect = me.big.calcCollisionVectSplash(targetObj)
  else
    collisionVect = me.calcAttackPower()
  end if
  return collisionVect
end

on calcCollisionVectMelee me, targetObj
  attack = me.getAttack()
  case ilk(attack.power) of
    #point:
      case attack.type of
        #melee:
          case attack.animType of
            #magicMelee:
              collisionVect = me.calcAttackPower() * (me.pCharacterPrg.getStrength() + (1.5 * me.pCharacterPrg.getManaCapacity())) / 1.5
            otherwise:
              collisionVect = me.calcAttackPower() * me.pCharacterPrg.getStrength()
          end case
      end case
    #integer:
      attackLoc = me.getAttackLoc()
      CollisionCalcVect(attackLoc, targetObj.getLoc(), attack.power)
    otherwise:
      put "error: modAttack.getCollisionVect(): pAttack.power set to wrong type of variable"
      nothing()
  end case
  return collisionVect
end

on calcCollisionVectSpell me, targetObj
  targetloc = targetObj.getLoc()
  myRadius = me.big.getCurrentCharge() / 2
  targetRadius = targetObj.getRadius()
  hitRange = myRadius + targetRadius
  dist = SineDist(me.getLoc(), targetloc)
  speed = (hitRange - dist) * me.calcAttackPower()
  if targetloc = me.getLoc() then
    targetloc = targetloc + point(0, 1)
  end if
  if speed > 0 then
    collisionVect = GeomMoveVector(me.getLoc(), targetloc, speed)
  else
    collisionVect = point(0, 0)
  end if
  return collisionVect
end

on getAttack me
  return pAttack
end

on isOnAttackFrame me
  onAttackFrame = 0
  if me.pCharacterPrg.getAnimFrameFresh() = 0 then
    return onAttackFrame
  end if
  attackFrame = pAttack.animframe
  currentFrame = me.pCharacterPrg.getAnimFrame()
  if ilk(attackFrame) = #list then
    onAttackFrame = attackFrame.getPos(currentFrame) > 0
  else
    onAttackFrame = currentFrame = attackFrame
  end if
  return onAttackFrame
end

on performBeamAttack me
  targetloc = me.id.bigMe.getTargetLoc()
  if targetloc = #none then
    return 
  end if
  modx = random(20) - 10
  mody = random(20) - 10
  targetloc.locH = targetloc.locH + modx
  targetloc.locV = targetloc.locV + mody
  distxy = targetloc - me.calcAttackLoc()
  if distxy <> point(0, 0) then
    disttotarget = GeomDist(targetloc, me.calcAttackLoc())
  else
    disttotarget = 0
  end if
  distToTargetScale = integer(disttotarget)
  params = g.actorMaster.getParams(#newActor)
  params.initVect = point(0, 0)
  params.typ = me.getAttack().bullet
  params.startLoc = targetloc
  params.useOffset = 0
  bulletObj = g.actorMaster.newActor(params)
  bulletObj.setTarget(me.big.getTarget())
  bulletObj.setTargetLoc(targetloc)
  bulletObj.setTeam(me.big.getTeam())
  bulletObj.setOwner(me.big.getOwner())
  bulletObj.setBeam(distToTargetScale, distxy)
end

on performRangedAttack me
  targetloc = me.id.bigMe.getTargetLoc()
  if targetloc = #none then
    return 
  end if
  targetloc = me.modifyLocWithEyestrain(targetloc)
  distxy = targetloc - me.calcAttackLoc()
  case me.getAttack().firingType of
    #proportional:
      throwVect = distxy / 10
    #fullstrength:
      if distxy <> point(0, 0) then
        disttotarget = SineDist(targetloc, me.calcAttackLoc())
        speed = me.pCharacterPrg.getStrength()
        distRatio = disttotarget / speed
        throwVect = distxy / point(distRatio, distRatio)
      else
        throwVect = point(-1, 0) * me.pCharacterPrg.getStrength()
      end if
  end case
  throwVect[2] = throwVect[2] + pRangedVectOffset
  params = g.actorMaster.getParams(#newActor)
  params.initVect = throwVect
  params.typ = me.getAttack().bullet
  params.startLoc = me.calcAttackLoc()
  params.useOffset = 0
  bulletObj = g.actorMaster.newActor(params)
  bulletObj.setTarget(me.big.getTarget())
  bulletObj.setTargetLoc(targetloc)
  bulletObj.setTeam(me.big.getTeam())
  bulletObj.setOwner(me.big.getOwner())
end

on setAttack me, attack
  if attack = #none then
    pAttack = #none
    pChargeMax = 5
    pChargeSpeed = 1
    return 
  end if
  pAttack = attack.duplicate()
  if pAttack.idealAttackLoc = #collisionLoc then
    pAttack.idealAttackLoc = pAttack.collisionLoc.duplicate()
  end if
  AttackSetTypeFromAnimType(pAttack)
  me.big.internalEvent(#attackSet)
end

on gmgOn
  pChargeMax = pAttack.gmgChargeMax
  pChargeSpeed = pAttack.gmgChargeSpeed
  pChargeStart = pAttack.gmgChargeStart
  pChargeSpeedMax = pAttack.gmgChargeSpeed
end

on gmgOff
  pChargeMax = pAttack.chargeMax
  pChargeSpeed = pAttack.chargeSpeed
  pChargeStart = pAttack.chargeStart
  pChargeSpeedMax = pAttack.chargeSpeedMax
end
