property ancestor, pAllowRangeSelections, pBoxes, pBoxSize, pGreenBoxMember, pNewSelection, pTarget, pTargetRect, pTargetGridSize, pRequester, pselection, pSelectOnPress, pYellowBoxMember
global g, gGridSelectorLayer

on new me
  ancestor = new(script("objAutoUpdate"))
  i = me.modifyParams(#init)
  i[#allowRangeSelections] = 0
  i[#greenBoxMember] = #none
  i[#requester] = #none
  i[#selectOnPress] = 0
  i[#targetObject] = #none
  i[#yellowBoxMember] = #none
  return me
end

on init me, params
  ancestor.init(params)
  pAllowRangeSelections = params.allowRangeSelections
  pBoxes = #none
  pBoxSize = point(1, 1)
  pGreenBoxMember = params.greenBoxMember
  pNewSelection = #none
  pRequester = params.requester
  pselection = #none
  pSelectOnPress = params.selectOnPress
  pTarget = #none
  pYellowBoxMember = params.yellowBoxMember
  if params.targetObject <> #none then
    me.setTarget(params.targetObject)
  end if
  if pRequester = #none then
    pRequester = pTarget
  end if
end

on finish me
  me.freeBoxes()
  ancestor.finish()
end

on calcGridLoc me, mousePos
  posOnTarget = mousePos - point(pTargetRect[1], pTargetRect[2])
  posAsGridLoc = posOnTarget / pTargetGridSize
  gridLoc = PointFloor(posAsGridLoc)
  gridLoc = gridLoc + point(1, 1)
  return gridLoc
end

on calcGridRect me, gridLoc
  startPoint = (gridLoc - point(1, 1)) * pTargetGridSize
  endPoint = gridLoc * pTargetGridSize
  targetOffset = point(pTargetRect[1], pTargetRect[2])
  startPoint = startPoint + targetOffset
  endPoint = endPoint + targetOffset
  therect = rect(startPoint, endPoint)
  return therect
end

on calcSelectionRect me, theSelection
  startRect = me.calcGridRect(theSelection[1])
  if pAllowRangeSelections then
    endPoint = theSelection[2]
  else
    endPoint = theSelection[1] + pBoxSize - point(1, 1)
  end if
  endRect = me.calcGridRect(endPoint)
  x1 = min(startRect[1], endRect[1])
  y1 = min(startRect[2], endRect[2])
  x2 = max(startRect[3], endRect[3])
  y2 = max(startRect[4], endRect[4])
  selRect = rect(x1, y1, x2, y2)
  return selRect
end

on drawSelection me, which
  case which of
    #newSelection:
      theSel = pNewSelection
      boxCol = #yellow
    #selection:
      theSel = pselection
      boxCol = #green
  end case
  if pSelectOnPress = 0 then
    selRect = me.calcSelectionRect(theSel)
    pBoxes[boxCol].setRect(selRect)
  else
    me.moveBox(#green, #none)
  end if
end

on freeBoxes me
  g.objectMaster.finishObjects(pBoxes)
end

on hoverStart me, gridLoc
  me.moveBox(#yellow, gridLoc)
end

on makeNewSelectionCurrent me
  pselection = pNewSelection
  pNewSelection = #none
  me.drawSelection(#selection)
  me.moveBox(#yellow, #none)
  me.sendSelectionToRequester()
end

on mouseRelease me, gridLoc
  if pNewSelection <> #none then
    me.selectEnd(gridLoc)
  else
    me.hoverStart(gridLoc)
  end if
end

on mousePress me, gridLoc
  if pNewSelection = #none then
    me.selectStart(gridLoc)
  else
    me.hoverEnd(gridLoc)
  end if
end

on hoverEnd me, gridLoc
  pNewSelection[2] = gridLoc
  if pAllowRangeSelections = 0 then
    pNewSelection[1] = gridLoc
  end if
  me.drawSelection(#newSelection)
end

on moveBox me, whichBox, gridLoc
  if gridLoc = #none then
    therect = rect(-1, -1, 0, 0)
  else
    therect = me.calcSelectionRect([gridLoc, gridLoc])
  end if
  pBoxes[whichBox].setRect(therect)
end

on requestBoxes me
  if pBoxes = #none then
    pBoxes = g.structMaster.getStruct(#GridSelectorBoxes)
    greenBox = g.objectMaster.requestObject(#objBox)
    params = greenBox.getParams(#init)
    params.color = rgb(100, 255, 100)
    params.layer = gGridSelectorLayer
    params.member = pGreenBoxMember
    greenBox.init(params)
    yellowBox = g.objectMaster.requestObject(#objBox)
    params = yellowBox.getParams(#init)
    params.color = rgb(255, 255, 0)
    params.layer = gGridSelectorLayer
    params.member = pYellowBoxMember
    yellowBox.init(params)
    pBoxes[#green] = greenBox
    pBoxes[#yellow] = yellowBox
  end if
end

on selectStart me, gridLoc
  pNewSelection = [gridLoc, gridLoc]
  if pSelectOnPress then
    me.makeNewSelectionCurrent()
  else
    me.moveBox(#yellow, gridLoc)
  end if
end

on selectEnd me, gridLoc
  if pAllowRangeSelections = 0 then
    pNewSelection[1] = gridLoc
  end if
  pNewSelection[2] = gridLoc
  me.makeNewSelectionCurrent()
end

on sendSelectionToRequester me
  if pAllowRangeSelections then
    theSel = pselection
  else
    theSel = pselection[1]
  end if
  pRequester.selectionMade(theSel, pTarget)
end

on setAllowRangeSelections me, theVal
  pAllowRangeSelections = theVal
end

on setBoxSize me, theSize
  pBoxSize = theSize
end

on setSelectOnPress me, theVal
  pSelectOnPress = theVal
end

on setTarget me, theObj
  pTarget = theObj
  pTargetRect = theObj.getGridRect()
  pTargetGridSize = theObj.getGridSize()
  me.requestBoxes()
  me.calcStart()
  initialGridSelection = pTarget.getInitialGridSelection()
  me.moveBox(#green, initialGridSelection)
end

on update me
  mousePos = the mouseLoc
  mousePress = the mouseDown
  mouseRelease = the mouseUp
  if inside(mousePos, pTargetRect) then
    gridLoc = me.calcGridLoc(mousePos)
    if mouseRelease then
      me.mouseRelease(gridLoc)
    else
      if mousePress then
        me.mousePress(gridLoc)
      end if
    end if
  else
    pBoxes[#yellow].offscreen()
  end if
end

on updateLocation me
  pTargetRect = pTarget.getGridRect()
end
