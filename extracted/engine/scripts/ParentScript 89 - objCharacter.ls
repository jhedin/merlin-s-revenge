property ancestor, pChargeLoc, pChargeLocStore, pGmgChargeLoc, pChargeOffsetSide, pChargeOffsetStore, pDieSound, pDieVolume, pJumpPower, pJumpSound, pLeaveWhenFinished, pMasterPrg, pName
global g, gGameSpeed, gStageSize, gGameView

on new me
  ancestor = new(script("objAiGameObject"))
  i = me.modifyParams(#init)
  i.flags.append(#objCharacter)
  i[#attack] = g.structMaster.getStruct(#attack)
  i[#chargeLoc] = point(0, -8)
  i[#gmgChargeLoc] = point(8, 0)
  i[#chargeOffsetSide] = #top
  i[#dieSound] = #none
  i[#dieVolume] = 100
  i[#energy] = 100
  i[#energyRecoverDelay] = 30
  i[#jumpPower] = -7
  i[#jumpSound] = #none
  i[#leaveWhenFinished] = 0
  me.addModule("modAnimSet")
  me.addModule("modArmyUnit")
  me.addModule("modBuilder")
  me.addModule("modCharacterAttackProperties")
  me.addModule("modConstruction")
  me.addModule("modExperience")
  me.addModule("modFader")
  me.addModule("modEnergy")
  me.addModule("modFreeze")
  me.addModule("modGhost")
  me.addModule("modListNode")
  me.addModule("modMoveToLoc")
  me.addModule("modPositioning")
  me.addModule("modReel")
  me.addModule("modReincarnate")
  me.addModule("modScale")
  me.addModule("modStarReleaser")
  me.addModule("modStretchDeath")
  me.addModule("modStretcher")
  me.addModule("modTeleport")
  me.addModule("modWeaponManager")
  me.addModule("modWeaponTechnique")
  return me
end

on init me, params
  ancestor.init(params)
  pChargeLoc = params.chargeLoc
  pChargeLocStore = pChargeLoc
  pGmgChargeLoc = params.gmgChargeLoc
  pChargeOffsetSide = params.chargeOffsetSide
  pChargeOffsetStore = pChargeOffsetSide
  pDieSound = params.dieSound
  pDieVolume = params.dieVolume
  pMasterPrg = params.masterPrg
  pName = params.name
  pJumpPower = params.jumpPower
  pJumpSound = params.jumpSound
  pLeaveWhenFinished = params.leaveWhenFinished
end

on finish me
  ancestor.finish()
end

on attackCancelled me
  case me.pmode of
    #dead:
      nothing()
    otherwise:
      me.big.ensureMode(#walk)
  end case
end

on calcChargeLoc me
  Dir = me.big.getFlipAsDir()
  chargeLocOffset = pChargeLoc.duplicate()
  chargeLocOffset.locH = chargeLocOffset.locH * Dir
  chargeLoc = me.big.getLoc() + chargeLocOffset
  return chargeLoc
end

on chargeWeapon me
  me.id.bigMe.goMode(#charge)
end

on collisionPlatform me
  ancestor.collisionPlatform()
  case me.pmode of
    #reelFly:
      me.id.bigMe.goMode(#reelLanded)
    #jump, #fall:
      me.id.bigMe.goMode(#landed)
  end case
end

on collisionNoPlatform me
end

on die me
  ancestor.die()
end

on doJump me
  if me.pmode = #walk then
    me.goMode(#jump)
  end if
end

on energyChanged me
end

on ensureMode me, theMode
  if me.pmode <> theMode then
    me.goMode(theMode)
  end if
end

on getChargeLoc me
  return pChargeLoc
end

on getChargeOffsetSide me
  return pChargeOffsetSide
end

on getLeaveWhenFinished me
  return pLeaveWhenFinished
end

on getName me
  return pName
end

on goMode me, newMode
  case me.pmode of
    #reelFly:
      me.pSpr.rotation = 0
  end case
  case newMode of
    #charge, #naturalMelee, #naturalRanged, #weaponMelee, #weaponRanged, #magicMelee:
      me.resetAnim(newMode)
    #die:
      me.PlaySound(pDieSound, pDieVolume)
    #fall:
      vectY = me.pMoveXY.getVectY()
      if vectY < -2 then
        me.pMoveXY.setVectY(-2)
      end if
    #jump:
      me.pMoveXY.setVectY(pJumpPower)
      me.PlaySound(pJumpSound)
    #release:
      me.resetAnim(#release)
      me.resetAnim(#releasewalk)
  end case
  ancestor.goMode(newMode)
  me.pAI.characterModeChanged(newMode)
end

on internalEvent me, theEvent
  ancestor.internalEvent(theEvent)
  case theEvent of
    #buildingFinished:
      if me.pmode = #stand then
        me.goMode(#walk)
      end if
    #stretchDeathStarted:
      me.PlaySound(pDieSound, pDieVolume)
    #gmgTurnedOn:
      me.gmgOn()
    #gmgTurnedOff:
      me.gmgOff()
  end case
end

on gmgOn me
  pChargeOffsetSide = #side
  pChargeLoc = pGmgChargeLoc
end

on gmgOff me
  pChargeOffsetSide = pChargeOffsetStore
  pChargeLoc = pChargeLocStore
end

on leaveGame me
  me.goMode(#finish)
end

on outOfEnergy me
  ancestor.outOfEnergy()
end

on noJump me
  if me.pmode = #attack then
    vectY = me.pMoveXY.getVectY()
    if vectY < -2 then
      me.pMoveXY.setVectY(-2)
    end if
  end if
  if me.pmode = #jump then
    me.goMode(#fall)
  end if
  if me.pmode = #landed then
    me.goMode(#walk)
  end if
end

on releaseWeapon me
  me.id.bigMe.goMode(#release)
end

on setReleaseActive me, newVal
  pReleaseActive = newVal
end

on start me
  ancestor.start()
  me.startBuilding()
end

on update me
  case me.pmode of
    #attack:
      fin = me.updateAttack()
      if fin then
        me.goMode(#stand)
      end if
      me.recoverEnergy()
    #dead:
      nothing()
    #die:
      if me.getStretchDeath() = 0 then
        me.goMode(#dead)
      end if
    #release:
      fin = me.updateRelease()
      if fin then
        me.goMode(#walk)
      end if
      me.recoverEnergy()
    otherwise:
      me.recoverEnergy()
  end case
  ancestor.update()
end

on updateAttack me
  fin = 0
  if me.getAnimLooped() then
    fin = 1
  end if
  return fin
end

on updateRelease me
  fin = 0
  if me.getAnimLooped() then
    fin = 1
  end if
  return fin
end

on informCallingPrg me
  nothing()
end
