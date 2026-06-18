property ancestor, pBlankEntry, pMap, pMapSize

on new me
  ancestor = new(script("objSpriteMember"))
  i = me.modifyParams(#init)
  i[#blankEntry] = 0
  i[#map] = #none
  i[#mapSize] = point(10, 10)
  return me
end

on init me, params
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

on checkValidLoc me, theloc
  return GeomInside(theloc, rect(1, 1, pMapSize[1], pMapSize[2]))
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

on getSize me
  return pMapSize
end

on getNumEntries me
  return pMapSize[1] * pMapSize[2]
end

on getMap me
  return pMap
end

on peek me, theloc
  if me.checkValidLoc(theloc) = 0 then
    return #errorLocOutsideMap
  end if
  mx = theloc[1]
  my = theloc[2]
  return pMap[my][mx]
end

on peekEntryNo me, theNum, theloc
  col = ((theNum - 1) mod pMapSize[1]) + 1
  row = ((theNum - 1) / pMapSize[1]) + 1
  theloc[1] = col
  theloc[2] = row
  return me.peek(theloc)
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
