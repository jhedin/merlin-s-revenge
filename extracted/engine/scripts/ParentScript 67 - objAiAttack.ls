property ancestor, pChargeCounter
global g, gGameView

on new me
  ancestor = new(script("objAI"))
  me.addModule("modAttack")
  me.addModule("modWeaponManager")
  return me
end

on init me, params
  ancestor.init(params)
  pChargeCounter = CounterNew()
  pCurrentSpell = #none
end

on initCharacterInfo me, characterPrg, spr, params
  ancestor.initCharacterInfo(characterPrg, spr, params)
  me.setAttack(params.attack)
end

on addSaveData me, sd
  ancestor.addSaveData(sd)
  sd[#pChargeCounter] = pChargeCounter
end

on attack me
  if me.pCharacterPrg.getCooldownFin() = 0 then
    return 
  end if
  case me.getAttack().type of
    #magic:
      me.attackMagic()
    #melee:
      me.attackMelee()
    #ranged:
      me.attackRanged()
  end case
end

on attackFin me, reason
end

on attackMagic me
  me.chargeMagic()
end

on attackMelee me
  me.pCharacterPrg.ensureMode(me.getAttack().animType)
  me.ensureMode(#attack)
end

on attackRanged me
  me.pCharacterPrg.ensureMode(me.getAttack().animType)
  me.ensureMode(#attack)
end

on calcIdealAttackLoc me, targetloc
  idealLoc = point(0, 0)
  attack = me.getAttack()
  case attack.type of
    #magic, #ranged:
      idealLoc = targetloc.duplicate()
    #melee, #none:
      dirToTarget = me.calcDirXToTarget()
      idealLocMod = attack.idealAttackLoc.duplicate()
      idealLocMod[1] = idealLocMod[1] * (dirToTarget * -1)
      idealLocMod[2] = idealLocMod[2] * -1
      idealLoc = targetloc + idealLocMod
  end case
  return idealLoc
end

on calcStrikePoint me, faceDir
  if voidp(faceDir) then
    faceDir = me.pCharacterPrg.getFlipAsDir()
  end if
  collisionLoc = me.getAttack().collisionLoc.duplicate()
  collisionLoc[1] = collisionLoc[1] * faceDir
  strikePoint = me.getLoc() + collisionLoc
  return strikePoint
end

on cancelAttack me
  currentSpell = me.getCurrentSpell()
  if currentSpell <> #none then
    me.setCurrentSpell(#none)
    currentSpell.finish()
    me.pCharacterPrg.attackCancelled()
  end if
end

on characterModeChanged me, newMode
  ancestor.characterModeChanged(newMode)
  case newMode of
    #dead:
      me.cancelAttack()
  end case
end

on chargeMagic me
  me.pCharacterPrg.ensureMode(#charge)
  me.ensureSpell()
  me.chargeSpell()
end

on chargeSpell me
  currentSpell = me.getCurrentSpell()
  chargeAmount = pChargeCounter.theCount
  currentSpell.charge(chargeAmount, me.pCharacterPrg.calcChargeLoc())
  CounterOnce(pChargeCounter)
  if pChargeCounter.fin then
    me.big.internalEvent(#spellCharged)
  end if
end

on chargingSpellFinished me
  pCurrentSpell = #none
end

on ensureSpell me
  currentSpell = me.getCurrentSpell()
  if currentSpell = #none then
    params = g.actorMaster.getParams(#newActor)
    params.typ = #Spell
    params.startLoc = me.pCharacterPrg.calcChargeLoc()
    currentSpell = g.actorMaster.newActor(params)
    if currentSpell <> #none then
      params = currentSpell.getParams(#setSpellProperties)
      params.attack = me.getAttack()
      params.chargeOffsetSide = me.pCharacterPrg.getChargeOffsetSide()
      params.team = me.getTeam()
      if me.pCharacterPrg.getGmgOn() then
        me.gmgOn()
        params.attack.fireDelay = 0
      else
        me.gmgOff()
      end if
      currentSpell.setSpellProperties(params)
      pChargeCounter.tim[1] = me.calcAttackChargeStart()
      pChargeCounter.tim[2] = me.calcAttackChargeMax()
      pChargeCounter.inc = me.calcAttackChargeSpeed()
      CounterReset(pChargeCounter)
      me.setChargingSpell(currentSpell)
    end if
  end if
end

on eventNotification me, theEvent, theObj
  ancestor.eventNotification(theEvent, theObj)
  currentSpell = me.getCurrentSpell()
  if theObj = currentSpell then
    case theEvent of
      #chargeLimited:
        charge = currentSpell.getCharge()
        pChargeCounter.theCount = charge
    end case
  end if
end

on getChargingSpell me
  return me.getCurrentSpell()
end

on goMode me, newMode
  case newMode of
    #freeze:
      if me.getAttack().type = #melee then
        me.pCharacterPrg.ensureMode(#walk)
      end if
  end case
  ancestor.goMode(newMode)
end

on internalEvent me, theEvent
  ancestor.internalEvent(theEvent)
  case theEvent of
    #attackFrameSkipped:
      nothing()
      me.updateAttack()
    #manaCapacityIncreased:
      me.manaCapacityIncreased()
    #manaFlowIncreased:
      me.manaFlowIncreased()
    #relationshipsRestored:
      nothing()
    #targetLeft:
      myTarget = me.getTarget()
      if myTarget = #none then
        me.cancelAttack()
      end if
    #updateReel:
      chargingSpell = me.getChargingSpell()
      if chargingSpell <> #none then
        chargingSpell.align(me.pCharacterPrg.calcChargeLoc())
      end if
  end case
end

on manaCapacityIncreased me
  pChargeCounter.tim[2] = me.calcAttackChargeMax()
  pChargeCounter.fin = 0
end

on manaFlowIncreased me
  pChargeCounter.inc = me.calcAttackChargeSpeed()
end

on modifyLocWithEyestrain me, theloc
  eyestrain = me.pCharacterPrg.getEyestrain()
  myloc = me.getLoc()
  myReach = me.getAttack().reach
  dist = SineDist(myloc, theloc)
  percentOfRange = varPercent(dist, [0, myReach])
  eyestrain = VarValRange(percentOfRange, [0, eyestrain])
  eyestrain = integer(eyestrain)
  theloc = theloc + point(VarRoughly(0, eyestrain), VarRoughly(0, eyestrain))
  return theloc
end

on moveRoom me
  currentSpell = me.getCurrentSpell()
  if currentSpell <> #none then
    me.chargeMagic()
  end if
end

on performAttack me
  if me.big.getTarget() = #none then
    return 
  end if
  case me.getAttack().type of
    #melee:
      me.performMeleeAttack()
      me.pCharacterPrg.PlaySound(me.getAttack().sound, me.getAttack().volume)
    #ranged:
      if me.big.getAttack().beam then
        me.big.performBeamAttack()
      else
        me.big.performRangedAttack()
      end if
      me.pCharacterPrg.PlaySound(me.getAttack().sound, me.getAttack().volume)
  end case
  me.pCharacterPrg.resetCooldown()
end

on performMeleeAttack me
  g.teamMaster.impactMeleeAttack(me.pCharacterPrg)
end

on releaseMagic me, targetloc
  currentSpell = me.getCurrentSpell()
  if currentSpell <> #none then
    me.pCharacterPrg.ensureMode(#release)
    me.releaseSpell(targetloc)
    me.big.goMode(#release)
    me.pCharacterPrg.resetCooldown()
  end if
end

on releaseSpell me, targetloc
  currentSpell = me.getCurrentSpell()
  currentSpell.release(targetloc, me.getAttack().spellSpeed)
  me.setCurrentSpell(#none)
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
  pChargeCounter = sd.pChargeCounter
end

on setChargingSpell me, theSpell
  me.setCurrentSpell(theSpell)
  theSpell.setOwner(me.pCharacterPrg)
  theSpell.internalEvent(#registerForEvents)
end

on update me
  case me.pmode of
    #attack:
      me.updateAttack()
    #release:
      me.updateRelease()
  end case
  ancestor.update()
end

on updateAttack me
  attack = me.getAttack()
  if me.isOnAttackFrame() then
    me.id.bigMe.performAttack()
  end if
  if me.pCharacterPrg.getAnimLooped() then
    me.id.bigMe.attackFin(#completed)
  end if
end

on updateRelease me
  if me.pCharacterPrg.getAnimLooped() then
    me.big.attackFin(#completed)
  end if
end
