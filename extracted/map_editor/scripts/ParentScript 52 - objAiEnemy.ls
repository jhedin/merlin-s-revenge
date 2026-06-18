property ancestor, pAttack, pPlayer
global g, gGameSpeed

on new me
  me.ancestor = new(script("objAi"))
  return me
end

on init me, player
  ancestor.init()
  pPlayer = player
end

on initCharacterInfo me, characterPrg, spr, params
  ancestor.initCharacterInfo(characterPrg, spr)
  me.setAttack(params.attack)
  me.goMode(#moveToAttack)
end

on checkInRect me, therect
  moveVector = PointDirRect(me.pSpr.loc.duplicate(), therect)
  if (moveVector[1] = 0) and (moveVector[2] = 0) then
    return 1
  end if
  return moveVector
end

on characterModeChanged me, newCharMode
  aiMode = #any
  case newCharMode of
    #dead, #look, #recoil, #reel_fly, #reel_landed, #reel_sit:
      aiMode = #dazed
    otherwise:
      if me.pmode = #dazed then
        aiMode = #moveToAttack
      end if
  end case
  if aiMode <> #any then
    me.ensureMode(aiMode)
  end if
end

on getAttackLoc me
  Dir = SpriteGetFlipHAsDir(me.pSpr)
  attackLoc = pAttack.collisionLoc.duplicate()
  attackLoc[1] = attackLoc[1] * Dir
  attackLoc = me.pSpr.loc.duplicate() + attackLoc
  return attackLoc
end

on getAttackPower me
  Dir = SpriteGetFlipHAsDir(me.pSpr)
  attackPower = pAttack.power.duplicate()
  attackPower[1] = attackPower[1] * Dir
  return attackPower
end

on goMode me, newMode
  case newMode of
    #attack:
      if pAttack.cooldownCounter.fin then
        me.pCharacterPrg.ensureMode(#attack)
        CounterReset(pAttack.cooldownCounter)
        put "objAiEnemy: goMode #attack cooldown = " & pAttack.cooldownCounter.theCount
      else
        me.ensureMode(#moveToAttack)
        return 
      end if
    #moveToAttack:
      me.pCharacterPrg.ensureMode(#walk)
  end case
  ancestor.goMode(newMode)
end

on performAttack me
  case pAttack.type of
    #melee:
      me.performMeleeAttack()
    #ranged:
      if me.pCharacterPrg.getAnimFrameFresh() then
        me.performRangedAttack()
      end if
  end case
end

on performMeleeAttack me
  attackLoc = me.getAttackLoc()
  playerRect = pPlayer.getRect()
  if inside(attackLoc, playerRect) then
    attackPower = me.getAttackPower()
    pPlayer.takeHit(attackPower)
  end if
end

on performRangedAttack me
  distToPlayer = pPlayer.getLoc() - me.getLoc()
  throwVect = distToPlayer / 10
  throwVect[2] = throwVect[2] - 2
  bulletObj = g.actorMaster.newActor(pAttack.bullet, me.getAttackLoc())
  if bulletObj <> #none then
    bulletObj.setVect(throwVect)
  end if
end

on setAttack me, attack
  pAttack = attack.duplicate()
  pAttack[#cooldownCounter] = CounterNew()
  c = pAttack.cooldownCounter
  c.tim = [0, pAttack.cooldown]
  CounterReset(c)
end

on update me
  case me.pmode of
    #moveToAttack:
      fin = me.id.bigMe.updateMoveToAttack()
      if fin then
        me.id.bigMe.goMode(#attack)
      end if
    #attack:
      fin = me.updateAttack()
      if fin then
        me.id.bigMe.goMode(#moveToAttack)
      end if
  end case
  CounterOnce(pAttack.cooldownCounter)
end

on updateMoveToAttack me
  playerRect = pPlayer.getRect()
  playerRect = playerRect.inflate(pAttack.reach[1], pAttack.reach[2])
  return me.updateMoveToRect(playerRect)
end

on updateMoveToRect me, therect
  inRect = me.checkInRect(therect)
  if inRect = 1 then
    return 1
  else
    moveVector = inRect
  end if
  if me.pCharacterPrg.pmode = #landed then
    moveVector[2] = 0
  end if
  me.pCharacterPrg.moveHoriz(moveVector[1])
  case moveVector[2] of
    (-1):
      me.pCharacterPrg.doJump()
    0, 1:
      me.pCharacterPrg.noJump()
  end case
  return 0
end

on updateAttack me
  fin = 0
  if me.pCharacterPrg.pmode <> #attack then
    fin = 1
    return fin
  end if
  if me.pCharacterPrg.getAnimFrame() = pAttack.animframe then
    me.id.bigMe.performAttack()
    if pAttack.cutHair then
      hairObj = pPlayer.checkHairCollisionsObj(me.getAttackLoc())
      if hairObj = #none then
        nothing()
      else
        hairObj.cutOff()
      end if
    end if
  end if
  if me.pCharacterPrg.getAnimLooped() then
    playerRect = pPlayer.getRect()
    playerRect = playerRect.inflate(pAttack.reach[1], pAttack.reach[2])
    moveVector = PointDirRect(me.pSpr.loc.duplicate(), playerRect)
    if (moveVector[1] <> 0) or (moveVector[2] <> 0) then
      return 1
    end if
  end if
  return 0
end
