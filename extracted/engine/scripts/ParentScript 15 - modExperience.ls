property ancestor, pExperienceAmountForNextLevel, pExperienceGained, pExperienceImWorth, pExperienceLevel, pExperienceRequiredForNextLevel, pExperienceRequiredInc, pStartingLevel, pReleaseStarOnLevel, pReleaseStarOnLevelOld, pResizeOnLevel, pKills, pLevelData, pExperienceAmountForLastLevel, pinitExperienceAmountNeeded
global g

on new me
  ancestor = new(script("modModule"))
  return me
end

on addModParams me
  i = me.modifyParams(#init)
  i[#experienceAmountForNextLevel] = 0
  i[#experienceRequiredForNextLevel] = 3
  i[#experienceRequiredInc] = 2
  i[#experienceImWorth] = 3
  i[#startingLevel] = 0
  ancestor.addModParams()
end

on init me, params
  ancestor.init(params)
  pExperienceAmountForNextLevel = params.experienceAmountForNextLevel
  pinitExperienceAmountNeeded = pExperienceAmountForNextLevel
  pExperienceGained = 0
  pExperienceImWorth = params.experienceImWorth
  pExperienceRequiredForNextLevel = params.experienceRequiredForNextLevel
  pExperienceRequiredInc = params.experienceRequiredInc
  pExperienceLevel = 0
  pKills = [:]
  pReleaseStarOnLevel = 1
  pReleaseStarOnLevelOld = 1
  pResizeOnLevel = 1
  pStartingLevel = params.startingLevel
  pLevelData = [:]
  pLevelData[#expToNxtLvl] = pExperienceAmountForNextLevel
  pLevelData[#expPnts] = 0
  pLevelData[#percentToNxt] = 0
  pExperienceAmountForLastLevel = 0
end

on addSaveData me, sd
  ancestor.addSaveData(sd)
  me.addToSaveData(sd)
end

on addToArmyDetails me
  ad = me.big.getArmyDetails()
  me.addToSaveData(ad)
end

on addToSaveData me, sd
  sd[#pExperienceAmountForNextLevel] = pExperienceAmountForNextLevel
  sd[#pExperienceGained] = pExperienceGained
  sd[#pExperienceLevel] = pExperienceLevel
  sd[#pExperienceRequiredForNextLevel] = pExperienceRequiredForNextLevel
  sd[#pKills] = pKills
  sd[#pLevelData] = pLevelData
end

on attemptToLevelUp me
  levelled = 0
  if pExperienceGained >= pExperienceAmountForNextLevel then
    pExperienceAmountForLastLevel = pExperienceAmountForNextLevel
    pExperienceAmountForNextLevel = (pExperienceLevel * pExperienceLevel * pExperienceLevel) + (pExperienceLevel * pExperienceLevel) + (pExperienceAmountForNextLevel / (pExperienceLevel + 1)) + 5 + pinitExperienceAmountNeeded
    me.levelUp()
    levelled = 1
    pLevelData[#expToNxtLvl] = pExperienceAmountForNextLevel - pExperienceAmountForLastLevel
    pExperienceRequiredForNextLevel = pExperienceRequiredForNextLevel + pExperienceRequiredInc
  end if
  return levelled
end

on attributeExperience me
  lastAttacker = me.big.getRelation(#lastAttacker)
  if lastAttacker <> #none then
    if me.isDwelling() then
      pExperienceImWorth = me.calculateExperienceFromResidents()
    end if
    myLevel = pExperienceLevel + 1
    if lastAttacker.getType() <> #objBullet then
      lastAttacker.gainExperience(pExperienceImWorth + (pExperienceGained / 2))
      lastAttacker.recordKill(me.big.getActorType())
    end if
    me.big.setRelation(#lastAttacker, #none)
  end if
end

on disableLevelUpStars me
  pReleaseStarOnLevelOld = pReleaseStarOnLevel
  pReleaseStarOnLevel = 0
end

on eventNotification me, theEvent, theObj
  ancestor.eventNotification(theEvent, theObj)
  case theEvent of
    #leaveGame:
      if theObj = me.big.getRelation(#lastAttacker) then
        me.big.breakRelationship(theObj, #lastAttacker)
      end if
  end case
end

on gainExperience me, theAmount
  pExperienceGained = pExperienceGained + theAmount
  levelled = 1
  repeat while levelled = 1
    levelled = me.attemptToLevelUp()
  end repeat
  pLevelData[#expPnts] = pExperienceGained - pExperienceAmountForLastLevel
  if pLevelData[#expToNxtLvl] = 0 then
    pLevelData[#percentToNxt] = 0
  else
    pLevelData[#percentToNxt] = (pLevelData.expPnts + 0.0) / pLevelData.expToNxtLvl
  end if
end

on gainExperienceFromHealing me, theHealedObj, theAmount
  me.gainExperience(theAmount)
end

on gainExperienceFromTransfer me, amount
  me.disableLevelUpStars()
  me.gainExperience(amount)
  me.restoreLevelUpStars()
end

on getExperience me
  return pExperienceGained
end

on getExperienceLevel me
  return pExperienceLevel
end

on getExperienceData me
  return pLevelData
end

on internalEvent me, theEvent
  ancestor.internalEvent(theEvent)
  case theEvent of
    #addToArmyDetails:
      me.addToArmyDetails()
    #buildingFinished:
      if pStartingLevel > 0 then
        me.levelUpToStartingLevel()
      end if
    #outOfEnergy:
      me.attributeExperience()
    #reincarnated:
      me.transferExperience()
    #restoreFromArmyDetails:
      me.restoreFromArmyDetails()
  end case
end

on levelUp me
  pExperienceLevel = pExperienceLevel + 1
  if pReleaseStarOnLevel then
    me.big.releaseStar()
    me.big.PlaySound("level_up", 100)
  end if
  me.big.incWalkAcceleration()
  me.big.internalEvent(#levelUp)
  me.eventNotify(#levelUp)
end

on levelUpToStartingLevel me
  me.disableLevelUpStars()
  repeat with i = 1 to pStartingLevel
    me.levelUp()
  end repeat
  me.restoreLevelUpStars()
end

on mergeExperience me, targetUnit
  experience = pExperienceImWorth + pExperienceGained
  targetUnit.gainExperience(experience)
  targetUnit.glowPink()
end

on recordKill me, actorType
  if pKills[actorType] = VOID then
    pKills[actorType] = 0
  end if
  pKills[actorType] = pKills[actorType] + 1
end

on restoreFromArmyDetails me
  ad = me.big.getArmyDetails()
  me.restoreFromSaveData(ad)
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
  me.restoreFromSaveData(sd)
end

on restoreFromSaveData me, sd
  pExperienceAmountForNextLevel = sd.pExperienceAmountForNextLevel
  pExperienceGained = sd.pExperienceGained
  pExperienceLevel = sd.pExperienceLevel
  pExperienceRequiredForNextLevel = sd.pExperienceRequiredForNextLevel
  pKills = sd.pKills
  pLevelData = sd.pLevelData
  me.setSpriteSizeFromLevel()
end

on restoreLevelUpStars me
  pReleaseStarOnLevel = pReleaseStarOnLevelOld
end

on setSpriteSizeFromLevel me
end

on setStartingLevel me, newVal
  pStartingLevel = newVal
  if pStartingLevel > 0 then
    me.levelUpToStartingLevel()
  end if
end

on takeHit me, collisionVect, attackingObj, owner
  if owner <> #none then
    me.big.formRelationship(owner, #lastAttacker, #exclusive)
    me.keepMePosted(owner, #leaveGame, #once)
  end if
  ancestor.takeHit(collisionVect, attackingObj, owner)
end

on takeHeal me, collisionVect, healingObj, owner
  ancestor.takeHeal(collisionVect, healingObj, owner)
  owner.gainExperienceFromHealing(me.big, collisionVect.locH + collisionVect.locV)
end

on transferExperience me
  reincarnatedMe = me.big.getReincarnatedMe()
  reincarnatedMe.gainExperienceFromTransfer(pExperienceGained / 2)
end
