property ancestor, pCollisionRectThickness, pExitArrowMembers
global g, gExitArrowThickness

on new me
  ancestor = new(script("modModule"))
  return me
end

on init me, params
  ancestor.init(params)
  pCollisionRectThickness = params.collisionRectThickness
  pExitArrowMembers = params.exitArrowMembers
end

on addModParams me
  i = me.modifyParams(#init)
  i[#collisionRectThickness] = 64
  i[#exitArrowMembers] = g.structMaster.getStruct(#exitArrowMembers)
  ancestor.addModParams()
end

on calcExitArrowRects me, exitTiles
  exitRanges = me.convertExitTilesToRanges(exitTiles, #none)
  arrowRects = me.convertExitRangesToArrowRects(exitRanges)
  return arrowRects
end

on calcExitCollisionAreas me, exitTiles
  collisionRanges = me.convertExitTilesToRanges(exitTiles, #solid)
  collisionRects = me.convertExitRangesToCollisionRects(collisionRanges)
  return collisionRects
end

on convertExitRangesToArrowRects me, exitRanges
  arrowRects = g.structMaster.getStruct(#screenExits)
  repeat with i = 1 to exitRanges.count
    nEdge = exitRanges.getPropAt(i)
    arrowRects[i] = me.convertExitRangesToArrowRectsEdge(exitRanges[i], nEdge)
  end repeat
  return arrowRects
end

on convertExitRangesToArrowRectsEdge me, exitRanges, theEdge
  arrowRects = []
  arrowThickness = gExitArrowThickness
  imageSize = me.pRoom.getImageSize()
  imageWidth = imageSize[1]
  imageHeight = imageSize[2]
  repeat with nRange in exitRanges
    case theEdge of
      #left:
        nRect = rect(0, nRange[1], arrowThickness, nRange[2])
      #top:
        nRect = rect(nRange[1], 0, nRange[2], arrowThickness)
      #right:
        nRect = rect(imageWidth - arrowThickness, nRange[1], imageWidth, nRange[2])
      #bottom:
        nRect = rect(nRange[1], imageHeight - arrowThickness, nRange[2], imageHeight)
    end case
    arrowRects.append(nRect)
  end repeat
  return arrowRects
end

on convertExitRangesToCollisionRects me, exitRanges
  collisionRects = g.structMaster.getStruct(#screenExits)
  repeat with i = 1 to exitRanges.count
    nEdge = exitRanges.getPropAt(i)
    collisionRects[i] = me.convertExitRangesToCollisionRectsEdge(exitRanges[i], nEdge)
  end repeat
  return collisionRects
end

on convertExitRangesToCollisionRectsEdge me, exitRanges, theEdge
  collisionRects = []
  rectThickness = pCollisionRectThickness
  roomSprLoc = me.pRoom.getLocation()
  imageSize = me.pRoom.getImageSize()
  imageWidth = imageSize[1]
  imageHeight = imageSize[2]
  repeat with nRange in exitRanges
    case theEdge of
      #left:
        nRect = rect(-rectThickness, nRange[1], 0, nRange[2])
      #top:
        nRect = rect(nRange[1], -rectThickness, nRange[2], 0)
      #right:
        nRect = rect(imageWidth, nRange[1], imageWidth + rectThickness, nRange[2])
      #bottom:
        nRect = rect(nRange[1], imageHeight, nRange[2], imageHeight + rectThickness)
    end case
    nRect = nRect + rect(roomSprLoc, roomSprLoc)
    collisionRects.append(nRect)
  end repeat
  return collisionRects
end

on convertExitTilesToRanges me, exitTiles, match
  exitRanges = g.structMaster.getStruct(#screenExits)
  repeat with i = 1 to exitTiles.count
    nEdge = exitTiles.getPropAt(i)
    exitRanges[i] = me.convertExitTilesToRangesEdge(exitTiles[i], nEdge, match)
  end repeat
  return exitRanges
end

on convertExitTilesToRangesEdge me, exitTiles, theEdge, match
  tilesize = me.pTileSet.getTileSize()
  case theEdge of
    #top, #bottom:
      tileLength = tilesize[1]
    #left, #right:
      tileLength = tilesize[2]
  end case
  tileNo = 1
  exitOpen = 0
  exitRanges = []
  currentStart = 0
  repeat with nTile in exitTiles
    nSymbol = nTile
    if nSymbol = match then
      if exitOpen = 0 then
        currentStart = (tileNo - 1) * tileLength
        exitOpen = 1
      end if
    end if
    if (nSymbol <> match) or (tileNo = exitTiles.count) then
      minusTile = 1
      if (tileNo = exitTiles.count) and (nSymbol = match) then
        minusTile = 0
      end if
      if exitOpen = 1 then
        currentEnd = (tileNo - minusTile) * tileLength
        nRange = [currentStart, currentEnd]
        exitRanges.append(nRange)
        exitOpen = 0
      end if
    end if
    tileNo = tileNo + 1
  end repeat
  return exitRanges
end

on drawExitArrowsOnImage me, theImage, exitArrowRects, surroundingHostiles
  repeat with i = 1 to exitArrowRects.count
    nEdge = exitArrowRects.getPropAt(i)
    exitArrowRectsEdge = exitArrowRects[i]
    repeat with nRect in exitArrowRectsEdge
      hostile = surroundingHostiles[nEdge]
      case hostile of
        0, []:
          arrowCol = #grn
        1:
          arrowCol = #rdd
      end case
      nMember = pExitArrowMembers[arrowCol][nEdge]
      nImage = nMember.image
      ImageDrawRepeated(nImage, theImage, nRect)
    end repeat
  end repeat
end

on getEdgeTiles me, theEdge
  case theEdge of
    #left:
      tiles = me.peekCol(1)
    #top:
      tiles = me.peekRow(1)
    #right:
      tiles = me.peekCol(me.getSize()[1])
    #bottom:
      tiles = me.peekRow(me.getSize()[2])
  end case
  return tiles
end

on getScreenExitsForEdge me, theEdge
  edgeTiles = me.getEdgeTiles(theEdge)
  edgeSymbols = []
  repeat with nTile in edgeTiles
    nSymbol = me.pTileSet.getTileSymbolByNum(nTile)
    edgeSymbols.append(nSymbol)
  end repeat
  return edgeSymbols
end

on setExitCollisionZones me, combinedTiles
  offscreenCollisionRects = me.calcExitCollisionAreas(combinedTiles)
  zoneRects = []
  repeat with edge in offscreenCollisionRects
    repeat with nRect in edge
      zoneRects.append(nRect)
    end repeat
  end repeat
  me.id.bigMe.addZones(zoneRects, #solid)
end
