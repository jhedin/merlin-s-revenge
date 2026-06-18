property ancestor, pCachedImage, pCurrentEditLayer, pDefaultScale, pFrontLayerBlendLevel, pLocation, pTileLayers, pTileSets, pMap, pmode, pnum
global g

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
  i[#num] = 0
  return me
end

on init me, params
  ancestor.init(params)
  pCachedImage = #none
  pCurrentEditLayer = #none
  pDefaultScale = params.defaultScale
  pFrontLayerBlendLevel = params.frontLayerBlendLevel
  pLocation = #none
  pnum = params.num
  pMap = params.map
  pmode = #none
  pTileSets = params.tileSets
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

on calcSelectAll me
  mapSize = me.pMap.getRoomSize()
  theSel = rect(1, 1, mapSize.locH, mapSize.locV)
  return theSel
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

on getGridSize me
  return pTileSets[1].getTileSize()
end

on getGridRect me
  return me.getSpriteRect()
end

on getImage me
  return me.getScaleImage(pDefaultScale)
end

on getImageSize me
  testImage = me.getImage()
  imageSize = point(testImage.width, testImage.height)
  return imageSize
end

on getImageFromLayerSelection me, theLayer, theScale, theSelection
  theImage = #none
  if pTileLayers[theLayer] <> #none then
    theImage = pTileLayers[theLayer].getScaleImageSelection(theScale, theSelection)
  end if
  return theImage
end

on getImageFromLayerSelectionTileSet me, theLayer, theScale, theSelection, tileSet
  theImage = #none
  if pTileLayers[theLayer] <> #none then
    oldSet = pTileLayers[theLayer].pTileSet
    pTileLayers[theLayer].pTileSet = tileSet
    theImage = pTileLayers[theLayer].getScaleImageSelection(theScale, theSelection, tileSet)
    pTileLayers[theLayer].pTileSet = oldSet
  end if
  return theImage
end

on getImageFromLayer me, theLayer, theScale
  theSelection = me.calcSelectAll()
  theImage = me.getImageFromLayerSelection(theLayer, theScale, theSelection)
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

on getRoomSize me
  return pMap.pDefinitionRoot.map.roomSize
end

on getScaleImage me, theScale
  theSel = me.calcSelectAll()
  backgroundImage = me.getScaleImageFromSelection(theScale, theSel)
  if theScale = 1 then
    pCachedImage = backgroundImage
  end if
  return backgroundImage
end

on getScaleImageFromSelection me, theScale, theSelection
  backgroundImage = me.getImageFromLayerSelection(#backgroundPassive, theScale, theSelection)
  backgroundSolid = me.getImageFromLayerSelection(#backgroundActive, theScale, theSelection)
  objects = me.getImageFromLayerSelection(#objects, theScale, theSelection)
  copyPixelsParams = [#useFastQuads: 1, #ink: 36]
  editLayer = pCurrentEditLayer.getType()
  if editLayer = #backgroundPassive then
    copyPixelsParams[#blendLevel] = pFrontLayerBlendLevel
  end if
  if backgroundSolid <> #none then
    backgroundImage.copyPixels(backgroundSolid, backgroundImage.rect, backgroundSolid.rect, copyPixelsParams)
  end if
  if editLayer = #backgroundActive then
    copyPixelsParams[#blendLevel] = pFrontLayerBlendLevel
  end if
  if objects <> #none then
    backgroundImage.copyPixels(objects, backgroundImage.rect, objects.rect, copyPixelsParams)
  end if
  return backgroundImage
end

on getScaleImageFromSelectionTileset me, theScale, theSelection, newTileSet
  backgroundImage = me.getImageFromLayerSelection(#backgroundPassive, theScale, theSelection)
  backgroundSolid = me.getImageFromLayerSelection(#backgroundActive, theScale, theSelection)
  objects = me.getImageFromLayerSelection(#objects, theScale, theSelection)
  case newTileSet.pDefinition[#currentEditLayer] of
    #backgroundPassive:
      backgroundImage = me.getImageFromLayerSelectionTileSet(#backgroundPassive, theScale, theSelection, newTileSet)
    #backgroundActive:
      backgroundSolid = me.getImageFromLayerSelectionTileSet(#backgroundActive, theScale, theSelection, newTileSet)
    #objects:
      objects = me.getImageFromLayerSelectionTileSet(#objects, theScale, theSelection, newTileSet)
  end case
  copyPixelsParams = [#useFastQuads: 1, #ink: 36]
  editLayer = pCurrentEditLayer.getType()
  if editLayer = #backgroundPassive then
    copyPixelsParams[#blendLevel] = pFrontLayerBlendLevel
  end if
  if backgroundSolid <> #none then
    backgroundImage.copyPixels(backgroundSolid, backgroundImage.rect, backgroundSolid.rect, copyPixelsParams)
  end if
  if editLayer = #backgroundActive then
    copyPixelsParams[#blendLevel] = pFrontLayerBlendLevel
  end if
  if objects <> #none then
    backgroundImage.copyPixels(objects, backgroundImage.rect, objects.rect, copyPixelsParams)
  end if
  return backgroundImage
end

on getTilesInSelection me, theSel
  return pCurrentEditLayer.getTilesInSelection(theSel)
end

on offscreen me
  me.freeSprite()
  me.freeMember()
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
      me.activateActors()
  end case
end

on showTileSet me, theMode
  mywidth = me.getSpriteWidth()
  theloc = pLocation + point(mywidth, 0) + point(32, 0)
  pCurrentEditLayer.showTileSet(theMode, theloc)
end

on updateImage me, theSel, brushTiles
  if pCachedImage = #none then
    me.getImage()
  end if
  rectRight = theSel.locH + brushTiles[1].count - 1
  rectBottom = theSel.locV + brushTiles.count - 1
  rectToUpdate = rect(theSel.locH, theSel.locV, rectRight, rectBottom)
  changedSectionImage = me.getScaleImageFromSelection(pDefaultScale, rectToUpdate)
  tilesize = pCurrentEditLayer.getTileSize()
  imageAreaToUpdate = rectToUpdate.duplicate()
  imageAreaToUpdate.top = imageAreaToUpdate.top - 1
  imageAreaToUpdate.left = imageAreaToUpdate.left - 1
  imageAreaToUpdate = imageAreaToUpdate * rect(tilesize.locH, tilesize.locV, tilesize.locH, tilesize.locV)
  copyPixelsParams = [#useFastQuads: 1, #ink: 36]
  pCachedImage.copyPixels(changedSectionImage, imageAreaToUpdate, changedSectionImage.rect, copyPixelsParams)
  me.setImage(pCachedImage)
  me.setRegpoint(#topLeft)
end

on updateImageTileset me, theSel, brushTiles, newTileSet
  if pCachedImage = #none then
    me.getImage()
  end if
  rectRight = theSel.locH + brushTiles[1].count - 1
  rectBottom = theSel.locV + brushTiles.count - 1
  rectToUpdate = rect(theSel.locH, theSel.locV, rectRight, rectBottom)
  changedSectionImage = me.getScaleImageFromSelectionTileset(pDefaultScale, rectToUpdate, newTileSet)
  tilesize = pCurrentEditLayer.getTileSize()
  imageAreaToUpdate = rectToUpdate.duplicate()
  imageAreaToUpdate.top = imageAreaToUpdate.top - 1
  imageAreaToUpdate.left = imageAreaToUpdate.left - 1
  imageAreaToUpdate = imageAreaToUpdate * rect(tilesize.locH, tilesize.locV, tilesize.locH, tilesize.locV)
  copyPixelsParams = [#useFastQuads: 1, #ink: 36]
  pCachedImage.copyPixels(changedSectionImage, imageAreaToUpdate, changedSectionImage.rect, copyPixelsParams)
  me.setImage(pCachedImage)
  me.setRegpoint(#topLeft)
end
