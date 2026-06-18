property ancestor, pFireDelayCounter
global g

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
  pFireDelayCounter = CounterNew()
end

on addSaveData me, sd
  ancestor.addSaveData(sd)
  sd[#pFireDelayCounter] = pFireDelayCounter
end

on fireBullet me
  fin = 0
  charge = me.big.getCharge()
  chargePerUnit = me.big.getAttack().chargePerUnit
  charge = charge - chargePerUnit
  if charge < 0 then
    fin = 1
  else
    me.big.setCurrentCharge(charge)
  end if
  beam = me.big.getAttack().beam
  if beam then
    me.big.performBeamAttack()
  else
    me.big.performRangedAttack()
  end if
  return fin
end

on getTargetLoc me
  owner = me.big.getOwner()
  return owner.getTargetLoc()
end

on internalEvent me, theEvent
  ancestor.internalEvent(theEvent)
  case theEvent of
    #spellReleased:
      if me.big.getAttack().releaseFunction = #fireBullets then
        me.setFireDelay(me.big.getAttack().fireDelay)
        me.resetFireDelay()
        me.big.goMode(#fireBullets)
      end if
  end case
end

on resetFireDelay me
  CounterReset(pFireDelayCounter)
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
  pFireDelayCounter = sd.pFireDelayCounter
end

on setFireDelay me, theAmount
  pFireDelayCounter.tim[2] = theAmount
end

on update me
  ancestor.update()
  if me.big.getMode() = #fireBullets then
    fin = me.updateFireBullets()
    if fin then
      me.big.setDead(1)
    end if
  end if
end

on updateFireBullets me
  fin = 0
  if pFireDelayCounter.fin then
    fin = me.fireBullet()
    me.resetFireDelay()
  else
    counter(pFireDelayCounter)
  end if
  return fin
end
