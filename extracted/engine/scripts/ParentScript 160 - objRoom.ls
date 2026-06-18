property ancestor, pBeenActivated, pCurrentEditLayer, pDefaultScale, pFrontLayerBlendLevel, pHostileStatus, pLocation, pRoomCleared, pRoomClearedSound, pRoomObjects, pRoomObjectsToRestore, pState, pTileLayers, pTileSets, pMap, pmode, pnum
global g, gExitArrows, gNavMode

on new me
  ancestor = new(script("objSpriteMember"))
  i = me.modifyParams(#init)
  i[#defaultEditLayer] = #backgroundPassive
  i[#defaultScale] = 1
  i[#frontLayerBlendLevel] = 128
  i[#tileSets] = g.structMaster.getStruct(#roomTileSets)
  i[#layerDefinitions] = #none
  i[#layers] = #none
  i[#map] = #none
  i[#maploc] = #none
  i[#num] = 0
  me.addModule("modCollisionDetection")
  me.addModule("modRoomGraves")
  me.addModule("modSoundFX")
  return me
end

on init me, params
  ancestor.init(params)
  pBeenActivated = 0
  pCollisionRectBoxes = []
  pCurrentEditLayer = #none
  pDefaultScale = params.defaultScale
  pFrontLayerBlendLevel = params.frontLayerBlendLevel
  pLocation = #none
  pnum = params.num
  pMap = params.map
  pmode = #none
  pRoomCleared = 0
  pRoomClearedSound = "end_screen"
  pRoomObjects = []
  pRoomObjectsToRestore = []
  pTileSets = params.tileSets
  pState = []
  me.initTileLayers(params)
  me.setCurrentEditLayer(params.defaultEditLayer)
end

on initTileLayers me, params
  pTileLayers = g.structMaster.getStruct(#roomTileSets)
  layerDefs = params.layers
  if ilk(layerDefs, #propList) then
    layerDefs = [layerDefs]
  end if
  repeat with i = 1 to pTileSets.count
    nLayerSym = pTileSets.getPropAt(i)
    layerDef = me.findDefForLayer(nLayerSym, layerDefs)
    me.initTileLayer(layerDef)
  end repeat
end

on initTileLayer me, layerDef
  layerSym = layerDef.name
  layerObj = g.objectMaster.requestObject(#objTileLayer)
  params = layerObj.getParams(#init)
  params.room = me
  params.roomTileSets = pTileSets.duplicate()
  params.type = layerSym
  params.map = layerDef.map
  if params.map = #none then
    params.mapSize = layerDef.mapSize
  end if
  layerObj.init(params)
  pTileLayers[layerSym] = layerObj
end

on finish me
  call(#finish, pTileLayers)
  ancestor.finish()
end

on activate me
  ancestor.activate()
  g.teamMaster.setRoomClear(0)
  me.addPlayerToRoomObjects()
  if pBeenActivated = 0 then
    me.activateActors()
  else
    if pRoomObjectsToRestore.count > 0 then
      me.restoreRoomObjects()
    else
      me.restoreState()
    end if
    me.reDrawGraves()
  end if
  me.attemptOpenExits()
  pBeenActivated = 1
end

on activateActors me
  if pTileLayers[#objects] <> #none then
    pTileLayers[#objects].activateActors()
  end if
end

on activateZones me
  if pTileLayers[#backgroundActive] <> #none then
    pTileLayers[#backgroundActive].activateZones()
  end if
end

on addPlayerToRoomObjects me
  player = g.actorMaster.getPlayer()
  if player <> #none then
    chargingSpell = player.getChargingSpell()
    me.addRoomObject(player)
    if chargingSpell <> #none then
      me.addRoomObject(chargingSpell)
    end if
  end if
end

on addRoomObject me, theObj
  pRoomObjects.add(theObj)
end

on addSaveData me, sd
  sd[#pBeenActivated] = pBeenActivated
  sd[#pRoomCleared] = pRoomCleared
  sd[#pnum] = pnum
  sd[#pState] = VarDuplicateIfList(pState)
  roomObjects = []
  repeat with roomObject in pRoomObjects
    saveData = [:]
    roomObject.addSaveData(saveData)
    roomObjects.append(saveData)
  end repeat
  sd[#pRoomObjects] = roomObjects
  ancestor.addSaveData(sd)
end

on attemptOpenExits me
  exitsOpen = 0
  if g.teamMaster.isPlayerEnemiesDead() then
    g.teamMaster.setRoomClear(1)
    exitsOpen = 1
    me.openExits()
    if pRoomCleared = 0 then
      pRoomCleared = 1
      if pMap.isMapClear() = 0 then
        me.PlaySound(pRoomClearedSound)
      end if
    end if
    if gNavMode = 1 then
      g.gamemaster.goNavMode()
    end if
    if gExitArrows then
      me.drawExitArrows()
    end if
    pMap.checkMapCleared()
  end if
  return exitsOpen
end

on deactivate me
  me.freezeObjects()
  ancestor.deactivate()
end

on drawExitArrows me
  surroundingHostiles = pMap.getSurroundingHostiles()
  surroundingExitTiles = pMap.getSurroundingExitTiles()
  myExitTiles = me.getExitTiles()
  combinedTiles = g.structMaster.getStruct(#screenExits)
  repeat with i = 1 to combinedTiles.count
    combinedTiles[i] = ListCombineExitTiles(surroundingExitTiles[i], myExitTiles[i])
  end repeat
  exitArrowRects = me.pTileLayers[#backgroundActive].calcExitArrowRects(combinedTiles)
  myImage = me.getMember().image
  me.pTileLayers[#backgroundActive].drawExitArrowsOnImage(myImage, exitArrowRects, surroundingHostiles)
end

on findDefForLayer me, theSym, layerDefs
  repeat with nLayerDef in layerDefs
    nSym = nLayerDef.name
    if nSym = theSym then
      return nLayerDef
    end if
  end repeat
  return me.getBlankLayerDef(theSym)
end

on finishZones me
  if pTileLayers[#backgroundActive] <> #none then
    pTileLayers[#backgroundActive].finishZones()
  end if
end

on freezeObjects me
  roomObjects = me.getRoomObjects()
  me.saveState(roomObjects)
  g.objectMaster.finishObjects(roomObjects)
end

on getBlankLayerDef me, theSym
  layerDef = g.structMaster.getStruct(#blankRoomLayer)
  layerDef.name = theSym
  layerDef.mapSize = pMap.getRoomSize()
  return layerDef
end

on getBlendLevelForLayer me, theLayer
  case pmode of
    #activate:
      return 100
    #edit:
      editLayerPos = me.getLayerPos(pCurrentEditLayer)
      layerPos = me.getLayerPos(theLayer)
      if editLayerPos < layerPos then
        return pFrontLayerBlendLevel
      end if
  end case
end

on getExitTiles me
  myTiles = g.structMaster.getStruct(#screenExits)
  repeat with i = 1 to myTiles.count
    edge = myTiles.getPropAt(i)
    myTiles[i] = me.getExitTilesForEdge(edge)
  end repeat
  return myTiles
end

on getExitTilesForEdge me, theEdge
  return pTileLayers[#backgroundActive].getScreenExitsForEdge(theEdge)
end

on getMap me
  return pMap
end

on getMiniMapLoc me
  spriteRect = me.getSpriteRect()
  return point(spriteRect.right, spriteRect.bottom)
end

on getGridSize me
  return pTileSets[1].getTileSize()
end

on getGridRect me
  return me.getSpriteRect()
end

on getHostile me
  if pTileLayers[#objects] = #none then
    return 0
  else
    if pBeenActivated = 1 then
      return me.getHostileInState()
    else
      return pTileLayers[#objects].getHostile()
    end if
  end if
end

on getHostileInState me
  if me.getMiniMapStatusFromRoomState(#exitArrows) = #inf then
    return 1
  end if
end

on getImage me
  return me.getScaleImage(pDefaultScale)
end

on getImageSize me
  tilesize = pTileLayers[1].getTileSize()
  roomSize = pTileLayers[1].getSize()
  imageSize = point(tilesize[1] * roomSize[1] * pDefaultScale, tilesize[2] * roomSize[2] * pDefaultScale)
  return imageSize
end

on getImageFromLayer me, theLayer, theScale
  theImage = #none
  if pTileLayers[theLayer] <> #none then
    theImage = pTileLayers[theLayer].getScaleImage(theScale)
  end if
  return theImage
end

on getInitialGridSelection me
  return #none
end

on getLayerPos me, theLayer
  layerSym = theLayer.getType()
  i = 1
  repeat with i = 1 to pTileLayers.count
    nSym = pTileLayers.getPropAt(i)
    if nSym = layerSym then
      return i
    end if
    i = i + 1
  end repeat
  return #none
end

on getLoc me
  return me.getLocation()
end

on getLocation me
  return pLocation.duplicate()
end

on getMiniMapStatus me
  miniMapStatus = #none
  if pBeenActivated = 1 then
    miniMapStatus = me.getMiniMapStatusFromRoomState(#miniMap)
  else
    if pTileLayers[#objects] <> VOID then
      miniMapStatus = pTileLayers.objects.getMiniMapStatus(#miniMap)
    else
      miniMapStatus = #clr
    end if
  end if
  if miniMapStatus = #clr then
    pRoomCleared = 1
  end if
  return miniMapStatus
end

on getMiniMapStatusFromRoomState me, forWhat
  case forWhat of
    #miniMap:
      statusStruct = #miniMapStatusProgression
    #exitArrows:
      statusStruct = #exitArrowsStatusProgression
  end case
  statusProgression = g.structMaster.getStruct(statusStruct)
  miniMapStatus = statusProgression[1]
  repeat with objState in pState
    nActorType = objState.actorType
    nStatus = g.actorMaster.getMiniMapStatusForSymbol(nActorType)
    if statusProgression.getPos(nStatus) > statusProgression.getPos(miniMapStatus) then
      miniMapStatus = nStatus
    end if
  end repeat
  return miniMapStatus
end

on getRoomObjects me
  roomObjects = me.removeChargingSpell()
  roomObjects = pRoomObjects
  roomObjects = g.objectMaster.removeObjectsWithFlagFromList(roomObjects, #objPlayerCharacter)
  roomObjects = g.objectMaster.removeObjectsWithFlagFromList(roomObjects, #objHair)
  return roomObjects
end

on getRoomDwellings me
  roomDwellings = g.objectMaster.getActiveObjectsWithFlag(#objDwelling)
  return roomDwellings
end

on getRoomEnemies me
  roomEnemies = g.objectMaster.getActiveObjectsWithFlag(#objEnemyCharacter)
  return roomEnemies
end

on getScaleImage me, theScale
  backgroundImage = me.getImageFromLayer(#backgroundPassive, theScale)
  backgroundSolid = me.getImageFromLayer(#backgroundActive, theScale)
  if pmode <> #activate then
    objects = me.getImageFromLayer(#objects, theScale)
  end if
  copyPixelsParams = [#useFastQuads: 1, #ink: 36]
  editLayer = pCurrentEditLayer.getType()
  if editLayer = #backgroundPassive then
    copyPixelsParams[#blendLevel] = pFrontLayerBlendLevel
  end if
  if backgroundSolid <> #none then
    backgroundImage.copyPixels(backgroundSolid, backgroundImage.rect, backgroundSolid.rect, copyPixelsParams)
  end if
  if pmode <> #activate then
    if editLayer = #backgroundActive then
      copyPixelsParams[#blendLevel] = pFrontLayerBlendLevel
    end if
    if objects <> #none then
      backgroundImage.copyPixels(objects, backgroundImage.rect, objects.rect, copyPixelsParams)
    end if
  end if
  return backgroundImage
end

on getScreenExitsForEdge me, theEdge
  screenExits = pTileLayers[#backgroundActive].getScreenExitsForEdge(theEdge)
  return screenExits
end

on getTilesInSelection me, theSel
  return pCurrentEditLayer.getTilesInSelection(theSel)
end

on getTileSize me
  return pTileLayers[1].getTileSize()
end

on isCleared me
  return pRoomCleared
end

on killAllDwellings me
  dwellings = me.getRoomDwellings()
  call(#die, dwellings)
end

on killAllEnemies me
  enemies = me.getRoomEnemies()
  call(#die, enemies)
end

on offscreen me
  me.freeSprite()
  me.freeMember()
  if pmode = #activate then
    me.deactivate()
  end if
end

on onscreen me, theloc
  pLocation = theloc
  currentEditLayer = pMap.getCurrentEditLayer()
  me.setCurrentEditLayer(currentEditLayer)
  me.requestMember()
  me.requestSprite()
  me.refreshImage()
  me.setMember()
  me.setSpriteLoc(theloc)
end

on refreshImage me
  myImage = me.getImage()
  me.setImage(myImage)
  me.setRegpoint(#topLeft)
end

on removeChargingSpell me
  player = g.actorMaster.getPlayer()
  chargingSpell = player.getChargingSpell()
  if chargingSpell <> #none then
    me.removeRoomObject(chargingSpell)
  end if
end

on removeRoomObject me, theObj
  pos = pRoomObjects.getPos(theObj)
  if pos > 0 then
    pRoomObjects.deleteAt(pos)
  end if
end

on restoreFromSave me, sd
  if pnum <> sd.pnum then
    put "objRoom.restoreFromSave() Warning: roomNum doesn't match with save data!"
  end if
  ancestor.restoreFromSave(sd)
  pBeenActivated = sd.pBeenActivated
  pRoomCleared = sd.pRoomCleared
  pRoomObjectsToRestore = sd.pRoomObjects
  pState = sd.pState
end

on restoreRoomObjects me
  newActors = []
  repeat with roomObjectData in pRoomObjectsToRestore
    actorType = roomObjectData.pActorType
    startLoc = roomObjectData.pMoveXY.pLoc
    params = g.actorMaster.getParams(#newActor)
    params.typ = actorType
    params.startLoc = startLoc
    params.useOffset = 0
    params.forceCreate = 1
    params.startActor = 1
    newActor = g.actorMaster.newActor(params)
    newActor.restoreFromSave(roomObjectData)
    newActors.append(newActor)
  end repeat
  call(#frameAdvance, newActors)
  call(#internalEvent, newActors, #clearDefaultBuildings)
  call(#restoreRelationships, newActors)
  call(#internalEvent, newActors, #restoredFromSave)
  pRoomObjectsToRestore = []
end

on restoreState me
  if pState = #none then
    return 
  end if
  newActors = []
  repeat with act in pState
    params = g.actorMaster.getParams(#newActor)
    params.typ = act.actorType
    params.startLoc = act.loc
    params.useOffset = 0
    params.forceCreate = 1
    newAct = g.actorMaster.newActor(params)
    newAct.restoreFromSave(act.saveData)
    if act.actorType = #hair then
      newAct.goMode(#cutOff)
    end if
    newActors.append(newAct)
  end repeat
  call(#frameAdvance, newActors)
  call(#internalEvent, newActors, #clearDefaultBuildings)
  repeat with newActor in newActors
    newActor.restoreRelationships()
  end repeat
  call(#internalEvent, newActors, #restoredFromSave)
end

on saveLayers me
  layerProperties = []
  repeat with layer in pTileLayers
    if layer <> #none then
      layerProperties.append(layer.saveLayer())
    end if
  end repeat
  return layerProperties
end

on saveRoom me
  myProperties = [:]
  p = myProperties
  p[#num] = pnum
  p[#layers] = me.saveLayers()
  return myProperties
end

on saveState me, roomObjects
  roomState = []
  repeat with obj in roomObjects
    objProps = [#loc: #none, #actorType: #none, #saveData: #none]
    recordInRoomState = obj.getRecordInRoomState()
    if recordInRoomState = 1 then
      objProps.loc = obj.getLoc()
      objProps.actorType = obj.getActorType()
      saveData = [:]
      obj.addSaveData(saveData)
      objProps.saveData = saveData
      roomState.append(objProps.duplicate())
    end if
  end repeat
  pState = roomState
end

on setTile me, tileLoc, newTileNo
  pCurrentEditLayer.poke(tileLoc, newTileNo)
end

on setTilesBrush me, theSel, theBrush
  brushWidth = theBrush[1].count
  brushHeight = theBrush.count
  startPoint = theSel
  repeat with y = 1 to brushHeight
    repeat with x = 1 to brushWidth
      nTile = theBrush[y][x]
      nTilePos = startPoint + point(x, y) - point(1, 1)
      me.setTile(nTilePos, nTile)
    end repeat
  end repeat
end

on setCurrentEditLayer me, layerSymbol
  pCurrentEditLayer = pTileLayers[layerSymbol]
end

on show me, theMode, theloc
  pmode = theMode
  me.onscreen(theloc)
  case pmode of
    #activate:
      me.activate()
  end case
end

on showTileSet me, theMode
  mywidth = me.getSpriteWidth()
  theloc = pLocation + point(mywidth, 0) + point(32, 0)
  pCurrentEditLayer.showTileSet(theMode, theloc)
end
