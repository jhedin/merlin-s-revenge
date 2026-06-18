property pControllerTypes, pControllers
global g

on new me
  return me
end

on init me
  pControllerTypes = [#menu, #map]
  pControllers = [:]
  me.initControllers()
end

on initControllers me
  repeat with nType in pControllerTypes
    objSym = me.convertTypeToObjectSym(nType)
    nController = g.objectMaster.requestObject(objSym)
    params = nController.getParams(#init)
    nController.init(params)
    pControllers[nType] = nController
  end repeat
end

on finish me
  g.objectMaster.finishObjects(pControllers)
end

on convertTypeToObjectSym me, nType
  theStr = string(nType)
  stringSym = "obj" & theStr & "Controller"
  theSym = symbol(stringSym)
  return theSym
end

on getController me, theType
  return pControllers[theType]
end

on newObject me, theType, defMember, location
  pControllers[theType].newObject(defMember, location)
end

on stop me
  me.finish()
end
