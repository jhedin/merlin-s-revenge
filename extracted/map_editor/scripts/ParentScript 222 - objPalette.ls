property ancestor, pLocation, pTarget

on new me
  ancestor = new(script("objTileSetKey"))
  i = me.modifyParams(#init)
  i.displayScale = 2
  i[#location] = point(32, 4)
  i[#member] = member("tlk_commands", "gfx")
  i[#targetObject] = #none
  i.allowRangeSelections = 0
  return me
end

on init me, params
  me.ancestor.init(params)
  pLocation = params.location
  pTarget = params.targetObject
end

on display me
  me.show(#edit, pLocation)
end

on selectionMade me, theSel, theObj
  case theObj of
    me:
      commandSym = me.getTileSymbol(theSel)
      pTarget.commandIssued(commandSym)
  end case
end
