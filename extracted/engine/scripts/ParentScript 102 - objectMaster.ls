property pCast, pCastKey, pFreeList, pObjList, pMaxObjects, pStatusList
global g

on new me
  return me
end

on init me
  pFreeList = [:]
  pObjList = [:]
  pMaxObjects = 100
  pStatusList = [:]
  pCast = member("objectMaster").castLibNum
  me.analyseCast()
end

on analyseCast me, theCastName
  pCastKey = CastMakeNameKey(pCast, #script)
  repeat with cas = 1 to pCastKey.count
    catSym = pCastKey.getPropAt(cas)
    me.checkCat(catSym)
  end repeat
end

on requestObject me, objSym
  if objSym = #objTimer then
    nothing()
  end if
  freeObj = me.getAvailable(objSym)
  if freeObj = 0 then
    freeObj = me.createNew(objSym)
  end if
  return freeObj
end

on checkCat me, objSym
  if getaProp(pStatusList, objSym) = VOID then
    pFreeList[objSym] = 0
    pObjList[objSym] = []
    pStatusList[objSym] = []
  end if
end

on finishAllWithFlag me, theFlag
  statusCopy = pStatusList.duplicate()
  objectCopy = pObjList.duplicate()
  listIndex = 1
  repeat with statList in statusCopy
    objIndex = 1
    repeat with stat in statList
      if stat = 1 then
        obj = objectCopy[listIndex][objIndex]
        if me.objHasFlag(obj, theFlag) then
          obj.finish()
        end if
      end if
      objIndex = objIndex + 1
    end repeat
    listIndex = listIndex + 1
  end repeat
end

on finishAllOfType me, objSym
  statusList = pObjList[objSym]
  index = 1
  repeat with stat in pStatusList[objSym]
    if stat = 1 then
      obj = pObjList[objSym][index]
      obj.finish()
    end if
    index = index + 1
  end repeat
end

on finishObjects me, objlist
  objlist = objlist.duplicate()
  repeat with obj in objlist
    if obj <> #none then
      obj.finish()
    end if
  end repeat
end

on getAvailable me, objSym
  freeObj = 0
  objectsFree = pFreeList[objSym]
  if objectsFree = 0 then
    return 0
  else
    pFreeList[objSym] = objectsFree - 1
  end if
  objStatus = pStatusList[objSym]
  if objStatus = VOID then
    alert("objectMaster.getAvailable()" & RETURN & "object doesn't exist:" & RETURN & RETURN & objSym)
    nothing()
  end if
  ob = objStatus.getPos(0)
  if ob > 0 then
    obList = pObjList[objSym]
    freeObj = obList[ob]
    pStatusList[objSym][ob] = 1
  end if
  return freeObj
end

on getActiveObjectsWithFlag me, theFlag
  objlist = []
  listIndex = 1
  repeat with statList in pStatusList
    objIndex = 1
    repeat with stat in statList
      if stat = 1 then
        obj = pObjList[listIndex][objIndex]
        if obj.hasFlag(theFlag) then
          objlist.append(obj)
        end if
      end if
      objIndex = objIndex + 1
    end repeat
    listIndex = listIndex + 1
  end repeat
  return objlist
end

on getFirstOfType me, objSym
  if pObjList[objSym].count > 0 then
    return pObjList[objSym][1]
  end if
end

on getFlagActive me, theFlag
  objs = me.getActive()
  repeat with obj in objs
    if me.objHasFlag(obj, theFlag) then
      return 1
    end if
  end repeat
  return 0
end

on getPlayers me, thePlayers
  potentialObjects = me.getActiveObjectsWithFlag(#player)
  repeat with nPlayer in thePlayers
    nCharacter = nPlayer.objCharacter
    repeat with nPotObj in potentialObjects
      if nPotObj.getCharacter() = nCharacter then
        nPlayer.obj = nPotObj
        exit repeat
      end if
    end repeat
  end repeat
  return thePlayers
end

on getTotal me
  total = 0
  repeat with obList in pObjList
    total = total + obList.count
  end repeat
  return total
end

on getTotalInUse me
  inUseObj = 0
  repeat with statList in pStatusList
    repeat with statu in statList
      inUseObj = inUseObj + statu
    end repeat
  end repeat
  return inUseObj
end

on putInUse me
  put "objectMaster : in Use report"
  repeat with i = 1 to pStatusList.count
    statList = pStatusList[i]
    statProp = getPropAt(pStatusList, i)
    typeTotal = 0
    repeat with statu in statList
      typeTotal = typeTotal + statu
    end repeat
    if typeTotal > 0 then
      put statProp & " = " & typeTotal
    end if
  end repeat
end

on removeObjectsWithFlagFromList me, objlist, theFlag
  indexesToDelete = []
  objIndex = 1
  repeat with obj in objlist
    if obj.hasFlag(theFlag) then
      indexesToDelete.append(objIndex)
    end if
    objIndex = objIndex + 1
  end repeat
  numToDelete = indexesToDelete.count
  repeat with i = numToDelete down to 1
    objlist.deleteAt(indexesToDelete[i])
  end repeat
  return objlist
end

on createNew me, objSym
  newObj = new(script(string(objSym)))
  pStatusList[objSym].add(1)
  pObjList[objSym].add(newObj)
  indx = pObjList[objSym].count
  newObj.id = [#typ: objSym, #indx: indx, #master: me, #bigMe: newObj]
  newObj.big = newObj
  return newObj
end

on objAllDelete me
  repeat with obList in pObjList
    repeat with ob = 1 to obList.count
      obList[ob].finish()
      obList[ob] = 0
    end repeat
  end repeat
end

on objFree me, obj
  id = obj.id
  objSym = id.typ
  indx = id.indx
  if indx > pMaxObjects then
    pos = pObjList[objSym].getPos(obj)
    if pos > 0 then
      pObjList[objSym].deleteAt(pos)
      pStatusList[objSym].deleteAt(pos)
    end if
  else
    if pStatusList[objSym][indx] <> 0 then
      pStatusList[objSym][indx] = 0
      pFreeList[objSym] = pFreeList[objSym] + 1
    end if
  end if
end

on objHasFlag me, theObj, theFlag
  if theObj.pFlags.getPos(theFlag) > 0 then
    return 1
  end if
  return 0
end
