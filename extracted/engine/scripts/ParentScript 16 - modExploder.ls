property ancestor, pExplodeCharge, pExplodeEvents, pExplodeSound, pExplodeVolume
global g

on new me
  ancestor = new(script("modModule"))
  return me
end

on addModParams me
  i = me.modifyParams(#init)
  i[#explodeEvents] = []
  i[#explodeSound] = #none
  i[#explodeVolume] = 50
  ancestor.addModParams()
end

on init me, params
  ancestor.init(params)
  pExplodeCharge = #none
  pExplodeEvents = params.explodeEvents
  pExplodeSound = params.explodeSound
  pExplodeVolume = params.explodeVolume
end

on initExplodeCharge me
  pExplodeCharge = me.getAttack().explodeCharge
end

on explode me
  me.big.PlaySound(pExplodeSound, pExplodeVolume)
  g.teamMaster.impactAttack(me.big)
  me.big.goMode(#explode)
end

on getCurrentCharge me
  return pExplodeCharge
end

on goMode me, newMode
  if newMode = #explode then
    me.setAnimKeepSize(0)
    me.big.resetAnim(#explode)
  end if
  ancestor.goMode(newMode)
end

on internalEvent me, theEvent
  ancestor.internalEvent(theEvent)
  if pExplodeEvents.getPos(theEvent) then
    me.explode()
  else
    case theEvent of
      #bulletCollidedWithTarget:
        me.big.die()
      #bulletLanded:
        me.big.goMode(#land)
    end case
  end if
  case theEvent of
    #attackSet:
      me.initExplodeCharge()
  end case
end

on update me
  ancestor.update()
  case me.big.getMode() of
    #explode:
      fin = me.updateExplode()
      if fin then
        me.big.internalEvent(#explodeFin)
      end if
  end case
end

on updateExplode me
  fin = me.big.getAnimLooped(#explode)
  return fin
end
