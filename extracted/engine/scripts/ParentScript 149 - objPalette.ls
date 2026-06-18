property ancestor, pLocation, pSym, pTarget

on new me
  ancestor = new(script("objTileSetKey"))
  i = me.modifyParams(#init)
  i.displayScale = 2
  i[#location] = point(32, 4)
  i[#member] = member("tlk_commands", "gfx")
  i[#sym] = #newPalette
  i[#targetObject] = #none
  i.allowRangeSelections = 0
  return me
end

on init me, params
  me.ancestor.init(params)
  pLocation = params.location
  pSym = params.sym
  pTarget = params.targetObject
end

on display me
  me.show(#edit, pLocation)
end

on getInitialGridSelection me
  if pTarget <> #none then
    return pTarget.getInitialGridSelection(pSym)
  end if
  return #none
end

on selectionMade me, theSel, theObj
  case theObj of
    me:
      commandSym = me.getTileSymbol(theSel)
      pTarget.commandIssued(commandSym)
  end case
end

on setLocation me, newLoc
  pLocation = newLoc
end

on updateLocation me, newLoc
  me.setLocation(newLoc)
  me.setSpriteLoc(newLoc)
  ancestor.updateLocation(newLoc)
end
