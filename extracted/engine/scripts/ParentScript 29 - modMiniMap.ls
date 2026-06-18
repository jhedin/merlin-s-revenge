property ancestor, pBlendDistances, pBlendLevels, pBorder, pMapData, pMember, pMyLayer, pScale, pSprite, pStatusImages, pShowMiniMap
global g, gGameTextLayer

on new me
  ancestor = new(script("modModule"))
  return me
end

on addModParams me
  i = me.modifyParams(#init)
  i[#blendDistances] = [60, 200]
  i[#blendLevels] = [10, 90]
  i[#border] = rect(1, 1, 2, 2)
  i[#scale] = 2
  i[#statusImages] = [:]
  s = i.statusImages
  s[#clr] = member("miniClear", "gfx").image
  s[#cur] = member("miniCurrent", "gfx").image
  s[#fre] = member("miniFriendly", "gfx").image
  s[#inf] = member("miniInfested", "gfx").image
  s[#spe] = member("miniSpecial", "gfx").image
  ancestor.addModParams()
end

on init me, params
  pBlendLevels = params.blendLevels
  pBlendDistances = params.blendDistances
  pBorder = params.border
  pScale = params.scale
  pStatusImages = params.statusImages
  pShowMiniMap = 0
  pMapData = #none
  pMember = #none
  pMyLayer = gGameTextLayer
  pSprite = #none
  me.id.bigMe.registerMinimap(me)
  ancestor.init(params)
end

on initMiniMapData me
  pMapData = g.objectMaster.requestObject(#objDataMap)
  params = pMapData.getParams(#init)
  params.mapSize = me.id.bigMe.getSize()
  pMapData.init(params)
  roomCount = me.id.bigMe.getCount()
  repeat with i = 1 to roomCount
    nRoomNum = me.id.bigMe.peekEntryNo(i)
    nRoom = me.id.bigMe.getRoom(nRoomNum)
    nMiniMapStatus = nRoom.getMiniMapStatus()
    pokeLoc = point(0, 0)
    pMapData.pokeEntryNo(i, nMiniMapStatus, pokeLoc)
  end repeat
  if pShowMiniMap then
    me.miniMapOffScreen()
    me.displayMiniMap()
  end if
end

on finish me
  me.miniMapOffScreen()
  ancestor.finish()
end

on addSaveData me, sd
  ancestor.addSaveData(sd)
  sd[#pShowMiniMap] = pShowMiniMap
end

on displayMiniMap me
  mapData = me.getMiniMapData()
  mapImage = me.drawMap(mapData)
  me.setupSprite(mapImage)
  currentRoom = me.id.bigMe.getCurrentRoom()
  pSprite.loc = currentRoom.getMiniMapLoc()
  g.updater.addPrg(me.id.bigMe, #lo)
  pShowMiniMap = 1
end

on drawMap me, mapData
  clearImage = pStatusImages.clr
  imageSize = mapData.getSize() * point(clearImage.width, clearImage.height)
  imageSize = imageSize + point(pBorder.left + pBorder.right, pBorder.top + pBorder.bottom)
  mapImage = image(imageSize[1], imageSize[2], 32, 0)
  mapImage.fill(mapImage.rect, rgb(0, 0, 0))
  numRooms = mapData.id.bigMe.getCount()
  roomLoc = point(0, 0)
  repeat with i = 1 to numRooms
    nStatus = mapData.peekEntryNo(i, roomLoc)
    nStartX = pBorder.left + ((roomLoc.locH - 1) * clearImage.width)
    nStartY = pBorder.top + ((roomLoc.locV - 1) * clearImage.height)
    nEndX = nStartX + clearImage.width
    nEndY = nStartY + clearImage.height
    mapImage.copyPixels(pStatusImages[nStatus], rect(nStartX, nStartY, nEndX, nEndY), clearImage.rect, [#useFastQuads: 1, #ink: 0])
  end repeat
  return mapImage
end

on getMiniMapData me
  repeat with i in [1, -1]
    nRoomLoc = me.id.bigMe.getCurrentRoomLoc()
    nRoomLoc.locH = nRoomLoc.locH + i
    nRoomNum = me.id.bigMe.getRoomAt(nRoomLoc)
    case nRoomNum of
      #errorOutsideMap:
        nothing()
      otherwise:
        nRoom = me.id.bigMe.getRoom(nRoomNum)
        nMiniMapStatus = nRoom.getMiniMapStatus()
        pMapData.poke(nRoomLoc, nMiniMapStatus)
    end case
    nRoomLoc = me.id.bigMe.getCurrentRoomLoc()
    nRoomLoc.locV = nRoomLoc.locV + i
    nRoomNum = me.id.bigMe.getRoomAt(nRoomLoc)
    case nRoomNum of
      #errorOutsideMap:
        nothing()
      otherwise:
        nRoom = me.id.bigMe.getRoom(nRoomNum)
        nMiniMapStatus = nRoom.getMiniMapStatus()
        pMapData.poke(nRoomLoc, nMiniMapStatus)
    end case
  end repeat
  currentRoomLoc = me.id.bigMe.getCurrentRoomLoc()
  pMapData.poke(currentRoomLoc, #cur)
  return pMapData
end

on goNavMode me
  me.displayMiniMap()
end

on leaveNavMode me
  me.miniMapOffScreen()
end

on miniMapOffScreen me
  g.updater.removePrg(me.id.bigMe)
  if pSprite <> #none then
    g.spriteMaster.freeSprite(pSprite)
    pSprite = #none
  end if
  if pMember <> #none then
    g.memberMaster.freeMember(pMember)
    pMember = #none
  end if
  pShowMiniMap = 0
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
  me.miniMapOffScreen()
end

on setBlendForMouseOrPlayer me
  mouloc = the mouseLoc
  playerLoc = g.actorMaster.getPlayer().getLoc()
  myloc = pSprite.loc
  mouDist = geomPixelDist(mouloc, myloc)
  playerDist = geomPixelDist(playerLoc, myloc)
  minDist = min(mouDist, playerDist)
  theBlend = varMapRange(minDist, pBlendDistances, pBlendLevels)
  pSprite.blend = theBlend
end

on setupSprite me, mapImage
  if pSprite = #none then
    pSprite = g.spriteMaster.requestSprite()
    pSprite.locZ = pMyLayer
  end if
  if pMember = #none then
    pMember = g.memberMaster.requestMember(#bitmap, "miniMap")
  end if
  pMember.image = mapImage
  pMember.regPoint = point(pMember.width, pMember.height)
  SpriteSetMember(pSprite, pMember)
  pSprite.width = pSprite.width * pScale
  pSprite.height = pSprite.height * pScale
end

on update me
  me.setBlendForMouseOrPlayer()
end
