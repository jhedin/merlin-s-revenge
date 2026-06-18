property ancestor, pAnimSet, pAttack, pmode, pPlayer
global g

on new me
  ancestor = new(script("objGameObject"))
  i = me.pParams.init
  i[#attack] = g.structMaster.getStruct(#attack)
  return me
end

on init me, params
  ancestor.init(params)
  pAnimSet = g.objectMaster.requestObject(#objAnimSet)
  pAnimSet.init(params.name, params.character)
  pAttack = params.attack
  pPlayer = g.actorMaster.getPlayer()
  me.goMode(#stand)
end

on checkCollisions me, newLoc, oldloc
  theloc = newLoc.duplicate()
  updatedLoc = ancestor.checkCollisions(newLoc, oldloc)
  return theloc
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

on getAnimSym me
  return pmode
end

on getAttackPower me
  Dir = PointDirPoint(me.getLoc(), pPlayer.getLoc())
  attackPower = pAttack.power.duplicate()
  attackPower = attackPower * Dir
  return attackPower
end

on goMode me, newMode
  case pmode of
    #explode:
      if newMode = #explode then
        return 
      end if
  end case
  case newMode of
    #explode:
      me.setVect(point(0, 0))
      me.setWeight(0)
      pAnimSet.resetAnim(#explode)
  end case
  pmode = newMode
end

on update me
  case pmode of
    #explode:
      fin = me.updateExplode()
      if fin then
        me.setDead(1)
      end if
    #stand:
      fin = me.updateStand()
      if fin then
        me.goMode(#explode)
      end if
  end case
  me.id.bigMe.updateAnim()
  ancestor.update()
end

on updateAnim me
  sym = me.id.bigMe.getAnimSym(#none)
  member = pAnimSet.getMember(sym)
  SpriteSetMember(me.pSpr, member)
end

on updateExplode me
  animframe = pAnimSet.getFrame(#explode)
  if animframe = pAttack.animframe then
    if me.checkForCollisionWithPlayer() then
      attackPower = me.getAttackPower()
      pPlayer.takeHit(attackPower)
    end if
  end if
  fin = pAnimSet.getLooped(#explode)
  return fin
end

on updateStand me
  fin = 0
  if me.checkForCollisionWithPlayer() then
    fin = 1
  end if
  return fin
end
