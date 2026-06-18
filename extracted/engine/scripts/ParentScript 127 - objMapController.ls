property ancestor, pTileSets
global g, gMapLayer

on new me
  ancestor = new(script("objController"))
  return me
end

on init me, params
  ancestor.init(params)
end

on deactivateObjects me
  me.finishObjects()
end

on newObject me, defMember, location
  thename = defMember.name
  newmap = me.makeNewObject(defMember, location, thename)
  newmap.goActivateMode()
  newmap.onscreen()
  return newmap
end

on makeNewObject me, defMember, location, thename
  numMaps = me.pObjects.count
  nMap = g.objectMaster.requestObject(#objMap)
  params = nMap.getParams(#init)
  params.name = thename
  params.definitionTxt = defMember.text
  params.layer = me.pObjects.count + gMapLayer
  params.location = location
  params = ancestor.newObject(params)
  nMap.init(params)
  me.pObjects.append(nMap)
  return nMap
end
