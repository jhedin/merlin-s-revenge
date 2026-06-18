property ancestor, pRoom, pSym, pType, pZones
global g, gExitArrowThickness

on new me
  ancestor = new(script("objTileMap"))
  i = me.modifyParams(#init)
  i[#room] = #none
  i[#roomTileSets] = #none
  i[#type] = #none
  me.addModule("modScreenExits")
  return me
end

on init me, params
  pRoom = params.room
  pType = params.type
  pZones = #none
  params.tileSet = params.roomTileSets[pType]
  ancestor.init(params)
  if pType = #backgroundPassive then
    me.setCopyPixelsParams([#useFastQuads: 1, #ink: 0])
  end if
end

on initZones me
  numtiles = me.getNumEntries()
  mapLocation = pRoom.getSpriteLoc()
  columnHeight = me.getSize()[2]
  tileLoc = point(1, 1)
  tilesize = me.pTileSet.getTileSize()
  zones = []
  currentZone = #none
  whichTile = #thisOne
  repeat with i = 1 to numtiles
    tileNum = me.peekEntryNoVert(i, tileLoc)
    nSymbol = me.pTileSet.getTileSymbolByNum(tileNum)
    if currentZone = #none then
      startLoc = ((tileLoc - point(1, 1)) * tilesize) + mapLocation
      currentZone = me.openZone(nSymbol, startLoc)
    end if
    if (nSymbol <> currentZone.getSym()) or (nSymbol = #platform) then
      lastTileLoc = tileLoc + point(0, -1)
      endLoc = (lastTileLoc * tilesize) + mapLocation
      me.closeZone(currentZone, endLoc, zones)
      startLoc = ((tileLoc - point(1, 1)) * tilesize) + mapLocation
      currentZone = me.openZone(nSymbol, startLoc)
    end if
    if tileLoc[2] = columnHeight then
      endLoc = (tileLoc * tilesize) + mapLocation
      me.closeZone(currentZone, endLoc, zones)
      currentZone = #none
    end if
  end repeat
  pZones = zones
end

on initZones_old_horiz me
  numtiles = me.getNumEntries()
  mapLocation = pRoom.getSpriteLoc()
  rowWidth = me.getSize()[1]
  tileLoc = point(1, 1)
  tilesize = me.pTileSet.getTileSize()
  zones = []
  currentZone = #none
  whichTile = #thisOne
  repeat with i = 1 to numtiles
    tileNum = me.peekEntryNo(i, tileLoc)
    nSymbol = me.pTileSet.getTileSymbolByNum(tileNum)
    if currentZone = #none then
      startLoc = ((tileLoc - point(1, 1)) * tilesize) + mapLocation
      currentZone = me.openZone(nSymbol, startLoc)
    end if
    if nSymbol <> currentZone.getSym() then
      lastTileLoc = tileLoc + point(-1, 0)
      endLoc = (lastTileLoc * tilesize) + mapLocation
      me.closeZone(currentZone, endLoc, zones)
      startLoc = ((tileLoc - point(1, 1)) * tilesize) + mapLocation
      currentZone = me.openZone(nSymbol, startLoc)
    end if
    if tileLoc[1] = rowWidth then
      endLoc = (tileLoc * tilesize) + mapLocation
      me.closeZone(currentZone, endLoc, zones)
      currentZone = #none
    end if
  end repeat
  pZones = zones
end

on addZones me, newZones, sym
  repeat with nZoneRect in newZones
    currentZone = g.objectMaster.requestObject(#objZone)
    params = currentZone.getParams(#init)
    params.sym = sym
    params.rect = nZoneRect
    currentZone.init(params)
    pZones.append(currentZone)
  end repeat
  me.mergeZones()
  g.collisionMaster.setZones(pZones)
end

on finish me
  if pZones <> #none then
    call(#finish, pZones)
  end if
  ancestor.finish()
end

on activateActors me
  numtiles = me.getNumEntries()
  mapLocation = pRoom.getSpriteLoc()
  tileLoc = point(0, 0)
  tilesize = me.pTileSet.getTileSize()
  repeat with i = 1 to numtiles
    tileNum = me.peekEntryNo(i, tileLoc)
    nSymbol = me.pTileSet.getTileSymbolByNum(tileNum)
    if nSymbol <> #none then
      if (nSymbol = #player) and (g.actorMaster.getPlayer() <> #none) then
        next repeat
      end if
      objectLoc = (tileLoc * tilesize) + mapLocation
      params = g.actorMaster.getParams(#newActor)
      params.typ = nSymbol
      params.startLoc = objectLoc
      nObj = g.actorMaster.newActor(params)
    end if
  end repeat
end

on activateZones me
  me.initZones()
  me.shiftZones()
  me.mergeZones()
  g.collisionMaster.setZones(me.getZones())
end

on closeZone me, currentZone, endLoc, zones
  if currentZone.getSym() = #none then
    return 
  end if
  currentZone.setEndLoc(endLoc)
  zones.append(currentZone)
end

on displayZones me
  call(#display, pZones)
end

on finishZones me
  call(#finish, pZones)
  pZones = []
end

on getHostile me
  miniMapStatus = me.getMiniMapStatus(#exitArrows)
  if miniMapStatus = #inf then
    return 1
  else
    return 0
  end if
end

on getMiniMapStatus me, forWhat
  if pType = #objects then
    return ancestor.getMiniMapStatus(forWhat)
  end if
end

on getType me
  return pType
end

on getZones me
  return pZones.duplicate()
end

on mergeZones me
  repeat with zone in pZones
    nothing()
    if zone.getMarkedForDeletion() = 0 then
      repeat with mergeZone in pZones
        if zone <> mergeZone then
          if mergeZone.getMarkedForDeletion() = 0 then
            zone.attemptMerge(mergeZone)
          end if
        end if
      end repeat
    end if
  end repeat
  repeat with i = pZones.count down to 1
    nZone = pZones[i]
    if nZone.getMarkedForDeletion() then
      nZone.finish()
      pZones.deleteAt(i)
    end if
  end repeat
end

on openZone me, sym, startLoc
  currentZone = g.objectMaster.requestObject(#objZone)
  params = currentZone.getParams(#init)
  params.sym = sym
  params.startLoc = startLoc
  currentZone.init(params)
  return currentZone
end

on saveLayer me
  myProps = [:]
  myProps[#name] = pType
  myProps[#map] = me.getMap()
  return myProps
end

on shiftZones me
  tilesize = me.pTileSet.getTileSize()
  shiftAmount = tilesize[1] * -1
  shiftRect = rect(0, shiftAmount, 0, shiftAmount)
  repeat with zone in pZones
    if zone.getSym() = #ceiling then
      zoneRect = zone.getRect()
      newRect = zoneRect + shiftRect
      zone.setRect(newRect)
    end if
  end repeat
end

on startObjects me
end
