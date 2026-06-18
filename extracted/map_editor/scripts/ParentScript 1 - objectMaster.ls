property pCast, pCastKey, pObjList, pStatusList

on new me
  return me
end

on init me
  pObjList = [:]
  pStatusList = [:]
  pCast = #none
  me.analyseCast("script_objects")
end

on analyseCast me, theCastName
  pCast = castLib(theCastName).number
  pCastKey = CastMakeNameKey(pCast, #script)
  repeat with cas = 1 to pCastKey.count
    catSym = pCastKey.getPropAt(cas)
    me.checkCat(catSym)
  end repeat
end

on requestObject me, objSym
  freeObj = me.getAvailable(objSym)
  if freeObj = 0 then
    freeObj = me.createNew(objSym)
  end if
  return freeObj
end

on checkCat me, objSym
  if getaProp(pStatusList, objSym) = VOID then
    pObjList[objSym] = []
    pStatusList[objSym] = []
  end if
end

on finishAllWithFlag me, theFlag
  listIndex = 1
  repeat with statList in pStatusList
    objIndex = 1
    repeat with stat in statList
      if stat = 1 then
        obj = pObjList[listIndex][objIndex]
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
  objStatus = pStatusList[objSym]
  ob = objStatus.getPos(0)
  if ob > 0 then
    obList = pObjList[objSym]
    freeObj = obList[ob]
    pStatusList[objSym][ob] = 1
  end if
  return freeObj
end

on getFirstOfType me, objSym
  if pObjList[objSym].count > 0 then
    return pObjList[objSym][1]
  end if
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

on createNew me, objSym
  newObj = new(script(string(objSym)))
  pStatusList[objSym].add(1)
  pObjList[objSym].add(newObj)
  newObj.id = [#typ: objSym, #indx: pObjList[objSym].count, #master: me, #bigMe: newObj]
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

on objFree me, id
  objSym = id.typ
  indx = id.indx
  pStatusList[objSym][indx] = 0
end

on objHasFlag me, theObj, theFlag
  if theObj.pFlags.getPos(theFlag) > 0 then
    return 1
  end if
  return 0
end
