property ancestor, pCurrentRoom, pCurrentTileSet, pCurrentTool, pGridSelectors, pMap, pTools
global g

on new me
  ancestor = new(script("objPalette"))
  i = me.modifyParams(#init)
  i.location = point(200, 4)
  i.member = member("tlk_tools")
  return me
end

on init me, params
  ancestor.init(params)
  pCurrentRoom = #none
  pCurrentTileSet = #none
  pGridSelectors = g.structMaster.getStruct(#toolPaletteGridSelectors)
  pMap = params.targetObject
  pTools = [:]
  me.initMap()
  me.initTools()
end

on initMap me
  me.refreshRoomAndTileSetObjects()
  roomRect = pCurrentRoom.getSpriteRect()
  roomMapLoc = point(roomRect[3] + 16, roomRect[2])
  pMap.setRoomMapLoc(roomMapLoc)
  pMap.displayRoomMap()
  me.refreshTileSetDisplay()
  me.newGridSelector(#map, pMap)
  me.newGridSelector(#room, pCurrentRoom)
  me.newGridSelector(#tileSet, pCurrentTileSet)
end

on initParams me, params, toolSym
  case toolSym of
    #brush:
    #grabber:
  end case
  return params
end

on initTools me
  pTools = [:]
  theKey = me.pDefinition.theKey
  repeat with i = 1 to theKey.count
    nToolSym = theKey.getPropAt(i)
    nObjSym = StringToSymbol("obj" & string(nToolSym) & "Tool")
    nObj = g.objectMaster.requestObject(nObjSym)
    params = nObj.getParams(#init)
    params.toolPalette = me.id.bigMe
    params = me.initParams(params, nToolSym)
    nObj.init(params)
    pTools[nToolSym] = nObj
  end repeat
  me.setCurrentTool(theKey.getPropAt(1))
end

on finish me
  g.objectMaster.finishObjects(pTools)
  g.objectMaster.finishObjects(pGridSelectors)
  ancestor.finish()
end

on activateGridSelectors me
  call(#activate, pGridSelectors)
end

on deactivateGridSelectors me
  call(#deactivate, pGridSelectors)
end

on getCurrentMap me
  return pMap
end

on getCurrentRoom me
  return pCurrentRoom
end

on getCurrentTileSet me
  return pCurrentTileSet
end

on getGridSelectors me
  return pGridSelectors
end

on getTool me, which
  return pTools[which]
end

on newGridSelector me, objSym, targetObj
  nSel = g.objectMaster.requestObject(#objGridSelector)
  params = nSel.getParams()
  params.requester = me.id.bigMe
  params.targetObject = targetObj
  case objSym of
    #room:
      params.selectOnPress = 1
    #tileSet:
      params.allowRangeSelections = 1
  end case
  nSel.init(params)
  pGridSelectors[objSym] = nSel
end

on refreshGridSelectorTargets me
  pGridSelectors[#room].setTarget(pCurrentRoom)
  pGridSelectors[#tileSet].setTarget(pCurrentTileSet)
end

on refreshRoomAndTileSet me
  me.refreshRoomAndTileSetObjects()
  me.refreshTileSetDisplay()
  me.refreshGridSelectorTargets()
end

on refreshRoomAndTileSetObjects me
  pCurrentRoom = #none
  if pCurrentTileSet <> #none then
    pCurrentTileSet.offscreen()
  end if
  pCurrentRoom = pMap.getCurrentRoom()
  pCurrentTileSet = pMap.getCurrentTileSet()
end

on refreshTileSetDisplay me
  roomMapRect = pMap.getSpriteRect()
  tileSetLoc = point(roomMapRect[1], roomMapRect[4] + 16)
  pCurrentTileSet.displayImage(tileSetLoc)
end

on selectionMade me, theSel, theObj
  case theObj of
    me:
      toolSym = me.getTileSymbol(theSel)
      me.setCurrentTool(toolSym)
    pCurrentTileSet:
      pCurrentTool.tileSetSelected(theSel)
    pCurrentRoom:
      pCurrentTool.roomSelected(theSel)
    pMap:
      pMap.moveToRoom(theSel)
  end case
end

on setCurrentTool me, toolSym
  pCurrentTool = pTools[toolSym]
  pCurrentTool.adjustGridSelectors(pGridSelectors)
end

on setLocation me, newLoc
  pLocation = newLoc.duplicate()
  me.setSpriteLoc(pLocation)
end
