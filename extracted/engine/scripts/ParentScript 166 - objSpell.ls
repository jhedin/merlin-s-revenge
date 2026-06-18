property ancestor, pChargeOffsetSide, pCharger, pCurrentCharge, pReleaseSpeed, pReleaseTargetLoc, pSpellProperties
global g, gGameBulletLayer

on new me
  ancestor = new(script("objGameObject"))
  i = me.modifyParams(#init)
  i.initMode = #charge
  i.layerZ = gGameBulletLayer
  s = me.modifyParams(#setSpellProperties)
  s[#attack] = #none
  s[#chargeOffsetSide] = #top
  s[#team] = #none
  me.addModule("modAnimSet")
  me.addModule("modAttack")
  me.addModule("modFader")
  me.addModule("modFireBullets")
  me.addModule("modSpellMultiStage")
  return me
end

on init me, params
  ancestor.init(params)
  pCurrentCharge = 1
  pmode = params.initMode
  pReleaseTargetLoc = point(0, 0)
  pReleaseSpeed = 1
  pSpellProperties = [:]
end

on finish me
  player = g.actorMaster.getPlayer()
  if player <> #none then
    if player.getChargingSpell() = me.id.bigMe then
      playerAI = player.getAI()
      playerAI.chargingSpellFinished()
    end if
  end if
  ancestor.finish()
end

on addSaveData me, sd
  ancestor.addSaveData(sd)
  player = g.actorMaster.getPlayer()
  sd[#isChargingSpell] = player.getChargingSpell() = me.big
  sd[#pChargeOffsetSide] = pChargeOffsetSide
  sd[#pCurrentCharge] = pCurrentCharge
  sd[#pSpellProperties] = pSpellProperties
end

on align me, chargeLoc
  chargeOffset = me.calcChargeOffset()
  chargeLoc = chargeLoc + chargeOffset
  me.setLoc(chargeLoc)
end

on animUpdated me
  case me.getMode() of
    #charge, #explode, #fireBullets:
      me.updateSize()
  end case
end

on calcChargeOffset me
  offsetFromSize = me.calcSize() / 2
  case pChargeOffsetSide of
    #top:
      chargeOffset = point(0, -offsetFromSize)
    #side:
      Dir = 0
      owner = me.getRelation(#owner)
      if owner <> #none then
        Dir = owner.getFlipAsDir()
      end if
      chargeOffset = point(offsetFromSize * Dir, 0)
  end case
  return chargeOffset
end

on calcSize me
  return pCurrentCharge * me.getAttack().chargeSize
end

on charge me, chargeAmount, chargeLoc
  pCurrentCharge = chargeAmount
  me.align(chargeLoc)
  me.internalEvent(#charge)
end

on checkCollisions me, newVal
  return newVal
end

on checkDead me
  return 0
end

on gainExperience me, theAmount
  nothing()
end

on gainExperienceFromHealing me
  nothing()
end

on goMode me, newMode
  case newMode of
    #explode:
      attack = me.getAttack()
      explodeVolume = varMapRange(pCurrentCharge, attack.chargeVolumeMap.charge, attack.chargeVolumeMap.vol)
      pCurrentCharge = pCurrentCharge * attack.chargeExplodeFactor
      me.startQuickFade()
      g.teamMaster.impactAttack(me.id.bigMe)
      me.PlaySound(attack.explodeSound, explodeVolume)
      me.big.internalEvent(#explode)
  end case
  ancestor.goMode(newMode)
end

on calcAttackLoc me
  return me.getLoc()
end

on getAnimSym me, sym
  sym = me.getMode()
  case sym of
    #fly, #explode:
      sym = #charge
  end case
  return sym
end

on getCharge me
  return me.getCurrentCharge()
end

on getCurrentCharge me
  return pCurrentCharge
end

on getChargeOffsetSide me
  return pChargeOffsetSide
end

on getSpellProperties me
  return pSpellProperties
end

on getTargetLoc me
  owner = me.getOwner()
  if owner <> #none then
    return owner.getTargetLoc()
  else
    return #none
  end if
end

on internalEvent me, theEvent
  ancestor.internalEvent(theEvent)
  case theEvent of
    #spellReleased:
      if me.getAttack().releaseFunction = #release then
        me.releaseNormal(pReleaseTargetLoc, pReleaseSpeed)
      end if
  end case
end

on moveXYFin me
  ancestor.moveXYFin()
  me.goMode(#explode)
end

on playReleaseSound me
  attack = me.getAttack()
  chargeVolumeMap = attack.chargeVolumeMap
  releaseVolume = varMapRange(pCurrentCharge, chargeVolumeMap.charge, chargeVolumeMap.vol)
  me.PlaySound(attack.releaseSound, releaseVolume)
end

on release me, targetloc, speed
  pReleaseTargetLoc = targetloc
  pReleaseSpeed = speed
  me.big.internalEvent(#spellReleased)
end

on releaseNormal me, targetloc, speed
  params = me.getMoveXYParams(#moveToTarget)
  params.targetloc = targetloc
  params.speed = speed
  me.moveToTarget(params)
  me.playReleaseSound()
end

on recordKill me
  nothing()
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
  pChargeOffsetSide = sd.pChargeOffsetSide
  pCurrentCharge = sd.pCurrentCharge
  pmode = sd.pmode
  me.setSpellProperties(sd.pSpellProperties)
  if sd.isChargingSpell = 1 then
    player = g.actorMaster.getPlayer()
    player.setChargingSpell(me.big)
  end if
end

on setCurrentCharge me, newVal
  pCurrentCharge = newVal
end

on setSpellProperties me, params
  attack = params.attack
  me.setAttack(attack)
  me.setSpriteColour(attack.chargeColour)
  me.setTeam(params.team)
  pChargeOffsetSide = params.chargeOffsetSide
  pSpellProperties = params.duplicate()
  me.internalEvent(#spellPropertiesSet)
end

on start me
  ancestor.start()
  me.setCheckStalled(0)
end

on transBlendFin me
  me.finish()
end

on updateSize me
  mySize = me.calcSize()
  me.setSpriteWidth(mySize)
  me.setSpriteHeight(mySize)
end

on update me
  ancestor.update()
end
