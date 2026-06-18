property ancestor, pBlendFin, pBlendSpeed, pHeightFin, pStretchDeath, pStretchDeathStarted, pStretchHeight, pStretchSpeed
global g

on new me
  ancestor = new(script("modModule"))
  return me
end

on init me, params
  ancestor.init(params)
  pBlendFin = 1
  pHeightFin = 1
  pBlendSpeed = params.blendSpeed
  pStretchDeath = params.stretchDeath
  pStretchDeathStarted = 0
  pStretchHeight = params.stretchHeight
  pStretchSpeed = params.stretchSpeed
end

on addModParams me
  i = me.modifyParams(#init)
  i[#blendSpeed] = 3
  i[#stretchDeath] = 0
  i[#stretchHeight] = 50
  i[#stretchSpeed] = 1
  ancestor.addModParams()
end

on checkFin me
  if pBlendFin and pHeightFin then
    me.big.internalEvent(#stretchDeathFin)
  end if
end

on getStretchDeath me
  return pStretchDeath
end

on internalEvent me, theEvent
  ancestor.internalEvent(theEvent)
  case theEvent of
    #landed, #outOfEnergy, #reelFinished, #reelLanded, #walk:
      if me.big.checkDead() then
        if pStretchDeath = 1 then
          me.startStretchDeath()
          me.big.goMode(#dazed)
        else
          me.big.goMode(#die)
        end if
      end if
    #stretchDeathFin:
      me.big.goMode(#dead)
    #transBlendFin:
      if pStretchDeathStarted then
        pBlendFin = 1
        me.checkFin()
      end if
    #transHeightFin:
      if pStretchDeathStarted then
        pHeightFin = 1
        me.checkFin()
      end if
  end case
end

on startStretchDeath me
  me.big.startTransBlend(pBlendSpeed, #out)
  me.big.startStretchHeight(pStretchHeight, pStretchSpeed)
  pStretchDeathStarted = 1
  me.big.internalEvent(#stretchDeathStarted)
end
