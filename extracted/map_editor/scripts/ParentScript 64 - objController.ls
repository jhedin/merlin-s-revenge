property ancestor, pExclusive, pObjects
global g

on new me
  ancestor = new(script("objParams"))
  i = me.modifyParams(#init)
  i[#exclusive] = 1
  return me
end

on init me, params
  pExclusive = params.exclusive
  pObjects = []
end

on finish me
  me.finishObjects()
  ancestor.finish()
end

on clearAll me
  me.finishObjects()
end

on deactivateObjects me
  repeat with nObj in pObjects
    nObj.deactivate()
  end repeat
end

on finishObjects me
  g.objectMaster.finishObjects(pObjects)
end

on newObject me
  if pExclusive then
    me.deactivateObjects()
  end if
end

on objectFinished me, theObject
  objpos = pObjects.getPos(theObject)
  if objpos > 0 then
    pObjects.deleteAt(objpos)
    if pExclusive then
      if (objpos - 1) > 0 then
        pObjects[objpos - 1].activate()
      end if
    end if
  end if
end

on start me
end

on stop me
  me.finish()
end
