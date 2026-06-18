property ancestor, pBrushTiles

on new me
  ancestor = new(script("objTool"))
  return me
end

on init me, params
  ancestor.init(params)
  pBrushTiles = #none
end

on adjustGridSelectors me, theGridSelectors
  room = theGridSelectors.room
  room.setAllowRangeSelections(0)
  room.setSelectOnPress(1)
  me.setBrushTiles(pBrushTiles)
end

on roomSelected me, theSel
  if pBrushTiles = #none then
    return 
  end if
  toolPal = me.getToolPalette()
  room = toolPal.getCurrentRoom()
  themap = toolPal.getCurrentMap()
  room.setTilesBrush(theSel, pBrushTiles)
  room.refreshImage()
  themap.refreshRoomMapImage(room)
end

on tileSetSelected me, theSel
  toolPal = me.getToolPalette()
  tileSet = toolPal.getCurrentTileSet()
  theTiles = tileSet.calcTileNums(theSel)
  me.setBrushTiles(theTiles)
end

on setBrushTiles me, theTiles
  pBrushTiles = theTiles
  brushSize = point(1, 1)
  if pBrushTiles <> #none then
    brushSize = point(pBrushTiles[1].count, pBrushTiles.count)
  end if
  gridSels = me.getToolPalette().getGridSelectors()
  gridSels.room.setBoxSize(brushSize)
end
