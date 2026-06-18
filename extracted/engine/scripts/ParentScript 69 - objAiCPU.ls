property ancestor, pFin, pRetargetCounter, pmultiAttack, pBufferDist
global g, gGameSpeed, gGameView

on new me
  me.ancestor = new(script("objAiAttack"))
  me.addModule("modPathFinding")
  return me
end

on init me, params
  ancestor.init(params)
  pFin = 0
  pRetargetCounter = CounterNew()
  pRetargetCounter.tim[2] = 30
end

on initCharacterInfo me, characterPrg, spr, params
  ancestor.initCharacterInfo(characterPrg, spr, params)
  pmultiAttack = params.multiAttack
  pBufferDist = params.bufferDist
end

on attack me
  attackType = me.getAttack().type
  if attackType <> #magic then
    me.faceTarget()
  end if
  ancestor.attack()
end

on attackFin me, reason
  me.clearTarget()
  me.refreshTarget()
  myTarget = me.getRelation(#target)
  if myTarget = #none then
    me.big.goMode(#findTarget)
  else
    if me.pCharacterPrg.getRunReload() = 1 then
      me.big.goMode(#runReload)
    else
      me.big.goMode(#moveToAttack)
    end if
  end if
  ancestor.attackFin(reason)
end

on calcDirXToTarget me
  myTarget = me.getRelation(#target)
  myX = me.getLoc()[1]
  targetX = myTarget.getLoc()[1]
  dirX = VarMoreLess(myX, targetX)
  if dirX = 0 then
    dirX = 1
  end if
  return dirX
end

on calcSpellTargetLoc me
  myTarget = me.getTarget()
  targetloc = myTarget.getLoc()
  attack = me.getAttack()
  if attack.targetTileWhenNotBlank = 1 then
    currentSpell = me.getCurrentSpell()
    if currentSpell = #none then
      return #none
    end if
    payload = currentSpell.getPayload()
    if payload <> #none then
      currentMap = g.gamemaster.getCurrentMap()
      targetloc = currentMap.getLocOfCentreOfTileAtLoc(targetloc)
    end if
  end if
  return targetloc
end

on checkInRect me, therect
  moveVector = PointDirRectProportional(me.pSpr.loc.duplicate(), therect)
  if (moveVector[1] = 0) and (moveVector[2] = 0) then
    return 1
  end if
  return moveVector
end

on characterModeChanged me, newCharMode
  ancestor.characterModeChanged(newCharMode)
  aiMode = #any
  case newCharMode of
    #dazed, #dead, #die, #finish, #look, #recoil, #reel, #reelFly, #reelLanded, #reelSit:
      aiMode = #dazed
    otherwise:
      if me.pmode = #dazed then
        aiMode = #findTarget
      end if
  end case
  if aiMode <> #any then
    me.ensureMode(aiMode)
  end if
end

on clearTarget me
  myTarget = me.getTarget()
  if myTarget <> #none then
    me.breakRelationship(myTarget, #target)
  end if
end

on eventNotification me, theEvent, theObj
  ancestor.eventNotification(theEvent, theObj)
  case theEvent of
    #leaveGame:
      myTarget = me.getRelation(#target)
      if myTarget = theObj then
        me.clearTarget()
        me.refreshTarget()
        me.big.internalEvent(#targetLeft)
      end if
  end case
end

on faceTarget me
  dirX = me.calcDirXToTarget()
  me.pCharacterPrg.setFlipFromDir(dirX)
end

on getTarget me
  return me.getRelation(#target)
end

on getTargetLoc me
  myTarget = me.getRelation(#target)
  if myTarget = #none then
    return #none
  end if
  if myTarget.getDead() or myTarget.checkDead() then
    me.clearTarget()
    if me.pCharacterPrg.checkDead() = 0 then
      me.big.goMode(#findTarget)
    end if
    return #none
  end if
  return myTarget.getLoc()
end

on goMode me, newMode
  case newMode of
    #dazed:
      me.pCharacterPrg.moveToLoc(#none)
    #findTarget:
      me.pCharacterPrg.stopRunAnim()
      me.pCharacterPrg.ensureMode(#walk)
    #moveToAttack:
      me.pCharacterPrg.ensureMode(#walk)
      CounterReset(pRetargetCounter)
    #restoreTarget:
      pRestoreMode = me.pmode
    #runReload:
      me.pCharacterPrg.ensureMode(#walk)
  end case
  ancestor.goMode(newMode)
end

on internalEvent me, theEvent
  ancestor.internalEvent(theEvent)
  case theEvent of
    #buildingFinished:
      if me.pCharacterPrg.getBuildOne() then
        me.goMode(#findTarget)
      else
        me.goMode(#walkToBuilding)
      end if
    #noTargetFound:
      me.cancelAttack()
      if me.pCharacterPrg.getLeaveWhenFinished() then
        me.pCharacterPrg.armyTeleportOut()
        g.wizardMaster.wizardOff()
      end if
    #relationshipsRestored:
      theTarget = me.getRelation(#target)
      if theTarget <> #none then
        me.keepMePosted(theTarget, #leaveGame, #once)
      end if
    #spellCharged:
      targetloc = me.calcSpellTargetLoc()
      if targetloc <> #none then
        me.releaseMagic(targetloc)
      else
        me.cancelAttack()
      end if
  end case
end

on jumpOntoPlatform me, moveVector, therect
  if me.pCharacterPrg.getMode() = #jump then
    targetBottom = therect[4]
    thisBottom = me.pCharacterPrg.getRect()[4]
    if thisBottom > (targetBottom - 5) then
      moveVector[2] = -1
    end if
  end if
  return moveVector
end

on refreshTarget me
  myTarget = me.getRelation(#target)
  newTarget = #none
  case myTarget of
    #none:
      closestTarget = g.teamMaster.findTarget(me.pCharacterPrg)
      newTarget = closestTarget.obj
      if me.getAttack().name = #healBlast then
        if closestTarget.dist = 100 then
          newTarget = #none
        end if
      end if
  end case
  if newTarget <> #none then
    me.keepMePosted(newTarget, #leaveGame, #once)
    me.formRelationship(newTarget, #target, #exclusive)
    me.pCharacterPrg.setMultiAttack(pmultiAttack, pBufferDist)
  else
    me.pCharacterPrg.moveToLoc(#none)
    if g.teamMaster.isTargetsDead(me.big) then
      me.big.internalEvent(#noTargetFound)
    else
      if g.teamMaster.getRoomClear() then
        me.big.internalEvent(#noTargetFound)
      end if
    end if
  end if
end

on revalidateTarget me
  myTarget = me.getRelation(#target)
  if ilk(myTarget, #object) then
    if (myTarget.checkDead() = 1) or (myTarget.getDead() = 1) then
      me.breakRelationship(myTarget, #target)
      myTarget = me.getRelation(#target)
      me.big.goMode(#findTarget)
    end if
  end if
  if myTarget = #none then
    me.refreshTarget()
  end if
end

on setTarget me, newTarget
  if newTarget = #none then
    me.clearTarget()
  else
    me.formRelationship(newTarget, #target, #exclusive)
    me.keepMePosted(newTarget, #leaveGame, #once)
    me.keepMePosted(newTarget, #outOfEnergy, #once)
  end if
end

on start me
  ancestor.start()
end

on targetInReach me
  finState = #notFin
  attackType = me.getAttack().type
  case attackType of
    #melee:
      fin = me.targetInReachMelee()
    #explode, #ranged, #magic:
      fin = me.targetInReachRanged()
  end case
  if fin = 1 then
    finState = #fin
  end if
  return finState
end

on targetInReachMelee me
  myTarget = me.getRelation(#target)
  strikePointLeft = me.calcStrikePoint(-1)
  strikePointRight = me.calcStrikePoint(1)
  targetRect = myTarget.getCollisionRect()
  if strikePointLeft.inside(targetRect) or strikePointRight.inside(targetRect) then
    return 1
  else
    return 0
  end if
end

on targetInReachRanged me
  myTarget = me.getRelation(#target)
  attackReach = me.getAttack().reach
  if ilk(attackReach, #point) then
    targetRect = myTarget.getRect()
    targetRect = targetRect.inflate(attackReach[1], attackReach[2])
    fin = me.getLoc().inside(targetRect)
  else
    if ilk(attackReach, #integer) then
      disttotarget = GeomDistSqr(me.getLoc(), myTarget.getLoc())
      fin = disttotarget < (attackReach * attackReach)
    end if
  end if
  return fin
end

on unDaze me, previousCharacterMode
  continueAttack = 0
  case previousCharacterMode of
    #naturalRanged, #naturalMelee, #weaponRanged, #weaponMelee, #magicMelee:
      myTarget = me.getRelation(#target)
      if myTarget <> #none then
        inrange = me.targetInReach()
        if inrange = #fin then
          continueAttack = 1
        end if
      end if
  end case
  if continueAttack then
    me.big.setMode(#attack)
  else
    me.goMode(#findTarget)
  end if
end

on update me
  case me.pmode of
    #findTarget:
      fin = me.big.updateFindTarget()
      if fin then
        me.big.goMode(#moveToAttack)
      end if
    #moveToAttack:
      finState = me.id.bigMe.updateMoveToAttack()
      if finState = #noTarget then
        me.clearTarget()
        me.big.goMode(#findTarget)
      end if
      if finState = #fin then
        me.id.bigMe.attack()
      end if
    #runReload:
      fin = me.updateRunReload()
      if fin then
        me.big.goMode(#moveToAttack)
      end if
  end case
  ancestor.update()
end

on updateFindTarget me
  fin = 0
  me.refreshTarget()
  myTarget = me.getTarget()
  if myTarget <> #none then
    fin = 1
  end if
  return fin
end

on updateMoveToAttack me
  me.updateRetargetCounter()
  myTarget = me.getTarget()
  if myTarget = #none then
    return #noTarget
  end if
  if myTarget.getDead() or myTarget.checkDead() then
    return #noTarget
  end if
  finState = me.targetInReach()
  if finState = #noTarget then
    return finState
  end if
  if finState = #fin then
    me.big.internalEvent(#arrivedAtAttackLoc)
    return #fin
  end if
  idealAttackLoc = me.calcIdealAttackLoc(myTarget.getLoc())
  me.findPathToLoc(idealAttackLoc)
  return #notFin
end

on updateMoveToRect me, therect
  inRect = me.checkInRect(therect)
  if inRect = 1 then
    return 1
  else
    moveVector = inRect
  end if
  targetloc = RectCalcMiddle(therect)
  me.pCharacterPrg.moveTowardsLoc(targetloc)
end

on updateRetargetCounter me
  counter(pRetargetCounter)
  if pRetargetCounter.fin then
    me.clearTarget()
    me.refreshTarget()
    CounterReset(pRetargetCounter)
  end if
end

on updateRunReload me
  fin = 0
  me.updateRetargetCounter()
  if me.pCharacterPrg.getCooldownFin() = 1 then
    fin = 1
  end if
  myTarget = me.getTarget()
  if myTarget <> #none then
    targetloc = myTarget.getLoc()
    me.pCharacterPrg.moveAwayFromLoc(targetloc)
  end if
  return fin
end
