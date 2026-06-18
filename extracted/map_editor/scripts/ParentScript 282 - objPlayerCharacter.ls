property ancestor, pDieWeight, pDieVectY, pEnergyBar
global g

on new me
  me.ancestor = new(script("objHairCharacter"))
  me.pParams.init.character = #playerCharacter
  me.pParams.init.energy = 100
  return me
end

on init me, params
  me.ancestor.init(params)
  pDieVectY = -15
  pDieWeight = 0.59999999999999998
  pEnergyBar = g.objectMaster.requestObject(#objEnergyBar)
  surroundSpr = g.spriteMaster.getSpriteWithMember(member("health_bar_surround", "gfx"))
  surroundRect = surroundSpr.rect.duplicate()
  params = pEnergyBar.getParams(#init)
  params.surroundRect = surroundRect
  params.maxEnergy = me.pEnergy
  params.currentEnergy = me.pEnergy
  pEnergyBar.init(params)
end

on finish me
  pEnergyBar.finish()
  ancestor.finish()
end

on checkCollisions me, newLoc, oldloc
  case me.pmode of
    #die:
      newLoc = g.collisionMaster.checkCollisionsWalls(me, newLoc, me.pSpr)
    otherwise:
      newLoc = ancestor.checkCollisions(newLoc, oldloc)
  end case
  return newLoc
end

on energyChanged me
  pEnergyBar.updateEnergy(me.pEnergy)
end

on goMode me, newMode
  case newMode of
    #die:
      me.pSpr.flipH = 0
      me.pMoveXY.setVectY(pDieVectY)
      me.pMoveXY.setWeight(pDieWeight)
  end case
  ancestor.goMode(newMode)
end

on takeHit me, collideVect
  if me.pmode = #die then
    return 
  end if
  speedVect = PointPositive(collideVect.duplicate())
  me.pEnergy = me.pEnergy - speedVect[1] - speedVect[2]
  me.energyChanged()
  me.ancestor.takeHit(collideVect)
  if me.checkDead() then
    me.goMode(#die)
  end if
end

on update me
  gameOver = 0
  case me.pmode of
    #die:
      fin = me.updateDie()
      if fin then
        gameOver = 1
      end if
  end case
  ancestor.update()
  if gameOver then
    g.gamemaster.gameOver()
  end if
end

on updateDie me
  if me.pMoveXY.onscreen() = 0 then
    return 1
  end if
  return 0
end
