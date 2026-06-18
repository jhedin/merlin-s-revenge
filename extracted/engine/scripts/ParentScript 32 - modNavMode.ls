property ancestor, pNavModeAcceleration, pNavModeActive, pNavModeNormalAcceleration, pPotionAccelerationInc, pWalkAccelerationInc

on new me
  ancestor = new(script("modModule"))
  return me
end

on init me, params
  pNavModeAcceleration = params.navModeAcceleration
  pNavModeNormalAcceleration = params.walkAcceleration
  pWalkAccelerationInc = 0.05
  pPotionAccelerationInc = 0.29999999999999999
  ancestor.init(params)
end

on addModParams me
  i = me.modifyParams(#init)
  i[#navModeAcceleration] = 6
  ancestor.addModParams()
end

on addSaveData me, sd
  ancestor.addSaveData(sd)
  sd[#pNavModeNormalAcceleration] = pNavModeNormalAcceleration
end

on getNavModeActive me
  return pNavModeActive
end

on getAcceleration me
  return pNavModeNormalAcceleration
end

on goNavMode me
  me.id.bigMe.setWalkAcceleration(pNavModeAcceleration)
  pNavModeActive = 1
end

on leaveNavMode me
  me.id.bigMe.setWalkAcceleration(pNavModeNormalAcceleration)
  pNavModeActive = 0
end

on incWalkAcceleration me, theType
  case theType of
    #potion:
      pNavModeNormalAcceleration = pNavModeNormalAcceleration + pPotionAccelerationInc
    #levelUp:
      pNavModeNormalAcceleration = pNavModeNormalAcceleration + pWalkAccelerationInc
    otherwise:
      pNavModeNormalAcceleration = pNavModeNormalAcceleration + pWalkAccelerationInc
  end case
  me.implementChanges()
end

on implementChanges me
  if pNavModeActive = 0 then
    me.leaveNavMode()
  end if
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
  pNavModeNormalAcceleration = sd.pNavModeNormalAcceleration
end

on setAcceleration me, newVal
  pNavModeNormalAcceleration = newVal
  me.implementChanges()
end
