property ancestor, pExplodeSound
global g

on new me
  ancestor = new(script("objBullet"))
  i = me.modifyParams(#init)
  i[#explodeSound] = #none
  return me
end

on init me, params
  pExplodeSound = params.explodeSound
  ancestor.init(params)
end

on collisionPlatform me
  me.goMode(#explode)
end

on collisionCeiling me
  me.goMode(#explode)
end

on collisionWallLeft me
  me.goMode(#explode)
end

on collisionWallRight me
  me.goMode(#explode)
end

on goMode me, newMode
  case me.pmode of
    #explode:
      if newMode = #explode then
        return 
      end if
  end case
  case newMode of
    #explode:
      me.setVect(point(0, 0))
      me.setWeight(0)
      me.pAnimSet.resetAnim(#explode)
      me.PlaySound(pExplodeSound)
  end case
  ancestor.goMode(newMode)
end

on update me
  case me.pmode of
    #explode:
      fin = me.updateExplode()
      if fin then
        me.setDead(1)
      end if
    #fly:
      stat = me.updateFly()
      if stat <> #continu then
        me.goMode(#explode)
      end if
  end case
  ancestor.update()
end

on updateExplode me
  animframe = me.pAnimSet.getFrame(#explode)
  if animframe = me.pAttack.animframe then
    if me.checkForCollisionWithPlayer() then
      attackPower = me.getAttackPower()
      me.pPlayer.takeHit(attackPower)
    end if
  end if
  fin = me.pAnimSet.getLooped(#explode)
  if fin = 1 then
    nothing()
  end if
  return fin
end
