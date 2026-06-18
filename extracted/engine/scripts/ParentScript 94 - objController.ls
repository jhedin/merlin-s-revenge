property ancestor, pExclusive, pObjects
global g

on new me
  ancestor = new(script("objParams"))
  i = me.modifyParams(#init)
  i[#exclusive] = 1
  return me
end

on init me, params
  ancestor.init(params)
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
  pObjects = []
end

on getObject me, pos
  if pos < 1 then
    pos = 1
  end if
  if pObjects.count = 0 then
    return #none
  end if
  return pObjects[pos]
end

on newObject me, params
  params.myController = me.id.bigMe
  if pExclusive then
    me.id.bigMe.deactivateObjects()
  end if
  return params
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
