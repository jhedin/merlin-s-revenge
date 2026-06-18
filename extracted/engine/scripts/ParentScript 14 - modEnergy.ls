property ancestor, pDamageSpeed, pEnergy, pEnergyIncAmount, pEnergyRecoverCounter, pGlowRedPercentage, pKilledInAction, pMaxEnergy, pMinEnergy, pTakeHitSound, pTakeHitVolume

on new me
  ancestor = new(script("modModule"))
  return me
end

on addModParams me
  i = me.modifyParams(#init)
  i[#damageSpeed] = 5
  i[#energy] = 100
  i[#energyIncPercentage] = 1
  i[#energyRecoverDelay] = 1000
  i[#maxEnergy] = #auto
  i[#minEnergy] = 0
  i[#takeHitSound] = #none
  i[#takeHitVolume] = #none
  ancestor.addModParams()
end

on init me, params
  pDamageSpeed = params.damageSpeed
  pEnergy = params.energy
  pEnergyRecoverCounter = CounterNew()
  pEnergyRecoverCounter.tim[2] = params.energyRecoverDelay
  pGlowRedPercentage = 50
  pKilledInAction = 0
  if params.maxEnergy = #auto then
    pMaxEnergy = pEnergy
  else
    pMaxEnergy = params.maxEnergy
  end if
  pMinEnergy = params.minEnergy
  pTakeHitSound = params.takeHitSound
  pTakeHitVolume = params.takeHitVolume
  pEnergyIncAmount = params.energy * params.energyIncPercentage / 100
  ancestor.init(params)
end

on addSaveData me, sd
  ancestor.addSaveData(sd)
  sd[#pEnergy] = pEnergy
  sd[#pMaxEnergy] = pMaxEnergy
end

on addToEnergy me, amount
  me.increaseEnergy(amount)
end

on calcEnergyRectBottom me
  standMember = me.getAnimMemberFromStripAt(#stand, 1)
  myloc = me.getLoc().duplicate()
  reg = standMember.regPoint.duplicate()
  energyRect = standMember.rect + rect(myloc.locH, myloc.locV, myloc.locH, myloc.locV) - rect(reg.locH, reg.locV, reg.locH, reg.locV)
  return energyRect
end

on checkDead me
  if pEnergy <= pMinEnergy then
    return 1
  end if
  return 0
end

on checkEnergyIsAtMax me
  if pMaxEnergy > pEnergy then
    return 0
  end if
  return 1
end

on die me
  ancestor.die()
  me.loseAllEnergy()
end

on energyChanged me
end

on getEnergy me
  return pEnergy
end

on getHealth me
  health = varPercent(pEnergy, [0, pMaxEnergy])
  return health
end

on getKilledInAction me
  return pKilledInAction
end

on getMaxEnergy me
  return pMaxEnergy
end

on glowRedOnLowHealth me
  health = me.getHealth()
  if health < pGlowRedPercentage then
    me.big.glowRed()
  end if
end

on increaseEnergy me, amount
  pEnergy = pEnergy + amount
  if pEnergy > pMaxEnergy then
    pEnergy = pMaxEnergy
  end if
  health = me.getHealth()
  if health >= pGlowRedPercentage then
    me.big.stopGlowRed()
  end if
  me.id.bigMe.energyChanged()
end

on increaseEnergyByPercentage me, percent
  amount = VarValRange(percent, [0, pMaxEnergy])
  me.increaseEnergy(amount)
end

on internalEvent me, theEvent
  ancestor.internalEvent(theEvent)
  case theEvent of
    #colourTransformFin:
      me.glowRedOnLowHealth()
    #levelUp:
      me.levelUpEnergy()
  end case
end

on levelUpEnergy me
  incAmount = pEnergyIncAmount
  pMaxEnergy = pMaxEnergy + incAmount
  me.increaseEnergy(incAmount)
  me.big.internalEvent(#maxEnergyChanged)
end

on loseAllEnergy me
  me.loseEnergy(pMaxEnergy)
end

on loseEnergy me, amount
  if me.id.bigMe.getInvinceActive() = 0 then
    pEnergy = pEnergy - amount
    me.id.bigMe.energyChanged()
    if me.checkDead() then
      me.id.bigMe.outOfEnergy()
      me.big.internalEvent(#outOfEnergy)
      me.eventNotify(#outOfEnergy)
      pEnergy = -100
      pKilledInAction = 1
    else
      me.id.bigMe.flickWhite()
    end if
    me.big.PlaySound(pTakeHitSound, pTakeHitVolume)
  end if
end

on outOfEnergy me
  ancestor.outOfEnergy()
end

on recoverEnergy me
  if me.id.bigMe.checkDead() = 0 then
    if pEnergy < pMaxEnergy then
      if pEnergyRecoverCounter.fin then
        me.increaseEnergy(1)
      end if
      counter(pEnergyRecoverCounter)
    end if
  end if
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
  pEnergy = sd.pEnergy
  pMaxEnergy = sd.pMaxEnergy
  me.big.energyChanged(#restoreFromSave)
  me.big.internalEvent(#maxEnergyChanged)
end

on restoreEnergy me
  if pEnergy < pMaxEnergy then
    pEnergy = pMaxEnergy
    me.id.bigMe.energyChanged(#restoreEnergy)
  end if
end

on setEnergy me, amount
  pEnergy = amount
end

on takeDamage me, amount
  if amount > pDamageSpeed then
    amount = amount - pDamageSpeed
    me.loseEnergy(amount)
  end if
end

on takeHeal me, collisionVect, healingObj
  collSpeedX = VarPositive(collisionVect[1])
  collSpeedY = VarPositive(collisionVect[2])
  healAmount = (collSpeedX + collSpeedY) * 2
  me.increaseEnergy(healAmount)
  ancestor.takeHeal(collisionVect, healingObj)
  me.big.glowGold()
end

on takeHit me, collisionVect, attackingObj, owner
  if me.big.getMode() <> #recoil then
    ancestor.takeHit(collisionVect, attackingObj, owner)
    collSpeedX = VarPositive(collisionVect[1])
    collSpeedY = VarPositive(collisionVect[2])
    multiplier = attackingObj.getAttack().damageMultiplier
    damage = (collSpeedX + collSpeedY) * multiplier
    if damage > 0 then
      me.loseEnergy(damage)
    end if
  end if
end
