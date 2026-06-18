property ancestor, pCollisionMap
global g, gMoveSpeedLimit, gFrameNum

on new me
  ancestor = new(script("modModule"))
  return me
end

on addModParams me
  i = me.modifyParams(#init)
  ancestor.addModParams()
end

on init me, params
  pCollisionMap = #none
  ancestor.init(params)
end

on initCollisionMap me
  if pCollisionMap <> #none then
    return 
  end if
  objTileLayer = me.id.bigMe.pTileLayers[#backgroundActive]
  me.setMoveSpeedLimit(objTileLayer)
  pCollisionMap = g.objectMaster.requestObject(#objCollisionMap)
  params = pCollisionMap.getParams(#init)
  params.objTileMap = objTileLayer
  params.room = me.id.bigMe
  pCollisionMap.init(params)
end

on finish me
  me.finishCollisionMap()
  ancestor.finish()
end

on finishCollisionMap me
  if pCollisionMap <> #none then
    pCollisionMap.finish()
    pCollisionMap = #none
  end if
end

on activate me
  me.initCollisionMap()
  me.closeExits()
  g.collisionMaster.setCollisionMap(pCollisionMap)
end

on deactivate me
end

on closeExits me
  g.collisionMaster.setExitsOpen(0)
end

on convertScreenLocToTileLoc me, screenloc
  firstTileLoc = pCollisionMap.getFirstTileLoc()
  tilesize = pCollisionMap.getTileSize()
  tileLoc = (screenloc - firstTileLoc) / tilesize
  tileLoc = tileLoc + point(1, 1)
  return tileLoc
end

on getActiveTileTypeAtLoc me, screenloc
  tileType = #outsidePlayArea
  tileLoc = me.convertScreenLocToTileLoc(screenloc)
  collisionTile = pCollisionMap.peek(tileLoc)
  if collisionTile <> #none then
    tileType = collisionTile.getTileType()
  end if
  return tileType
end

on offscreen me
  if me.getMode() = #activate then
  end if
end

on openExits me
  surroundingExitTiles = me.id.bigMe.getMap().getSurroundingExitTiles()
  pCollisionMap.insertExitTiles(surroundingExitTiles)
  g.collisionMaster.setExitsOpen(1)
end

on restoreFromSave me, sd
  ancestor.restoreFromSave(sd)
  me.finishCollisionMap()
end

on setMoveSpeedLimit me, tileLayer
  tilesize = tileLayer.getTileSize()
  gMoveSpeedLimit = rect(-tilesize[1], -tilesize[2], tilesize[1], tilesize[2])
  gMoveSpeedLimit = inflate(gMoveSpeedLimit, -1, -1)
end
