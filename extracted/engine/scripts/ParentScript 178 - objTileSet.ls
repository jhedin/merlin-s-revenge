property ancestor, pAllowRangeSelections, pAllTilesImage, pCopyPixelsParams, pDisplayScale, pDisplayTileMap, pGridSelector, pGreenBoxMember, pTiles, pTileSize, pSizeInTiles, pSprites, pYellowBoxMember
global g, gPaletteLayer

on new me
  ancestor = new(script("objSpriteMember"))
  i = me.modifyParams(#init)
  i[#allowRangeSelections] = 1
  i[#allTilesImage] = #none
  i[#copyPixelsParams] = [#useFastQuads: 1, #ink: 0]
  i[#displayScale] = 1
  i[#greenBoxMember] = #none
  i[#maxNum] = #none
  i[#tilesize] = point(16, 16)
  i[#yellowBoxMember] = #none
  return me
end

on init me, params
  ancestor.init(params)
  pAllowRangeSelections = params.allowRangeSelections
  pAllTilesImage = params.allTilesImage
  pCopyPixelsParams = params.copyPixelsParams
  pDisplayTileMap = #none
  pDisplayScale = params.displayScale
  pGreenBoxMember = params.greenBoxMember
  pGridSelector = #none
  pSizeInTiles = #none
  pSprites = []
  pTileSize = params.tilesize
  pYellowBoxMember = params.yellowBoxMember
  pTiles = me.makeTiles(params.allTilesImage, params.tilesize, params.maxNum)
end

on finish me
  me.freeSprites()
  me.freeGridSelector()
  ancestor.finish()
end

on calcTileNum me, theloc
  return pTiles.calcEntryNum(theloc)
end

on calcTileNums me, theSelection
  startX = theSelection[1][1]
  startY = theSelection[1][2]
  endX = theSelection[2][1]
  endY = theSelection[2][2]
  tileNums = []
  repeat with y = startY to endY
    nRow = []
    repeat with x = startX to endX
      nRow.append(me.calcTileNum(point(x, y)))
    end repeat
    tileNums.append(nRow)
  end repeat
  return tileNums
end

on displayImage me, theloc
  displayTileMap = g.objectMaster.requestObject(#objTileMap)
  params = displayTileMap.getParams(#init)
  params.map = #incremental
  params.mapSize = pSizeInTiles
  params.tileSet = me
  displayTileMap.init(params)
  myImage = displayTileMap.getScaleImage(pDisplayScale)
  me.displayImageAtLoc(myImage, theloc)
  displayTileMap.finish()
end

on displayInSprites me
  startLoc = point(100, 100)
  gap = 2
  me.freeSprites()
  totalTiles = pTiles.getNumEntries()
  repeat with i = 1 to totalTiles
    nLoc = point(0, 0)
    nVal = pTiles.peekEntryNo(i, nLoc)
    nImageMem = g.imageMaster.newImage("tile_" & i)
    nImageMem.image = nVal
    nSpr = g.spriteMaster.requestSprite()
    SpriteSetMember(nSpr, nImageMem)
    nSprLoc = startLoc.duplicate()
    nOffsetLoc = point(nImageMem.width + gap, nImageMem.height + gap) * nLoc
    nSprLoc = nSprLoc + nOffsetLoc
    nSpr.loc = nSprLoc
    nSpr.locZ = gPaletteLayer
    pSprites.append(nSpr)
  end repeat
end

on displayAsSelection me, theloc
  me.displayImage(theloc)
  me.setSpriteLayer(gPaletteLayer)
  pGridSelector = g.objectMaster.requestObject(#objGridSelector)
  params = pGridSelector.getParams()
  params.allowRangeSelections = pAllowRangeSelections
  params.greenBoxMember = pGreenBoxMember
  params.targetObject = me.id.bigMe
  params.yellowBoxMember = pYellowBoxMember
  pGridSelector.init(params)
end

on freeGridSelector me
  if pGridSelector <> #none then
    pGridSelector.finish()
  end if
  pGridSelector = #none
end

on freeSprites me
  repeat with spr in pSprites
    g.spriteMaster.freeSprite(spr)
  end repeat
  pSprites = []
end

on getDisplayScale me
  return pDisplayScale
end

on getGridRect me
  return me.getSpriteRect()
end

on getGridSize me
  return me.getTileSize() * pDisplayScale
end

on getImage me
  return pAllTilesImage
end

on getInitialGridSelection me
  return #none
end

on getTile me, theloc
  return pTiles.peek(theloc)
end

on getTileNo me, i
  theloc = point(0, 0)
  return pTiles.peekEntryNo(i, theloc)
end

on getTileSize me
  return pTileSize
end

on makeTiles me, allTilesImage, tilesize, maxNum
  mapSize = point(0, 0)
  mapSize[1] = allTilesImage.width / tilesize[1]
  mapSize[2] = allTilesImage.height / tilesize[2]
  pSizeInTiles = mapSize
  tileMap = g.objectMaster.requestObject(#objDataMap)
  params = tileMap.getParams(#init)
  params.mapSize = mapSize
  tileMap.init(params)
  repeat with yNum = 0 to mapSize[2] - 1
    repeat with xNum = 0 to mapSize[1] - 1
      xStart = xNum * tilesize[1]
      yStart = yNum * tilesize[2]
      xFin = xStart + tilesize[1]
      yFin = yStart + tilesize[2]
      nImage = image(tilesize[1], tilesize[2], 32)
      nImage.copyPixels(allTilesImage, nImage.rect, rect(xStart, yStart, xFin, yFin), pCopyPixelsParams)
      xLoc = xNum + 1
      yLoc = yNum + 1
      tileMap.poke(point(xLoc, yLoc), nImage)
    end repeat
  end repeat
  return tileMap
end

on show me, theMode, theloc
  case theMode of
    #edit:
      me.displayAsSelection(theloc)
  end case
end

on updateLocation me, theloc
  pGridSelector.updateLocation()
end
