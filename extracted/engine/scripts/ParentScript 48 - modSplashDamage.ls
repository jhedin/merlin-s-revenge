property ancestor, pSplashDamageOn, pSplashGraveOn
global g

on new me
  ancestor = new(script("modModule"))
  return me
end

on addModParams me
  i = me.modifyParams(#init)
  i[#splashDamageOn] = 0
  i[#splashGraveOn] = 0
  ancestor.addModParams()
end

on init me, params
  ancestor.init(params)
  pSplashDamageOn = params.splashDamageOn
  pSplashGraveOn = params.splashGraveOn
end

on calcAttackDistSplash me
  return me.big.pAttack.power
end

on calcAttackHitSplash me, obj
  hit = 0
  dist = GeomDistSqr(obj.getLoc(), me.big.getLoc())
  if dist < (me.big.pAttack.power * me.big.pAttack.power) then
    hit = 1
  end if
  return hit
end

on calcCollisionVectSplash me, objTarget
  targetloc = objTarget.getLoc()
  attackLoc = me.getLoc()
  attackPower = me.big.pAttack.power
  collisionVect = CollisionCalcVect(targetloc, attackLoc, attackPower)
  return collisionVect
end

on drawSplashGrave me
  if pSplashGraveOn then
    me.big.drawGrave()
  end if
end

on hasSplashDamage me
  return pSplashDamageOn
end

on impactSplashDamage me
  if pSplashDamageOn then
    g.teamMaster.impactAttack(me.big)
  end if
end

on internalEvent me, theEvent
  case theEvent of
    #land, #mineTriggered:
      me.impactSplashDamage()
      me.drawSplashGrave()
  end case
end
