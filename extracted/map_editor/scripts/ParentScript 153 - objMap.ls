property ancestor, pCast, pCommandPalette, pCopyPixelsParams, pCurrentEditLayer, pCurrentRoomLoc, pCurrentRoom, pDefinition, pDefinitionRoot, pEndRoom, pGridSelector, player, pLayerDefinitions, pLocation, pMaster, pMenuController, pmode, pName, pRefreshRoomMapImage, pRoomMapImage, pRoomMapLoc, pRoomMapOn, pRoomMapScale, pRooms, pRoomSize, pRoomScaleSize, pStartRoom, pTileSets, pToolPalette, pOpenMenu
global g, gMapLayer

on new me
  ancestor = new(script("objDataMap"))
  i = me.modifyParams(#init)
  i[#location] = point(0, 0)
  i[#currentEditLayer] = #objects
  i[#copyPixelsParams] = [#useFastQuads: 1, #ink: 0]
  i[#definitionTxt] = #none
  i[#layer] = gMapLayer
  i[#master] = #none
  i[#name] = #newmap
  i[#roomMapScale] = 1 / 8.0
  i[#theCast] = "gfx"
  i[#tileSets] = #none
  return me
end

on init me, params
  pCast = params.theCast
  pCommandPalette = #none
  pCopyPixelsParams = params.copyPixelsParams
  pCurrentEditLayer = #backgroundPassive
  pCurrentRoomLoc = #none
  pCurrentRoom = #none
  pDefinitionRoot = g.XMLMaster.interpretXML(params.definitionTxt)
  pDefinition = pDefinitionRoot.map
  if pDefinition[#endRoom] <> VOID then
    pEndRoom = pDefinition.endRoom
  else
    pEndRoom = #none
  end if
  player = params.layer
  pLayerDefinitions = pDefinition.layerDefinitions
  pLocation = params.location
  pName = params.name
  pMaster = params.master
  pMenuController = #none
  pOpenMenu = #none
  pmode = #none
  pGridSelector = #none
  pRefreshRoomMapImage = 1
  if pDefinition[#refreshRoomMapImage] = #false then
    pRefreshRoomMapImage = 0
  end if
  pRoomMapLoc = #none
  pRoomMapOn = 1
  if pDefinition.mapSize = point(1, 1) then
    pRoomMapOn = 0
  end if
  pRoomMapScale = params.roomMapScale
  pRoomSize = pDefinition.roomSize
  pStartRoom = pDefinition.startRoom
  pTileSets = #none
  pToolPalette = #none
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
end

on initRooms me
  pRooms = []
  roomDefs = pDefinition.rooms
  if ilk(roomDefs, #propList) then
    me.initRoom(roomDefs)
  else
    repeat with roomDef in roomDefs
      me.initRoom(roomDef)
    end repeat
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
  params.tileSets = pTileSets
  nRoom.init(params)
  pRooms.append(nRoom)
end

on initTileSetsFromDefinition me
  pTileSets = [:]
  repeat with nLayerDef in pLayerDefinitions
    nName = nLayerDef.name
    nTileSetName = nLayerDef.tileSet
    pTileSets[nName] = g.collectionsMaster.getObj(#objTileSetKey, nTileSetName)
    if nLayerDef[#displayScale] <> VOID then
      pTileSets[nName].setDisplayScale(nLayerDef.displayScale)
    end if
  end repeat
end

on finish me
  g.objectMaster.finishObjects(pRooms)
  g.objectMaster.finishObjects(pTileSets)
  me.finishRequestedObjects()
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

on chooseLayer me
  listOfLayers = me.getListOfLayers()
  me.displayDialogue("Choose a Layer", listOfLayers)
end

on changeKeySet me
  listOfKeySets = me.getListOfKeySets()
  me.displayDialogue("Choose a KeySet", listOfKeySets)
end

on commandIssued me, commandSymbol
  call(commandSymbol, me)
end

on display me
  pmode = #display
  me.onscreen()
end

on displayDialogue me, theTitle, theContents
  if pOpenMenu <> #none then
    pOpenMenu.buttClicked(#exit)
  end if
  me.requestMenuController()
  pToolPalette.deactivateGridSelectors()
  pOpenMenu = pMenuController.newDialogue(theTitle, theContents, pLocation)
end

on displayRoomMap me
  if pRoomMapOn = 0 then
    return 
  end if
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

on getListOfKeySets me
  currentTileSet = pCurrentEditLayer
  case currentTileSet of
    #backgroundPassive:
      keySet = #structTileSetsPassive
    #backgroundActive:
      keySet = #structTileSetsActive
    #objects:
      keySet = #structTileSetsObjects
  end case
  keySets = g.structMaster.getStruct(keySet)
  return keySets
end

on getRoomSize me
  return pRoomSize.duplicate()
end

on getSpriteRect me
  if pRoomMapOn then
    return me.ancestor.getSpriteRect()
  else
    return rect(pRoomMapLoc.locH, pRoomMapLoc.locV, pRoomMapLoc.locH, pRoomMapLoc.locV)
  end if
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

on menuClosed me, theMenu
  pToolPalette.activateGridSelectors()
end

on menuSelection me, theComm, theMenu
  case theMenu of
    #Choose_a_Layer:
      me.setCurrentEditLayer(theComm)
    #Choose_a_KeySet:
      me.setCurrentEditLayerTileSet(theComm)
  end case
  pToolPalette.activateGridSelectors()
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
end

on refreshRoomMapImage me
  if pRoomMapOn = 0 then
    return 
  end if
  roomSize = pCurrentRoom.getImageSize()
  pRoomScaleSize = roomSize * pRoomMapScale
  nRoomImage = pCurrentRoom.getScaleImage(pRoomMapScale)
  rectOffset = (pCurrentRoomLoc - 1) * pRoomScaleSize
  destRect = nRoomImage.rect + rect(rectOffset, rectOffset)
  pRoomMapImage.copyPixels(nRoomImage, destRect, nRoomImage.rect)
  me.setImage(pRoomMapImage)
  me.setRegpoint(#topLeft)
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

on saveMap me
  mapDefinition = g.structMaster.getStruct(#mapDefinition)
  mapDef = mapDefinition.map
  mapDef.mapSize = me.getSize()
  mapDef.roomSize = pRoomSize
  mapDef.startRoom = pStartRoom
  mapDef.endRoom = pEndRoom
  mapDef.roomMapScale = pRoomMapScale
  mapDef.layerDefinitions = pLayerDefinitions
  if pRefreshRoomMapImage = 0 then
    mapDef.refreshRoomMapImage = #false
  else
    mapDef.refreshRoomMapImage = 1
  end if
  mapDef.rooms = me.saveRooms()
  mapDefinitionXML = g.XMLMaster.interpretPropList(mapDefinition)
  myMemName = pName
  myMember = member(myMemName, pCast)
  if myMember = member(-1, 1) then
    myMember = new(#field, castLib(pCast))
  end if
  myMember.text = mapDefinitionXML
  me.displayDialogue("Map Saved", [])
  if ilk(pMaster, #object) then
    pMaster.mapEvent(#mapSaved)
  end if
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

on setCurrentEditLayerTileSet me, theTileSet
  newTileSet = g.collectionsMaster.getObj(#objTileSetKey, theTileSet)
  newTileSet.pDefinition[#currentEditLayer] = pCurrentEditLayer
  xyPoint = point(1, 1)
  sel = [xyPoint, xyPoint]
  roomBounds = pRoomSize
  oldTileSetDef = pToolPalette.pCurrentTileSet.pDefinition.theKey
  repeat with room in pRooms
    room.setCurrentEditLayer(pCurrentEditLayer)
    repeat with xPos = 1 to roomBounds.locH
      xyPoint.locH = xPos
      repeat with yPos = 1 to roomBounds.locV
        xyPoint.locV = yPos
        theTile = room.getTilesInSelection(sel)
        tileVal = theTile[1][1]
        if tileVal = 0 then
          next repeat
        end if
        tileDef = oldTileSetDef.getOne(tileVal)
        if tileDef = 0 then
          room.setTile(xyPoint, tileVal)
        else
          tileVal = newTileSet.pDefinition.theKey[tileDef]
          if (tileVal = VOID) or (tileVal = #void) then
            tileVal = 0
          end if
          room.setTile(xyPoint, tileVal)
        end if
        room.updateImageTileset(xyPoint, [[tileVal]], newTileSet)
      end repeat
    end repeat
    room.pTileSets[pCurrentEditLayer] = newTileSet
    room.pTileLayers[pCurrentEditLayer].pTileSet = newTileSet
    me.refreshRoomMapImage(room)
  end repeat
  pTileSets[pCurrentEditLayer] = newTileSet
  repeat with layerItem in pLayerDefinitions
    if layerItem.name = pCurrentEditLayer then
      layerItem.tileSet = theTileSet
    end if
  end repeat
  repeat with layerItem in pDefinition.layerDefinitions
    if layerItem.name = pCurrentEditLayer then
      layerItem.tileSet = theTileSet
    end if
  end repeat
  me.saveMap()
  pToolPalette.refreshRoomAndTileSetObjects()
  pToolPalette.refreshRoomAndTileSetObjects()
  me.moveToRoom(pCurrentRoomLoc)
end

on setRoomMapLoc me, theloc
  pRoomMapLoc = theloc.duplicate()
end

on showRoom me
  pCurrentRoom.show(pmode, pLocation)
end
