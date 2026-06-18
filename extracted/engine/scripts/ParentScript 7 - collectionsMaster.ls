property pCollections, pCollectionKey, pNamesToSkip
global g

on new me
  return me
end

on init me
  pCollections = [:]
  pCollectionKey = [:]
  c = pCollectionKey
  c[#objActorData] = "act"
  c[#objKeyBinding] = "bnd"
  c[#objKeyDescriptions] = "kyd"
  c[#objFont] = "fnt"
  c[#objScript] = "scr"
  c[#objTeamData] = "tem"
  c[#objText] = "txt"
  c[#objTileSet] = "tls"
  c[#objTileSetKey] = "tlk"
  pNamesToSkip = ["key", "properties"]
  me.initCollections()
  nothing()
end

on initCollections me
  numGFX = the number of castMembers of castLib "data"
  repeat with i = 1 to numGFX
    nMem = member(i, "data")
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
end

on finish me
  if ilk(pCollections) <> #void then
    repeat with nCollection in pCollections
      g.objectMaster.finishObjects(nCollection)
    end repeat
  end if
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

on getCollection me, objType
  if pCollections[objType] = VOID then
    return #none
  else
    return pCollections[objType].duplicate()
  end if
end

on getObj me, objType, objSymbol
  obj = pCollections[objType][objSymbol]
  if voidp(obj) then
    alert("An item that the game expected to be there is missing" & RETURN & "type: " & objType & "   object: " & objSymbol)
    halt()
  end if
  return obj
end

on getObject me, objType, objSymbol
  return me.getObj(objType, objSymbol)
end

on getObjSym me, nPrefix
  pos = pCollectionKey.getPos(nPrefix)
  return pCollectionKey.getPropAt(pos)
end

on stop me
  me.finish()
end
