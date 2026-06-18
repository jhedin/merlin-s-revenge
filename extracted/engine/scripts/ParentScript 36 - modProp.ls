property ancestor, pBeProducedSpeed, pBePutAwaySpeed, pPropCarried, pPropCarrier, pPropCarryLoc, pPropDropFriction, pPropDropSpeed, pPropExitStageSpeed, pPropMode, pPropProducedStartSize, pPropPutAwayEndSize, pPropStatus
global g

on new me
  ancestor = new(script("modModule"))
  return me
end

on addModParams me
  i = me.modifyParams(#init)
  i[#propCarryLoc] = #none
  i[#propStatus] = #notAProp
  ancestor.addModParams()
end

on init me, params
  ancestor.init(params)
  pBeProducedSpeed = 1
  pBePutAwaySpeed = 1
  pPropCarryLoc = params.propCarryLoc
  pPropCarried = #none
  pPropCarrier = #none
  pPropDropFriction = point(12, 12)
  pPropDropSpeed = 7
  pPropExitStageSpeed = 1
  pPropMode = #none
  pPropProducedStartSize = point(4, 4)
  pPropPutAwayEndSize = point(10, 10)
  pPropStatus = params.propStatus
end

on beProducedAsProp me, carrier
  bigMe = me.id.bigMe
  pPropStatus = #prop
  pPropCarrier = carrier
  bigMe.setAnimAllowStretching(1)
  bigMe.setSpriteHeight(pPropProducedStartSize.locV)
  bigMe.setSpriteWidth(pPropProducedStartSize.locH)
  me.goPropMode(#beProducedAsProp)
  memberSize = bigMe.getMemberSize()
  bigMe.startStretch(memberSize.locH, memberSize.locV, pBeProducedSpeed)
end

on bePutAwayAsProp me
  me.goPropMode(#bePutAwayAsProp)
  me.big.setAnimAllowStretching(1)
  me.big.startStretch(pPropPutAwayEndSize.locH, pPropPutAwayEndSize.locV, pBePutAwaySpeed)
end

on carryProp me, theprop
  if pPropCarried <> #none then
    me.dropProp()
  end if
  pPropCarried = theprop
end

on dropProp me
  if pPropCarried <> #none then
    pPropCarried.propDropped()
    xVect = me.big.getFlipAsDir() * pPropDropSpeed
    pPropCarried.resetStallCounter()
    pPropCarried.setVect(point(xVect, 0))
    pPropCarried = #none
  end if
end

on eventNotification me, theEvent, theObj
  ancestor.eventNotification(theEvent, theObj)
  case theEvent of
    #finishedBeingPutAway:
      if theObj = pPropCarried then
        pPropCarried.noLongerCarried()
        pPropCarried.gotoWings()
        pPropCarried = #none
      end if
  end case
end

on internalEvent me, theEvent
  ancestor.internalEvent(theEvent)
  case theEvent of
    #stretchFinished:
      case pPropMode of
        #bePutAwayAsProp:
          me.big.eventNotify(#finishedBeingPutAway)
      end case
  end case
end

on getPropCarryingLoc me
  bigMe = me.id.bigMe
  mywidth = bigMe.getSpriteWidth()
  myloc = bigMe.getLoc()
  myDir = bigMe.getFlipAsDir()
  carryLoc = point(0, 0)
  if pPropCarryLoc = #none then
    propCarryLoc = point(mywidth / 2 * myDir, 0)
  else
    propCarryLoc = pPropCarryLoc.duplicate()
    propCarryLoc.locH = propCarryLoc.locH * myDir
  end if
  carryLoc = myloc + propCarryLoc
  return carryLoc
end

on goPropMode me, newMode
  pPropMode = newMode
end

on getPropStatus me
  return pPropStatus
end

on moveXYFin me
  case pPropMode of
    #droppedAsProp:
      me.big.frictionNormal()
    #propExit:
      me.big.frictionNormal()
      me.big.gotoWings()
  end case
  me.goPropMode(#none)
  ancestor.moveXYFin()
end

on noLongerCarried me
  pPropCarrier = #none
end

on propDropped me
  me.big.frictionSet(pPropDropFriction)
  me.big.setLocY(me.positionEdge(#bottom, g.cutSceneMaster.getStageFloor()))
  me.goPropMode(#droppedAsProp)
  pPropCarrier = #none
end

on propExitStageLeft me
  me.propExitStage(me.big.calcStageLeftOffLoc())
end

on propExitStageRight me
  me.propExitStage(me.big.calcStageRightOffLoc())
end

on propExitStage me, exitLoc
  me.goPropMode(#propExit)
  me.frictionSet(point(0, 0))
  params = me.big.pMoveXY.getParams(#moveToTarget)
  params.targetloc = point(exitLoc, me.positionEdge(#bottom, g.cutSceneMaster.getStageFloor()))
  params.speed = pPropExitStageSpeed
  me.big.moveToTarget(params)
end

on propFinishedBeingPutAway me
  if pPropCarried <> #none then
    pPropCarried = #none
    pPropCarried.gotoWings()
  end if
end

on putAwayProp me
  pPropCarried.bePutAwayAsProp()
  me.big.keepMePosted(pPropCarried, #finishedBeingPutAway, #once)
end

on setPropStatus me, newVal
  pPropStatus = newVal
end

on stopPropExit me
  me.goPropMode(#none)
  me.big.setVect(point(0, 0))
  me.big.frictionNormal()
end

on update me
  ancestor.update()
  if pPropCarrier <> #none then
    me.updateBeCarried()
  end if
end

on updateBeCarried me
  carryingLoc = pPropCarrier.getPropCarryingLoc()
  me.big.setLoc(carryingLoc)
  me.big.setFlipFromDir(pPropCarrier.getFlipAsDir())
end
