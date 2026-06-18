property ancestor, pAI

on new me
  ancestor = new(script("objGameObject"))
  i = me.modifyParams(#init)
  i[#AI] = #none
  return me
end

on init me, params
  ancestor.init(params)
  pAI = params.AI
  pAI.initCharacterInfo(me.id.bigMe, me.pSpr, params)
end

on finish me
  pAI.finish()
  ancestor.finish()
end

on addSaveData me, sd
  saveData = [:]
  pAI.addSaveData(saveData)
  sd[#pAI] = saveData
  ancestor.addSaveData(sd)
end

on calcAttackDist me, tilesize
  return pAI.calcAttackDist(tilesize)
end

on calcAttackHit me, targetObj
  return pAI.calcAttackHit(targetObj)
end

on calcCollisionVect me, targetloc
  return pAI.calcCollisionVect(targetloc)
end

on cancelAttack me
  pAI.cancelAttack()
end

on getAI me
  return pAI
end

on getAIPlatformDrop me
  return pAI.getPlatformDrop()
end

on getAttack me
  return pAI.getAttack()
end

on getAttackDamageMultiplier me
  return pAI.getAttackDamageMultiplier()
end

on getAttackHits me
  return pAI.getAttackHits()
end

on getAttackLoc me
  return pAI.getAttackLoc()
end

on getAttackPayloadFunction me
  return pAI.getAttackPayloadFunction()
end

on getAttackTargetAllegiance me
  return pAI.getAttackTargetAllegiance()
end

on getAttackTargetCriteria me
  return pAI.getAttackTargetCriteria()
end

on getAttackTargetRoles me
  return pAI.getAttackTargetRoles()
end

on getChargingSpell me
  return pAI.getChargingSpell()
end

on getTargetLoc me
  return pAI.getTargetLoc()
end

on internalEvent me, theEvent
  ancestor.internalEvent(theEvent)
  case theEvent of
    #relationshipsRestored:
      nothing()
    otherwise:
      pAI.internalEvent(theEvent)
  end case
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
  pAI.restoreFromSave(sd.pAI)
end

on restoreRelationships me
  ancestor.restoreRelationships()
  pAI.restoreRelationships()
end

on setAttack me, theAttack
  pAI.setAttack(theAttack)
end

on setChargingSpell me, theSpell
  pAI.setChargingSpell(theSpell)
end

on start me
  pAI.start()
  ancestor.start()
end

on unpaws me
  ancestor.unpaws()
  pAI.unpaws()
end

on updateAI me
  pAI.update()
end
