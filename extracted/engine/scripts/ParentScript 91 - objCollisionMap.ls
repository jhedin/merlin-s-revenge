property ancestor, pBorderThickness, pBorderOffset, pCollisionTiles, pMagicRect, pObjTileMap, pTileSize, pTileLocs, pRoom, pRoomLocation
global g, gFrameNum

on new me
  ancestor = new(script("objDataMap"))
  i = me.modifyParams(#init)
  i[#borderThickness] = 2
  i[#objTileMap] = #none
  i[#room] = #none
  i.blankEntry = #solid
  return me
end

on init me, params
  pBorderThickness = params.borderThickness
  pCollisionTiles = []
  pObjTileMap = params.objTileMap
  pRoom = params.room
  pRoomLocation = pRoom.getLocation()
  pTileSize = pRoom.getTileSize()
  params.mapSize = pObjTileMap.getSize() + (pBorderThickness * 2)
  params.errorLocOutsideMapSymbol = #none
  ancestor.init(params)
  me.initTileSize()
  me.initMap()
  me.initMagicRect()
end

on initMap me
  keyMap = pObjTileMap.convertToKey()
  startLoc = point(pBorderThickness, pBorderThickness) + 1
  me.pokeMap(startLoc, keyMap)
  me.initTiles()
  me.activateTiles()
end

on initTileSize me
  if pTileSize[1] = pTileSize[2] then
    pTileSize = pTileSize[1]
  else
    nothing()
  end if
end

on initMagicRect me
  magicPoint = pTileSize - pRoomLocation
  pMagicRect = rect(magicPoint[1], magicPoint[2], magicPoint[1], magicPoint[2])
end

on initTiles me
  pCollisionTiles = []
  mapCount = me.getCount()
  tileLoc = point(0, 0)
  repeat with t = 1 to mapCount
    nTileType = me.peekEntryNo(t, tileLoc)
    objCollisionTile = g.objectMaster.requestObject(#objCollisionTile)
    params = objCollisionTile.getParams(#init)
    params.collisionMap = me
    params.locInMap = tileLoc.duplicate()
    params.tileType = nTileType
    objCollisionTile.init(params)
    me.poke(tileLoc, objCollisionTile)
    pCollisionTiles.append(objCollisionTile)
  end repeat
end

on finish me
  me.finishCollisionTiles()
  ancestor.finish()
end

on finishCollisionTiles me
  if pCollisionTiles = [] then
    return 
  end if
  numtiles = me.getCount()
  pokePoint = point(0, 0)
  repeat with t = 1 to numtiles
    nTile = me.peekEntryNo(t)
    nTile.finish()
    me.pokeEntryNo(t, #none, pokePoint)
  end repeat
  pCollisionTiles = []
end

on activateTiles me
  me.setTilesNeighbours()
  me.mergeTilesEdges()
  me.identifyCornerTiles()
end

on calcExitTileEdgeAxis me, theEdge
  case theEdge of
    #left, #right:
      return 2
    #top, #bottom:
      return 1
  end case
end

on calcExitTileEdgeStartLoc me, theEdge
  borderAdj = pBorderThickness - 1
  case theEdge of
    #left, #top:
      return point(1 + borderAdj, 1 + borderAdj)
    #right:
      return point(me.getSize()[1] - borderAdj, 1 + borderAdj)
    #bottom:
      return point(1 + borderAdj, me.getSize()[2] - borderAdj)
  end case
end

on checkCollisions me, callingPrg, newLoc, Dir
  if Dir = point(0, 0) then
    return newLoc
  end if
  collisionRect = callingPrg.calcCollisionRect(newLoc)
  tiles = me.selectTilesFromCollisionRect(collisionRect, Dir)
  collisionPlatform = 0
  repeat with Tile in tiles
    if Tile = #none then
      next repeat
    end if
    nType = Tile.getTileType()
    if nType = #none then
      next repeat
    else
      overlap = Tile.calcOverlap(collisionRect.rect, Dir)
    end if
    if (overlap[1] <> #none) or (overlap[2] <> #none) then
      if overlap[3] = 1 then
        axisToChange = #both
      else
        if overlap[1] = #none then
          axisToChange = 2
        else
          if overlap[2] = #none then
            axisToChange = 1
          else
            overlapPositive = PointPositive(overlap.duplicate())
            axisToChange = 1
            if overlapPositive[1] > overlapPositive[2] then
              axisToChange = 2
            end if
          end if
        end if
      end if
      if axisToChange = #both then
        newLoc[1] = newLoc[1] + (overlap[1] * -1)
        newLoc[2] = newLoc[2] + (overlap[2] * -1)
      else
        newLoc[axisToChange] = newLoc[axisToChange] + (overlap[axisToChange] * -1)
      end if
      collisionRect = callingPrg.calcCollisionRect(newLoc)
      if axisToChange = 2 then
        if overlap[2] < 0 then
          callingPrg.collisionCeiling()
        else
          if Dir[2] = 1 then
            callingPrg.collisionPlatform()
            collisionPlatform = 1
          end if
        end if
        next repeat
      end if
      if overlap[1] < 0 then
        callingPrg.collisionWallLeft()
        next repeat
      end if
      if Dir[1] = 1 then
        callingPrg.collisionWallRight()
      end if
    end if
  end repeat
  if (Dir[2] = 1) and (collisionPlatform = 0) then
    callingPrg.collisionNoPlatform()
  end if
  return newLoc
end

on clearDisplayEdges me
  call(#clearDisplayCollisionEdges, pCollisionTiles)
end

on closeExits me
  me.initMap()
end

on displayEdges me
  me.clearDisplayEdges()
  call(#displayCollisionEdges, pCollisionTiles)
end

on getBorderThickness me
  return pBorderThickness
end

on getFirstTileLoc me
  spriteOffset = me.getLocation()
  tilesize = me.getTileSize()
  firstTile = spriteOffset - (tilesize * me.getBorderThickness())
  return firstTile
end

on getLocation me
  return pRoom.getLocation()
end

on getTileSize me
  return pRoom.getTileSize()
end

on identifyCornerTiles me
  call(#identifyAsCornerTile, pCollisionTiles)
end

on insertExitTiles me, exitTiles
  repeat with i = 1 to exitTiles.count
    nEdge = exitTiles.getPropAt(i)
    me.insertExitTileEdge(nEdge, exitTiles[i])
  end repeat
end

on insertExitTileEdge me, edge, tileTypes
  startLoc = me.calcExitTileEdgeStartLoc(edge)
  axis = me.calcExitTileEdgeAxis(edge)
  basePoint = point(0, 0)
  peekPoint = point(0, 0)
  repeat with i = 1 to tileTypes.count
    nType = tileTypes[i]
    basePoint[axis] = i
    peekPoint = startLoc + basePoint
    nTile = me.peek(peekPoint)
    nTile.setTileType(nType)
  end repeat
end

on mergeTilesEdges me
  call(#mergeEdges, pCollisionTiles)
end

on reInitTilesEdges me
  call(#initCollisionEdges, pCollisionTiles)
end

on setTilesNeighbours me
  numtiles = me.getCount()
  peekPoint = point(0, 0)
  bottomDir = point(0, 1)
  rightDir = point(1, 0)
  repeat with t = 1 to numtiles
    nTile = me.peekEntryNo(t, peekPoint)
    bottomTile = me.peek(peekPoint + bottomDir)
    rightTile = me.peek(peekPoint + rightDir)
    nTile.setTile(#bottom, bottomTile)
    nTile.setTile(#right, rightTile)
    if bottomTile <> #none then
      bottomTile.setTile(#top, nTile)
    end if
    if rightTile <> #none then
      rightTile.setTile(#left, nTile)
    end if
  end repeat
end

on selectTilesFromCollisionRect me, collisionRect, Dir
  tiles = []
  tileScreenRect = collisionRect.rect + pMagicRect
  tileRect = tileScreenRect / pTileSize
  tileRect = tileRect + pBorderThickness
  tileLocs = []
  point1 = point(tileRect.left, tileRect.top)
  tileLocs.append(point1)
  point2 = point(tileRect.right, tileRect.top)
  if point1 <> point2 then
    tileLocs.append(point2)
  end if
  point1 = point(tileRect.right, tileRect.bottom)
  if tileLocs.getPos(point1) = 0 then
    tileLocs.append(point1)
  end if
  point1 = point(tileRect.left, tileRect.bottom)
  if tileLocs.getPos(point1) = 0 then
    tileLocs.append(point1)
  end if
  pTileLocs = tileLocs
  repeat with tLoc in tileLocs
    nTile = me.peek(tLoc)
    tiles.append(nTile)
  end repeat
  return tiles
end

on undisplayTilesEdges me
  call(#undisplayCollisionEdges, pCollisionTiles)
end
