property ancestor, pBox, pCornerTile, pCollisionMap, pCollisionEdges, pDisplayLines, pEndOfTile, pLocInMap, pTileType, pSolidCorners, pSolidEdges, pStartOfTile, pSurroundingTiles
global g, gGameView

on new me
  ancestor = new(script("objParams"))
  i = me.modifyParams(#init)
  i[#collisionMap] = #none
  i[#locInMap] = point(1, 1)
  i[#tileType] = #none
  return me
end

on init me, params
  pBox = #none
  pCollisionMap = params.collisionMap
  pDisplayLines = []
  pLocInMap = params.locInMap
  pTileType = params.tileType
  pSolidCorners = []
  pSurroundingTiles = g.structMaster.getStruct(#surroundingTiles)
  me.initCollisionEdges()
  ancestor.init(params)
end

on initCollisionEdge me, nEdge
  nCollisionEdge = g.structMaster.getStruct(#collisionEdge)
  solid = 0
  if pTileType = #solid then
    solid = 1
  end if
  case nEdge of
    #left:
      location = pStartOfTile[1]
      axis = 1
      if pTileType = #wallLeft then
        solid = 1
      end if
    #top:
      location = pStartOfTile[2]
      axis = 2
      if pTileType = #platform then
        solid = 1
      end if
    #right:
      location = pEndOfTile[1]
      axis = 1
      if pTileType = #wallRight then
        solid = 1
      end if
    #bottom:
      location = pEndOfTile[2]
      axis = 2
      if pTileType = #ceiling then
        solid = 1
      end if
  end case
  nCollisionEdge.axis = axis
  nCollisionEdge.location = location
  nCollisionEdge.solid = solid
  pCollisionEdges[nEdge] = nCollisionEdge
end

on initCollisionEdges me
  pCollisionEdges = g.structMaster.getStruct(#screenExits)
  firstTile = pCollisionMap.getFirstTileLoc()
  tilesize = pCollisionMap.getTileSize()
  pEndOfTile = firstTile + (tilesize * pLocInMap)
  pStartOfTile = pEndOfTile - tilesize
  pStartOfTile = pStartOfTile - point(1, 1)
  repeat with i = 1 to pCollisionEdges.count
    nEdge = pCollisionEdges.getPropAt(i)
    me.initCollisionEdge(nEdge)
  end repeat
end

on initSolidEdgesList me
  pSolidEdges = []
  repeat with i = 1 to 4
    nCollisionEdge = pCollisionEdges[i]
    if nCollisionEdge.solid then
      nEdge = pCollisionEdges.getPropAt(i)
      pSolidEdges.append(nEdge)
    end if
  end repeat
end

on finish me
  me.finishDisplayLines()
  me.finishBox()
  ancestor.finish()
end

on finishBox me
  if pBox <> #none then
    pBox.finish()
    pBox = #none
  end if
end

on finishDisplayLines me
  call(#finish, pDisplayLines)
  pDisplayLines = []
end

on calcEdgeOrientation me, theEdge
  case theEdge of
    #top, #bottom:
      orientation = #horizontal
    #left, #right:
      orientation = #vertical
  end case
  return orientation
end

on calcOppositeEdge me, edge
  case edge of
    #left:
      return #right
    #top:
      return #bottom
    #right:
      return #left
    #bottom:
      return #top
  end case
end

on calcOverlap me, collisionRect, Dir, printOverlap
  overlap = me.calcOverlapEdges(collisionRect, Dir)
  if (pCornerTile = 1) and ((overlap[1] = #none) and (overlap[2] = #none)) then
    overlap = me.calcOverlapCorners(collisionRect, Dir, overlap)
  end if
  return overlap
end

on calcOverlapCorners me, collisionRect, Dir, overlap
  repeat with nCorner in pSolidCorners
    case nCorner of
      #topLeft:
        if Dir = point(1, 1) then
          overlap[2] = me.calcOverlapEdge(#top, collisionRect.bottom)
          overlap[1] = me.calcOverlapEdge(#left, collisionRect.right)
          overlap[3] = 1
        end if
      #topRight:
        if Dir = point(-1, 1) then
          overlap[2] = me.calcOverlapEdge(#top, collisionRect.bottom)
          overlap[1] = me.calcOverlapEdge(#right, collisionRect.left)
          overlap[3] = 1
        end if
      #bottomRight:
        if Dir = point(-1, -1) then
          overlap[2] = me.calcOverlapEdge(#bottom, collisionRect.top)
          overlap[1] = me.calcOverlapEdge(#right, collisionRect.left)
          overlap[3] = 1
        end if
      #bottomLeft:
        if Dir = point(1, -1) then
          overlap[2] = me.calcOverlapEdge(#bottom, collisionRect.top)
          overlap[1] = me.calcOverlapEdge(#left, collisionRect.right)
          overlap[3] = 1
        end if
    end case
  end repeat
  return overlap
end

on calcOverlapEdges me, collisionRect, Dir
  overlap = [#none, #none, 0]
  repeat with solidEdge in pSolidEdges
    if solidEdge = #left then
      if Dir[1] = 1 then
        overlap[1] = me.calcOverlapEdge(#left, collisionRect.right)
      end if
      next repeat
    end if
    if solidEdge = #top then
      if Dir[2] = 1 then
        overlap[2] = me.calcOverlapEdge(#top, collisionRect.bottom)
      end if
      next repeat
    end if
    if solidEdge = #right then
      if Dir[1] = -1 then
        overlap[1] = me.calcOverlapEdge(#right, collisionRect.left)
      end if
      next repeat
    end if
    if solidEdge = #bottom then
      if Dir[2] = -1 then
        overlap[2] = me.calcOverlapEdge(#bottom, collisionRect.top)
      end if
    end if
  end repeat
  return overlap
end

on calcOverlapEdge me, myEdge, collisionRectEdge
  collisionEdge = pCollisionEdges[myEdge]
  return collisionRectEdge - collisionEdge.location
end

on calcOverlapPlatform me, collisionRect, Dir, callingPrg
  overlap = [#none, #none, 0]
  if (Dir[2] < 1) or callingPrg.getAIPlatformDrop() then
    return overlap
  end if
  oldloc = callingPrg.getLoc()
  oldCollisionRect = callingPrg.calcCollisionRect(oldloc).rect
  oldOverlap = me.calcOverlapEdge(#top, oldCollisionRect.bottom)
  if oldOverlap <= 0 then
    overlap[2] = me.calcOverlapEdge(#top, collisionRect.bottom)
  end if
  return overlap
end

on calcSolidCorner me, vert, side, surroundingEdges
  if (surroundingEdges[vert] <> #none) and (surroundingEdges[side] <> #none) then
    if (surroundingEdges[vert][side].solid = 1) and (surroundingEdges[side][vert].solid = 1) then
      pCornerTile = 1
      return 1
    end if
  end if
  return 0
end

on clearDisplayCollisionEdges me
  me.finishDisplayLines()
end

on display me
  pBox = g.objectMaster.requestObject(#objBox)
  params = pBox.getParams(#init)
  params.initialRect = me.getRect()
  params.color = rgb(255, 0, 255)
  pBox.init(params)
end

on displayCollisionEdges me
  numEdges = pCollisionEdges.count
  repeat with i = 1 to numEdges
    nEdge = pCollisionEdges[i]
    if nEdge.solid = 1 then
      orientation = me.calcEdgeOrientation(pCollisionEdges.getPropAt(i))
      nLine = g.objectMaster.requestObject(#objLine)
      params = nLine.getParams(#init)
      if orientation = #horizontal then
        params.locy = nEdge.location
        params.locLength[1] = pCollisionEdges.left.location
        params.locLength[2] = pCollisionEdges.right.location
      else
        params.locx = nEdge.location
        params.locLength[1] = pCollisionEdges.top.location
        params.locLength[2] = pCollisionEdges.bottom.location
      end if
      nLine.init(params)
      pDisplayLines.append(nLine)
    end if
  end repeat
  call(#display, pDisplayLines)
end

on getCollisionEdge me, theEdge
  return pCollisionEdges[theEdge]
end

on getCollisionEdges me
  return pCollisionEdges
end

on getRect me
  myRect = rect(0, 0, 0, 0)
  collEdge = pCollisionEdges[1]
  myRect[1] = collEdge.location
  collEdge = pCollisionEdges[2]
  myRect[2] = collEdge.location
  collEdge = pCollisionEdges[3]
  myRect[3] = collEdge.location
  collEdge = pCollisionEdges[4]
  myRect[4] = collEdge.location
  return myRect
end

on getTileType me
  return pTileType
end

on identifyAsCornerTile me
  pCornerTile = 0
  if me.getTileType() <> #solid then
    return 
  end if
  neighboursToCheck = []
  myEdges = pCollisionEdges
  repeat with i = 1 to 4
    nCollisionEdge = myEdges[i]
    if nCollisionEdge.solid = 0 then
      nEdge = myEdges.getPropAt(i)
      neighboursToCheck.append(nEdge)
    end if
  end repeat
  if neighboursToCheck.count = 0 then
    return 
  end if
  surroundingEdges = g.structMaster.getStruct(#surroundingTiles)
  repeat with i = 1 to neighboursToCheck.count
    nEdge = neighboursToCheck[i]
    nTile = pSurroundingTiles[nEdge]
    if nTile <> #none then
      nEdges = nTile.getCollisionEdges()
      surroundingEdges[nEdge] = nEdges
    end if
  end repeat
  corners = g.structMaster.getStruct(#corners)
  pCornerTile = 0
  corners.topLeft = me.calcSolidCorner(#top, #left, surroundingEdges)
  corners.topRight = me.calcSolidCorner(#top, #right, surroundingEdges)
  corners.bottomRight = me.calcSolidCorner(#bottom, #right, surroundingEdges)
  corners.bottomLeft = me.calcSolidCorner(#bottom, #left, surroundingEdges)
  pSolidCorners = []
  repeat with i = 1 to 4
    nCorner = corners[i]
    if nCorner = 1 then
      nCornerSym = corners.getPropAt(i)
      pSolidCorners.append(nCornerSym)
    end if
  end repeat
end

on mergeEdges me
  edges = [#right, #bottom]
  repeat with edge in edges
    oppositeEdge = me.calcOppositeEdge(edge)
    compareTile = pSurroundingTiles[edge]
    if compareTile = #none then
      next repeat
    end if
    if (edge = #bottom) and (compareTile.getTileType() = #platform) then
      next repeat
    end if
    myEdge = me.getCollisionEdge(edge)
    compareEdge = compareTile.getCollisionEdge(oppositeEdge)
    if (myEdge.solid = 1) and (compareEdge.solid = 1) then
      myEdge.solid = 0
      compareEdge.solid = 0
    end if
  end repeat
  me.initSolidEdgesList()
end

on setTile me, edge, Tile
  pSurroundingTiles[edge] = Tile
end

on setTileType me, newType
  if pTileType = newType then
    return 
  end if
  pTileType = newType
  me.initCollisionEdges()
  edges = [#left, #top, #right, #bottom]
  oppedges = [#right, #bottom, #left, #top]
  repeat with i = 1 to edges.count
    nEdge = edges[i]
    nOppEdge = oppedges[i]
    pSurroundingTiles[nEdge].initCollisionEdge(nOppEdge)
  end repeat
  pSurroundingTiles.top.mergeEdges()
  pSurroundingTiles.left.mergeEdges()
  me.mergeEdges()
  pSurroundingTiles.top.identifyAsCornerTile()
  pSurroundingTiles.left.identifyAsCornerTile()
  pSurroundingTiles.bottom.identifyAsCornerTile()
  pSurroundingTiles.right.identifyAsCornerTile()
  me.identifyAsCornerTile()
end

on undisplay me
  me.finishBox()
end

on undisplayCollisionEdges me
  call(#finish, pDisplayLines)
end
