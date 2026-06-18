property pCollections, pCollectionKey, pNamesToSkip
global g

on new me
  return me
end

on init me
  pCollections = [:]
  pCollectionKey = [#objFont: "fnt", #objTileSet: "tls", #objTileSetKey: "tlk"]
  pNamesToSkip = ["key", "properties"]
  me.initCollections()
end

on initCollections me
  numGFX = the number of castMembers of castLib "gfx"
  repeat with i = 1 to numGFX
    nMem = member(i, "gfx")
    nName = nMem.name
    nPrefix = nName.char[1..3]
    nNewName = StringToSymbol(nName.char[5..99])
    if me.checkInCollection(nPrefix) then
      if me.checkInNamesToSkip(nName) then
        continue()
        next repeat
      end if
      nObjSym = me.getObjSym(nPrefix)
      nObj = g.objectMaster.requestObject(nObjSym)
      params = nObj.getParams(#init)
      params.member = nMem
      nObj.init(params)
      if pCollections[nObjSym] = VOID then
        pCollections[nObjSym] = [:]
      end if
      pCollections[nObjSym][symbol(nNewName)] = nObj
    end if
  end repeat
  nothing()
end

on finish me
  repeat with nCollection in pCollections
    g.objectMaster.finishObjects(nCollection)
  end repeat
end

on checkInCollection me, nPrefix
  if pCollectionKey.getPos(nPrefix) > 0 then
    return 1
  end if
  return 0
end

on checkInNamesToSkip me, nName
  repeat with nNameToSkip in pNamesToSkip
    if nName contains nNameToSkip then
      return 1
    end if
  end repeat
  return 0
end

on listCollections me
  ListPrint(pCollections)
end

on getObj me, objType, objSymbol
  return pCollections[objType][objSymbol]
end

on getObjSym me, nPrefix
  pos = pCollectionKey.getPos(nPrefix)
  return pCollectionKey.getPropAt(pos)
end

on stop me
  me.finish()
end
