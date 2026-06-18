property ancestor, pAnimSet, pEnergy, pEnergyRecoverCounter, pJumpPower, pMasterPrg, pMaxEnergy, pmode, pMoveHoriz, pName, pWalkAcceleration
global g, gGameSpeed, gStageSize

on new me
  ancestor = new(script("objAiGameObject"))
  i = me.pParams.init
  i[#energy] = 100
  i[#energyRecoverDelay] = 30
  i[#jumpPower] = -7
  i[#walkAcceleration] = 0.5
  return me
end

on init me, params
  ancestor.init(params)
  pAnimSet = g.objectMaster.requestObject(#objAnimSet)
  pAnimSet.init(params.name, params.character)
  pEnergy = params.energy
  pEnergyRecoverCounter = CounterNew()
  pEnergyRecoverCounter.tim[2] = params.energyRecoverDelay
  pMasterPrg = params.masterPrg
  pMaxEnergy = pEnergy
  pName = params.name
  pJumpPower = params.jumpPower
  pWalkAcceleration = params.walkAcceleration
  me.goMode(#walk)
  me.id.bigMe.updateAnim(#none)
end

on finish me
  pAnimSet.finish()
  ancestor.finish()
end

on checkDead me
  if pEnergy <= 0 then
    return 1
  end if
end

on collisionPlatform me
  ancestor.collisionPlatform()
  case me.pmode of
    #reel_fly:
      me.id.bigMe.goMode(#reel_landed)
    #jump, #fall:
      me.id.bigMe.goMode(#landed)
  end case
end

on collisionNoPlatform me
  if me.pmode = #walk then
    me.goMode(#fall)
  end if
end

on doJump me
  if me.pmode = #walk then
    me.goMode(#jump)
  end if
end

on energyChanged me
end

on ensureMode me, theMode
  if pmode <> theMode then
    me.goMode(theMode)
  end if
end

on getAnimSym me, sym
  if sym = #none then
    sym = pmode
  end if
  case sym of
    #fall:
      sym = #jump
    #landed:
      sym = #walk
    #look:
      sym = #stand
    #dead, #finish, #reel_sit:
      sym = #reel_landed
  end case
  if (sym = #walk) and (pMoveHoriz = 0) then
    sym = #stand
  end if
  return sym
end

on goMode me, newMode
  case me.pmode of
    #reel_fly:
      me.pSpr.rotation = 0
  end case
  case newMode of
    #attack:
      me.pAnimSet.resetAnim(#attack)
    #fall:
      vectY = me.pMoveXY.getVectY()
      if vectY < 0 then
        me.pMoveXY.setVectY(0)
      end if
    #jump:
      me.pMoveXY.setVectY(pJumpPower)
  end case
  pmode = newMode
  me.pAI.characterModeChanged(pmode)
end

on loseEnergy me, amount
  pEnergy = pEnergy - amount
  me.id.bigMe.energyChanged()
end

on moveHoriz me, Dir
  me.pMoveXY.vectAdd(point(pWalkAcceleration * Dir, 0))
  case Dir of
    (-1):
      me.pSpr.flipH = 1
      pMoveHoriz = 1
    1:
      me.pSpr.flipH = 0
      pMoveHoriz = 1
    0:
      pMoveHoriz = 0
  end case
end

on noJump me
  if me.pmode = #jump then
    me.goMode(#fall)
  end if
  if me.pmode = #landed then
    me.goMode(#walk)
  end if
end

on recoverEnergy me
  if pEnergy < pMaxEnergy then
    if pEnergyRecoverCounter.fin then
      pEnergy = pEnergy + 1
      me.id.bigMe.energyChanged(#recoverEnergy)
    end if
    counter(pEnergyRecoverCounter)
  end if
end

on update me
  case pmode of
    #attack:
      fin = me.updateAttack()
      if fin then
        me.goMode(#stand)
      end if
    #dead, #die:
      nothing()
    otherwise:
      me.recoverEnergy()
  end case
  me.id.bigMe.updateAnim(#none)
  ancestor.update()
end

on updateAnim me
  sym = me.id.bigMe.getAnimSym(#none)
  member = pAnimSet.getMember(sym)
  SpriteSetMember(me.pSpr, member)
end

on updateAttack me
  fin = 0
  if me.getAnimLooped() then
    fin = 1
  end if
  return fin
end

on informCallingPrg me
  nothing()
end

on moveXYFin me
  nothing()
end
