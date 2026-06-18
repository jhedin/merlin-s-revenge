property ancestor, pCopyPixelsParams, pDefaultScale, pGap, pGapColour, pTileSet
global g

on new me
  ancestor = new(script("objDataMap"))
  i = me.modifyParams(#init)
  i[#copyPixelsParams] = [#useFastQuads: 1, #ink: 36]
  i[#defaultScale] = 1
  i[#gap] = 0
  i[#gapColour] = rgb(0, 0, 0)
  i[#tileSet] = #none
  return me
end

on init me, params
  me.ancestor.init(params)
  pCopyPixelsParams = params.copyPixelsParams
  pDefaultScale = params.defaultScale
  pGap = params.gap
  pGapColour = params.gapColour
  pTileSet = params.tileSet
end

on getImage me
  return me.getScaleImage(pDefaultScale)
end

on getScaleImage me, theScale
  mapSize = me.getSize()
  theSel = rect(1, 1, mapSize.locH, mapSize.locV)
  myImage = me.getScaleImageSelection(theScale, theSel)
  return myImage
end

on getScaleImageSelection me, theScale, theSel
  theSelSize = point(theSel.width + 1, theSel.height + 1)
  tilesize = pTileSet.getTileSize()
  tileScaleSize = tilesize * theScale
  imageSize = tileScaleSize * theSelSize
  gapSize = point((theSel.width - 1) * pGap, (theSel.height - 1) * pGap)
  imageSize = imageSize + gapSize
  myImage = image(imageSize[1], imageSize[2], 32)
  if pGap > 0 then
    myImage.fill(myImage.rect, pGapColour)
  end if
  me.tileImageSelection(myImage, theScale, theSel)
  return myImage
end

on getTilesInSelection me, theSel
  startX = theSel[1][1]
  startY = theSel[1][2]
  endX = theSel[2][1]
  endY = theSel[2][2]
  theTiles = []
  repeat with y = startY to endY
    nRow = []
    repeat with x = startX to endX
      nTile = me.peekNum(point(x, y))
      nRow.append(nTile)
    end repeat
    theTiles.append(nRow)
  end repeat
  return theTiles
end

on getTileSize me
  return pTileSet.getTileSize()
end

on peekNum me, theloc
  val = me.peek(theloc)
  if ilk(val, #symbol) then
    if val = #errorOutsidMap then
      halt()
    else
      val = pTileSet.getTileNum(val)
    end if
  end if
  return val
end

on showTileSet me, theMode, theloc
  pTileSet.show(theMode, theloc)
end

on setBlendLevel me, theVal
  pCopyPixelsParams[#blendLevel] = theVal
end

on setCopyPixelsParams me, theVal
  pCopyPixelsParams = theVal
end

on tileImage me, myImage, theScale
  mapSize = me.getSize()
  theSel = rect(1, 1, mapSize.locH, mapSize.locV)
  myImage = tileImageSelection(myImage, theScale, theSel)
  return myImage
end

on tileImageSelection me, myImage, theScale, theSel
  tilesize = pTileSet.getTileSize()
  tileScaleSize = tilesize * theScale
  tileSpacing = tileScaleSize + point(pGap, pGap)
  repeat with yNum = 0 to theSel.height
    repeat with xNum = 0 to theSel.width
      xLoc = xNum + theSel.left
      yLoc = yNum + theSel.top
      nImageNum = me.peekNum(point(xLoc, yLoc))
      nImage = pTileSet.getTileNo(nImageNum)
      if ilk(nImage, #image) then
        iwidth = nImage.width
        iheight = nImage.height
        iRect = nImage.rect * theScale
        xStart = xNum * tileSpacing[1]
        yStart = yNum * tileSpacing[2]
        xFin = xStart + tileScaleSize[1]
        yFin = yStart + tileScaleSize[2]
        myImage.copyPixels(nImage, rect(xStart, yStart, xFin, yFin), nImage.rect, pCopyPixelsParams)
      end if
    end repeat
  end repeat
  return myImage
end
