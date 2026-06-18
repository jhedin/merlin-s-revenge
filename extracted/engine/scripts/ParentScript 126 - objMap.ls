property ancestor, pCommandPalette, pCopyPixelsParams, pCurrentEditLayer, pCurrentRoomLoc, pCurrentRoom, pDefinition, pDefinitionRoot, pEndRoom, pGridSelector, player, pLayerDefinitions, pLocation, pMenuController, pMyController, pmode, pName, pRoomMapImage, pRoomMapLoc, pRoomMapScale, pRooms, pRoomSize, pRoomScaleSize, pStartRoom, pTileSets, pToolPalette, pMiniMap
global g, gMapLayer, gMapBoundary

on new me
  ancestor = new(script("objDataMap"))
  i = me.modifyParams(#init)
  i[#location] = point(0, 0)
  i[#currentEditLayer] = #backgroundActive
  i[#copyPixelsParams] = [#useFastQuads: 1, #ink: 0]
  i[#definitionTxt] = #none
  i[#layer] = gMapLayer
  i[#myController] = #none
  i[#name] = #newmap
  i[#roomMapScale] = 1 / 8.0
  i[#tileSets] = #none
  me.addModule("modBoundary")
  me.addModule("modMiniMap")
  return me
end

on init me, params
  pCommandPalette = #none
  pCopyPixelsParams = params.copyPixelsParams
  pCurrentEditLayer = #backgroundPassive
  pCurrentRoomLoc = #none
  pCurrentRoom = #none
  pDefinitionRoot = g.XMLMaster.interpretXML(params.definitionTxt)
  pDefinition = pDefinitionRoot.map
  pEndRoom = #none
  player = params.layer
  pLayerDefinitions = pDefinition.layerDefinitions
  pLocation = params.location
  pName = params.name
  pMenuController = #none
  pMyController = params.myController
  pmode = #none
  pGridSelector = #none
  pRoomMapLoc = #none
  pRoomMapScale = params.roomMapScale
  pRoomSize = pDefinition.roomSize
  pStartRoom = pDefinition.startRoom
  pTileSets = #none
  pToolPalette = #none
  if pDefinition[#endRoom] <> VOID then
    pEndRoom = pDefinition.endRoom
  end if
  if ilk(pLayerDefinitions, #propList) then
    pLayerDefinitions = [pLayerDefinitions]
  end if
  if pDefinition[#roomMapScale] <> VOID then
    pRoomMapScale = pDefinition.roomMapScale
  end if
  if pDefinition[#roomEditScale] <> VOID then
    put "implement roomEditScale"
  end if
  params.mapSize = pDefinition.mapSize
  params.map = #incremental
  me.ancestor.init(params)
  me.initTileSetsFromDefinition()
  if pTileSets[params.currentEditLayer] <> VOID then
    pCurrentEditLayer = params.currentEditLayer
  end if
  me.initRooms()
  if pMiniMap <> VOID then
    pMiniMap.initMiniMapData()
  end if
end

on initRooms me
  pRooms = []
  roomDefs = pDefinition.rooms
  if ilk(roomDefs, #propList) then
    me.initRoom(roomDefs)
  else
    timeS = the milliSeconds
    g.screenMaster.screenOn(#initMap)
    updateStage()
    total = roomDefs.count
    if total = 0 then
      alert("New Map detected - this map currently doesn't have any rooms." & RETURN & "Please run map_editor.exe and save map (disc icon) to create rooms." & RETURN)
      halt()
    end if
    room = 1
    energybar = g.objectMaster.requestObject(#objEnergyBar)
    surroundSpr = g.spriteMaster.getSpriteWithMember(member("room_bar_surround", "gfx"))
    surroundRect = surroundSpr.rect.duplicate()
    params = energybar.getParams(#init)
    params.surroundSpr = surroundSpr
    params.surroundRect = surroundRect
    params.maxEnergy = total
    params.currentEnergy = total
    energybar.init(params)
    repeat with roomDef in roomDefs
      energybar.updateEnergy(room)
      energybar.update()
      me.initRoom(roomDef)
      room = room + 1
      updateStage()
    end repeat
    energybar.finish()
    g.screenMaster.screenOff(#initMap)
    timeTotal = the milliSeconds - timeS
    put "time to init rooms = " & timeTotal
  end if
  numRoomsRequired = me.getNumEntries()
  if pRooms.count < numRoomsRequired then
    shortfall = numRoomsRequired - pRooms.count
    me.initBlankRooms(shortfall)
  end if
end

on initBlankRooms me, theNum
  blankDef = g.structMaster.getStruct(#blankRoom)
  layerDefs = me.getBlankRoomLayerDefinitions()
  blankDef.layers = layerDefs
  repeat with i = 1 to theNum
    blankDef.num = i
    me.initRoom(blankDef)
  end repeat
end

on initRoom me, roomDef
  nRoom = g.objectMaster.requestObject(#objRoom)
  params = nRoom.getParams(#init)
  params.num = roomDef.num
  params.layerDefinitions = pLayerDefinitions
  params.layers = roomDef.layers
  params.map = me
  params.tileSets = pTileSets.duplicate()
  nRoom.init(params)
  pRooms.append(nRoom)
end

on initTileSetsFromDefinition me
  pTileSets = [:]
  repeat with nLayerDef in pLayerDefinitions
    nName = nLayerDef.name
    nTileSetName = nLayerDef.tileSet
    pTileSets[nName] = g.collectionsMaster.getObj(#objTileSetKey, nTileSetName)
  end repeat
end

on finish me
  g.objectMaster.finishObjects(pRooms)
  g.objectMaster.finishObjects(pTileSets)
  me.finishRequestedObjects()
  pMyController.objectFinished(me.id.bigMe)
  ancestor.finish()
end

on finishRequestedObjects me
  if pCommandPalette <> #none then
    pCommandPalette.finish()
  end if
  if pMenuController <> #none then
    pMenuController.finish()
  end if
  if pToolPalette <> #none then
    pToolPalette.finish()
  end if
end

on addSaveData me, sd
  sd[#pCurrentRoomLoc] = pCurrentRoomLoc
  sd[#pName] = pName
  sd[#pRooms] = []
  repeat with room in pRooms
    saveData = [:]
    room.addSaveData(saveData)
    sd.pRooms.append(saveData)
  end repeat
  me.ancestor.addSaveData(sd)
end

on checkMapCleared me
  if me.isMapClear() then
    g.gamemaster.gameEvent(#mapClear)
  end if
end

on chooseLayer me
  listOfLayers = me.getListOfLayers()
  me.displayDialogue("Choose a Layer", listOfLayers)
end

on clearCurrentRoom me
  currentRoom = me.getCurrentRoom()
  currentRoom.offscreen()
  pCurrentRoom = #none
  pCurrentRoomLoc = #none
end

on commandIssued me, commandSymbol
  call(commandSymbol, me)
end

on deactivate me
  me.finish()
end

on display me
  pmode = #display
  me.onscreen()
end

on displayDialogue me, theTitle, theContents
  me.requestMenuController()
  pToolPalette.deactivateGridSelectors()
  pMenuController.newDialogue(theTitle, theContents, pLocation)
end

on displayRoomMap me
  me.requestSprite()
  me.requestMember()
  currentRoomLoc = pCurrentRoomLoc.duplicate()
  me.gotoRoom(pStartRoom)
  mapSize = me.getSize()
  roomSize = pCurrentRoom.getImageSize()
  fullSize = mapSize * roomSize
  scaleSize = fullSize * pRoomMapScale
  pRoomMapImage = image(scaleSize[1], scaleSize[2], 32)
  repeat with ry = 1 to mapSize[2]
    repeat with rx = 1 to mapSize[1]
      me.gotoRoom(point(rx, ry))
      me.refreshRoomMapImage(pCurrentRoom)
    end repeat
  end repeat
  me.gotoRoom(currentRoomLoc)
  me.setMember()
  me.setSpriteLayer(player)
  me.setSpriteLoc(pRoomMapLoc)
end

on getActiveTileTypeAtLoc me, theloc
  return pCurrentRoom.getActiveTileTypeAtLoc(theloc)
end

on getBlankRoomLayerDefinitions me
  blankRoomLayerDefs = []
  repeat with nLayerDef in pLayerDefinitions
    nBlankRoomLayer = g.structMaster.getStruct(#blankRoomLayer)
    nBlankRoomLayer.name = nLayerDef.name
    nBlankRoomLayer.mapSize = pRoomSize
    blankRoomLayerDefs.append(nBlankRoomLayer)
  end repeat
  return blankRoomLayerDefs
end

on getCurrentEditLayer me
  return pCurrentEditLayer
end

on getCurrentRoom me
  return pCurrentRoom
end

on getCurrentRoomLoc me
  return pCurrentRoomLoc.duplicate()
end

on getCurrentTileSet me
  return pTileSets[pCurrentEditLayer]
end

on getGridRect me
  return me.getSpriteRect()
end

on getGridSize me
  return pRoomScaleSize
end

on getInitialGridSelection me
  return pCurrentRoomLoc
end

on getListOfLayers me
  layers = []
  repeat with i = 1 to pTileSets.count
    nLayerName = pTileSets.getPropAt(i)
    layers.append(nLayerName)
  end repeat
  return layers
end

on getLocOfCentreOfTileAtLoc me, theScreenLoc
  mapOffset = pLocation
  locOnMap = theScreenLoc - mapOffset
  tilesize = pTileSets[1].getTileSize()
  topLeftCornerOfTile = point(0, 0)
  topLeftCornerOfTile.locH = locOnMap.locH - (locOnMap.locH mod tilesize.locH)
  topLeftCornerOfTile.locV = locOnMap.locV - (locOnMap.locV mod tilesize.locV)
  centreOfTile = topLeftCornerOfTile + (tilesize / 2)
  centreOfTileScreen = centreOfTile + mapOffset
  return centreOfTileScreen
end

on getMapEdgesForCurrentRoom me
  mapEdges = rect(0, 0, 0, 0)
  roomLoc = pCurrentRoomLoc.duplicate()
  mapSize = me.getSize()
  if roomLoc[1] = 1 then
    mapEdges[1] = 1
  end if
  if roomLoc[2] = 1 then
    mapEdges[2] = 1
  end if
  if roomLoc[1] = mapSize[1] then
    mapEdges[3] = 1
  end if
  if roomLoc[2] = mapSize[2] then
    mapEdges[4] = 1
  end if
  return mapEdges
end

on getRoomInDirection me, Dir
  roomLoc = pCurrentRoomLoc.duplicate()
  roomToGetLoc = roomLoc + Dir
  room = me.peek(roomToGetLoc)
  if room = #errorOutsideMap then
    return #none
  else
    return pRooms[room]
  end if
end

on getRoom me, roomNum
  return pRooms[roomNum]
end

on getRoomAt me, theloc
  return me.id.bigMe.peek(theloc)
end

on getRoomSize me
  return pRoomSize.duplicate()
end

on getRoomSizeInPixels me
  tilesize = pTileSets[pCurrentEditLayer].getTileSize()
  return pRoomSize * tilesize
end

on getSpriteRect me
  return pCurrentRoom.getSpriteRect()
end

on getSurroundingExitTiles me
  return me.getSurroundingInfo(#getExitTilesForEdge)
end

on getSurroundingHostiles me
  return me.getSurroundingInfo(#getHostile)
end

on getSurroundingInfo me, function
  screenExits = g.structMaster.getStruct(#screenExits)
  directions = g.structMaster.getStruct(#dirFour)
  dirNames = [#left, #top, #right, #bottom]
  edgeNames = [#right, #bottom, #left, #top]
  repeat with i = 1 to 4
    Dir = directions[i]
    nRoom = me.getRoomInDirection(Dir)
    if nRoom <> #none then
      nEdgeName = edgeNames[i]
      nDirName = dirNames[i]
      screenExitTiles = call(function, nRoom, nEdgeName)
      screenExits[nDirName] = screenExitTiles
    end if
  end repeat
  return screenExits
end

on goActivateMode me
  pmode = #activate
end

on goEditMode me
  pmode = #edit
end

on gotoRoom me, theloc
  roomNum = me.peek(theloc)
  if roomNum <> #errorOutsideMap then
    pCurrentRoomLoc = theloc.duplicate()
    pCurrentRoom = pRooms[roomNum]
  end if
end

on isEndRoom me
  isEndRoom = 0
  if pCurrentRoomLoc = pEndRoom then
    isEndRoom = 1
  end if
  return isEndRoom
end

on isMapClear me
  clear = 1
  repeat with room in pRooms
    roomClear = room.isCleared()
    if roomClear = 0 then
      clear = 0
      exit repeat
    end if
  end repeat
  return clear
end

on menuClosed me, theMenu
  pToolPalette.activateGridSelectors()
end

on menuSelection me, theComm, theMenu
  if theMenu = #Choose_a_Layer then
    me.setCurrentEditLayer(theComm)
  end if
  pToolPalette.activateGridSelectors()
end

on moveRoom me, thedir
  nextLoc = pCurrentRoomLoc + thedir
  me.moveToRoom(nextLoc)
end

on moveToRoom me, theloc
  if pCurrentRoom <> #none then
    pCurrentRoom.offscreen()
    pCurrentRoom = #none
    pCurrentRoomLoc = #none
  end if
  me.gotoRoom(theloc)
  if pCurrentRoom <> #none then
    me.showRoom()
  end if
  if pmode = #edit then
    pToolPalette.refreshRoomAndTileSet()
  end if
end

on onscreen me
  me.gotoRoom(pStartRoom)
  me.showRoom()
  case pmode of
    #edit:
      me.requestCommandPalette()
      me.requestToolPalette()
  end case
  if gMapBoundary > 0 then
    me.displayBoundary()
  end if
  g.gamemaster.newMapStarted()
end

on refreshRoomMapImage me
  roomSize = pCurrentRoom.getImageSize()
  pRoomScaleSize = roomSize * pRoomMapScale
  nRoomImage = pCurrentRoom.getScaleImage(pRoomMapScale)
  rectOffset = (pCurrentRoomLoc - 1) * pRoomScaleSize
  destRect = nRoomImage.rect + rect(rectOffset, rectOffset)
  pRoomMapImage.copyPixels(nRoomImage, destRect, nRoomImage.rect)
  me.setImage(pRoomMapImage)
  me.setRegpoint(#topLeft)
end

on registerMinimap me, themap
  pMiniMap = themap
end

on requestGridSelector me
  if pGridSelector = #none then
    pGridSelector = g.objectMaster.requestObject(#objGridSelector)
    params = pGridSelector.getParams(#init)
    params.targetObject = me.id.bigMe
    pGridSelector.init(params)
  end if
end

on requestMenuController me
  if pMenuController = #none then
    pMenuController = g.objectMaster.requestObject(#objMenuController)
    params = pMenuController.getParams(#init)
    params.requester = me
    pMenuController.init(params)
  end if
end

on requestToolPalette me
  if pToolPalette = #none then
    pToolPalette = g.objectMaster.requestObject(#objToolPalette)
    params = pToolPalette.getParams(#init)
    params.targetObject = me.id.bigMe
    pToolPalette.init(params)
    pToolPalette.display()
  end if
end

on requestCommandPalette me
  if pCommandPalette = #none then
    pCommandPalette = g.objectMaster.requestObject(#objCommandPalette)
    params = pCommandPalette.getParams(#init)
    params.targetObject = me.id.bigMe
    pCommandPalette.init(params)
    pCommandPalette.display()
  end if
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
  me.clearCurrentRoom()
  g.actorMaster.finishActors()
  roomsData = sd.pRooms
  roomNum = 1
  repeat with room in pRooms
    roomData = roomsData[roomNum]
    room.restoreFromSave(roomData)
    roomNum = roomNum + 1
  end repeat
  me.moveToRoom(sd.pCurrentRoomLoc)
  pMiniMap.initMiniMapData()
end

on saveMap me
  mapDefinition = g.structMaster.getStruct(#mapDefinition)
  mapDef = mapDefinition.map
  mapDef.mapSize = me.getSize()
  mapDef.roomSize = pRoomSize
  mapDef.startRoom = pStartRoom
  mapDef.roomMapScale = pRoomMapScale
  mapDef.layerDefinitions = pLayerDefinitions
  mapDef.rooms = me.saveRooms()
  mapDefinitionXML = g.XMLMaster.interpretPropList(mapDefinition)
  myMemName = pName
  myMember = member(myMemName, "gfx")
  if myMember = member(-1, 1) then
    myMember = new(#field, castLib("gfx"))
  end if
  myMember.text = mapDefinitionXML
  me.displayDialogue("Map Saved", [])
end

on saveRooms me
  rooms = []
  repeat with room in pRooms
    roomProperties = room.saveRoom()
    rooms.append(roomProperties)
  end repeat
  return rooms
end

on setCurrentEditLayer me, theLayer
  pCurrentEditLayer = theLayer
  me.moveToRoom(pCurrentRoomLoc)
end

on setRoomMapLoc me, theloc
  pRoomMapLoc = theloc.duplicate()
end

on showRoom me
  pCurrentRoom.show(pmode, pLocation)
end

on validRoomLoc me, theloc
  mapSize = me.getSize()
  if VarInRange(theloc[1], 1, mapSize[1]) and VarInRange(theloc[2], 1, mapSize[2]) then
    return 1
  else
    return 0
  end if
end
