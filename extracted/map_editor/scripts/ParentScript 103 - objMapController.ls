property ancestor, pTileSets
global g, gMapLayer

on new me
  ancestor = new(script("objController"))
  return me
end

on init me, params
  ancestor.init(params)
end

on makeNewObject me, defMember, location, thename, theMaster, theCast
  if voidp(theCast) then
    theCast = "gfx"
  end if
  if voidp(theMaster) then
    theMaster = #none
  end if
  numMaps = me.pObjects.count
  nMap = g.objectMaster.requestObject(#objMap)
  params = nMap.getParams(#init)
  params.name = thename
  params.definitionTxt = defMember.text
  params.layer = me.pObjects.count + gMapLayer
  params.location = location
  params.master = theMaster
  params.theCast = theCast
  nMap.init(params)
  me.pObjects.append(nMap)
  return nMap
end
