property ancestor, pBulletSafeDistance, pEnemySafeDistance, pEnemyGoodShootingDistance, pRefreshDestinationCounter, pSpellCasterMode, pBufferDistance
global g

on new me
  ancestor = new(script("objAiCPU"))
  i = me.modifyParams(#init)
  i[#enemyGoodShootingDistance] = 150
  return me
end

on init me, params
  ancestor.init(params)
  pBulletSafeDistance = 100
  pEnemySafeDistance = 100
  pBufferDistance = 20
  pEnemyGoodShootingDistance = params.enemyGoodShootingDistance
  pRefreshDestinationCounter = CounterNew()
  pRefreshDestinationCounter.tim[2] = 1
  pSpellCasterMode = #moveToOptimumPosition
end

on attackFin me
  me.setTarget(#none)
  ancestor.attackFin()
end

on characterModeChanged me, newMode
  ancestor.characterModeChanged(newMode)
  case newMode of
    #dead, #reel:
      pSpellCasterMode = #none
      me.pCharacterPrg.cancelMoveToLoc()
    #walk:
      me.goSpellCasterMode(#moveToOptimumPosition)
  end case
end

on eventNotification me, theEvent, theObj
  ancestor.eventNotification(theEvent, theObj)
  currentSpell = me.getCurrentSpell()
  if theObj = currentSpell then
    case theEvent of
      #chargeLimited:
        me.internalEvent(#spellCharged)
    end case
  end if
end

on goSpellCasterMode me, newMode
  pSpellCasterMode = newMode
end

on runFromObjects me, objectsToRunFrom, safeDistance
  runStatus = me.runToFromObjects(objectsToRunFrom, safeDistance, #away)
  return runStatus
end

on runTowardObjects me, objectsToRunTowards, safeDistance
  runStatus = me.runToFromObjects(objectsToRunTowards, safeDistance, #towards)
  return runStatus
end

on runToFromObjects me, objectsToRunToFrom, safeDistance, runDir
  runStatus = #notRunning
  if objectsToRunToFrom <> #none then
    closestPos = objectsToRunToFrom.closestPos
    closestList = objectsToRunToFrom.closestList
    closestObject = closestList[closestPos]
    weaponDist = closestObject.obj.getAttack()
    if (weaponDist.reach <> VOID) and (weaponDist.reach <> 9999) and (weaponDist.reach > safeDistance) then
      safeDistance = weaponDist.reach + 25
    end if
    runRequired = 0
    case runDir of
      #away:
        if closestObject.dist < safeDistance then
          runRequired = 1
        end if
      #towards:
        if closestObject.dist > safeDistance then
          runRequired = 1
        end if
    end case
    if runRequired then
      if closestPos = 1 then
        furthestPos = 2
      end if
      if closestPos = 2 then
        furthestPos = 1
      end if
      furthestObject = closestList[furthestPos]
      objLoc1 = closestObject.obj.getLoc()
      if furthestObject.obj <> #none then
        objLoc2 = furthestObject.obj.getLoc()
      else
        objLoc2 = objLoc1.duplicate()
      end if
      averageLoc = PointValRange(50, [objLoc1, objLoc2])
      case runDir of
        #away:
          runDestination = GeomMirrorPoint(averageLoc, me.getLoc(), safeDistance)
        #towards:
          runDestination = averageLoc
      end case
      me.pCharacterPrg.moveToLoc(runDestination)
      runStatus = #running
    end if
  end if
  return runStatus
end

on runTowardsObject me, theObj
  runStatus = #notRunning
  if theObj <> #none then
    runDestination = theObj.getLoc()
    dist = GeomDistSqr(me.getLoc(), runDestination)
    if (dist - (pEnemySafeDistance * pEnemySafeDistance)) > (pBufferDistance * pBufferDistance) then
      me.pCharacterPrg.moveToLoc(runDestination)
      runStatus = #running
    end if
  end if
  return runStatus
end

on runTangentToObjects me, objectsToRunToFrom, safeDistance
  runStatus = #notRunning
  if objectsToRunToFrom = #none then
    return runStatus
  end if
  closestPos = objectsToRunToFrom.closestPos
  closestList = objectsToRunToFrom.closestList
  closestObject = closestList[closestPos]
  runRequired = 0
  if closestObject.dist < safeDistance then
    runRequired = 1
  end if
  if runRequired then
    if closestPos = 1 then
      furthestPos = 2
    end if
    if closestPos = 2 then
      furthestPos = 1
    end if
    furthestObject = closestList[furthestPos]
    objLoc1 = closestObject.obj.getLoc()
    refVect = objLoc1 - me.getLoc()
    if furthestObject.obj <> #none then
      objLoc2 = furthestObject.obj.getLoc()
      averageLoc = PointValRange(50, [objLoc1, objLoc2])
      refDir = point(0, 0)
      locVect = objLoc2 - objLoc1
      if refVect.locH = 0 then
        temp = locVect.locH
        locVect.locH = locVect.locV
        locVect.locV = temp
      else
        if refVect.locH > 0 then
          refDir.locH = 1
        else
          refDir.locH = -1
        end if
      end if
      if refVect.locV >= 0 then
        refDir.locV = 1
      else
        refDir.locV = -1
      end if
      locVect = locVect * refVect
      if (locVect.locV * locVect.locH) > 0 then
        locDiff = locVect.locH - locVect.locV
        if locDiff > 0 then
          Dir = 1
        else
          dif = -1
        end if
      else
        if locVect.locV > 0 then
          Dir = 1
        else
          Dir = -1
        end if
      end if
      runDestination = GeomTangentPoint(objLoc1, me.getLoc(), Dir, safeDistance)
      runDest = GeomMirrorPoint(averageLoc, me.getLoc(), safeDistance)
      runDestination = PointValRange(25 + random(50), [runDestination, runDest])
    else
      runDestination = GeomTangentPoint(objLoc1, me.getLoc(), 1, safeDistance)
    end if
    me.pCharacterPrg.moveToLoc(runDestination)
    runStatus = #running
  end if
  return runStatus
end

on update me
  ancestor.update()
  if pSpellCasterMode = #moveToOptimumPosition then
    if me.getAttack().reach = 9999 then
      me.updateMoveToOptimumPosition()
    end if
  end if
end

on updateMoveToOptimumPosition me
  nearestBullets = g.teamMaster.findNearestEnemyBullets(me.pCharacterPrg)
  runStatus = me.runTangentToObjects(nearestBullets, pBulletSafeDistance)
  if runStatus = #notRunning then
    nearestEnemies = g.teamMaster.findNearestEnemies(me.pCharacterPrg)
    runStatus = me.runFromObjects(nearestEnemies, pEnemySafeDistance)
  end if
  if runStatus = #notRunning then
    myTarget = me.getRelation(#target)
    runStatus = me.runTowardsObject(myTarget)
  end if
  if runStatus = #notRunning then
    me.pCharacterPrg.stopMoving()
  end if
end
