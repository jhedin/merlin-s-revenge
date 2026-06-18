property ancestor, pFreezeCounter, pFrozen, pFreezeTime, pPreviousWalkSpeed, pGlowTeal

on new me
  ancestor = new(script("modModule"))
  return me
end

on addModParams me
  i = me.modifyParams(#init)
  ancestor.addModParams()
end

on init me, params
  ancestor.init(params)
  pFreezeCounter = CounterNew()
  pFreezeCounter.inc = 1
  pFreezeCounter.tim = [0, 1000]
  pFrozen = 0
  pGlowTeal = 0
end

on defrost me
  pFrozen = 0
  currSpeed = me.getSpeed()
  speedChange = ((2 * currSpeed) - pPreviousWalkSpeed) / 2
  walkSpeed = (2 * currSpeed) - speedChange
  me.setSpeed(walkSpeed)
  if pGlowTeal = 1 then
    me.big.stopGlowTeal()
    pGlowTeal = 0
  end if
end

on getSpeed me
  if me.big.modIsInstalled(#modNavMode) then
    return me.big.getAcceleration()
  else
    return me.big.getWalkSpeed()
  end if
end

on internalEvent me, theEvent
  ancestor.internalEvent(theEvent)
  case theEvent of
    #colourTransformFin:
      if pGlowTeal then
        me.big.glowTeal()
      end if
  end case
end

on setSpeed me, newVal
  if me.big.modIsInstalled(#modNavMode) then
    return me.big.setAcceleration(newVal)
  else
    return me.big.setWalkSpeed(newVal)
  end if
end

on takeFreeze me, collisionVect, attackingObj, owner
  if pFrozen = 0 then
    pFrozen = 1
    CounterReset(pFreezeCounter)
    CounterSetCount(pFreezeCounter, 999)
    pPreviousWalkSpeed = me.getSpeed()
    me.setSpeed(0.5 * pPreviousWalkSpeed)
    if attackingObj.getAttack().glowTeal then
      me.big.glowTeal()
      pGlowTeal = 1
    end if
  end if
  collSpeedX = VarPositive(collisionVect[1])
  collSpeedY = VarPositive(collisionVect[2])
  multiplier = attackingObj.getAttack().freezeMultiplier
  freezeTime = (collSpeedX + collSpeedY) * multiplier * 4
  CounterSetCount(pFreezeCounter, pFreezeCounter.theCount - freezeTime)
end

on update me
  ancestor.update()
  if pFrozen then
    me.updateFreeze()
  end if
end

on updateFreeze me
  counter(pFreezeCounter)
  if pFreezeCounter.fin then
    me.defrost()
  end if
end
