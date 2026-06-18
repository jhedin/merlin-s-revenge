property ancestor, pBlankEntry, pErrorLocOutsideMapSymbol, pMap, pMapSize

on new me
  ancestor = new(script("objSpriteMember"))
  i = me.modifyParams(#init)
  i[#blankEntry] = 0
  i[#errorLocOutsideMapSymbol] = #errorOutsideMap
  i[#map] = #none
  i[#mapSize] = point(10, 10)
  return me
end

on init me, params
  pErrorLocOutsideMapSymbol = params.errorLocOutsideMapSymbol
  ancestor.init(params)
  case params.map of
    #none:
      me.createBlank(params.mapSize, params.blankEntry)
    #incremental:
      me.createIncremental(params.mapSize)
    otherwise:
      me.setMap(params.map)
  end case
end

on checkValidCol me, theCol
  return VarInRange(theCol, 1, pMapSize[1])
end

on checkValidLoc me, theloc
  return GeomInside(theloc, rect(1, 1, pMapSize[1], pMapSize[2]))
end

on checkValidRow me, theRow
  return VarInRange(theRow, 1, pMapSize[2])
end

on createBlank me, mapSize, blankEntry
  pBlankEntry = blankEntry
  me.createNew(mapSize, #Blank, blankEntry)
end

on createIncremental me, mapSize
  me.createNew(mapSize, #incremental, 1)
end

on createNew me, mapSize, theType, firstEntry
  nEntry = firstEntry
  pMapSize = mapSize
  themap = []
  repeat with r = 1 to pMapSize[2]
    theRow = []
    repeat with c = 1 to pMapSize[1]
      theRow[c] = nEntry
      case theType of
        #incremental:
          nEntry = nEntry + 1
      end case
    end repeat
    themap[r] = theRow
  end repeat
  pMap = themap
end

on calcEntryNum me, theloc
  entryNum = (theloc[2] - 1) * pMapSize[1]
  entryNum = entryNum + theloc[1]
  return entryNum
end

on getCount me
  return me.getNumEntries()
end

on getSize me
  return pMapSize
end

on getNumEntries me
  return pMapSize[1] * pMapSize[2]
end

on getMap me
  return pMap.duplicate()
end

on peek me, theloc
  if me.checkValidLoc(theloc) = 0 then
    return pErrorLocOutsideMapSymbol
  end if
  mx = theloc[1]
  my = theloc[2]
  return pMap[my][mx]
end

on peekEntryNo me, theNum, theloc
  col = ((theNum - 1) mod pMapSize[1]) + 1
  row = ((theNum - 1) / pMapSize[1]) + 1
  if theloc = VOID then
    theloc = point(0, 0)
  end if
  theloc[1] = col
  theloc[2] = row
  return me.peek(theloc)
end

on peekEntryNoVert me, theNum, theloc
  row = ((theNum - 1) mod pMapSize[2]) + 1
  col = ((theNum - 1) / pMapSize[2]) + 1
  if theloc = VOID then
    theloc = point(0, 0)
  end if
  theloc[1] = col
  theloc[2] = row
  return me.peek(theloc)
end

on peekCol me, theCol
  if me.checkValidCol(theCol) then
    column = []
    nPoint = point(theCol, 0)
    repeat with r = 1 to pMapSize[2]
      nPoint[2] = r
      column.append(me.peek(nPoint))
    end repeat
    return column
  else
    return pErrorLocOutsideMapSymbol
  end if
end

on peekRow me, theRow
  if me.checkValidRow(theRow) then
    return pMap[theRow].duplicate()
  else
    return #errorRowOutsideMap
  end if
end

on poke me, theloc, theVal
  if me.checkValidLoc(theloc) = 0 then
    return #errorLocOutsideMap
  end if
  mx = theloc[1]
  my = theloc[2]
  pMap[my][mx] = theVal
end

on pokeAll me, theVal
  numEntries = me.getNumEntries()
  theloc = point(0, 0)
  repeat with i = 1 to numEntries
    nEntry = me.peekEntryNo(i, theloc)
    me.poke(theloc, theVal)
  end repeat
end

on pokeEntryNo me, theNum, newVal, theloc
  col = ((theNum - 1) mod pMapSize[1]) + 1
  row = ((theNum - 1) / pMapSize[1]) + 1
  if theloc = VOID then
    theloc = point(0, 0)
  end if
  theloc[1] = col
  theloc[2] = row
  return me.poke(theloc, newVal)
end

on pokeMap me, startLoc, objDataMap, inputSize
  if voidp(inputSize) then
    inputSize = objDataMap.getSize()
  end if
  peekPoint = point(0, 0)
  startOffset = startLoc - point(1, 1)
  repeat with y = 1 to inputSize[2]
    repeat with x = 1 to inputSize[1]
      peekPoint[1] = x
      peekPoint[2] = y
      pokePoint = peekPoint + startOffset
      nData = objDataMap.peek(peekPoint)
      me.poke(pokePoint, nData)
    end repeat
  end repeat
end

on setMap me, themap
  mapX = themap[1].count
  mapY = themap.count
  pMapSize = point(mapX, mapY)
  pMap = themap.duplicate()
end

on saveToMember me, theMember
end

on trimToMaxNum me, maxNum
end
