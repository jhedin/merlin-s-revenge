property ancestor, pRecoil, pRecoilCounter, pReelFinishSpeed, pReelProof, pSitCounter
global gGameView

on new me
  ancestor = new(script("modModule"))
  return me
end

on init me, params
  ancestor.init(params)
  pRecoil = params.recoil
  pRecoilCounter = CounterNew()
  pRecoilCounter.tim[2] = params.recoilDuration
  pReelProof = params.reelProof
end

on addModParams me
  i = me.modifyParams(#init)
  i[#recoil] = 0
  i[#recoilDuration] = 0
  i[#reelFinishSpeed] = 0.29999999999999999
  i[#reelProof] = 0
  i[#rotationSpeed] = 10
  i[#sitTime] = 30
  ancestor.addModParams()
end

on goDamageMode me
  if me.big.checkDead() then
    me.goReelMode()
    return 
  end if
  if pRecoil then
    me.big.goMode(#recoil)
  else
    me.goReelMode()
  end if
end

on goReelMode me
  me.big.goMode(#reel)
end

on goMode me, newMode
  case newMode of
    #recoil:
      me.frictionStrong()
      CounterReset(pRecoilCounter)
    #reel:
      me.big.frictionReel()
      me.big.resetStallCounter()
    #reelFly:
      me.big.frictionXOff()
    #reelSit:
      CounterReset(pSitCounter)
  end case
  ancestor.goMode(newMode)
end

on internalEvent me, theEvent
  ancestor.internalEvent(theEvent)
  case theEvent of
    #reelFinished:
      if me.checkDead() = 0 then
        me.big.goMode(#walk)
      end if
  end case
end

on takeHit me, collisionVect, attackingObj, owner
  ancestor.takeHit(collisionVect, attackingObj, owner)
  if pReelProof = 0 then
    me.goDamageMode()
  end if
end

on update me
  case me.id.bigMe.getMode() of
    #reel:
      fin = me.updateReel()
      if fin then
        me.big.internalEvent(#reelFinished)
      end if
    #recoil:
      fin = me.updateRecoil()
      if fin then
        me.goMode(#stand)
      end if
    #reelFly:
      me.updateReelFly()
    #reelLanded:
      fin = me.updateReelLanded()
      if fin then
        if me.checkDead() then
          me.goMode(#dead)
        else
          me.goMode(#reelSit)
        end if
      end if
    #reelSit:
      fin = me.updateReelSit()
      if fin then
        me.goMode(#look)
      end if
  end case
  ancestor.update()
end

on updateRecoil me
  fin = 0
  if pRecoilCounter.fin then
    fin = 1
  end if
  counter(pRecoilCounter)
  return fin
end

on updateReel me
  fin = me.big.getStalled()
  me.big.internalEvent(#updateReel)
  return fin
end

on updateReelFly me
end

on updateReelLanded me
  vectX = me.getVectX()
  speedX = VarPositive(vectX)
  if speedX < pReelFinishSpeed then
    return 1
  end if
  return 0
end

on updateReelSit me, callingPrg
  if pSitCounter.fin then
    return 1
  end if
  counter(pSitCounter)
  return 0
end
