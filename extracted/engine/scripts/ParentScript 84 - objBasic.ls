property big, id, pFlags
global gErrorTrace

on new me
  pFlags = []
  id = [#bigMe: #none]
  return me
end

on finish me
  if id[#master] <> VOID then
    id.master.objFree(me.id.bigMe)
  end if
end

on addSaveData me, sd
  return sd
end

on getType me
  return id.typ
end

on hasFlag me, theFlag
  flagPos = pFlags.getPos(theFlag)
  if flagPos > 0 then
    return 1
  else
    return 0
  end if
end

on removeFlag me, theFlag
  flagPos = pFlags.getPos(theFlag)
  if flagPos > 0 then
    pFlags.deleteAt(flagPos)
    return 1
  end if
  return 0
end

on restoreFromSave me, saveData
end

on testBasic me
  put "hello"
end

on update me
  nothing()
end
