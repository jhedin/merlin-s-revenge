property pCurrentMap, pFirstMenu, pLocation, pLoadMode, pMapController, pMapNameFromFile, pMenuController, pLoadSingle
global g, r

on new me
  return me
end

on init me
  pCurrentMap = #none
  pFirstMenu = "start"
  pLocation = #none
  pLoadSingle = 0
  pLoadMode = #file
  pMapController = g.controllerMaster.getController(#map)
  pMenuController = g.controllerMaster.getController(#menu)
end

on finish me
  me.finishCurrentMap()
end

on start me, location
  pLocation = location
  if pLoadSingle and (pLoadMode = #file) then
    me.loadMapFromFile()
  else
    pMenuController.newObject(member("dd_menu_" & pFirstMenu, "gfx"), pLocation)
  end if
end

on finishCurrentMap me
  if pCurrentMap <> #none then
    pCurrentMap.finish()
  end if
end

on getListOfMaps me
  nameList = []
  case pLoadMode of
    #cast:
      memList = CastGetMembersContaining("dd_map_", "gfx")
      repeat with mem in memList
        nName = mem.name.char[8..99]
        nameList.append(nName)
      end repeat
    #file:
      nameList = g.loaderMaster.loadAllInDir("map_to_play\")
    #web:
  end case
  return nameList
end

on loadClicked me, theMenu
  listOfMaps = me.getListOfMaps()
  location = theMenu.getNextLocation()
  pMenuController.newDialogue("Load a Map", listOfMaps, location)
end

on loadMap me, themap, theCast
  if voidp(theCast) then
    case pLoadMode of
      #cast:
        theCast = "gfx"
      #file:
        theCast = "temp"
        pMapNameFromFile = string(themap) & ".txt"
      #web:
    end case
  end if
  pMenuController.clearAll()
  theMapName = "dd_map_" & string(themap)
  me.finishCurrentMap()
  definition = member(theMapName, theCast)
  pCurrentMap = pMapController.makeNewObject(definition, pLocation, theMapName, me, theCast)
  pCurrentMap.goEditMode()
  pCurrentMap.onscreen()
end

on loadMapFromFile me
  g.memberMaster.requestMember(#field, "dd_map_fromFile")
  pMapNameFromFile = g.loaderMaster.loadFirstInDir("map_to_play\", "dd_map_fromFile", "temp")
  me.loadMap("fromFile", "temp")
end

on mapEvent me, theEvent
  case theEvent of
    #mapSaved:
      me.saveMap()
  end case
end

on saveMap me
  filePath = "map_to_play\" & pMapNameFromFile
  if pLoadSingle then
    mapName = "dd_map_fromFile"
  else
    strLen = pMapNameFromFile.length
    mapName = "dd_map_" & pMapNameFromFile.char[1..strLen - 4]
  end if
  g.loaderMaster.saveToFile(filePath, mapName, "temp")
end

on stop me
  me.finish()
end
