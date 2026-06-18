property ancestor

on new me
  ancestor = new(script("objParams"))
  return me
end

on addModParams me
end

on checkDead me
  return me.big.getDead()
end

on colourTransformFin me
end

on die me
end

on faderFin me
end

on getChargeActive me
  return 0
end

on getExperienceLevel me
  return 0
end

on getInvinceActive me
  return 0
end

on getAcceleration me
  return 0
end

on getWalkSpeed me
  return 0
end

on getMode me
  return #finish
end

on setWalkSpeed me, newVal
end

on setAcceleration me, newVal
end

on getMoving me
  return 0
end

on modifyLocWithEyestrain me, theloc
  return theloc
end

on getGmgOn me
  return 0
end

on getReleaseActive me
  return 0
end

on goMode me, newMode
end

on incWalkAcceleration me
end

on isDwelling me
  return 0
end

on linkIn me
end

on linkOut me
end

on moveXYFin me
end

on outOfEnergy me
end

on paws me
end

on start me
end

on takeHeal me, collisionVect, healingObj
end

on takeHit me, collisionVect, attackingObj, owner
end

on takeFreeze me, collisionVect, attackingObj, owner
end

on teleportInFinished me
end

on teleportOutFinished me, caller
end

on unpaws me
end
