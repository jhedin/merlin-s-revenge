property ancestor

on new me
  ancestor = new(script("objTool"))
  return me
end

on adjustGridSelectors me, theGridSelectors
  room = theGridSelectors.room
  room.setAllowRangeSelections(1)
  room.setSelectOnPress(0)
end

on roomSelected me, theSel
  toolPalette = me.getToolPalette()
  room = toolPalette.getCurrentRoom()
  theTiles = room.getTilesInSelection(theSel)
  brush = toolPalette.getTool(#brush)
  brush.setBrushTiles(theTiles)
  toolPalette.setCurrentTool(#brush)
end

on tileSetSelected me
  toolPalette = me.getToolPalette()
  toolPalette.setCurrentTool(#brush)
end
