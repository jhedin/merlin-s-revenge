property ancestor, pRoom, pType

on new me
  ancestor = new(script("objTileMap"))
  i = me.modifyParams(#init)
  i[#room] = #none
  i[#roomTileSets] = #none
  i[#type] = #none
  return me
end

on init me, params
  pRoom = params.room
  pType = params.type
  params.tileSet = params.roomTileSets[pType]
  ancestor.init(params)
  if pType = #backgroundPassive then
    me.setCopyPixelsParams([#useFastQuads: 1, #ink: 0])
  end if
end

on calcZones me
end

on getType me
  return pType
end

on getZones me
  zones = me.calcZones()
  return zones
end

on saveLayer me
  myProps = [:]
  myProps[#name] = pType
  myProps[#map] = me.getMap()
  return myProps
end

on startObjects me
end
